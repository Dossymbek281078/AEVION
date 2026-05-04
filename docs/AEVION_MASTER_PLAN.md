# AEVION Master Plan to Production

> **Created** 2026-05-03 · **Owner** Dossymbek281078 · **Repo** github.com/Dossymbek281078/AEVION
>
> Single source of truth for "what's next across all 27 modules and N parallel
> windows". Checked into the repo so every git worktree (`aevion-core`,
> `aevion-backend-modules`, `aevion-qsign`, `frontend-qcore`, `aevion-bank`,
> `aevion-smeta`, `aevion-qbuild`, `aevion-cyberchess`, etc.) reads the same
> plan.
>
> **If you are an LLM (Claude Code, Codex, Cursor) starting a new session in
> any AEVION worktree:** stop. Read § 1 below first. It is non-negotiable.

---

## § 1. Coordination protocol — read before suggesting any task

When the user opens a new prompt asking *what to do*, *what's next*,
*продолжаем*, *что дальше*, *let's plan*, or any equivalent — execute these
six steps **before** proposing work:

1. **Locate yourself.** Print the current working directory's module scope.
   Each worktree has a local `CLAUDE.md` listing in-scope and "не трогаем"
   zones. Honour them. If the cwd's CLAUDE.md is missing or sparse, infer
   scope from the directory name (`aevion-bank` → bank track, etc.).

2. **Sync git state — fast.**
   ```bash
   git fetch --all --prune
   git branch -a --sort=-committerdate | head -15
   ```
   Anything in the top 5 with commits in the last 7 days is *probably
   live work in another window*.

3. **List open PRs.**
   ```bash
   "/c/Program Files/GitHub CLI/gh.exe" pr list --state open \
     --json number,title,headRefName,updatedAt --limit 20
   ```
   Match these against any task you are about to propose.

4. **Cross-reference § 5 of this plan.** Find the highest-priority
   *unblocked* item that fits the current worktree's scope.

5. **Detect parallel work and announce it.** If the candidate task touches
   a file/area where:
   - a branch matches `feat/<scope>-*` and was touched < 7 days ago, **or**
   - an open PR mentions the same module/files,
   say verbatim:
   > ⚠ `<module>` уже в работе в другом окне (ветка `<branch>`,
   > последний коммит `<date>`). Хочешь пивотнуть на альтернативу `<X>`,
   > или сначала проверить что там делается?

6. **Default to the smallest mergeable next step.** One PR-sized chunk.
   Don't propose 3-day epics — propose 30-90 min slices that compound.

After merging anything that ships visible behaviour, append one line to your
window's auto-memory `MEMORY.md`:
`- [PR #N · YYYY-MM-DD · scope](file.md) — one-line outcome`.

> **Hard rules**
> - Never `git push --force` to `main`.
> - Never edit another window's "не трогаем" zones unless the user
>   explicitly redirects.
> - Always run `npm run verify` (or local equivalent) before marking a task
>   "done". CI on Vercel and Railway is not a substitute.
> - Secrets through env only — no hardcoding, no logging.

---

## § 2. Inventory — who is on which window (snapshot 2026-05-03)

