// Dogfooding helper: reviews a diff using the *published* reviewer-lib from npm.
//
// The package is installed under the alias `reviewer-lib-published` (npm refuses to
// install a package into a repo of the same name), so this imports exactly what a
// real consumer would `npm install reviewer-lib`.
//
// Usage:
//   git diff HEAD | node --env-file=.env review-helper.mjs
//   node --env-file=.env review-helper.mjs < pr.diff
import { Reviewer } from 'reviewer-lib-published';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set');
    process.exit(1);
}

let diff = '';
for await (const chunk of process.stdin) diff += chunk;
if (!diff.trim()) {
    console.error('Error: no diff provided on stdin');
    process.exit(1);
}

// Transparency: show exactly what is being sent to the model (to stderr, so it
// does not mix into the feedback on stdout).
const firstFiles = [...diff.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]);
console.error(`→ sending ${diff.length} chars of diff across ${firstFiles.length} file(s): ${firstFiles.join(', ') || '(raw diff)'}`);

// Cap the completion length to keep token cost low during local testing.
// Override with REVIEW_MAX_TOKENS if you want a longer review.
const maxTokens = Number(process.env.REVIEW_MAX_TOKENS ?? 150);
const reviewer = new Reviewer(apiKey, undefined, maxTokens);
try {
    const feedback = await reviewer.submitCodeAssistanceMode(diff);
    console.log('Code Review Feedback:\n');
    console.log(feedback ?? 'No feedback');
} catch (error) {
    console.error('Review failed:', error?.message ?? error);
    process.exit(1);
}
