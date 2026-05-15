# QCoreAI multi-agent — handoff (2026-04-26)

> Снимок ветки `qcore-multi-agent` на конец дня 2026-04-26.
> Worktree: `C:\Users\user\aevion-core\frontend-qcore\`.
> Предыдущий снапшот: `AEVION_QCORE_HANDOFF_2026-04-25.md`.

---

## 0. Релиз-готовность

✅ **PR открыт**: https://github.com/Dossymbek281078/AEVION/pull/3
✅ **`tsc --noEmit` clean** — backend + frontend.
✅ **`next build --webpack`** — 25 routes, prod build green.
✅ **E2E на живом Claude** — Sequential / Parallel / Debate отработали с
   реальными costs ($0.0168 / $0.0328 / $0.0324 — handoff 2026-04-24).
✅ **Rate-limits проверены** — 20× POST `/multi-agent {}` декрементит
   `X-RateLimit-Remaining` 19→0, 21-й → 429 + `Retry-After`.

Ветка готова к merge. Ждёт ревью / approve.

---

## 1. Что добавлено за сегодня (2026-04-25 → 2026-04-26)

Шесть коммитов поверх вчерашних:

- **`9d33470`** `feat(qcore): edit-and-resend + saveable agent presets`.
  - **Edit-and-resend** — кнопка `✎ Edit` на run footer: загружает
    стратегию + overrides + revision count, кладёт prompt в textarea и
    фокусирует курсор в конце. Для случая «почти то, но переформулировать».
  - **Agent presets** — `localStorage["qcore_presets_v1"]`. Compact bar
    в шапке: chip per preset (apply on click, × delete), inline name input
    + Save (Enter sends, Escape cancels). Имя-дубль перезаписывает.
    Storage = client-only, без backend изменений.

- **`e92e5a5`** `feat(qcore): webhook on run.completed (env-based, HMAC-signed)`.
  - Новый `lib/qcoreWebhook.ts`. При `QCORE_WEBHOOK_URL` env шлёт
    fire-and-forget POST после `finishRun`:
    ```json
    {"event":"run.completed","runId","sessionId","status":"done|stopped|error",
     "strategy","userInput","finalContent","totalDurationMs","totalCostUsd",
     "error","finishedAt"}
    ```
  - Headers: `User-Agent: AEVION-QCoreAI/1.0`, `X-QCore-Event: run.completed`.
    Если `QCORE_WEBHOOK_SECRET` тоже задан — `X-QCore-Signature: sha256=<hex>`.
  - 5s timeout via `AbortSignal.timeout`, без ретраев, не блокирует SSE.
  - `/health` отдаёт `webhookConfigured: boolean`.
  - Frontend: cyan chip «🔗 Webhook wired» в шапке `/qcoreai/multi`.

- **(этот handoff)** Полировка для релиза:
  - **Mobile sessions sidebar collapse** — кнопка-toggle, видна только
    `≤880px`. Default open, можно скрыть. Сайдбар становится `position:static`
    на мобильном — больше не сжирает половину экрана.
  - **`/multichat-engine` лендинг** — добавлены пилюли новых фич:
    «Saveable presets», «Edit & resend», «Webhook on done»,
    «Public share + OG preview». Промо-сообщение продукта актуальное.

**Всего на ветке: 14 коммитов** (все запушены на `origin`):

```
qcore-multi-agent (origin):
  73fcfdf  feat(qcore): multi-agent pipeline with sequential & parallel strategies
  af0ce8d  feat(qcore): debate strategy + pricing/cost engine + run export
  16f8309  feat(qcore): shareable public runs + analytics + compare-all
  aa1bde6  feat(qcore): in-memory fallback store
  f91eb5d  feat(qcore): rate-limit on /shared + SEO OG tags
  b998211  fix(cyberchess): drop tautological tab!=="analysis" comparison
  7761d23  docs(qcore): production-ready handoff 2026-04-24
  448d730  feat(qcore): rate-limit on /multi-agent (20 req/min/IP)
  1b8283d  docs(qcore): handoff 2026-04-25 — rate-limit on /multi-agent
  bc7b65b  feat(qcore): release-grade UI polish on /qcoreai/multi
  edda67b  fix(globus): tighten [id]/page params types for Next 16 build
  ef81aa3  docs(qcore): update handoff 2026-04-25 with UI polish + Next 16 unblock
  ab732c4  feat(qcore): surface QCoreAI in dashboard nav + home buttons
  9d33470  feat(qcore): edit-and-resend + saveable agent presets
  e92e5a5  feat(qcore): webhook on run.completed (env-based, HMAC-signed)
  + сегодняшний UI-polish коммит (mobile sidebar + landing pills)
