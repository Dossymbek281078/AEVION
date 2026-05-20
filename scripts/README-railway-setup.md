# Railway CyberChess Setup Script

`scripts/railway-cyberchess-setup.mjs` — конфигурирует production-окружение CyberChess на Railway через GraphQL API (без CLI). Скрипт идемпотентен: повторный запуск перезапишет переменные новыми значениями, но не создаст дубликатов volume.

---

## Что делает скрипт

1. **Auto-discovery** project / service / environment по подстрокам имени (или принимает явные IDs через env).
2. **CYBERCHESS_ADMIN_KEY** — генерирует криптостойкий 32-байтовый hex (64 символа) и upsert-ит как переменную.
3. **ELEVENLABS_API_KEY** — upsert, если задан `SETUP_ELEVENLABS_KEY` (для voice coach).
4. **QCOREAI_BASE** — upsert, если задан `SETUP_QCOREAI_BASE` (для voice coach standalone).
5. **INTERNAL_TOKEN** — upsert, если задан `SETUP_INTERNAL_TOKEN` (для tournament → matchmaking pre-match endpoint).
6. **Persistent Volume** — если передан `--volume` или `SETUP_VOLUME=1`:
   - Запрашивает существующие volumes проекта
   - Если на target mountPath volume уже есть — skip + log
   - Иначе создаёт новый volume и аттачит к service+environment
7. **Redeploy** — триггерит `serviceInstanceRedeploy` (пропустить можно флагом `--no-redeploy`).
8. Печатает финальный SUMMARY и выходит с кодом `0` (success) или `1` (была хотя бы одна ошибка).

---

## Где взять Railway-токен

Railway Dashboard → клик по аватарке справа вверху → **Account Settings** → вкладка **Tokens** → **Create Token**. Сохрани значение — оно показывается только один раз. Это account-token (доступ ко всем проектам) или team-token (если работаешь в команде).

---

## Известные IDs (CyberChess prod)

| Что | ID |
|---|---|
| `RAILWAY_PROJECT_ID` | `9d891410-...` (project AEVION) |
| `RAILWAY_SERVICE_ID` | `13b81e5a-...` (service aevion-globus-backend) |
| `RAILWAY_ENVIRONMENT_ID` | `8d3be6fb-...` (environment production) |

Эти IDs можно не задавать вручную — скрипт сам найдёт через `me { projects ... }` discovery (по подстроке `aevion`).

Полные значения подставь из своего dashboard. Если задаёшь хоть одну переменную — задай все три (либо все три, либо ни одной).

---

## Сценарии запуска (PowerShell)

### 1. Minimal — только admin key + redeploy

```powershell
$env:RAILWAY_TOKEN = "rwy_..."
node scripts/railway-cyberchess-setup.mjs
```

Результат: сгенерирован `CYBERCHESS_ADMIN_KEY`, выставлен в env, сервис передеплоен.

### 2. С volume для persistence

```powershell
$env:RAILWAY_TOKEN = "rwy_..."
$env:SETUP_VOLUME = "1"
node scripts/railway-cyberchess-setup.mjs
```

Или через флаг:

```powershell
$env:RAILWAY_TOKEN = "rwy_..."
node scripts/railway-cyberchess-setup.mjs --volume
```

Volume будет создан на mount path `/app/aevion-globus-backend/data` (можно переопределить через `SETUP_VOLUME_MOUNT_PATH`). Имя volume по умолчанию `cyberchess-data` (override через `SETUP_VOLUME_NAME`).

### 3. С ElevenLabs API key

```powershell
$env:RAILWAY_TOKEN = "rwy_..."
$env:SETUP_ELEVENLABS_KEY = "11labs_xxx"
node scripts/railway-cyberchess-setup.mjs
```

### 4. Полный setup — всё сразу

```powershell
$env:RAILWAY_TOKEN = "rwy_..."
$env:SETUP_VOLUME = "1"
$env:SETUP_ELEVENLABS_KEY = "11labs_xxx"
$env:SETUP_QCOREAI_BASE = "https://qcoreai.aevion.app"
$env:SETUP_INTERNAL_TOKEN = "internal_xxx"
node scripts/railway-cyberchess-setup.mjs
```

### 5. Помощь / список всех env vars и флагов

```powershell
node scripts/railway-cyberchess-setup.mjs --help
```

### 6. Dry-config (без редеплоя)

```powershell
$env:RAILWAY_TOKEN = "rwy_..."
node scripts/railway-cyberchess-setup.mjs --no-redeploy
```

Полезно если хочешь сначала проверить, что переменные выставились, а редеплой запустить вручную из dashboard.

---

## Все переменные окружения (cheat sheet)

