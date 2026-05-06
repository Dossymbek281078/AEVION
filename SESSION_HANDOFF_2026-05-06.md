# Session handoff — 2026-05-06 (P3-4 ✅ DONE — Stripe live, smoke 24/24)

Финал серии `2026-05-03..2026-05-06`. P3-4 (First paid Bureau cert E2E) **закрыт**.

---

## Что сделано сегодня

| Действие | Статус |
|---|---|
| Railway env: `BUREAU_BRONZE_AEC_REWARD=50`, `_SILVER_=150`, `_GOLD_=500`, `_PLATINUM_=1000` | ✅ live (set 05-06) |
| Railway env: `STRIPE_SECRET_KEY=sk_test_*` | ✅ live |
| Railway env: `STRIPE_WEBHOOK_SECRET=whsec_*` | ✅ live |
| Railway env: `BUREAU_PAYMENT_PROVIDER=stripe` | ✅ live |
| Stripe Webhook destination `AEVION Bureau payments` → `…/api/bureau/payment/webhook` | ✅ Active |
| Stripe events listening: `payment_intent.succeeded` + `payment_intent.payment_failed` | ✅ 2 events |
| Railway redeploy (× 2) | ✅ uptime 3s, fresh code in prod |
| `bank-prod-smoke` против свежего деплоя | ✅ 24/24 PASS |
| `/api/bureau/dashboard` возвращает `trustEdges` + `aecSummary` | ✅ verified |
| Master plan §3 + §5 + changelog обновлены | ✅ done |

---

## Tech debt / nice-to-have (не блокирует)

1. **Live mode Stripe** — сейчас sandbox/test. Когда будет реальный legal entity → переключить ключи на `sk_live_*` + `whsec_live_*`, повторить redeploy + smoke
2. **First real paid cert** — пройти `/bureau/upgrade` UI с тест-картой `4242 4242 4242 4242`, увидеть Trust Graph edge, claim AEC. Это **функциональная** проверка end-to-end (smoke проверяет только plumbing endpoints)
3. **Railway auto-deploy from GitHub** — иногда залипает (видели 21h gap 05-04→05-05). Webhook от GitHub можно перенастроить, либо использовать наш `serviceInstanceRedeploy` через GraphQL API

---

## Артефакты для будущих сессий

- Railway GraphQL works with bearer auth: `Authorization: Bearer <token>` на `https://backboard.railway.com/graphql/v2`
- IDs:
  - project: `9d891410-4379-40e3-97ee-619f868ac5d4`
  - service (`aevion-globus-backend`): `13b81e5a-67ac-474c-b86d-05f3704d0896`
  - environment (production): `8d3be6fb-d202-4ffc-bd5a-97eb7e1bd816`
- Базовые мутации: `variableUpsert(input: VariableUpsertInput!)`, `serviceInstanceRedeploy(serviceId, environmentId)`
- Stripe webhook destination ID: `we_1TU1Vo5aAkC13G4MumWAdgcr` (sandbox / AEVION sandbox)

---

## Следующие приоритеты (master plan)

P3-4 закрыт → следующие плавки в `aevion-bank` отсутствуют. Что осталось в Phase 3:

- **P3-1** Demo recording (8-min walkthrough)
- **P3-2** Press kit / one-pager
- **P3-3** Reference customer onboarding
- **P3-5** Investor demo flow on prod (все ссылки в pitch deck → live)

---

## Smoke commands (как было)

```bash
cd C:/Users/user/aevion-core/aevion-globus-backend
node scripts/bank-prod-smoke.js  # 24/24 expected
```

Force redeploy через GraphQL (когда auto-deploy подвиснет):

```powershell
$token = "<RAILWAY_TOKEN>"
$body = @{
  query = 'mutation Redeploy($serviceId: String!, $environmentId: String!) { serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId) }'
  variables = @{
    serviceId = "13b81e5a-67ac-474c-b86d-05f3704d0896"
    environmentId = "8d3be6fb-d202-4ffc-bd5a-97eb7e1bd816"
  }
} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri "https://backboard.railway.com/graphql/v2" `
  -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} -Body $body
```
