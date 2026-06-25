# FAQ — десять тяжёлых вопросов покупателя

> Не маркетинг. Те вопросы, которые на 9-й минуте встречи задаёт юрист или CFO покупателя, и ради которых сделка либо состоится, либо умрёт.
> Ответы — короткие, прямые, без оправданий.

---

## 1. «AEV — это security? Это деньги? Что это юридически?»

**Ответ:** AEV — **internal accounting unit**, не security и не электронные деньги по EMD2/EMI-classification.

- Не торгуется на открытом exchange.
- Не привязан к коммерческому доходу AEVION (нет dividend-like rights, нет equity-like claims).
- Не имеет fixed peg к фиату (cap 21M зафиксирован в **единицах**, не в долларах).
- Используется как **расчётная единица между модулями платформы** — аналог in-app currency, но с открытым ledger.

**Регуляторно:** ближе всего к Singapore PSO «digital payment token» с **non-payment** характером (utility token внутри замкнутой платформы). Под US Howey — не security (нет common enterprise expectation of profit derived from efforts of others — единственный источник «дохода» AEV-holder это **использовать AEV для услуг платформы**, не пассивный доход).

**Под NDA:** memo от внешнего юриста (готовится на DD-этапе) с opinion-letter по US/EU/SG/RK классификации.

---

## 2. «Что с US-санкциями? Основатель — резидент Казахстана.»

**Ответ:** Юрисдикция компании — США-инкорпорированная Delaware C-Corp (либо DIFC, в зависимости от outcome раунда). Основатель — гражданин РК, не подпадает под US OFAC SDN.

- AEVION как entity не имеет операций в санкционных юрисдикциях.
- KYC проводится на стороне QPayNet через Stripe / лицензированных партнёров — фильтры OFAC и EU sanctions встроены в pipeline.
- Готовы пройти sanctions/AML due diligence у покупателя в течение DD-окна.

**Под NDA:** sanctions screening report от провайдера (Refinitiv/Comply Advantage) по основателю и core-team.

---

## 3. «Key-person risk. Если основатель уйдёт, что останется?»

**Ответ:** Это **главный** аргумент в пользу того, что сделка — **партнёрство**, а не выкуп.

- Основатель **не уходит**: он остаётся **Chief Idea Officer** — автором и двигателем следующих идей, с мажоритарной долей (51% дохода проекта). Это и есть механизм continuity.
- Документация архитектуры: каждый модуль имеет `CLAUDE.md` + OpenAPI + README + health-endpoint. Параллельные сессии (см. `AEVION_COORDINATION.md`) показывают, что система спроектирована под **multi-operator workflow**, не bus-factor-1.
- Code base сейчас self-documenting — registry + transparency board открыты для партнёра.

Партнёр платит в основном ресурсами + возвратным авансом $10M; апсайд основателя = его 51% дохода растущего проекта. **Экономика выровнена так, что основателю выгодно оставаться двигателем** — именно поэтому он остаётся, а не выкупается.

---

## 4. «Где defensibility от Stripe / Microsoft / Google, если они захотят это построить?»

**Ответ:** Composition, не отдельный продукт.

- **Stripe** имеет финансовый слой. Не имеет IP-attestation, не имеет dev-agent-layer, не имеет consumer-витрин.
- **Microsoft** имеет GitHub. Не имеет расчётной единицы, не имеет payments rail, не имеет consumer-витрин.
- **Google** имеет AI + cloud. Не имеет regulated financial infra, не имеет IP-registry, не имеет stand-alone consumer products в smaller-screen markets.

Чтобы построить **в комплексе**, любому из них нужно 36-48 месяцев + регуляторное прохождение по каждому из пяти столпов + сборка 30+ surfaces. **За это время AEVION станет defacto-стандартом в сегменте multi-pillar платформ.**

Купить дешевле, чем построить — стандартный M&A-расчёт по PV-difference между «build vs buy».

---

