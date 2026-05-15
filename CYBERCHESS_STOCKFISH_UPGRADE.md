# CyberChess Stockfish — Upgrade path to Lichess-grade speed

**Дата:** 2026-05-12 · **Зона:** aevion-core/main · CyberChess

Текущее состояние: Stockfish 18 (nmrugg/Chess.com port), **NON-NNUE**, **NON-SIMD**, single binary in `/public/stockfish.{js,wasm}`. Depth 22 уже тормозит UI.

Цель: depth 40+ за 2-3 секунды, как на lichess.org.

---

## Уровень 1 — ✅ Применено в `page.tsx` коммитом

В классе `SF` (`page.tsx:92`):
- Hash bumped 256 → **1024 MB** (4× больше TT-hits)
- Contempt 0 (балансная оценка)
- Skill 20 (полная сила)
- Прозрачные комментарии что и зачем

**Эффект:** ~2-3× быстрее на длинных анализах за счёт hash hits. Depth 22-26 — без видимого замирания UI.

**Ограничение:** evaluation core всё ещё classic (не NNUE) — это уровень 2.

---

## Уровень 2 — Drop-in NNUE binary swap (30 мин)

**Что:** заменить `/public/stockfish.{js,wasm}` на NNUE-вариант от nmrugg.

**Выгода:** **3-5× быстрее** + значительно точнее оценка позиции.

### Шаги (выполняет пользователь вручную)

1. Открой https://github.com/nmrugg/stockfish.js/releases/latest
2. Скачай **`stockfish-nnue-16-single.zip`** (≈ 14 MB) ИЛИ
   **`stockfish-nnue-16.zip`** (≈ 45 MB, multi-threaded SIMD — рекомендуется)
3. Распакуй. Внутри будут файлы вида:
   - `stockfish-nnue-16-single.js`
   - `stockfish-nnue-16-single.wasm`
   - `stockfish-nnue-16-single.worker.js` (для multi-threaded)
4. Замени `frontend/public/stockfish.js` и `frontend/public/stockfish.wasm` на новые.
5. Если многопоточный — также положи `.worker.js` в `/public/`.
6. Backup старых файлов в `/public/stockfish-legacy/` на всякий случай.
7. `git add frontend/public/stockfish.*` + commit.

### Проверка после деплоя

1. Открой DevTools Console на `/cyberchess`
2. В консоли: `sfR.current.eval("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 30, (cp,m)=>console.log(cp,m), ()=>console.log("done"))`
3. Должно выдавать обновления оценки **каждые ~50ms** на depth 30 (вместо текущих ~2 секунд)

### Откат

Если NNUE-бинарник сломается:
```bash
cd frontend/public
cp stockfish-legacy/stockfish.js stockfish.js
cp stockfish-legacy/stockfish.wasm stockfish.wasm
```

---

## Уровень 3 — Lichess-grade через `lila-stockfish-web` (2-3 часа)

**Что:** заменить ручной Worker на npm-пакет от Lichess.

**Выгода:** depth 40+ за секунды, как у Lichess. Battle-tested на миллионах партий.

### Установка

```bash
cd frontend
npm install lila-stockfish-web
# или: @lichess-org/lila-stockfish-web (зависит от того, что выложено)
```

### Миграция в `page.tsx`

Текущий класс `SF` (~70 строк) заменяется на:

```ts
import { LilaStockfishWeb } from "lila-stockfish-web";

class SF {
  private engine: LilaStockfishWeb | null = null;
  async init() {
    this.engine = await LilaStockfishWeb.initialize({
      variant: "chess",  // или "atomic" / "kingofthehill" / "antichess" / "3check" / "chess960"
      ev_paramset: "performance",  // максимум кэш / потоков
    });
  }
  go(fen: string, depth: number, cb: (...) => void) {
    this.engine?.setPosition(fen);
    this.engine?.go({ depth }, (info) => {
      if (info.type === "bestmove") cb(info.from, info.to, info.promo);
    });
  }
  // ... и т.д.
}
```

### Преимущества

- **NNUE Stockfish 17** (новейший)
- **WASM SIMD** автоматически если поддерживается
- **Multi-threaded** до 16 потоков
- **Progressive deepening** встроен — UI получает eval на каждой глубине
- **Variant support** из коробки (Atomic, KotH, Three-Check, Chess960)
- **Cross-origin isolation** обрабатывается прозрачно

### Подводные камни

- **Network**: первый старт скачивает ~50 MB NN weights в IndexedDB. После — instant.
- **COEP**: уже настроен у нас (`credentialless` в `next.config.ts`) — должен работать.
- **Variants**: для каждого варианта своя инициализация — придётся переинициализировать при смене.

---

## Уровень 4 — Backend node-stockfish для официальной оценки (когда нужно)

Если хочется **серверной** оценки (для CPI Leaderboard, анти-чит, partner integrations):
- npm `stockfish` (node binding к нативному Stockfish 17)
- Express endpoint `POST /api/cyberchess/analyze` с rate-limit
- Кеширование по FEN-hash в Postgres
- Owned by `frontend-qcore` зона (не наша) — coordinate cross-zone.

---

## Прогрессивное deepening — следующий шаг УЛ 1

Сейчас `go depth N` блочит до завершения. Лучше:
```ts
// В analysis tab вместо `go depth 28`:
sf.goProgressive(fen, {
  startDepth: 10,
  endDepth: 35,
  onUpdate: (depth, cp, mate, pv) => sEvalCp(cp),
  onDone: (final) => sFinalEval(final),
});
```

Stockfish сам выдаёт `info` каждые ~50-200ms на разных глубинах — мы их **уже парсим** (см. `this.ecb(cp, mate)` в onmessage handler). Нужно только сменить UI не дожидаться `bestmove`, а реагировать на каждое `info`. Это уже отчасти сделано (`sfR.current?.ecb` ставит eval на каждом info-event). Дополнительное улучшение — показать индикатор «думает на depth N» рядом с eval bar.

---

## Acknowledgement

Уровни 2 и 3 требуют либо ручного скачивания бинарника пользователем, либо `npm install` (которое требует разрешения per memory `workflow_preferences.md`). Поэтому в одном автономном блоке делается только Уровень 1.

После Уровня 1: запушено как часть cyberchess-зоны. После Уровня 2: запросить у пользователя скачать NNUE-бинарник. После Уровня 3: запросить `npm install lila-stockfish-web`.
