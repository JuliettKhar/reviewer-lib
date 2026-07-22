import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
    chatCreate: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
}));

vi.mock('openai', () => ({
    default: vi.fn(function () {
        return {
            chat: { completions: { create: mocks.chatCreate } },
            completions: { create: mocks.create },
            get: mocks.get,
        };
    }),
}));

import { Reviewer } from '../src/index';
import {
    formatFindings,
    toReviewComments,
    hasBlockingFindings,
    type Finding,
} from '../src/utils/review';

const chatJson = (obj: unknown) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

const sampleFinding = (over: Partial<Finding> = {}): Finding => ({
    severity: 'high',
    category: 'bug',
    file: 'src/a.ts',
    line: 12,
    message: 'off-by-one',
    suggestion: 'use <=',
    ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('review() structured output', () => {
    it('parses findings from the JSON response', async () => {
        const findings = [sampleFinding()];
        mocks.chatCreate.mockResolvedValue(chatJson({ findings }));

        const result = await new Reviewer('sk-test').review('const a = 1;');
        expect(result).toEqual(findings);
    });

    it('requests structured outputs via response_format json_schema', async () => {
        mocks.chatCreate.mockResolvedValue(chatJson({ findings: [] }));
        await new Reviewer('sk-test').review('code');

        const arg = mocks.chatCreate.mock.calls[0][0];
        expect(arg.response_format.type).toBe('json_schema');
        expect(arg.response_format.json_schema.name).toBe('code_review');
    });

    it('annotates the diff and instructs the model to use [path:line] markers', async () => {
        mocks.chatCreate.mockResolvedValue(chatJson({ findings: [] }));
        const diff = [
            'diff --git a/x.ts b/x.ts',
            '--- a/x.ts',
            '+++ b/x.ts',
            '@@ -1,1 +1,2 @@',
            ' const a = 1;',
            '+const b = 2;',
        ].join('\n');
        await new Reviewer('sk-test').review(diff, { asDiff: true });

        const content = mocks.chatCreate.mock.calls[0][0].messages[1].content;
        expect(content).toContain('[path:line]');            // marker instruction
        expect(content).toContain('[x.ts:2] +const b = 2;');  // annotated added line
    });

    it('includes a language hint in the prompt when language is provided', async () => {
        mocks.chatCreate.mockResolvedValue(chatJson({ findings: [] }));
        await new Reviewer('sk-test').review('const a = 1;', { language: 'typescript' });

        expect(mocks.chatCreate.mock.calls[0][0].messages[1].content).toContain('written in typescript');
    });

    it('returns [] when the model returns no content', async () => {
        mocks.chatCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });
        expect(await new Reviewer('sk-test').review('code')).toEqual([]);
    });

    it('throws for instruct models (no structured output support)', async () => {
        await expect(
            new Reviewer('sk-test', 'gpt-3.5-turbo-instruct').review('code'),
        ).rejects.toThrow(/requires a chat model/);
        expect(mocks.chatCreate).not.toHaveBeenCalled();
    });

    it('wraps client errors', async () => {
        mocks.chatCreate.mockRejectedValue(new Error('boom'));
        await expect(new Reviewer('sk-test').review('code')).rejects.toThrow('OpenAI API error: boom');
    });

    it('uses max_completion_tokens and omits temperature for reasoning models', async () => {
        mocks.chatCreate.mockResolvedValue(chatJson({ findings: [] }));
        await new Reviewer('sk-test', 'o3-mini').review('code');

        const arg = mocks.chatCreate.mock.calls[0][0];
        expect(arg.max_completion_tokens).toBe(1500);
        expect(arg.max_tokens).toBeUndefined();
        expect(arg.temperature).toBeUndefined();
    });

    it('chunks a large multi-file diff and merges findings', async () => {
        const diff = [
            'diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '@@ -1 +1 @@', '+const a = 1;',
            'diff --git a/b.ts b/b.ts', '--- a/b.ts', '+++ b/b.ts', '@@ -1 +1 @@', '+const b = 2;',
        ].join('\n');
        mocks.chatCreate
            .mockResolvedValueOnce(chatJson({ findings: [sampleFinding({ file: 'a.ts' })] }))
            .mockResolvedValueOnce(chatJson({ findings: [sampleFinding({ file: 'b.ts' })] }));

        // maxChunkChars tiny → force per-file chunking
        const findings = await new Reviewer('sk-test').review(diff, { asDiff: true, maxChunkChars: 10 });

        expect(mocks.chatCreate).toHaveBeenCalledTimes(2);
        expect(findings).toHaveLength(2);
        expect(findings.map((f) => f.file).sort()).toEqual(['a.ts', 'b.ts']);
    });

    it('caches results and skips the API on a second identical review', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rl-review-cache-'));
        mocks.chatCreate.mockResolvedValue(chatJson({ findings: [sampleFinding()] }));
        const reviewer = new Reviewer('sk-test');

        const first = await reviewer.review('const a = 1;', { cache: { dir } });
        const second = await reviewer.review('const a = 1;', { cache: { dir } });

        expect(mocks.chatCreate).toHaveBeenCalledTimes(1); // second call was a cache hit
        expect(second).toEqual(first);
        rmSync(dir, { recursive: true, force: true });
    });

    it('excludes matching files from the diff — an all-excluded diff makes no API call', async () => {
        const diff = [
            'diff --git a/package-lock.json b/package-lock.json',
            '--- a/package-lock.json', '+++ b/package-lock.json', '@@ -1 +1 @@', '+  "version": "2"',
        ].join('\n');

        const findings = await new Reviewer('sk-test').review(diff, { asDiff: true, exclude: ['package-lock.json'] });

        expect(findings).toEqual([]);
        expect(mocks.chatCreate).not.toHaveBeenCalled();
    });

    it('filter drops findings the triage pass does not keep', async () => {
        mocks.chatCreate
            .mockResolvedValueOnce(chatJson({ findings: [sampleFinding({ message: 'real bug' }), sampleFinding({ message: 'nit' })] }))
            .mockResolvedValueOnce(chatJson({ keep: [0] })); // triage keeps only index 0

        const findings = await new Reviewer('sk-test').review('code', { filter: true });

        expect(mocks.chatCreate).toHaveBeenCalledTimes(2); // review + filter pass
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toBe('real bug');
    });

    it('runs the triage pass on filterModel while review stays on the main model', async () => {
        mocks.chatCreate
            .mockResolvedValueOnce(chatJson({ findings: [sampleFinding()] }))
            .mockResolvedValueOnce(chatJson({ keep: [0] }));

        await new Reviewer('sk-test').review('code', { filter: true, filterModel: 'gpt-4o' });

        expect(mocks.chatCreate.mock.calls[0][0].model).toBe('gpt-4o-mini'); // review
        expect(mocks.chatCreate.mock.calls[1][0].model).toBe('gpt-4o');      // triage
    });
});

