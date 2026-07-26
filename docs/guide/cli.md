# CLI

The package ships a `reviewer-lib` command, so you can review without writing any glue code.
`OPENAI_API_KEY` must be set.

```sh
# review your working changes locally
git diff origin/main | npx reviewer-lib review --fail-on high

# review a diff file as JSON
npx reviewer-lib review --diff pr.diff --format json

# in CI: fetch a PR diff and post inline comments + a summary
#   (needs GITHUB_TOKEN and GITHUB_REPOSITORY)
npx reviewer-lib review --pr 54 --post --fail-on high
```

## Input

Pick one; defaults to **stdin**:

| Flag | Description |
| --- | --- |
| `--diff <file>` | Read a unified diff from a file |
| `--pr <number>` | Fetch the diff of a GitHub PR (needs `GITHUB_TOKEN` + `GITHUB_REPOSITORY`) |
| _(stdin)_ | Pipe a diff, e.g. `git diff main \| reviewer-lib review` |
| `--code` | Treat the input as raw code instead of a diff |

## Options

| Flag | Description |
| --- | --- |
| `--model <name>` | Model to use (default `o4-mini`; pass `gpt-4o-mini` for a cheaper, noisier review) |
| `--lang <language>` | Hint the source language (e.g. `typescript`, `python`) |
| `--summary` | Add a "what changed" overview above the findings (one extra call) |
| `--filter` | Second-pass triage: drop low-value / defensive findings |
| `--filter-model <m>` | Model for the triage pass (use a stronger one) |
| `--exclude <globs>` | Extra comma-separated path globs to skip (lockfiles + `dist/` skipped by default) |
| `--cache-dir <dir>` | Cache results by content hash (skip re-reviewing unchanged input) |
| `--fail-on <sev>` | Exit 1 if any finding is at or above severity (`critical`\|`high`\|`medium`\|`low`) |
| `--format <fmt>` | Output format: `text` (default) or `json` |
| `--post` | Post the review to the PR (requires `--pr`) |
| `--api-key <key>` | OpenAI key (default `$OPENAI_API_KEY`) |
| `--timeout <ms>` | Per-request timeout in ms (default 120000) |
| `--max-retries <n>` | Retry attempts on transient errors (default 3) |

Run `npx reviewer-lib --help` for the full list.

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key |
| `GITHUB_TOKEN` | GitHub token (for `--pr` / `--post`) |
| `GITHUB_REPOSITORY` | `owner/repo` (for `--pr` / `--post`; auto-set inside GitHub Actions) |

## Posting to a PR

With `--pr <n> --post`, the CLI:

- posts **inline comments** on the changed lines (anchored to the PR head commit, so GitHub marks
  them _outdated_ once a later commit changes the line);
- **upserts a single summary comment** — it finds its previous summary by a hidden marker and edits
  it in place, so re-runs don't pile up stale summaries.

Add `--summary` to prepend a short "what changed" overview above the findings in that summary
comment.

## Local usage & git hook

Review a whole branch before opening a PR:

```sh
git diff main...HEAD | npx reviewer-lib review --fail-on high
```

Review automatically before every push — save as `.git/hooks/pre-push` and `chmod +x` it:

```sh
#!/bin/sh
git diff -U30 origin/main...HEAD | npx reviewer-lib review --fail-on high || {
  echo "reviewer-lib found blocking issues — push aborted (use 'git push --no-verify' to override)."
  exit 1
}
```
