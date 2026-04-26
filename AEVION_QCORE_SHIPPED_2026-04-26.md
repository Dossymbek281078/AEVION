# QCoreAI — shipped on main (2026-04-26)

> Что отгружено в `main` сегодня и что осталось для следующих итераций.
> Предыдущие снапшоты: `AEVION_QCORE_HANDOFF_2026-04-22.md` … `_2026-04-26.md`.

---

## Что в main (3 PR за день, все merged)

| # | Дата | Title | Merge commit |
|---|------|-------|--------------|
| **#3** | 16:34 UTC | feat(qcore): multi-agent pipeline — Sequential / Parallel / Debate, full release pass | `f997c83` |
| **#7** | 17:01 UTC | feat(qcore): mid-run human guidance — steer writers between stages | `7425269` |
| **#8** | 17:18 UTC | feat(qcore): tool-use lite — QRight context attachments | `8cf87ea` |

---

## Полный feature-set QCoreAI на main

### Backend (`aevion-globus-backend`)

- `POST /api/qcoreai/chat` — single-chat, 5 провайдеров (Claude, GPT, Gemini, DeepSeek, Grok).
- `POST /api/qcoreai/multi-agent` — SSE мультиагентный пайплайн:
  - **Sequential** — Analyst → Writer → Critic, до 2 revision rounds.
  - **Parallel** — Analyst → (Writer-A ‖ Writer-B на разных моделях) → Judge.
  - **Debate** — Analyst → (Pro ‖ Con) → Moderator.
- Реальная параллельность стримов (`mergeStreams`), без ложного interleaving.
- `POST /api/qcoreai/runs/:runId/guidance` — **mid-run human guidance**.
  Втягивается orchestrator'ом на границах writer-стадий, появляется в trace
  как `guidance_applied` событие.
- `POST /api/qcoreai/runs/:id/share` / `DELETE` — публичный shareToken.
- `POST /api/qcoreai/multi-agent` принимает `qrightAttachmentIds` —
  **tool-use lite**: pre-fetch QRight объектов, prepend в Analyst-контекст.
- `GET /api/qcoreai/analytics` — per-user KPI / by-strategy / by-provider.
- `GET /api/qcoreai/runs/:id/export?format=md|json` — clean snapshot.
- `GET /api/qcoreai/health` — storage mode + `webhookConfigured`.
- **Persistence**: Postgres `QCoreSession`/`QCoreRun`/`QCoreMessage`,
  in-memory fallback при недоступности DB.
- **Pricing engine**: per-message + per-run cost rollup на 5 провайдеров.
- **Rate-limits**:
  - `/shared/:token` — 60/min/IP (`qcore-shared` bucket)
  - `/multi-agent` — 20/min/IP (`qcore-multi-agent` bucket, ~$0.60/min/IP cap)
  - `/runs/:runId/guidance` — 60/min/IP (`qcore-guidance` bucket)
- **Webhook на run.completed** — env-driven (`QCORE_WEBHOOK_URL`),
  опционально HMAC-SHA256 (`QCORE_WEBHOOK_SECRET`), 5s timeout, no retry.

### Frontend

- `/multichat-engine` — лендинг (Single vs Multi-agent карточки, 9 feature pills).
- `/qcoreai/multi` — основной UI:
  - 3 стратегии + per-role Provider/Model + revision picker + Compare-all-3.
  - Live cost / tokens / duration badge.
  - Per-turn cards с ролевыми стилями + side-by-side parallel/debate writers.
  - **Edit & resend**, **Rerun**, **Share** + Markdown/JSON export.
  - **Saveable agent presets** (localStorage) — chip per preset, inline name input.
  - **Mid-run guidance** — `↪ Steer` input во время стрима, лавандовые chips в timeline.
  - **QRight attachments** — multi-select в Configure agents, чипы 📎 над timeline.
  - **Webhook chip** в header при `webhookConfigured`.
  - **Smart auto-scroll**, friendly 429, no-lost-prompt, dismissible errors.
  - **Mobile sessions sidebar collapse**.
  - Mini-markdown без DOM injection (headings/lists/code/tables/blockquotes).
