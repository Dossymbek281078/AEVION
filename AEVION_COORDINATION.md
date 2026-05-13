# Координация сессий (несколько чатов Cursor)

<!-- WIP-AUTO:BEGIN -->
<!-- regenerated 2026-05-12T13:28:02.979Z — empty window -->

### WIP — last 10 min activity

_No commits in the last 10 minutes. Updated 2026-05-12T13:28:02.979Z._

<!-- WIP-AUTO:END -->


Цель: **не дублировать работу**, **не тратить токены и время** на одно и то же, выпускать версии **максимально работоспособными** (проверяемый минимум перед «готово»).

---

## 🔴 ГЛОБАЛЬНЫЕ ПРАВИЛА — действуют для ВСЕХ сессий, всех окон, всех проектов AEVION

> Введены 2026-05-12 пользователем. Обязательны без исключений.

### Правило 1 — Не делать работу, которая уже делается в параллельной сессии

**Что это значит:**
- Перед началом любой задачи — прочитай секцию **WIP (Текущая работа)** в этом файле
- Если задача уже занята другой сессией — **не начинай** её, даже если кажется что «быстро допишу»
- Параллельная работа над одним файлом = конфликты в git = потеря часов работы

**Что делать вместо этого:**
1. Открой этот файл: `C:\Users\user\aevion-core\AEVION_COORDINATION.md`
2. Найди секцию **WIP**
3. Если задача занята — **автоматически предложи пользователю 3 альтернативы** из свободных зон
4. Пример: *«QMedia занят в aevion-build. Предлагаю: A) QCoreAI новые фичи B) DevHub деплой C) QAI стриминг — что выбрать?»*

---

### Правило 2 — Никогда не переходить с одного проекта на другой без уведомления

**Что это значит:**
- Каждое окно/сессия открыто для конкретного проекта или модуля
- Даже если пользователь сказал «вперёд» или «продолжаем» — это НЕ разрешение сменить проект

**Обязательный протокол смены проекта (3 шага):**

```
ШАГ 1 — ОБЪЯВИ:
"Этот чат работал над [ТЕКУЩИЙ ПРОЕКТ].
Вижу что нужно переключиться на [НОВЫЙ ПРОЕКТ].
Переключаюсь?"

ШАГ 2 — ЖДИ явного ОК:
✅ Засчитывается: "да", "ок", "переключайся", "давай"
❌ НЕ засчитывается: "вперёд", "продолжаем", молчание

ШАГ 3 — ПОСЛЕ ОК:
- Обнови секцию WIP в этом файле
- Запиши что предыдущий проект оставлен на каком шаге
- Начинай новый проект
```

---

### Правило 3 — Показывать шаги подробно на русском языке

**Что это значит:**
- Перед каждым блоком работы — написать по-русски что именно будет сделано
- Формат объяснения:

```
ЧТО ДЕЛАЕМ: [1-2 предложения — суть задачи]

ШАГИ:
1. [конкретный шаг — что именно создаём/меняем]
2. [следующий шаг]
3. ...

ПОЧЕМУ ТАК: [кратко — зачем этот подход, а не другой]

РЕЗУЛЬТАТ: [что получится в итоге]
```

- После завершения — краткий итог: что сделано, что изменилось, что дальше

---

### Правило 4 — Никогда не использовать `git add -A` или `git add .`

**Что это значит:**
- Эти команды добавляют ВСЕ изменения, включая чужие файлы которые случайно оказались в worktree
- 2026-05-12 это уничтожило 2032 строки работы двух параллельных сессий

**Правильный способ коммитить:**
```bash
# ✅ ПРАВИЛЬНО — только конкретные файлы
git add aevion-globus-backend/src/routes/qcoreai.ts
git add frontend/src/app/qcoreai/multi/page.tsx
git commit -m "feat(qcoreai): описание изменения"

# ❌ НИКОГДА не делать
git add -A
git add .
git commit -a
```

---

### Правило 5 — Автоматически предлагать альтернативы

**Когда пользователь просит сделать что-то занятое:**
Не говори просто «это занято». Сразу предложи конкретные альтернативы:

```
Формат ответа:
"[НАЗВАНИЕ] сейчас занят в [СЕССИЯ/ОКНО].

Вместо этого могу:
A) [конкретная альтернатива — что именно сделаю]
B) [другой вариант]  
C) [третий вариант]

Что выбираем?"
```

