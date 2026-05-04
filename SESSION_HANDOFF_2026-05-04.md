# Session handoff — 2026-05-04 (P3-4 prod-ready, осталась конфигурация)

Продолжение трека `aevion-bank` из `SESSION_HANDOFF_2026-05-03.md`. Все
3 задачи §5 закрыты + P3-4 (первый платный Bureau-серт) дотянут до
code-complete и проверен в проде.

---

## Как продолжить на другой машине

```powershell
cd C:\Users\user\aevion-core
git fetch --prune origin
git checkout main
git pull --ff-only origin main
npm install --include=optional
npm install --include=optional --prefix aevion-globus-backend
npm install --include=optional --prefix frontend
claude
```

Первое сообщение Claude:

> Прочитай `SESSION_HANDOFF_2026-05-04.md` и `docs/bank/P3-4_RAILWAY_GO_LIVE.md`.
> P3-4 code-complete и в проде. Осталось только: (1) Railway env vars
> (Stripe + AEC reward sizes), (2) первый реальный платный серт через UI.
> Что блокирует прямо сейчас — нужны Railway API token + Stripe keys.

---

## Что сделано в этой сессии (2026-05-04)

### P3-4 First paid Bureau cert E2E — code-complete

| Слой | Коммит / PR | Что |
|---|---|---|
| Trust Graph edge запись | `aca91c2` (folded into parallel commit) | `BureauTrustEdge` table + idempotent hook в `/upgrade/:certId` + 2 read эндпоинта (`/trust-edges/cert/:id`, `/trust-edges/me`) + `bureauAecReward(tier)` env-driven |
| AEC mint claim flow | PR #112 (merged `7470160`) | `POST /api/bureau/trust-edges/:edgeId/claim-aec` + `internalMintForDevice()` экспорт из `aev.ts` |
| Smoke plumbing + reward sizing | PR #113 (merged `81051bc`) | `runBureauTrustGraph` step в `bank-prod-smoke.js` (5 sub-проверок) + §8 в `AEC_FIAT_BOUNDARY.md` с предложением 50/150/500/1000 |
| Backend AI endpoints | `e98281d` | `match-vacancy` + `cover-letter` под `/api/build/ai/*` (нужны парсессии для `/build/ai-match` page) |
| Sentry alerts | `39f561d` | P1-BUREAU-PAYMENT + P1-BUREAU-CLAIM в `SENTRY_ALERTS.md` |

### Параллельные сессии ломали Vercel build — починил дважды

- `91ac10b` — `availableWorkers` + `teamRequest` shape + `applyToTeam(roleIndex)` + `createTeamRequest.startDate` + `AiVacancyDraft` + KZ profile fields + `shifts.tsx` lat/lng coercion
- `2b18a6c` — `aiMatchVacancy` + `aiCoverLetter` frontend stubs (backend reализован в `e98281d`)

### Smoke в prod — последняя проверка

```
✅ all steps passed (24/24)
deploy: e98281d → https://aevion-lgyltzbgh-aevion.vercel.app
```

---

## Что осталось (требует кредентиалов)

Документировано в `docs/bank/P3-4_RAILWAY_GO_LIVE.md`. Кратко:

### 1. Railway API token

https://railway.app/account/tokens → Create token

### 2. Stripe ключи

- https://dashboard.stripe.com/apikeys → Reveal Secret key (`sk_live_...`)
- https://dashboard.stripe.com/webhooks → Add endpoint:
  - URL: `https://aevion-production-a70c.up.railway.app/api/bureau/payment/webhook`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Скопировать Signing secret (`whsec_...`)

### 3. Команды для Railway (Claude может выполнить, как только токен в чате)

```bash
export RAILWAY_TOKEN=...
railway link  # выбери aevion-production
railway variables \
  --set BUREAU_VERIFIED_AEC_REWARD=50 \
  --set BUREAU_NOTARIZED_AEC_REWARD=150 \
  --set BUREAU_FILED_KZ_AEC_REWARD=500 \
  --set BUREAU_FILED_PCT_AEC_REWARD=1000 \
  --set BUREAU_PAYMENT_PROVIDER=stripe \
  --set STRIPE_SECRET_KEY=sk_live_XXX \
  --set STRIPE_WEBHOOK_SECRET=whsec_XXX
```

Railway передеплоится автоматически. После — гнать `node aevion-globus-backend/scripts/bank-prod-smoke.js` для финальной верификации.

Railway CLI 4.44.0 уже установлен глобально на этой машине.

---

## Открытые риски / невыполненное

- **Параллельные сессии иногда хайджекают мои feat-ветки** — см. `~/.claude/projects/.../memory/feedback_aevion_parallel_sessions.md`. Лечится повторным cherry-pick + явным `git log <branch> -1 --stat` после каждого commit.
- **AI match-vacancy / cover-letter rate-limited** — 10 calls / 10 min per user. Если /build/ai-match увидит много запросов — поднять.
- **AEC reward cap = 1000 AEC per call** (`clampAmount` в `aev.ts`). Filed PCT $1499 предложен 1000 AEC намеренно. Если product захочет больше — править `clampAmount` или mint-ить двумя вызовами.
- **Trust Graph Postgres-only** — `BureauTrustEdge` таблица создаётся только через `ensureBureauTables()` при первом обращении к Bureau API. Если Bureau не дёрнули — таблицы нет. Не баг, просто заметка.

---

## Ключевые ссылки

- `docs/bank/AEC_FIAT_BOUNDARY.md` — каноничные правила R1-R4 + reward sizing proposal §8
- `docs/bank/P3-4_RAILWAY_GO_LIVE.md` — точные команды для go-live
- `docs/AEVION_MASTER_PLAN.md` §5 `aevion-bank` — все 4 задачи треча отмечены done/code-complete
- `docs/PROD_ENV_CHECKLIST.md` — `BUREAU_*_AEC_REWARD` строки добавлены
- `docs/SENTRY_ALERTS.md` — P1-BUREAU-PAYMENT + P1-BUREAU-CLAIM
- `aevion-globus-backend/scripts/bank-prod-smoke.js` — `runBureauTrustGraph` шаги 19-23

---

## Следующая сессия должна

1. Получить от пользователя Railway token + Stripe keys
2. Выполнить блок Railway commands
3. Гнать `bank-prod-smoke.js` (24/24 должно остаться)
4. Создать первый реальный платный Verified-серт через `/aevion-ip-bureau` UI и через `bureau.ts` flow
5. Верифицировать что:
   - Stripe payment_intent ушёл в paid
   - `IPCertificate.authorVerificationLevel = "verified"`
   - `BureauTrustEdge` записан с `aecRewardPlanned=50`
   - `claim-aec` минтит 50 AEC в device wallet
6. Закрыть P3-4 в master plan переходом из "code-complete" в "✅ done"
