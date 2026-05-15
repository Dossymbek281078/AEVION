# AEC ↔ Fiat Boundary

> Обязательный архитектурный ориентир перед P3-4 (первый платный Bureau-серт через Stripe).
> Описывает, что AEC **может** и **не может** делать по отношению к реальным деньгам.

---

## 1. Что такое AEC

**AEC (AEVION Ecosystem Currency)** — внутренний incentive-токен платформы.

| Свойство | Значение |
|---|---|
| Природа | Баллы лояльности / учётные единицы активности |
| Хранение | Device-wallet в `aev_wallets.json` → Postgres (`aev.ts`) |
| Эмиссия | Только платформой (mint endpoint, rate-limited, auth-gated) |
| Источники | CyberChess призы, QRight роялти, Planet-сертификаты, Awards |
| Использование | Банковские переводы P2P внутри AEVION Bank, AEC Vault (симулятор стейкинга) |

**AEC — это не криптовалюта, не финансовый инструмент, не ценная бумага.**
Никакого гарантированного обменного курса к фиату не существует и не предполагается.

---

## 2. Фиатные потоки платформы

| Поток | Маршрут | Провайдер | Статус |
|---|---|---|---|
| Bureau cert Verified ($19) | `/api/bureau/…` → Stripe | Stripe + `payment.ts` | prod-ready (Phase A) |
| Bureau cert Notarized ($89) | то же | Stripe | Phase C (not started) |
| Bureau cert Filed KZ ($299) | то же | Stripe | Phase D (not started) |
| Platform subscription | `/api/pricing/checkout/session` → Stripe | Stripe via `checkout.ts` | prod-ready |
| QPayNet merchant charge | `/api/qpaynet/charge` | Internal wallet DB | MVP shipped |
| QPayNet deposit | `/api/qpaynet/deposit` | Internal wallet DB (stub fiat input) | MVP shipped |

---

## 3. Канонические правила границы

Правила зафиксированы здесь, чтобы все реализации (Bank, Bureau, QPayNet, Awards) следовали единой политике.

### R1 — Фиат → AEC: только через платформенный mint после события

Платёж в фиат **сам по себе** не создаёт AEC автоматически.
AEC mint происходит **отдельным вызовом** `/api/aev/wallet/:deviceId/mint`
только когда платформа подтверждает завершение целевого события.

```
Stripe webhook (payment_intent.succeeded)
    └─► bureau.ts: mark cert "verified"
    └─► (опционально) aev.ts: mint BUREAU_CERT_REWARD AEC для deviceId
```

Размер награды — конфигурируемая константа (`BUREAU_CERT_AEC_REWARD`), по умолчанию `0`
до тех пор, пока product-решение о размере не будет принято.

### R2 — AEC → Фиат: запрещено

AEC **не может быть обменян** на фиат, KZT, USD, EUR или любую другую валюту.
Нет endpoint'а вывода. Нет rate API. Баланс AEC не отражается в BureauVerification,
Stripe-сессиях, QPayNet-кошельках.

### R3 — AEC как оплата Bureau-серта: не поддерживается (MVP)

Bureau-серт tier Verified требует фиатной оплаты через Stripe.
AEC-баланс **не учитывается** как замена или скидка при оплате серта.
Если в будущем потребуется "оплата AEC" — это отдельный product-трек с отдельным юр. анализом.

### R4 — QPayNet и AEC независимы

QPayNet-кошельки (`/api/qpaynet/…`) и AEC-кошельки (`/api/aev/…`) — разные хранилища.
Перевод внутри QPayNet не затрагивает AEC-баланс и наоборот.
Конвертация между ними — future feature, не MVP.

---

## 4. Диаграмма: первый платный Bureau-серт (P3-4)

```
User browser
    │
    ├─ POST /api/bureau/payment-intent        ← создаём Stripe PaymentIntent
    │       (amount = 1900 cents, currency = usd / kzt)
    │
    ├─ Stripe Checkout ──────────────────────► Stripe
    │                                              │
    │                                    webhook: payment_intent.succeeded
    │                                              │
    │                             POST /api/bureau/webhook (HMAC-verified)
    │                                              │
    │                              bureau.ts: mark BureauVerification.paymentStatus = "paid"
    │                              bureau.ts: upgrade IPCertificate.authorVerificationLevel = "verified"
    │                              aev.ts:   mint BUREAU_CERT_AEC_REWARD AEC  ← R1 (reward size TBD)
    │                              Trust Graph: record edge (cert_id → user_id, tier = "verified")
    │
    └─ GET /api/bureau/cert/:certId           ← клиент получает обновлённый серт
```

---

## 5. Trust Graph и AEC

Bureau-серт записывает **Trust Graph edge** (см. P3-4: "Trust Graph edge recorded").
Эта запись происходит **в той же транзакции**, что и смена `authorVerificationLevel`.
AEC mint — отдельный, некритичный вызов: если он упадёт, серт всё равно выдаётся.