describe('formatFindings', () => {
    it('returns a clean message when there are no findings', () => {
        expect(formatFindings([])).toBe('✅ No issues found.');
    });

    it('sorts most severe first and includes location + suggestion', () => {
        const out = formatFindings([
            sampleFinding({ severity: 'low', message: 'minor' }),
            sampleFinding({ severity: 'critical', message: 'crash', file: 'x.ts', line: 3 }),
        ]);
        expect(out.indexOf('crash')).toBeLessThan(out.indexOf('minor'));
        expect(out).toContain('`x.ts:3`');
        expect(out).toContain('use <=');
    });
});

describe('toReviewComments', () => {
    it('maps only findings that have a file and line', () => {
        const comments = toReviewComments([
            sampleFinding({ file: 'a.ts', line: 5 }),
            sampleFinding({ file: null, line: null }),
        ]);
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({ path: 'a.ts', line: 5 });
        expect(comments[0].body).toContain('off-by-one');
    });
});

describe('hasBlockingFindings', () => {
    it('is true when a finding meets the threshold', () => {
        expect(hasBlockingFindings([sampleFinding({ severity: 'high' })], 'high')).toBe(true);
        expect(hasBlockingFindings([sampleFinding({ severity: 'critical' })], 'high')).toBe(true);
    });
    it('is false when all findings are below the threshold', () => {
        expect(hasBlockingFindings([sampleFinding({ severity: 'low' })], 'high')).toBe(false);
        expect(hasBlockingFindings([], 'low')).toBe(false);
    });
});
