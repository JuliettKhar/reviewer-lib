import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashKey, readCache, writeCache } from '../src/utils/cache';

describe('cache', () => {
    it('hashKey is deterministic and order-sensitive', () => {
        expect(hashKey('a', 'b')).toBe(hashKey('a', 'b'));
        expect(hashKey('a', 'b')).not.toBe(hashKey('b', 'a'));
    });

    it('round-trips a value and returns null on miss', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rl-cache-'));
        expect(readCache(dir, 'missing')).toBeNull();
        writeCache(dir, 'k', { findings: [1, 2] });
        expect(readCache(dir, 'k')).toEqual({ findings: [1, 2] });
    });
});
