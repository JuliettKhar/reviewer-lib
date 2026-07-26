# Getting Started

**Reviewer Lib** is AI code review powered by OpenAI. Give it a code snippet or a pull-request
diff and get back structured, actionable findings — as a library, a CLI, or a GitHub Action.
Works with code in any language (Node is only needed to run it).

## Installation

> Requires **Node.js 20+** (the library depends on `openai` v6).

```sh
npm install -D reviewer-lib
```

You'll also need an OpenAI API key (`OPENAI_API_KEY`).

## Three ways to use it

- **[`review()`](/api#review)** — structured findings (severity, file, line, fix). Best for PR
  comments and CI gates. **Recommended.**
- **[CLI](/guide/cli)** — run a review from the terminal or CI, no code to write.
- **[GitHub Action](/guide/github-action)** — add a PR review check in a few lines.

By default the library uses the OpenAI **Chat Completions** API with **`o4-mini`**, a reasoning
model chosen for the [fewest false positives](/guide/models). Pass any chat model as the `model`
argument.

## Quick start — the library

```ts
import { Reviewer, formatFindings, toReviewComments, hasBlockingFindings } from 'reviewer-lib';

const reviewer = new Reviewer(process.env.OPENAI_API_KEY!); // default model: o4-mini

// Pass asDiff: true to review a unified diff — findings then carry file + line.
const findings = await reviewer.review(diff, { asDiff: true, language: 'typescript' });

console.log(formatFindings(findings));        // markdown summary for a PR comment
const comments = toReviewComments(findings);  // [{ path, line, body }] for GitHub inline comments
if (hasBlockingFindings(findings, 'high')) process.exit(1); // fail CI on high+ severity
```

Each `Finding` has: `severity` (`critical` | `high` | `medium` | `low`), `category`, `file`,
`line`, `message`, and `suggestion`. See the [API reference](/api) for the full surface.

## Quick start — the CLI

```sh
# review your working changes locally
git diff origin/main | npx reviewer-lib review --fail-on high

# fetch a PR diff and post inline comments + a summary
npx reviewer-lib review --pr 54 --post --fail-on high
```

More in the [CLI guide](/guide/cli).

## Quick start — the GitHub Action

```yaml
- uses: JuliettKhar/reviewer-lib@v3
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    fail-on: high
```

See the [GitHub Action guide](/guide/github-action) for the recommended config.

## Next steps

- [Models & false positives](/guide/models) — why `o4-mini` is the default, and how to cut noise.
- [API reference](/api) — every method, option, and helper.
