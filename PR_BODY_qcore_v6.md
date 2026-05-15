## Summary

Eight commits on `feat/qcore-v6-2026-04-30`, layered on top of `feat/qcore-eval-2026-04-30` (V5). Closes the V6 backlog opened at the end of V5 in one session — **all five enhancements** plus three follow-up commits that close the verification gaps surfaced in self-review.

PR will be openable at: https://github.com/Dossymbek281078/AEVION/pull/new/feat/qcore-v6-2026-04-30

## Why this matters

After V5-Eval shipped a working eval harness, the natural next steps were: (1) make the harness handle subjective grading, (2) make regression detection actually visual, (3) give users versioned custom prompts, (4) unblock multi-instance deploys, (5) make QCoreAI usable on mobile. This PR ships all five.

## What's in this PR

### 1. V6-J — LLM-as-judge (commit `845b866`)

Adds a 7th judge type to the eval harness: `llm_judge { rubric, provider?, model?, passThreshold? }`. The runner calls an LLM (default Claude Haiku 4.5) with a strict system prompt, parses `VERDICT: PASS|FAIL` + `CONFIDENCE: 0..1` from the reply, and applies an optional confidence threshold.

- `judgeCase` becomes async (all 6 existing judges still work)
- Per-provider default judge model (haiku-4-5 / gpt-4o-mini / gemini-2.5-flash / deepseek-chat / grok-3-mini)
- Frontend case editor: dropdown adds "LLM judge", with rubric textarea + provider/model/passThreshold inputs
- SDK `EvalJudge` union extended; README example gains an `llm_judge` case
- +5 vitest cases (PASS/FAIL parse, threshold rejects low confidence, unparseable reply graceful, provider error graceful)

### 2. V6-C — Eval comparison view (commit `9d1f28c`)

New page `/qcoreai/eval/[suiteId]/compare?a=runIdA&b=runIdB`. Per-case grid with side-by-side cells classified into:

- ✔ both pass / ✘ both fail (green / red soft tint)
- ▲ FIXED — B passes, A failed (emerald)
- ▼ REGRESSED — A passed, B fails (rose)
- + new in B / − removed in B

Top summary panel: signed score Δ + counts per bucket. Per-cell `<details>` with the full output (max 280px scroll).

Run history table on the suite detail page now has a "Compare ↔" link on every done-after-done pair (compares with previous run).

### 3. V6-P — Prompts library + versioning (commit `02117fd`)

Versioned custom system prompts per agent role. Forking creates a child version in the chain (own prompts) or a fresh root in your library (public prompts by other users) and bumps the parent's `importCount`.

- DDL: `QCorePrompt` (name, description, role, content, version, parentPromptId, isPublic, importCount, ownerUserId) + 3 indexes
- 8 store helpers including `forkPrompt` and `getPromptVersionChain` (walks ancestors, BFS-descends)
- 8 endpoints: full CRUD + `/public` browse + `/:id/versions` chain + `/:id/fork`
- Frontend `/qcoreai/prompts`: two-pane layout, "🌐 Browse community" panel, version chain pills, immutable-content-per-version (saving creates v(N+1))
- SDK v0.2.0 → v0.3.0: 8 new methods + `Prompt` type
- +9 vitest cases (143/143 total)

### 4. V6-R — Redis pub/sub guidance bus (commit `5dcc061`)

Refactors the in-process `liveRunGuidance` Map into a swappable `GuidanceBus` interface with two implementations:

- `InMemoryGuidanceBus` — single-process Map (default, behavior unchanged)
- `RedisGuidanceBus` — pub/sub on channel `qcore:guidance:<runId>`. Each node keeps a local buffer; pushes are broadcast over Redis so any HTTP-frontend node can route `/guidance` to whichever node runs the orchestrator

Selection: `process.env.QCORE_REDIS_URL` set + `ioredis` installed → Redis bus boots; otherwise → in-memory. `ioredis` loaded via dynamic `Function`-based import so it's a truly **optional** runtime dep — TS doesn't try to resolve types at build time, npm install doesn't need it.

`/api/qcoreai/health` gains `guidanceBus: "memory" | "redis"` and `liveRuns: <count>` for telemetry.

+8 vitest cases (151/151 total).

**Deploy notes:** existing single-instance deploys keep working unchanged. To enable multi-instance scaling: set `QCORE_REDIS_URL=redis://...` on every node + `npm i ioredis`. No DDL or API change.

### 5. V6-M — Native mobile SDKs (commit `05c935e`)

Two new monorepo workspaces, both v0.1.0:

**`packages/qcoreai-swift/`** — Swift Package
- Single file ~280 LOC, no third-party deps
- iOS 15+ / macOS 12+ / tvOS 15+ / watchOS 8+
- `QCoreClient` struct with async/await methods: `runSync`, `refine`, `setTags`, `search`, `createEvalSuite`, `runEvalSuite`, `getEvalRun`, `runEvalSuiteAndWait`, `createPrompt`, `listPrompts`, `forkPrompt`
- 5 XCTest cases

**`packages/qcoreai-kotlin/`** — Gradle module
- Single file ~310 LOC, only deps are `kotlinx-coroutines` + `kotlinx-serialization-json` + JDK 11 `HttpClient` (Android desugar from API 24)
- `QCoreClient` class with `suspend fun` mirror of the Swift API
- 7 kotlin-test cases

Streaming and webhook HMAC are intentionally not in v0.1 — documented in both READMEs.

## Test plan

