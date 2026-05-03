# HealthAI v3 — Personal AI Doctor (production-ready, 18 commits)

## Summary

Новый продукт AEVION: персональный AI-помощник по здоровью. От rule-based
MVP вырос в полнофункциональную health-platform: family profiles, screeners
(PHQ-9 + GAD-7), персонализированный план, цикл-трекер, population averages,
referral-сеть, web notifications, mobile-first UI, hybrid Postgres
persistence. **Disclaimer-first design**, никаких диагнозов, на urgency=urgent
сразу — emergency line.

## Что внутри (18 commits)

### v1 — MVP (2026-04-29)

- `7485fcc` **Personal AI Doctor v1** — profile, symptom check, daily log,
  trends. 10 rule-matchers (RU+EN), urgency self-care/consult/urgent, BMI
  classifier, SVG line chart, streak counter, in-memory ledger, 5-tab UI.

### v2 — Wellness intelligence

- `0f25d14` **Risk indicators** — 7 правил (BMI obese/overweight/underweight,
  sleep-deficit avg7d, mood-low avg7d, weight-trend ±3kg/30d, tracking-gap,
  recent-urgent). Severity-tinted cards в Trends.
- `5c1a3b2` **i18n RU/EN** — STR dictionary ~50 keys с {n}/{c}/{l}/{d}
  плейсхолдерами, locale toggle pill в header, persist в localStorage,
  detectLocale() из navigator.language.
- `140c675` **Wearables stub** — POST /import bulk-upsert. Profile-tab
  Apple Health / Google Fit demo buttons (7d realistic data).
- `9e46161` **LLM-augmented advice** — POST /check-llm Anthropic Claude Haiku
  4.5 + 6 safety guardrails (no diagnosis, no meds, urgent → скорая, ru/en).

### v2.1 — Persistence + clinical layer

- `ce5e2f1` **Hybrid Prisma store** — HealthProfile / SymptomCheck /
  HealthDailyLog Prisma models (cascade-delete, unique by date). store{}
  adapter с lazy ensureDb() — Prisma если DATABASE_URL+findFirst OK, иначе
  in-memory fallback. /health показывает persistence type.
- `afc6a22` **Doctor report** — GET /export/:id JSON dump,
  /healthai/report?id= print-friendly страница с @media print + window.print().
- `0732c87` **PHQ-9 mental health screener** — стандартизированная 9-вопросная
  шкала (0-3 каждый, score 0-27, 5 severity-уровней), critical suicideFlag
  при Q9>0 + hotline numbers (РФ 8-800-2000-122 / KZ 150 / US 988).

### v2.2 — Plan + parity

- `65fd178` **GAD-7 anxiety screener** — partner к PHQ-9. POST /screener/gad7
  (7 вопросов 0-3, score 0-21, severity minimal/mild/moderate/severe).
- `b908daa` **Plan-builder** — GET /plan/:id rule-based weekly plan на основе
  профиля + recent logs + screener-результатов. Учитывает BMI, sleep, mood,
  age, conditions (diabetes/hypertension), allergies. 7-й tab «Plan».
- `654890f` **LLM provider fallback** — /check-llm chain Anthropic →
  OpenAI → Gemini. 503 если ни один не настроен, 502 если все упали.

### v3 — Auth, family, cycle, plan history

- `778fac2` **Auth integration + family profiles** — `lib/authJwt`
  verifyBearerOptional. POST /profile принимает Authorization Bearer и
  привязывает к userId. GET /profiles/me возвращает все профили семьи.
  DELETE /profile/:id с ownership check. UI Family-Card: switch / delete /
  add member с memberLabel, BMI per-member.
- `3e205de` **Cycle tracker** — POST /cycle (period log с flow), GET /cycle
  (avg length last 3 cycles, predictions). 8-й tab «Cycle» только для
  sex='F'. Flow buttons spotting/light/medium/heavy, symptoms, notes.
- `7119a38` **Plan history snapshots** — auto-save при каждой генерации /plan.
  GET /plan/history/:profileId (last 30) + GET /plan/snapshot/:id. UI
  «История планов» в Plan-табе с timestamp / BMI / goalsCount / «Открыть».
- `9147dea` **Population averages** — GET /population/:profileId сравнение
  self vs population (sleep / mood / BMI / exercise) за 7d. Если выборка <5
  — глобальный baseline. UI per-metric карточки в Trends-табе с tone
  (better/below/avg).
