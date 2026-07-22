import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Deterministic cache key from the parts that affect a review's result.
export function hashKey(...parts: string[]): string {
    return createHash('sha256').update(parts.join('\0')).digest('hex');
}

// Best-effort file cache: a miss (or any I/O error) simply returns null / no-ops,
// so caching never breaks a review.
export function readCache<T>(dir: string, key: string): T | null {
    try {
        const file = join(dir, `${key}.json`);
        if (!existsSync(file)) return null;
        return JSON.parse(readFileSync(file, 'utf8')) as T;
    } catch {
        return null;
    }
}

export function writeCache(dir: string, key: string, value: unknown): void {
    try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${key}.json`), JSON.stringify(value));
    } catch {
        /* cache is best-effort; ignore write failures */
    }
}