---

## 6. Юридическое позиционирование

| Вопрос | Позиция |
|---|---|
| Является ли AEC электронными деньгами (РК)? | Нет. AEC — это баллы лояльности без фиатного обеспечения. |
| Подпадает ли под закон о платёжных системах РК? | Нет, пока нет возможности вывода в фиат. |
| Нужна ли лицензия НБ РК? | Нет при текущей архитектуре (R1–R4 соблюдены). |
| Stripe ToS совместимость? | Да: Stripe принимает платежи за SaaS-услуги (Bureau cert = digital service). AEC не является "virtual currency" с рыночным курсом, поэтому не попадает под Stripe Prohibited Business policy для crypto. |

**Если R2 нарушается (появляется вывод AEC в фиат):** требуется юридический аудит
перед реализацией — AEC может переклассифицироваться как электронные деньги.

---

## 7. Что нужно сделать перед P3-4

- [x] ~~Реализовать Trust Graph edge record в `bureau.ts`~~ — таблица `BureauTrustEdge` + хук в `/upgrade/:certId` + GET `/api/bureau/trust-edges/cert/:certId` + GET `/api/bureau/trust-edges/me`
- [x] ~~Каркас `BUREAU_*_AEC_REWARD` env-vars~~ — функция `bureauAecReward(tier)` читает `BUREAU_VERIFIED_AEC_REWARD` / `BUREAU_NOTARIZED_AEC_REWARD` / `BUREAU_FILED_KZ_AEC_REWARD` / `BUREAU_FILED_PCT_AEC_REWARD`, default 0
- [ ] Product decision: сколько AEC за каждый tier (выставить env-vars в Railway)
- [ ] Подключить реальный Stripe Secret Key в prod Railway env
- [ ] Подключить реальный Stripe Webhook Secret (HMAC-проверка уже в коде)
- [x] ~~Smoke-test P3-4 plumbing~~ — `bank-prod-smoke.js` шаг `runBureauTrustGraph` проверяет `/trust-edges/me`, `/trust-edges/cert/:id`, `claim-aec` (auth gate, missing edge 404, missing deviceId 400). Полный E2E через Stripe нужно гонять вручную после подключения prod-ключей
- [x] ~~AEC mint claim flow~~ — PR #112: `POST /api/bureau/trust-edges/:edgeId/claim-aec` (auth + body `{deviceId}`), `internalMintForDevice()` экспортирован из `aev.ts`, edge.aecRewardClaimedAt помечается после успешного mint

---

## 8. Предложение по AEC reward sizing (требует product-confirm)

| Tier | Цена | Себестоимость | Предлагаемый AEC | Обоснование |
|---|---:|---:|---:|---|
| Verified | $19 | $4 | **50 AEC** | ~10% от чистой маржи $15, удерживает повторное обращение в Bureau |
| Notarized | $89 | $30 | **150 AEC** | ~10% от $34 чистой маржи, награда выше Verified пропорционально цене |
| Filed (KZ) | $299 | $80 | **500 AEC** | ~5% от $90 — крупный платёж, награда символическая (юр. услуга — главная ценность) |
| Filed (PCT) | $1499 | $1100 | **1500 AEC** | флэт reward, AEC второстепенен на этом tier |

**Принципы:**
- AEC ≠ кешбэк. Не «возврат денег», а incentive за вовлечение.
- Reward линеен на низких tier (Verified/Notarized — где AEC заметен в Bank UX) и плоский на высоких (где AEC — мелочь).
- Cap на mint per call в `aev.ts` — `1000 AEC`. Filed PCT 1500 → не пройдёт через `internalMintForDevice` (clampAmount lock на 1000). Решение: либо разбить на 2 mint, либо поднять cap, либо округлить до 1000. **Рекомендация: округлить Filed PCT до 1000** для MVP — пересмотрим если product захочет больше.
- Альтернатива: 0/0/0/0 для launch-day (только Trust Graph edge), включить reward после первых 100 платных certs (telemetry-driven).

**Скорректированные значения (после cap):**

```
BUREAU_VERIFIED_AEC_REWARD=50
BUREAU_NOTARIZED_AEC_REWARD=150
BUREAU_FILED_KZ_AEC_REWARD=500
BUREAU_FILED_PCT_AEC_REWARD=1000
```

---

## 9. Ссылки

- `aevion-globus-backend/src/routes/aev.ts` — AEC wallet + ledger API
- `aevion-globus-backend/src/routes/bureau.ts` — Bureau cert + verification
- `aevion-globus-backend/src/lib/payment.ts` — Stripe payment provider
- `docs/bureau/BUREAU_ECONOMICS.md` — tier pricing + unit economics
- `docs/bank/SMOKE_PROD.md` — smoke harness docs
