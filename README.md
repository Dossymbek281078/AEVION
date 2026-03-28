# AEVION Core

Монорепозиторий: **backend** (`aevion-globus-backend`) + **frontend** (Next.js).

## Быстрый старт (разработка)

1. PostgreSQL и `.env` в `aevion-globus-backend` (см. `AEVION_WORKLOG_2026-03-20.md`).
2. Из **корня** `aevion-core` один раз: `npm install`
3. Запуск обоих серверов одной командой:

```bash
npm run dev
```

- Backend: порт из вашего `aevion-globus-backend` (часто `4001`)
- Frontend: `http://localhost:3000`

## Проверка «всё собирается» (ускоряет ревью и релизы)

Из корня:

```bash
npm run verify
```

Собирает **backend** (`tsc`) и **frontend** (`next build`). Запускайте перед коммитом или в CI.

> **Lint:** `npm run lint:frontend` сейчас может падать на `any` / hooks — в `verify` не включён, пока не вычистим. Цель — зелёная сборка как минимальный gate.

## Документы

| Файл | Назначение |
|------|------------|
| **`AEVION_COORDINATION.md`** | **WIP + рекомендуемая стратегия:** по умолчанию **2 чата** (SYSTEM + SPRINT), вертикальные срезы; альтернатива «много чатов» описана там же |
| `AEVION_27_PROJECTS_ROADMAP.md` | Таймлайн 27 узлов + принципы ускорения |
| `AEVION_WORKLOG_2026-03-20.md` | Текущий handlog и Planet |
| **`AEVION_PLANET_CONCEPT.md`** | **Концепция Planet:** ценность для пользователей и инвесторов, MVP vs доработки, параллельные витрины |
| `AEVION_AWARDS_SPEC.md` | Премии музыка/кино (две линии), голоса и участники Planet |
| **`AEVION_DEPLOY.md`** | **Vercel + backend:** переменные, root `frontend`, прокси `/api-backend` |
| **`AEVION_AI_AGENT_PROMPTS.md`** | **Пакет готовых промтов** для других AI-агентов (frontend/backend/QA/release) |

## CI

При push/PR в GitHub: workflow `.github/workflows/ci.yml` (параллельно backend + frontend build).
