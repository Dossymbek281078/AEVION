# AEVION — CLAUDE.md (контекст этой сессии)

> Создано 2026-04-22 по мотивам `AEVION_HANDOFF_2026-03-24.md`, `AEVION_TIMELINE_2026-03-25.md`, `AEVION_CHAT_ARCHIVE_2026-03-22.md`, `AEVION_27_PROJECTS_ROADMAP.md`, `AEVION_COORDINATION.md`, `AEVION_DEPLOY.md`.

---

## 0. Правила этой сессии (важно)

- **CyberChess v37 делается в ОТДЕЛЬНОМ чате.** В этом терминале его не трогаем — ни код v37, ни ветку `cyberchess-v37-redesign`, ни связанные шахматные файлы. Если задача случайно ведёт туда — останавливаемся и уточняем.
- **В этом терминале работаем над:** QRight, QSign, AEVION IP Bureau, Quantum Shield, QCoreAI (multi-agent), Bank (`../frontend-bank`). Всё что касается «ядра экосистемы» (auth, модульные API, Planet compliance) — тоже сюда.
- **1 разработчик + ИИ.** Идём вертикальными срезами (1 модуль = 1 E2E сценарий за спринт), не размазываем силы на все 27.
- **Перед «готово»:** из корня `aevion-core` прогонять `npm run verify` (backend `tsc` + frontend `next build`).

## 0.1. Workflow (терминал/файлы)

- **Shell:** Windows / PowerShell. **Разделитель команд — `;`, а не `&&`.**
  Пример: `npm install ; npx prisma generate ; npm run build`.
  В bash-обёртке Claude Code можно `&&`, но когда диктуем пользователю команды для ручного запуска — **только `;`**.
- **Редактор пользователя:** Notepad (не ожидать работающих escape-последовательностей, emoji-глифов в терминале, markdown-рендеринга внутри кода). В файлах — ASCII/кириллица, без zero-width и экзотики.
- **Ответы с кодом:** когда изменение в файле затрагивает больше нескольких строк — выдавать **полный файл целиком** (пользователю проще вставить в Notepad, чем собирать диффы). Для мелкой правки — точный snippet + путь.
- **Пути Windows** в сообщениях пользователю — с обратными слэшами (`C:\Users\user\aevion-core\...`). В коде — forward slashes.
- **Ничего не коммитить без явной просьбы.** `git push`, `git reset --hard`, удаление файлов — только с подтверждения.

---

## 1. Что такое AEVION

Экосистема из **27 продуктов** (единый реестр в `src/data/projects.ts`) + сквозной слой **Planet Compliance** (доказательства, сертификаты, голосование) + витрины **Awards** (музыка / кино). Все модули связаны единым контуром: **Auth → QRight → QSign → IP Bureau → Planet**.

- **Концепция Planet** — `../AEVION_PLANET_CONCEPT.md`
- **Спека премий** — `../AEVION_AWARDS_SPEC.md`
- **Roadmap 27 модулей** — `../AEVION_27_PROJECTS_ROADMAP.md`
- **Тайминг до запуска** — `../AEVION_TIMELINE_2026-03-25.md`
- **Координация чатов / DoD** — `../AEVION_COORDINATION.md`
- **Deploy (Railway + Vercel)** — `../AEVION_DEPLOY.md`

---

## 2. Структура монорепо

```
C:\Users\user\aevion-core\
├── aevion-globus-backend\      ← ЭТОТ репозиторий (Express + Prisma + Postgres)
├── frontend\                    ← основной Next.js (Globus, Planet, Awards, /[id])
├── frontend-bank\              ← отдельный фронт банка (AEVION Bank)
├── frontend-qcore\             ← отдельный фронт QCoreAI
├── package.json                 ← корневой, npm-скрипты концертом через concurrently
└── AEVION_*.md                  ← документация, handoff, roadmap, worklog
```

Корневые npm-скрипты (`C:\Users\user\aevion-core\package.json`):
| Скрипт | Что делает |
|--------|------------|
| `npm run dev` | `concurrently` backend + frontend |
| `npm run build:backend` | `tsc` в `aevion-globus-backend` |
| `npm run build:frontend` | `next build` в `frontend` |
| `npm run build:all` / `npm run verify` | последовательная полная сборка (gate перед «готово») |
| `npm run lint:frontend` | ESLint (пока не обязателен в DoD) |

---

## 3. Стек backend (этот репозиторий)

- **Node.js + TypeScript** (CommonJS, `tsc` в `dist/`).
- **Express 5** (`src/index.ts`).
- **Prisma 7 + PostgreSQL** (`prisma/schema.prisma`, миграция `20260331091745_add_quantum_shield`).
- **JWT auth** (`jsonwebtoken`, `bcryptjs`).
- **PDF / QR** (`pdfkit`, `qrcode`) — для сертификатов Planet.
- **HMAC signing** (QSign — канонический JSON).
- **Dev-запуск:** `npm run dev` → `ts-node-dev --respawn --transpile-only src/index.ts` (порт 4001 по умолчанию).