- [x] Backend `npm run build` (tsc) — clean
- [x] Backend `npm test` — **152/152 green** + 4 skipped real-LLM in 18 files
- [x] Frontend `next build` — clean, **35 routes** (+/qcoreai/eval/[suiteId]/compare, +/qcoreai/prompts)
- [x] SDK (TS) `npm run build` — clean (v0.3.0)
- [x] `npm run verify` — green end-to-end
- [ ] Swift Package: runs in CI on macos-14 (`.github/workflows/mobile-sdks.yml`)
- [ ] Kotlin module: runs in CI on ubuntu-latest with Gradle 8.5
- [ ] Real-LLM smoke (run locally with `ANTHROPIC_API_KEY=sk-ant-... npx vitest run qcoreLlmJudgeReal`)
- [ ] Manual `/qcoreai/eval` — create suite with one `llm_judge` case, run, verify VERDICT/CONFIDENCE parsed
- [ ] Manual `/qcoreai/eval/[id]/compare` — pick two finished runs, verify ▲ FIXED / ▼ REGRESSED highlighting
- [ ] Manual `/qcoreai/prompts` — create prompt, edit + "Save as v2", browse community panel, fork community prompt
- [ ] Multi-instance: spin up 2 backend nodes with same `QCORE_REDIS_URL`, post `/guidance` to node A while orchestrator runs on node B, verify guidance lands

### 6. V6-P-int — Wire prompts into orchestrator (commit `f3903e1`)

Closes the missing half of V6-P: saved prompts are now actually used by `/multi-agent`.

- Body field `promptOverrides: { role: { promptId? OR content? } }` on `POST /api/qcoreai/multi-agent`
- For each role with `promptId`: fetch (owner-scoped unless `isPublic`) → merge `prompt.content` into `overrides[role].systemPrompt`
- Frontend `RoleConfigCard` gains "Custom prompt" dropdown (filtered by role + generic system/writer prompts), "— role default —" option keeps stock
- Lazy-loads user prompts when config panel opens
- SDK `RunOptions.promptOverrides` field with full TypeScript types

### 7. V6-J-smoke — Real-LLM smoke test (commit `d9c5160`)

`tests/qcoreLlmJudgeReal.test.ts` actually hits Claude Haiku 4.5 / GPT-4o-mini and verifies our `LLM_JUDGE_SYSTEM` prompt reliably produces the expected `VERDICT: PASS|FAIL\nCONFIDENCE: 0..1` two-line format. Skipped without API keys — surfaces format drift before users hit `unparseable reply` failures.

```
ANTHROPIC_API_KEY=sk-ant-... npx vitest run qcoreLlmJudgeReal
```

### 8. V6-M-ci — GitHub Actions for mobile SDKs (commit `8175530`)

`.github/workflows/mobile-sdks.yml` — Swift on macos-14, Kotlin on ubuntu-latest with Gradle 8.5. Path-scoped triggers (only runs when the SDK directories or workflow file change). Catches build failures the Windows host couldn't surface during authoring. Switched Kotlin testImplementation to `kotlin("test-junit5")` so `useJUnitPlatform()` has a real launcher.

## Commits

1. `845b866` feat(qcore): V6-J — LLM-as-judge type for subjective eval criteria
2. `9d1f28c` feat(qcore): V6-C — Eval comparison view side-by-side
3. `02117fd` feat(qcore): V6-P — Prompts library with versioning + community
4. `5dcc061` feat(qcore): V6-R — Redis pub/sub guidance bus for multi-instance scale
5. `05c935e` feat(qcore): V6-M — native mobile SDKs (Swift + Kotlin)
6. `f3903e1` feat(qcore): V6-P-int — wire prompts library into orchestrator
7. `d9c5160` test(qcore): V6-J-smoke — real-LLM judge integration test
8. `8175530` ci(qcore): V6-M-ci — GitHub Actions for Swift + Kotlin SDKs

## Files changed

### Backend
- `aevion-globus-backend/src/lib/ensureQCoreTables.ts` — `+QCorePrompt` + 3 indexes
- `aevion-globus-backend/src/services/qcoreai/store.ts` — `EvalJudge.llm_judge` + 8 prompt helpers + types
- `aevion-globus-backend/src/services/qcoreai/evalRunner.ts` — `judgeCase` async + `llm_judge` branch
- `aevion-globus-backend/src/services/qcoreai/guidanceBus.ts` — **new** (~170 LOC)
- `aevion-globus-backend/src/routes/qcoreai.ts` — bus integration + 8 prompt endpoints + /health telemetry
- `aevion-globus-backend/tests/qcoreEval.test.ts` — async + 5 LLM-judge cases
- `aevion-globus-backend/tests/qcorePrompts.test.ts` — **new**, 9 cases
- `aevion-globus-backend/tests/qcoreGuidanceBus.test.ts` — **new**, 8 cases

### Frontend
- `frontend/src/app/qcoreai/eval/[suiteId]/page.tsx` — `llm_judge` editor + Compare links
- `frontend/src/app/qcoreai/eval/[suiteId]/compare/page.tsx` — **new** comparison view
- `frontend/src/app/qcoreai/prompts/page.tsx` — **new** prompts library

### SDK (TS) v0.2.0 → v0.3.0
- `packages/qcoreai-client/src/index.ts` — `EvalJudge.llm_judge` + 8 prompt methods + `Prompt` type
- `packages/qcoreai-client/package.json` — version bump
- `packages/qcoreai-client/README.md` — `llm_judge` example

### Mobile SDKs
- `packages/qcoreai-swift/` — **new**, Swift Package (~280 LOC + tests)
- `packages/qcoreai-kotlin/` — **new**, Gradle module (~310 LOC + tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
