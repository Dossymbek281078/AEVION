# QCoreAI multi-agent — handoff (2026-04-23)

> Снимок состояния ветки `qcore-multi-agent` на конец рабочего дня 2026-04-23.
> Worktree: `C:\Users\user\aevion-core\frontend-qcore\`.
> Предыдущий снапшот: `AEVION_QCORE_HANDOFF_2026-04-22.md`.

---

## 1. Что сделано за этот день (2026-04-23)

Три коммита на `qcore-multi-agent` поверх вчерашнего MVP:

- **`af0ce8d`** — Debate strategy + pricing/cost engine + export JSON/MD + rename sessions + rerun + stop-partial + markdown tables + blockquote + responsive layout + 3-card empty-state.
- **`16f8309`** — Shareable public runs (`POST /runs/:id/share` + public page `/qcoreai/shared/[token]`) + analytics dashboard (`/qcoreai/analytics`) + "Compare all 3" mode (одна кнопка → три стратегии подряд).
- **`XXXXXXX`** — In-memory fallback: если PostgreSQL недоступен (wrong password, PG down, missing DATABASE_URL), store автоматически переключается на Maps. Демо self-contained, без DB.

**Итого на ветке: 4 коммита локально (включая вчерашний `73fcfdf` MVP). Не запушено.**

---

## 2. Dev-окружение сейчас

### Порты, чтобы не конфликтовать с основным worktree

Основной `aevion-core` worktree держит 3000/4001 (другая сессия). Для этого worktree:
- Backend: **4101**
- Frontend: **3100** с proxy на `http://127.0.0.1:4101`

### Запуск (PowerShell; точки с запятой)

```powershell
cd C:\Users\user\aevion-core\frontend-qcore\aevion-globus-backend
$env:PORT="4101"; npx ts-node-dev --respawn --transpile-only src/index.ts
```

```powershell
cd C:\Users\user\aevion-core\frontend-qcore\frontend
$env:BACKEND_PROXY_TARGET="http://127.0.0.1:4101"; npx next dev -p 3100
```

### URL-ы

- `http://localhost:3100/multichat-engine` — лендинг
- `http://localhost:3100/qcoreai` — single chat (legacy)
- `http://localhost:3100/qcoreai/multi` — multi-agent
- `http://localhost:3100/qcoreai/analytics` — dashboard
- `http://localhost:3100/qcoreai/shared/[token]` — публичная страница run

### node_modules

**Real `npm install`** выполнен в обоих подпроектах (2026-04-23). Больше не junction'ы — Turbopack теперь работает. Backend 309 пакетов; frontend через `npm install --prefix`.

### DB

Локальный PostgreSQL 18 (порт 5432, БД `aevion_dev`) отвергает пароль `28112019` из `.env`. Основной backend (PID 3664 на 4001) ещё жив на старом connection pool, но новые подключения падают с `scram-sha-256` error.

**Обход выполнен на уровне кода**: `ensureQCoreTables` пробует `SELECT 1` и при ошибке включает in-memory режим. `/api/qcoreai/health` показывает `storage: "in-memory"` + `storageError`.

Для возврата на PG — обновить пароль в `.env` (или в PG) и перезапустить backend.

---

## 3. End-to-end проверено

- ✅ Все страницы (`/multichat-engine`, `/qcoreai`, `/qcoreai/multi`, `/qcoreai/analytics`) отдают 200.
- ✅ `GET /api/qcoreai/health` → `storage: in-memory`, `configuredProviders: ["anthropic"]`.
- ✅ `GET /api/qcoreai/sessions` → 200, пусто.
- ✅ `GET /api/qcoreai/analytics` → 200, нули.
- ✅ `POST /api/qcoreai/multi-agent` (sequential, `"Что такое AEVION?"`) — SSE стримится: Analyst chunks → agent_end (201→443 tok, $0.0072) → Writer chunks → agent_end (631→395 tok, $0.0078). Real Claude Sonnet 4 ответы на русском.
- ⏸️  Critic + final + share + analytics end-to-end не догнали — user остановил сессию на конец дня. Основные части (SSE + tokens + cost) подтверждены.

---

## 4. Что осталось / backlog (завтра)

### Dev-pickup
1. Backend dev-процесс (`bsvitwu8s`) запущен в background sandbox — возможно, уже убит. Перезапустить командой из §2.
2. Frontend dev (`bbcbyz05v`) аналогично.
3. Проверить: открыть `http://localhost:3100/qcoreai/multi` в браузере, убедиться что прокси жив.

### Функциональные доработки (низкий риск)

- **Починить DB** (optional): если пароль в `.env` обновить на правильный — in-memory fallback автоматически уступит PG. Тогда share-ссылки и analytics переживут рестарт сервера.
- **Cherry-pick cyberchess-fix**: pre-existing TS error в `frontend/src/app/cyberchess/page.tsx:1206` блокирует `next build` (prod), но не `next dev`. Фикс есть в `cyberchess-v37-redesign` коммитах `473fb3b`/`e7ba525`. Вне скоупа — решать отдельно.
- **Rate limit** для `/shared/:token` (public endpoint) — чтобы не злоупотребляли.
- **OG tags + preview image** на `/qcoreai/shared/[token]` для социальных постов.

### Средние

- **Custom agent presets** (save/load named roles).
- **Webhook on run done** (для интеграций).
- **Regenerate in session** — кнопка «переделать последний run с другим prompt'ом».

### Большое

- **WebSocket дуплекс** — human-in-the-loop, прерывать Writer мид-стримом.
- **Tool use** — Analyst может читать QRight объекты пользователя (cross-module, нужен scope OK).

---

## 5. Статус веток и коммитов

```
qcore-multi-agent (local only, 4 commits ahead of main):
  73fcfdf  feat(qcore): multi-agent pipeline with sequential & parallel strategies
  af0ce8d  feat(qcore): debate strategy + pricing/cost engine + run export + rename + rerun + stop-partial
  16f8309  feat(qcore): shareable public runs + analytics dashboard + compare-all-strategies
  <next>   feat(qcore): in-memory fallback + dev bootstrap on alt ports (this day)
```

## 6. Verify gate

- Backend `tsc --noEmit` → ✅ exit 0
- Frontend `tsc --noEmit` → ✅ clean on QCoreAI files; pre-existing `cyberchess/page.tsx:1206` unchanged (вне скоупа).
- Dev runtime → ✅ подтверждено: реальный SSE-поток от Claude (Analyst + Writer) с token/cost.
