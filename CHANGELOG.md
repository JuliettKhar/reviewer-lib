# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.7.2] - 2026-07-24

### Fixed
- **No more "Unexpected end of JSON input" crashes** — `review()` returns `[]` for an empty or
  truncated model response instead of failing the whole run.
- **Reasoning models get enough token budget** — o-series/gpt-5.x reviews now use a higher
  `max_completion_tokens` floor (8000) so hidden reasoning tokens don't starve the JSON answer
  (which was coming back empty). The second-pass filter's reasoning budget was raised too.

## [3.7.1] - 2026-07-24

### Fixed
- **gpt-5.x compatibility** — reasoning-model detection now also covers the `gpt-5.x` family
  (previously only `o*`), so those models get `max_completion_tokens` and no `temperature`
  instead of failing with "Unsupported parameter: 'max_tokens'".

### Changed
- Review prompt now explicitly separates **changes** (the `[path:line]`-tagged lines, reviewed)
  from **context** (untagged surrounding lines — background only, assumed correct). Improves
  severity accuracy and cuts "missing guard/validation" false positives, especially when the
  diff carries more context.
- The local `review` script and README examples use `git diff -U30` so the model sees more
  surrounding code (it still comments only on changed lines).

### Docs
- Recommend a reasoning model (e.g. `o4-mini`) for the fewest false positives — in the eval it
  caught every planted bug with zero defensive noise.

## [3.7.0] - 2026-07-23

### Added
- **Path exclusions** — `review()` accepts `exclude: string[]` (path globs) to drop whole files
  from a diff before reviewing. The CLI skips lockfiles and `dist/` by default and takes extra
  patterns via `--exclude`; the GitHub Action exposes an `exclude` input. Keeps generated/noise
  files (lockfiles, docs, build output) out of the review.

### Docs
- Reworked the README (accurate constructor params, options, examples) and refreshed the
  example screenshots.

## [3.6.0] - 2026-07-22

### Added
- **Result cache** — pass `{ cache: { dir } }` to `review()` (CLI: `--cache-dir <dir>`) to store
  findings keyed by a hash of the input + model + options and skip re-reviewing unchanged input
  (e.g. CI re-runs on the same commit). Best-effort — cache errors never fail a review.
- **Second-pass filter** — `{ filter: true }` (CLI: `--filter`) runs a triage pass that keeps
  concrete, actionable defects and drops hypothetical/defensive nits (one extra request). Set
  `filterModel` (CLI: `--filter-model`) to judge with a stronger model (e.g. `gpt-4o`) while the
  review itself stays on a cheap model.
- **Hunk-level chunking** — a single file whose diff exceeds `maxChunkChars` is now split by
  hunk (not just by file), so one very large file no longer goes in a single request.

## [3.5.0] - 2026-07-21

### Added
- **Large-diff chunking** — `review()` with `asDiff` now splits a diff larger than
  `maxChunkChars` (default 20000) into one review per file, runs them with bounded
  concurrency, and merges the findings. This keeps each request focused and avoids
  truncating the model's JSON output on big pull requests. Configurable via the
  `maxChunkChars` option; small diffs are unaffected (single request).

### Changed
- Review prompt no longer flags "missing validation/guards/error handling" for values whose
  handling lives outside the shown diff — it now assumes unseen surrounding code is correct.
  Cuts a common false-positive class from diff-only reviews.

## [3.4.0] - 2026-07-21

### Added
- **Language hint** — `review()` accepts a `language` option (e.g. `{ language: 'typescript' }`)
  telling the model which language the code is in. CLI flag: `--lang <language>`.

### Changed
- Removed the hardcoded "JavaScript" wording from the built-in prompts (`submitCode`,
  `submitCodeAssistanceMode`, `generateDocumentation`, `generateTests`) so they read naturally
  for any language, not just JS.

## [3.3.0] - 2026-07-21

### Added
- **Configurable reliability** — a fifth constructor argument `clientOptions` exposes
  `maxRetries` (default 3) and `timeout` (default 120000 ms), passed through to the OpenAI
  client. The SDK already retries transient failures (408/409/429/5xx) with exponential
  backoff; this lets you tune it and caps hung requests (previously the SDK default was 10 min).
  Exported type: `IClientOptions`.
- CLI flags `--timeout <ms>` and `--max-retries <n>`.

## [3.2.1] - 2026-07-21

### Changed
- Tuned the review system prompt to cut noise: no speculative/hedging findings
  ("may/might/consider/verify that…"), no documentation/changelog/version nitpicks unless
  they contradict the code, and no critiques of string/comment wording — the review stays
  focused on real code defects.

