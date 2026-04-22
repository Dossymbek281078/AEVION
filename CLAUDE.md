# QCoreAI multi-agent — CLAUDE.md (правила этой сессии)

> Создано 2026-04-22. Это git worktree от `aevion-core` на ветке `qcore-multi-agent`.
> Рабочая папка: `C:\Users\user\aevion-core\frontend-qcore\`.
> Базовый контекст AEVION — см. `aevion-globus-backend/CLAUDE.md` (в этом же worktree).

---

## 0. Что мы тут делаем

**Цель сессии:** превратить одиночный чат QCoreAI в **multi-agent** режим —
пайплайн из нескольких агентов (план: **Analyst + Writer + Critic**),
которые работают над одной задачей последовательно/параллельно и возвращают
согласованный ответ.

**Текущая точка старта (что уже есть):**
- `aevion-globus-backend/src/routes/qcoreai.ts` — single-chat роутер,
  `POST /api/qcoreai/chat`, 5 провайдеров (Anthropic / OpenAI / Gemini / DeepSeek / Grok),
  stateless, без стриминга, без БД.
- `frontend/src/app/qcoreai/page.tsx` — UI одного чата, dropdown провайдера/модели,
  `fetch()` → ждём полный ответ → показываем.
- `frontend/src/app/multichat-engine/page.tsx` — пока просто редирект-заглушка на `/qcoreai`.
- Prisma (`aevion-globus-backend/prisma/schema.prisma`) — моделей для QCoreAI
  **нет** (есть только `QRightObject` и `QuantumShield`). Истории чатов не хранится.

## 1. Границы сессии (жёстко)

Работаем **только** над QCoreAI:
- `aevion-globus-backend/src/routes/qcoreai.ts` и то, что в ней нужно создать рядом
  (новые файлы для оркестратора/агентов внутри `src/routes/qcore-agents/` или `src/services/qcoreai/`).
- `frontend/src/app/qcoreai/page.tsx` и (возможно) `frontend/src/app/multichat-engine/page.tsx`.
- Prisma-схему — **только** если вместе с пользователем решаем, что нужны
  модели типа `QCoreSession` / `QCoreMessage` / `QCoreRun`. Миграции только с подтверждения.
- Может потребоваться подключить пакет `@anthropic-ai/sdk` — согласовать с пользователем до `npm install`.

**Не трогаем в этой сессии** (это другие чаты / другие worktrees):
- **CyberChess / frontend v37** — любой код шахмат, ветка `cyberchess-v37-redesign`, файлы под `frontend/src/app/cyberchess*`.
- **Bank UI** — `frontend-bank/` и всё, что связано с AEVION Bank / QTrade UI.
- **QRight backend** — `src/routes/qright.ts`, `QRightObject` модель (за исключением
  случая, если агенту нужно читать объекты владельца; тогда только **read** через существующий API, без правок роутера).
- **Planet Compliance, QSign, Quantum Shield, Auth, Pipeline** — не правим.
- Глобальные CLAUDE.md, roadmap, deploy-доки — читаем, **не меняем**.

Если задача утекает за эти границы — **останавливаемся и спрашиваем**.

## 2. Workflow

- Shell: bash-обёртка Claude Code (`&&` работает). Команды для пользователя в Notepad/PowerShell — через `;`.
- Пути пользователю: `C:\Users\user\aevion-core\frontend-qcore\...` (обратные слэши).
- Перед «готово» — `npm run verify` из корня `aevion-core` (backend tsc + frontend next build).
- Никаких `git push`, `git commit --amend`, `git reset --hard`, `npm install` без явного ОК.
- Секреты (`ANTHROPIC_API_KEY` и пр.) — только через env, не хардкодить, не логировать.

## 3. Архитектурные ориентиры (пока — не решения)

Обсуждаем до кода:
- **Где оркестратор:** backend-only (один эндпоинт, внутри крутит всех агентов) vs
  backend разбит по ролям + frontend-оркестратор.
- **Стриминг:** SSE (проще, одностороннее) vs WebSocket (нужен дуплекс) vs non-streaming MVP.
  Сейчас нет ни того, ни другого — чистый JSON POST.
- **Персистентность:** нужны ли `QCoreSession` / `QCoreMessage` в Prisma сейчас
  или MVP in-memory, БД во вторую итерацию.
- **Провайдеры:** все 3 агента на одном провайдере/модели, или Analyst=Claude Sonnet,
  Writer=GPT-4o, Critic=Claude Haiku и т.п.
- **UI:** одна общая лента с ролевыми значками vs 3 колонки vs таймлайн-карточки.

## 4. Что делать в начале каждой задачи

1. Сверить эти правила и проверить, что задача не выходит за границы §1.
2. Перед правками в Prisma / `package.json` — подтверждение у пользователя.
3. Перед «готово» — `npm run verify`.
4. Не плодить абстракции «впрок». MVP сначала, потом слои.

---

## 5. Статус (живой)

**Последний снапшот:** 2026-04-22 — `AEVION_QCORE_HANDOFF_2026-04-22.md` (в этом же worktree) содержит полный контекст сделанного.

**Готово (MVP):**
- Sequential пайплайн Analyst → Writer → Critic → (опц.) Writer v2.
- Parallel пайплайн Analyst → [Writer-A ‖ Writer-B] → Judge с настоящей параллельностью стримов (`mergeStreams`).
- SSE `/api/qcoreai/multi-agent`, сессии/runs/messages в Postgres.
- UI `/qcoreai/multi` — toggle стратегий, per-role config, side-by-side параллельные драфты, mini-markdown рендер, copy.
- Лендинг `/multichat-engine` с двумя карточками (Single / Multi-agent).

**Типы прошли:** backend `tsc` clean; frontend `tsc` clean на QCoreAI-файлах. Единственная ошибка на ветке — pre-existing в `cyberchess/page.tsx` (вне скоупа).

**Что подтянуть завтра — см. handoff §6** (Quick wins / Средние / Большое / Тех-долг).

