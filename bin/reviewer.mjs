#!/usr/bin/env node
// reviewer-lib CLI — run a structured code review from the terminal or CI.
// Imports the package's own build so `npx reviewer-lib review` works after install.
import { readFileSync } from 'node:fs';
import pkg from '../dist/index.js';
import { parseArgs } from '../dist/utils/cli-args.js';

const { Reviewer, formatFindings, toReviewComments, hasBlockingFindings } = pkg;

const HELP = `reviewer-lib — AI code review

Usage:
  reviewer-lib review [options]

Input (pick one; defaults to stdin):
  --diff <file>      Read a unified diff from a file
  --pr <number>      Fetch the diff of a GitHub pull request (needs GITHUB_TOKEN + GITHUB_REPOSITORY)
  (stdin)            Pipe a diff, e.g.  git diff main | reviewer-lib review

Options:
  --code             Treat the input as raw code instead of a diff
  --lang <language>  Hint the source language (e.g. typescript, python)
  --filter           Second-pass triage: drop low-value/defensive findings
  --summary          Add a short "what changed" overview above the findings (one extra call)
  --filter-model <m> Model for the triage pass (default: same as --model; use a stronger one)
  --cache-dir <dir>  Cache results by content hash in <dir> (skip re-reviewing unchanged input)
  --exclude <globs>  Extra comma-separated path globs to skip (lockfiles + dist/ are skipped by default)
  --model <name>     Model to use (default: o4-mini; pass gpt-4o-mini for a cheaper, noisier review)
  --format <fmt>     Output format: text (default) | json
  --fail-on <sev>    Exit 1 if any finding is >= severity (critical|high|medium|low)
  --post             Post the review to the PR (requires --pr)
  --api-key <key>    OpenAI key (default: $OPENAI_API_KEY)
  --timeout <ms>     Per-request timeout in ms (default: 120000)
  --max-retries <n>  Retry attempts on transient errors (default: 3)
  -h, --help         Show this help

Environment:
  OPENAI_API_KEY     OpenAI API key
  GITHUB_TOKEN       GitHub token (for --pr / --post)
  GITHUB_REPOSITORY  owner/repo (for --pr / --post; auto-set inside GitHub Actions)

Examples:
  git diff origin/main | reviewer-lib review --fail-on high
  reviewer-lib review --diff pr.diff --format json
  reviewer-lib review --pr 54 --post --fail-on high
`;

function fail(message) {
    console.error(`Error: ${message}`);
    process.exit(1);
}

async function readStdin() {
    if (process.stdin.isTTY) {
        fail('no input — pipe a diff, or use --diff <file> / --pr <number>. See --help.');
    }
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data;
}

function githubApi(repository, token) {
    const [owner, repo] = (repository || '').split('/');
    if (!owner || !repo) fail('GITHUB_REPOSITORY (owner/repo) is required for --pr / --post');
    if (!token) fail('GITHUB_TOKEN is required for --pr / --post');
    return (path, { method = 'GET', body, accept = 'application/vnd.github+json' } = {}) =>
        fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: accept,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body,
        });
}

