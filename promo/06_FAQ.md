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

**Ответ:** Это **главный** аргумент в пользу advisor-seat в структуре сделки.

- 24-месячный retention в роли Senior Advisor — основной механизм сохранения continuity.
- Документация архитектуры: каждый модуль имеет `CLAUDE.md` + OpenAPI + README + health-endpoint. Параллельные сессии (см. `AEVION_COORDINATION.md`) показывают, что система спроектирована под **multi-operator workflow**, не bus-factor-1.
- Code base сейчас self-documenting — registry + transparency board открыты для покупателя.

**KPI retention bonus** ($200M, T+12 мес) — прямо привязан к prod-uptime ≥ 99.5% по 30+ модулям, **что мотивирует основателя оставаться involved**.

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
| AEV treasury holdings основателя | Личная доля сохраняется, vesting по retention-графику |

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

**После acquisition:** покупатель наследует Constitution. **Изменение требует Advisor veto** в течение 24 мес (см. `02_DEAL_TERMS.md` §3).

---

## 10. «Worst-case scenario для покупателя — что сломается за первый год?»

**Ответ:** Прямой список рисков, без замазывания.

| Риск | Вероятность | Митигация |
|------|-------------|------------|
| AI-провайдер (OpenAI/Anthropic) меняет pricing → QCoreAI margin сжимается | средняя | 5+ провайдеров в роутере, можем перебалансировать; per-token margin сохраняется ≥10% даже при pessimistic-pricing |
| Регулятор объявляет AEV security | низкая | Internal-token classification, legal opinion подготовлен; готовность переструктурировать в gift-card-like utility token без потери UX |
| Один из консьюмерских продуктов (CyberChess/HealthAI) выходит из активного развития | средняя | Они не revenue drivers (см. `05_FINANCIAL_APPENDIX.md`), они proof-of-execution. Withdrawal acceptable |
| DevHub integration partner (GitHub/Vercel/Cloudflare) ограничивает API-доступ | низкая | Стандартные partner-terms; redundancy между похожими провайдерами (Vercel ↔ Cloudflare Pages, Brevo ↔ SendGrid) |
| Key-person leaves before retention vest | низкая | Vesting + bonus structure economically aligns. Документация архитектуры — public + private |
| Litigation по AI-content attestation (Planet) | низкая | DMCA-safe-harbour structure, content policy готов (см. §5) |
| Утечка ключей подписи QSign | низкая | ML-DSA-65 не симметричный, rotation procedure встроена; QShield для критических секретов |

**Самый честный ответ:** AEVION — pre-revenue платформа с breadth. Главный риск — **исполнение коммерциализации**. Это **тот самый риск, который покупатель уровня Stripe/Microsoft закрывает лучше нас**. Это **аргумент в пользу сделки**, не против.

---

## 11. «Сколько это стоит и какой чек нужен прямо сейчас?» (особенно для платформенного партнёра уровня Anthropic)

**Ответ:** Не нужен большой чек. Для платформенного партнёра сделка **не начинается с перевода на миллиард** — есть несколько дверей, и первые почти не стоят кэша, потому что платите тем, чего у вас в избытке (компьют, инженеры, дистрибуция, бренд):

| Вариант | Что вносите | Что получаете | Кэш сейчас |
|---|---|---|---|
| **V0 · Showcase & Credits** | компьют-кредиты + бренд «первая планета на Claude» | флагманский кейс, рука на пульсе | ≈ $0 |
| **V1 · Малая доля 1–10%** | $10.5M–$105M по оценке ~$1.05B, транши под майлстоуны | де-рискованная экспозиция, без операционной нагрузки | малый |
| **V2 · Planet Co-Build ⭐** | команда + ресурсы (+ умеренный кэш) → контроль 80–90% | владение категорией; основатель 10–20% с вестингом, остаётся Chief Idea Officer | умеренный |
| **V3 · Полный выкуп** | $1B за 95% | весь двигатель, основатель → Senior Advisor | большой (последняя дверь) |

**Headline-оффер (то, что кладём на стол первым):** основатель хочет **$10M сейчас — как возвратный аванс**, сохраняет **35%** AEVION; Anthropic + партнёры берут **контроль 65%**, оплачивая в основном ресурсами. **$10M возвращаются** из дохода, когда проект достигает **$100M** (выручка/оценка). То есть это **инвестиция Anthropic, которая к ним и вернётся**; основатель привязан к апсайду своих 35%.

**Ключевой принцип, снимающий страх:** основатель **просит мало на старте** и **возвратно**; платит много **только за реальный успех**; платите ресурсами, не капиталом. Триллион — это **траектория** будущей капитализации, не цена входа: доли считаются от сегодняшней скромной оценки, а рост достаётся в основном контролирующей стороне. «35%» = доля в капитале (а значит и в капитализации/доходе); «$100M» = майлстоун-триггер возврата аванса.

**Токен AEV** на время сделки с pre-IPO-партнёром **выносится из периметра**, чтобы не создавать регуляторного риска на cap-table.

Полные структуры и фазы — `promo/25_ANTHROPIC_DEAL_VARIANTS.md`; печатная одностраничка — `aevion.app/acquire/ways`.

---

— редакция 2026-05-22 (обновлено 2026-06-06: §11 деньги для платформенного партнёра), AEVION
