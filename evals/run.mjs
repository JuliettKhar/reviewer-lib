// Eval runner — measures review() quality against evals/cases.mjs.
// Runs the LOCAL build (dist/) so it reflects your current prompts, calls review() per case,
// and prints recall (bugs found) + noise (false positives on clean code).
//
// Manual, paid: one gpt-4o-mini call per case. Run after changing the prompt/model:
//   npm run eval
import pkg from '../dist/index.js';
import { cases } from './cases.mjs';

const { Reviewer } = pkg;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set');
    process.exit(1);
}

const SEVERITY = { low: 0, medium: 1, high: 2, critical: 3 };
const FILTER = Boolean(process.env.EVAL_FILTER); // EVAL_FILTER=1 → run the second-pass triage
const FILTER_MODEL = process.env.EVAL_FILTER_MODEL; // optional stronger judge, e.g. gpt-4o
const MODEL = process.env.EVAL_MODEL; // optional review model override, e.g. gpt-5.2-codex
const reviewer = new Reviewer(apiKey, MODEL);

function satisfies(findings, mustFind) {
    const threshold = SEVERITY[mustFind.severityAtLeast ?? 'low'];
    return findings.some((f) => {
        const haystack = `${f.message} ${f.category}`.toLowerCase();
        const keywordHit = mustFind.keywords.some((k) => haystack.includes(k.toLowerCase()));
        return keywordHit && SEVERITY[f.severity] >= threshold;
    });
}

const rows = [];
let bugsCaught = 0;
let bugsTotal = 0;
let cleanPass = 0;
let cleanTotal = 0;

for (const testCase of cases) {
    const input = testCase.diff ?? testCase.code;
    const asDiff = Boolean(testCase.diff);
    const label = testCase.name.padEnd(20);

    let findings;
    try {
        findings = await reviewer.review(input, { asDiff, filter: FILTER, filterModel: FILTER_MODEL });
    } catch (error) {
        rows.push(`${label} ⚠ error: ${error?.message ?? error}`);
        continue;
    }

    if (testCase.expect.findings === 0) {
        cleanTotal++;
        const clean = findings.length === 0;
        if (clean) cleanPass++;
        rows.push(`${label} ${clean ? '✓ clean' : `✗ ${findings.length} false positive(s)`}`);
        if (!clean) {
            for (const f of findings) rows.push(`${' '.repeat(21)}↳ ${f.severity}/${f.category}: ${f.message}`);
        }
    } else {
        for (const mustFind of testCase.expect.mustFind) {
            bugsTotal++;
            const caught = satisfies(findings, mustFind);
            if (caught) bugsCaught++;
            rows.push(`${label} ${caught ? '✓ caught' : '✗ MISSED'}`);
        }
    }
}

console.log('\n' + rows.join('\n'));
console.log('─'.repeat(42));
console.log(`model:   ${MODEL || 'gpt-4o-mini (default)'}`);
console.log(`mode:    ${FILTER ? `with second-pass filter${FILTER_MODEL ? ` (judge: ${FILTER_MODEL})` : ''}` : 'baseline'}`);
console.log(`recall:  ${bugsCaught}/${bugsTotal} planted bugs found`);
console.log(`noise:   ${cleanTotal - cleanPass} false positive(s) on ${cleanTotal} clean cases`);
