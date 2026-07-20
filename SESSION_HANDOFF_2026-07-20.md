# Session handoff — 2026-07-20 (settings fix → paywall incident+guard → worktree audit → docs corrections)

Долгая сессия в `aevion-build` (изначально ветка `feat/paywall-batch`, оказавшаяся мёртвой). Начали с битого `.claude/settings.local.json`, закончили полным аудитом ~54 `aevion-*` worktree-директорий и двумя раундами исправления собственных ошибок в документации по пейволлу.

---

## Как продолжить на другой машине

```powershell
cd C:\Users\user\aevion-core
git fetch --prune origin
git checkout main
git pull --ff-only origin main
claude
```

Первое сообщение Claude:

> Прочитай `SESSION_HANDOFF_2026-07-20.md` в `aevion-build`. PR #706 может быть
> ещё не смерджен (доводил CI) — проверь `gh pr checks 706`, смерджи если
> зелёный. Дальше — либо CyberChess (недавняя активность, не проверялась),
> либо qright/qsign free-quota enforcement (обещано на `/pricing/api-pricing`,
> не реализовано в backend — см. раздел ниже).

---

## Что сделано в этой сессии

### 1. Инфраструктура сессии (не про код AEVION)

| Что | Где |
|---|---|
| Починен битый `.claude/settings.local.json` (незакрытые git-конфликт-маркеры) | `aevion-build/.claude/settings.local.json` |
| Continuous session-autosave — лог состояния на случай обрыва связи | `~/.claude/hooks/session-autosave.js` + `session-start-restore.js`, хуки `PostToolUse`/`SessionStart` в `~/.claude/settings.json` |
| Proactive next-steps — Stop-хук + привычка заканчивать блок готовыми промтами | `~/.claude/hooks/session-stop-nudge.js`; память `feedback_proactive_next_steps.md`, `feedback_continuous_session_autosave.md` |
| Railway CLI аутентификация | Токен `AEVION-Claude-CLI` создан на railway.app, используется как `RAILWAY_API_TOKEN` (не `RAILWAY_TOKEN` — это разные переменные для account-scoped vs project-scoped токенов) |

### 2. Sentry gap-fill — **PR #624** (замерджен)
`captureQCoreAIError` довели с 16 до 232/232 реальных catch-блоков в `qcoreai.ts`, `captureMultichatError` с 13 до 15/15 в `multichat.ts`.

### 3. Master plan reconciliation — **PR #632** (замерджен)
`docs/AEVION_MASTER_PLAN.md`: закрыты устаревшие ⚠ (qbuild i18n, Sentry), §2 инвентарь ворктри сверен с реальным диском, добавлено жёсткое правило "один ворктри на проект, §2 — источник правды".

### 4. Пейволл-флип + инцидент + guard

- Обнаружили: прод уже частично гейтился (`PAYWALL_MODULES=qfusionai,multichat-engine,healthai,qai,qlearn,qnews`, 6 модулей) — не 0, как думали по докам.
- Добавили `qcoreai` в список (аддитивно) — **ошибка**: `docs/PAYWALL_FLIP_READINESS.md` уже на main прямо говорил, что `qcoreai` намеренно не гейтится (free tier обещает 100k токенов/мес, `includedIn` начинается с `medium`). `qcoreai` был enforced ~44 минуты, ловили 402 у реальных бесплатных пользователей. Откатили сразу после обнаружения.
- **PR #693** (замерджен): `planGate.ts` — `UNSAFE_TO_GATE` set (`qcoreai`/`qright`/`qsign`) теперь server-side фильтрует эти id из enforcement независимо от `PAYWALL_MODULES`, с одноразовым `console.error`. `paywall-policy-smoke.js` — независимая ассерция того же инварианта, подключена в daily-cron (`all-smokes.js`, 08:00 UTC). Тесты `planGate.test.ts` тоже поправлены — старые тесты буквально проверяли то поведение, что вызвало инцидент.

### 5. Worktree-аудит и уборка (~54 директории `aevion-*`)