- `81d09ae` **Mobile responsive polish** — viewport meta (themeColor=#070b14),
  inline @media (max-width: 720px), tabs flex-nowrap + horizontal scroll,
  компактнее padding и h1 на маленьких экранах.
- `92e54fa` **Web notifications** — Browser Notifications API opt-in card в
  Log-табе. Запрос permission, persist в localStorage, daily reminder в
  21:00 если нет лога за сегодня (idempotent через 'shown'=today).
- `347b876` **Doctor referral** — GET /referrals?country&specialty&emergency=1
  каталог из 7 партнёров (RU/KZ/US emergency lines + AEVION Telehealth).
  ReferralCard auto-show emergency-mode когда matched.urgency='urgent';
  pre-filtered psychiatry когда PHQ-9 suicideFlag=true. tel:- и https-links.

## Backend route map (`/api/healthai/*`)

| Route | Method | Что делает |
|-------|--------|-----------|
| `/health` | GET | service status + persistence type |
| `/profile` | POST | upsert (Bearer-aware) |
| `/profiles/me` | GET | family profiles for current user |
| `/profile/:id` | GET / DELETE | get with BMI / delete with ownership |
| `/check` | POST | rule-based symptom triage |
| `/check-llm` | POST | LLM chain Anthropic → OpenAI → Gemini |
| `/log` | POST | daily wellness, idempotent by date |
| `/history/:id` | GET | last 20 checks + 90 logs |
| `/trends/:id` | GET | 7d/30d avg + series + streak |
| `/risks/:id` | GET | 7-rule risk indicators |
| `/import` | POST | wearables bulk upsert |
| `/cycle` | POST | period log |
| `/cycle/:profileId` | GET | cycle entries + avg + predictions |
| `/screener/phq9` | POST / GET | PHQ-9 depression |
| `/screener/gad7` | POST / GET | GAD-7 anxiety |
| `/plan/:profileId` | GET | rule-based weekly plan + auto-snapshot |
| `/plan/history/:profileId` | GET | last 30 snapshots |
| `/plan/snapshot/:id` | GET | full snapshot |
| `/population/:profileId` | GET | self vs population averages |
| `/referrals` | GET | doctor referral directory |
| `/export/:id` | GET | full JSON dump for doctor |
| `/leaderboard` | GET | wellness streaks |

## Frontend (`/healthai`, ~3700 строк self-contained)

8 tabs: Profile / Check / Log / Trends / History / Screener / Plan / Cycle
(cycle только для F users).

- Family Card на Profile-tab (когда залогинен): switch/add/delete profile с
  member labels (Я / Партнёр / Ребёнок / ...).
- Symptom check: rule-based + опц. Claude Haiku 4.5 deeper analysis.
- Trends: 5 stat-cards 7d + 30d SVG chart + Risk indicators + 🌍 Population
  comparison (self vs avg).
- Plan: 7 секций (goals / routine / exercise / nutrition / habits / mental /
  rationale) + История планов с recall.
- Screener: PHQ-9 + GAD-7 в одном табе, color-coded severity, hotlines,
  emergency referral если suicideFlag.
- Cycle (F): flow buttons + symptoms + avg length + next prediction.
- Mobile-first: tabs scroll horizontally, viewport meta, themeColor matching.

LocalStorage:
- `aevion:healthai:profileId` — текущий активный профиль
- `aevion:healthai:tab` — последний открытый таб
- `aevion:healthai:notif` — opt-in для daily reminder
- `aevion:locale` — RU/EN
- `aevion:auth:token` — JWT (для family flow)

## Prisma schema (5 моделей)

- `HealthProfile` (userId, memberLabel, age, sex, height, weight,
  conditions[], allergies[], medications[])
- `SymptomCheck` (cascade)
- `HealthDailyLog` (cascade, unique by date)
- `CycleEntry` (cascade, unique by date)
- `PlanSnapshot` (cascade, plan: Json, bmi/avgSleep7d/avgMood7d for diff)

## Test plan

- [ ] **Profile**: создать профиль (без auth), BMI рассчитан корректно
- [ ] **Family**: залогиниться → создать 2 family profiles → switch → delete
- [ ] **Symptom check**: «headache, fatigue» → 2 cards с разными urgency
- [ ] **Symptom check urgent**: «chest pain» → red border + auto-show
      ReferralCard with emergency lines (call links)
- [ ] **LLM check**: фиолетовая кнопка → Claude Haiku response
      (или 503 если ENV не настроен)
- [ ] **Daily log**: ввести → toast → Trends обновился
- [ ] **Trends**: line chart, risks, **population avg** карточки
- [ ] **PHQ-9**: 9 ответов → severity color + hotlines
- [ ] **PHQ-9 Q9>0**: → suicide warning + ReferralCard psychiatry-filtered
- [ ] **GAD-7**: 7 ответов → severity color
- [ ] **Plan**: первое открытие — auto-generate; «История планов» появилась
      и с пометкой «Текущий»; regenerate → новая запись в истории
- [ ] **Plan recall**: open старый snapshot → план меняется
- [ ] **Cycle (F)**: log period → recent days → avg length после 2+ циклов
- [ ] **Notifications**: Log-tab → Enable → permission grant → Test now →
      браузерное уведомление
- [ ] **Mobile**: viewport 375px — tabs scrollable, h1 22px, contained pad
- [ ] **i18n**: RU pill → весь UI на русский, persist после reload
- [ ] **Doctor report**: Profile-tab → Print → новое окно print-ready;
      JSON → download
- [ ] **Wearables stub**: Apple Health → 7d сгенерированы → Trends обновился

## Build status

- `tsc --noEmit` backend и frontend — оба зелёные ✅
- `npm run build` — pending в окружении PR (CI должен проверить)

## Persistence

- **In-memory** mode по умолчанию (без `DATABASE_URL`) — все данные сбросятся
  при рестарте сервера, для demo/dev.
- **Postgres** mode — задайте `DATABASE_URL` + `npx prisma migrate dev
  --name healthai_v3` → автоматический switch.

## Env vars

Optional:
- `ANTHROPIC_API_KEY` — для /check-llm Claude Haiku
- `OPENAI_API_KEY` — fallback OpenAI gpt-4o-mini
- `GEMINI_API_KEY` — fallback Gemini
- `DATABASE_URL` — Postgres for hybrid persistence
- `JWT_SECRET` — для /api/auth integration

## v4 backlog

- Real wearables OAuth (Apple HealthKit / Google Fit Rest API)
- Doctor referral booking интеграция (за пределы каталога)
- Plan diff visualizer (compare два snapshot side-by-side)
- Cycle phase-aware plan adjustments (luteal/follicular/ovulation tweaks)
- Doctor portal (отдельная роль для просмотра family profiles)
- Mobile app (React Native / Capacitor) с native wearables sync
- Real-time WebSocket coach (LLM-augmented daily checkin)
- Population averages по age/sex bucket (точнее чем global)
- Period/PMS tracking integration в plan-builder для F users

🤖 Generated with [Claude Code](https://claude.com/claude-code)