---

### Правило 6 — Каждый блок и сессия заканчивается секцией «Что дальше»

**Что это значит:**
- В конце КАЖДОГО блока работы (после commit/push/type-check) и КАЖДОЙ сессии финальное сообщение ДОЛЖНО содержать секцию «Что дальше» с конкретными предложениями
- Не вагуэ «продолжаю работу», не «жду команды» в одиночку
- Минимум 2, обычно 3-4 варианта

**Why:**
- 2026-05-12 пользователь явно зафиксировал: «просто так ни один блок и сессия не должны заканчиваться, в конце всегда четко должно быть что делаем дальше, предложения, это правило, тоже надо записать»
- Без этого пользователь должен каждый раз ОБЯЗАТЕЛЬНО формулировать следующую задачу — это лишняя cognitive нагрузка
- В autonomous-loop режиме `/loop` без «Что дальше» loop останавливается на каждом блоке

**Обязательный формат:**

```markdown
**Что дальше — варианты:**

| # | Блок | Зона / файл | Риск конфликта | Импакт |
|---|------|-------------|----------------|--------|
| 1 | <конкретная задача> | <путь> | ✅ нулевой / ⚠️ возможен / 🔴 high | low/med/high |
| 2 | … | … | … | … |
| 3 | … | … | … | … |
```

**Каждый вариант:**
- Конкретная изолированная задача (имя файла/фичи, не «ещё одна страница»)
- Зона явно указана (понять, не пересечётся ли с параллельной сессией)
- Risk-индикатор: ✅ / ⚠️ / 🔴
- Импакт: насколько двигает продукт вперёд

