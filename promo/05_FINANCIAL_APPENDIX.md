# Financial Appendix — для CFO покупателя

> Приложение к `00_MASTER_PITCH.md`. Не полная финансовая модель — она строится после открытия дата-комнаты.
> Этот документ объясняет **экономику единицы (AEV)**, **источники выручки по столпам** и **базовые predicates**, на которых строится оценка $1B floor.

---

## 1. AEV — экономика расчётной единицы

| Параметр | Значение | Комментарий |
|----------|----------|-------------|
| Cap supply | 21 000 000 AEV | Зафиксирован, изменение требует Constitution-amendment + Advisor veto |
| Текущая эмиссия | См. `/api/aev/stats` | Live, не оценочно |
| Источники эмиссии | 4 engine | mining-stub, faucet, reward-engine, treasury |
| Точность | 8 знаков (как Bitcoin) | Достаточно для micro-billing |
| Ledger | Postgres (`AevWallet`, `AevLedgerEntry`) | Open-source, аудит-доступ под NDA |
| Velocity (целевая) | 6-12× в год | AEV не «сберегательная», а **расчётная** единица |
| Velocity (текущая) | См. live dashboard | Метрики транзакций per AEV per год |

### Почему cap 21M, а не «миллиард» как у токенов конкурентов

- **Дисциплина денежной массы.** Невозможно «допечатать» под давлением рынка — это сильнейший trust-signal для держателей.
- **Совместимость нарратива с Bitcoin** (21M ↔ 21M) — узнаваемый якорь для investor-сегмента.
- **Цена единицы AEV растёт по мере роста использования** — это не противоречит дисциплине, потому что **AEV делим до 8 знаков**.

### Что это значит для оценки

Если AEV покрывает 0.05% TAM ($1.5-2T) к 2030 через **fee-on-transaction** (0.1-0.5% per AEV-flow):

- Адресуемый flow ≈ $750M-$1B в AEV-номинации.
- Fee revenue ≈ $0.75M-$5M в год **только от транзакционного слоя**.
- Это ничтожно мало. **AEV — не основной revenue driver**. Основной — **подписки на модули + биллинг DevHub + QCoreAI per-token**.

---

## 2. Revenue lines по пяти столпам

### 2.1 Финансовый слой

| Линия | Модель | TAM-доля целевая (2030) | Run-rate ARR (mid) |
|-------|--------|--------------------------|---------------------|
| QPayNet processing fee | 0.5-1.2% per transaction | 0.02% global digital payments | $200-400M |
| AEVION Bank subscriptions | $9.99-$49.99/мес retail | 100-500K retail users | $40-80M |
| Payments Rail B2B API | $0.05-$0.20 per API call | 0.01% B2B BaaS | $30-60M |
| QTrade fees (spot) | 0.1-0.2% taker, 0.05% maker | 0.005% global spot volume | $40-100M |
| QTradeOffline batch sync | $50-$500/мес per integrator | 50-500 integrators | $5-20M |
| **Итого Финансовый** | | | **$315-660M** |

### 2.2 Защита и право

| Линия | Модель | Run-rate ARR (mid) |
|-------|--------|---------------------|
| QSign v2 API | $0.001-$0.01 per signature | $20-60M |
| QShield enterprise | $5K-$50K/год per tenant | $40-120M |
| QRight IP-attestations | $9-$99 per registration + $9.99/мес portfolio | $30-80M |
| QContract self-destruct docs | $4.99-$29.99/мес seat | $20-50M |
| QChainGov governance-as-service | $10K-$100K/год per org | $10-40M |
| QMaskCard privacy ID | $0.05 per verification | $5-30M |
| **Итого Защита** | | **$125-380M** |

### 2.3 Dev-слой / DevHub

| Линия | Модель | Run-rate ARR (mid) |
|-------|--------|---------------------|
| DevHub seat | $19-$99/мес per developer | $100-300M |
| DevHub passthrough margin | 10-15% маржа на API-вызовах к 9+ провайдерам | $30-90M |
| QCoreAI per-token | 5-15% маржа поверх LLM-провайдеров | $50-200M |
| QBuild ATS | $99-$799/мес per company | $40-120M |
| QBuild AI-shortlist add-on | $1.99 per resume scored | $10-30M |
| Bureau v2 service | $99-$499/мес | $5-20M |
| **Итого Dev** | | **$235-760M** |

### 2.4 Consumer

| Линия | Модель | Run-rate ARR (mid) |
|-------|--------|---------------------|
| CyberChess Pro/Ultimate | $4.99-$24.99/мес или AEV-cap | $40-120M |
| HealthAI subscriptions | $9.99-$49.99/мес | $30-100M |
| Multichat Pro | $19.99/мес | $20-60M |
| KidsAI / Smeta Trainer / прочие | $4.99-$14.99/мес | $20-80M |
| **Итого Consumer** | | **$110-360M** |

### 2.5 Governance / Trust

