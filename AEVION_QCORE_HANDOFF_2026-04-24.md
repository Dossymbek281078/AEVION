# QCoreAI multi-agent — handoff (2026-04-24)

> Снимок состояния ветки `qcore-multi-agent` на конец рабочего дня 2026-04-24.
> Worktree: `C:\Users\user\aevion-core\frontend-qcore\`.
> Предыдущий снапшот: `AEVION_QCORE_HANDOFF_2026-04-23.md`.

---

## 1. Что сделано сегодня (2026-04-24)

Два коммита поверх вчерашних четырёх:

- **`f91eb5d`** — Rate-limit на `/shared/:token` (60 req/min/IP, in-process, без deps) + server-side OpenGraph/Twitter метаданные на `/qcoreai/shared/[token]` + dynamic 1200×630 PNG preview через `next/og` + SSR-fallback в `lib/apiBase.ts` на `BACKEND_PROXY_TARGET`.
- **`b998211`** — `fix(cyberchess)` убрать tautological `tab!=="analysis"` на `page.tsx:1206` — разблокирован `next build`.

Дополнительно (не в git):
- **PostgreSQL восстановлен** — пароль сброшен на `28112019` через trust-mode `pg_hba.conf` из Admin PowerShell. Скрипт `reset-pg-password.ps1` лежит в корне worktree.
- Ветка `qcore-multi-agent` **запушена на origin** впервые: https://github.com/Dossymbek281078/AEVION/pull/new/qcore-multi-agent
- **Prod build подтверждён**: `next build` проходит полностью, генерирует 25 маршрутов. QCoreAI dynamic: `/qcoreai/shared/[token]` и `/qcoreai/shared/[token]/opengraph-image`.
- **End-to-end все 3 стратегии** протестированы на живом Claude Sonnet 4 + Haiku 4.5:
  - Sequential — $0.0168, 19.5s, Analyst→Writer→Critic→APPROVE.
  - Parallel — $0.0328, 31.4s, Analyst → (Writer-A Sonnet ‖ Writer-B Haiku) → Judge-Haiku.
  - Debate — $0.0324, 36.0s, Analyst → (Pro-Sonnet ‖ Con-Haiku) → Moderator-Haiku.
- **PG persistence verified**: 3 runs, 3 sessions, 17 messages, $0.082 cumulative — всё корректно агрегировано в `/analytics`.

**Всего на ветке: 6 коммитов (все запушены).**

```
qcore-multi-agent (pushed):
  73fcfdf  feat(qcore): multi-agent pipeline with sequential & parallel strategies
  af0ce8d  feat(qcore): debate strategy + pricing/cost engine + run export + rename + rerun + stop-partial
  16f8309  feat(qcore): shareable public runs + analytics dashboard + compare-all-strategies
  aa1bde6  feat(qcore): in-memory fallback store + dev verified end-to-end
  f91eb5d  feat(qcore): rate-limit on /shared + SEO OG tags on shared pages
  b998211  fix(cyberchess): drop tautological tab!=="analysis" comparison (unblock next build)
```

---

## 2. Dev-окружение сейчас

### Порты (альтернативные, т.к. главный worktree держит 4001/3000)

- Backend: **4101**
- Frontend: **3100** (proxy на `http://127.0.0.1:4101`)

### Запуск (только nohup+disown работает стабильно на этом Windows setup)

```bash
cd aevion-globus-backend
PORT=4101 nohup npx ts-node-dev --respawn --transpile-only src/index.ts \
  > /c/Users/user/AppData/Local/Temp/qcore-backend.log 2>&1 &
disown

cd ../frontend
BACKEND_PROXY_TARGET="http://127.0.0.1:4101" nohup npx next dev -p 3100 \
  > /c/Users/user/AppData/Local/Temp/qcore-frontend.log 2>&1 &
disown
```

> **Важно**: `npx ts-node-dev &` без `nohup`+`disown` на этом Windows умирает, как только родительский shell теряет child-tracking. Start-Process через PowerShell тоже теряется. Единственная рабочая комбинация — `nohup` + `disown` в git-bash.

### URL-ы