// Finds our own summary comment (tagged with the hidden marker) across ALL comment pages. Issue
// comments come back oldest-first, so our freshly-posted summary sits on the last page — a single
// first-page fetch would miss it on busy PRs and post a duplicate. Returns the comment or null.
async function findSummaryComment(api, prNumber, marker) {
    for (let page = 1; page <= 10; page++) {
        const res = await api(`/issues/${prNumber}/comments?per_page=100&page=${page}`);
        if (!res.ok) return null;
        const batch = await res.json();
        const found = batch.find((c) => (c.body || '').includes(marker));
        if (found) return found;
        if (batch.length < 100) return null; // last page reached
    }
    return null;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0];

    if (args.help || !command) {
        console.log(HELP);
        process.exit(0);
    }
    if (command !== 'review') fail(`unknown command "${command}". See --help.`);

    const apiKey = args['api-key'] || process.env.OPENAI_API_KEY;
    if (!apiKey) fail('OpenAI API key not set (use --api-key or $OPENAI_API_KEY)');

    let api;
    let prNumber;
    let commitId; // PR head SHA — pinning it lets GitHub mark inline comments "outdated" on later pushes

    // Resolve the input diff/code.
    let input;
    if (args.pr) {
        prNumber = args.pr;
        api = githubApi(process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN);
        const res = await api(`/pulls/${prNumber}`, { accept: 'application/vnd.github.v3.diff' });
        if (!res.ok) fail(`failed to fetch PR #${prNumber} diff (${res.status})`);
        input = await res.text();
        // Fetch the PR head SHA so the review is anchored to the exact commit it reviewed; without
        // this, GitHub can't reliably re-map (and collapse) inline comments when you push a fix.
        const meta = await api(`/pulls/${prNumber}`);
        if (meta.ok) commitId = (await meta.json())?.head?.sha;
    } else if (args.diff) {
        input = readFileSync(args.diff, 'utf8');
    } else {
        input = await readStdin();
    }

    if (!input.trim()) {
        console.log('No changes to review.');
        process.exit(0);
    }

    // Run the review.
    const clientOptions = {};
    if (args.timeout) clientOptions.timeout = Number(args.timeout);
    if (args['max-retries']) clientOptions.maxRetries = Number(args['max-retries']);
    const reviewer = new Reviewer(apiKey, args.model, undefined, undefined, clientOptions);
    const reviewOptions = { asDiff: !args.code, language: args.lang };
    if (args.filter) reviewOptions.filter = true;
    if (args['filter-model']) reviewOptions.filterModel = args['filter-model'];
    if (args['cache-dir']) reviewOptions.cache = { dir: args['cache-dir'] };
    if (!args.code) {
        // Keep generated/noise files out of the review; --exclude adds more patterns.
        const defaults = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '*-lock.json', 'dist/**'];
        const extra = args.exclude ? args.exclude.split(',').map((s) => s.trim()).filter(Boolean) : [];
        reviewOptions.exclude = [...defaults, ...extra];
    }
    const findings = await reviewer.review(input, reviewOptions);

    // Optional: a short overview of what the diff changes, shown ABOVE the findings (one extra call).
    let overview = '';
    if (args.summary && !args.code) {
        try {
            const text = await reviewer.summarizeDiff(input, { language: args.lang });
            if (text) overview = `## What changed\n\n${text}\n\n---\n\n`;
        } catch (e) {
            console.error(`Warning: change summary failed (${e?.message || e}); showing findings only.`);
        }
    }
    const report = `${overview}${formatFindings(findings)}`;

    // Output.
    if (args.format === 'json') console.log(JSON.stringify(findings, null, 2));
    else console.log(report);

    // Post to the PR if asked.
    if (args.post) {
        if (!prNumber) fail('--post requires --pr <number>');
        // Hidden marker (invisible in rendered markdown) that lets us find and update our own
        // summary comment on re-runs instead of piling up a new one each time.
        const marker = '<!-- reviewer-lib-summary -->';
        const summary = `${report}\n\n${marker}`;
        const inline = toReviewComments(findings);

        // 1. Post the summary FIRST so it sits above the inline comments. A conversation comment
        //    isn't line-anchored, so GitHub can't mark it "outdated" — instead we UPSERT it: find
        //    our previous summary (by the marker) and edit it in place, so the PR shows one current
        //    summary rather than a stack of stale ones.
        let updated = false;
        const mine = await findSummaryComment(api, prNumber, marker);
        if (mine) {
            const res = await api(`/issues/comments/${mine.id}`, { method: 'PATCH', body: JSON.stringify({ body: summary }) });
            updated = res.ok;
        }
        if (!updated) {
            const res = await api(`/issues/${prNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: summary }) });
            if (!res.ok) fail(`failed to post summary comment (${res.status})`);
        }

        // 2. Inline comments, posted one by one (no review wrapper, so no placeholder body) and
        //    anchored to the PR head commit so GitHub marks them "outdated" once a later commit
        //    changes the line. A rejected comment (e.g. line not in the diff) is skipped, not fatal.
        for (const c of inline) {
            const res = await api(`/pulls/${prNumber}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    ...(commitId ? { commit_id: commitId } : {}),
                    path: c.path,
                    line: c.line,
                    side: 'RIGHT',
                    body: c.body,
                }),
            });
            if (!res.ok) console.error(`Inline comment on ${c.path}:${c.line} rejected (${res.status}); it's still in the summary.`);
        }
        console.log(`Posted review to PR #${prNumber}.`);
    }

    // Optional severity gate.
    if (args['fail-on'] && hasBlockingFindings(findings, args['fail-on'])) {
        console.error(`Blocking: found issue(s) at or above "${args['fail-on']}" severity.`);
        process.exit(1);
    }
}

main().catch((error) => fail(error?.message ?? String(error)));
