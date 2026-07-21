import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['**/*.d.ts'],
            reporter: ['text', 'html'],
            // Floors set just below current coverage — trip on real regressions
            // (e.g. deleted tests), not on minor noise.
            thresholds: {
                statements: 90,
                branches: 80,
                functions: 90,
                lines: 90,
            },
        },
    },
});
