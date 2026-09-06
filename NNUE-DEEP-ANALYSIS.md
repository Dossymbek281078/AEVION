# CyberChess — «Глубокий анализ» (Stockfish 17.1 + полный NNUE)

**Дата:** 2026-09-06 · Зона: CyberChess · ветка `feat/chess-nnue-deep-analysis-2026-09-06`

Модель (выбрана основателем 06.09): **OPT-IN**. Игровой движок остаётся лёгким
(`stockfish-18-lite-single`, мгновенный, 0 загрузки). NNUE 17.1 грузится ТОЛЬКО
когда человек сам открыл «Глубокий анализ». Сети кэшируются в IndexedDB — со
второго раза мгновенно. Это сильнее lichess по UX (там NNUE навязан всем).

## Выполнимость — ДОКАЗАНА end-to-end (06.09.2026)

Проба (scratchpad `serve-nnue.mjs` + браузер): модуль `sf171-79` грузится в
браузере при `COEP: require-corp` (на проде включён), обе сети встают через
`setNnueBuffer`, поиск идёт: `bestmove e2e4 ponder e7e5`, `depth 14 score cp 40
nodes 50495 nps 91976`. То есть настоящий SF 17.1 NNUE работает в браузере.

## Что уже сделано (в этой ветке)

- ✅ **Worker-мост ВЕРИФИЦИРОВАН end-to-end** (06.09): new Worker("/deep-engine-worker.js",{type:"module"}) → import внутри воркера → setNnueBuffer transferable → поиск bestmove e2e4 depth 12 462k nps. Риск Turbopack снят.

- `frontend/public/sf171-79.{js,wasm}` — движок (~0.5 МБ, часть сборки).
- `frontend/public/deep-engine-worker.js` — worker-мост (обходит Turbopack, проверен).
- `frontend/src/app/cyberchess/deepEngine.ts` — обёртка `DeepEngine` (через мост):
  - `init()` — грузит модуль (dynamic import из /public) + обе сети (с кэшем
    IndexedDB, потоковый прогресс на большой сети);
  - `evaluate(fen, d, onEval, done)` — оценка под интерфейс анализа;
  - состояния `idle → loading-engine → loading-nets → ready | error`.
  - tsc 0.

## Что ОСТАЛОСЬ (по убыванию риска)

1. **Хостинг сетей (~75 МБ).** `nn-1c0000000000.nnue` **71 МБ** + малая
   `nn-37f18f62d772.nnue` **3.4 МБ**. Дистрибутив Stockfish отдаёт 302 без
   CORS — рантайм-фетч оттуда не годится (и злоупотребление их инфрой).
   **Нужен self-host:** положить обе сети под `NET_BASE` (по умолчанию `/nnue`,
   можно переопределить `NEXT_PUBLIC_NNUE_BASE`). Варианты хоста:
   - НЕ в git (75 МБ бинарей — плохо для репо/деплоя);
   - бэкенд Railway как статика, или asset-bucket/CDN. Решение за инфрой.
2. **UI:** кнопка «🧠 Глубокий анализ» во вкладке Анализ, индикатор загрузки
   сетей (прогресс 0..1 уже отдаётся из `init`), провод `evaluate` к eval-бару.

## Проверка после интеграции

Локальный `next build` ветки + `next start`, открыть /cyberchess, вкладка
Анализ, включить глубокий анализ: должна пойти загрузка сетей (первый раз ~75 МБ),
затем eval-бар от SF 17.1. Со второго захода — мгновенно (IndexedDB).
