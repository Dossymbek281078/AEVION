#!/usr/bin/env bash
# CyberChess — установка NNUE-сборки Stockfish на место текущего lite-движка.
#
# ЗАЧЕМ. Ручной путь Уровня 2 из CYBERCHESS_STOCKFISH_UPGRADE.md легко сделать
# неверно: приложение грузит именно /stockfish-18-lite.js (не /stockfish.js,
# как когда-то говорил док), у lite.wasm есть побайтная копия stockfish-classic.wasm,
# и старые файлы надо забэкапить, иначе откат некуда. Этот скрипт делает всё
# правильно и идемпотентно: ваша часть — только СКАЧАТЬ сборку и указать файлы.
#
# ЧТО НУЖНО СКАЧАТЬ (руками, это внешнее действие — его делает основатель):
#   https://github.com/nmrugg/stockfish.js/releases/latest
#   Рекомендуется МНОГОПОТОЧНАЯ сборка: на проде crossOriginIsolation ВКЛЮЧЕН
#   (COEP: credentialless + COOP: same-origin, проверено 06.09.2026), поэтому
#   SharedArrayBuffer доступен и многопоток даст выигрыш. Файл вида
#   stockfish-nnue-16.zip → внутри .js + .wasm (+ .worker.js для многопотока).
#   Одно­поточная (stockfish-nnue-16-single.*) — запасной вариант, если многопоток
#   не заведётся.
#
# ЗАПУСК (из корня репозитория):
#   bash cyberchess-install-nnue.sh <новый.js> <новый.wasm> [новый.worker.js]
#   bash cyberchess-install-nnue.sh --restore     # откат к прежней сборке
#
# ПОСЛЕ установки — обязательны ДВА шага, их скрипт напомнит в конце:
#   1) снять/ослабить лимит Threads=1 в page.tsx (см. чеклист в конце дока) —
#      иначе многопоточная сборка будет считать в один поток;
#   2) прогнать проверку в DevTools Console (команда печатается в конце).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PUB="$ROOT/frontend/public"
LEGACY="$PUB/stockfish-legacy"
TARGET_JS="$PUB/stockfish-18-lite.js"       # ← именно это грузит new Worker(...)
TARGET_WASM="$PUB/stockfish-18-lite.wasm"

err(){ echo "ОШИБКА: $*" >&2; exit 1; }

[ -d "$PUB" ] || err "нет $PUB — запусти из корня репозитория aevion-globus-backend/frontend рядом"

if [ "${1:-}" = "--restore" ]; then
  [ -d "$LEGACY" ] || err "нет бэкапа $LEGACY — откатывать нечего"
  cp -v "$LEGACY/stockfish-18-lite.js"   "$TARGET_JS"
  cp -v "$LEGACY/stockfish-18-lite.wasm" "$TARGET_WASM"
  [ -f "$LEGACY/stockfish-18-lite.worker.js" ] && cp -v "$LEGACY/stockfish-18-lite.worker.js" "$PUB/" || true
  echo "✅ Прежняя сборка восстановлена. Пересобери/выкати фронт, чтобы откат доехал."
  exit 0
fi

NEW_JS="${1:-}"; NEW_WASM="${2:-}"; NEW_WORKER="${3:-}"
[ -n "$NEW_JS" ] && [ -n "$NEW_WASM" ] || err "укажи файлы: bash cyberchess-install-nnue.sh <js> <wasm> [worker.js]"
[ -f "$NEW_JS" ]   || err "не найден js:  $NEW_JS"
[ -f "$NEW_WASM" ] || err "не найден wasm: $NEW_WASM"
# wasm начинается с магии \0asm — грубая проверка, что подсунули не тот файл
head -c 4 "$NEW_WASM" | grep -q "asm" || err "$NEW_WASM не похож на .wasm (нет сигнатуры asm)"
[ "$(wc -c < "$NEW_WASM")" -gt 1000000 ] || err "$NEW_WASM подозрительно мал (<1 МБ) — точно NNUE-сборка?"

# 1. Бэкап текущих — один раз (не перезатирать бэкап при повторном запуске)
mkdir -p "$LEGACY"
for f in stockfish-18-lite.js stockfish-18-lite.wasm stockfish-18-lite.worker.js; do
  [ -f "$PUB/$f" ] && [ ! -f "$LEGACY/$f" ] && cp -v "$PUB/$f" "$LEGACY/$f" || true
done

# 2. Установка под ИМЕНАМИ, которые ждёт приложение
cp -v "$NEW_JS"   "$TARGET_JS"
cp -v "$NEW_WASM" "$TARGET_WASM"
if [ -n "$NEW_WORKER" ]; then
  [ -f "$NEW_WORKER" ] || err "не найден worker: $NEW_WORKER"
  cp -v "$NEW_WORKER" "$PUB/stockfish-18-lite.worker.js"
  echo "ℹ️  worker.js положен. Убедись, что js-обёртка ищет именно stockfish-18-lite.worker.js"
fi

# 3. Проверка
echo "--- установлено ---"
ls -la "$TARGET_JS" "$TARGET_WASM" 2>/dev/null | awk '{print $5, $NF}'
cat <<'СЛЕД'

✅ Файлы на месте. Осталось ДВА шага (скрипт их НЕ делает — это код и деплой):

1) Threads: сейчас page.tsx жёстко ставит `setoption name Threads value 1`
   (класс SF, ~строка 343) — это защита от зависания lite-сборки. Для
   МНОГОПОТОЧНОЙ NNUE-сборки замени на условное значение, например:
     const th = (self.crossOriginIsolated && navigator.hardwareConcurrency)
       ? Math.max(1, navigator.hardwareConcurrency - 1) : 1;
     this.w!.postMessage(`setoption name Threads value ${th}`);
   и проверь, что движок отдаёт bestmove (не виснет). Если виснет — верни 1
   или поставь одно­поточную сборку.

2) Проверка в DevTools Console на /cyberchess:
   sfR.current.eval("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 30, (cp,m)=>console.log(cp,m), ()=>console.log("done"))
   На NNUE-сборке обновления оценки должны идти каждые ~50 мс до depth 30
   (сейчас на lite это ~2 с). Заодно в консоли не должно быть
   "e.trim is not a function" — этой ошибкой падала lite-сборка.

Откат: bash cyberchess-install-nnue.sh --restore
СЛЕД
