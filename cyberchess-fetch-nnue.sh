#!/usr/bin/env bash
# CyberChess «Глубокий анализ» — скачать NNUE-сети для self-hosting.
#
# Зачем: движок SF 17.1 (Level 3) грузит сети отдельно (~75 МБ). Дистрибутив
# Stockfish отдаёт 302 без CORS — фетчить из браузера в рантайме нельзя, сети
# надо положить НА НАШ хост, куда указывает NET_BASE (по умолчанию /nnue,
# переопределяется NEXT_PUBLIC_NNUE_BASE). Этот скрипт кладёт обе сети в
# указанный каталог с проверкой размера. Имена НЕ менять — их спрашивает движок
# через getRecommendedNnue().
#
# Запуск (после того как основатель/инфра решили, ГДЕ хостить):
#   bash cyberchess-fetch-nnue.sh <каталог-назначения>
#   # пример для self-host из /public фронта:  bash cyberchess-fetch-nnue.sh frontend/public/nnue
#   # (⚠️ 75 МБ в git класть не стоит — лучше Railway-статика или CDN-бакет)
set -euo pipefail

DEST="${1:-}"
[ -n "$DEST" ] || { echo "ОШИБКА: укажи каталог назначения. Пример: bash $0 frontend/public/nnue" >&2; exit 1; }
mkdir -p "$DEST"

BASE="https://tests.stockfishchess.org/api/nn"
# имя :: ожидаемый размер (байты) для проверки
NETS=(
  "nn-1c0000000000.nnue:74874478"   # большая сеть, ~71 МБ
  "nn-37f18f62d772.nnue:3519630"    # малая сеть, ~3.4 МБ
)

for entry in "${NETS[@]}"; do
  name="${entry%%:*}"; want="${entry##*:}"
  out="$DEST/$name"
  if [ -f "$out" ] && [ "$(wc -c < "$out")" = "$want" ]; then
    echo "уже на месте: $name ($want б)"; continue
  fi
  echo "качаю $name …"
  curl -fsSL --max-time 600 -o "$out" "$BASE/$name"
  got="$(wc -c < "$out")"
  if [ "$got" != "$want" ]; then
    echo "ОШИБКА: $name скачан размером $got, ожидался $want — удаляю" >&2
    rm -f "$out"; exit 1
  fi
  echo "  ✅ $name ($got б)"
done

echo ""
echo "Готово. Сети в: $DEST"
echo "Теперь отдай их с нашего хоста так, чтобы GET <NET_BASE>/<имя>.nnue возвращал файл"
echo "с заголовком Cross-Origin-Resource-Policy: cross-origin (COEP require-corp у страницы)."
echo "NET_BASE по умолчанию /nnue; переопределяется NEXT_PUBLIC_NNUE_BASE (см. deepEngine.ts)."
