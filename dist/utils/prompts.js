"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHistoricalAnalysisPrompt = exports.generateCodeStyleRecommendationsPrompt = exports.generateSecurityAnalysisPrompt = exports.generateTestsPrompt = exports.generateOptimizeCodePrompt = exports.generateSubmitCodeAssistanceModePrompt = exports.generateSubmitCodePrompt = exports.generateDocumentationPrompt = exports.SYSTEM_PROMPT = void 0;
// Shared system message for the Chat Completions engine. It sets a senior-engineer
// persona but stays task-agnostic, so it fits every method (review, generate, optimize,
// document) — the task-specific instructions live in each user prompt below.
exports.SYSTEM_PROMPT = 'You are a senior software engineer. Follow the user\'s instructions precisely and ' +
    'return only the requested output, without preamble or markdown code fences unless asked.';
const generateDocumentationPrompt = (code) => `
    Generate detailed JSDoc documentation for the following JavaScript code snippet. Only include documentation if the code contains functions, classes, or other elements that require JSDoc annotations. If there is nothing to document, return "No documentation needed".

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
exports.generateDocumentationPrompt = generateDocumentationPrompt;
const generateSubmitCodePrompt = (code) => `
Review the part of code:
${code}

Provide feedback how this part of JavaScript code can be improved from optimal perspective:
`;
exports.generateSubmitCodePrompt = generateSubmitCodePrompt;
const generateSubmitCodeAssistanceModePrompt = (code) => `
Review the following JavaScript code. Identify potential bugs, improvements, and anti-patterns:
${code}

Code review report:
`;
exports.generateSubmitCodeAssistanceModePrompt = generateSubmitCodeAssistanceModePrompt;
const generateOptimizeCodePrompt = (code) => `Optimize the following code for performance and readability:
${code} 
If there is nothing to optimize, return "No optimization needed.
Optimized Code:`;
exports.generateOptimizeCodePrompt = generateOptimizeCodePrompt;
const generateTestsPrompt = (code) => `Generate js jest unit tests for the following code:
${code}
Unit Tests:`;
exports.generateTestsPrompt = generateTestsPrompt;
const generateSecurityAnalysisPrompt = (code) => `Analyze the following code for potential security vulnerabilities and suggest fixes:
${code}
If there is no security issues, return "No documentation needed.
Security Analysis:`;
exports.generateSecurityAnalysisPrompt = generateSecurityAnalysisPrompt;
const generateCodeStyleRecommendationsPrompt = (code) => `Provide style recommendations for the following code according to best practices:
${code}
Style Recommendations:`;
exports.generateCodeStyleRecommendationsPrompt = generateCodeStyleRecommendationsPrompt;
const generateHistoricalAnalysisPrompt = (repoPath) => `
Analyze the code changes history for the repository at ${repoPath} and provide improvement recommendations.
Analysis:`;
exports.generateHistoricalAnalysisPrompt = generateHistoricalAnalysisPrompt;
