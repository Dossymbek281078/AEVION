#!/usr/bin/env bash
# Зажечь бесплатного провайдера на проде: положить ключ в Railway, передеплоить
# и УБЕДИТЬСЯ ПО ФАКТУ, что провайдер появился в живом флоте.
#
# Зачем скрипт: ключи бесплатных провайдеров лежат мёртвым грузом — код есть,
# ключа нет. На 27.07.2026 из 13 бесплатных провайдеров на проде подключены
# два (gemini, openrouter); nvidia, groq, cerebras, mistral, together, github
# ждут одной переменной окружения каждый.
#
# Использование:
#   RAILWAY_TOKEN=<токен> ./scripts/set-provider-key-railway.sh nvidia nvapi-XXXX
#   RAILWAY_TOKEN=<токен> ./scripts/set-provider-key-railway.sh groq gsk_XXXX
#
# Токен (project-token) лежит в Windows User-env RAILWAY_TOKEN:
#   powershell.exe -NoProfile -Command '[Environment]::GetEnvironmentVariable("RAILWAY_TOKEN","User")'
#
# Ключ НЕ печатается и НЕ пишется в лог — ни в аргументах вывода, ни в ошибках.
set -euo pipefail

PROVIDER="${1:-}"
KEY="${2:-}"

# ── Куда писать. Значения по умолчанию — прод-проект aevion-production.
# ⚠️ ЧЕСТНОЕ ПРЕДУПРЕЖДЕНИЕ: OPENROUTER_API_KEY в своё время лёг в сервис
# aevion-globus-backend проекта `nurturing-creativity`, а не в aevion-production
# (в дашборде несколько проектов с авто-именами). Если проверка в конце не
# позеленеет — значит ключ уехал не в тот проект; переопределите ID ниже.
PROJECT_ID="${RAILWAY_PROJECT_ID:-9d891410-4379-40e3-97ee-619f868ac5d4}"
SERVICE_ID="${RAILWAY_SERVICE_ID:-13b81e5a-67ac-474c-b86d-05f3704d0896}"
ENVIRONMENT_ID="${RAILWAY_ENVIRONMENT_ID:-8d3be6fb-d202-4ffc-bd5a-97eb7e1bd816}"
GRAPHQL="${RAILWAY_GRAPHQL:-https://backboard.railway.com/graphql/v2}"
# Проверяем через публичный фронт — это тот путь, которым ходит живой человек.
CHECK_URL="${PROVIDERS_URL:-https://aevion.vercel.app/api-backend/api/qcoreai/providers}"

case "$PROVIDER" in
  nvidia)    ENV_NAME="NVIDIA_API_KEY" ;;
  groq)      ENV_NAME="GROQ_API_KEY" ;;
  cerebras)  ENV_NAME="CEREBRAS_API_KEY" ;;
  mistral)   ENV_NAME="MISTRAL_API_KEY" ;;
  together)  ENV_NAME="TOGETHER_API_KEY" ;;
  github)    ENV_NAME="GITHUB_MODELS_TOKEN" ;;
  openrouter) ENV_NAME="OPENROUTER_API_KEY" ;;
  gemini)    ENV_NAME="GEMINI_API_KEY" ;;
  *)
    echo "Провайдер '$PROVIDER' не из списка бесплатных." >&2
    echo "Доступны: nvidia groq cerebras mistral together github openrouter gemini" >&2
    echo "Где брать ключи и что каждый даёт — docs/free-ai-fleet.md" >&2
    exit 2
    ;;
esac

if [ -z "$KEY" ]; then
  echo "Не передан ключ. Использование: $0 <провайдер> <ключ>" >&2
  exit 2
fi
if [ -z "${RAILWAY_TOKEN:-}" ]; then
  echo "Нет RAILWAY_TOKEN в окружении — без него Railway ничего не примет." >&2
  exit 2
fi

echo "→ Провайдер: $PROVIDER (переменная $ENV_NAME), ключ длиной ${#KEY} символов (значение не печатается)"