Прямого revenue не генерирует — **создаёт trust-premium** для всех остальных линий. **Условная оценка вклада в ARPU**: +8-15% к среднему чеку.

---

## 3. Сводная ARR-модель (mid-case 2030)

| Столп | Mid-case ARR |
|-------|---------------|
| Финансовый | $470M |
| Защита и право | $250M |
| Dev / DevHub | $500M |
| Consumer | $230M |
| Trust premium | +10% к Σ (мультипликатор) |
| **Sum × (1 + 0.10)** | **~$1.6B** |

**$1.6B mid-case ARR к 2030.** При мультипликаторе 6-12× (SaaS-norm для high-growth, vertical-defensible) — оценка $9.6B-$19.2B на 2030.

**$1B exit сегодня = entry в стол с потенциалом 10-20× за 4 года для покупателя.**

---

## 4. Operating economics (cost-side)

### 4.1 Структура затрат (run-rate prognoz)

| Категория | % выручки |
|-----------|-----------|
| LLM/AI passthrough (QCoreAI, DevHub) | 18-25% |
| Cloud infra (Railway, Vercel, Cloudflare) | 5-8% |
| Payments rails (Stripe fees, KYC) | 4-6% |
| Engineering payroll | 22-32% |
| Sales/marketing | 12-18% (после Series B) |
| G&A | 5-8% |
| **Operating margin (mid-case)** | **18-28%** |

### 4.2 Cash-runway сегодня

- **Burn (по последнему replicated state):** низкий — основная команда ядра 3-8 человек, удалённый формат, инфра-затраты ≈ $3K-$8K/мес.
- **Текущая выручка:** пре-revenue для большей части линий, ранние pilot-deals в QSign / QBuild / QPayNet.
- **Что покупатель получает:** **30+ модулей, готовых к коммерческому запуску каждого**, без операционного long-tail.

---

## 5. AEV velocity math (для финансового аналитика покупателя)

**Предпосылка:** AEV не сберегательная единица, а расчётная.

```
Steady-state ARR от AEV-fee =
  (M × P_aev × V × fee_pct) × 0.5  ← 50% коэффициент удержания флоу внутри AEV
где:
  M           = cap supply 21 000 000
  P_aev       = средняя цена 1 AEV в USD (целевая 2030: $50-150)
  V           = velocity (раз в год); целевой 6-12×
  fee_pct     = 0.1-0.5%
```

**Числовой пример (mid):**
- P_aev = $100, V = 8, fee_pct = 0.25%
- ARR_fee = 21M × $100 × 8 × 0.0025 × 0.5 = **$21M/год**

**Это ничтожно мало по сравнению с подписочной экономикой ($1.6B mid).** Поэтому ставка покупателя — **не на AEV-fee**, а на **подписки + биллинг DevHub + QCoreAI margin**.

**AEV — это:**
- Расчётный стандарт (как euro внутри ЕС),
- Trust signal cap-disciplines,
- Lock-in для пользователей платформы,
- **Не источник выручки.**

---

## 6. Critical assumptions, которые покупатель будет проверять в дата-комнате

1. **DevHub margin model.** Действительно ли 10-15% passthrough margin реализуется на провайдерских счетах? Под NDA — выписки.
2. **AEV ledger integrity.** Auditable supply, нет «теневых» эмиссий. Под NDA — full ledger dump.
3. **Constitution v1 enforceability.** Юридическая сила QSign-envelope-attested документа. Под NDA — legal opinion (готов на DD-этапе).
4. **Module breadth costs.** 30+ модулей = 30+ surface area. Стоимость поддержки. Ответ: единый registry + общие компоненты + автоматический health-board → marginal cost нового модуля низкий.
5. **Pricing power.** Готовность платить за подписки в B2C-витринах. Ответ: CyberChess Premium (Pro/Ultimate) уже введён, conversion-данные — под NDA.

---

## 7. Mark-to-market sanity check vs comparables

| Comparable | Сумма | AEVION-эквивалент |
|------------|-------|--------------------|
| Stripe (2023 private mark) | $50-95B | Финансовый слой AEVION ≈ 0.5-1% от Stripe → $250M-$950M only this pillar |
| Microsoft × GitHub | $7.5B | Dev-слой AEVION ≈ 20-40% от GitHub-сделки → $1.5-3B only this pillar |
| Plaid (Visa, отменено) | $5.3B | Финансовый слой ≈ 30-60% от Plaid → $1.6-3.2B only this pillar |
| Adobe × Figma (отменено) | $20B | Trust+Consumer слои ≈ 8-15% от Figma → $1.6-3B these pillars |

**Сложение по столпам (lower bound):** $250M + $1.5B + $1.6B + $1.6B = **$5B**.

**$1B floor — это 20% от lower-bound mark-to-market суммы по столпам.** Это оптимизация на **быстрый closing**, не «справедливая цена».

---

— редакция 2026-05-22, AEVION
