import { describe, it, expect } from 'vitest';
import { annotateDiff } from '../src/utils/diff';

const DIFF = [
    'diff --git a/src/foo.ts b/src/foo.ts',
    'index abc..def 100644',
    '--- a/src/foo.ts',
    '+++ b/src/foo.ts',
    '@@ -1,3 +1,4 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
    '+const c = 4;',
    ' const d = 5;',
].join('\n');

describe('annotateDiff', () => {
    const annotated = annotateDiff(DIFF);

    it('tags each added line with its real new-file line number', () => {
        expect(annotated).toContain('[src/foo.ts:2] +const b = 3;');
        expect(annotated).toContain('[src/foo.ts:3] +const c = 4;');
    });

    it('does not tag removed lines (they have no new-file line)', () => {
        expect(annotated).toContain('-const b = 2;');
        expect(annotated).not.toContain('] -const b = 2;');
    });

    it('keeps context lines advancing the line counter', () => {
        // ` const d = 5;` is the 4th line of the new file, after two added lines.
        const addedLineNumbers = [...annotated.matchAll(/\[src\/foo\.ts:(\d+)\] \+/g)].map((m) => m[1]);
        expect(addedLineNumbers).toEqual(['2', '3']);
    });
});