| Worktree | Branch (typical) | Scope | Status |
|---|---|---|---|
| `aevion-core` | `main` | monorepo root, frontend coordination | hub |
| `aevion-backend-modules` | `main` / `feat/*` | platform backend (qright, bureau, awards, pipeline, qshield, planet, modules) | active |
| `aevion-qsign` | `feat/qsign-v2` | QSign v2 | **shipped (PR #2)** — do nothing without checking PR list |
| `frontend-qcore` | `qcore-multi-agent` | QCoreAI multi-agent | shipped (PRs #3, #20, #31) |
| `aevion-bank` | `main` (`frontend/src/app/bank/`) | Bank UI + AEC ledger | active — branch archived, work continues on main |
| `aevion-smeta` | `feat/smeta-trainer` | смета (construction estimates) | active |
| `aevion-qbuild` | `port-qbuild-v3` | qbuild (construction hiring) | active |
| `aevion-cyberchess` | `chess-tournaments` | CyberChess UX | active |
| `aevion-globus` | various | globus / 27-node visualisation | active |

If a window not listed above asks for work, **first** check what its
CLAUDE.md says, then assume it's a new fork — confirm scope with the user
before suggesting anything.

---

## § 3. Per-module state matrix

Legend: ✅ done · ⚠ partial / unverified · ❌ missing · — not applicable

### Tier 1 — Trust + Money rails (must be 100% before public launch)

| # | Module | Backend | Frontend | Smoke | Sentry | i18n | SEO/OG | Prod-deploy | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Auth | ✅ | ✅ | ⚠ | ⚠ | ✅ | ⚠ | ⚠ | Security pass C1+C2+H1-3 in #74; H4+M5+M6 in PR #80 (open) |
| 2 | QRight v3 | ✅ | ✅ | ⚠ | ✅ | ✅ | ✅ | ⚠ | crypto stack done; Sentry wired #86 |
| 3 | QSign v2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ | P1-P9 + investor polish merged 2026-04-26 (PR #2) |
| 4 | Quantum Shield | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ | Working v1 in PR #23; Tier 3 amplifier wired |
| 5 | Bureau | ✅ | ✅ | ⚠ | ✅ | ✅ | ✅ | ⚠ | Phase A/B/C merged (#9, #75); Sentry wired #86 |
| 6 | Pipeline (IPCertificate) | ✅ | (in /bureau) | ⚠ | ✅ | ✅ | ✅ | ⚠ | dilithium + cosign + Sentry #86 |
| 7 | Planet Compliance | ✅ | ✅ | ⚠ | ✅ | ✅ | ✅ | ⚠ | quorum + Merkle + Sentry #86 |
| 8 | Bank | ✅ | ✅ | ✅ | ⚠ | ✅ | ⚠ | ⚠ | 273-commit prod-ready PR #5; AEC + Trust Score |
| 9 | QTrade | ✅ | ✅ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | Full trading platform + AEV in PR #72 |
| 10 | AEV token | ✅ | ✅ | ✅ | ⚠ | ✅ | ⚠ | ⚠ | bundled with QTrade (#72) |
| 11 | Payments Rail | ✅ | ✅ | ✅ | ⚠ | ✅ | — | ⚠ | v1.0-v1.3 (#19); 12 surfaces + 8 v1 endpoints |

### Tier 2 — Creator products (revenue path)

| # | Module | Backend | Frontend | Smoke | Sentry | i18n | SEO/OG | Prod-deploy | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 12 | Awards | ✅ | ✅ | ⚠ | ✅ | ✅ | ✅ | ⚠ | Music + Film tracks; admin bulk #59; Sentry #86 |
| 13 | CyberChess | (n/a) | ✅ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | tournaments + variants + brilliancy + bot personas |
| 14 | QBuild | ✅ | ✅ | ✅ | ⚠ | ⚠ | ⚠ | ⚠ | 10 killer features (#62); UI polish in `port-qbuild-v3` |
| 15 | смета (smeta) | ✅ | ✅ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | merged in #76; ESН РК corpus + export |

### Tier 3 — Intelligence + cross-platform

| # | Module | Backend | Frontend | Smoke | Sentry | i18n | SEO/OG | Prod-deploy | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 16 | QCoreAI multi-agent | ✅ | ✅ | ⚠ | ⚠ | ✅ | ⚠ | ⚠ | V1-V6 (PRs #3-#31); judge + comparison + Redis |
| 17 | Multichat Engine | ✅ | ✅ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | beta status; landing wired |
| 18 | Modules registry | ✅ | ✅ | ✅ | ⚠ | ✅ | ✅ | ⚠ | Tier 3 amplifier; admin bulk; webhooks |

### Tier 4 — Marketing surfaces

| # | Module | Backend | Frontend | Smoke | Sentry | i18n | SEO/OG | Prod-deploy | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 19 | Pricing / GTM | — | ✅ | — | — | ✅ | ⚠ | ⚠ | production landing for 27 modules (#15) |
| 20 | Pitch tour | — | ✅ | — | — | ✅ | ⚠ | ⚠ | investor-facing |
| 21 | Press / Help / Privacy / Terms / Security / Developers | — | ✅ | — | — | ⚠ | ⚠ | ⚠ | static landings exist |
| 22 | aevion-hub | ✅ | — | ✅ | — | — | ✅ | ⚠ | composite health + sitemap-index + openapi-index |

### Tier 5 — Vision / R&D (no prod path needed yet)

23 — QFusionAI · QPayNet · QMaskCard · VeilNetX · HealthAI · QLife · QGood · PsyApp · QPersona · Kids-AI · Voice of Earth · Startup-Exchange · DeepSan · MapReality · Z-Tide · QContract · ShadowNet · LifeBox · QChainGov

These are landing pages + roadmap entries only. **Do not** build backend
without explicit user direction.

---

## § 4. Phase plan (chronological)

### Phase 0 — Production deploy gates (BLOCKS everything else)

| ID | Task | Window | Blocker |
|---|---|---|---|
| P0-1 | Custom domain on Vercel (`aevion.app` or `aevion.tech`) — DNS cutover | aevion-core | DNS |
| P0-2 | Remove SSO gating from Vercel preview / prod (per memory `reference_prod_deploy_state_2026-05-03`) | aevion-core | infra access |
| ~~P0-3~~ | ~~Env audit~~ ✅ done in PR #92 — see `docs/PROD_ENV_CHECKLIST.md` + `npm run check:prod-env` | aevion-backend-modules | — |
| P0-3a | Wire `npm run check:prod-env` into the Railway deploy pre-step | aevion-core / infra | P0-3 |
| P0-4 | Public smoke target — point all `npm run smoke:*` scripts to prod URL via `BASE` env | aevion-backend-modules | P0-2 |

**Until P0-1+P0-2+P0-3 are done, every "shipped" Tier 1-3 module is invisible
to crawlers, partners, investors and customers.** Treat this as the single
biggest blocker.

### Phase 1 — Tier 1 prod-ready hardening (1-2 weeks)

For every Tier 1 module: Sentry + smoke against prod + monitoring + i18n
parity + docs/runbook.

| ID | Task | Owner | Dependency |
|---|---|---|---|
| ~~P1-1~~ | ~~Wire Sentry into bureau / awards / planet / pipeline / qright~~ ✅ done in PR #86 | aevion-backend-modules | — |
| ~~P1-2~~ | ~~Security H4+M5+M6 (tokenVersion + OAuth sid + cookie append)~~ ✅ done in PR #80 + polish in #85 | aevion-backend-modules | — |
| ~~P1-2b~~ | ~~Smoke for tokenVersion replay rejection~~ ✅ done in PR #98 (`scripts/auth-replay-smoke.js` wired into daily cron) | aevion-backend-modules | — |
| ~~P1-3~~ | ~~Daily smoke runner — orchestrator + GitHub Actions cron~~ ✅ done in PR #89 | aevion-backend-modules | — |
| ~~P1-4~~ | ~~Backup/restore drill + `docs/RUNBOOK.md`~~ ✅ done in PR #98 (JSON-store round-trip drilled, Postgres procedures documented) | aevion-backend-modules | — |
| P1-5 | Sentry alert rules + dashboard URL | aevion-backend-modules / aevion-core | P1-1 ✅ |
| ~~P1-6~~ | ~~Bank prod smoke~~ ✅ done in PR #103 — `aevion-globus-backend/scripts/bank-prod-smoke.js` (`npm run smoke:bank-prod`); 19/19 PASS through Vercel rewrite; SMOKE_PROD.md + first artifact in `docs/bank/` | aevion-bank | — |
| ~~P1-7~~ | ~~OpenAPI 0.4.0 → 0.5.0~~ → 0.5.1 ✅ done in PRs #98 + #102 (Tier 1 reads + planet/awards full schemas) | aevion-backend-modules | — |
| ~~P1-8~~ | ~~Awards + Planet smoke scripts~~ ✅ done in PR #102 (wired into daily cron) | aevion-backend-modules | — |
| ~~P1-9~~ | ~~Sentry alert rules spec~~ ✅ done in PR #102 (`docs/SENTRY_ALERTS.md`) — UI config separately | aevion-backend-modules | — |
| P1-4 | Backup/restore drill — run `scripts/backup.mjs`, verify restore on a fresh DB, document RTO/RPO | aevion-backend-modules | — |
| P1-5 | Sentry alert rules + dashboard URL in `docs/RUNBOOK.md` | aevion-backend-modules | P1-1 |
| ~~P1-6~~ | ~~Bank prod smoke~~ ✅ duplicate row — see updated entry above (PR #103) | aevion-bank | — |
| P1-7 | OpenAPI 0.4.0 → 0.5.0 with full request/response schemas for Tier 1 endpoints (currently summary-only) | aevion-backend-modules | — |

### Phase 2 — Tier 2 + Tier 3 hardening (1-2 weeks, parallelisable)

| ID | Task | Owner |
|---|---|---|
| P2-1 | Awards prod smoke + AEC payout end-to-end against prod Bank | aevion-backend-modules + aevion-bank |
| P2-2 | CyberChess: drag/click/premove regression suite (recent fixes in 0650719, d5c6d76, 7ce07a2) | aevion-cyberchess |
| P2-3 | QBuild UI polish merge from `port-qbuild-v3` | aevion-qbuild |
| P2-4 | смета — Sentry + i18n + smoke | aevion-smeta |
| P2-5 | QCoreAI usage accounting dashboard (per-provider OPEX) | frontend-qcore |
| P2-6 | Multichat Engine — beta → MVP: parallel sessions UX + role isolation already shipped, just needs prod smoke | frontend-qcore |

### Phase 3 — Investor + GTM (2-3 weeks, after Phase 1)

| ID | Task | Owner |
|---|---|---|
| P3-1 | Demo recording — 8-minute scripted walkthrough across QRight → Bureau → Awards → Bank | aevion-core |
| P3-2 | Press kit / one-pager — `docs/AEVION_ONEPAGER.md` exists; bring up to current state | aevion-core |
| P3-3 | Reference customer onboarding — RU partnership artifacts in `docs/bureau/` need productisation | aevion-bureau / aevion-core |
| P3-4 | First paid Bureau cert E2E — invoice via Stripe, Bureau cert issued, Trust Graph edge recorded | aevion-bank + aevion-bureau | **code-complete** — Trust Graph edge in `aca91c2`, AEC mint claim flow in PR #112 (`internalMintForDevice` + `/trust-edges/:edgeId/claim-aec`); remaining is config: product decision on `BUREAU_*_AEC_REWARD` env values + prod Stripe keys |
| P3-5 | Investor demo flow on prod — every link in pitch deck resolves, every stat is live | aevion-core |

### Phase 4 — Public launch

| ID | Task | Owner |
|---|---|---|
| P4-1 | DNS cutover announcement | aevion-core |
| P4-2 | First press wave (TechCrunch / Forbes RU / habr) | aevion-core |
| P4-3 | Reference customer case study published | aevion-core |
| P4-4 | Open API quotas + paid tier rollout | aevion-backend-modules |

### Phase 5 — Vision modules (post-launch)

19 R&D modules listed in § 3 Tier 5 are **vision-only** until launch
metrics justify investment. Don't accept tasks against them.

---

## § 5. Suggested next task per window (refresh weekly)

When the user is in a specific window and asks "what's next?", pick from
this section. It maps to § 4 phases and is updated as work lands.

### `aevion-backend-modules` (this window's owner)
**Phase 1 backlog exhausted in this window** as of 2026-05-03 16:57 UTC.
Remaining items are gated on Phase 0 infra (DNS, SSO, Railway env wire-up
of `npm run check:prod-env`) which belong to `aevion-core` / ops, OR
require Sentry UI config which is not git-managed.

If the user insists on more code work in this window, candidates are:
1. CyberChess + QBuild smoke scripts (mirror planet/awards pattern)
2. Webhook receiver smoke (qright royalties + cyberchess tournament + planet certify)
3. Per-route response-shape tests against the new OpenAPI 0.5.1 schemas (catches drift between code and spec)

### `aevion-core`
1. **P0-1+P0-2** DNS + SSO cutover — single biggest unblock for the whole roadmap
2. **P3-1** Demo recording script
3. Frontend i18n parity audit on the 5 layouts shipped in PR #78 (kk + ru completeness)

### `aevion-bank`
1. ~~**AEC ↔ fiat boundary doc**~~ ✅ done — `docs/bank/AEC_FIAT_BOUNDARY.md` (4 canonical rules R1–R4, P3-4 flow diagram, legal positioning, pre-P3-4 checklist)
2. ~~Resolve `bank-payment-layer` branch~~ ✅ done — archived as `archive/bank-payment-layer-2026-05-03` tag; all 362 net-new files were already present on main via parallel development; worktree + remote branch removed
3. ~~Wire `npm run smoke:bank-prod` into the daily cron~~ ✅ done — added `bank-prod-smoke` job to `daily-smoke.yml` (cron+dispatch only, skips on push; artifact stored 14 days in GitHub Actions)
4. **P3-4 code-complete** — Trust Graph edge (`aca91c2`) + AEC claim flow (PR #112) + smoke plumbing & reward sizing draft (PR #113). Remaining is config-only: product decision on `BUREAU_*_AEC_REWARD` env values (proposal in `AEC_FIAT_BOUNDARY.md` §8: 50/150/500/1000), prod Stripe keys

### `aevion-qsign`
1. **Do nothing without checking PR list** — P1-P9 already merged via PR #2 on 2026-04-26
2. If user insists on QSign work, propose: prod smoke run + Sentry alert wire-up

### `frontend-qcore`
1. **P2-5** Per-provider OPEX accounting dashboard
2. **P2-6** Multichat prod smoke
3. Translation parity for QCoreAI suggestion deck

### `aevion-cyberchess` / `chess-tournaments`
1. **P2-2** Regression suite for drag/click/premove (recent fixes are diagnostic-heavy)
2. P2P friend-play merge into main (per memory `cyberchess_merge_2026-05-01`)
3. Tournament finalize → Bank prize webhook smoke

### `aevion-smeta` / `feat/smeta-trainer`
1. **P2-4** Sentry + smoke + i18n
2. Export format audit — RK construction codes coverage

### `aevion-qbuild` / `port-qbuild-v3`
1. **P2-3** Merge `port-qbuild-v3` UI polish into main
2. Vacancy / application e2e smoke
3. SEO meta on qbuild landings (Tier 3 amplifier pattern not yet applied)

---

## § 6. Recently merged (cheat sheet — last 30 days)

If a user asks "is X done?" check this list **before** starting work on it.

```
2026-05-03  —    docs(bank): AEC ↔ fiat boundary rules shipped to main (R1–R4, P3-4 prereq done)
2026-05-03  #102 feat(platform): P1 follow-up — awards+planet smokes + OpenAPI 0.5.1 + Sentry alerts spec
2026-05-03  #98  feat(platform): P1 bundle — auth-replay smoke + RUNBOOK.md + OpenAPI 0.5.0 (P1-2b, P1-4, P1-7 done)
2026-05-03  #92  docs(env): PROD_ENV_CHECKLIST.md + check-prod-env validator (P0-3 done)
2026-05-03  #89  ci(platform): daily smoke runner orchestrator + GitHub Actions cron (P1-3 done)
2026-05-03  #88  docs(plan): mark P1-2 done — security pass 2 shipped in #80+#85
2026-05-03  #87  docs(plan): mark P1-1 done — Sentry coverage shipped
2026-05-03  #86  feat(platform): Sentry coverage on 5 platform routes (P1-1 done)
2026-05-03  #85  feat: mobile reflow + curl quick-start in /developers
2026-05-03  #82  docs(plan): AEVION_MASTER_PLAN.md — cross-window source of truth
2026-05-03  #80  fix(security): H4 tokenVersion + M5 OAuth sid + M6 cookie append (P1-2 done)
2026-05-03  #78  feat(platform): og:image + ETag/304 on sitemaps+RSS + Tier 3 smoke
2026-05-03  #76  feat(smeta-trainer): port AEVION construction estimation training app
2026-05-03  #75  feat(bureau): Phase B+C — org members, notary registry, Notarized tier
2026-05-03  #74  fix(security): C1+C2+H1+H2+H3+M1+M2+M3 — prod-ready security pass
2026-05-03  #73  feat(platform): Tier 3 ETag/304 + vitest smokes + OpenAPI extension
2026-05-03  #72  feat(qtrade+aev): port full trading platform + AEV token surfaces
2026-05-02  #71  fix(ci): payments-smoke audit key alphanumeric after sk_test_
2026-05-02  #70  fix(payments): allow underscores in API key
2026-05-02  #69  fix(frontend): robots.ts — origin is not defined during SSG
2026-05-02  #68  fix(ci+platform): green CI on Linux + 4 missing routers
2026-05-02  #67  fix(ci): npm install --ignore-scripts for backend
2026-05-02  #64  fix(ci): npm ci --omit=optional for Windows lock file
2026-05-02  #62  feat(qbuild-v2): 10 Killer Features
2026-05-01  #59  feat(awards): admin UI bulk action panel
2026-05-01  #54  feat(platform): SEO polish — sitemap-index, robots.txt, awards bulk admin
2026-05-01  #5   feat(bank): AEVION Bank — production-ready (273 commits)
2026-04-30  #53  Tier 3 amplifier — planet
2026-04-30  #50  Tier 3 amplifier — qright
2026-04-30  #48  Tier 3 amplifier — qshield
2026-04-30  #46  Tier 3 amplifier — pipeline
2026-04-29  #43  Tier 3 amplifier — awards
2026-04-29  #41  Tier 3 amplifier — bureau
2026-04-29  #40  Tier 3 amplifier — modules block 2
2026-04-29  #37  Tier 3 amplifier — modules block 1
2026-04-29  #31  feat(qcore): V6 — LLM-judge + comparison + prompts + Redis
2026-04-29  #30  feat(qcore): V5-Eval — eval harness with 6 judges
2026-04-29  #28  feat(sdk): AEVION planetary API monorepo
2026-04-28  #23  feat(qshield): Quantum Shield Working v1
2026-04-28  #20  feat(qcore): V4 — refine + search + tags + analytics + embed + SDK + marketplace
2026-04-27  #19  Payments Rail v1.0 → v1.3 (12 surfaces, 8 v1 endpoints)
2026-04-26  #15  GTM Pricing — production-ready landing for 27 modules
2026-04-26  #16  Feat/qright v2 — crypto stack
2026-04-26  #11  notary registry scaffold
2026-04-26  #9   feat(bureau): Phase A — Verified tier
2026-04-26  #6   QRight Phase B — Verified tier
2026-04-26  #4   B2B orgs
2026-04-26  #3   feat(qcore): multi-agent pipeline
2026-04-26  #2   QSign v2 — P1–P9 + investor polish
2026-04-26  #1   Crypto stack (Qright v2)
```

---

## § 7. How this file stays current

- **Every merged PR** that ships a feature → add to § 6.
- **Every weekly review** → re-rank § 5.
- **Every new window opened** → add to § 2.
- **Every status flip in matrix § 3** → flip the cell.

If you are an LLM editing this file, do NOT rewrite from scratch — make
surgical edits to the affected cell / row only. Preserve the rest verbatim
so cross-window readers keep stable references.

---

## § 8. Anti-patterns to avoid (learned from past sessions)

1. **Don't merge main into a feature branch locally** if a parallel session
   may be working on the same files. Resolve via PR review instead. (Lost
   17 conflict resolutions on 2026-05-01 — see memory
   `feedback_main_merge_via_pr_only`.)
2. **Don't forget Windows-only npm lockfile quirks** — always
   `npm install --include=optional` and verify with `npm ci` before push.
3. **Don't push without committing trailing changes** at session end — see
   memory `feedback_session_end_must_push`.
4. **Don't propose work that's done.** Step 6 of § 1 exists because of this.

---

End of plan. Last edit: 2026-05-03 (initial publish).
