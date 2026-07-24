# Reviewer lib
AI code review powered by OpenAI. Analyze a code snippet or a pull-request diff and get
structured, actionable findings — use it as a library, a CLI, or a GitHub Action.

Works with code in any language (Node is only needed to run it).

[//]: # (![Forks]&#40;https://img.shields.io/github/forks/JuliettKhar/reviewer-lib&#41;)
[//]: # (![Stars]&#40;https://img.shields.io/github/stars/JuliettKhar/reviewer-lib&#41;)
[//]: # (![Coverage]&#40;https://img.shields.io/codecov/c/github/JuliettKhar/reviewer-lib&#41;)
[//]: # (![Dependencies]&#40;https://img.shields.io/librariesio/release/npm/reviewer-lib&#41;)
![Build Status](https://img.shields.io/github/actions/workflow/status/JuliettKhar/reviewer-lib/.github/workflows/check-app.yml)
![Downloads](https://img.shields.io/npm/dt/reviewer-lib)
![NPM Version](https://img.shields.io/npm/v/reviewer-lib)
![Minified Size](https://img.shields.io/bundlephobia/min/reviewer-lib)
![Open Issues](https://img.shields.io/github/issues/JuliettKhar/reviewer-lib)

## Installation
> Requires Node.js 20+ (the library depends on `openai` v6).
```shell
npm install -D reviewer-lib
```
## Usage
Three ways to use it:
- **`review()`** — structured findings (severity, file, line, fix). Best for PR comments and CI gates. **Recommended.**
- **Text methods** (`submitCodeAssistanceMode`, `optimizeCode`, `securityAnalysis`, …) — plain-text feedback.
- **CLI & GitHub Action** — no code to write (see below).

By default the library uses the OpenAI **Chat Completions** API with `gpt-4o-mini`; pass any chat
model as the `model` argument. Instruct models (`*-instruct`) are auto-routed to the legacy
Completions API, and reasoning models (o-series, gpt-5.x) are handled automatically.

> **For the fewest false positives, use a reasoning model** like `o4-mini` (`--model o4-mini`).
> In our eval it caught every real bug with **zero** defensive/hypothetical noise, where
> `gpt-4o-mini` adds low-severity nits. It's pricier/slower but the signal is clean.

### Structured review (`review`)
`review()` returns typed findings instead of free text (chat models only), ready for
inline PR comments or a CI gate — this is the recommended entry point:

```typescript
import { Reviewer, formatFindings, toReviewComments, hasBlockingFindings } from 'reviewer-lib';

const reviewer = new Reviewer(apiKey); // default model: gpt-4o-mini

// Pass asDiff: true to review a unified diff — findings then carry file + line.
// Optionally hint the language with `language` (e.g. 'typescript', 'python').
const findings = await reviewer.review(diff, { asDiff: true, language: 'typescript' });

console.log(formatFindings(findings));        // markdown summary for a PR comment
const comments = toReviewComments(findings);  // [{ path, line, body }] for GitHub inline comments
if (hasBlockingFindings(findings, 'high')) process.exit(1); // fail CI on high+ severity
```

Each `Finding` has: `severity` (`critical` | `high` | `medium` | `low`), `category`,
`file`, `line`, `message`, and `suggestion`.

Large diffs are reviewed file-by-file (and by hunk for a single oversized file) automatically
and the findings merged (tune the threshold with the `maxChunkChars` option, default 20000).

Other `review()` options: `filter: true` runs a second-pass triage that drops low-value/defensive
findings (use `filterModel` to judge with a stronger model like `gpt-4o` while the review stays
cheap); `cache: { dir }` stores results by content hash to skip re-reviewing unchanged input; and
`exclude: string[]` drops files matching path globs (the CLI skips lockfiles and `dist/` by default).

### Free-text review
For plain-text feedback instead of structured findings:

```typescript
import { Reviewer } from 'reviewer-lib';

const reviewer = new Reviewer(apiKey);
const feedback = await reviewer.submitCodeAssistanceMode(code);
console.log(feedback);
```

### CLI
The package ships a `reviewer-lib` command, so you can review without writing any glue code
(`OPENAI_API_KEY` must be set):

```shell
# review your working changes locally
git diff origin/main | npx reviewer-lib review --fail-on high

# review a diff file as JSON
npx reviewer-lib review --diff pr.diff --format json

# in CI: fetch a PR diff and post inline comments + a summary
#   (needs GITHUB_TOKEN and GITHUB_REPOSITORY)
npx reviewer-lib review --pr 54 --post --fail-on high
```

Flags: `--diff <file>`, `--pr <number>`, `--post`, `--code`, `--lang <language>`,
`--filter`, `--cache-dir <dir>`, `--exclude <globs>`, `--model <name>`, `--format text|json`,
`--fail-on <severity>`, `--api-key <key>`, `--timeout <ms>`, `--max-retries <n>`.
Run `npx reviewer-lib --help` for details.

### Use as a GitHub Action
Add AI review to any repository in a few lines. The action reads the PR diff and posts
inline comments plus a summary. Add `OPENAI_API_KEY` to the repo secrets and give the job
`pull-requests: write` permission:

```yaml
name: AI code review
on:
  pull_request:

permissions:
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: JuliettKhar/reviewer-lib@v3
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          fail-on: high        # optional: fail the check on high+ findings
```

Inputs: `openai-api-key` (required), `github-token` (default `${{ github.token }}`),
`pr-number` (defaults to the event's PR), `fail-on`, `model` (default `gpt-4o-mini`),
`version` (reviewer-lib version to run, default `latest`), `exclude` (extra comma-separated
path globs to skip; lockfiles and `dist/` are skipped by default).

To trigger it manually instead, use `workflow_dispatch` and pass `pr-number`.

### Local usage (no CI)
Don't want a pipeline? Run reviews straight from your terminal — no install needed
(`npx` pulls the package on demand). Set your key once per shell:

```shell
export OPENAI_API_KEY=sk-...
```

Review your uncommitted changes:
```shell
git diff | npx reviewer-lib review
```

> **Tip:** pipe `git diff -U30` (more context lines) — the reviewer still comments only on the
> changed lines, but sees more surrounding code, which improves severity accuracy and cuts
> "missing guard/validation" false positives.

Review a whole branch before opening a PR (everything since `main`):
```shell
git diff main...HEAD | npx reviewer-lib review --fail-on high
```

Review a single file, or get machine-readable output:
```shell
git diff -- src/app.ts | npx reviewer-lib review
git diff | npx reviewer-lib review --format json > review.json
```

Prefer a faster repeat experience? Install it globally: `npm i -g reviewer-lib`, then
drop the `npx`. You can also pass the key inline with `--api-key` instead of the env var.

Optional — review automatically before every push with a git hook. Save as
`.git/hooks/pre-push` and `chmod +x` it:
```sh
#!/bin/sh
git diff -U30 origin/main...HEAD | npx reviewer-lib review --fail-on high || {
  echo "reviewer-lib found blocking issues — push aborted (use 'git push --no-verify' to override)."
  exit 1
}
```

## API
`new Reviewer(apiKey, model?, maxTokens?, modelOptions?, clientOptions?)` — creates a Reviewer instance.

**Constructor params**
- `apiKey` (string): your OpenAI API key.
- `model` (string): model to use (default `gpt-4o-mini`). Instruct models (`*-instruct`) route to the legacy Completions API automatically.
- `maxTokens` (number): max tokens for the response (default 1500).
- `modelOptions` (object): sampling options sent to the model — `temperature`, `top_p`, `frequency_penalty`, `presence_penalty`, `n`, `stop`.
- `clientOptions` (object): reliability — `maxRetries` (default 3) and `timeout` in ms (default 120000). The SDK retries transient failures (429/5xx) with exponential backoff automatically.

**Methods**
- `review(input, options?)`: structured review → `Finding[]` (chat models only). Options: `asDiff`, `language`, `maxChunkChars`, `filter`, `filterModel`, `cache`. See [Structured review](#structured-review-review) above.
- `submitCodeAssistanceMode(code)` / `submitCode(code)`: plain-text review (`submitCode` uses the legacy Completions API for `*-instruct` models).
- `optimizeCode(code)`, `securityAnalysis(code)`, `generateTests(code)`, `generateDocumentation(code)`, `codeStyleRecommendations(code)`, `historicalAnalysis(repoPath)`: plain-text helpers.
- `getCurrentModels()`: list available models.

**Helpers** (named exports): `formatFindings(findings)`, `toReviewComments(findings)`, `hasBlockingFindings(findings, severity)`.

### Example — a review posted on a pull request
The review posts a summary of findings plus inline comments on the changed lines:

![Findings summary](https://raw.githubusercontent.com/JuliettKhar/reviewer-lib/master/feedback-findings.png)

![Inline review comments on the diff](https://raw.githubusercontent.com/JuliettKhar/reviewer-lib/master/review-photo.png)

## References
- [Wiki](https://github.com/JuliettKhar/reviewer-lib/wiki)
- [OpenAI prices](https://openai.com/api/pricing/)
- [OpenAI model's deprecations](https://platform.openai.com/docs/deprecations)

## Compatibility
Versions below **3.0.0** (the 1.x and 2.x lines) are **deprecated** on npm — please use 3.x.
The 3.x line requires Node.js 20+ and defaults to the Chat Completions API; see the
[CHANGELOG](./CHANGELOG.md) for breaking changes and migration notes.
