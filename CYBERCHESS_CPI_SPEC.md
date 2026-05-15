# AEVION CPI — Chess Performance Index

**Версия:** 0.1 (draft) · **Дата:** 2026-05-12 · **Зона:** aevion-core/main · CyberChess

Новая система рейтинга для AEVION CyberChess. Принципиально отличается от FIDE Elo, Lichess Glicko-2 и chess.com Glicko: **начисляет баллы за КАЖДУЮ партию независимо от результата**, на основе композитной оценки качества игры.

---

## 1. Проблема существующих систем

| Система | Что измеряет | Что упускает |
|---|---|---|
| FIDE Elo | Только результат партии (W/D/L) и Elo соперника | Качество ходов, понимание позиции, динамику прогресса |
| Lichess Glicko-2 | Результат + RD (rating deviation) | То же — игрок может расти качественно, но падать в рейтинге |
| chess.com Glicko | Результат + волатильность | То же |

**Следствие:** упорная игра с минимальным cpl-loss и 3 мат-видениями = **0 баллов**, если проиграл. Демотивирует тренировку.

---

## 2. AEVION CPI — Формула

Каждая партия даёт **ΔCPI**, который складывается с текущим CPI игрока.

```
ΔCPI =   w_E   · E_score
       + w_T   · T_score
       + w_O   · O_score
       + w_B   · B1_score
       + w_B2  · B2_score
       + w_B3  · B3_score
       + w_M1  · M1_score
       + w_M2  · M2_score
       + w_M3  · M3_score
       − w_H   · H_count
       + w_Br  · Br_count
       + R_bonus

CPI_new = clamp(CPI_old + ΔCPI, 0, 4000)
```

### Факторы

| Код | Что измеряет | Формула | Источник |
|---|---|---|---|
| **E** | Eval-loss — насколько твои ходы хуже лучших | `E_score = max(0, 1 − avg_CPL / 200)` | Stockfish 18 после каждого хода |
| **T** | Time management — равномерность затрат времени | `T_score = 1 − stddev(time_per_move) / avg_time` | Clock state |
| **O** | Opening book — % ходов в TOP-10 базы до 10-го хода | `O_score = book_hits / first_10_moves` | `openingExplorer.ts` |
| **B1** | Best line — % ходов = #1 engine choice | `B1_score = best_moves / total_moves` | Stockfish multiPV=3 |
| **B2** | Second line — % ходов = #2 | `B2_score = second_moves / total_moves` | Stockfish multiPV=3 |
| **B3** | Third line — % ходов = #3 | `B3_score = third_moves / total_moves` | Stockfish multiPV=3 |
| **M1** | Mate-in-1 detection — % найденных матов в 1 | `M1_score = found_M1 / available_M1` | Stockfish |
| **M2** | Mate-in-2 detection | то же для M2 | Stockfish |
| **M3** | Mate-in-3 detection | то же для M3 | Stockfish |
| **H** | Hangs — зевки фигур (CPL swing ≥ 300) | счётчик | eval diff per move |
| **Br** | Brilliancies — найденные жертвы / неочевидные сильные ходы | счётчик | `brilliancy.ts` (уже есть) |

### Веса (черновик, нужна симуляция)

```ts
const WEIGHTS = {
  w_E:  30,   // Eval-loss — самый важный (точность игры)
  w_T:  5,    // Time-mgmt — небольшой бонус за дисциплину
  w_O:  10,   // Opening book — поощряем теорию
  w_B:  20,   // Best line — основной показатель силы
  w_B2: 5,    // Second line — частичный кредит
  w_B3: 2,    // Third line — слабый частичный
  w_M1: 8,    // Mate-in-1 — базовый счёт мата
  w_M2: 15,   // Mate-in-2 — комбинационное зрение
  w_M3: 20,   // Mate-in-3 — настоящее мастерство
  w_H:  25,   // Hang penalty — жёстко наказываем зевки
  w_Br: 30,   // Brilliancy bonus — щедро поощряем находки
};
```

