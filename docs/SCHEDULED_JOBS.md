# Фоновые задания, пишущие в репозитории

> Снято 2026-07-21 с `DESKTOP` (PRIMARY=Dosymbek2025), `Get-ScheduledTask`.
> Повод: AutoSave трижды за одну сессию закоммитил незавершённую работу под
> `chore(backup)`, и обнаружилось это случайно. Список нужен, чтобы следующая
> задача, пишущая в рабочее дерево, не стала сюрпризом.

## Главное

Из 14 задач `AEVION-*` **в git пишет ровно одна программа** — `daily-backup.sh`.
Её запускают две задачи, в разных режимах:

| Задача | Режим | Что делает |
|---|---|---|
| `AEVION-AutoSave` | `daily-backup.sh quick` | commit + push по репозиториям, без бандла |
| `AEVION-DailyBackup` | `daily-backup.sh` (полный) | то же + холодный bundle в OneDrive |

Значит правка в `daily-backup.sh` меняет поведение **обеих** — отдельно чинить
AutoSave не нужно и нельзя.

## Реестр

| Задача | Состояние | Триггер | Пишет в git | Что запускает |
|---|---|---|---|---|
| AEVION-AutoSave | Ready | по времени (30 мин) | **да** | `AEVION-TRANSFER\autosave-code.cmd` |
| AEVION-DailyBackup | Ready | ежедневно | **да** | `AEVION-TRANSFER\daily-backup.cmd` |
| AEVION-DailyPull | Disabled | ежедневно | да (если включить) | `AEVION-TRANSFER\daily-pull.cmd` |
| AEVION-PullFromPrimary | Disabled | ежедневно | да (если включить) | `AEVION-TRANSFER\pull.cmd` |
| AEVION-MemoryAutosave | Ready | ежедневно | нет | `memory-autosave.cmd` |
| AEVION-Guard | Ready | при входе | нет | `AEVION-PROTECTION\bin\aevion-guard.ps1` |
| AEVION-Verify-Daily | Ready | ежедневно | нет | `AEVION-PROTECTION\bin\sign-all.js` |
| AEVION-Autopilot-Daily | Ready | ежедневно | нет | `AEVION-AUTOPILOT\run.ps1` |
| AEVION-TabSnapshot | Running | по времени | нет | снапшот вкладок |
| AEVION-Mail-Sort | Ready | по времени | нет | почта |
| AEVION-Mail-Report | Ready | ежедневно | нет | почта |
| AEVION-Followup-Reminder | Ready | по времени | нет | напоминания |
| AEVION-MassOutreach-Gate | Ready | по времени | нет | рассылка |
| AEVION-ProductHunt-Launch | Ready | по времени | нет | запуск PH |

Две задачи `Disabled` тоже трогают git — они делают `pull`, а по памяти
`project_single_laptop_2026_06_22` pull эквивалентен откату, потому и выключены.
Не включать не разобравшись.

## Правило про активную сессию

`daily-backup.sh` делал `git add -A` + commit на любой ветке `feat/*` с
изменениями, ничего не зная о работающей сессии. Теперь:

- правки **моложе `ACTIVE_SESSION_MIN`** (по умолчанию 20 мин) считаются
  принадлежащими живой сессии. Вместо коммита на ветку снимается снапшот через
  `git stash create` (не трогает ни индекс, ни рабочее дерево) и уходит в
  `backup/wip-<repo>-<host>-<date>-<time>`;
- правки старше порога коммитятся как раньше — работа, брошенная надолго,
  по-прежнему сохраняется.

Страховка от потери данных сохранена, история сессии не перехватывается.

Сам скрипт **не под гитом** (`AEVION-TRANSFER` — не репозиторий). Откат к
доправочной версии: `AEVION-TRANSFER\daily-backup.sh.bak`.

## Как проверить, что правило работает

В `AEVION-TRANSFER\reports\autosave-latest.log` при активной сессии должна
появляться строка вида:

```
  ◐ aevion-qventure [feat/...]: правки 3м назад — сессия активна; снапшот в backup/wip-..., ветку не трогаю
```

Если её нет, а коммиты `chore(backup)` продолжают появляться — порог не
сработал, смотреть `recent_edit_minutes` в скрипте.

## Как обновлять этот список

```powershell
Get-ScheduledTask | Where-Object { $_.TaskName -like '*AEVION*' } |
  ForEach-Object { [PSCustomObject]@{ Task=$_.TaskName; State=$_.State;
    Action=($_.Actions | Select-Object -First 1 -ExpandProperty Execute) } } |
  Format-Table -AutoSize
```

Признак «пишет в git» проверяется грепом по целевому скрипту:
`grep -ciE "git (add|commit|push|checkout|reset)"`.
