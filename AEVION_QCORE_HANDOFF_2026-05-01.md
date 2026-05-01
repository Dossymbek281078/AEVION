# AEVION QCoreAI — Handoff 2026-05-01

> Зафиксировано в конце сессии на Opus 4.7. Следующая сессия может быть на Sonnet —
> это нормально, всё нужное здесь, в `MEMORY.md` и в `git log`.

---

## TL;DR

**Ветка `qcore-iter-7-search` устарела.** Её единственный коммит `4ef14a1`
(run search ILIKE-based, debounced sidebar) полностью перекрыт уже смерженным
**PR #20 «QCoreAI V4»** (commit `9bf574c` на main).

**Ничего не потеряно:**
- `4ef14a1` живёт на `origin/qcore-iter-7-search` (бэкап на GitHub).
- Сама функциональность уже в `main` через V4 — и шире (см. ниже).

**Что работает на planet прямо сейчас (на main):**
- `GET /api/qcoreai/search?q=&limit=` — серверный эндпоинт.
- `searchRuns(userId, q, limit)` в `services/qcoreai/store.ts` — ищет по
  `userInput` / `finalContent` / `session.title` / `tags` (iter-7 искал
  только по userInput/finalContent).
- Sidebar quick-find с дебаунсом в `frontend/src/app/qcoreai/multi/page.tsx`.

То есть для других модулей planet'ы (QRight, QSign, Bureau, Planet
Compliance) фича search **уже доступна** через смерженный `main`. Никакой
дополнительной интеграции делать не надо.

---

## Почему iter-7 не PR'нули

При попытке `git rebase origin/main` из этой сессии — конфликты в:
- `aevion-globus-backend/src/routes/qcoreai.ts` (на main уже импортируется
  `searchRuns` для другого, более нового определения роута)
- `frontend/src/app/qcoreai/multi/page.tsx` (на main уже есть `searchQuery`,
  `searchResults`, `searchBusy`, debounced effect — те же имена, та же логика)

Сигнатура функции тоже разная: iter-7 = `searchRuns(q, userId, limit)`;
main = `searchRuns(userId, q, limit)`. Это два независимых решения одной
задачи, и main победил.

---

## Что делать дальше

**Опция А — закрыть ветку (рекомендуется):**
```
git branch -D qcore-iter-7-search                    # локально
git push origin --delete qcore-iter-7-search         # на GitHub (нужен ОК пользователя)
```
После этого worktree надо переключить или удалить:
```
git worktree remove C:/Users/user/aevion-core/frontend-qcore   # из корневого aevion-core
```
Или просто внутри этого worktree:
```
git fetch origin && git checkout -b qcore-iter-8-<topic> origin/main
```

**Опция Б — оставить ветку как историю**, не PR'ить, не мерджить.
Всё равно работает: коммит на origin как memo, но в активной разработке не участвует.

---

## Если продолжаем QCore — следующая итерация

Базироваться от свежего `origin/main` (там уже шипнуто 9 PR'ов QCore через
26.04, плюс куча работы по другим модулям). Темы из CLAUDE.md §3 / прошлого
handoff §6, ещё не закрытые:

- **Quick wins:** export run trace в Markdown / JSON, теги вручную в UI,
  «pin session» закрепление в сайдбаре.
- **Средние:** Debate-стратегия (третий пайплайн рядом с Sequential/Parallel),
  user-defined judge prompts, A/B сравнение моделей для одной задачи.
- **Большое:** воркспейсы (несколько пользователей делят сессии),
  «share & comment» по runs наружу.
- **Тех-долг:** rate-limits per-user, audit-лог изменений presets, clean
  старых in-memory путей в `store.ts` теперь, когда Postgres всегда есть.

Точный выбор — за пользователем. Ничего из этого не начато.

---

## Как продолжить работу в новой сессии

1. **Открыть Claude Code в этом worktree:**
   `C:\Users\user\aevion-core\frontend-qcore\`
   (или открыть `aevion-core` корень и работать из него — `gh pr merge`
   из корня не имеет проблемы с занятым main).

2. **Переключить модель на Sonnet:** в чате Claude Code набрать
   `/model` и выбрать `claude-sonnet-4-6`. Контекст сессии не теряется
   при переключении.

3. **Прочитать перед началом:**
   - `C:\Users\user\aevion-core\frontend-qcore\CLAUDE.md` — границы сессии.
   - Этот handoff (`AEVION_QCORE_HANDOFF_2026-05-01.md`).
   - `AEVION_QCORE_SHIPPED_2026-04-26.md` — что уже шипнуто.
   - `git log --oneline -20 main` — что прилетело на main с тех пор.

4. **Memory:** глобальная memory в
   `C:\Users\user\.claude\projects\C--Users-user-aevion-core\memory\MEMORY.md`
   обновлена сегодня — ссылка на этот handoff и пометка что iter-7 obsolete.
