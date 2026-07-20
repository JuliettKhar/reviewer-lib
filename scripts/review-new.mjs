// Local test for the new structured review() (v3.1.0). Unlike review-helper.mjs
// (which uses the published 2.0.0 text API), this imports the LOCAL build in dist/
// and calls review() with Structured Outputs, printing a formatted summary.
//
// Usage:
//   npm run build
//   git diff HEAD -- <file> | node --env-file=.env scripts/review-new.mjs
import pkg from '../dist/index.js';
const { Reviewer, formatFindings, hasBlockingFindings } = pkg;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set');
    process.exit(1);
}

let input = '';
for await (const chunk of process.stdin) input += chunk;
if (!input.trim()) {
    console.error('Error: no diff/code provided on stdin');
    process.exit(1);
}

// gpt-4o-mini by default. Keep the cap high enough that the JSON output is never
// truncated mid-object (a cut-off response would fail to parse).
const maxTokens = Number(process.env.REVIEW_MAX_TOKENS ?? 1200);
const reviewer = new Reviewer(apiKey, undefined, maxTokens);
console.error(`→ reviewing ${input.length} chars with gpt-4o-mini (structured)`);

try {
    const findings = await reviewer.review(input, { asDiff: true });
    console.log(formatFindings(findings));
    console.log(`\n— ${findings.length} finding(s); blocking (high+): ${hasBlockingFindings(findings)}`);
} catch (error) {
    console.error('Review failed:', error?.message ?? error);
    process.exit(1);
}
