---
name: AEVION projects overview
description: AEVION monorepo layout — git worktrees of aevion-core, mapping of 10 active "окна" (Russian shorthand) to directories/branches/products
type: project
originSessionId: 107e9048-6e9a-44aa-bf9e-8e70ff9aeef2
---
AEVION is a 27-project roadmap sharing a single git repo (`aevion-core`, remote `https://github.com/Dossymbek281078/AEVION.git`). Each product is a branch, checked out as a git worktree into a sibling directory. Always run `git worktree list` inside `C:/Users/user/aevion-core` to confirm the current mapping — it changes.

**As of 2026-04-28 — 11 active "окна" (the user refers to projects by Russian shorthand):**

| # | Окно (RU) | Worktree directory | Branch | Product |
|---|---|---|---|---|
| 1 | Шахматы | `C:/Users/user/aevion-core/frontend-chess` | `chess-tournaments` | CyberChess |
| 2 | Крайт | `C:/Users/user/aevion-backend-modules` | `feat/qright-tier2-embed` (also has `feat/qright-v2`) | QRight (rights pipeline, Shamir SSS 2-of-3 over Ed25519) |
| 3 | Ксайн | `C:/Users/user/aevion-qsign` | `feat/qsign-polish` | QSign (e-signature pipeline) |
| 4 | ККоре | `C:/Users/user/aevion-core/frontend-qcore` | `qcore-multi-agent` | QCore / Multichat |
| 5 | Банк | `C:/Users/user/aevion-core/frontend-bank` | `bank-payment-layer` | Bank |
| 6 | Авардс | `C:/Users/user/aevion-core/frontend-exchange` | `aec-exchange` | AEV / Proof-of-X award engines (Curation/Mentorship/Streak/Network) |
| 7 | КТрейд | `C:/Users/user/aevion-core/frontend-exchange` ⚠️ same as Авардс | `aec-exchange` | QTrade trading UI (`feat(qtrade)` commits) |
| 8 | ГТМ | `C:/Users/user/aevion-core/frontend-gtm` | `gtm-pricing-api` | GTM / Pricing |
| 9 | Платежи | `C:/Users/user/aevion-core/frontend-payments` | `payments-rail` | Payments |
| 10 | Глобус | `C:/Users/user/aevion-core/frontend-globus` | `globus-polish` | Globus (3D ecosystem visualisation) |
| 11 | Бюро | `C:/Users/user/aevion-bureau` | `feat/bureau-v2` | Bureau (digital patent / certificate registry) |
| 12 | Смета | `C:/Users/user/aevion-smeta-trainer` | `feat/smeta-trainer` | AI Smeta Trainer (учебный тренажёр сметного дела РК для курса в `C:/Users/user/smeta-rk-kurs/`) |

⚠️ **Авардс + КТрейд share one physical worktree** (`frontend-exchange` on `aec-exchange`). The user treats them as 2 logical окна, but they ship from the same checkout — sequence the work, don't try to run both in parallel against the same dir.

Plus `C:/Users/user/aevion-core` on `main` — the monorepo root.

**Non-obvious:**
- "Крайт" = QRight, lives in `aevion-backend-modules` (directory name does NOT match the product). No `aevion-qright` directory exists.
- "Авардс" = the AEV/Exchange worktree. Its commits are tagged `feat(aev)` for the Proof-of-X engines (Curation/Mentorship/Streak/Network) and `feat(qtrade)` for trading UI. Both ship from this single worktree.
- "ККоре" = QCore. Multichat features (`feat(multichat)`) ship from this worktree.

**Why:** worktrees were set up for parallel product work; directory names come from earlier scaffolding and were never renamed. Russian shorthand names are how the user refers to them in conversation.

**How to apply:** when the user names an окно (Шахматы / Крайт / Ксайн / ККоре / Банк / Авардс / ГТМ / Платежи / Глобус / Бюро), cross-reference this table first, then `cd` into the correct worktree. If the table is stale, re-run `git worktree list` in `aevion-core` to re-derive it.

Each worktree has the same top-level shape: `frontend/` (Next.js), `aevion-globus-backend/` (Node/TS backend), plus shared docs (`AEVION_*.md`). Frontends include pages for all products (`/qright`, `/qsign`, `/bureau`, etc.), but the "owning" worktree is where that product's feature work is committed.
