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
  least one free-tier provider configured for a representative Council.
- Costs real API money (Fable 5 generation + judging calls) — `QCORE_EVAL_N`
  shrinks the question set for a cheaper/quicker read.
- Overwrites `qcore-eval-latest.json` with `source: "live-run"` and the
  current timestamp — the file is always the latest run, not an append log.

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

The committed `qcore-eval-latest.json` is seeded with `source: "historical"`
— the two benchmark figures that were previously only prose comments in
`orchestrator.ts` (Council-vs-flagship, N=40, 2026-07-12) and `agents.ts`
(Opus-vs-Fable chair, N=16, 2026-07-09). They are transcribed verbatim from
those comments, not a fresh run — no new API spend was made to produce this
file. Replace it with a live run (above) when you want current numbers; until
then, treat the historical entries as directional, not current-state proof.
