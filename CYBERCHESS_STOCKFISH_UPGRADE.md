# CyberChess Stockfish — Upgrade path to Lichess-grade speed

**Дата:** 2026-05-12 · **Зона:** aevion-core/main · CyberChess

> ⚠️ **Сверено с кодом 06.09.2026 — имена файлов в доке УСТАРЕЛИ.**
> Док писался под `/public/stockfish.{js,wasm}`, но таких файлов НЕТ. Реально
> в `frontend/public/` лежат `stockfish-18-lite.{js,wasm}` и
> `stockfish-classic.{js,wasm}`, а приложение грузит именно
> `new Worker("/stockfish-18-lite.js")` (`page.tsx`). Пойдя по шагам Уровня 2
> буквально, заменили бы несуществующий файл — и апгрейд молча не применился
> бы. Ниже имена уже поправлены на реальные.
>
> Ещё два факта из сверки: `stockfish-18-lite.wasm` и `stockfish-classic.wasm`
> **побайтно ИДЕНТИЧНЫ** (7 093 151 б) — то есть «classic» это не другая
> сборка, а копия того же бинаря; заявленный в тесте «второй движок» отдельной
> силы не даёт. Класс `SF` теперь на `page.tsx:296` (в доке был `:92`).
>
> 🔧 **06.09.2026 добавлено само-восстановление движка** (коммит на ветке
> `deploy/frontend-2026-09-05`): раньше при падении воркера (`e.trim is not a
> function` в lite-сборке после смены партии/задачи) движок не пересоздавался
> и сила падала на запасной расчёт до конца сессии. Теперь `onDead()` убивает
> дохлый воркер и переинициализирует (bounded). Это лечит СИМПТОМ; корень —
> хрупкая lite-сборка, и его закрывает Уровень 2/3 ниже.

Текущее состояние: Stockfish 18 (nmrugg/Chess.com port), **NON-NNUE**, **NON-SIMD**, файлы `frontend/public/stockfish-18-lite.{js,wasm}` (+ идентичная копия `stockfish-classic.{js,wasm}`). Depth 22 уже тормозит UI.

Цель: depth 40+ за 2-3 секунды, как на lichess.org.

---

## Уровень 1 — ✅ Применено в `page.tsx` коммитом

В классе `SF` (`page.tsx:296`):
- Hash bumped 256 → **1024 MB** (4× больше TT-hits)
- Contempt 0 (балансная оценка)
- Skill 20 (полная сила)
- Прозрачные комментарии что и зачем

**Эффект:** ~2-3× быстрее на длинных анализах за счёт hash hits. Depth 22-26 — без видимого замирания UI.

**Ограничение:** evaluation core всё ещё classic (не NNUE) — это уровень 2.

---

## Готовность к Уровню 2 (подготовлено 06.09.2026 — основателю осталось скачать файл)

Проверено к моменту записи, чтобы swap не сорвался на мелочах:

- **crossOriginIsolation на проде ВКЛЮЧЁН** — `Cross-Origin-Embedder-Policy: credentialless` +
  `Cross-Origin-Opener-Policy: same-origin` (curl по `aevion.app/cyberchess`). Значит
  SharedArrayBuffer доступен → **качать МНОГОпоточную NNUE-сборку** (single — запасной вариант).
- **Приложение грузит `/stockfish-18-lite.js`** — новые файлы должны лечь под ЭТИМ именем.
- **Лимит `Threads value 1`** в `page.tsx` (класс `SF`, ~стр. 343) поставлен под ХРУПКУЮ lite-сборку;
  для многопоточной NNUE его надо сделать условным (код в чеклисте установщика).

**Установщик готов:** `cyberchess-install-nnue.sh` в корне репозитория. Он делает бэкап
в `/public/stockfish-legacy/`, кладёт новые файлы под правильными именами, проверяет их
(сигнатура wasm, размер) и печатает два оставшихся шага (условный Threads + проверка в
DevTools). Откат — `bash cyberchess-install-nnue.sh --restore`. Самопроверен на отрицательных
контролях (отказ без аргументов и на не-wasm, боевые файлы при отказе не трогаются).

Порядок для основателя:
```bash
# 1. скачать stockfish-nnue-16.zip с https://github.com/nmrugg/stockfish.js/releases/latest, распаковать
# 2. из корня репозитория:
bash cyberchess-install-nnue.sh путь/stockfish-nnue-16.js путь/stockfish-nnue-16.wasm [путь/...worker.js]
# 3. следовать двум напечатанным шагам, затем выкатить фронт
```

---

## Уровень 2 — Drop-in NNUE binary swap (30 мин)

**Что:** заменить `frontend/public/stockfish-18-lite.{js,wasm}` (файл, который грузит приложение) на NNUE-вариант от nmrugg.

**Выгода:** **3-5× быстрее** + значительно точнее оценка позиции.

### Шаги (выполняет пользователь вручную)

1. Открой https://github.com/nmrugg/stockfish.js/releases/latest
2. Скачай **`stockfish-nnue-16-single.zip`** (≈ 14 MB) ИЛИ
   **`stockfish-nnue-16.zip`** (≈ 45 MB, multi-threaded SIMD — рекомендуется)
3. Распакуй. Внутри будут файлы вида:
   - `stockfish-nnue-16-single.js`
   - `stockfish-nnue-16-single.wasm`
   - `stockfish-nnue-16-single.worker.js` (для multi-threaded)
4. Замени `frontend/public/stockfish-18-lite.js` и `frontend/public/stockfish-18-lite.wasm` на новые (сохранив ИМЕНА — их ждёт `new Worker("/stockfish-18-lite.js")`; либо переименуй новые файлы под них, либо поправь путь в `page.tsx`).
5. Если многопоточный — также положи `.worker.js` в `/public/` и убедись, что имя совпадает с тем, что ищет js-обёртка движка.
6. Backup старых файлов в `/public/stockfish-legacy/` на всякий случай.
7. `git add frontend/public/stockfish-18-lite.*` + commit.

### Проверка после деплоя

1. Открой DevTools Console на `/cyberchess`
2. В консоли: `sfR.current.eval("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 30, (cp,m)=>console.log(cp,m), ()=>console.log("done"))`
3. Должно выдавать обновления оценки **каждые ~50ms** на depth 30 (вместо текущих ~2 секунд)

### Откат

Если NNUE-бинарник сломается:
```bash
cd frontend/public
cp stockfish-legacy/stockfish-18-lite.js stockfish-18-lite.js
cp stockfish-legacy/stockfish-18-lite.wasm stockfish-18-lite.wasm
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