### 3.1. Ключевые файлы backend

```
aevion-globus-backend\
├── src\
│   ├── index.ts                       ← Express + health + /api/globus/projects + /api/openapi.json
│   ├── routes\
│   │   ├── auth.ts             (148)  ← /api/auth/register|login|me
│   │   ├── qright.ts           (159)  ← /api/qright/objects
│   │   ├── qsign.ts             (44)  ← /api/qsign/sign|verify (HMAC)
│   │   ├── qtrade.ts           (296)  ← /api/qtrade/* (accounts/transfers/topup/... + CSV)
│   │   ├── qcoreai.ts          (285)  ← /api/qcoreai/chat|providers|health (OpenAI + stub)
│   │   ├── quantum-shield.ts   (172)  ← /api/quantum-shield/* (Shamir + Ed25519)
│   │   ├── pipeline.ts         (593)  ← /api/pipeline/* (оркестрация контура)
│   │   ├── coach.ts            (137)  ← /api/coach/* (тренер/наставник)
│   │   ├── modules.ts           (60)  ← /api/modules/status + /api/modules/:id/health
│   │   └── planetCompliance.ts (2072) ← /api/planet/* (артефакты, сертификаты, голоса, snapshots)
│   ├── data\
│   │   ├── projects.ts                ← РЕЕСТР 27 МОДУЛЕЙ (источник истины)
│   │   └── moduleRuntime.ts           ← обогащение статусов runtime'ом
│   ├── types\                          ← типы Globus
│   └── lib\                            ← утилиты
├── prisma\
│   ├── schema.prisma                   ← QRightObject, QuantumShield
│   └── migrations\
├── scripts\
│   └── db_url_test.js                  ← проверка DATABASE_URL
└── package.json                        ← dev/build/start
```

### 3.2. Публичные API (из `/api/openapi.json`)

- `GET /health`, `GET /api/globus/ping`
- `GET /api/globus/projects` / `GET /api/globus/projects/:id`
- `GET /api/modules/status` / `GET /api/modules/:id/health`
- `/api/auth/register|login|me`
- `/api/qright/objects` (GET list — `?mine=1` + Bearer, POST create)
- `/api/qsign/sign|verify`
- `/api/quantum-shield` — list/create/stats/:id/verify/delete
- `/api/qcoreai/chat|providers|health`
- `/api/qtrade/accounts[.csv]|transfers[.csv]|operations[.csv]|summary|topup|transfer`
- `/api/planet/stats|artifacts/recent|artifacts/:id/public` (+ много внутренних)
- `/api/pipeline/*`, `/api/coach/*`

---

## 4. 27 модулей — статус (срез март-апрель 2026)

Источник истины — `src/data/projects.ts` (поле `status`).

### Working MVP (уже показываем / близко)
| # | id | Код | Статус | Что есть |
|---|----|-----|--------|----------|
| 1 | `globus` | GLOBUS | in_progress | 3D-карта, маркеры, fallback текстуры, PlanetPulse |
| 5 | `qright` | QRIGHT | in_progress | Реестр объектов, Prisma, привязка к владельцу, ~342 строки UI |
| 6 | `qsign` | QSIGN | in_progress | HMAC sign/verify, канонический JSON, ~178 строк |
| 7 | `aevion-ip-bureau` | AIPB | planning | UI ~505 строк, связка QRight+QSign, deep links с локацией |
| — | Planet | — | MVP | Подача + сертификат + витрины + голоса + snapshots (~800+660+650+160) |
| — | Awards | — | MVP | Music/Film хабы, лидерборд, медали, скелетоны |
| — | Auth | — | MVP | JWT, ~345 строк |

### Частично рабочие
| # | id | Код | Статус | Что есть |
|---|----|-----|--------|----------|
| 8 | `qtradeoffline` | QTRADEOFFLINE | planning | UI ~516 строк, backend in-memory → **нужна persistence** |
| 2 | `qcoreai` | QCOREAI | in_progress | Stub + health + chat (OpenAI/stub), ~166 строк UI |
| 3 | `multichat-engine` | MULTICHAT | planning | Редирект на QCoreAI, ~51 строка |
| — | Quantum Shield | — | есть routes | Shamir + Ed25519, 172 строки роутера, модель в Prisma |

