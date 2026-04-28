# QCoreAI multi-agent — handoff (2026-04-28)

> Снимок ветки `qcore-multi-agent` на конец дня 2026-04-28.
> Worktree: `C:\Users\user\aevion-core\frontend-qcore\`.
> Предыдущий снапшот: `AEVION_QCORE_HANDOFF_2026-04-26.md`.

---

## 0. Релиз-готовность

✅ **PR #3** — open, https://github.com/Dossymbek281078/AEVION/pull/3
✅ **Backend `npm run build`** (tsc) — fully green после `npm install`
   (qright shamir теперь компилируется, `secrets.js-grempe` гидрирован).
✅ **Frontend `next build --webpack`** — green, 26 routes.
✅ **`npm run verify` из корня worktree** — green end-to-end.
✅ **Production safety knobs** — rate-limit (20/min/IP `/multi-agent`,
   30/min `/refine`, 60/min `/shared`) + hard cost cap.

Все backlog-пункты, не требующие новых таблиц или WS-инфраструктуры,
закрыты. Ветка готова к merge в любой момент.

---

## 1. Что добавилось 2026-04-26 → 2026-04-28

Четыре фичи, четыре пуша.

### 1.1. `c83f835` — feat(qcore): refine final answer
- `POST /api/qcoreai/runs/:id/refine` — single-pass non-streaming
  refinement поверх любого готового run'а.
  - Body: `{ instruction, provider?, model?, temperature? }`
  - Server prompt: «Apply user instruction with surgical precision,
    output ONLY refined answer».
  - Append message `role=final, stage=refinement` со своим cost+duration.
  - Update `run.finalContent`, накапливает `totalCostUsd` + `totalDurationMs`.
  - Rate-limit 30/min/IP. 409 если run streaming. 400 если нет
    `finalContent`. 502 если provider пустой ответ.
- UI: ✎ Refine на FinalCard каждой завершённой run'ы → inline textarea
  + Apply/Cancel + ⌘/Ctrl+Enter shortcut + busy/error states + green
  REFINED flash на success. Финал и totals обновляются in-place.

### 1.2. `4281a46` — fix(qcore): coerce `req.params.id` (after npm install)
- @types/express после гидрации node_modules потребовал `String()` cast.
- Тот же паттерн что в `c6356eb`, теперь применённый к `:id`.

### 1.3. (this commit) — feat(qcore): hard cost cap per run
- **Backend** /multi-agent теперь принимает body field `costCapUsd` и
  читает env `QCORE_HARD_CAP_USD` как fallback default.
- После каждого `agent_end` total сравнивается с cap. При попадании
  отправляется SSE `cost_cap_hit`, итерация generator'a прерывается,
  upstream-стримы закрываются через `return()` finalizer.
- `finishRun` принимает новый status `"capped"`. Run сохраняется с
  partial finalContent (последний agent output) — пользователь не
  теряет то, что успело прийти.
- `/health` отдаёт `costCapDefaultUsd` чтобы UI мог показать default.
- Webhook payload (`run.completed`) теперь принимает `status: "capped"`.

- **Frontend**:
  - Cost cap input в config bar (под maxRevisions, всегда видно).
    Показывает default из env. Empty = отправляем без cap (server может
    применить env default). Кнопка Clear.
  - Новый SSE handler для `cost_cap_set` и `cost_cap_hit` — обновляет
    run state, выставляет `status="capped"`.
  - Оранжевый `CAPPED · $0.20` badge в run footer.
  - FinalCard рисует partial-orange border и для capped тоже (ранее
    только для stopped).

### 1.7. — feat(qcore): V3 — WebSocket duplex + human-in-the-loop
- **Dependency**: `ws@^8.20.0` + `@types/ws` (npm install hydrated lock).
- **Server boot**: `src/index.ts` → `http.createServer(app)` +
  `attachQCoreWebSocket(server, "/api/qcoreai/ws")`.
- **`services/qcoreai/wsServer.ts`** — full duplex pipeline:
  - Wire protocol JSON over WS:
    - client→server: `start` (1×), `interject` (N×), `stop`, `ping`
    - server→client: same OrchestratorEvent payloads as SSE +
      `cost_cap_set`, `cost_cap_hit`, `tool_context`, `guidance_applied`,
      `ack`, `pong`, `sse_end`
  - Auth via `?token=...` query param (browsers can't set Authorization
    on WS) — see new `verifyBearerToken()` in `lib/authJwt.ts`.
  - 30 upgrades/min/IP rate-limit (in-memory token bucket).
  - 64 KB max payload; guidance queue capped at 8 pending entries × 4 KB.
  - End-of-run finalization mirrors the SSE handler exactly: `finishRun`
    with status (done|stopped|error|capped), `renameSessionIfDefault`,
    `touchSession`, webhook fan-out (env + per-user via
    `getUserWebhookForRun`).
  - `guidance_applied` events are persisted as a synthetic `role=user
    stage=guidance` message → shows up in the trace and exports.

- **`services/qcoreai/orchestrator.ts`** — interjection hooks at every
  stage boundary:
  - New input field `drainPendingGuidance?: () => string | null`. Polled
    BEFORE each downstream stage (analyst→writer, writer→critic,
    critic→revision, parallel writers, judge, debate
    advocates+moderator). 7 injection points across all 3 strategies.
  - Helpers: `pollGuidance(input, role, stage)` + `spliceGuidance(base,
    text)` keep each stage 5 lines lighter.
  - New event `guidance_applied { nextRole, nextStage, text }` yielded
    when guidance lands.
  - Drain semantics: each call returns latest queued guidance and
    clears the queue, so guidance never re-applies.

- **Frontend** (`/qcoreai/multi`):
  - State: `useWS` toggle, `wsRef`, `injectOpen`, `injectText`,
    `pendingGuidance`. RunState extended with `transport: "sse"|"ws"`
    and `guidanceLog[]`.
  - `applyStreamEvent(payload, ctx)` factored out of SSE switch — used
    by BOTH SSE and WS paths so all rendering stays identical.
  - WS path opens connection (with `?token=` if JWT in localStorage),
    sends `start`, listens, awaits close. Stop sends `{type:"stop"}`
    over the wire AND calls `ws.close()`.
  - `interject(text)` sends `{type:"interject", text}`; UI flags
    `pendingGuidance` count via `ack` events; clears on
    `guidance_applied`.
  - Config bar adds **"Mid-run guidance (WS)"** checkbox (purple
    accent).
  - Stop button replaced by Stop-stack while WS run is active: Stop on
    top, **`💬 Inject (N queued)`** below. Click → inline form below
    the textarea (Enter to send, Esc to close).

- **Tests** — `tests/orchestratorGuidance.test.ts` (5 tests with
  fake-streamed providers): sequential drain-once splices into Writer
  prompt only; no-guidance leaves all prompts clean; empty-string drain
  treated as no-op; parallel guidance reaches BOTH writer prompts;
  debate guidance flows once into Pro+Con and a fresh queue entry
  reaches the Moderator.

Suite: 82 → **87 tests** in 11 files.
- **Backend** `services/qcoreai/qrightContext.ts` — `fetchQRightContext(userId, email)`
  читает `QRightObject` напрямую через shared pool (read-only, не
  трогаем qright роутер — per CLAUDE.md §1 spirit). Возвращает
  markdown-блок до 25 объектов: name, kind, status, id, createdAt.
  Best-effort: при отсутствии auth, пустой выборке, или DB error —
  возвращает "" / "no objects" без crash'а.
- **Route** /multi-agent body field `useQRightContext: boolean`. Если
  true и есть auth, контекст-блок префиксуется к userInput перед
  передачей в orchestrator. SSE event `tool_context` извещает UI.
- **UI** — toggle "Tool: QRight context" в config bar (рядом с cost cap).
  В run header чип `🔧 tool: qright · N chars` после старта.
- 5 unit-тестов на helper (auth-required, DB-fail-graceful,
  empty-result-message, full-format, both-predicates).

### 1.5. — feat(qcore): run tagging + per-user webhook URLs (V2)
- **Run tagging**:
  - DDL: `QCoreRun.tags TEXT[] DEFAULT '{}'` + GIN index.
  - `setRunTags(runId, userId, tags)` нормализует (trim/dedupe/cap 16
    тегов × 32 символа), enforce ownership.
  - `searchRuns` дополнительно матчит tags (ILIKE по `unnest(tags)`),
    `matched: "tag"` и preview `tag · <matched-tag>`.
  - Route `PATCH /api/qcoreai/runs/:id/tags` — owner-only.
  - UI: TagStrip компонент в run footer — chips с `×` для удаления,
    inline `+ Tag` input (Enter/blur to save, Escape to cancel,
    16-tags max, 32-char max). Persists через PATCH.

- **Per-user webhook URLs** (multi-tenant):
  - DDL: `QCoreUserWebhook(userId PRIMARY KEY, url, secret, ...)`.
  - Store: `getUserWebhook`, `setUserWebhook` (upsert preserves
    createdAt), `deleteUserWebhook`, `getUserWebhookForRun` (JOIN на
    `QCoreSession.userId`).
  - Routes (auth required, 401 без bearer):
    - `GET /api/qcoreai/me/webhook` → `{ configured, url?, hasSecret? }`.
    - `PUT /api/qcoreai/me/webhook { url, secret? }` — http(s) обязателен.
    - `DELETE /api/qcoreai/me/webhook`.
  - `notifyRunCompleted` теперь принимает `extraTargets[]` и
    fans out через `Promise.allSettled`. На каждом запросе headers
    `X-QCore-Origin: env|user` чтобы receiver различал источники.
  - В `/multi-agent` после `finishRun` берётся owner's webhook через
    `getUserWebhookForRun` и приправляется к env target. Failures
    swallowed.
  - UI: `⚙ Settings`/`⚙ My webhook` chip в header (зелёный когда
    настроен). Клик → modal с URL + optional HMAC secret + Save/Disable/
    Cancel. 401 detected → friendly "Sign in first" message.

### 1.4. — feat(qcore): quick-find search across runs
- **Backend**:
  - `searchRuns(userId, query, limit=30)` в store: ILIKE substring match
    через `userInput`, `finalContent`, parent `session.title`. Возвращает
    `SearchHit[]` с preview (40 символов до и после совпадения).
    Работает в обоих режимах — Postgres ILIKE и in-memory `includes`.
  - `GET /api/qcoreai/search?q=...&limit=30` — auth-aware (только runs
    текущего user'а или anonymous).
- **Frontend**: search input в сайдбаре над списком сессий.
  - Debounced 300ms на изменение, AbortController отменяет в-полёте при
    новом запросе.
  - Результаты: `sessionTitle · matched=input|final|title · preview`,
    клик загружает соответствующую session.

---

## 2. Финальный feature-set ветки

### Backend

- `POST /api/qcoreai/chat` — single-chat, 5 провайдеров.
- `POST /api/qcoreai/multi-agent` — SSE мульти-агентный пайплайн:
  - Sequential / Parallel / Debate с реальной параллельностью стримов.
  - **Hard cost cap**: env + per-request, status "capped".
  - Persistence в Postgres + in-memory fallback.
  - Pricing engine + per-message и per-run cost rollup.
- `POST /api/qcoreai/runs/:id/refine` — single-pass refinement.
- `GET /api/qcoreai/search?q=...` — quick-find по userInput / finalContent / title.
- Public read-only `/shared/:token` + dynamic 1200×630 OG PNG.
- Rate-limits на трёх endpoints (отдельные buckets).
- `/api/qcoreai/analytics` — KPI, by-strategy, by-provider, by-model, recent.
- `/api/qcoreai/runs/:id/export?format=md|json` — снапшот run'а.
- Rename / Rerun / Stop-partial.
- **Webhook на run.completed** — env-driven, HMAC-signed, статусы
  `done|stopped|error|capped`.

### Frontend (`/qcoreai/multi`)

- 3 стратегии + per-role config + revision picker.
- **Hard cost cap input** в config bar.
- Live cost / tokens / duration badge.
- Per-turn cards с role/stage/instance стилями.
- Side-by-side parallel и debate writer drafts.
- Sessions sidebar с **quick-find search** + mobile collapse.
- Final answer с copy / share / export / **edit-and-resend** / **rerun** /
  **refine** / status-aware partial-orange border.
- Compare-all-3 mode + честный Stop.
- Saveable presets в localStorage.
- Workspace export/import as JSON file.
- Slash-command palette в input.
- Webhook chip в header при `webhookConfigured`.
- Smart auto-scroll, friendly 429 + Retry-After, dismissible errors.
- Mini-markdown без DOM injection (headings, lists, code, tables, blockquotes).

### Surface area за пределами `/multi`

- `/multichat-engine` — лендинг (Single vs Multi-agent карточки).
- `/qcoreai/analytics` — KPI tiles + charts.
- `/qcoreai/shared/[token]` — public read-only с OG/Twitter meta.
- Wave1Nav «QCoreAI» chip (фиолетовый) на каждой странице.
- Home hero CTA + product button с «Multi-agent» badge.

---

## 3. Verify gate (2026-04-28)

| Проверка                                       | Результат |
|------------------------------------------------|-----------|
| Backend `tsc --noEmit`                         | ✅ 0 errors (после `npm install`) |
| Frontend `tsc --noEmit`                        | ✅ 0 errors |
| Backend `npm run build`                        | ✅ |
| Frontend `next build --webpack`                | ✅ 26 routes |
| `npm run verify` из корня worktree             | ✅ |
| Backend `npm test` (vitest)                    | ✅ 87/87 passed (44 new QCore tests) |
| `/health` отдаёт `costCapDefaultUsd`           | ✅ (`null` без env, число с env) |
| `scripts/qcore-smoke.sh` against local backend | ✅ (см. §6) |

### Test coverage added

- `tests/qcoreaiStore.test.ts` (9 tests): session ownership/isolation,
  ensureSession reuse, createRun + insertMessage + getMaxOrdering,
  finishRun (incl. status="capped"), applyRefinement накапливает
  cost+duration, shareRun/unshareRun идемпотентность, searchRuns matches
  на input/final/title с cross-user изоляцией, listRuns sort.
- `tests/qcoreai.route.test.ts` (15 tests): /health поля, /providers,
  /pricing, /agents, /sessions empty, input validation на /chat,
  /multi-agent, /refine, /runs/:id, /shared/:token, /search edge cases.

Тесты прогоняются полностью in-memory (mock pool через vi.mock —
SELECT 1 пробит → store falls back to Maps). Не нужны ни LLM ключи, ни
PG для тестов. ~1 секунда runtime.

---

## 4. Что осталось (out of scope для этого PR)

### Большое — следующая итерация

(пусто — V3 WebSocket duplex / human-in-the-loop тоже шипнут, см. §1.7)

### Тех-долг — cosmetic

- `npm i baseline-browser-mapping@latest -D` — чистит warning при build.
- 14 vulnerabilities в backend `npm audit` (1 low, 11 mod, 2 critical):
  все в зависимостях qright-v2 (`opentimestamps` → `bitcore-lib` →
  `bn.js`/`elliptic`) и Prisma dev tool (`@hono/node-server` через
  `@prisma/dev`, грузится только при миграциях). НЕ касаются QCore code
  paths. `npm audit fix` хотел downgrade `opentimestamps` до v0.0.0
  (broken), `--force` нужен major Prisma upgrade — обе опции рискованны
  и вне scope §1.
- Tag-фильтр в сайдбаре (отдельный chip-picker рядом с search input) —
  сейчас теги матчатся через free-text search, что покрывает 95% use
  case; выделенный фильтр — micro-polish для V3.

### Операционное

- PR #3 ждёт review/approve.
- Pre-deploy gate: `npm test` зелёное → review approved → merge.
- Post-deploy: `QCORE_BASE=https://api.aevion.io ./scripts/qcore-smoke.sh`
  должен дать `all checks green`.

