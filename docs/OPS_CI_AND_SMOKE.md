# Операционные заметки: CI и смоук-порты

> Собрано 2026-07-22 по граблям, на которые ушло время в реальной сессии.
> Два независимых класса ошибок, оба воспроизводимы, оба дёшево обходятся.

## 1. CI не запускается на stacked-PR (база не `main`)

### Симптом

PR открыт, но обязательные чеки `Backend (tsc + integration tests)` и
`Frontend (next build)` **не появляются**, а `gh pr merge` отвечает
`the base branch policy prohibits the merge`. Vercel-чек при этом зелёный —
кажется, что «почти готово».

### Причина

`.github/workflows/ci.yml` триггерится на:

```yaml
on:
  pull_request:
    branches: [main, master, develop]
```

Фильтр `branches` — это фильтр **целевой** ветки PR. Если PR открыт с базой
на соседнюю `feat/*` ветку (stacked PR), событие не матчит фильтр и CI **не
запускается вовсе**. Смена базы на `main` postfactum событие CI не будит —
`edited` в списке типов не значится.

### Обход (проверено)

Переоткрыть PR — событие `reopened` входит в дефолтные типы `pull_request` и
запускает workflow:

```bash
gh pr close <N>  && sleep 1 && gh pr reopen <N>
```

После этого чеки прогоняются (~5 мин на `next build`), и PR можно мержить.

### Мерж стека по порядку

Авто-мерж в репозитории **выключен** (`enablePullRequestAutoMerge` = false),
так что «поставить и забыть» через `gh pr merge --auto` не выйдет. Рабочий
паттерн — фоновый скрипт, который поллит обязательные чеки и мержит по
зелёному, строго по порядку стека (родитель раньше ребёнка). Образец —
`scratchpad/merge-pr.sh` этой сессии: ждёт `Backend`+`Frontend` = SUCCESS,
останавливается при первом FAILURE.

### Настоящий фикс (follow-up, требует workflow-scope)

Убрать фильтр `branches` у `pull_request` в `ci.yml`, чтобы CI шёл на любой
PR независимо от базы. Осторожно: коммит в `.github/workflows/` без
workflow-scope блокирует push (см. память `feedback_aevion_workflow_push`).

## 2. Смоук-порты: проверяй тот сервер, что думаешь

### Симптом

Смоук «падает» на проверке, которой в коде нет; или наоборот проходит, хотя
правку не подхватил. Реальная причина — запрос ушёл в **чужой** backend или
в **застрявший** старый процесс на том же порту.

Дважды за сессию: `qventure-smoke.js` по умолчанию бил в `:4001`
(`BASE` дефолт), где крутился backend параллельной сессии со старой сборкой;
и порт `:4055` держал недоубитый прежний процесс, из-за чего новый `tsx`
не забиндился и проверялся старый код.

### Закреплённые порты для локальных смоуков QVenture

| Что | Порт | Хранилище | Запуск |
|---|---|---|---|
| backend (этот worktree) | `4055` | in-memory (без Postgres) | `PORT=4055 npx tsx src/index.ts` |
| frontend dev (рендер-тест) | `3057`+ | — | `npx next dev -p 3057` |
| smoke | — | — | `BASE=http://127.0.0.1:4055 node scripts/qventure-smoke.js` |

**Всегда** передавай `BASE` явно — дефолт `:4001` почти наверняка чужой.

### Ритуал перед запуском смоука (снимает оба класса)

```bash
# 1. Убить любой процесс, слушающий целевой порт (Windows/PowerShell):
powershell -Command "Get-NetTCPConnection -LocalPort 4055 -State Listen -ErrorAction SilentlyContinue | \
  ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }"

# 2. Поднять свой backend и дождаться health (until-loop, без слепого sleep):
PORT=4055 npx tsx src/index.ts > /tmp/qv.log 2>&1 &
until curl -s --max-time 2 http://127.0.0.1:4055/api/qventure/health >/dev/null; do sleep 2; done

# 3. Смоук с ЯВНЫМ BASE:
BASE=http://127.0.0.1:4055 node scripts/qventure-smoke.js
```

Признак, что бьёшь не туда: `curl :PORT/api/qventure/health` возвращает
`storage: postgres`, хотя локально ты поднимал in-memory — значит это чужой
сервер, а не твой.
