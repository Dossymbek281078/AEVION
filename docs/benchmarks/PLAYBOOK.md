# Playbook: publishing a defensible quality benchmark

This is the pattern built for QCoreAI's Council-vs-single-flagship benchmark
(this directory) — extracted so any other AEVION module can reuse it instead
of repeating the same mistake: a specific quality/accuracy claim ("beats X
80% of the time") that lives only as a source comment, was never re-run, and
can't be checked against anything.

Use this when a module wants to publish a "we measured this" claim — in a
comparison page, investor material, or marketing copy — and needs that claim
to survive scrutiny.

## The pattern

1. **Write a reproducible eval script**, not a one-off manual test. It should
   take a `BASE` (server URL) and an `N` (sample size) as env vars, run a
   fixed, checked-in question/case set, and print a clear verdict. See
   `aevion-globus-backend/scripts/qcore-eval.js`.
2. **Persist the result to a checked-in JSON file** with two keys:
   - `historical` — the curated, citable baseline. Written once, by a human,
     from a real run. Never touched by an automated re-run.
   - `latest` — whatever a script most recently produced. Overwritten every
     run. This is what proves the pipeline still works, not what you cite.
   A run must **merge**, not overwrite the whole file — read the existing
   file first, keep `historical`, replace only `latest`.
3. **Never silently let numbers drift.** If a fresh `latest` run disagrees
   with `historical` in a way that matters (a different category ranking, a
   meaningfully different cost multiplier), say so in a `caveat` field on the
   `latest` entry and in the docs — don't quietly overwrite `historical` and
   don't quietly ignore the disagreement. A single small/differently-configured
   run is usually not strong enough evidence to revise a curated baseline;
   treat a disagreement as "worth re-verifying," not settled.
4. **If the claim is cited in product UI**, sync the relevant fields into a
   co-located JSON file inside the frontend package (don't import across the
   monorepo boundary — Next.js/Vercel file tracing can miss files outside the
   frontend project root) via a small sync script, and derive the displayed
   copy from that JSON instead of typing the numbers into JSX/TS by hand. See
   `frontend/src/app/qcoreai/vs/benchmark.json` +
   `aevion-globus-backend/scripts/sync-qcore-benchmark.js` +
   `frontend/src/app/qcoreai/vs/data.ts`.
5. **Gate any CI automation behind a cost guard.** If refreshing the
   benchmark costs real API money, the CI job should no-op (`if:` guard on
   the required secret) until someone deliberately provisions those secrets
   — don't make a workflow that silently starts spending money the moment
   it's merged. Open a PR with the refreshed `latest` (assign/request review
   from a real person) rather than committing straight to main. See
   `.github/workflows/qcore-benchmark.yml`.
6. **Before applying this elsewhere, check it's actually needed.** Not every
   module has this problem — a module whose "numbers" are real computed
   values (a clinical score, a live metric) or whose claims are qualitative
   ("routes by lowest cost") doesn't need a benchmark artifact. Only modules
   making a specific, checkable *quality/accuracy* claim about AI output do.

## Reference implementation

| Piece | File |
|---|---|
| Eval script | `aevion-globus-backend/scripts/qcore-eval.js` |
| Persisted results (`historical` + `latest`) | `docs/benchmarks/qcore-eval-latest.json` |
| Frontend sync script | `aevion-globus-backend/scripts/sync-qcore-benchmark.js` |
| Frontend co-located data | `frontend/src/app/qcoreai/vs/benchmark.json` |
| Derived UI copy (not hand-typed) | `frontend/src/app/qcoreai/vs/data.ts` |
| Delta visualization (historical vs. latest) | `frontend/src/app/qcoreai/vs/BenchmarkDeltaChart.tsx` |
| Cost-guarded, PR-opening CI automation | `.github/workflows/qcore-benchmark.yml` |
