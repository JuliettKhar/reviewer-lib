import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/utils/cli-args';

describe('parseArgs', () => {
    it('collects positional arguments in _', () => {
        expect(parseArgs(['review'])._).toEqual(['review']);
        expect(parseArgs(['review', 'extra'])._).toEqual(['review', 'extra']);
    });

    it('captures the next token as a flag value', () => {
        const args = parseArgs(['review', '--pr', '54', '--model', 'gpt-4o']);
        expect(args._).toEqual(['review']);
        expect(args.pr).toBe('54');
        expect(args.model).toBe('gpt-4o');
    });

    it('treats --post and --code as boolean flags', () => {
        const args = parseArgs(['review', '--post', '--code']);
        expect(args.post).toBe(true);
        expect(args.code).toBe(true);
    });

    it('sets help for -h and --help', () => {
        expect(parseArgs(['-h']).help).toBe(true);
        expect(parseArgs(['--help']).help).toBe(true);
    });

    it('parses a full realistic invocation', () => {
        const args = parseArgs(['review', '--diff', 'pr.diff', '--fail-on', 'high', '--post']);
        expect(args._).toEqual(['review']);
        expect(args.diff).toBe('pr.diff');
        expect(args['fail-on']).toBe('high');
        expect(args.post).toBe(true);
    });

    it('returns only _ for an empty argv', () => {
        expect(parseArgs([])).toEqual({ _: [] });
    });
});
