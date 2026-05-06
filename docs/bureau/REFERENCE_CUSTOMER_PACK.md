# P3-3 — Reference Customer Pack (RU)

> Производственный пакет для подключения первого реального клиента
> AEVION Bureau. После P3-4 (paid E2E live) платформа технически готова
> принять заявителя; этот пак закрывает «как и кому продавать».

---

## 1. Идеальный профиль первого клиента (ICP)

**Кого ищем (по приоритету):**

1. **Музыкальная студия / лейбл, Алматы / Астана, штат 5–20** — у них
   100+ треков в год, проблема плагиата острая, бюджет на IP-защиту
   уже заложен. Готовы платить за Verified + Notarized пакетом.
   *Целевой ARPU: $300-500/мес.*
2. **Студия видеомонтажа / SMM-агентство** — обилие производимого
   контента, нужен пруф-of-creation для клиентов. Tier Verified в
   объёме.
   *Целевой ARPU: $100-200/мес.*
3. **Независимый автор-визитка** — фотограф, иллюстратор, писатель
   с уже накопленным портфолио. Подключается через выгрузку портфеля
   (bulk-cert), активно даёт референс-кейс.
   *Целевой ARPU: $20-50/мес, но мощный соцпруф.*

**Кого НЕ берём первым:**
- Госы / квази-госы — длинный цикл закупа.
- Крупные правообладатели (медиа-холдинги) — требуют SOC2/ISO,
  отдельного юр. трека, не для seed-стадии.
- Иностранцы без присутствия в РК — сначала RU/KZ, потом регион.

## 2. Sales playbook — первые 30 дней

### Неделя 1 — Pipeline build
- 50 outreach-писем по ICP-1 + ICP-2 (LinkedIn + email).
- 20 cold-calls в студии Алматы.
- Цель: 5 встреч.

### Неделя 2 — Discovery
- Демо 30 мин по сценарию `docs/demo/P3-1_INVESTOR_DEMO_SCRIPT.md` (адаптация
  под B2B: акцент на bulk-cert + API + dashboard).
- Дать **бесплатный пилот**: 10 сертификатов Verified + 1 Notarized.
- Цель: 2 пилота подписаны.

### Неделя 3 — Pilot execution
- Onboarding-звонок (45 мин) — пройти UI вместе.
- Создать org-аккаунт (`POST /api/bureau/org`).
- Пригласить 2-3 пользователей в команду.
- Выпустить первый платный cert по тест-карте.

### Неделя 4 — Conversion
- Замер: что использовали, какие фичи запросили.
- Конверсия в платный contract: $100/мес minimum + per-cert над лимитом.
- Цель: 1 paying customer + 1 case study.

## 3. Pricing — public-facing

> Полная экономика: `BUREAU_ECONOMICS.md` (internal only).

| Tier | Цена | Что входит |
|---|---:|---|
| **Free / Anonymous** | $0 | SHA-256 hash, Bitcoin timestamp, public verify URL |
| **Verified** | $19 | + KYC, реальное имя в сертификате |
| **Notarized** | $89 | + нотариальное удостоверение РК (валидно для суда EAEU) |
| **Filed (KZ)** | $299 | + подача в Казпатент через партнёра-поверенного |
| **Filed (PCT)** | $1499 | + WIPO international filing |
| **Org / B2B** | от $99/мес | bulk-cert API, team accounts, dashboard, SLA 24h |

**Скидки:** -20% при предоплате года · -30% для education / NGO · бесплатный
пилот (10 cert Verified + 1 Notarized) для первых 5 reference customers.

## 4. Pilot offer (готов к отправке)

```
Subject: Пилотный пакет AEVION Bureau — 10 сертификатов бесплатно

<Имя>, добрый день.

AEVION Digital IP Bureau ищет 5 первых reference customers в Казахстане.
Для <название студии> предлагаем:

— 10 сертификатов Verified ($190 ценность) бесплатно
— 1 нотариально удостоверенный сертификат ($89 ценность) бесплатно
— Onboarding-звонок 45 мин с инженером
— Account-аккаунт для всей команды

Взамен:
— Использование на реальном workflow в течение 4 недель
— Письменный отзыв (1-2 абзаца) для нашего сайта
— Опциональное упоминание в press-kit

Демо платформы: <unlisted YouTube link после записи P3-1>
Готов созвониться завтра в <time>.

—
<подпись>
```

## 5. Onboarding checklist (для customer success)

При подключении нового org-клиента:

- [ ] Создать org через `POST /api/bureau/org` с реальным юр-именем.
- [ ] Сгенерировать API-ключ для bulk-cert (если нужно).
- [ ] Залить логотип и брендинг для PDF-сертификатов.
- [ ] Пригласить 2-3 ключевых пользователей.
- [ ] Провести первый платный cert вместе на звонке.
- [ ] Выдать ссылку на dashboard `/bureau/dashboard`.
- [ ] Настроить notarization webhook (если включён Notarized).
- [ ] Записать в CRM: `<contact, mrr, contract_end, owner>`.
- [ ] Задать SLA-таймер: `success_call_at = signed_at + 7d`.
- [ ] Через 4 недели — replay звонок + запрос отзыва.

## 6. Существующие шаблоны писем

- **Нотариусу-партнёру:** [`NOTARY_PARTNERSHIP_LETTER_RU.md`](NOTARY_PARTNERSHIP_LETTER_RU.md)
- **Патентному поверенному:** [`PATENT_ATTORNEY_OUTREACH_RU.md`](PATENT_ATTORNEY_OUTREACH_RU.md)

Прежде чем отправлять — пройти юридическую вычитку и подставить актуальные
тарифы из таблицы выше.

## 7. KPI Reference Customer Phase

| Метрика | Цель Q3 | Источник |
|---|---:|---|
| Reference customers signed | 5 | CRM |
| Pilots converted to paid | 60% | CRM |
| Average MRR per ref-customer | $200 | Stripe |
| Case studies published | 3 | Blog |
| Inbound leads from referrals | 10 | CRM tag `referral` |

## 8. Что доделать после первого закрытого клиента

- Опубликовать публичную страницу `aevion.app/case-studies/<customer>`.
- Добавить логотип customer'а на главную (с разрешения).
- Записать видео-интервью 3-5 мин (опционально).
- Использовать quote в pitch deck (slide 12 «Traction»).
