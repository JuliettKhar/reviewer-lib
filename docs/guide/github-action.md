# GitHub Action

Add AI review to any repository. The action reads the PR diff (no checkout needed) and posts
inline comments plus a summary. Add `OPENAI_API_KEY` to the repo secrets and give the job
`pull-requests: write` permission.

## Recommended config

Request-only (add the `ai-review` label to a PR, or run it manually), with the reasoning model,
a change overview, a severity gate, and noise excluded:

```yaml
name: AI code review

on:
  pull_request:
    types: [labeled]        # runs when you add a label (below) — not on every push
  workflow_dispatch:        # …or trigger manually from the Actions tab
    inputs:
      pr:
        description: PR number to review
        required: true

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    # only run for the "ai-review" label (or a manual dispatch)
    if: github.event_name == 'workflow_dispatch' || github.event.label.name == 'ai-review'
    runs-on: ubuntu-latest
    steps:
      - uses: JuliettKhar/reviewer-lib@v3
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          pr-number: ${{ github.event.inputs.pr || github.event.pull_request.number }}
          model: o4-mini          # reasoning model — fewest false positives (default)
          summary: 'true'         # add a "what changed" overview above the findings
          fail-on: high           # fail the check only on high+ findings
          exclude: '*.md,dist/**,tsconfig.json'   # skip docs/build/config noise
```

::: tip Review every PR automatically?
Use `on: pull_request:` (no `types` / `if`) instead of the label trigger — just note it spends a
review on each push.
:::

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `openai-api-key` | _(required)_ | OpenAI API key |
| `github-token` | `github.token` | Token used to read the PR diff and post comments |
| `app-id` | _(empty)_ | GitHub App ID — post comments as your own App (see [below](#post-as-your-own-github-app)) |
| `app-private-key` | _(empty)_ | GitHub App private key (PEM); pair with `app-id` |
| `pr-number` | event's PR | Pull request number to review |
| `model` | `o4-mini` | Model to use; pass `gpt-4o-mini` for a cheaper, noisier review |
| `summary` | `false` | Set to `'true'` to add a "what changed" overview above the findings |
| `fail-on` | _(empty)_ | Fail the job at or above this severity (`critical`\|`high`\|`medium`\|`low`) |
| `exclude` | _(empty)_ | Extra comma-separated path globs to skip (lockfiles + `dist/` skipped by default) |
| `version` | `latest` | reviewer-lib version to run (npm dist-tag or version, `>= 3.2.0`) |

## Trigger on a `/review` comment

Prefer a comment trigger? Run on `issue_comment` and gate on `/review`:

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/review') }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: JuliettKhar/reviewer-lib@v3
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          pr-number: ${{ github.event.issue.number }}
          summary: 'true'
```

> Comment triggers only fire when the workflow is on the repository's **default branch**.

## Post as your own GitHub App

By default the review is posted by `github-actions[bot]`. To post it under your own identity —
a custom bot name and avatar — supply a GitHub App. The action mints a short-lived installation
token from the App and uses it instead of `github-token`.

**Setup (once):**

1. Create a GitHub App: **Settings → Developer settings → GitHub Apps → New GitHub App**.
   - Repository permissions: **Pull requests: Read & write**, **Contents: Read-only**.
   - No webhook needed.
2. **Install** the App on the repository (or org).
3. Note the **App ID**, and generate a **private key** (downloads a `.pem`).
4. Add two repository secrets: `REVIEWER_APP_ID` and `REVIEWER_APP_PRIVATE_KEY` (paste the full PEM).

**Then pass them to the action:**

```yaml
      - uses: JuliettKhar/reviewer-lib@v3
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          app-id: ${{ secrets.REVIEWER_APP_ID }}
          app-private-key: ${{ secrets.REVIEWER_APP_PRIVATE_KEY }}
          summary: 'true'
          fail-on: high
```

When `app-id` + `app-private-key` are set, the action generates the App token automatically
(via [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)) and
posts as the App. Leave them empty to keep using `github-token` (the default `github-actions[bot]`).
