# Models & false positives

The single biggest lever on review quality is the **model**. Reviewer Lib defaults to a reasoning
model precisely because it produces far fewer false positives.

## Why `o4-mini` is the default

An LLM's "false positives" on code are mostly technically-valid but low-value defensive
observations ("this value might be malformed", "consider guarding this") rather than real bugs. In
the project's eval:

- **`gpt-4o-mini`** catches the planted bugs but adds several low-severity defensive nits.
- **`o4-mini`** (reasoning) caught every planted bug with **zero** defensive noise on the same
  cases — it reasons about whether a concern is _real_ instead of hedging.

So `o4-mini` is the default. On a real pull request the difference is stark — a single review often
drops from a dozen findings to one or two.

::: warning Cost & latency
`o4-mini` costs more per token than `gpt-4o-mini` and adds latency from hidden reasoning tokens. A
PR review is infrequent, so the absolute cost stays small — but if you want the cheaper, noisier
behaviour, pass `gpt-4o-mini` explicitly:

```sh
reviewer-lib review --pr 54 --model gpt-4o-mini
```
:::

## What a reasoning model does _not_ fix

Some false positives come from **missing context**, not judgment — the model asserts something it
can't see. For example, in a test file whose diff doesn't include the shared `afterEach`, the model
may flag "missing mock cleanup" even though the teardown exists elsewhere in the file. No model
fixes this, because the evidence isn't in the diff.

Practical mitigations:

- **`--fail-on high`** — these FPs are `low`/`medium`, so they never block the merge.
- **`exclude`** — skip files you don't want reviewed (e.g. `**/*.spec.ts`).

## Choosing a model

| Model | When |
| --- | --- |
| `o4-mini` _(default)_ | Best precision — the fewest false positives. Use for PR review. |
| `gpt-4o-mini` | Cheapest, fastest — accept more low-severity noise. |
| `o3`, `gpt-5.x` | Other reasoning models; handled automatically (`max_completion_tokens`, no `temperature`). |
| `*-instruct` | Legacy text-completion models, routed to the old Completions API. Note: `review()` needs a chat model. |

Reasoning models are detected automatically — the library sends `max_completion_tokens` (with a
floor so reasoning tokens don't starve the answer) and omits sampling params those models reject.

## Cutting noise further

- **`--filter`** — a second-pass triage that drops low-value findings by their wording. Useful on
  `gpt-4o-mini`; largely redundant on `o4-mini`, which is already clean.
- **`--fail-on <severity>`** — gate CI only on findings that matter.
- **`exclude`** — keep generated/noise files (lockfiles, build output, docs) out of the review.