- `/qcoreai/analytics` — KPI tiles + by-strategy + by-provider + recent runs.
- `/qcoreai/shared/[token]` — public read-only с server-side OG/Twitter meta + 1200×630 PNG.

### Dashboard surfaces

- **Wave1Nav** — фиолетовая «QCoreAI» на каждой странице → `/multichat-engine`.
- **Home hero CTA** — ghost «QCoreAI · Multi-agent».
- **Home product buttons** — фиолетовая пилюля с badge «Multi-agent».

---

## Что осталось — следующая итерация

### Per-user webhooks (multi-tenant)
Текущий webhook env-driven, single-tenant. Для multi-tenant нужно:
- Prisma миграция: `QCoreUserWebhook { userId, url, secret, createdAt }`.
- Auth-required endpoints `GET/PUT /api/qcoreai/me/webhook`.
- В `notifyRunCompleted` лукапить URL/secret по `userId` сессии.
- UI settings-секция в `/qcoreai/multi` или отдельная страница.

### Полноценное Anthropic Tool Use
Сегодня доставлен «tool-use lite» (pre-fetch QRight в контекст). Полная
версия — multi-turn LLM tool-call loop:
- В callAnthropic поддержать `tools: [...]` в request.
- При `tool_use` block в response — выполнить tool, послать `tool_result`, продолжить.
- Стримить tool calls + results в отдельные SSE events.
- Тулзы: `read_qright_object(id)`, `list_my_qright_objects()`, дальше можно добавлять.

### WebSocket duplex (полный)
Сегодня доставлено 90% value через sidecar POST guidance. Полный duplex —
честное прерывание Writer'а мид-LLM-стрима (не на stage boundary):
- WS endpoint вместо HTTP+SSE.
- Stop писателя в середине, abort+restart с appended context.
- Полезно для длинных writer'ов, где stage boundary далеко.

### Тех-долг (без изменений)
- `npm i baseline-browser-mapping@latest -D` — чистит warning в build.
- 18 vulnerabilities в backend `npm audit` — отложено.

---

## Cheat sheet

### Локальный запуск (порты 4101/3100, параллельно с master)
```bash
cd C:/Users/user/aevion-core/frontend-qcore/aevion-globus-backend
PORT=4101 nohup npx ts-node-dev --respawn --transpile-only src/index.ts \
  > /c/Users/user/AppData/Local/Temp/qcore-backend.log 2>&1 &
disown

cd ../frontend
BACKEND_PROXY_TARGET="http://127.0.0.1:4101" nohup npx next dev -p 3100 \
  > /c/Users/user/AppData/Local/Temp/qcore-frontend.log 2>&1 &
disown
```

### Включить webhook (single-tenant deploy)
```bash
export QCORE_WEBHOOK_URL="https://your-receiver.example.com/qcore"
export QCORE_WEBHOOK_SECRET="any-strong-shared-secret"
# перезапустить backend
```

### Verify gate
```bash
cd aevion-globus-backend && ./node_modules/.bin/tsc --noEmit
cd ../frontend && ./node_modules/.bin/next build --webpack
```

### Тест mid-run guidance (после старта Sequential run)
```bash
curl -X POST http://127.0.0.1:4101/api/qcoreai/runs/<runId>/guidance \
  -H "Content-Type: application/json" \
  -d '{"text":"focus on EU regulators"}'
```

### Тест attachments
В UI: Configure agents → Attach QRight objects → выбери chip → Send. Или:
```bash
curl -X POST http://127.0.0.1:4101/api/qcoreai/multi-agent \
  -H "Content-Type: application/json" \
  -d '{
    "input": "How would you market this work to fintech buyers?",
    "strategy": "sequential",
    "qrightAttachmentIds": ["<existing-qright-object-id>"]
  }'
```
