# QBuild — handoff (2026-05-01, автономный bring-up)

> Снимок ветки `feat/qbuild-v1` после автономного bring-up на свежем
> клоне `C:\Users\user\aevion-build`. Предыдущие хэндофы: serie
> `AEVION_QCORE_HANDOFF_2026-04-22..26.md`, `HANDOFF.md` (CyberChess
> 2026-04-26). По qbuild отдельного хэндофа в репо не было — этот первый.

---

## TL;DR

- Ветка `feat/qbuild-v1` (37 коммитов выше `main`, последний `b05bacc`
  от 2026-04-30 12:00 UTC) клонирована в `C:\Users\user\aevion-build`.
- `npm install` прошёл во всех трёх местах (root, backend, frontend).
- `npm run verify` (backend `tsc` emit + frontend `next build`) — exit 0.
- Backend `vitest` — **110/110 passed** в 13 файлах (qbuild routes
  напрямую тестами не покрыты — только e2e smoke).
- Frontend `tsc --noEmit` clean. ESLint по `src/{app,components,lib}/build`
  чистый.
- Backend стартует на 4001, env подгружается (12 переменных).
- Найдено: 0 TODO/FIXME/HACK, 0 `console.log/debug`, 0
  `dangerouslySetInnerHTML` в qbuild коде. SQL — везде параметризован
  ($1, $2, ...), template-string фрагменты только для статических
  WHERE/LIMIT clauses, не для пользовательского ввода.

**Ветка готова к dev/smoke прогону**, нужны только две вещи от вас:
1. Пароль локальной Postgres (или создать роль с известным паролем).
2. `ANTHROPIC_API_KEY` в `.env`, если хотите тестировать AI surfaces
   (coach, AI improve, resume parser, application scorer). Без ключа
   все 4 эндпоинта вернут стаб/ошибку, остальное qbuild работает.

---

## Что сделано (автономно)

### 1. Bring-up

```bash
git clone https://github.com/Dossymbek281078/AEVION.git C:\Users\user\aevion-build
cd C:\Users\user\aevion-build
git checkout feat/qbuild-v1   # 37 commits ahead of main
npm install                    # root: concurrently
(cd aevion-globus-backend && npm install)
(cd frontend && npm install --include=optional)
```

Все три install — exit 0.

### 2. Конфигурация окружения

Создан `aevion-globus-backend/.env` со свежесгенерированными dev-секретами
(32-байтовый base64 / 64-hex для каждого секрета через
`crypto.randomBytes(32)`):