## 5. «AI-content moderation. Что если кто-то загрузит на Planet нелегальный артефакт?»

**Ответ:** Planet — **attestation registry**, не hosting platform.

- Артефакт сам **не** хранится в Planet — хранятся **подпись + hash + envelope + validator decisions** (см. коммит `1cacd5a1` — Constitution в Planet через QSign envelope).
- Контент-модерация — на стороне создателя (его storage) либо downstream-потребителя.
- Validators (см. структуру `Validator` в `/planet/page.tsx`) могут отметить артефакт `flagged` или `rejected` с `publicExplanation` — это публичный механизм flagging.
- **Юридический режим** аналогичен DMCA-safe-harbour для UGC-платформ: AEVION выступает intermediary, не publisher.

**Под NDA:** internal content policy + DMCA-process документация.

---

## 6. «IP carve-outs — что именно основатель забирает с собой?»

**Ответ:** Только то, что **не было** частью AEVION с самого начала.

| Артефакт | Кому |
|----------|------|
| Курс `smeta-rk-kurs/` (Smeta РК-обучение) | Основателю; **licence-back на бессрочное использование внутри AEVION** |
| Личные эссе / неопубликованные дневники / записи | Основателю |
| Личные репозитории (не помеченные AEVION) | Основателю |
| Шахматные курсы (Chessy / Coach knowledge entries, **которые написаны лично основателем**) | Основателю |
| Всё в `aevion-core/` и связанных worktrees | Покупателю |
| Domain `aevion.app` + связанные | Покупателю |
| AEV treasury holdings основателя | Токен AEV вынесен из периметра сделки (ring-fenced); личная доля основателя сохраняется |

**Готовы зафиксировать в SPA построчно.** Список окончательный — не «расширим в будущем».

---

## 7. «Cap table — кто ещё имеет equity?»

**Ответ:** Раскрывается под NDA.

**Что можно сказать без NDA:**
- Основатель сохраняет **majority** в pre-acquisition cap table.
- Нет институциональных инвесторов с veto-rights по сделке.
- Нет SAFE/convertible notes с unresolved conversion triggers.
- Core team — на equity-pool (≤15%).

**Под NDA:** полная капитализация + waterfall analysis по предложенной цене.

---

## 8. «Revenue сегодня — почему нет MRR?»

**Ответ:** Pre-revenue в большинстве линий **по сознательному выбору**.

- Приоритет последних 18 месяцев — **shipping breadth** (30+ модулей в проде).
- Монетизация в части модулей включена (CyberChess Premium 500/5000 AEV tiers, QPayNet KYC через процессинговые рельсы (Stripe / Adyen / local processors), QBuild ATS pilot-deals).
- **Revenue acceleration зависит от capital-injection и distribution-leverage** — именно того, что приходит со сделкой с стратегическим покупателем.
- Mid-case proj $1.6B ARR к 2030 — см. `05_FINANCIAL_APPENDIX.md`.

**Под NDA:** revenue cohorts, pilot-customer references, conversion-данные CyberChess Premium.

---

## 9. «Constitution v1 — это binding legal document или маркетинг?»

**Ответ:** Hybrid — **operationally binding inside the platform, advisory externally**.

- **Внутри платформы:** изменения core-params (AEV cap, validator rules, fee-structure) проходят через Constitution-amendment-procedure (см. `/constitution` страница, три языка RU/EN/KK).
- **Подписано через QSign envelope** (commit `1cacd5a1`) — криптографически верифицируется, аттестовано в Planet.
- **Externally:** документ описывает обязательства платформы перед пользователями (privacy, AEV cap дисциплина, не-mergeable бренд). Это часть terms-of-service, юридически связывает компанию AEVION.

**В партнёрстве:** партнёр и основатель совместно владеют Constitution. **Изменение core-params требует письменного согласия основателя** как Chief Idea Officer (см. `02_DEAL_TERMS.md`).

---

## 10. «Worst-case scenario для покупателя — что сломается за первый год?»

