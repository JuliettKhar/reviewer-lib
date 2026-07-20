// CI structured review that POSTS results to a pull request.
// Fetches the PR diff from the GitHub API, runs review() (published reviewer-lib v3),
// then posts inline comments on the changed lines plus a summary. Falls back to a single
// summary comment if inline posting is rejected (e.g. a line not present in the diff).
//
// Env: OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER,
//      REVIEW_FAIL_ON (optional severity gate).
import pkg from 'reviewer-lib-published';
const { Reviewer, formatFindings, toReviewComments, hasBlockingFindings } = pkg;

const {
    OPENAI_API_KEY,
    GITHUB_TOKEN,
    GITHUB_REPOSITORY,
    PR_NUMBER,
    REVIEW_FAIL_ON,
} = process.env;

for (const [name, value] of Object.entries({ OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER })) {
    if (!value) {
        console.error(`Error: ${name} is not set`);
        process.exit(1);
    }
}

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const api = (path, { method = 'GET', body, accept = 'application/vnd.github+json' } = {}) =>
    fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: accept,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
    });

// 1. Fetch the PR diff (raw unified diff).
const diffRes = await api(`/pulls/${PR_NUMBER}`, { accept: 'application/vnd.github.v3.diff' });
if (!diffRes.ok) {
    console.error(`Failed to fetch PR #${PR_NUMBER} diff: ${diffRes.status}`);
    process.exit(1);
}
const diff = await diffRes.text();
if (!diff.trim()) {
    console.log('PR has no reviewable changes.');
    process.exit(0);
}

// 2. Run the structured review.
console.error(`→ reviewing ${diff.length} chars from PR #${PR_NUMBER} with reviewer-lib@3`);
const findings = await new Reviewer(OPENAI_API_KEY).review(diff, { asDiff: true });
const summary = formatFindings(findings);
console.log(summary);

// 3. Post to the PR: a review with inline comments, falling back to a summary comment.
const inline = toReviewComments(findings).map((c) => ({
    path: c.path,
    line: c.line,
    side: 'RIGHT',
    body: c.body,
}));

let posted = false;
if (inline.length > 0) {
    const res = await api(`/pulls/${PR_NUMBER}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ event: 'COMMENT', body: summary, comments: inline }),
    });
    if (res.ok) {
        posted = true;
        console.log(`Posted ${inline.length} inline comment(s) to PR #${PR_NUMBER}.`);
    } else {
        console.error(`Inline review rejected (${res.status}); falling back to a summary comment.`);
        console.error((await res.text()).slice(0, 300));
    }
}

if (!posted) {
    const res = await api(`/issues/${PR_NUMBER}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: summary }),
    });
    if (!res.ok) {
        console.error(`Failed to post summary comment: ${res.status}`);
        process.exit(1);
    }
    console.log(`Posted a summary comment to PR #${PR_NUMBER}.`);
}

// 4. Optional severity gate.
if (REVIEW_FAIL_ON && hasBlockingFindings(findings, REVIEW_FAIL_ON)) {
    console.error(`\nBlocking: found issue(s) at or above "${REVIEW_FAIL_ON}" severity.`);
    process.exit(1);
}
