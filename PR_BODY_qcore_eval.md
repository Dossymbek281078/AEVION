## Summary

Four commits on `feat/qcore-eval-2026-04-30`, layered on top of `feat/qcore-extras-2026-04-29`. Closes the V5 backlog opener: an **eval harness** that lets users run a fixed suite of test cases through the multi-agent pipeline and track quality regressions over time.

PR will be openable at: https://github.com/Dossymbek281078/AEVION/pull/new/feat/qcore-eval-2026-04-30

## Why this matters

QCoreAI is now feature-complete on the orchestration side (3 strategies, mid-run guidance, cost cap, marketplace, SDK, WS). The next quality bar is **detecting regressions** when prompts, agent overrides, or models change. This PR adds a first-class eval harness — same shape as production tools (Promptfoo, Anthropic Evals, OpenAI Evals) but built directly into the QCoreAI dashboard.

## What's in this PR

### 1. Backend — DDL + store + runner + 8 endpoints

**DDL** (`ensureQCoreTables.ts`):
- `QCoreEvalSuite` (id, ownerUserId, name, description, strategy, overrides JSONB, cases JSONB, createdAt, updatedAt) + `(ownerUserId, updatedAt DESC)` index
- `QCoreEvalRun` (id, suiteId, ownerUserId, status, score, totalCases, passedCases, totalCostUsd, results JSONB, errorMessage, startedAt, completedAt) + 2 indexes

**Store** (`store.ts`): 9 helpers + 4 types (`EvalCase`, `EvalJudge`, `EvalSuiteRow`, `EvalRunRow`, `EvalCaseResult`).

- `createEvalSuite`, `getEvalSuite`, `listEvalSuites`, `updateEvalSuite`, `deleteEvalSuite`
- `createEvalRun`, `updateEvalRun`, `getEvalRun`, `listSuiteRuns`
- DB + in-memory fallback both modes; `normalizeCases()` validates judge config and drops invalid cases (empty input, unknown judge type) before persistence

**Runner** (`evalRunner.ts`, ~190 LOC): bounded-pool concurrent worker (default 3, capped at 8). Each case invokes `runMultiAgent` and collects the `final` event content + sums `agent_end.costUsd`. Six judges: `contains`, `not_contains`, `equals` (trim+case-insensitive defaults), `regex` (respects flags, returns false on invalid pattern), `min_length`, `max_length`. Aggregates a weighted 0..1 score. Persists progress after every case so the UI can poll mid-run.

**Endpoints** (`routes/qcoreai.ts`), all owner-scoped via JWT sub:

| Method | Path | Notes |
|---|---|---|
| `POST` | `/eval/suites` | create |
| `GET` | `/eval/suites` | list user's suites |
| `GET` | `/eval/suites/:id` | fetch one |
| `PATCH` | `/eval/suites/:id` | update any subset |
| `DELETE` | `/eval/suites/:id` | owner-only |
| `POST` | `/eval/suites/:id/run` | kick off (rate-limit 10/min) |
| `GET` | `/eval/runs/:id` | poll progress |
| `GET` | `/eval/suites/:id/runs` | history (regression chart) |

### 2. Frontend — `/qcoreai/eval` + `/qcoreai/eval/[suiteId]`

**Suite list** (`/qcoreai/eval`):
- Hero in QCoreAI/teal palette
- Inline create form: name + description + strategy
- Card-style suite list with cases count + last updated
- Auth gate banner if no JWT

**Suite detail** (`/qcoreai/eval/[suiteId]`):
- Inline rename + description (autosave on blur)
- Last score panel with trend indicator (▲/▼ vs previous run)
- Sparkline of last 20 done runs (passed dot = teal, failed = red)
- Cases editor: 6 judge types with type-specific input fields
- ▶ Run eval button → polls `/eval/runs/:id` every 1.5s until status !== "running"
- Active run progress bar + per-case results stream as they finish (green/red rows)
- Run history table — clickable rows replay any run's results
- Delete suite (with confirm)

### 3. SDK `@aevion/qcoreai-client` v0.1.0 → v0.2.0

New methods on `QCoreClient`:
- `createEvalSuite`, `listEvalSuites`, `getEvalSuite`, `updateEvalSuite`, `deleteEvalSuite`
- `runEvalSuite(id, opts?)` — fire-and-forget, returns in-flight `EvalRun`
- `getEvalRun(id)` — poll for progress
- `listSuiteRuns(id, limit?)` — regression history
- **`runEvalSuiteAndWait(id, opts?)`** — convenience: kick + poll until done (with timeout)

