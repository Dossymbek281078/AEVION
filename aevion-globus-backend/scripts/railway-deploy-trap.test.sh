#!/usr/bin/env bash
# Проверка уборки отметки сборки (trap в railway-deploy.sh).
#
# Зачем: 08.10.2026 две выкатки подряд оставили дерево грязным по-разному —
# после одной заглушка была УДАЛЕНА (сработала прежняя ветка rm -f, и об этом
# никто не узнал), после другой ИЗМЕНЕНА (trap не отработал, задача оборвана).
# Без заглушки прод отвечает commit: unknown, а сторож чистого дерева у соседа
# отказывает. Поэтому у уборки не должно быть молчаливого исхода и она НИКОГДА
# не удаляет файл.
#
# Коды: 0 — все проверки прошли, 1 — есть падения, 2 — не смог проверить.
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export BACKEND_DIR
STUB="$BACKEND_DIR/build-info.json"
PASS=0; FAIL=0

if [ ! -f "$STUB" ]; then echo "НЕ СМОГ: заглушки нет на месте: $STUB"; exit 2; fi
if ! sed -n '/^restore_build_info() {/,/^}/p' "$SCRIPT_DIR/railway-deploy.sh" > "$SCRIPT_DIR/.trap-fn.tmp"; then
  echo "НЕ СМОГ: функция restore_build_info не найдена в railway-deploy.sh"; exit 2
fi
if [ ! -s "$SCRIPT_DIR/.trap-fn.tmp" ]; then
  echo "НЕ СМОГ: функция restore_build_info пуста — проверять нечего"; exit 2
fi
# shellcheck disable=SC1090
. "$SCRIPT_DIR/.trap-fn.tmp"
cp "$STUB" "$SCRIPT_DIR/.stub-backup.tmp"

check () { # имя, ожидание, факт
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ok   $1"
  else FAIL=$((FAIL+1)); echo "  FAIL $1: ожидалось [$2], вышло [$3]"; fi
}

echo "1) обычный случай: отметка записана, уборка возвращает заглушку"
printf '{"commit":"SHA-ПОРЧА","source":"railway-deploy.sh"}' > "$STUB"
restore_build_info >/dev/null 2>&1
check "код уборки 0" "0" "$?"
check "в файле снова заглушка" "1" "$(grep -c '"source": "stub"' "$STUB")"
# 🔴 Прибор обязан отличать «чисто» от «git не смог»: git -C с MSYS-путём
# падает кодом 128 и печатает ПУСТО, а пустой вывод читался как «чисто» —
# этот тест сам дал такой ложный ok 08.10, пока не стал смотреть код.
if dirty=$( (cd "$BACKEND_DIR" && git status --porcelain -- build-info.json) 2>&1 ); then
  check "дерево чистое по этому файлу" "0" "$(printf %s "$dirty" | grep -c . | tr -d ' ')"
else
  FAIL=$((FAIL+1)); echo "  FAIL спросить git не удалось: $dirty"
fi

echo "2) ВТОРАЯ ВЕТКА: git недоступен — файл обязан быть восстановлен и НЕ удалён"
printf '{"commit":"SHA-ПОРЧА-2"}' > "$STUB"
BROKEN="$SCRIPT_DIR/.broken-bin.tmp"; mkdir -p "$BROKEN"
printf '#!/usr/bin/env bash\nexit 3\n' > "$BROKEN/git"; chmod +x "$BROKEN/git"
( PATH="$BROKEN:$PATH"; restore_build_info ) >/dev/null 2>&1
code2=$?
check "файл СУЩЕСТВУЕТ (не удалён)" "1" "$([ -f "$STUB" ] && echo 1 || echo 0)"
if [ "$code2" -ne 0 ]; then
  check "при полном отказе уборка честно вернула НЕ 0" "1" "1"
else
  check "в файле снова заглушка" "1" "$(grep -c '"source": "stub"' "$STUB")"
fi

echo "3) запрет на удаление записан в самом скрипте"
check "rm -f заглушки в скрипте нет" "0" "$(grep -cE 'rm -f .*build-info\.json' "$SCRIPT_DIR/railway-deploy.sh")"
check "уборка печатает причину отказа" "1" "$(grep -c 'git checkout НЕ удался' "$SCRIPT_DIR/railway-deploy.sh")"

cp "$SCRIPT_DIR/.stub-backup.tmp" "$STUB"
rm -rf "$SCRIPT_DIR/.trap-fn.tmp" "$SCRIPT_DIR/.stub-backup.tmp" "$BROKEN"
echo "ИТОГ: проверок $((PASS+FAIL)), прошло $PASS, упало $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