## [3.2.0] - 2026-07-21

### Added
- **CLI** — the package now ships a `reviewer-lib` command (`bin/reviewer.mjs`), so a review
  can be run without writing any glue code:
  - `git diff main | npx reviewer-lib review --fail-on high`
  - `npx reviewer-lib review --diff pr.diff --format json`
  - `npx reviewer-lib review --pr 54 --post` (fetch a PR diff, post inline comments + summary)
  - Flags: `--diff`, `--pr`, `--post`, `--code`, `--model`, `--format`, `--fail-on`, `--api-key`.

## [3.1.0] - 2026-07-20

### Added
- **`review(input, { asDiff })`** — structured review powered by OpenAI Structured Outputs.
  Returns typed `Finding[]` (`severity`, `category`, `file`, `line`, `message`, `suggestion`)
  instead of free text. Chat models only. With `asDiff: true` findings carry file + line so
  they can become inline PR comments.
- Helpers for PR integration: `formatFindings()` (markdown summary), `toReviewComments()`
  (GitHub inline-comment payloads), and `hasBlockingFindings()` (CI severity gate).
- In `asDiff` mode the diff is annotated with real new-file line numbers (`[path:line]` tags)
  and the model is instructed to copy them verbatim, so findings anchor to correct lines
  instead of being estimated from hunk headers. Severity guidance was also tightened to avoid
  inflated ratings.
- Exported types: `Finding`, `Severity`, `ReviewComment`, `IModel`.

### Fixed
- Type declarations are now generated automatically (`declaration: true`) and the package
  `types` field points at `dist/index.d.ts`. Previously `types` referenced a hand-written
  `index.d.ts` that was **not included in the published tarball**, so consumers got no types.

## [3.0.0] - 2026-07-20

### ⚠ BREAKING CHANGES
- **Default model changed to `gpt-4o-mini`** (was `gpt-3.5-turbo-instruct`) and the engine
  now uses the **Chat Completions API** by default. Output quality and wording change
  accordingly. Instruct models (any name ending in `-instruct`) still work and are routed
  to the legacy Completions API automatically.
- **`IDefaultOptions` no longer includes `best_of`, `logprobs`, or `echo`** (Completions-only
  fields). Code that passed a custom options object with these keys must drop them.
- Default `maxTokens` raised from `400` to `1500` (reviews were being truncated).

### Changed
- All review/generation methods go through a single internal `complete()` router
  (Chat by default, legacy Completions for `*-instruct` models), removing duplicated call sites.
- Prompts now use a system + user message split via a shared `SYSTEM_PROMPT` persona.
- Default review temperature lowered to `0.2` for more deterministic output.

### Added
- Automatic handling for reasoning models (`o1`/`o3`/…): uses `max_completion_tokens` and
  omits `temperature`/`top_p`.

## [2.0.0] - 2026-07-20

### ⚠ BREAKING CHANGES
- **Requires Node.js 20 or newer.** The library now depends on `openai` v6, which
  drops support for Node < 20. Projects still on Node 18 must upgrade their runtime
  before installing this version.

### Changed
- Upgraded the `openai` dependency from v5 to v6 (`6.48.0`).
- `submitCode` now calls the OpenAI Completions API (`completions.create`) instead of
  the long-removed `/engines/{model}/completions` route.

### Fixed
- `submitCode` no longer fails with a `404` against the deprecated `/engines` endpoint.

### Added
- Unit test suite (Vitest, 33 tests) covering the prompt generators and the `Reviewer` class.
- Pre-deploy smoke test (`npm run smoke`): packs the tarball, installs it into a clean
  project, and exercises the public API — including live checks against the Completions
  and models endpoints when an `OPENAI_API_KEY` is available.
- `prepublishOnly` hook plus a build → test → smoke gate in the deploy workflow.

### Internal
- Pinned `typescript` to `^5.9.3` (the TypeScript 7 build migration is deferred).
- CI now runs on Node 20 and executes the test suite on every pull request.
- Dependabot groups minor/patch updates into a single PR and now also covers GitHub Actions.

[3.7.2]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.7.2
[3.7.1]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.7.1
[3.7.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.7.0
[3.6.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.6.0
[3.5.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.5.0
[3.4.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.4.0
[3.3.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.3.0
[3.2.1]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.2.1
[3.2.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.2.0
[3.1.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.1.0
[3.0.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.0.0
[2.0.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v2.0.0