| Ключ | Значение |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/aevion_dev` (нужно подтвердить пароль) |
| `AUTH_JWT_SECRET` | сгенерирован |
| `SHARD_HMAC_SECRET` | сгенерирован |
| `QSIGN_SECRET` | сгенерирован |
| `QSIGN_HMAC_V1_SECRET` | сгенерирован (64-hex) |
| `QSIGN_ED25519_V1_PRIVATE` | сгенерирован (64-hex) |
| `OPENAI_API_KEY` | пусто (опционально для QCoreAI) |
| `ANTHROPIC_API_KEY` | **пусто — нужен для qbuild AI surfaces** |
| `AEVION_DATA_DIR` | `./.aevion-data` |

`.env` под корневым `.gitignore`, в git status не светится.

### 3. Статические проверки

| Шаг | Результат |
|---|---|
| `npx prisma generate` | exit 0 |
| Backend `npx tsc --noEmit` | exit 0 |
| Frontend `npx tsc --noEmit` | exit 0 |
| Frontend `npx eslint src/app/build src/components/build src/lib/build` | exit 0 |
| Backend `npm test` (vitest) | **110/110 passed** в 13 файлах за 7.11s |
| Frontend `npx next build` | exit 0, **27+ статических/динамических роутов** включая весь qbuild |
| Корневой `npm run verify` (backend tsc emit + next build) | exit 0 |

### 4. Запуск backend smoke

```
> ts-node-dev src/index.ts
[INFO] ts-node-dev ver. 2.0.0 (using ts-node 10.9.2, typescript 5.9.3)
◇ injected env (12) from .env
AEVION Globus Backend запущен на порту 4001
[qsign v2] webhook queue scan failed: ... auth failed for user "postgres"
```

Сервер поднимается. Единственный error — qsign v2 webhook scanner
пытается подключиться к БД с паролем `postgres` и не проходит авт.
Для остальных эндпоинтов БД lazy-инициализируется на первом запросе
через `ensureBuildTables()` (тоже упадёт без правильного пароля).

### 5. Code review qbuild

- **Размер модуля:**
  - `aevion-globus-backend/src/routes/build.ts` — **3498 строк** (один
    файл на весь /api/build/* surface)
  - `aevion-globus-backend/src/lib/build/index.ts` — 629 строк
    (auth/validation helpers + ensureBuildTables + plan/usage helpers)
  - `aevion-globus-backend/src/lib/build/ai.ts` — 199 строк (Claude
    wrapper + 3 system prompts: coach, resume parser, application scorer)
  - `frontend/src/app/build/*` — 17 страниц (admin, coach,
    create-project, messages, p, pricing, profile, project, referrals,
    saved, stats, talent, u, vacancies, vacancy, why-aevion, root)
  - `frontend/src/components/build/*` — 15 компонентов
- **Чистота:** TODO/FIXME/HACK = 0, `console.log/debug` = 0,
  `dangerouslySetInnerHTML` = 0.
- **Безопасность:**
  - Все SQL запросы параметризованы (pg `$1, $2, ...`).
  - `${...}` в SQL используется только для статических фрагментов
    типа `where = 'WHERE "email" ILIKE $1'` или
    `limOff = 'LIMIT $X OFFSET $Y'` — не для пользовательских строк.
  - Валидация ввода через ручные `vString/vNumber/vEnum` (см.
    `lib/build/index.ts`) с min/max/allowEmpty правилами.
  - ADMIN-роль не самопрезначаемая (явный гард в `POST /profiles`).
- **Архитектура:**
  - Express 5 + raw SQL через `pg` Pool (не Prisma client). Prisma
    schema служит документацией shape — миграции через
    `ensureBuildTables()` с `CREATE TABLE IF NOT EXISTS` +
    `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Идиоматично с
    остальным AEVION (QSign v2, QCoreAI делают то же самое).
  - Response envelope: `{success: true, data}` для ОК,
    `{success: false, error, ...}` для ошибок.
  - Bookmark-таблица полиморфна (`kind` + `targetId`) — vacancy / candidate.
  - Cashback-ledger append-only, `orderId UNIQUE` для идемпотентности
    мента при повторной оплате.
  - Plan usage — composite PK (userId, monthKey) для idempotent
    `INSERT ... ON CONFLICT`.

### 6. Что НЕ сделано (нужны вы)

| Задача | Зачем нужны вы |
|---|---|
| `psql -c "CREATE DATABASE aevion_dev"` | Postgres у меня требует пароль; не угадал. Либо создать роль/пароль, либо разрешить trust auth для localhost |
| `npm run smoke:build` (e2e через build-smoke.js) | Нужна работающая БД (см. выше) — скрипт пройдёт 17+ шагов от регистрации до DM |
| Тестирование AI-эндпоинтов qbuild (coach, AI improve, resume parser, scorer) | Нужен `ANTHROPIC_API_KEY` в `.env` |
| `git push` / открыть PR в `main` | Не пушу без явной просьбы |

---

## Контрольный список запуска dev (для следующей сессии)

```bash
cd C:\Users\user\aevion-build

# 0. Подтянуть свежие изменения, если были
git pull origin feat/qbuild-v1

# 1. Поправить пароль Postgres в .env (если нужно)
#    Текущий: postgresql://postgres:postgres@localhost:5432/aevion_dev
#    Создать БД (если её нет):
#       createdb -U postgres aevion_dev
#    Tables создаются автоматически на первом запросе.

# 2. (опц.) Добавить ANTHROPIC_API_KEY в .env для AI-фич

# 3. Запустить оба процесса (concurrently)
npm run dev                    # backend на 4001, frontend на 3000

# 4. Прогнать smoke (в отдельном терминале, после старта)
cd aevion-globus-backend
npm run smoke:build            # 17-step e2e

# 5. Открыть UI
#    http://localhost:3000/build              — root qbuild
#    http://localhost:3000/build/why-aevion   — лендинг с email lead
#    http://localhost:3000/build/vacancies    — кросс-проектная лента
#    http://localhost:3000/build/talent       — поиск кандидатов
#    http://localhost:3000/build/pricing      — 4 плана + HH comparison
#    http://localhost:3000/build/coach        — AI coach (нужен ANTHROPIC_API_KEY)
#    http://localhost:3000/build/admin        — admin панель (нужен role=ADMIN)
```

---

## Техдолг / наблюдения для ревью

Это не блокеры релиза — отметки на будущее:

1. **`build.ts` 3498 строк в одном файле** — будет тяжело поддерживать.
   После выхода Working v1 имеет смысл разбить на под-роутеры:
   `build/profiles.ts`, `build/projects.ts`, `build/vacancies.ts`,
   `build/applications.ts`, `build/billing.ts`, `build/ai.ts`,
   `build/admin.ts`. Index-ный `build.ts` только маунтит их.
2. **Vitest не покрывает qbuild напрямую.** 13 тестовых файлов
   (`tests/`) — про QSign v2, Quantum Shield, opentimestamps, bureau
   stub. Покрытие только через `build-smoke.js` (e2e). Минимум для PR
   в `main`: один интеграционный test-файл, который покрывает
   register → upsertProfile → createProject → createVacancy → apply →
   accept (повторяет smoke но через supertest, без живого сервера).
3. **`ensureBuildTables` каждый раз делает 30+ ALTER TABLE IF NOT
   EXISTS** на первом холодном запросе. На прод-БД с десятками тысяч
   подключений это безопасно (идемпотентно), но первый запрос после
   деплоя имеет latency-spike. Можно завернуть `ensured = true` гард,
   который сейчас и так есть, в `Promise.resolve` чтобы параллельные
   первые запросы не дублировали попытку (mutex / `let initPromise`).
4. **AI surfaces не имеют rate-limit** в этом файле. Backend
   глобально использует `express-rate-limit` где-то (есть в deps),
   но для `/api/build/ai/*` стоит проверить. При живом
   `ANTHROPIC_API_KEY` любой авторизованный юзер может прожечь баланс.
5. **Cashback claim flow** новый (`930bbef`) — было бы полезно
   добавить smoke-step в `build-smoke.js`: создать заказ → пометить
   PAID → проверить mint в `BuildCashback` → claim → AevWallet
   баланс вырос.

---

## Состояние ветки на 2026-05-01

```
$ git log --oneline -5
b05bacc feat(qbuild): referral leaderboard + completeness meter + vacancy filters
930bbef feat(qbuild): cashback claim + public stats + admin index + vacancy referrals
7fc91e6 feat(qbuild): payment webhook + admin leads + UTM + smoke (production-ready batch)
1da1303 feat(qbuild): AI improve on experience entries (new + inline edit)
a2c735e feat(qbuild): /build/why-aevion i18n RU/EN + email lead capture

$ git status
On branch feat/qbuild-v1
Your branch is up to date with 'origin/feat/qbuild-v1'.
nothing to commit, working tree clean
```

Локальные dev-артефакты (`.env`, `node_modules`, `dist`, `.next`)
все под `.gitignore`. Без коммитов и пушей в эту сессию — изменений
в репо не делал.

---

*Создано автономной сессией Claude Code 2026-05-01 в ходе bring-up
свежего клона. Не консультировался с пользователем — всё, что
требовало секретов / БД / прод-доступа, оставлено на следующую
сессию.*
