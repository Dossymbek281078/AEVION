/**
 * voiceCoachPrompt.ts
 *
 * Rule-based prompt builder for CyberChess AI Voice Coach.
 * Generates short (1-2 sentence) commentary strings in Russian
 * based on the latest board state, move metadata and engine evaluation.
 *
 * No LLM calls in MVP — pure deterministic templates.
 */

export interface MoveInfo {
  san?: string;
  from?: string;
  to?: string;
  piece?: string; // 'p','n','b','r','q','k'
  color?: 'w' | 'b';
}

export interface EvalInfo {
  cp?: number | null;   // centipawns from White's POV
  mate?: number | null; // mate in N (positive = White mates, negative = Black mates)
}

export interface BuildCommentInput {
  fen?: string;
  lastMove?: MoveInfo | null;
  eval?: EvalInfo | null;
  prevEval?: EvalInfo | null;
  depth?: number;
  isCheck?: boolean;
  isCapture?: boolean;
  isCastling?: boolean;
  isPromotion?: boolean;
  phase?: 'opening' | 'middlegame' | 'endgame';
  moveNumber?: number;
}

const pieceNameRu: Record<string, string> = {
  p: 'пешка',
  n: 'конь',
  b: 'слон',
  r: 'ладья',
  q: 'ферзь',
  k: 'король',
};

const pieceVerbMoveRu: Record<string, string> = {
  p: 'пешка пошла',
  n: 'конь прыгнул',
  b: 'слон вышел',
  r: 'ладья перешла',
  q: 'ферзь вышел',
  k: 'король отошёл',
};

