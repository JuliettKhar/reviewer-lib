export const generateDocumentationPrompt = (code: string) => `
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

export const generateSubmitCodePrompt = (code: string) => `
Review the part of code:
${code}

Provide feedback how this part of JavaScript code can be improved from optimal perspective:
`;

export const generateSubmitCodeAssistanceModePrompt = (code: string) => `
Review the following JavaScript code. Identify potential bugs, improvements, and anti-patterns:
${code}

Code review report:
`;

export const generateOptimizeCodePrompt = (code: string) => `Optimize the following code for performance and readability:
${code} 
If there is nothing to optimize, return "No optimization needed.
Optimized Code:`;

export const generateTestsPrompt = (code: string) => `Generate js jest unit tests for the following code:
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