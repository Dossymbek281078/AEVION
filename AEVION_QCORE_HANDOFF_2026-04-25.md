# QCoreAI multi-agent — handoff (2026-04-25)

> Снимок состояния ветки `qcore-multi-agent` на конец рабочего дня 2026-04-25.
> Worktree: `C:\Users\user\aevion-core\frontend-qcore\`.
> Предыдущий снапшот: `AEVION_QCORE_HANDOFF_2026-04-24.md`.

---

## 1. Что сделано сегодня (2026-04-25)

Четыре коммита — закрыт abuse-вектор, отполирован UI до релизного состояния,
разблокирован prod-build после апгрейда Next 16:

- **`448d730`** — `feat(qcore): rate-limit on /multi-agent (20 req/min/IP)`
  - `/multi-agent` сжигает LLM-токены ($0.01–$0.03 за run), а лимит стоял
    только на `/shared`. Теперь жёстче: 20 runs/min/IP → потолок ~$0.60/min/IP.
  - Переиспользует `lib/rateLimit.ts`. Отдельный bucket `qcore-multi-agent`.
  - 429 + `Retry-After` + `X-RateLimit-*` headers — идентичный pattern с `/shared`.

- **`1b8283d`** — `docs(qcore): handoff 2026-04-25`. Текущий файл.

- **`bc7b65b`** — `feat(qcore): release-grade UI polish on /qcoreai/multi`.
  Шесть связанных UX-правок в `frontend/src/app/qcoreai/multi/page.tsx`:
  1. **Умный auto-scroll** — тайм-лайн больше не выдёргивает viewport, когда
     пользователь поднялся читать. Если он >80px от низа — auto-scroll пауза.
  2. **Дружелюбный 429** — читаем `Retry-After`, показываем
     «Rate limit reached (20 runs/min/IP). Try again in Ns.», compare-all бросает.
  3. **Не теряется prompt при ошибке** — `setInput("")` теперь возвращает
     текст обратно, если запрос упал ДО открытия SSE.
  4. **Stop отменяет остаток compare-all** — раньше после Stop цикл всё равно
     отстреливал оставшиеся 2 стратегии. Теперь честный `compareAbortRef`.
  5. **Dismissible global error** — `×` рядом с баннером, `aria-label`.
  6. **Описание стратегии всегда видно** — однострочник под пиллами,
     меняется live при переключении (раньше прятался в Config).

- **`edda67b`** — `fix(globus): tighten [id]/page params types for Next 16 build`.
  Pre-existing breakage от апгрейда Next до 16.0.10: `params: Promise<T> | T`
  больше не валиден (PageProps generic). Code уже await'ил оба, так что
  union был декоративный — снят. Тот же приём что `b998211` для cyberchess.
  Без этого `next build --webpack` падал на проверке типов.

**Всего на ветке: 10 коммитов** (8 запушены, 2 свежих перед push'ом):

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
```

```
qcore-multi-agent:
  73fcfdf  feat(qcore): multi-agent pipeline with sequential & parallel strategies
  af0ce8d  feat(qcore): debate strategy + pricing/cost engine + run export + rename + rerun + stop-partial
  16f8309  feat(qcore): shareable public runs + analytics dashboard + compare-all-strategies
  aa1bde6  feat(qcore): in-memory fallback store + dev verified end-to-end
  f91eb5d  feat(qcore): rate-limit on /shared + SEO OG tags on shared pages
  b998211  fix(cyberchess): drop tautological tab!=="analysis" comparison (unblock next build)
  7761d23  docs(qcore): production-ready handoff 2026-04-24
  448d730  feat(qcore): rate-limit on /multi-agent (20 req/min/IP)   ← локальный
```

---

## 2. Verify gate (2026-04-25)

| Проверка | Результат |
|----------|----------|
| Backend `tsc --noEmit` | ✅ 0 errors |
| Backend up на PORT=4101 | ✅ `/health` отвечает (storage: in-memory из-за PG password reset) |
| 20× POST `/multi-agent` `{}` | ✅ 400 (input required), `X-RateLimit-Remaining` 19→0 |
| 21-й POST | ✅ 429 + `Retry-After: 56` |
| `/shared` лимит не пострадал | ✅ отдельный keyPrefix → независимое окно |
| Frontend `next build --webpack` | ✅ 25 routes, prod build clean |
| `/qcoreai/multi` UX-правки | ✅ компилируются, тип-ассоциации на месте |

> PG не был поднят в этой сессии (пароль слетел снова), но storage-fallback
> прозрачно ушёл в in-memory — ровно то, для чего его и встраивали в
> `aa1bde6`. Если завтра PG нужен — `reset-pg-password.ps1` из Admin PowerShell.

---

## 3. Что осталось (не блокирует)

### Сразу перед merge

- **Push сегодняшнего коммита** — `git push` (запрещён в правилах сессии без явного ОК пользователя).
- **Открыть PR** — ветка запушена с 2026-04-24, URL остаётся:
  https://github.com/Dossymbek281078/AEVION/pull/new/qcore-multi-agent

### Удобство / growth (из вчерашнего §4)

- **Custom agent presets per-user** — сохраняемые именованные роли.
- **Regenerate in session** — кнопка переделать last run с другим prompt'ом.
- **Webhook on run done** — внешние интеграции.

### Большое

- **WebSocket duplex** — human-in-the-loop, прерывание Writer мид-стримом.
- **Tool use** — Analyst/Writer читает QRight через существующий API.

### Тех-долг (без изменений с 2026-04-24)

- Pre-existing `baseline-browser-mapping` warning на сборке.
- 18 vulnerabilities в backend `npm audit`.

---

## 4. Замечания по dev-окружению

- **node_modules в worktree backend** теперь линкован junction'ом
  на master `C:\Users\user\aevion-core\aevion-globus-backend\node_modules`.
  Это позволило прогнать `tsc --noEmit` без отдельного `npm install`.
  Junction скрыт от git (`node_modules` в `.gitignore`). Если deps в master
  поменяются — junction подхватит автоматически.

- Запуск backend через `nohup npx ts-node-dev` остаётся единственным
  стабильным способом на этом Windows setup'е (см. handoff 2026-04-24 §2).
