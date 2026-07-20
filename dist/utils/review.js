"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_SCHEMA = void 0;
exports.formatFindings = formatFindings;
exports.toReviewComments = toReviewComments;
exports.hasBlockingFindings = hasBlockingFindings;
// JSON Schema for OpenAI Structured Outputs. Strict mode requires every property to be
// listed in `required` and `additionalProperties: false`, so optional values are modelled
// as nullable rather than omitted.
exports.REVIEW_SCHEMA = {
    name: 'code_review',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                        category: { type: 'string' },
                        file: { type: ['string', 'null'] },
                        line: { type: ['integer', 'null'] },
                        message: { type: 'string' },
                        suggestion: { type: ['string', 'null'] },
                    },
                    required: ['severity', 'category', 'file', 'line', 'message', 'suggestion'],
                },
            },
        },
        required: ['findings'],
    },
};
const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const SEVERITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
// One consolidated markdown comment summarising all findings, most severe first.
function formatFindings(findings) {
    if (findings.length === 0)
        return '✅ No issues found.';
    const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
    const lines = sorted.map((f) => {
        const loc = f.file ? `\`${f.file}${f.line != null ? `:${f.line}` : ''}\` ` : '';
        const fix = f.suggestion ? `\n  - _Suggestion:_ ${f.suggestion}` : '';
        return `- ${SEVERITY_EMOJI[f.severity]} **${f.severity}** (${f.category}) ${loc}— ${f.message}${fix}`;
    });
    return `### Code review — ${findings.length} finding(s)\n\n${lines.join('\n')}`;
}
// GitHub PR review inline-comment payloads. Only findings anchored to a file+line can
// become inline comments; findings without a location should go into the summary body.
function toReviewComments(findings) {
    return findings
        .filter((f) => !!f.file && f.line != null)
        .map((f) => ({
        path: f.file,
        line: f.line,
        body: `${SEVERITY_EMOJI[f.severity]} **${f.severity}** (${f.category}): ${f.message}` +
            (f.suggestion ? `\n\n_Suggestion:_ ${f.suggestion}` : ''),
    }));
}
// True if any finding meets or exceeds `threshold` — useful for failing a CI gate.
function hasBlockingFindings(findings, threshold = 'high') {
    return findings.some((f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[threshold]);
}
