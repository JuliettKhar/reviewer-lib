// Pre-deploy smoke test: verifies the *packaged* library, not the source tree.
// It builds a real tarball (exactly what `npm publish` would upload), installs
// it into a throwaway project, and exercises the public API as a consumer would.
// This catches packaging bugs that unit tests can't see: files missing from the
// "files" allow-list, a wrong "main"/"types" entry, or an unbuilt dist/.
//
// When an OPENAI_API_KEY is available (from the environment or a local .env),
// it additionally makes one real API call with a tiny code snippet to confirm
// the OpenAI endpoint actually responds. Without a key, the live step is skipped.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const run = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const capture = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8', ...opts });

// Resolve the key from the environment first, then fall back to a local .env
// so the live check works locally without exporting anything to the shell.
function resolveApiKey() {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
        return process.env.OPENAI_API_KEY.trim();
    }
    try {
        for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.*)\s*$/);
            if (m) return m[1].replace(/^["']|["']$/g, '').trim();
        }
    } catch {
        /* no .env — that's fine, live check is optional */
    }
    return undefined;
}

const apiKey = resolveApiKey();

console.log('› building fresh dist…');
run('npm', ['run', 'build']);

console.log('› packing tarball…');
const tarball = join(root, JSON.parse(capture('npm', ['pack', '--json']))[0].filename);

const dir = mkdtempSync(join(tmpdir(), 'reviewer-smoke-'));
try {
    console.log(`› installing tarball into a clean project (${dir})…`);
    run('npm', ['init', '-y'], { cwd: dir });
    run('npm', ['install', tarball], { cwd: dir });

    const probe = join(dir, 'probe.cjs');
    writeFileSync(
        probe,
        `const { Reviewer } = require('reviewer-lib');

(async () => {
  if (typeof Reviewer !== 'function') throw new Error('Reviewer is not exported as a constructor');
  const reviewer = new Reviewer('sk-smoke-test');
  const methods = [
    'submitCode', 'submitCodeAssistanceMode', 'getCurrentModels', 'generateDocumentation',
    'optimizeCode', 'generateTests', 'securityAnalysis', 'codeStyleRecommendations', 'historicalAnalysis',
  ];
  for (const m of methods) {
    if (typeof reviewer[m] !== 'function') throw new Error('missing method on Reviewer: ' + m);
  }
  console.log('  ✓ imported reviewer-lib and verified ' + methods.length + ' public methods');

  const key = process.env.OPENAI_API_KEY;
  if (key && key.trim()) {
    const live = new Reviewer(key.trim());

    // Endpoint 1 — Completions API (completions.create), the core review path.
    console.log('  › calling the live Completions endpoint with a sample snippet…');
    const feedback = await live.submitCode('const sum = (a, b) => a + b;');
    if (!feedback || !String(feedback).trim()) throw new Error('Completions endpoint returned an empty response');
    console.log('  ✓ Completions responded (' + String(feedback).trim().length + ' chars)');

    // Endpoint 2 — models list (client.get('/models')), the only other endpoint the lib hits.
    console.log('  › calling the live models endpoint…');
    const models = await live.getCurrentModels();
    if (!Array.isArray(models) || models.length === 0) throw new Error('models endpoint returned no models');
    console.log('  ✓ models endpoint responded (' + models.length + ' models)');
  } else {
    console.log('  ⚠ no OPENAI_API_KEY — skipped live API check (packaging verified offline)');
  }
})().catch((err) => {
  console.error('  ✗ ' + (err && err.message ? err.message : err));
  process.exit(1);
});
`,
    );

    run('node', [probe], {
        cwd: dir,
        env: apiKey ? { ...process.env, OPENAI_API_KEY: apiKey } : process.env,
    });
    console.log('✅ smoke test passed');
} finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(tarball, { force: true });
}
