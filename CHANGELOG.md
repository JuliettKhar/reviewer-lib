# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.0.0]: https://github.com/JuliettKhar/reviewer-lib/releases/tag/v2.0.0