### R_bonus (результат-бонус)

```
W:  +10  (победа)
D:   +5  (ничья)
L:    0  (поражение — НЕ штрафуем, в отличие от Elo)
```

Бонус маленький по сравнению с факторами — результат не должен доминировать.

---

## 3. Примеры

### Пример 1: Партия проиграна, но качество хорошее
- CPL средний: 25 → `E_score = 1 - 25/200 = 0.875` → `+26.25`
- B1 hits: 18/40 = 0.45 → `+9.0`
- M1 found: 2/2 → `+8.0`
- M2 found: 1/1 → `+15.0`
- Hangs: 0
- Brilliancies: 1 → `+30.0`
- Result: L → `+0`

**ΔCPI ≈ +88** (даже за поражение)

### Пример 2: Партия выиграна, но с зевком
- CPL: 80 → `E_score = 0.6` → `+18.0`
- B1: 12/35 = 0.34 → `+6.8`
- M1: 0/0, M2: 0/0
- Hangs: 1 → `−25.0`
- Brilliancies: 0
- Result: W → `+10`

**ΔCPI ≈ +10** (победа есть, но качество посредственное)

### Пример 3: Идеальная ничья
- CPL: 8 → `E_score = 0.96` → `+28.8`
- B1: 30/40 = 0.75 → `+15.0`
- B2: 6/40 = 0.15 → `+0.75`
- Hangs: 0
- Result: D → `+5`

**ΔCPI ≈ +50** (большой плюс — техническая ничья)

**Сравнение с Elo:** в Elo пример 1 = минус, пример 2 = плюс, пример 3 ≈ 0. В CPI — порядок инвертирован: 1 > 3 > 2. Это **точнее отражает качество игры**.

---

## 4. Архитектура реализации

```
frontend/src/app/cyberchess/
├── cpi/
│   ├── page.tsx            ← Preview / breakdown page
│   ├── dashboard/page.tsx  ← Полный дашборд (F4)
│   └── lib.ts              ← computeGameCPI(metrics) → ΔCPI (F3)
├── cpi.ts                  ← Главный helper: typings + weights + formula
└── stockfishMetrics.ts     ← (F2) сбор per-move metrics в game loop
```

### Storage

```ts
type CPIState = {
  v: 1;
  cpi: number;
  history: Array<{
    date: string;
    delta: number;
    gameId?: string;
    breakdown: {
      E: number; T: number; O: number;
      B1: number; B2: number; B3: number;
      M1: number; M2: number; M3: number;
      H: number; Br: number;
      result: "w" | "l" | "d";
    };
  }>;
};
// localStorage key: aevion_cyberchess_cpi_v1
```

---

## 5. Roadmap

- **F1** (сейчас) — spec doc + preview page `/cyberchess/cpi`
- **F2** — Stockfish multiPV integration в game loop
- **F3** — `cpi.ts` `computeGameCPI()` + unit tests
- **F4** — `/cyberchess/cpi/dashboard` с SVG графиками
- **F5** — Coach by CPI — автоподборка упражнений по слабейшему фактору

---

## 6. Open questions (для дискуссии)

1. **Weighting**: нужно симулировать на 100+ исторических партиях разного уровня и подстроить веса
2. **CPI ↔ FIDE mapping**: показывать ли «эквивалент по FIDE» (e.g. CPI 1800 ≈ FIDE 1600)? Может смущать
3. **Anti-cheat**: при подключении к stockfish сильный игрок может симулировать «человеческие ошибки» для CPI inflation. Решение: считать только в режимах против AI или в верифицированных матчах
4. **Decay**: должен ли CPI «затухать» если не играешь неделями? Скорее нет — это не Elo
5. **Glass ceiling**: 4000 — это потолок. Имеет ли смысл? Для топ-игроков может быть мало

---

*Документ субъектен к ревизии. Версия 0.1 от 2026-05-12.*
