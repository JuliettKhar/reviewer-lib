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
  --model <name>     Model to use (default: gpt-4o-mini)
  --format <fmt>     Output format: text (default) | json
  --fail-on <sev>    Exit 1 if any finding is >= severity (critical|high|medium|low)
  --post             Post the review to the PR (requires --pr)
  --api-key <key>    OpenAI key (default: $OPENAI_API_KEY)
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

    // Resolve the input diff/code.
    let input;
    if (args.pr) {
        prNumber = args.pr;
        api = githubApi(process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN);
        const res = await api(`/pulls/${prNumber}`, { accept: 'application/vnd.github.v3.diff' });
        if (!res.ok) fail(`failed to fetch PR #${prNumber} diff (${res.status})`);
        input = await res.text();
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
    const reviewer = new Reviewer(apiKey, args.model);
    const findings = await reviewer.review(input, { asDiff: !args.code });

    // Output.
    if (args.format === 'json') console.log(JSON.stringify(findings, null, 2));
    else console.log(formatFindings(findings));

    // Post to the PR if asked.
    if (args.post) {
        if (!prNumber) fail('--post requires --pr <number>');
        const summary = formatFindings(findings);
        const inline = toReviewComments(findings).map((c) => ({ ...c, side: 'RIGHT' }));
        let posted = false;
        if (inline.length > 0) {
            const res = await api(`/pulls/${prNumber}/reviews`, {
                method: 'POST',
                body: JSON.stringify({ event: 'COMMENT', body: summary, comments: inline }),
            });
            posted = res.ok;
            if (!res.ok) console.error(`Inline review rejected (${res.status}); posting a summary comment instead.`);
        }
        if (!posted) {
            const res = await api(`/issues/${prNumber}/comments`, {
                method: 'POST',
                body: JSON.stringify({ body: summary }),
            });
            if (!res.ok) fail(`failed to post comment (${res.status})`);
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
