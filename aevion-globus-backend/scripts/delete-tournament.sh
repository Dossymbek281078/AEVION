#!/usr/bin/env bash
# Убрать один турнир с прода — по идентификатору, из памяти, файла и базы разом.
#
# Заведено 13.08.2026 вместе с самой ручкой. Отдельный скрипт, а не строка с
# curl в переписке, по двум причинам: ключ не должен ездить в истории команд, и
# удаление не должно требовать сборки запроса руками — там легко промахнуться
# идентификатором, а промах здесь необратим.
#
# Ключ лежит ВНЕ репозитория, рядом с токеном GitLab:
#   C:\Users\user\.aevion-cyberchess-admin-key
# Тот же самый ключ прописан в переменной CYBERCHESS_ADMIN_KEY на Railway.
# Потеряется файл — новый ставится так:
#   railway variables --set "CYBERCHESS_ADMIN_KEY=<новый>" --skip-deploys
#
# Использование:
#   bash scripts/delete-tournament.sh <id>
#   bash scripts/delete-tournament.sh --list     # посмотреть, что вообще есть

set -euo pipefail

BASE="${BASE:-https://api.aevion.app}"
KEY_FILE="${CYBERCHESS_ADMIN_KEY_FILE:-$HOME/.aevion-cyberchess-admin-key}"

if [ "${1:-}" = "--list" ]; then
  curl -s --max-time 20 "$BASE/api/cyberchess-tournaments/list" |
    node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);
      console.log('турниров:',j.tournaments.length);
      j.tournaments.forEach(t=>console.log('  '+t.id+'  ['+(t.origin||'?')+']  '+t.title))})"
  exit 0
fi

ID="${1:-}"
if [ -z "$ID" ]; then
  echo "Укажите идентификатор турнира. Список: bash scripts/delete-tournament.sh --list" >&2
  exit 2
fi

if [ ! -f "$KEY_FILE" ]; then
  echo "Ключа нет: $KEY_FILE" >&2
  echo "Он же лежит в переменной CYBERCHESS_ADMIN_KEY на Railway — возьмите оттуда." >&2
  exit 2
fi
KEY="$(tr -d '\r\n' < "$KEY_FILE")"

# Показать, что именно уйдёт, ДО удаления. Идентификаторы похожи друг на друга
# (usr-tournament-cf396d против usr-tournament-cf936d), и подтверждение по
# НАЗВАНИЮ ловит промах, который подтверждение по id не ловит.
echo "Будет удалён:"
curl -s --max-time 20 "$BASE/api/cyberchess-tournaments/$ID" |
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    let j;try{j=JSON.parse(d)}catch{console.log('  (ответ не разобран)');process.exit(0)}
    const t=j.tournament||j;
    if(!t||!t.id){console.log('  турнира с таким id нет');process.exit(3)}
    console.log('  '+t.id+'  ['+(t.origin||'?')+']  '+t.title)})"

printf 'Удалить? введите да: '
read -r ANSWER
[ "$ANSWER" = "да" ] || { echo "отменено"; exit 1; }

curl -s -w '\nHTTP %{http_code}\n' --max-time 25 \
  -X DELETE -H "X-Admin-Key: $KEY" \
  "$BASE/api/cyberchess-tournaments/$ID"
