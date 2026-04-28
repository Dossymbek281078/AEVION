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

### 1.4. (this commit) — feat(qcore): quick-find search across runs
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
| `/health` отдаёт `costCapDefaultUsd`           | ✅ (`null` без env, число с env) |

---

## 4. Что осталось (out of scope для этого PR)

### Большое — следующая итерация

- **Per-user webhook URLs** — multi-tenant вместо текущего env-based.
  Нужна модель `QCoreWebhook(userId, url, secret, events)`, UI настроек
  и fan-out.
- **Tool use** — Analyst читает QRight через существующий API. Только
  read-only, требует cross-module scope (CLAUDE.md §1).
- **WebSocket duplex / human-in-the-loop** — interrupt Writer мид-стримом,
  inject guidance.

### Тех-долг — cosmetic

- `npm i baseline-browser-mapping@latest -D` — чистит warning при build.
- 14 vulnerabilities в backend `npm audit` (1 low, 11 mod, 2 critical) —
  отложено, риск breaking.
- Tags-функционал на runs (UI tagging + filter) — search покрывает 80%
  use case, tagging — V2.

### Операционное

- PR #3 ждёт review/approve. После merge — деплой Railway + smoke-тест
  всех 4 features end-to-end на проде.
- Smoke-чеклист: `/health`, send Sequential, send Parallel, send Debate,
  refine final, выставить cap=$0.001 → проверить cap_hit.

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