**Если автономный режим** — после таблицы:
- Назвать default-выбор («если автономно → беру #2»)
- Schedule wakeup с конкретным `reason` указывающим на выбранный блок

**Если ручной режим** — открытый вопрос «выбирай или скажи свой».

**Acknowledgment token:** `RULE-PROPOSE-NEXT-2026-05-12-read` в commit body.

---

## 🔴 WIP — ТЕКУЩАЯ АКТИВНАЯ РАБОТА (обновляется каждые 5 минут)

> ⚠️ Перед началом любой задачи — прочитай этот раздел. Если файл/модуль уже в чьём-то WIP — НЕ БЕРИ. Запись протухает через 10 минут — если сессия не обновила WIP, значит она закончила или упала.

| Сессия | Модуль / файл | Что делается | Обновлено |
|--------|--------------|--------------|-----------|
| _free_ | — | блок 2 завершён, см. ниже | 2026-05-13 block-2 done |

### Завершено 2026-05-13 (parallel block 2)

- ✅ **MVP-семейка-2** (`aevion-core/main`) — 1 commit + push: MvpConceptBoard wired в voice-of-earth/mapreality/startup-exchange/kids-ai-content (закрыта семейка 10/10). SHA: `119a1ea1`.
- ✅ **DevHub backend** (`aevion-core/main`) — 1 commit + push: DevHubSnippet table + 4 endpoints (list/create/get/star) + tag/user filters. UI и smoke не сделано (агент остановился на backend из-за sandbox-блока). SHA: `791942a5`.
- ✅ **Planet Compliance** (`aevion-core/main`) — 1 commit + push: `GET /api/planet/activity` — chronological event feed (submitted/certified/revoked/voted), kinds filter. SHA: `b8fc854c`.
- ✅ **AEVION-hub** (`aevion-core/main`) — 2 commits + push: `/api/aevion/stats` (extended с coverage matrix + recent activity) + `/api/aevion/module-of-the-day` (deterministic by day-of-year) + SDK поддержка в `@aevion/catalog-client` (+8 vitest = 64/64 passed). SHA: `31e7eb8a`, `16c33eab`.

### Завершено 2026-05-13 (parallel block 1)

- ✅ **HealthAI** (`aevion-healthai`, healthai-v1) — 3 commits + push: wellness score + hydration coach endpoints, end-to-end smoke-test, ScoreCard/HydrationCard widgets. SHA: `de092f7e`, `a4729df8`, `20e1fa67`.
- ✅ **MVP-семейка** (`aevion-core/main`) — 2 commits + push: shared `MvpConceptBoard.tsx`, wired в 6 idea-страницы (qlife/psyapp-deps/qpersona/deepsan/shadownet/lifebox). SHA: `623ea197`, `affe8f83`.
- ⚠️ **Globus** (`frontend-globus`, globus-polish) — 3 commits локально, **push blocked OAuth workflow-scope**: country hover preview, perf debounce + markerMatch, keyboard shortcuts + help overlay. SHA: `a8276d4e`, `917badb4`, `c89e9ad5`. Нужен PAT с `workflow` scope для пуша.
- ⚠️ **QShield** (`frontend-qshield`, feat/aevion-finalize-and-status) — 2 commits локально, **push blocked OAuth workflow-scope**: POST /verify-batch + OpenAPI + smoke-test. SHA: `7dbdccc3`, `7a57dd29`.

### Завершённые задачи этой сессии (сегодня, 2026-05-12)

- ✅ Security Tier 3: убрано 273 `details:err.message` утечки из 73 route файлов
- ✅ Regression test `sharedSecretsHardening.test.ts` — 11/11 pass
- ✅ Smoke 24/24 PASS, audit 20/20 PASS (Railway prod)
- ✅ Восстановлены `fintech/page.tsx` + `developers/fintech/page.tsx` (2032 строки)
- ✅ QJobs prod-ready: rate limits + skills filter (Postgres) + stats + smoke
- ✅ QNews prod-ready: rate limits + stats + smoke + submit форма + bookmarks + AI digest UI
- ✅ QSocial prod-ready: rate limits + stats + smoke + notifications
- ✅ QNews добавлен в projects.ts как проект #30
- ✅ QJobs/QSocial перемонтированы в QBuild (`/api/build/jobs`, `/api/build/social`)

---

## 📢 BROADCAST 2026-05-12 — приказ от пользователя ВСЕМ открытым сессиям

> Команда напрямую от пользователя ко всем чатам Claude/Cursor в AEVION worktrees, разосланная через этот файл (увидите на ближайшем `git pull`).

**Каждой открытой сессии:**

1. **Прочитай** секцию **LIVE ZONE OWNERSHIP** ниже (раздел «Worktree → зона»).
2. **Работай только в своей зоне.** Если задача задевает чужой файл — не редактируй молча.
3. **Перед удалением/существенной перезаписью чужого файла:**
   - Append короткую заметку в раздел **Pending cross-zone change requests** ниже (worktree / filepath / цель)
   - Commit изменения `AEVION_COORDINATION.md`
   - **Жди 30 минут** до подтверждения от владельца зоны
   - Если за 30 минут нет ответа — приоритет user-задачи, можно действовать с указанием в commit-сообщении

Это правило ввели после инцидента, когда одна сессия снесла 2032 строки чужой работы.

**Подтверждение прочтения:** в следующем своём коммите упомяни `BROADCAST-2026-05-12-read` в commit body. Этого достаточно — отдельного коммета не нужно.

---

## 📢 BROADCAST 2026-05-12 #2 — обязательно объявлять смену проекта/зоны

Команда от пользователя ВСЕМ открытым сессиям:

**Если сессия собирается СМЕНИТЬ активный проект/модуль/зону работы** — включая:
- переключение с одного модуля на другой (например CyberChess → fintech)
- принятие нового правила зоны из этого файла, которое сужает scope текущего чата
- следование BROADCAST-инструкции, которая уводит от темы, ради которой чат изначально открыт

**…сессия ОБЯЗАНА:**
1. **Сначала объявить** пользователю в 1-2 предложениях: «Этот чат был на X. Я вижу [причина] — переключаюсь на Y, окей?»
2. **Дождаться явного подтверждения** ("да, переключайся на Y" или эквивалент). Молчаливое "продолжаем" / "вперед" **не считается** разрешением сменить зону.
3. Только после OK — начинать работу в новой зоне, и только тогда обновлять auto-memory.

**Почему ввели:** 2026-05-12 эта `aevion-core/main` сессия исторически была CyberChess-окном (~5 дней, 83+ коммита). После BROADCAST #1 я прочитал новые границы зон, тихо переключился на fintech и проработал часы, ни разу не сказав пользователю «переключаюсь с шахмат». Доверие подорвано. Не повторять.

**Подтверждение прочтения:** упомяни `BROADCAST-2026-05-12-2-read` в commit body.

---

## ⚠️ LIVE ZONE OWNERSHIP — read first, edit before crossing zones

> **Обновлено 2026-05-12. ЭТОТ БЛОК ОБЯЗАТЕЛЕН К ПРОЧТЕНИЮ ПЕРЕД ЛЮБЫМ EDIT.**
> Все сессии: если планируешь УДАЛИТЬ или существенно ПЕРЕПИСАТЬ файл вне своей зоны — сначала добавь короткую заметку в раздел **"Pending cross-zone change requests"** ниже и подожди подтверждения. Не сноси чужой work молча — теряются часы труда другой сессии.

### Worktree → зона (кто что трогает)

| Worktree | Branch | Owned zones (где edit разрешён без согласования) |
|---|---|---|
| `aevion-core` (main) | `main` | `aevion-globus-backend/scripts/**`, `aevion-globus-backend/src/lib/{ecosystemEvents,openapiFintechSpec}.ts`, AIPB chain в `bureau.ts` (только `/cert-for-qright`), QRight policies в `qright.ts`, `frontend/src/app/fintech/**`, `frontend/src/app/developers/fintech/**`, `frontend/src/components/fintech/**`, **`cyberchess.ts`**, **`frontend/src/app/cyberchess/**`** (reassigned 2026-05-12 — этот чат исторически CyberChess-окно; см. строку 81-WIP), this file (AEVION_COORDINATION.md) |
| `aevion-build` | `feat/mobile-audit-v3-*` | **6 fintech модуля сорсы:** `qfusionai/qgood/qmaskcard/qchaingov/veilnetx/z-tide` (backend routes + frontend `app/*/...` под этими путями). QMedia. Mobile audit (touch targets, responsive layout). |
| `aevion-smeta-trainer` | `feat/smeta-trainer-*` | `frontend/src/app/smeta-trainer/**`, `aevion-globus-backend/src/routes/smeta-trainer.ts`, normatives/drawings/quiz |
| `aevion-bureau` | `feat/bureau-v2` | широкая часть `bureau.ts` (kroме AIPB endpoint выше), `frontend/src/app/bureau/**` |
| `aevion-healthai` | `healthai-v1` | `healthai.ts`, `frontend/src/app/healthai/**` |
| `aevion-qsign` | `feat/qsign-v1.1` | `qsignV2.ts`, `qsign.ts`, `frontend/src/app/qsign/**` |
| `aevion-qtradeoffline` | `qtradeoffline-v1` | `qtrade.ts`, `frontend/src/app/qtrade/**`, `frontend/src/app/qtradeoffline/**`, `aev.ts`, `frontend/src/app/aev/**` |
| `frontend-qshield` | `feat/aevion-finalize-and-status` | `quantum-shield.ts`, `pipeline.ts`, `qright.ts` (broad), `frontend/src/app/quantum-shield/**`, `frontend/src/app/qright/**` |
| `aevion-backend-modules` | `feat/platform-tier2-rest` | `modules.ts`, `awards.ts`, `planetCompliance.ts`, `auth.ts`, `frontend/src/app/admin/**` |
| `frontend-qcore` (under aevion-core) | `feat/devhub-v1-*` | `qcoreai.ts`, `frontend/src/app/qcoreai/**`, `frontend/src/app/devhub/**` — **CyberChess отозван в aevion-core/main 2026-05-12** (не трогать `cyberchess.ts` / `frontend/src/app/cyberchess/**` до новой реасайн-инструкции) |
| `frontend-payments` (under aevion-core) | `payments-rail` | `qpaynet.ts`, `qcontract.ts`, `frontend/src/app/qpaynet/**`, `frontend/src/app/qcontract/**` |
| `aevion-core` (main) **sprint 2** | `main` | **QJobs** (`qjobs.ts`, `lib/ensureQJobsTables.ts`, `frontend/src/app/qjobs/**`, `scripts/qjobs-smoke.js`), **QNews** (`qnews.ts`, `frontend/src/app/qnews/**`), **QSocial** (`qsocial.ts`, `frontend/src/app/qsocial/**`) — prod-ready: rate limits + smoke + search + Postgres indexes |

**Shared/no-owner zones** (договариваемся отдельно перед изменением):
- `aevion-globus-backend/src/index.ts` (роутер mounts) — touchpoint всех; commit ALWAYS via `git commit --only -- index.ts`
- `frontend/src/components/Wave1Nav.tsx`, `SiteHeader.tsx`, `ClientProviders.tsx` — глобальный layout
- `frontend/src/app/sitemap.ts`, `robots.ts`, `layout.tsx` — top-of-tree
- `frontend/package.json`, `aevion-globus-backend/package.json` — deps; используй Dependabot
- `.github/workflows/**` — CI; PR-only

### Protocol: «прежде чем сносить чужое»

1. **Open** этот файл, проверь whose zone you're crossing.
2. **Append** к разделу **Pending cross-zone change requests** ниже:
   - кто (worktree)
   - что (filepath + одна строка цели)
   - дата
   - срочность (low/med/high)
3. **Commit + push** этот файл со своей entry. Не делай destructive edit в течение **30 минут** после push — даёшь время другой сессии увидеть и среагировать.
4. Если urgent (production fire, security) — пиши **high** + всё равно committь notice; не жди.

### Pending cross-zone change requests

- **2026-05-12** — `aevion-core/main` → owner of `aevion-build` (`routes/veilnetxLedger.ts`)
  - **Цель:** применить canonical JSON (sorted keys) в `entryHash` payload — и для POST `/entries`, и для GET `/chain/verify`.
  - **Почему:** Postgres JSONB переупорядочивает ключи `meta` при storage. Сейчас insert-time хэш считается над `JSON.stringify({txId, walletId, feeKzt})`, а verify-time над JSONB-возвращённым `{txId, feeKzt, walletId}` → SHA расходится → `/chain/verify` ложно репортит `brokenAt`. Подтверждено перебором перестановок ключей (doctor script).
  - **Что уже сделано в моей зоне (главный коммит `8c93bdc1`):** `lib/ecosystemEvents.ts` экспортирует `canonicalJson()` и использует его для `metaJson` хэша. `scripts/rebuild-veilnetx-chain.js` зеркалит ту же функцию (коммит `6d6e01bc`).
  - **Что нужно в твоей зоне:** в `routes/veilnetxLedger.ts` импортировать `canonicalJson` из `../lib/ecosystemEvents` и заменить два места `JSON.stringify(meta)` (в POST `/entries` insert + в `/chain/verify` recompute loop) на `canonicalJson(meta)`. После деплоя выполнить `ALLOW_CHAIN_REBUILD=1 ALLOW_CHAIN_REBUILD_PROD=1 node scripts/rebuild-veilnetx-chain.js` чтобы перебить исторические хэши на новый формат.
  - **Срочность:** med. Chain integrity сейчас false на проде → fintech-flow-smoke и veilnetx-ledger-smoke падают на одной assertion; функционально цепь работает.

- **2026-05-12 16:55 UTC+5** — `aevion-core/main` (CyberChess sub-zone) → owner of `frontend-qcore` (`aevion-globus-backend/src/routes/cyberchess.ts`)
  - **Цель:** добавить публичный read-endpoint `GET /api/cyberchess/cpi/leaderboard` который возвращает top-N (default 15) пользователей по AEVION CPI с per-factor breakdown.
  - **Зачем:** фронт-страница `/cyberchess/cpi/leaderboard` (commit `79e85269`) сейчас работает на mock-данных. Хотим заменить на live API.
  - **Контракт (предложение):**
    ```ts
    GET /api/cyberchess/cpi/leaderboard?limit=15&factor=overall
    → 200 { entries: [{ rank, username, cpi, factors: { E, T, O, B1, M1, M2, M3, H, Br }, games, trend }] }
    ```
    Параметр `factor` опциональный (overall | E | T | O | B1 | M1 | M2 | M3 | H | Br) — сортировка по выбранному фактору.
    Без auth (публичный). Кэш на 60s.
  - **Где брать данные:** новая таблица `cyberchess_cpi_state` (per-user CPI + factor history) — её ещё нет в Postgres. Можно начать с in-memory mock в backend как первый шаг (без таблицы), фронт автоматически переключится с локального mock на backend mock.
  - **Что я СДЕЛАЛ в своей зоне:** фронт уже готов читать с этого endpoint'а через простой fetch (нет PR, обращусь после Yes/No от owner).
  - **Срочность:** low. Mock-данные на фронте работают; это улучшение от P1 к production.
  - **Жду подтверждения 30 мин** перед написанием PR (по протоколу). Если за 30 мин нет ответа — приоритет user-задачи, иду делать самостоятельно.

### Acknowledgement log (BROADCAST-2026-05-12-read)

| Worktree | Прочитал | Коммит |
|---|---|---|
| `frontend-qcore` (feat/devhub+qcore) | 2026-05-12 | следующий коммит в этой зоне |

### Current active work (aevion-core/main, 2026-05-12)

- **CyberChess** — это окно исторически было CyberChess-чатом (~5 дней, 83+ commits). 2026-05-12 PM пользователь подтвердил возврат шахмат сюда (reassign из frontend-qcore). Открытые таски: #67 Variants QA, #71 Coach SR, #72 Setup hero.
- Fintech surface — ранее в этой сессии (today) выкатано ~9 коммитов: troubleshooting, integrations, rate-limits, FintechMetric, onboarding-guide. Backlog исчерпан.
- НЕ трогаем: bureau frontend, qright frontend, qcoreai, qsign, qtrade — это чужие зоны

### Recent destructive incidents (для learning'а)

| Дата | Кто | Что снёс | Где было | Урок |
|---|---|---|---|---|
| 2026-05-12 | aevion-build (`f83fcaaf` "QMedia+Stripe+DevHub") | `frontend/src/app/fintech/page.tsx` (913 lines), `frontend/src/app/developers/fintech/page.tsx` (1119) | shipped `735ee294`, `1d4fb690` from `aevion-core` 6 часов ранее | 2032 строки потеряны. Урок: `git commit --only -- FILE` всегда; не использовать `git add .` |
| 2026-05-12 | aevion-build (`f83fcaaf` тот же commit) | `frontend/src/app/smeta-trainer/drawings-practice/hub/page.tsx` категоризация (Category type + 9 секций + 36+ модулей) | shipped в PR #218 (smeta-trainer) ~30 мин ранее | hub откатан к плоской 27-модульной версии. Восстановлено в PR #222 через `git checkout --theirs` при rebase. Урок: один git commit может задеть много файлов — проверять `git diff --name-only` ПЕРЕД commit. |

### Edit-style правила для всех

- `git commit --only -- FILE1 FILE2` ВСЕГДА. Никогда `git add .` или `git commit -a`.
- Если push rejected: `git pull --rebase` один раз, потом push. Если конфликт в чужой зоне — `git rebase --abort` + добавить запрос в "Pending cross-zone".
- Сообщения коммитов — `scope(module): action` (англ или ru, но один scope per commit).

---

## Рекомендуемая стратегия (максимум скорости и эффекта) — **использовать по умолчанию**

Это оптимальный баланс для **одного основного разработчика + ИИ** (и для малой команды).

### 1) Чаты Cursor: **не 27 параллельно**, а **2 (+1 редко)**

| # | Чат | Когда открывать |
|---|-----|------------------|
| **A** | **`AEVION | SYSTEM`** | Платформа: CI, корневой `package.json`, Auth, общие API, шареный код, Planet как инфраструктура, всё что трогает **>1 модуля** |
| **B** | **`AEVION | SPRINT`** | **Один вертикальный срез** текущего спринта: один модуль или одна фича end-to-end (UI → API → БД) |
| **C** | *(опционально)* **`AEVION | SPIKE`** | Короткое исследование (до 1–2 дней), потом **закрыть** и перенести выводы в worklog |

**Почему не 27 активных чатов:** нет общей памяти между диалогами → дублирование, конфликты в git, разъезд контрактов. **Скорость падает**, несмотря на видимость «параллельности».

### 2) Порядок работ по продукту (что делать в чате B)

Идти **по фазам** из **`AEVION_27_PROJECTS_ROADMAP.md`**, не распыляясь на все 27:

1. **Закрепить платформу** (фаза B): Globus + QRight + QSign + Bureau + Auth + **Planet** — один связный happy path и **`npm run verify`**.
2. **Следующий спринт = один следующий блок** roadmap (например QTrade persistence **или** один AI-демо), а не «понемногу везде».
3. На каждый спринт: **одна строка цели** в WIP + **один** вертикальный срез до «готово» по DoD ниже.

### 3) Параллель только без зависимостей

Параллельно можно вести **контент/документацию/дизайн** и код **разных слоёв**, если **нет общих файлов**. Если есть — сначала **чат A (SYSTEM)**, потом **чат B**.

### 4) Критерий эффективности спринта

Спринт удачный, если: **один** закрытый срез + **зелёный** `npm run verify` + **1–3 строки** в worklog. Не «начато 8 модулей».

---

## Альтернатива: «27 чатов по продуктам + 1 системный»

**Возможно технически**, но **не рекомендуется** держать все 27 **активными** одновременно — см. риски ниже. Используйте как **архив именованных чатов** (открываете чат модуля только когда берёте этот модуль в работу на неделю).

В Cursor можно завести отдельный диалог под каждый из 27 узлов и **один** системный — но **одновременно** лучше не более **2–5** продуктовых + системный (см. рекомендуемую стратегию выше).

| Чат | Фокус | Типичные файлы / границы |
|-----|--------|---------------------------|
| **Системный (1 шт.)** | Инфраструктура, контракты для всех, сборка, CI, дублирование кода | корень `aevion-core`, `.github`, `package.json`, shared libs, `auth`, базовые роуты |
| **Продуктовый (до 27)** | Один `project.id` из `aevion-globus-backend/src/data/projects.ts` | страница `frontend/src/app/[id]/page.tsx` + будущий модульный код под этот id; **без** ломки глобального auth без согласования в системном чате |

**Риски (важно):**

- У чатов **нет общей памяти** — они не видят друг друга. Единственный «мост» — **git + этот файл + worklog**.
- **27 активных чатов одновременно** = высокий риск **конфликтов в merge** и дублирования. Имеет смысл держать **активными 2–5** продуктовых чатов + системный, остальные — «спящие» до спринта.
- Каждый продуктовый чат в начале сессии: *«Мой project id = `…`, работаю только в зоне этого модуля; общие изменения не делаю — передаю системному чату»*.

**Практика именования чатов в Cursor:** `AEVION | qright`, `AEVION | planet`, `AEVION | SYSTEM` — чтобы в списке истории было видно роль.

---

## Порядок источников истины (всегда сверху вниз)

1. **`AEVION_COORDINATION.md`** (этот файл) — **кто что делает сейчас**, что заблокировано, что сдано в последнем коммите.
2. **`AEVION_WORKLOG_*.md`** — факты: что сделано, как запускать, известные блокеры.
3. **`AEVION_27_PROJECTS_ROADMAP.md`** — стратегия, фазы, приоритеты (не дублировать сюда текущие мелкие задачи).
4. **`AEVION_PLANET_CONCEPT.md`** — что такое Planet, ценность, нарратив (в т.ч. для инвесторов), MVP vs пост-MVP, параллельные витрины.
5. **`AEVION_AWARDS_SPEC.md`** — две линии премий (музыка/кино), голоса и участники Planet.

Если два чата расходятся — **правит файл координации + worklog**, а не «память» в треде.

---

## Перед началом любой сессии (обязательно)

1. Прочитать блок **«Текущая работа (WIP)»** ниже — не брать задачу, если она уже **занята**.
2. Если берёте задачу — **сразу обновите WIP**: имя зоны, кратко что делаете, дата/чат (например `chat-A` / `chat-B`).
3. После завершения — **убрать из WIP**, перенести одну строку в **«Недавно сдано»** и при необходимости дописать **worklog**.

---

## Текущая работа (WIP)

> ⏱ Обновляется каждые 5 минут. Последнее обновление: **2026-05-12 12:19 UTC** (frontend-qcore heartbeat)

| Зона | Статус | Кто | Задача | Обновлено |
|------|--------|-----|--------|-----------|
| `smeta-trainer/drawings-practice/**` | ☑ ЗАНЯТО | aevion-smeta-trainer | Drawings-practice батчи (48 модулей, 9 категорий) | 05:42 UTC |
| `qcoreai.ts` + `qcoreai/**` | ✅ V31-V70 + collab viewer DONE | frontend-qcore | collab share link + 24h TTL + viewer count. Далее: streaming SSE | 12:19 UTC |
| `devhub.ts` + `devhub/**` | ✅ V1-V3 DONE | frontend-qcore | GitHub API branches/sync. Далее: Monaco editor или Cloudflare domain | 12:19 UTC |
| `qai.ts` + `qai/**` | ✅ V1 + markdown DONE | frontend-qcore | Markdown рендер + export .md + session history sidebar | 12:19 UTC |
| `qmedia.ts` + `qmedia/**` | ✅ V1 + radio + smart playlists DONE | frontend-qcore | Далее: waveform visualizer или collab playlists | 12:19 UTC |
| `qstore.ts` + `qstore/**` | ✅ V1 + dashboard DONE | frontend-qcore | Seller dashboard + daily chart + public seller profile | 12:19 UTC |
| `qlearn.ts` + `qlearn/**` | ✅ V1 + certs DONE | frontend-qcore | Сертификаты + batch-verify + count endpoint | 12:19 UTC |
| `qsocial.ts` + `qsocial/**` | ✅ V1 + DM + stories DONE | frontend-qcore | Уведомления, DM, истории, хэштеги | 12:19 UTC |
| `qnews.ts` + `qnews/**` | ✅ V1 + RSS + bookmarks DONE | frontend-qcore | RSS + AI дайджест + закладки | 12:19 UTC |
| `qjobs.ts` + `qjobs/**` | ✅ V1 + AI match DONE | frontend-qcore | AI matching + salary insights + save jobs | 12:19 UTC |
| `qevents.ts` + `qevents/**` | ✅ V1 + calendar DONE | frontend-qcore | Calendar grouping + waitlist + share URL | 12:19 UTC |
| `payments.ts` + `pricing/**` | ✅ DONE | frontend-qcore | Stripe test + PayBox KZ + Kaspi + pricing page | 12:19 UTC |

### Следующие задачи (очередь frontend-qcore)

1. `qcoreai.ts` — collab viewer (POST /sessions/:id/collab, share link)
2. `devhub.ts` — GitHub OAuth (реальное создание репо через API)
3. `frontend/src/app/qai/page.tsx` — markdown рендер + sidebar история
4. `qstore.ts` — dashboard продавца + публичный профиль
5. `qlearn.ts` — сертификат при завершении курса

**Правило:** на одну **зону** (Planet / QRight / Globus / Auth / CI / …) — **не больше одной активной задачи** без явной пометки «параллельно ок».

Обновляйте таблицу **в том же коммите**, что и смысловые изменения, или отдельным микрокоммитом `chore: coord WIP`.

---

## Недавно сдано (кратко, последние 5 пунктов)

- *(добавляйте сверху; старое удаляйте)*

---

## Definition of Done — «работоспособная версия»

Минимум перед тем, как считать итерацию **готовой**:

1. Из корня **`aevion-core`**: **`npm run verify`** — успешно (backend `tsc` + frontend `next build`).
2. Если менялись API или env — **одна строка** в worklog: как проверить (URL, пример запроса).
3. Не оставлять **два разных способа** сделать одно и то же без пометки «deprecated» (избегаем дублирования контрактов).

**Не обязательно для каждого микрошага:** `npm run lint:frontend` (пока в конвейере не зелёный — см. README).

---

## Как не дублироваться между чатами

- Любой чат не начинает «с нуля»: первое сообщение — *«сверься с `AEVION_COORDINATION.md`, возьми свободную задачу / зону»*.
- Одна фича = **один исполнитель** в WIP; другая сессия берёт **другую зону** или **ожидает**.
- Крупные рефакторинги: строка в WIP **«LOCK: path/to/file»**, чтобы остальные чаты не трогали файл без согласования.
- **Системный чат** координирует изменения, которые трогают **несколько** продуктов; продуктовые чаты не меняют общие контракты молча.

---

## Шаблон быстрого handoff в новый чат

Скопируйте пользователю:

```text
Проект aevion-core. Стратегия по умолчанию: чат SYSTEM или SPRINT — см. AEVION_COORDINATION.md (рекомендуемая стратегия + WIP), затем последний AEVION_WORKLOG. Готово = npm run verify.
```

---

*Этот файл намеренно короткий; детали истории — в worklog, стратегия — в roadmap.*
