---
layout: home

hero:
  name: Reviewer Lib
  text: AI code review for pull requests
  tagline: Structured, actionable findings from OpenAI — use it as a library, a CLI, or a GitHub Action. Works with code in any language.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api
    - theme: alt
      text: View on GitHub
      link: https://github.com/JuliettKhar/reviewer-lib

features:
  - title: 🎯 Structured findings
    details: review() returns typed Finding[] — severity, category, file, line, message, suggestion — ready for inline PR comments or a CI gate. Not free text.
  - title: 🧠 Reasoning model by default
    details: Ships with o4-mini for the fewest false positives; it reasons about whether a concern is real instead of hedging. Pass gpt-4o-mini for a cheaper, noisier review.
  - title: 💬 Smart PR comments
    details: Posts inline comments (that go “outdated” on push) plus a single self-updating summary comment — no stale pile-ups.
  - title: 📝 Change overview
    details: Opt-in “what changed” summary of the diff, rendered above the findings in the same comment.
  - title: ⚡ CLI & GitHub Action
    details: Review from the terminal or wire up a PR check in a few lines — no glue code. Fetches the PR diff and posts results back.
  - title: 🧩 Diff-aware
    details: Annotates added lines so findings anchor to real line numbers; large diffs are chunked by file and hunk, then merged.
  - title: 🚫 Noise control
    details: Exclude path globs (lockfiles & build output skipped by default), a severity gate (--fail-on), and an optional second-pass triage.
  - title: ♻️ Reliable & typed
    details: Configurable retries and timeouts, a result cache to skip unchanged input, npm provenance, and shipped TypeScript types.
---