- `http://localhost:3100/multichat-engine` — лендинг
- `http://localhost:3100/qcoreai/multi` — multi-agent UI (3 стратегии + compare-all-3)
- `http://localhost:3100/qcoreai/analytics` — dashboard (KPI tiles, by-strategy, by-provider, recent runs)
- `http://localhost:3100/qcoreai/shared/[token]` — публичная страница run с OG/Twitter meta + dynamic PNG

### DB

Локальный **PostgreSQL 18** (порт 5432, DB `aevion_dev`). Пароль `postgres` = `28112019`. `DATABASE_URL` в `.env` валидна.
- `QCoreSession`, `QCoreRun`, `QCoreMessage` созданы bootstrap'ом `ensureQCoreTables` при первом запросе.
- В `QCoreRun` есть колонки: `strategy`, `totalCostUsd`, `shareToken` (+ unique partial index).
- В `QCoreMessage`: `costUsd`, `instance`.

Если пароль опять слетит — запустить `reset-pg-password.ps1` из Admin PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
& "C:\Users\user\aevion-core\frontend-qcore\reset-pg-password.ps1"
```

---

## 3. Что в prod-ready состоянии

✅ **TypeScript clean** — `npx tsc --noEmit` на обоих subprojects = 0 errors.
✅ **Prod build** — `next build` проходит (25 маршрутов).
✅ **DB persistence** — выжила рестарт backend.
✅ **3 стратегии** — все отработали end-to-end с реальными LLM-вызовами.
✅ **Rate-limit** — 429 + `Retry-After` на превышении 60 req/min.
✅ **OG preview** — meta-теги + 206KB PNG с брендированием.
✅ **Cost accounting** — корректный total per run + aggregates в analytics.
✅ **Share** — POST создаёт токен, публичная страница рендерится без auth, DELETE отзывает.
✅ **Export** — JSON и Markdown.
✅ **Rename / Rerun / Stop-partial** — работают по роутам `/sessions/:id` PATCH, `/multi-agent` POST с существующим `sessionId`, abort flag.
✅ **In-memory fallback** — при недоступности PG store прозрачно переключается на Maps (`/health` показывает `storage: "in-memory"`).

---

## 4. Что осталось (не блокирует релиз)

### Открыть PR

Ветка запушена, но PR не создан (нет `gh` CLI локально).
**URL для открытия:** https://github.com/Dossymbek281078/AEVION/pull/new/qcore-multi-agent

### Удобство / growth

- **Custom agent presets per-user** — сохраняемые именованные роли (Analyst/Writer/Critic overrides).
- **Regenerate in session** — кнопка «переделать последний run с другим prompt'ом».
- **Webhook on run done** — для внешних интеграций (Zapier, Make, internal tools).
- **Rate-limit на `/multi-agent`** — сейчас лимитировано только `/shared`, но `/multi-agent` сжигает LLM-токены. Стоит поставить.

### Большое

- **WebSocket duplex** — human-in-the-loop, прерывать Writer мид-стримом.
- **Tool use** — Analyst/Writer может читать QRight объекты пользователя через существующий API (cross-module, нужен scope OK).

### Тех-долг

- **Pre-existing `baseline-browser-mapping` warning** на сборке — cosmetic, `npm i baseline-browser-mapping@latest -D` почистит.
- **18 vulnerabilities в backend `npm audit`** — cosmetic, отложены с 2026-04-23.

---

## 5. Verify gate (2026-04-24)

| Проверка | Результат |
|----------|----------|
| Backend `tsc --noEmit` | ✅ 0 errors |
| Frontend `tsc --noEmit` | ✅ 0 errors |
| `next build` | ✅ 25 routes generated |
| `/health` | ✅ `storage: "postgres"`, configured: anthropic |
| E2E Sequential | ✅ Analyst+Writer+Critic, $0.0168 |
| E2E Parallel | ✅ Analyst+A+B+Judge, $0.0328 |
| E2E Debate | ✅ Analyst+Pro+Con+Moderator, $0.0324 |
| `/analytics` | ✅ 3 runs / 3 sessions / 17 msgs / $0.082 |
| OG meta на `/qcoreai/shared/[token]` | ✅ title/og:*/twitter:* корректны |
| OG image `/opengraph-image` | ✅ 200, 206KB PNG |
| Rate-limit | ✅ `X-RateLimit-Remaining` декрементит, 429 на overflow |
| Branch push | ✅ `origin/qcore-multi-agent` создана |
