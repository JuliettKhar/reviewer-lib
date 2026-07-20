# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[3.1.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.1.0
[3.0.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v3.0.0
[2.0.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v2.0.0
