# QCoreAI multi-agent — handoff (2026-04-22)

> Снимок состояния ветки `qcore-multi-agent` на конец рабочего дня.
> Делался в worktree `C:\Users\user\aevion-core\frontend-qcore\`.
> См. также `CLAUDE.md` в этом worktree — правила и границы сессии.

---

## 1. Что это

Превращение одиночного чата `QCoreAI` в **multi-agent** пайплайн с двумя стратегиями:

- **Sequential:** Analyst → Writer → Critic → (опц.) Writer v2 revision. Классический reflection-loop с гейтом APPROVE / REVISE.
- **Parallel:** Analyst → [Writer-A ‖ Writer-B] → Judge. Два Writer-а стримят **одновременно** на **разных моделях** (реальный diversity of voice), Judge выбирает лучший или синтезирует merge.

Всё с live-стримингом SSE, persistence в Postgres, сессиями/историей, multi-provider (Claude / GPT / Gemini / DeepSeek / Grok), анонимным и авторизованным режимами.

---

## 2. Что именно сделано (файлы)

### Backend (`aevion-globus-backend/`)

**Новое:**
- `src/services/qcoreai/providers.ts` — общий адаптер 5 LLM, `callProvider` (non-streaming) + **`streamProvider`** (async-generator, SSE-парсер через ReadableStream).
- `src/services/qcoreai/agents.ts` — роли Analyst/Writer/Critic + `WRITER_B_PROMPT` + `JUDGE_PROMPT` + `buildAgent`, `buildWriterB`, `buildJudge`, `parseCriticVerdict`.
- `src/services/qcoreai/orchestrator.ts` — `runMultiAgent` диспатчит по `strategy`. `runSequential`, `runParallel`. Helper `mergeStreams<T,R>` для настоящей параллельности.
- `src/services/qcoreai/store.ts` — CRUD поверх raw SQL: `ensureSession`, `listSessions`, `createRun`, `finishRun`, `insertMessage`, `buildHistoryContext`, …
- `src/lib/ensureQCoreTables.ts` — DDL bootstrap (3 таблицы + индексы + ALTER ADD COLUMN IF NOT EXISTS для совместимости).

**Изменено:**
- `src/routes/qcoreai.ts` — legacy `/chat`/`/providers`/`/health` сохранены. Добавлены `/multi-agent` (SSE), `/agents`, `/sessions*`, `/runs/:id`. Pending-stage трекинг на `Map<role|stage|instance>` для корректности параллелизма.
- `src/index.ts` — OpenAPI карта расширена.
- `prisma/schema.prisma` — зеркало `QCoreSession` / `QCoreRun` / `QCoreMessage` для документации (runtime на pg Pool, не Prisma client).

### Frontend (`frontend/`)

**Новое:**
- `src/app/qcoreai/multi/page.tsx` — multi-agent UI. SSE-стрим через `fetch`+`ReadableStream`. Toggle Sequential/Parallel. 4 роли в config-панели (writerB показывается только в parallel). Side-by-side параллельных драфтов (`groupTurns`). Instance-matching в event handlers. Mini-markdown рендер (без либ). Copy на финале. Sidebar сессий, удаление, Stop через AbortController.

**Изменено:**
- `src/app/multichat-engine/page.tsx` — лендинг с двумя карточками (Single chat + Multi-agent), ссылки на health/providers/agents endpoints.

---

## 3. API-контракт (что фронт ожидает от бэка)

```
POST /api/qcoreai/multi-agent         (SSE stream)
  Body: { input, sessionId?, strategy: "sequential"|"parallel", maxRevisions?: 0|1|2,
          overrides: { analyst, writer, writerB, critic } where each = { provider, model, systemPrompt?, temperature? } }
  Auth: Bearer optional (anonymous сессии привязываются null-userId)
  Stream events (JSON per `data:` frame):
    session · plan · agent_start · chunk · agent_end · verdict · final · error · done · sse_end

GET    /api/qcoreai/providers   — configured flag для 5 LLM
GET    /api/qcoreai/agents      — strategies[] + roles[] с дефолтами
GET    /api/qcoreai/sessions    — список (фильтр по Bearer)
GET    /api/qcoreai/sessions/:id
DELETE /api/qcoreai/sessions/:id
GET    /api/qcoreai/runs/:id    — run + упорядоченные QCoreMessage
POST   /api/qcoreai/chat        — legacy single-shot, оставлен как был
GET    /api/qcoreai/health
```

---

## 4. Схема БД

```sql
QCoreSession (id PK, userId?, title, mode, createdAt, updatedAt)
  index (userId, updatedAt DESC)

QCoreRun (id PK, sessionId FK-ish, userInput, status, error?, agentConfig JSONB,
          strategy, finalContent?, totalDurationMs?, startedAt, finishedAt?)
  index (sessionId, startedAt DESC)

QCoreMessage (id PK, runId FK-ish, role, stage?, instance?, provider?, model?,
              content, tokensIn?, tokensOut?, durationMs?, ordering, createdAt)
  index (runId, ordering)
