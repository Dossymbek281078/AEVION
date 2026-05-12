# Координация сессий (несколько чатов Cursor)

Цель: **не дублировать работу**, **не тратить токены и время** на одно и то же, выпускать версии **максимально работоспособными** (проверяемый минимум перед «готово»).

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

_(пусто — добавляй сюда entries перед нарушением чужой зоны)_

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

| Зона | Занято? | Кто / какой чат | Задача (одна строка) | С согласования |
|------|---------|-----------------|----------------------|----------------|
| `frontend/src/app/smeta-trainer/drawings-practice/**` | ☑ | aevion-smeta-trainer (4ч автоном. сессия 05:42-09:42 UTC) | Достройка drawings-practice — батчи 1-11 уже мерджены (48 модулей в 9 категориях), продолжаю до 09:42 | self |
| `qcoreai/**`, `devhub/**`, `qai/**`, `qmedia/**`, `qstore/**`, `qlearn/**`, `qsocial/**`, `qnews/**`, `qjobs/**`, `qevents/**` | ☑ | frontend-qcore chat | QCoreAI V31-V70 + DevHub V1-V2 + новые модули (QMedia/QAI/QStore/QLearn/QSocial/QNews/QJobs/QEvents) | self — НЕ трогаем smeta-trainer, fintech, bureau, qright, veilnetx, z-tide |

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