### Только витрина (страница `/[id]` с описанием)
| # | id | Код | Статус |
|---|----|-----|--------|
| 4 | `qfusionai` | QFUSIONAI | planning |
| 9 | `qpaynet-embedded` | QPAYNET | planning |
| 10 | `qmaskcard` | QMASKCARD | idea |
| 11 | `veilnetx` | VEILNETX | planning |
| 12 | `cyberchess` | CYBERCHESS | planning (**ОТДЕЛЬНЫЙ ТРЕК / ДРУГОЙ ЧАТ**) |
| 13 | `healthai` | HEALTHAI | planning |
| 14 | `qlife` | QLIFE | idea |
| 15 | `qgood` | QGOOD | idea |
| 16 | `psyapp-deps` | PSYAPP | idea |
| 17 | `qpersona` | QPERSONA | idea |
| 18 | `kids-ai-content` | KIDS-AI | planning |
| 19 | `voice-of-earth` | VOE | idea |
| 20 | `startup-exchange` | STARTUPX | planning |
| 21 | `deepsan` | DEEPSAN | idea |
| 22 | `mapreality` | MAPREALITY | idea |
| 23 | `z-tide` | Z-TIDE | idea |
| 24 | `qcontract` | QCONTRACT | idea |
| 25 | `shadownet` | SHADOWNET | idea |
| 26 | `lifebox` | LIFEBOX | idea |
| 27 | `qchaingov` | QCHAINGOV | idea |

**27 + 2 сквозных (Planet, Awards) + отдельный Bank-фронт** → пользователь иногда говорит «27-29 модулей» имея в виду с учётом сквозных слоёв и банка.

### Фокус этой сессии (напомним)
- **QRight** (Q2 2026 working v1: политики, экспорт, аудит)
- **QSign** (Q2 2026 working v1: ключи, цепочки, не только HMAC demo)
- **IP Bureau / AIPB** (Q2 2026: слияние с QRight+QSign, Postgres-сертификаты)
- **Quantum Shield** (расширение Shamir + Ed25519 контура)
- **QCoreAI multi-agent** (один агент + история в БД, потом 2-3 агента с изоляцией — по таймлайну Волна 3, июль-август 2026, но multi-agent ядро можно растить раньше)
- **Bank** (`../frontend-bank`, возможная интеграция с QTrade / QPayNet sandbox)

---

## 5. Модели Prisma

```
model QRightObject {
  id, title, description, kind, contentHash,
  ownerName?, ownerEmail?, ownerUserId?,
  country?, city?, createdAt
}

model QuantumShield {
  id, objectId?, objectTitle?,
  algorithm (def "Shamir's Secret Sharing + Ed25519"),
  threshold (def 2), totalShards (def 3),
  shards, signature?, publicKey?,
  status (def "active"), createdAt
}
```

Нет моделей для: Planet artefacts, Auth users, QTrade accounts — они либо в других файлах/слоях (смотреть `planetCompliance.ts`), либо пока in-memory.

---

## 6. Deploy (как есть)

Полностью — `../AEVION_DEPLOY.md`. Краткая шпаргалка:

| Где | Имя | Значение |
|-----|-----|----------|
| Railway → сервис API → Variables | `DATABASE_URL` | из PostgreSQL |
| Railway → сервис API → Variables | `AUTH_JWT_SECRET` | длинная рандомная строка |
| Railway → сервис API → Variables | `AUTH_JWT_EXPIRES_IN` | `7d` |
| Railway → сервис API → Settings → Root Directory | — | `aevion-globus-backend` |
| Railway → Build | — | `npm install ; npx prisma generate ; npx prisma db push ; npm run build` |
| Railway → Start | — | `npm start` |
| Vercel → Project → Env | `BACKEND_PROXY_TARGET` | `https://...railway.app` (БЕЗ `/` в конце) |
| Vercel → Root Directory | — | `frontend` |

Локально (`frontend/.env.local`): `BACKEND_PROXY_TARGET=https://...railway.app`

---

## 7. Репозиторий / git

- **Ветка сейчас:** `cyberchess-v37-redesign` (была актуальна для другого чата — в этом терминале **её не трогаем**).
- **Main:** `main`.
- **GitHub:** `Dossymbek281078/AEVION` (из `AEVION_CHAT_ARCHIVE_2026-03-22.md`).
- Untracked в корне `aevion-core` сейчас: `frontend-bank/`, `frontend-qcore/` — они не в git (проверить отдельно, прежде чем что-то менять).

**Перед тем как делать PR / push** — спрашивать подтверждение.

---

## 8. Что делать в начале каждой задачи

1. Сверить текущее состояние с этим файлом (статусы модулей, что занято).
2. Если задача трогает CyberChess v37 → **остановиться**, сообщить пользователю, что это другой чат.
3. Если трогает больше одного модуля → сначала согласовать подход.
4. Прежде чем «готово» — `npm run verify` из корня `aevion-core`.
5. Не добавлять новые абстракции «впрок», не плодить два способа делать одно и то же.

---

## 9. Основной источник истины по рабочей реальности

- **Состав экосистемы** → `src/data/projects.ts`.
- **Что сделано недавно** → последние коммиты + `../AEVION_WORKLOG_*.md`.
- **Кто что пишет сейчас** → `../AEVION_COORDINATION.md` (WIP-таблица).
- **Куда идём** → `../AEVION_27_PROJECTS_ROADMAP.md` + `../AEVION_TIMELINE_2026-03-25.md`.

Если между чатами расхождение — правит файл координации, а не память треда.
