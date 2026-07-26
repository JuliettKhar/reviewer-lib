# API Reference

```ts
import { Reviewer } from 'reviewer-lib';
```

## `new Reviewer(apiKey, model?, maxTokens?, modelOptions?, clientOptions?)`

Creates a Reviewer instance.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | _(required)_ | Your OpenAI API key. |
| `model` | `string` | `'o4-mini'` | Model to use. Reasoning models (o-series, gpt-5.x) are handled automatically; `*-instruct` models route to the legacy Completions API. |
| `maxTokens` | `number` | `1500` | Max tokens for the response. Reasoning models get a higher floor automatically. |
| `modelOptions` | `object` | — | Sampling options: `temperature`, `top_p`, `frequency_penalty`, `presence_penalty`, `n`, `stop`. Ignored for reasoning models. |
| `clientOptions` | `IClientOptions` | — | Reliability: `maxRetries` (default 3) and `timeout` ms (default 120000). |

```ts
const reviewer = new Reviewer(process.env.OPENAI_API_KEY!);              // default o4-mini
const cheap = new Reviewer(apiKey, 'gpt-4o-mini');                        // cheaper, noisier
const tuned = new Reviewer(apiKey, 'gpt-4o', 2000, { temperature: 0.1 }); // custom sampling
```

## `review(input, options?)`

Structured review powered by OpenAI Structured Outputs. Returns typed `Finding[]`. **Chat models
only** — instruct models throw (they can't enforce a schema).

```ts
const findings = await reviewer.review(diff, { asDiff: true, language: 'typescript' });
```

**Options**

| Option | Type | Description |
| --- | --- | --- |
| `asDiff` | `boolean` | Treat `input` as a unified diff; findings then carry `file` + `line`. |
| `language` | `string` | Language hint (e.g. `'typescript'`). |
| `maxChunkChars` | `number` | Split diffs larger than this (default 20000) per file, then merge. |
| `filter` | `boolean` | Run a second-pass triage that drops low-value findings. |
| `filterModel` | `string` | Model for the triage pass (e.g. a stronger one). |
| `cache` | `{ dir: string }` | Cache results by content hash; skip re-reviewing unchanged input. |
| `exclude` | `string[]` | Path globs to drop whole files from a diff before reviewing. |

In `asDiff` mode the diff is annotated with real new-file line numbers (`[path:line]` tags) so
findings anchor to correct lines. Large diffs are reviewed file-by-file (and by hunk for one
oversized file) and merged.

## `summarizeDiff(input, options?)`

Returns a short, high-level markdown overview of what a diff changes (intent/behaviour, not
findings) — meant to sit above the review findings in a PR comment. One extra model call.

```ts
const overview = await reviewer.summarizeDiff(diff, { language: 'typescript' });
```

## Free-text methods

Each returns plain-text feedback (`Promise<string>`):

| Method | Purpose |
| --- | --- |
| `submitCode(code)` | Optimal-perspective feedback. |
| `submitCodeAssistanceMode(code)` | Bugs, improvements, anti-patterns. |
| `optimizeCode(code)` | Performance/readability rewrite. |
| `generateDocumentation(code)` | JSDoc for the snippet. |
| `generateTests(code)` | Unit tests. |
| `securityAnalysis(code)` | Vulnerabilities + fixes. |
| `codeStyleRecommendations(code)` | Style suggestions. |
| `historicalAnalysis(repoPathOrDiff)` | Improvement recommendations. |

## `getCurrentModels()`

Returns the OpenAI models available to your key (`Promise<IModel[]>`).

## Helpers

```ts
import { formatFindings, toReviewComments, hasBlockingFindings } from 'reviewer-lib';
```

| Helper | Returns | Description |
| --- | --- | --- |
| `formatFindings(findings)` | `string` | One consolidated markdown summary, most severe first. |
| `toReviewComments(findings)` | `ReviewComment[]` | GitHub inline-comment payloads (`{ path, line, body }`) for findings with a file + line. |
| `hasBlockingFindings(findings, threshold?)` | `boolean` | True if any finding meets or exceeds `threshold` (default `'high'`) — for a CI gate. |

## Types

```ts
type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Finding {
  severity: Severity;
  category: string;            // e.g. bug | security | performance | style
  file: string | null;         // set when reviewing a diff
  line: number | null;         // line in the new file
  message: string;
  suggestion: string | null;
}

interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

interface IClientOptions {
  maxRetries?: number; // default 3
  timeout?: number;    // ms, default 120000
}
```

Exported types: `Finding`, `Severity`, `ReviewComment`, `IModel`, `IClientOptions`.