**Ответ:** Прямой список рисков, без замазывания.

| Риск | Вероятность | Митигация |
|------|-------------|------------|
| AI-провайдер (OpenAI/Anthropic) меняет pricing → QCoreAI margin сжимается | средняя | 5+ провайдеров в роутере, можем перебалансировать; per-token margin сохраняется ≥10% даже при pessimistic-pricing |
| Регулятор объявляет AEV security | низкая | Internal-token classification, legal opinion подготовлен; готовность переструктурировать в gift-card-like utility token без потери UX |
| Один из консьюмерских продуктов (CyberChess/HealthAI) выходит из активного развития | средняя | Они не revenue drivers (см. `05_FINANCIAL_APPENDIX.md`), они proof-of-execution. Withdrawal acceptable |
| DevHub integration partner (GitHub/Vercel/Cloudflare) ограничивает API-доступ | низкая | Стандартные partner-terms; redundancy между похожими провайдерами (Vercel ↔ Cloudflare Pages, Brevo ↔ SendGrid) |
| Key-person risk (основатель отвлекается) | низкая | Партнёрство удерживает основателя как Chief Idea Officer с мажоритарной долей (51% дохода) + возвратный аванс освобождает его под фул-тайм на AEVION. Документация архитектуры — public + private |
| Litigation по AI-content attestation (Planet) | низкая | DMCA-safe-harbour structure, content policy готов (см. §5) |
| Утечка ключей подписи QSign | низкая | ML-DSA-65 не симметричный, rotation procedure встроена; QShield для критических секретов |

**Самый честный ответ:** AEVION — pre-revenue платформа с breadth. Главный риск — **исполнение коммерциализации**. Это **тот самый риск, который покупатель уровня Stripe/Microsoft закрывает лучше нас**. Это **аргумент в пользу сделки**, не против.

---

## 11. «Сколько это стоит и какой чек нужен прямо сейчас?» (особенно для платформенного партнёра уровня Anthropic)

**Ответ:** Не нужен большой чек, и предложение **одно** — это **партнёрство, а не выкуп**. Сделка **не начинается с перевода на миллиард**: партнёр платит в основном тем, чего у него в избытке (compute, инженеры, дистрибуция, бренд), плюс небольшой **возвратный аванс**.

- **$10M возвратным авансом** основателю — не выплата-состояние, а бридж. Смысл: освободить основателя от текущих компаний и работы по найму, чтобы он фул-тайм занимался идеями AEVION. **$10M возвращаются** партнёру из доли основателя по мере роста проекта. То есть это **инвестиция партнёра, которая к нему и вернётся**.
- **Доход проекта делится 51% основатель / 49% партнёр** — стартовая рамка, конкретные доли обсуждаются дальше.
- Основатель остаётся **Chief Idea Officer** — автором и двигателем следующих идей, с мажоритарной долей.
- **Токен AEV** на время сделки с pre-IPO-партнёром **выносится из периметра (ring-fenced)**, чтобы не создавать регуляторного риска на cap-table.

**«А если мы захотим просто выкупить проект целиком?»** Выкупа как опции нет. Ценность AEVION — не код (копируется), а человек, который произвёл 30+ модулей за полгода и произведёт следующие 30. Выкупить актив и потерять его источник — иррационально. Поэтому предложение — партнёрство, в котором основатель остаётся двигателем.

**«Почему вы не просите оценку и долю Anthropic за фиксированную цену?»** Потому что это партнёрство, а не покупка доли. Цены за процент нет: партнёр входит ресурсами + возвратным авансом, а апсайд от роста делится 51/49. Триллион — это **траектория** будущей капитализации, не цена входа; рост достаётся обеим сторонам по факту.

Полное единое предложение — `promo/25_ANTHROPIC_DEAL_VARIANTS.md` и `promo/02_DEAL_TERMS.md`.

---

— редакция 2026-05-22 (обновлено 2026-06-06: §11 деньги для платформенного партнёра), AEVION