| ENV | Required | Default | Описание |
|---|---|---|---|
| `RAILWAY_TOKEN` | yes | — | Railway API token |
| `RAILWAY_PROJECT_ID` | no | auto-discover | Skip discovery, use this project id |
| `RAILWAY_SERVICE_ID` | no | auto-discover | Skip discovery, use this service id |
| `RAILWAY_ENVIRONMENT_ID` | no | auto-discover | Skip discovery, use this environment id |
| `RAILWAY_PROJECT_NAME_MATCH` | no | `aevion` | Substring (case-insensitive) для поиска project |
| `RAILWAY_SERVICE_NAME_MATCH` | no | `aevion` | Substring (case-insensitive) для поиска service |
| `RAILWAY_ENVIRONMENT_NAME` | no | `production` | Имя environment |
| `SETUP_ELEVENLABS_KEY` | no | — | Если задан → upsert `ELEVENLABS_API_KEY` |
| `SETUP_QCOREAI_BASE` | no | — | Если задан → upsert `QCOREAI_BASE` |
| `SETUP_INTERNAL_TOKEN` | no | — | Если задан → upsert `INTERNAL_TOKEN` |
| `SETUP_VOLUME` | no | — | `1` → создать + аттачить volume |
| `SETUP_VOLUME_NAME` | no | `cyberchess-data` | Имя volume |
| `SETUP_VOLUME_MOUNT_PATH` | no | `/app/aevion-globus-backend/data` | Куда монтировать |
| `DEBUG` | no | — | `1` → печатать stack traces при ошибках |

| Flag | Описание |
|---|---|
| `--volume` | equivalent to `SETUP_VOLUME=1` |
| `--no-redeploy` | skip the final redeploy step |
| `--help`, `-h` | print usage and exit |

---

## После запуска: что проверить

### A. Endpoints smoke check

```powershell
# Health
curl https://aevion-globus-backend-production.up.railway.app/health

# Admin endpoint (требует CYBERCHESS_ADMIN_KEY из summary)
curl -H "x-admin-key: <ADMIN_KEY>" https://aevion-globus-backend-production.up.railway.app/cyberchess/admin/stats

# Voice coach (если выставили ELEVENLABS_API_KEY)
curl -X POST https://aevion-globus-backend-production.up.railway.app/cyberchess/voice/coach `
  -H "Content-Type: application/json" `
  -d '{"text":"e4 опасный дебют","voice":"alloy"}'

# Tournament → matchmaking (если выставили INTERNAL_TOKEN)
curl -H "x-internal-token: <INTERNAL_TOKEN>" `
  https://aevion-globus-backend-production.up.railway.app/cyberchess/matchmaking/internal/prematch
```

### B. Проверить, что volume действительно работает

1. Запиши тестовый файл через admin endpoint или backend route, который пишет в `aevion-globus-backend/data/`.
2. Передеплой сервис ещё раз (`scripts/railway-cyberchess-setup.mjs --no-redeploy` — пропустит, но всё равно можно из dashboard).
3. После рестарта pod — прочитай тот же файл. Если он на месте — volume persistent.

Альтернатива: посмотри в Railway dashboard → service → **Settings** → **Volumes** — должен показывать смонтированный volume с указанным mount path.

### C. Если что-то пошло не так

- Запусти с `DEBUG=1` чтобы получить stack trace:
  ```powershell
  $env:DEBUG = "1"; $env:RAILWAY_TOKEN = "rwy_..."; node scripts/railway-cyberchess-setup.mjs
  ```
- Если volume не создаётся — проверь, что у токена есть права на проект (account-token обычно имеет, project-scoped может не иметь).
- Если discovery не находит project — задай явный `RAILWAY_PROJECT_ID`/`RAILWAY_SERVICE_ID`/`RAILWAY_ENVIRONMENT_ID`.
- GraphQL endpoint: `https://backboard.railway.com/graphql/v2` (если меняли — Railway мог обновить путь).

---

## Безопасность

- `CYBERCHESS_ADMIN_KEY` печатается в stdout (в SUMMARY и в финале). **Сохрани его сразу** в password manager / vault. Если потерял — просто запусти скрипт заново, выпустится новый и старый перестанет работать после редеплоя.
- `RAILWAY_TOKEN` не логируется, но передаётся в `Authorization: Bearer`. Не хардкодь в скрипты, используй только через env.
- `SETUP_ELEVENLABS_KEY`, `SETUP_INTERNAL_TOKEN` тоже не логируются — пробрасываются в Railway env как есть.

---

## Источники

- Railway GraphQL API: <https://docs.railway.com/reference/public-api>
- Volume mutations схема: `volumeCreate(input: VolumeCreateInput!)`, `project.volumes.edges[].node.volumeInstances`
- Memory reference: `reference_railway_graphql.md` (когда CLI зависает / GitHub auto-deploy сломан)
