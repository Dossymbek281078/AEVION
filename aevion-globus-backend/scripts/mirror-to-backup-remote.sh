#!/usr/bin/env bash
# Запасной дом для кода, если GitHub не вернётся.
#
# Пишется 27.07.2026, пока аккаунт `Dossymbek281078` приостановлен. Зеркала у нас
# нет ни одного — единственный remote был GitHub, и это ровно та зависимость,
# которая сегодня остановила пуши всей планеты.
#
# Скрипт НИЧЕГО не создаёт во внешнем мире сам: аккаунт и пустой репозиторий на
# новом хостинге заводит основатель (регистрация — его рука). Скрипт получает
# готовый URL и переносит туда ВСЕ ветки и теги из всех рабочих копий.
#
# Использование:
#   ./scripts/mirror-to-backup-remote.sh https://gitlab.com/<user>/AEVION.git
#   ./scripts/mirror-to-backup-remote.sh git@codeberg.org:<user>/AEVION.git --dry-run
#
# Где заводить (по убыванию удобства для нас):
#   GitLab    — бесплатные приватные репозитории без лимита на размер истории;
#   Codeberg  — некоммерческий, без корпоративных блокировок, но есть квота;
#   Gitee     — быстрый в КНР, но публичный репозиторий требует номера +86
#               (см. память project_aevion_china_entry).
set -euo pipefail

REMOTE_URL="${1:-}"
DRY="${2:-}"

if [ -z "$REMOTE_URL" ]; then
  echo "Не передан URL нового репозитория." >&2
  echo "Использование: $0 <url> [--dry-run]" >&2
  exit 2
fi

MAIN_WT="/c/Users/user/aevion-startupx"
cd "$MAIN_WT" || { echo "Нет рабочей копии $MAIN_WT" >&2; exit 1; }

echo "→ Зеркало: $REMOTE_URL"
[ "$DRY" = "--dry-run" ] && echo "  (сухой прогон — ничего не отправляется)"

# Один общий репозиторий на все worktree, поэтому и веток достаточно перечислить
# один раз: они видны из любой рабочей копии.
branches=$(git for-each-ref --format='%(refname:short)' refs/heads/)
count=$(printf '%s\n' "$branches" | grep -c . || true)
echo "→ Локальных веток: $count"

if [ "$DRY" = "--dry-run" ]; then
  printf '%s\n' "$branches" | sed 's/^/   /'
  echo "→ Сухой прогон закончен. Уберите --dry-run, чтобы отправить."
  exit 0
fi

if git remote | grep -qx "backup"; then
  git remote set-url backup "$REMOTE_URL"
else
  git remote add backup "$REMOTE_URL"
fi

# --mirror отправил бы и служебные ссылки; нам нужны ветки и теги.
echo "→ Отправляю все ветки…"
git push backup --all
echo "→ Отправляю теги…"
git push backup --tags

# Проверка ПО ФАКТУ: сверяем, что на той стороне столько же веток, сколько тут.
remote_count=$(git ls-remote --heads backup | grep -c . || echo 0)
echo "→ На зеркале веток: $remote_count (локально: $count)"
if [ "$remote_count" -lt "$count" ]; then
  echo "✗ На зеркале меньше веток, чем локально — перенос неполный." >&2
  exit 1
fi
echo "✓ Зеркало содержит все ветки."
echo
echo "Дальше: в каждой рабочей копии можно пушить в оба места сразу —"
echo "  git remote set-url --add --push origin <github-url>"
echo "  git remote set-url --add --push origin $REMOTE_URL"
echo "После восстановления GitHub зеркало не мешает: пуш будет идти в оба."
