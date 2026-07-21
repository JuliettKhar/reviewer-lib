// Shared system message for the Chat Completions engine. It sets a senior-engineer
// persona but stays task-agnostic, so it fits every method (review, generate, optimize,
// document) — the task-specific instructions live in each user prompt below.
export const SYSTEM_PROMPT =
    'You are a senior software engineer. Follow the user\'s instructions precisely and ' +
    'return only the requested output, without preamble or markdown code fences unless asked.';

// System persona for structured reviews (review() with JSON Structured Outputs).
export const REVIEW_SYSTEM_PROMPT =
    'You are a senior software engineer performing a precise code review. ' +
    'Report only substantive issues in the code: correctness bugs, security flaws, race conditions, ' +
    'resource leaks, and clear anti-patterns. Skip pure style nitpicks unless they cause bugs. ' +
    'Do not comment on documentation, comments, changelog, or version-number housekeeping ' +
    'unless it directly contradicts the code. ' +
    'Report only concrete, verifiable defects — never speculative or hedging findings. ' +
    'Do not raise a finding whose message relies on "may", "might", "consider", "verify that", ' +
    'or "ensure that" without pointing to a specific, demonstrable problem. ' +
    'Review only executable code behavior; never critique the wording, clarity, or phrasing of ' +
    'string literals, comments, or prompt text. ' +
    'You see only the changed lines, not the whole file. Do not report missing validation, guards, ' +
    'or error handling unless the diff itself shows the value used unguarded — assume code outside ' +
    'the diff already handles what you cannot see. ' +
    'Calibrate severity strictly and do not inflate it: ' +
    '"critical" = security hole or data loss; ' +
    '"high" = a definite bug that breaks behavior; ' +
    '"medium" = a likely bug or an unhandled edge case; ' +
    '"low" = minor robustness or defensive improvement. ' +
    'For each finding give a severity, a short category, a clear message, and a concrete fix. ' +
    'If there are no substantive issues, return an empty findings list.';

// Builds the user message for review(). In diff mode the input is expected to be
// annotated by annotateDiff(): each added line is prefixed with a `[path:line]` tag, and
// the model must copy `file`/`line` verbatim from that tag so findings anchor to real lines.
export const buildReviewPrompt = (input: string, asDiff = false, language?: string) => {
    const lang = language ? `The code is written in ${language}. ` : '';
    return asDiff
        ? `${lang}Review the following unified diff. Only comment on lines tagged with a \`[path:line]\` ` +
          'marker (these are the added lines). For each finding, set "file" and "line" to exactly ' +
          'the values from that line\'s `[path:line]` tag — never guess or compute line numbers.' +
          `\n\n${input}`
        : `${lang}Review the following code and report substantive issues. Set "file" and "line" to ` +
          `null since no file context is available.\n\n${input}`;
};

export const generateDocumentationPrompt = (code: string) => `
    Generate detailed JSDoc documentation for the following code snippet. Only include documentation if the code contains functions, classes, or other elements that require JSDoc annotations. If there is nothing to document, return "No documentation needed".

    Example:
    /**
     * Adds two numbers together.
     *
     * @param {number} a - The first number.
     * @param {number} b - The second number.
     * @returns {number} The sum of the two numbers.
     */

    Code:
    ${code}

    Documentation:
    `;

export const generateSubmitCodePrompt = (code: string) => `
Review the part of code:
${code}

Provide feedback how this part of code can be improved from an optimal perspective:
`;

export const generateSubmitCodeAssistanceModePrompt = (code: string) => `
Review the following code. Identify potential bugs, improvements, and anti-patterns:
${code}

Code review report:
`;

export const generateOptimizeCodePrompt = (code: string) => `Optimize the following code for performance and readability:
${code} 
If there is nothing to optimize, return "No optimization needed.
Optimized Code:`;

export const generateTestsPrompt = (code: string) => `Generate unit tests for the following code:
${code}
Unit Tests:`;

export const generateSecurityAnalysisPrompt = (code: string) => `Analyze the following code for potential security vulnerabilities and suggest fixes:
${code}
If there is no security issues, return "No documentation needed.
Security Analysis:`;

export const generateCodeStyleRecommendationsPrompt = (code: string) => `Provide style recommendations for the following code according to best practices:
${code}
Style Recommendations:`;

export const generateHistoricalAnalysisPrompt = (repoPath: string) => `
Analyze the code changes history for the repository at ${repoPath} and provide improvement recommendations.
Analysis:`;