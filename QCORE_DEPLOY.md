# QCoreAI V4 + V5 + V6 — Deploy Checklist

Trinity merge: ship 19 commits (7 V4 + 4 V5 + 8 V6) to `main` and turn on every feature in prod. Order matters — V5 stacks on V4, V6 stacks on V5.

> Three branches PUSHED, no PRs opened (gh CLI not authed in our session). All merge actions below are click-only on the GitHub UI.

---

## 0. Pre-flight

- [ ] `git fetch origin` from worktree root
- [ ] Confirm three branches exist: `feat/qcore-extras-2026-04-29`, `feat/qcore-eval-2026-04-30`, `feat/qcore-v6-2026-04-30`
- [ ] Confirm Railway env has at least `ANTHROPIC_API_KEY` (and ideally `OPENAI_API_KEY`) so smoke can hit real providers

---

## 1. V4 (refine + search + tags + analytics + embed + SDK + marketplace + WebSocket)

**PR URL** — https://github.com/Dossymbek281078/AEVION/pull/new/feat/qcore-extras-2026-04-29
**Body file** — `PR_BODY_qcore_extras.md` (worktree root)

### Steps

- [ ] Open PR, paste body
- [ ] **Squash & merge** → Delete branch
- [ ] Railway → backend service → Deploy (forces `npm i` for the new `ws` dep)
- [ ] Railway → frontend service → Deploy (new routes)
- [ ] Smoke: `BASE=https://api.aevion.io node aevion-globus-backend/scripts/qcore-smoke.js`
  Expect green for steps 1-16; SKIP_RUN=1 if you don't want to spend tokens on the actual `/multi-agent`.

**Critical:** backend redeploy is required — V4 adds the `ws` package + a new `/api/qcoreai/ws` endpoint. Without redeploy WS clients will 502.

---

## 2. V5 (eval harness)

After V4 is in `main`:

```bash
cd C:/Users/user/aevion-core/frontend-qcore
git fetch origin
git checkout feat/qcore-eval-2026-04-30
git rebase origin/main
git push --force-with-lease
```

**PR URL** — https://github.com/Dossymbek281078/AEVION/pull/new/feat/qcore-eval-2026-04-30
**Body** — `PR_BODY_qcore_eval.md`

### Steps

- [ ] Open PR, paste body
- [ ] **Squash & merge** → Delete branch
- [ ] Railway redeploy (DDL auto-bootstraps for `QCoreEvalSuite` + `QCoreEvalRun`)
- [ ] Smoke step 11-12 (suite create + list) should pass
- [ ] Manual: visit `/qcoreai/eval`, create a 1-case suite, run it, verify score

---

## 3. V6 (5 enhancements + 3 gap-closers)

After V5 is in `main`:

```bash
git checkout feat/qcore-v6-2026-04-30
git rebase origin/main
git push --force-with-lease
```

**PR URL** — https://github.com/Dossymbek281078/AEVION/pull/new/feat/qcore-v6-2026-04-30
**Body** — `PR_BODY_qcore_v6.md`

### Steps

- [ ] Open PR, paste body
- [ ] Wait for CI: `Mobile SDKs` workflow runs (Swift on macos-14 + Kotlin on ubuntu) — surfaces any compile error in mobile sources
- [ ] **Squash & merge** → Delete branch
- [ ] Railway redeploy backend (DDL auto-bootstraps `QCorePrompt`)
- [ ] Railway redeploy frontend (`/qcoreai/eval/[id]/compare`, `/qcoreai/prompts`, `/multi` updated)
- [ ] Smoke (full run): `BASE=https://api.aevion.io node aevion-globus-backend/scripts/qcore-smoke.js`
  Expect 25 steps green; ~$0.05-$0.10 in tokens for the V1 run + V5 eval.

---

## 4. Optional env vars to flip features on

| Var | When to set | Effect |
|---|---|---|
| `QCORE_REDIS_URL=redis://…` | Multi-instance backend deploy | V6-R guidance bus uses Redis pub/sub instead of in-process Map. Also `npm i ioredis` on the backend service. |
| `QCORE_WEBHOOK_URL` + `QCORE_WEBHOOK_SECRET` | You want central webhook fan-out (env-level) | `run.completed` events POST to URL signed via HMAC-SHA256 |
| `QCORE_MAX_COST_USD_PER_RUN=50` | Tighten the upper bound | Per-run hard cap; default 50 |
| `ANTHROPIC_API_KEY` (real one) | Always | LLM-as-judge defaults to Claude Haiku 4.5 |
| `OPENAI_API_KEY` | Recommended | Backup judge model + writer fallback |

