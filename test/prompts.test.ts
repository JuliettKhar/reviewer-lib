import { describe, it, expect } from 'vitest';
import {
    generateDocumentationPrompt,
    generateSubmitCodePrompt,
    generateSubmitCodeAssistanceModePrompt,
    generateOptimizeCodePrompt,
    generateTestsPrompt,
    generateSecurityAnalysisPrompt,
    generateCodeStyleRecommendationsPrompt,
    generateHistoricalAnalysisPrompt,
} from '../src/utils/prompts';

const CODE = 'const answer = 42;';

describe('prompt generators', () => {
    const generators = [
        { name: 'documentation', fn: generateDocumentationPrompt, keyword: /JSDoc/i },
        { name: 'submitCode', fn: generateSubmitCodePrompt, keyword: /feedback/i },
        { name: 'assistanceMode', fn: generateSubmitCodeAssistanceModePrompt, keyword: /anti-patterns/i },
        { name: 'optimize', fn: generateOptimizeCodePrompt, keyword: /optimize/i },
        { name: 'tests', fn: generateTestsPrompt, keyword: /unit tests/i },
        { name: 'security', fn: generateSecurityAnalysisPrompt, keyword: /security/i },
        { name: 'codeStyle', fn: generateCodeStyleRecommendationsPrompt, keyword: /style/i },
        { name: 'historical', fn: generateHistoricalAnalysisPrompt, keyword: /history/i },
    ];

    for (const { name, fn, keyword } of generators) {
        it(`${name}: embeds the supplied code`, () => {
            expect(fn(CODE)).toContain(CODE);
        });

        it(`${name}: includes its instruction keyword`, () => {
            expect(fn(CODE)).toMatch(keyword);
        });
    }

    it('always returns a non-empty string', () => {
        for (const { fn } of generators) {
            expect(typeof fn(CODE)).toBe('string');
            expect(fn(CODE).length).toBeGreaterThan(0);
        }
    });
});