function sideRu(c?: 'w' | 'b'): string {
  if (c === 'w') return 'Белые';
  if (c === 'b') return 'Чёрные';
  return 'Игрок';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Estimate how much the eval changed for the side that just moved.
 * Returns delta in centipawns from the perspective of the player who moved.
 * Positive delta = the mover improved their position.
 * Negative delta = the mover worsened their position (potential mistake/blunder).
 */
function evalDelta(
  prev: EvalInfo | null | undefined,
  curr: EvalInfo | null | undefined,
  moverColor: 'w' | 'b' | undefined,
): number | null {
  if (!prev || !curr) return null;
  if (prev.cp == null || curr.cp == null) return null;
  const delta = curr.cp - prev.cp;
  // eval is always from White's POV, so flip if mover is Black
  return moverColor === 'b' ? -delta : delta;
}

/**
 * Main entry point: build a 1-2 sentence Russian comment for the latest move.
 */
export function buildComment(input: BuildCommentInput): string {
  const move = input.lastMove ?? null;
  const ev = input.eval ?? null;
  const prev = input.prevEval ?? null;
  const side = sideRu(move?.color);
  const san = move?.san ?? '';
  const delta = evalDelta(prev, ev, move?.color);

  // ─── 1. Mate threat ────────────────────────────────────────────────────
  if (ev?.mate != null && ev.mate !== 0) {
    const n = Math.abs(ev.mate);
    const winnerWhite = ev.mate > 0;
    const winner = winnerWhite ? 'Белые' : 'Чёрные';
    if (n === 1) {
      return pickRandom([
        `${winner} объявляют мат в один ход — партия решена.`,
        `Мат в один! ${winner} завершают атаку.`,
      ]);
    }
    return pickRandom([
      `${winner} ведут к мату в ${n} ходов — позиция технически выиграна.`,
      `Мат в ${n} на горизонте у ${winner.toLowerCase()}.`,
    ]);
  }

  // ─── 2. Blunder (delta ≤ -300) ─────────────────────────────────────────
  if (delta != null && delta <= -300) {
    return pickRandom([
      `${side} серьёзно ошиблись — ход ${san} проигрывает материал или позицию.`,
      `Зевок! ${san} — это грубая ошибка, оценка обрушилась.`,
      `${side} допустили бландер: ход ${san} меняет картину партии.`,
    ]);
  }

  // ─── 3. Mistake (delta ≤ -150) ─────────────────────────────────────────
  if (delta != null && delta <= -150) {
    return pickRandom([
      `${side} неточно — ${san} ослабляет позицию, лучше было искать активный план.`,
      `Ошибка: ход ${san} даёт сопернику инициативу.`,
      `${san} — это серьёзный промах, оценка ухудшилась.`,
    ]);
  }

  // ─── 4. Inaccuracy (delta ≤ -50) ───────────────────────────────────────
  if (delta != null && delta <= -50) {
    return pickRandom([
      `Небольшая неточность: ${san} не лучший выбор, но позиция держится.`,
      `${side} могли сыграть точнее — ${san} отдаёт часть преимущества.`,
    ]);
  }

  // ─── 5. Great move (delta ≥ +150) ──────────────────────────────────────
  if (delta != null && delta >= 150) {
    return pickRandom([
      `Отличный ход! ${san} резко улучшает позицию ${side.toLowerCase()}.`,
      `${side} нашли сильнейшее: ${san} — это удар, меняющий оценку.`,
      `Превосходно! ${san} ставит соперника в тяжёлое положение.`,
    ]);
  }

  // ─── 6. Mate-in-one threat after capture / check ───────────────────────
  // (handled inside check/capture branches below)

  // ─── 7. Check ──────────────────────────────────────────────────────────
  if (input.isCheck) {
    return pickRandom([
      `${side} объявляют шах ходом ${san} — соперник вынужден реагировать.`,
      `Шах! ${san} нарушает координацию обороны.`,
      `${side} тревожат короля: ${san} ставит шах и сужает выбор ответов.`,
    ]);
  }

  // ─── 8. Capture ────────────────────────────────────────────────────────
  if (input.isCapture) {
    const piece = move?.piece ? pieceNameRu[move.piece] ?? 'фигура' : 'фигура';
    return pickRandom([
      `${side} берут фигуру ходом ${san} — материальный баланс изменился.`,
      `Размен: ${san}. ${side} забирают материал, ${piece} выходит в работу.`,
      `${side} съедают фигуру (${san}) — теперь важно реализовать перевес.`,
    ]);
  }

  // ─── 9. Castling ───────────────────────────────────────────────────────
  if (input.isCastling) {
    return pickRandom([
      `${side} рокировались — король в безопасности, ладья включается в игру.`,
      `Рокировка! ${side} завершают развитие и готовятся к активным действиям.`,
    ]);
  }

  // ─── 10. Promotion ─────────────────────────────────────────────────────
  if (input.isPromotion) {
    return pickRandom([
      `Превращение! ${side} получают новую фигуру ходом ${san} — это решающий фактор.`,
      `${san} — пешка превращается, материальный перевес стремительно растёт.`,
    ]);
  }

  // ─── 11. Winning / losing advantage (large absolute eval) ──────────────
  if (ev?.cp != null) {
    const abs = Math.abs(ev.cp);
    if (abs >= 300) {
      const leader = ev.cp > 0 ? 'Белые' : 'Чёрные';
      if (abs >= 600) {
        return pickRandom([
          `${leader} имеют решающий перевес — задача теперь точно довести партию до победы.`,
          `Позиция почти выиграна у ${leader.toLowerCase()}: оценка серьёзно в их пользу.`,
        ]);
      }
      return pickRandom([
        `${leader} держат заметное преимущество — продолжайте давить.`,
        `Перевес на стороне ${leader.toLowerCase()}: ход ${san} сохраняет инициативу.`,
      ]);
    }
  }

  // ─── 12. Opening principle ─────────────────────────────────────────────
  if (input.phase === 'opening') {
    if (move?.piece === 'n' || move?.piece === 'b') {
      return pickRandom([
        `${side} развивают фигуру (${san}) — типовой дебютный приём, борьба за центр.`,
        `${pieceVerbMoveRu[move.piece]} — ${side.toLowerCase()} продолжают развитие.`,
        `${san}: ${side.toLowerCase()} следуют дебютным принципам — развитие и контроль центра.`,
      ]);
    }
    if (move?.piece === 'p') {
      return pickRandom([
        `${side} играют ${san} — пешечный ход для контроля центра.`,
        `${san} — типовое продвижение в дебюте, открывает диагонали и линии.`,
      ]);
    }
    return pickRandom([
      `${san}: ${side.toLowerCase()} продолжают дебютную фазу, расставляют фигуры.`,
    ]);
  }

  // ─── 13. Endgame technique ─────────────────────────────────────────────
  if (input.phase === 'endgame') {
    if (move?.piece === 'k') {
      return pickRandom([
        `${side} активизируют короля (${san}) — в эндшпиле он мощная фигура.`,
        `Король выходит в центр: ${san} — классическая эндшпильная техника.`,
      ]);
    }
    if (move?.piece === 'p') {
      return pickRandom([
        `${san}: ${side.toLowerCase()} двигают пешку — гонка к превращению начинается.`,
        `Пешечный прогресс — ${san} приближает превращение.`,
      ]);
    }
    return pickRandom([
      `Эндшпиль: ${san} — точная техника решает исход партии.`,
      `${side} переводят фигуру (${san}) — в окончании каждый темп на счету.`,
    ]);
  }

  // ─── 14. Middlegame quiet move ─────────────────────────────────────────
  if (move?.piece && pieceVerbMoveRu[move.piece]) {
    return pickRandom([
      `${pieceVerbMoveRu[move.piece]} — ${side.toLowerCase()} перестраивают силы (${san}).`,
      `${san}: спокойный ход в миттельшпиле, ${side.toLowerCase()} готовят следующую идею.`,
    ]);
  }

  // ─── 15. Generic fallback ──────────────────────────────────────────────
  if (san) {
    return pickRandom([
      `${side} сыграли ${san} — позиция продолжает развиваться.`,
      `${san}: ход, сохраняющий равновесие.`,
    ]);
  }
  return 'Партия продолжается — следите за изменением позиции.';
}

export default buildComment;
