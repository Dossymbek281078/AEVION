# Live-демо AEVION — 18-минутный сценарий

> Что и в каком порядке показывать в живой встрече с покупателем.
> Никаких слайдов в первые 10 минут — только живой клик по проду.

---

## 0:00–0:30 — Открытие

Не «нашу компанию основали в году N». Сразу:

> «Сейчас я открою пятнадцать вкладок, которые держит средний инди-стартап. Потом — одну.»

Открыть в браузере: GitHub, Vercel, Railway, Cloudflare, ElevenLabs, DALL-E, Brevo, Stripe, Drive, Notion, DeepL, Sentry, Namecheap, Mixpanel, Linear.

15 вкладок. Тишина 3 секунды.

---

## 0:30–2:00 — AEVION DevHub

Закрыть 15 вкладок. Открыть `https://aevion.app/devhub`.

Показать:

1. Один логин.
2. Список 9 интеграций live.
3. **Сделать live-операцию:**
   - Кликнуть «Deploy» → Vercel-deployment запускается.
   - Параллельно «Send campaign» → Brevo шлёт.
   - Параллельно «Generate voiceover» → ElevenLabs.
   - На экране — три зелёные галочки за 20 секунд.
4. Открыть `/api/devhub/usage` — счётчик AEV-биллинга в реальном времени.

Сказать:

> «Это не лендинг. Это `aevion-globus-backend/src/routes/devhub.ts` с 23 проходящими тестами и 9 интеграциями в проде.»

---

## 2:00–4:00 — AEV (расчётная единица)

Открыть `https://aevion.app/aev` (или /pay).

Показать:

1. Cap supply 21 000 000, выпущено: текущее число.
2. Ledger — последние 10 транзакций.
3. Открыть `/api/aev/balance/{accountId}` — JSON ответ.
4. Перевести 100 AEV с одного счёта на другой → подтверждение.
5. Открыть `aevion-globus-backend/src/routes/aev.ts` — 6 endpoints.

Сказать:

> «AEV — это расчётная единица между всеми тридцатью модулями. Cap зафиксирован, ledger в Postgres, не в blockchain — потому что для расчётной единицы внутри платформы blockchain избыточен, а доверие держится на open-ledger и open-source.»

---

## 4:00–5:30 — QSign (post-quantum signatures)

Открыть `https://aevion.app/qsign-v2` (или developer page).

Показать:

1. Подписать тестовый документ ML-DSA-65 Dilithium через UI.
2. Открыть `/api/qsign/v2/sign` → ответ с подписью.
3. Сказать, что это FIPS 204 GA — конкуренты ещё в proposal.
4. Открыть npm — `@dosymbek/qsign-v2` published.

> «Это уже выкаченный пост-квантовый продукт. У большинства peers — proposals и whitepapers.»

---

## 5:30–7:00 — QShield + QRight + Constitution

Открыть `https://aevion.app/constitution`.

1. Документ на RU/EN/KK с переключателем языка.
2. QSign envelope visible — нажать «verify» → зелёная галочка.
3. Перейти на `/planet` — реестр аттестаций.
4. Перейти на `/api/aevion/registry` — JSON всех 30+ модулей.

> «Constitution version 1 опубликован через QSign envelope и аттестован в Planet. Это правовой режим продукта — не правила в Notion.»

---

## 7:00–9:00 — Consumer proof: CyberChess

Открыть `https://aevion.app/cyberchess`.

1. Сыграть один ход против Stockfish 18 — показать что engine работает в браузере (COEP credentialless).
2. Открыть Coach tab → AEVION CPI (Chess Performance Index).
3. Объяснить: композитный рейтинг, **R² 0.48 после калибровки** — это **новый рейтинг**, лучше чем Elo + accuracy по отдельности.
4. Показать Premium gating (Free / Pro 500 AEV / Ultimate 5000 AEV) — биллинг идёт через QPayNet в AEV.

> «Это proof of execution. CyberChess — массовый продукт с retention. Доказывает, что слой работает.»

---

## 9:00–10:30 — HealthAI + Multichat

Быстро:

1. `https://aevion.app/healthai` — анкета → план.
2. `https://aevion.app/multichat` — multi-provider AI с handoff.
3. Сказать что таких consumer-витрин ещё 5+ (KidsAI, Smeta Trainer, MapReality, LifeBox, StartupX).

---

## 10:30–12:00 — Прозрачность

Открыть `https://aevion.app/transparency` и `https://aevion.app/launch-status`.

1. Daily smoke 24/24.
2. Health-board всех модулей.
3. `/api/aevion/stats` — coverage по health/openapi/frontend/og.

> «Мы публикуем health-board наружу. Покупатель проверит сам — не нужно нам верить.»

---

## 12:00–14:00 — Три макроволны (только теперь — слайды)

Открыть `/acquire` страницу или PDF deck.

1. Слайд: три круга — Banking → API, IP → on-chain, Dev → agent-layer.
2. Сказать: «Эти три волны сходятся в ближайшие 5-7 лет. AEVION уже стоит на пересечении.»
3. Слайд: TAM ($1.5-2T addressable к 2030).

---

## 14:00–16:00 — Comparable transactions

Слайд из `00_MASTER_PITCH.md` приложение A:

- Plaid (Visa, отменено) — $5.3B
- Microsoft × GitHub — $7.5B
- Stripe private mark — $50-95B
- Adobe × Figma (отменено) — $20B

> «AEVION = Plaid + GitHub + ранний Stripe + Figma + on-chain notary. $1B — нижняя граница, оптимизированная на быстрый closing.»

---

## 16:00–17:30 — Сделка

Слайд из `02_DEAL_TERMS.md`:

> **$1 000 000 000 USD net**
> 70% closing + 20% retention + 10% performance
> Senior Advisor on AEVION matters, 24 мес
> Бренд AEVION сохраняется
> AEV cap 21M неизменен
> Эксклюзивность 60 дней
> Юрисдикция: Делавэр / DIFC / Singapore

Пауза 3 секунды. Не оправдываться.

---

## 17:30–18:00 — Закрытие

> «Это floor. Если оценка приходит выше — мы выслушаем. Если LOI на этих условиях — подписываем в течение пяти рабочих дней.»

Не «спасибо за внимание». Не «надеемся на сотрудничество». Конец демо.

---

## Чек-лист «до встречи»

- [ ] `aevion.app/launch-status` зелёный.
- [ ] `aevion.app/transparency` обновлён.
- [ ] `aevion.app/constitution` грузится без ошибок.
- [ ] `aevion.app/devhub` — 9 интеграций видны.
- [ ] `aevion.app/cyberchess` — Stockfish загружается.
- [ ] `aevion.app/acquire` — открывается, видео играет.
- [ ] Браузер: тёмный режим, увеличен шрифт, лишние табы закрыты.
- [ ] Запасной интернет (мобайл-точка).
- [ ] Backup video на YouTube unlisted — если живой DevHub упадёт.

---

## Что **не** показывать

- Cap table — только под NDA после LOI.
- Финансовые прогнозы — это CFO покупателя сделает.
- Внутренние Slack/Discord — это шум, не сигнал.
- Roadmap фич, которые ещё не в проде.

---

— редакция 2026-05-22