`/api/qcoreai/health` reports `guidanceBus: "memory" | "redis"` and `liveRuns: <n>` for telemetry.

---

## 5. SDK publishing

### TypeScript (`@aevion/qcoreai-client` v0.3.0)

```bash
cd packages/qcoreai-client
npm pack --dry-run  # sanity check
npm login
npm publish --access public
```

Verifies on https://www.npmjs.com/package/@aevion/qcoreai-client

### Swift Package

The Swift Package is consumed via the public AEVION repo URL — no separate publish step. Apps add it via Xcode:

```
File → Add Package Dependencies → https://github.com/Dossymbek281078/AEVION
```

Optionally submit to https://swiftpackageindex.com/ once the repo is public.

### Kotlin module

To publish to Maven Central or JitPack, add `signing` plugin to `build.gradle.kts` and configure GPG key + Sonatype credentials. Easiest interim: JitPack (no setup) — apps consume it via:

```kotlin
// settings.gradle.kts
repositories { maven("https://jitpack.io") }
// build.gradle.kts
implementation("com.github.Dossymbek281078:AEVION:feat-qcore-v6-2026-04-30")
```

---

## 6. Post-deploy smoke checklist

After each merge + redeploy, click through these manually:

### V4 surfaces
- [ ] `/qcoreai/multi` — sidebar quick-find + tag chip strip + ✎ Refine + 🌐 Browse community
- [ ] `/qcoreai/analytics` — cost-over-time chart + 7-day forecast + top tags bars
- [ ] Share any run → click `</> Embed` → paste `<iframe>` snippet in a sandbox HTML, see read-only widget
- [ ] WS smoke (browser console):
  ```js
  const ws = new WebSocket("wss://api.aevion.io/api/qcoreai/ws");
  ws.onmessage = e => console.log(e.data);
  ws.onopen = () => ws.send(JSON.stringify({type:"start", input:"hi", strategy:"sequential"}));
  ```

### V5 surfaces
- [ ] `/qcoreai/eval` — create suite, add a `contains` case, ▶ Run → score 100%

### V6 surfaces
- [ ] `/qcoreai/eval/[id]/compare?a=…&b=…` — pick two finished runs, see ▲ FIXED / ▼ REGRESSED diff
- [ ] `/qcoreai/prompts` — create prompt, edit + "Save as v2", browse community panel
- [ ] `/qcoreai/multi` — open config panel → RoleConfigCard shows new "Custom prompt" dropdown
- [ ] Run `/multi-agent` with a custom prompt selected — verify the writer's behavior changes
- [ ] LLM-judge smoke:
  ```bash
  cd aevion-globus-backend
  ANTHROPIC_API_KEY=sk-ant-... npx vitest run qcoreLlmJudgeReal
  ```
  4 tests should pass. If not, model has drifted from the strict format — tweak `LLM_JUDGE_SYSTEM` in `src/services/qcoreai/evalRunner.ts`.

---

## 7. Rollback plan

If any of V4/V5/V6 needs to be backed out:

- The DDL is **additive only** — `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`. Reverting the merge does not break old DBs; new tables/columns simply get ignored by older code.
- The new endpoints don't override existing routes — reverting hides them but doesn't 500 anything.
- Redis (V6-R): un-set `QCORE_REDIS_URL` and the backend transparently falls back to the in-process bus on next boot.
- ioredis: removing the package is fine — the bus's dynamic `Function`-based import treats missing dep as "fall back to in-memory" without crashing.

There is **no migration to roll back**. Worst case, revert the merge commit and redeploy.

---

## 8. Commit map (for grep / git log)

| Commit | Branch | What |
|---|---|---|
| `f07a67c` `b87b22d` `2823312` `8e684a2` `f4bdabb` `04a9b1e` `d625a01` | feat/qcore-extras | V4 (7) |
| `6d3cdde` `a28e8b7` `8969113` `1efb149` | feat/qcore-eval-2026-04-30 | V5 (4) |
| `845b866` `9d1f28c` `02117fd` `5dcc061` `05c935e` `f3903e1` `d9c5160` `8175530` | feat/qcore-v6-2026-04-30 | V6 (8) |

Total: 19 commits, 152/152 backend tests + 4 skipped real-LLM, 35 frontend routes, TS SDK v0.3.0, Swift v0.1.0, Kotlin v0.1.0.