New exported types: `EvalJudge`, `EvalCase`, `EvalSuite`, `EvalCaseResult`, `EvalRun`.

README extended with a full Eval harness section: 3-case quick-start with `runEvalSuiteAndWait`, manual-poll example, API reference table.

Build: tsc clean. Pack: 18.4 kB / 6 files (was 14.8 kB).

### 4. Tests — +13 vitest cases (129/129)

`tests/qcoreEval.test.ts`:

**Suite-level (in-memory mode):**
- `createEvalSuite` normalizes name/description, defaults strategy
- `createEvalSuite` drops cases with empty input or unknown judge type
- `listEvalSuites` is owner-scoped, sorted by `updatedAt` DESC
- `updateEvalSuite` is owner-only, patches subset of fields
- `deleteEvalSuite` is owner-only, clears child runs (not strangers)
- `createEvalRun` + `updateEvalRun` + `listSuiteRuns` persist progress

**Judge dispatch:**
- `contains`: case-insensitive default + `caseSensitive` flag
- `not_contains`: passes when needle absent
- `equals`: trim + case-insensitive defaults
- `regex`: respects flags + handles invalid pattern (returns false)
- `min_length` / `max_length`: boundary checks
- `aggregateScore`: weighted (4 weight units, 1 passed = 0.25)

## Test plan

- [x] Backend `npm run build` (tsc) — clean
- [x] Backend `npm test` — **129/129 green** in 15 test files (+13 eval cases)
- [x] Frontend `next build` — clean, **33 routes** (incl. new `/qcoreai/eval`, `/qcoreai/eval/[suiteId]`)
- [x] SDK `npm run build` — clean (`dist/index.{js,cjs,d.ts}`)
- [x] `npm run verify` from worktree root — green end-to-end
- [ ] Manual: `/qcoreai/eval` — create suite, add 3 cases (different judges), run, watch progress + score
- [ ] Manual: rename suite + change description (autosave), reload page, verify persisted
- [ ] Manual: run twice with different cases, verify sparkline + ▲/▼ trend on score panel
- [ ] Manual: delete suite, confirm history disappears
- [ ] SDK smoke (after publish or `npm link`):
  ```ts
  const client = new QCoreClient({ baseUrl: "https://api.aevion.app", token });
  const suite = await client.createEvalSuite({ name: "Demo", cases: [
    { id: "1", input: "What is 2+2?", judge: { type: "contains", needle: "4" } }
  ]});
  const result = await client.runEvalSuiteAndWait(suite.id);
  console.log(result.score, result.passedCases, "/", result.totalCases);
  ```

## Commits

1. `6d3cdde` feat(qcore): V5-Eval — backend (DDL + store + runner + 8 endpoints)
2. `a28e8b7` feat(qcore): V5-Eval — frontend /qcoreai/eval pages
3. `8969113` feat(qcore): V5-Eval — SDK methods + README v0.2.0
4. `1efb149` test(qcore): V5-Eval — 13 vitest cases for eval harness

## Files changed

### Backend
- `aevion-globus-backend/src/lib/ensureQCoreTables.ts` — `+QCoreEvalSuite` + `+QCoreEvalRun` + 3 indexes
- `aevion-globus-backend/src/services/qcoreai/store.ts` — +9 helpers + 5 types + `normalizeCases` validator
- `aevion-globus-backend/src/services/qcoreai/evalRunner.ts` — **new** (~190 LOC)
- `aevion-globus-backend/src/routes/qcoreai.ts` — +8 endpoints + import wiring
- `aevion-globus-backend/tests/qcoreEval.test.ts` — **new**, 13 vitest cases

### Frontend
- `frontend/src/app/qcoreai/eval/page.tsx` — **new** suite list page
- `frontend/src/app/qcoreai/eval/[suiteId]/page.tsx` — **new** suite detail with case editor + run polling + history table

### SDK
- `packages/qcoreai-client/package.json` — version 0.1.0 → 0.2.0, description updated
- `packages/qcoreai-client/src/index.ts` — +9 methods + 5 exported types
- `packages/qcoreai-client/README.md` — full Eval harness section + API reference rows

🤖 Generated with [Claude Code](https://claude.com/claude-code)
