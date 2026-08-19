#!/usr/bin/env bash
# Выкатка САЙТА на Vercel с честной отметкой сборки.
#
# Зачем скрипт, а не одна команда `vercel deploy --prod`. У сайта в /api/health
# есть поле build — им снаружи доказывают, КАКОЙ код сейчас работает. Проверено
# выкаткой 18.08.2026: при загрузке рабочей папкой Vercel НЕ подставляет
# VERCEL_GIT_COMMIT_SHA, и поле честно ответило "unknown". Переменные проекта
# для этого не годятся по другой причине, и она дороже: они живут в проекте, а
# не в сборке, и переживают чужую выкатку — на Railway из-за этого /health
# уверенно называл коммит, которого на проде уже не было.
#
# Поэтому отметка едет ВНУТРИ артефакта: скрипт вписывает её в
# src/lib/buildStamp.ts перед загрузкой и возвращает файл обратно после.
#
# Перед выкаткой обязательна проверка, не уберёт ли она чужие страницы:
# Vercel хранит ровно одну сборку сайта, а фронт правят несколько сессий.
#
# Использование:
#   bash frontend/scripts/vercel-deploy.sh "короткое описание"

set -euo pipefail

MSG="${1:-выкатка без описания}"
FRONT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$FRONT_DIR/.." && pwd)"
STAMP="$FRONT_DIR/src/lib/buildStamp.ts"
cd "$REPO_ROOT"

SHA="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Своя отметка, оставшаяся от ПРЕРВАННОЙ выкатки, — не чужие правки.
#
# 19.08.2026: сборку убило по таймауту, trap не отработал, и buildStamp.ts
# остался изменённым. Следующий запуск честно отказался ехать «есть
# незакоммиченные изменения» — верно по сути, но человек видит непонятный
# отказ и лезет разбираться в файл, который скрипт же и правит. Возвращаем
# его сами и говорим об этом вслух.
if ! git diff --quiet -- "$STAMP"; then
  if [ -z "$(git diff --name-only | grep -v "^frontend/src/lib/buildStamp.ts$")" ]      && git diff --cached --quiet; then
    echo "отметка осталась от прерванной выкатки — возвращаю её и продолжаю"
    git checkout -- "$STAMP"
  fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ОСТАНОВКА: в рабочей копии есть незакоммиченные изменения." >&2
  echo "Отметка показала бы ${SHA:0:12}, а уехало бы другое." >&2
  git status --short | head -20 >&2
  exit 1
fi

# Чужие страницы. Проверка опрашивает ЖИВОЙ сайт, а не читает наши файлы.
if [ -f "$HOME/aevion-frontend-check.mjs" ]; then
  if ! node "$HOME/aevion-frontend-check.mjs" "$BRANCH"; then
    echo >&2
    echo "ОСТАНОВКА: выкатка убрала бы страницы, которые сейчас на сайте." >&2
    exit 1
  fi
else
  echo "ВНИМАНИЕ: aevion-frontend-check.mjs не найден — не проверено, что" >&2
  echo "выкатка не уберёт чужие страницы. Это НЕ «всё чисто»." >&2
fi

echo "ветка:  $BRANCH"
echo "коммит: ${SHA:0:12}"
echo "повод:  $MSG"

cleanup() { git checkout -- "$STAMP" 2>/dev/null || true; }
trap cleanup EXIT

cat > "$STAMP" <<TS
/** Проставлено scripts/vercel-deploy.sh при выкатке. В git лежат заглушки. */
export type BuildStamp = {
  commit: string;
  branch: string;
  builtAt: string | null;
};

export const BUILD_STAMP: BuildStamp = {
  commit: "${SHA:0:12}",
  branch: "$BRANCH",
  builtAt: "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
};
TS

# Типы проверяем ПОСЛЕ подстановки отметки и ДО загрузки.
#
# 18.08.2026 первая версия писала отметку с `as const`, и типы сужались до
# литералов: сравнение с "unknown" в /api/health становилось ошибкой ровно
# тогда, когда отметка заполнена. На заглушке всё компилировалось, а выкатка
# падала на сборке. Проверять надо ТО, ЧТО УЕЗЖАЕТ, а не то, что лежит в git.
echo "проверяю типы с подставленной отметкой…"
( cd "$FRONT_DIR" && npx tsc --noEmit )

npx vercel deploy --prod --yes

echo
echo "Проверить, что доехало именно это (build.commit должен стать ${SHA:0:12}):"
echo "  curl -s https://aevion.app/api/health"
