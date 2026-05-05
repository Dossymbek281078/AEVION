# P3-4 Railway go-live — точные шаги

Код и smoke на проде зелёные (24/24 PASS, проверено `91ac10b` на Vercel + Railway).
Остался **только конфиг**. Скопируй блоки ниже один за другим.

> Эти команды требует кредентиалы в `RAILWAY_TOKEN` или `railway login`. Без них Claude
> их выполнить не может — поэтому они вынесены в этот доку.

---

## 1. Stripe ключи (в Stripe Dashboard)

1. https://dashboard.stripe.com/apikeys → Reveal **Secret key** (`sk_live_…`)
2. https://dashboard.stripe.com/webhooks → Add endpoint:
   - URL: `https://aevion-production-a70c.up.railway.app/api/bureau/payment/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Скопировать **Signing secret** (`whsec_…`)

---

## 2. Railway env vars

Поставь токен: https://railway.app/account/tokens → Create token → скопируй.

```bash
# В терминале где есть токен:
export RAILWAY_TOKEN=...
npm i -g @railway/cli   # один раз
railway link             # выбери проект aevion-production

# AEC reward sizes (proposal из AEC_FIAT_BOUNDARY.md §8)
railway variables --set BUREAU_VERIFIED_AEC_REWARD=50
railway variables --set BUREAU_NOTARIZED_AEC_REWARD=150
railway variables --set BUREAU_FILED_KZ_AEC_REWARD=500
railway variables --set BUREAU_FILED_PCT_AEC_REWARD=1000

# Stripe — для P3-4 первый платный серт
railway variables --set BUREAU_PAYMENT_PROVIDER=stripe
railway variables --set STRIPE_SECRET_KEY=sk_live_XXXXXXXX
railway variables --set STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXX
```

После последней команды Railway автоматически передеплоит сервис.

---

## 3. Верификация

```bash
# Sanity на бэкенде
curl https://aevion-production-a70c.up.railway.app/api/health

# Bureau verified-tier цена
curl https://aevion-production-a70c.up.railway.app/api/bureau/verify/start \
  -X POST -H "content-type: application/json" -d '{"declaredName":"Test"}'
# → должен вернуть verificationId

# Полный smoke (включая новые Trust Graph шаги)
cd C:/Users/user/aevion-core/aevion-globus-backend
node scripts/bank-prod-smoke.js
# → все 24 шага PASS
```

---

## 4. Что считается "P3-4 done"

После шагов 1–3 P3-4 закрыт полностью:

- [x] Trust Graph edge запись на каждом upgrade — done in `aca91c2`
- [x] AEC mint claim flow — done in PR #112
- [x] Smoke plumbing — done in PR #113
- [x] AEC reward sizes — Step 2 этого документа
- [x] Prod Stripe keys — Step 1+2
- [x] Smoke verification — Step 3

Дальше можно гнать первый реальный платный серт через UI: `/aevion-ip-bureau/upgrade`.

---

## 5. Rollback

Если что-то пошло не так:

```bash
# Вернуть Bureau на stub-провайдер (без Stripe)
railway variables --set BUREAU_PAYMENT_PROVIDER=stub

# Отключить AEC награды (edges всё ещё пишутся, просто без mint)
railway variables --set BUREAU_VERIFIED_AEC_REWARD=0
railway variables --set BUREAU_NOTARIZED_AEC_REWARD=0
railway variables --set BUREAU_FILED_KZ_AEC_REWARD=0
railway variables --set BUREAU_FILED_PCT_AEC_REWARD=0
```

Код можно не трогать — все три эндпоинта (`/upgrade`, `/trust-edges/me`, `/trust-edges/:id/claim-aec`) идемпотентны и graceful при reward=0 (claim-aec вернёт 409 "no reward planned").