```

Таблицы создаются лениво через `ensureQCoreTables(pool)` — первый вызов `/multi-agent` создаст их в свежей базе. Для существующих — `ADD COLUMN IF NOT EXISTS` безопасен.

**Нет FK-constraints** — каскад удаления реализован руками в `deleteSession`.

---

## 5. Как запустить завтра

```powershell
# 1. В worktree стоят junction'ы node_modules (мягкие ссылки на main worktree)
#    Они работают для tsc, но не для `next build` (Turbopack их не любит).
#    Для нормального dev-прогона поставь реальные пакеты:
cmd /c rmdir C:\Users\user\aevion-core\frontend-qcore\aevion-globus-backend\node_modules
cmd /c rmdir C:\Users\user\aevion-core\frontend-qcore\frontend\node_modules
cd C:\Users\user\aevion-core\frontend-qcore\aevion-globus-backend ; npm install
cd C:\Users\user\aevion-core\frontend-qcore\frontend ; npm install

# 2. Минимум один API-ключ в backend/.env
#    (ANTHROPIC_API_KEY даст самые хорошие дефолты: Sonnet 4 для Analyst/Writer, Haiku 4.5 для Critic/Judge)

# 3. DATABASE_URL нужен для персистентности сессий (без него пайплайн отработает, но runs не сохранятся)

# 4. Dev
cd C:\Users\user\aevion-core\frontend-qcore ; npm run dev

# 5. Открыть
#    http://localhost:3000/multichat-engine   — лендинг
#    http://localhost:3000/qcoreai            — single chat (legacy)
#    http://localhost:3000/qcoreai/multi      — multi-agent
```

**Verify gate (`npm run verify` = `build:all`):**
- Backend tsc: ✅ exit 0
- Frontend tsc на QCoreAI-файлах: ✅ 0 ошибок
- **Pre-existing** ошибка в `frontend/src/app/cyberchess/page.tsx:1206` — не из этой ветки, фикс уже есть в `cyberchess-v37-redesign` (коммиты `473fb3b`, `e7ba525`). Мерж с `main` / pick коммитов исправит. В этой сессии CyberChess не трогаем.

---

## 6. Что можно делать дальше (идеи, по приоритету)

### Quick wins
- **Token cost**: добавить pricing-table ($/1M tokens) → показать стоимость каждого run в UI. Всё уже есть в `tokensIn`/`tokensOut`.
- **Export run**: кнопка «Download JSON» и «Download Markdown» в RunCard. Данные уже в `QCoreMessage`.
- **Session rename**: inline-edit заголовка сессии (сейчас автотитулом становится первая строка запроса).
- **Regenerate**: кнопка «Rerun this prompt» на старом run → создаёт новый run в той же сессии с теми же настройками или с новыми.

### Средние
- **Debate strategy**: третья стратегия — два Writer-а с **противоположными стансами** (pro / con) + Moderator-Judge синтезирует сбалансированный ответ. Уже есть `mergeStreams`, нужен новый prompt-набор и дизъюнктные системные промпты.
- **Custom agent roles**: позволить пользователю добавлять свои роли («Researcher», «Fact-checker», «Stylist») с custom system prompts. Хранить пресеты per-user.
- **Stop-preserves-partial**: сейчас abort просто стопит stream; добавить «сохранить частичный результат» → finishRun with status=stopped.
- **Live cost dashboard**: во время streaming — бегущий счётчик токенов за текущий run.
- **Markdown table/blockquote support** в `Markdown` компоненте (сейчас — headings/lists/bold/italic/code; таблиц и `>` нет).

### Большое (новые направления)
- **Tool use** (MCP-style): Analyst может читать пользовательские `QRightObject` через существующий `/api/qright/objects?mine=1`. **Важно**: это read-only пересечение с QRight backend, к которому я сейчас не прикасаюсь по правилам сессии. Нужно заранее согласовать scope.
- **Shareable runs**: `POST /api/qcoreai/runs/:id/share` → public-токен, страница `/qcoreai/shared/[token]` с read-only таймлайном. Полезно для демо.
- **WebSocket вместо SSE**: двустронний канал позволит «human-in-the-loop» — прерывать Writer и давать дополнительные инструкции прямо в процессе стрима.

### Тех-долг
- `.claude/settings.local.json` — persnoal permissions, добавил бы в `.gitignore` если хочешь чтобы не всплывал в `git status`.
- Junction-ы `node_modules` в worktree — временные; замени реальным `npm install` перед полной сборкой.

---

## 7. Что НЕ делал и почему

Границы сессии (из `CLAUDE.md`):
- CyberChess — отдельный чат / ветка `cyberchess-v37-redesign`. Не трогал.
- Bank UI (`frontend-bank/`) — отдельная сессия. Не трогал.
- QRight / QSign / Planet / Auth / Quantum Shield / Pipeline / Coach — не трогал даже косвенно.
- `npm install` — **не запускал** без явного ОК (правило из `CLAUDE.md`). Verify делал через локальный `tsc` по junction.
- `git push` / mutations на remote — не делал. Нужно ли — спрошу при коммите.

---

## 8. Коммит (ближайший)

Одним коммитом на `qcore-multi-agent`:

```
feat(qcore): multi-agent pipeline with sequential & parallel strategies
```

Включает:
- backend: services/qcoreai/*, ensureQCoreTables, routes, OpenAPI, prisma schema mirror
- frontend: /qcoreai/multi page, /multichat-engine landing
- workspace docs: CLAUDE.md (session rules), this handoff