# ── 1. Записать переменную ────────────────────────────────────────────────────
upsert_payload=$(KEY="$KEY" ENV_NAME="$ENV_NAME" PROJECT_ID="$PROJECT_ID" \
  ENVIRONMENT_ID="$ENVIRONMENT_ID" SERVICE_ID="$SERVICE_ID" node -e '
const q = "mutation Upsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }";
process.stdout.write(JSON.stringify({
  query: q,
  variables: { input: {
    projectId: process.env.PROJECT_ID,
    environmentId: process.env.ENVIRONMENT_ID,
    serviceId: process.env.SERVICE_ID,
    name: process.env.ENV_NAME,
    value: process.env.KEY,
  } },
}));
')

resp=$(curl -sS -X POST "$GRAPHQL" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$upsert_payload")

# В ответе ключа нет, но на всякий случай печатаем только вердикт.
if ! printf '%s' "$resp" | grep -q '"variableUpsert":true'; then
  echo "✗ Railway не принял переменную. Ответ (без ключа):" >&2
  printf '%s\n' "$resp" | head -c 400 >&2
  echo >&2
  exit 1
fi
echo "✓ Переменная записана"

# ── 2. Передеплоить ───────────────────────────────────────────────────────────
redeploy_payload=$(SERVICE_ID="$SERVICE_ID" ENVIRONMENT_ID="$ENVIRONMENT_ID" node -e '
const q = "mutation Redeploy($serviceId: String!, $environmentId: String!) { serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId) }";
process.stdout.write(JSON.stringify({ query: q, variables: {
  serviceId: process.env.SERVICE_ID, environmentId: process.env.ENVIRONMENT_ID } }));
')
curl -sS -X POST "$GRAPHQL" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$redeploy_payload" > /dev/null
echo "✓ Передеплой запрошен"

# ── 3. Проверка ПО ФАКТУ ──────────────────────────────────────────────────────
# 2xx от Railway ничего не доказывает: переменная могла уехать в другой проект,
# под мог не перезапуститься, ключ мог быть неверным. Ждём, пока живой прод
# скажет, что провайдер настроен.
echo "→ Жду, пока $PROVIDER появится настроенным в $CHECK_URL (до 5 минут)"
for i in $(seq 1 30); do
  sleep 10
  state=$(curl -sS --max-time 20 "$CHECK_URL" 2>/dev/null | PROVIDER="$PROVIDER" node -e '
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const body = JSON.parse(raw);
    const data = body.data || body;
    const p = (data.providers || []).find((x) => x.id === process.env.PROVIDER);
    process.stdout.write(p ? String(p.configured === true) : "missing");
  } catch { process.stdout.write("unreadable"); }
});
' || echo "unreachable")
  case "$state" in
    true)
      echo "✓ $PROVIDER настроен на живом проде (попытка $i)"
      echo
      echo "Осталось проверить, что он ОТВЕЧАЕТ, а не просто числится:"
      echo "  curl -s -X POST https://aevion.vercel.app/api-backend/api/qcoreai/chat \\"
      echo "    -H 'Content-Type: application/json' \\"
      echo "    -d '{\"provider\":\"$PROVIDER\",\"messages\":[{\"role\":\"user\",\"content\":\"скажи LIVE\"}]}'"
      exit 0
      ;;
    missing)
      echo "✗ Провайдера '$PROVIDER' нет в каталоге прода — там старая сборка бэкенда." >&2
      exit 1
      ;;
    *)
      echo "  · попытка $i: пока '$state'"
      ;;
  esac
done

echo "✗ За 5 минут провайдер так и не стал настроенным." >&2
echo "  Самая частая причина: переменная уехала не в тот Railway-проект." >&2
echo "  Переопределите RAILWAY_PROJECT_ID / RAILWAY_SERVICE_ID / RAILWAY_ENVIRONMENT_ID и повторите." >&2
exit 1
