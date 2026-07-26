# Recipes

Practical patterns built from the existing library, CLI, and Action — nothing here needs a feature
that isn't shipped.

## Gate CI only on serious issues

Let the review comment on everything, but fail the build only for `high`+ findings:

```sh
git diff origin/main | npx reviewer-lib review --fail-on high
```

Low/medium findings (including the occasional defensive false positive) stay visible without
blocking the merge. See [Models & false positives](/guide/models).

## Review only part of a monorepo

Pipe a scoped diff — the reviewer only sees what you give it:

```sh
# just one package
git diff origin/main -- packages/api | npx reviewer-lib review

# everything except generated/vendored paths
git diff origin/main | npx reviewer-lib review --exclude 'packages/*/dist/**,**/*.snap'
```

Lockfiles and `dist/` are excluded by default; `--exclude` adds more globs.

## Cache reviews across CI re-runs

Skip re-reviewing an unchanged commit (e.g. a re-run after a flaky unrelated job):

```sh
npx reviewer-lib review --pr 54 --post --cache-dir .cache/reviews
```

Results are keyed by a hash of the input + model + options. Caching is best-effort — a cache error
never fails the review. Persist `.cache/reviews` with your CI cache action to carry it between runs.

## Stronger triage on a cheap model

Run the review on a cheap model but judge which findings to keep with a stronger one:

```sh
git diff origin/main | npx reviewer-lib review --model gpt-4o-mini --filter --filter-model gpt-4o
```

On `o4-mini` (the default) the second pass is largely redundant — it's already clean.

## Add a "what changed" overview

Prepend a short high-level summary of the diff above the findings, in the same PR comment:

```sh
npx reviewer-lib review --pr 54 --post --summary
```

Or programmatically:

```ts
const [overview, findings] = await Promise.all([
  reviewer.summarizeDiff(diff, { language: 'typescript' }),
  reviewer.review(diff, { asDiff: true }),
]);
```

## Review a raw snippet (not a diff)

```sh
cat src/tricky.ts | npx reviewer-lib review --code --lang typescript
```

Programmatically, omit `asDiff` — findings then have `file`/`line` set to `null`:

```ts
const findings = await reviewer.review(sourceCode, { language: 'typescript' });
```

## Post findings to a PR yourself

If you'd rather drive the GitHub API from your own code, `toReviewComments()` gives you
ready-made inline-comment payloads:

```ts
import { Reviewer, formatFindings, toReviewComments } from 'reviewer-lib';

const findings = await new Reviewer(apiKey).review(diff, { asDiff: true });

await octokit.pulls.createReview({
  owner, repo, pull_number,
  event: 'COMMENT',
  body: formatFindings(findings),                    // markdown summary
  comments: toReviewComments(findings),              // [{ path, line, body }]
});
```

## Fail a pre-push hook on blocking issues

Save as `.git/hooks/pre-push` and `chmod +x` it:

```sh
#!/bin/sh
git diff -U30 origin/main...HEAD | npx reviewer-lib review --fail-on high || {
  echo "reviewer-lib found blocking issues — push aborted (use 'git push --no-verify' to override)."
  exit 1
}
```
