# QCoreAI multi-agent — handoff (2026-04-25)

> Снимок состояния ветки `qcore-multi-agent` на конец рабочего дня 2026-04-25.
> Worktree: `C:\Users\user\aevion-core\frontend-qcore\`.
> Предыдущий снапшот: `AEVION_QCORE_HANDOFF_2026-04-24.md`.

---

## 1. Что сделано сегодня (2026-04-25)

Один коммит — закрыт последний реальный abuse-вектор перед merge:

- **`448d730`** — `feat(qcore): rate-limit on /multi-agent (20 req/min/IP)`
  - `/multi-agent` сжигает LLM-токены ($0.01–$0.03 за run), а лимит стоял
    только на `/shared`. Теперь жёстче: 20 runs/min/IP → потолок ~$0.60/min/IP.
  - Переиспользует существующий `lib/rateLimit.ts` (in-process, без зависимостей).
  - Отдельный bucket: `keyPrefix: "qcore-multi-agent"` (не делит окно с `/shared`).
  - 429 + `Retry-After` + `X-RateLimit-*` headers — идентичный pattern с `/shared`.

**Всего на ветке: 7 коммитов.** 6 из них уже на `origin/qcore-multi-agent`,
сегодняшний `448d730` — локальный, ждёт push'а перед merge.

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