---

## 5. Cheat sheet — запуск локально

### Backend (port 4101)
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

### Включить cost cap
```bash
# Глобальный default для всех runs:
export QCORE_HARD_CAP_USD="0.50"

# или per-request: { ...body, costCapUsd: 0.20 }
```

### Включить webhook
```bash
export QCORE_WEBHOOK_URL="https://your-receiver.example.com/qcore"
export QCORE_WEBHOOK_SECRET="any-strong-shared-secret"
```

После рестарта `/health` отдаст `webhookConfigured: true` +
`costCapDefaultUsd`.

---

## 6. Smoke test (post-deploy)

```bash
# Local
QCORE_BASE=http://127.0.0.1:4101 ./aevion-globus-backend/scripts/qcore-smoke.sh

# Production (Railway)
QCORE_BASE=https://api.aevion.io ./aevion-globus-backend/scripts/qcore-smoke.sh

# With auth (для тестов изоляции /search)
QCORE_BASE=https://api.aevion.io \
  QCORE_BEARER="$(cat ~/.aevion-jwt)" \
  ./aevion-globus-backend/scripts/qcore-smoke.sh
```

Проверяет 22 контракта в 6 секциях: meta endpoints, /health поля,
input validation, /search, OPTIONS/CORS, rate-limit headers. Exit 0 если
all green; non-zero c per-check FAIL detail иначе. Безопасно
прогонять на проде — не создаёт runs, не трогает биллинг.