| Категория | Итог |
|---|---|
| Пустые / не git-репозитории | 15 удалено напрямую |
| Подтверждено 0 уникальных коммитов vs main | `aevion-ar8`, `aevion-explore`, `aevion-vt` — удалены |
| Контент уже слит в main (проверено лично, не по commit message) | `aevion-qbuild-fix`, `aevion-qsign`, `aevion-smeta-iso` — удалены |
| Реальный незалитый код — портирован в чистые PR, не мерджем целой ветки | `aevion-i18n-mapreality` → **PR #654**, `aevion-i18n-qgood` → **PR #667**, `aevion-bureau` → **PR #672** (`protect-batch`, verify-audit-log, seed-скрипт, CSV/lookup эндпоинты) — все три оригинальные ветки удалены после мерджа |
| ~18 "abandoned MVP" веток (Tier 5 модули: deepsan/healthai/kidsai/lifebox/qfusionai/qgood/qlife/qpersona/qrenew2/qtradeoffline/shadownet/startupx/voe/i18n-mapreality/i18n-qgood/mapreality/psyapp/bureau) | удалены после проверки содержимого — main их либо полностью содержит, либо содержит больше (Wave 3 prod-hardening sweep их пересобрал) |
| `aevion-qrenew` | **НЕ трогать** — живая работа другого агента (DevHub codegen), коммиты сегодняшние |

**Важный урок (два раза за сессию):** commit message похожий на "уже что-то смерджено" — не доказательство. `aevion-qsign` и `aevion-smeta-iso` изначально выглядели избыточными по сообщению коммита, но реальный `git diff` показал независимый, неслитый код. Всегда сверять содержимое, не название.

### 6. Docs-корректность — два раунда

- **PR #701** (замерджен): зафиксировал итоги пейволла + уборки в `AEVION_MASTER_PLAN.md` / `PAYWALL_FLIP_READINESS.md`. Содержал ошибку: написал "once qcoreai token-metering ships, remove qcoreai from UNSAFE_TO_GATE".
- Расследование вопроса пользователя про NVIDIA API вскрыло: (a) QCoreAI уже имеет широкий бесплатный флот провайдеров (groq/cerebras/openrouter/gemini-free/…, `{input:0,output:0}`), NVIDIA Nemotron уже доступен через OpenRouter; (b) токен-метеринг для qcoreai **уже реализован и включён на проде** (`lib/qcoreQuota.ts`, PR #463, `QCOREAI_FREE_QUOTA=1` подтверждено на Railway) — доки были неверны.
- **PR #706** (⏳ CI в процессе на момент записи, `gh pr checks 706`): исправляет PR #701 — `UNSAFE_TO_GATE` и `qcoreQuota.ts` это ДВА разных механизма (общий гейт модуля vs токен-квота), qcoreai должен остаться в `UNSAFE_TO_GATE` навсегда, а не "до появления метеринга".

### 7. Найдено, но НЕ исправлено — qright/qsign free-quota enforcement gap

`/pricing/api-pricing` публично обещает конкретные месячные бесплатные лимиты:
`qsign/sign` 100/мес, `qsign/verify` 1000/мес, `qsign/batch` 10/мес, `qright/register` 10/мес.
В backend этого учёта **нет вообще** — только anti-abuse rate-limit (60-240 запросов/**минуту**, другой порядок величины) и несвязанный total-cap "10 вебхуков на пользователя". В отличие от инцидента с qcoreai, тут не риск для пользователей, а утечка revenue (можно бесплатно превышать рекламируемый лимит бесконечно). Не реализовывал — не было явного запроса на это, только на диагностику.

---

## PR-лог (в порядке мерджа)

#624, #632, #654, #667, #672, #693, #701, #706 (последний — в процессе CI на момент записи).

## Открытые треки

1. **PR #706** — довести до мерджа (см. команду выше).
2. **CyberChess** (`aevion-cyberchess`) — недавняя активность, не проверялась в этой сессии.
3. **qright/qsign free-quota enforcement** — решить, стоит ли строить (см. §7).
4. **aevion-qrenew** — не трогать, чужая живая работа.