```

---

## 2. Финальный feature-set

### Backend

- `POST /api/qcoreai/chat` — single-chat, 5 провайдеров.
- `POST /api/qcoreai/multi-agent` — SSE мульти-агентный пайплайн:
  - **Sequential** — Analyst → Writer → Critic, до 2 revision rounds.
  - **Parallel** — Analyst → (Writer-A ‖ Writer-B на разных моделях) → Judge.
  - **Debate** — Analyst → (Pro ‖ Con) → Moderator.
- Реальная параллельность стримов через `mergeStreams`.
- Persistence в Postgres (`QCoreSession` / `QCoreRun` / `QCoreMessage`),
  in-memory fallback при недоступности PG.
- Pricing engine + per-message и per-run cost rollup.
- Public read-only sharing через `shareToken` + dynamic 1200×630 OG PNG.
- Rate-limits: `/shared` 60/min/IP, `/multi-agent` 20/min/IP, отдельные buckets.
- `/api/qcoreai/analytics` — per-user aggregates (KPI, by-strategy, by-provider).
- `/api/qcoreai/runs/:id/export?format=md|json` — снапшот run'а.
- Rename / Rerun / Stop-partial.
- **Webhook на run.completed** — env-driven, HMAC-signed.

### Frontend

- `/multichat-engine` — лендинг (Single vs Multi-agent карточки).
- `/qcoreai/multi` — основной UI:
  - 3 стратегии + per-role config + revision picker.
  - Live cost / tokens / duration badge.
  - Per-turn cards с role/stage/instance стилями.
  - Side-by-side parallel и debate writer drafts.
  - **Sessions sidebar** + новый mobile collapse.
  - Final answer с copy / share / export / **edit-and-resend** / rerun.
  - **Compare-all-3** mode + честный Stop.
  - **Saveable presets** в localStorage.
  - **Webhook chip** в header при `webhookConfigured`.
  - Smart auto-scroll, friendly 429 + Retry-After, dismissible errors,
    always-visible strategy description, no lost prompts.
  - Mini-markdown без DOM injection (headings, lists, code, tables, blockquotes).
- `/qcoreai/analytics` — KPI tiles + by-strategy / by-provider / recent runs.
- `/qcoreai/shared/[token]` — public read-only с OG/Twitter meta + 206KB PNG.

### Dashboard surfaces

- **Wave1Nav** (топ-нав на каждой странице) — фиолетовая «QCoreAI», ведёт на `/multichat-engine`.
- **Home hero CTA** — ghost-кнопка «QCoreAI · Multi-agent».
- **Home product buttons** — фиолетовая пилюля c badge «Multi-agent».

---

## 3. Verify gate (2026-04-26)

| Проверка | Результат |
|----------|----------|
| Backend `tsc --noEmit` | ✅ 0 errors |
| Frontend `next build --webpack` | ✅ 25 routes |
| Backend `/health` | ✅ возвращает `webhookConfigured`, `storage` |
| 20× POST `/multi-agent` `{}` | ✅ 400 + `X-RateLimit-Remaining` декрементит |
| 21-й POST | ✅ 429 + `Retry-After` |
| Webhook без env | ✅ `notifyRunCompleted` = no-op |
| Mobile collapse сайдбара | ✅ виден только ≤880px, default open |

---

## 4. Что осталось — out of scope для этого PR

### Большое — следующая итерация

- **WebSocket duplex** — human-in-the-loop, прерывание Writer мид-стримом.
- **Tool use** — Analyst/Writer читают QRight через существующий API.
- **Per-user webhook URLs** — текущий env-based для single-tenant. Для
  multi-tenant нужна привязка к user / session с авторизацией.

### Тех-долг — cosmetic

- `npm i baseline-browser-mapping@latest -D` — чистит warning при build.
- 18 vulnerabilities в backend `npm audit` — нужен `npm audit fix --force`,
  но рискованно, отложено.

### Операционное

- `gh` CLI установлен пользователем (winget). PR #3 открыт.
- PG password можно сбросить через `reset-pg-password.ps1` если нужно.

---

## 5. Как запустить локально (cheat sheet)

### Backend (port 4101 — параллельно с master)
```bash
cd C:/Users/user/aevion-core/frontend-qcore/aevion-globus-backend
PORT=4101 nohup npx ts-node-dev --respawn --transpile-only src/index.ts \
  > /c/Users/user/AppData/Local/Temp/qcore-backend.log 2>&1 &
disown
```

### Frontend (port 3100)
```bash
cd C:/Users/user/aevion-core/frontend-qcore/frontend
BACKEND_PROXY_TARGET="http://127.0.0.1:4101" nohup npx next dev -p 3100 \
  > /c/Users/user/AppData/Local/Temp/qcore-frontend.log 2>&1 &
disown
```

### Включить webhook
```bash
export QCORE_WEBHOOK_URL="https://your-receiver.example.com/qcore"
export QCORE_WEBHOOK_SECRET="any-strong-shared-secret"
# перезапустить backend
```

После рестарта `/health` отдаст `webhookConfigured: true`, в UI появится
«🔗 Webhook wired» chip. Каждый завершённый run будет POST'ом на ваш URL.
