# QCoreAI Council benchmarks

`qcore-eval-latest.json` is the machine-readable output of
`aevion-globus-backend/scripts/qcore-eval.js` — the only script in the repo
that actually measures whether the multi-agent Council beats a single
flagship model, and at what cost.

## Running a fresh benchmark

```
cd aevion-globus-backend
BASE=http://127.0.0.1:4001 QCORE_EVAL_N=40 node scripts/qcore-eval.js
```

- Needs a running backend (`BASE`, defaults to the deployed prod backend —
  point it at localhost for a dev run) with `ANTHROPIC_API_KEY` set and at
  least one free-tier provider configured for a representative Council. If no
  free-tier provider is configured, the Council degrades to Anthropic-only
  members and the reported cost multiplier will be inflated (no free crowd to
  offset the premium chair) — configure `OPENROUTER_API_KEY` or similar for a
  representative cost read.
- Costs real API money (Fable 5 generation + judging calls) — `QCORE_EVAL_N`
  shrinks the question set for a cheaper/quicker read.
- Writes into the `latest` key of `qcore-eval-latest.json`, timestamped, and
  **preserves whatever is already in `historical`** — a run never wipes the
  curated historical entries. `latest` is always overwritten by the next run;
  it is not an append log.

## Methodology

- 40-question set (`QUESTIONS` in the script) across 7 categories: reasoning,
  math, coding, knowledge, writing, advice, analysis.
- Each question runs through `single-fable` (baseline), `council-l2-fable`
  (2-layer Council, Fable 5 chair) and `council-l2-opus` (2-layer Council,
  Opus 4.8 chair).
- Claude Fable 5 judges each Council answer against the single-flagship
  answer, pairwise, with A/B order randomised per item to cancel position
  bias. Win-rate excludes ties.

## Current snapshot

`qcore-eval-latest.json` has two top-level keys:

- **`historical`** — the two benchmark figures that were previously only
  prose comments in `orchestrator.ts` (Council-vs-flagship, N=40,
  2026-07-12) and `agents.ts` (Opus-vs-Fable chair, N=16, 2026-07-09),
  transcribed verbatim. No fresh API spend was made to produce these; they
  assume a normally-configured environment with the free-tier fleet active.
  A live run never overwrites this key.
- **`latest`** — the most recent live run's full output (cost/answer,
  win/tie/loss, per-category heatmap, verdicts), overwritten every time
  `qcore-eval.js` runs. The committed one is a real N=40 run (2026-07-21)
  against a local dev server with only **one** free-tier provider configured
  (OpenRouter) — see its `caveat` field for why that makes its cost
  multiplier (~6.2-6.4×) roughly double `historical`'s ~2.8×, and why its
  per-category `knowledge` win-rate (67-80%) doesn't match `historical`'s ~50%
  tie. That disagreement is flagged, not resolved: a small single-provider
  local run isn't strong enough evidence to revise the curated historical
  entry or the "auto" router's FACT-vs-Council rationale in `orchestrator.ts`
  — it needs a fully free-fleet-configured re-run to settle.

Re-run with `QCORE_EVAL_N=40` and several free-tier keys set (not just one)
to get a `latest` entry that's actually comparable to `historical`.
