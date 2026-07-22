/**
 * voiceCoachPrompt.ts
 *
 * Prompt builder for CyberChess AI Voice Coach.
 *
 * Two modes:
 *   1. buildComment(...)       — rule-based, deterministic Russian templates (fallback).
 *   2. buildCommentLLM(...)    — LLM-backed (via AEVION QCoreAI), with rule-based fallback.
 *   3. answerQuestion(...)     — multi-turn Q&A mode (LLM only).
 *
 * QCoreAI endpoint contract (compatible with /api/qcoreai/chat):
 *   POST { model?, messages: [{role,content}], temperature?, max_tokens? }
 *   → { choices: [{ message: { role, content } }] }
 *
 * Env vars (consumed by callers, not by this module):
 *   QCOREAI_BASE — fully-qualified base URL of QCoreAI service when running
 *                  outside the monorepo. Defaults to '/api/qcoreai' (same-origin).
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  /** Base URL of QCoreAI service. Defaults to '/api/qcoreai'. */
  qcoreaiBase?: string;
  /** Model id (passed to QCoreAI; provider decides). */
  model?: string;
  /** Sampling temperature 0..1. */
  temperature?: number;
  /** Hard timeout in ms for the LLM call (default 4000). */
  timeoutMs?: number;
  /** Optional abort signal (combined with the internal timeout). */
  signal?: AbortSignal;
  /** Output token budget (default 220 — sized for 1-2 sentence move commentary; answerQuestion overrides this, see below). */
  maxTokens?: number;
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
 * Pure / deterministic — used both as standalone output and as LLM fallback.
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
  // Даже без данных движка не скатываемся в «позиция развивается» — держим
  // конкретную шахматную мысль (активность, поля, темп, инициатива).
  if (san) {
    return pickRandom([
      `${side} играют ${san} — теперь вопрос, кто первым создаст конкретную угрозу и захватит инициативу.`,
      `${san}: оцените активность фигур и слабые поля — от этого зависит следующий план.`,
      `${side} сделали ${san}; ключ к позиции — контроль центра и безопасность короля.`,
    ]);
  }
  return 'Позиция примерно равна — ищите активный план: улучшайте худшую фигуру и боритесь за ключевые поля.';
}

// ────────────────────────────────────────────────────────────────────────
// LLM helpers (QCoreAI-backed)
// ────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_COACH =
  'Ты — гроссмейстер и комментатор мирового уровня (сила игры 2600+ Elo), ' +
  'ведёшь разбор партии по-русски. Твой комментарий — точный и содержательный, ' +
  'как у сильного секунданта на турнире, а не общие слова.\n' +
  'Правила:\n' +
  '- Строго 1-2 живых предложения.\n' +
  '- Опирайся на FEN и оценку движка: называй КОНКРЕТНЫЕ факторы — тактические угрозы ' +
  'и мотивы (связка, вилка, вскрытое нападение, слабая последняя горизонталь), сильные и ' +
  'слабые поля, активность и координацию фигур, безопасность короля, пешечную структуру, ' +
  'открытые линии, планы обеих сторон.\n' +
  '- Если ход сильный или слабый — объясни ПОЧЕМУ (что он даёт или чего лишает), ' +
  'а не «хороший ход» / «позиция развивается».\n' +
  '- Где уместно — подскажи идею следующего хода или план в 1-2 словах.\n' +
  '- Стандартная нотация (e4, Nf3, O-O). Без воды, без англицизмов, без пустых фраз.';

const SYSTEM_PROMPT_QA =
  'Ты — гроссмейстер (2600+ Elo) и личный тренер игрока, отвечаешь по-русски. ' +
  'Отвечай конкретно и содержательно (2-4 предложения), опираясь на FEN, оценку движка ' +
  'и историю ходов. Называй конкретные ходы-кандидаты в нотации, тактические мотивы, ' +
  'сильные/слабые поля и типовые планы за обе стороны — как настоящий тренер, а не общими ' +
  'словами. КРИТИЧЕСКИ ВАЖНО: любой ход, который ты называешь как возможный/рекомендуемый ' +
  'ход В ТЕКУЩЕЙ позиции, ДОЛЖЕН дословно совпадать с одним из ходов в списке «Легальные ' +
  'ходы» из контекста — если хода там нет, он невозможен на доске, не называй его. Если не ' +
  'уверен в конкретном ходе — говори про идею/план словами, а не выдумывай нотацию. «Лучший ' +
  'ход по движку», если он есть в контексте, уже проверен и всегда легален — используй его ' +
  'как основу для конкретных рекомендаций. Если вопрос не про шахматы — мягко верни диалог к партии.';

function joinSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const ctrl = new AbortController();
  for (const s of signals) {
    if (!s) continue;
    if (s.aborted) {
      ctrl.abort();
      break;
    }
    s.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}

function withTimeout(ms: number, parent?: AbortSignal): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => clearTimeout(t),
  };
}

/**
 * Call QCoreAI /chat endpoint with a list of messages.
 * Returns the assistant content (trimmed) or throws.
 */
async function callQCoreAIChat(
  messages: ChatMessage[],
  opts: LLMOptions = {},
): Promise<string> {
  const base = (opts.qcoreaiBase ?? '/api/qcoreai').replace(/\/+$/, '');
  const url = `${base}/chat`;
  const { signal: timeoutSignal, cancel } = withTimeout(
    opts.timeoutMs ?? 4000,
    opts.signal,
  );

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0.5,
        // Default (220) fits buildCommentLLM's 1-2 sentence per-move remark.
        // answerQuestion (GM-разбор — full position analysis: eval + ideas +
        // plans for both sides + what to play next) asks for far more room —
        // it used to share this same 220 cap and get truncated mid-thought.
        max_tokens: opts.maxTokens ?? 220,
        messages,
      }),
      signal: timeoutSignal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`qcoreai ${r.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await r.json()) as {
      // AEVION QCoreAI /chat returns { ..., reply }. Tolerate OpenAI-style and
      // { text } / { content } shapes too.
      reply?: string;
      choices?: Array<{ message?: { content?: string } }>;
      text?: string;
      content?: string;
    };
    const content =
      data?.reply ??
      data?.choices?.[0]?.message?.content ??
      data?.text ??
      data?.content ??
      '';
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) throw new Error('qcoreai: empty content');
    return text;
  } finally {
    cancel();
  }
}

/**
 * Build the user-side prompt for per-move commentary.
 */
function buildCoachUserMessage(input: BuildCommentInput): string {
  const move = input.lastMove ?? null;
  const ev = input.eval ?? null;
  const prev = input.prevEval ?? null;
  const flags: string[] = [];
  if (input.isCheck) flags.push('шах');
  if (input.isCapture) flags.push('взятие');
  if (input.isCastling) flags.push('рокировка');
  if (input.isPromotion) flags.push('превращение пешки');

  const lines: string[] = [];
  if (input.fen) lines.push(`FEN: ${input.fen}`);
  if (move?.san) {
    const fromTo =
      move.from && move.to ? ` (${move.from}-${move.to})` : '';
    lines.push(`Ход: ${move.san}${fromTo}`);
  }
  if (move?.color) {
    lines.push(`Сторона: ${move.color === 'w' ? 'Белые' : 'Чёрные'}`);
  }
  if (input.phase) lines.push(`Фаза: ${input.phase}`);
  if (input.moveNumber != null) lines.push(`Номер хода: ${input.moveNumber}`);

  if (ev?.mate != null && ev.mate !== 0) {
    lines.push(`Eval: мат в ${Math.abs(ev.mate)} (${ev.mate > 0 ? 'у белых' : 'у чёрных'})`);
  } else if (ev?.cp != null) {
    lines.push(`Eval: ${(ev.cp / 100).toFixed(2)} (от лица белых)`);
    if (prev?.cp != null) {
      const d = ev.cp - prev.cp;
      lines.push(
        `Δeval: ${(d / 100).toFixed(2)} (изменение оценки от предыдущей позиции)`,
      );
    }
  }

  if (flags.length) lines.push(`Особенности: ${flags.join(', ')}`);
  lines.push(
    'Дай гроссмейстерский комментарий (1-2 предложения): что этот ход реально ' +
      'меняет в позиции, какая теперь главная угроза или план. Конкретно, ' +
      'по существу, без общих фраз.',
  );
  return lines.join('\n');
}

/**
 * Build a real-LLM comment via QCoreAI.
 * Falls back to the rule-based `buildComment` on any error / timeout.
 */
export async function buildCommentLLM(
  input: BuildCommentInput,
  opts: LLMOptions = {},
): Promise<string> {
  try {
    const userMsg = buildCoachUserMessage(input);
    const text = await callQCoreAIChat(
      [
        { role: 'system', content: SYSTEM_PROMPT_COACH },
        { role: 'user', content: userMsg },
      ],
      { ...opts, temperature: opts.temperature ?? 0.4 },
    );
    return text;
  } catch (err) {
    // Silent fallback — LLM is best-effort.
    return buildComment(input);
  }
}

export interface QAContext {
  fen?: string;
  /** Last played move (SAN). */
  lastMove?: string | MoveInfo | null;
  /** Recent move history as a list (newest last). */
  history?: Array<string | MoveInfo>;
  /** Prior chat turns (assistant ↔ user) for this Q&A session. */
  priorMessages?: ChatMessage[];
  /** Latest engine eval, if available. */
  eval?: EvalInfo | null;
  /** Player side (which colour the user plays as), if known. */
  userSide?: 'w' | 'b';
  /**
   * Every legal move (SAN) in the current position, computed client-side by
   * chess.js — deterministic and always correct. Without this the model has
   * nothing to check itself against when it names a "candidate move", and
   * LLMs are unreliable at chess legality from a raw FEN alone (reported
   * bug: the coach named moves that don't exist on the board).
   */
  legalMoves?: string[];
  /** Engine-verified best move (SAN), if the caller has one available. */
  bestMove?: string;
}

function describeMove(m: string | MoveInfo | null | undefined): string | null {
  if (!m) return null;
  if (typeof m === 'string') return m;
  if (m.san) return m.san;
  if (m.from && m.to) return `${m.from}-${m.to}`;
  return null;
}

/**
 * Multi-turn Q&A: user asks "почему мой ход плохой?" etc.
 * Throws on LLM failure — caller decides how to surface the error.
 */
export async function answerQuestion(
  question: string,
  context: QAContext = {},
  opts: LLMOptions = {},
): Promise<string> {
  const q = (question ?? '').trim();
  if (!q) throw new Error('answerQuestion: empty question');

  const contextLines: string[] = [];
  if (context.fen) contextLines.push(`FEN: ${context.fen}`);
  if (context.userSide) {
    contextLines.push(
      `Игрок играет: ${context.userSide === 'w' ? 'белыми' : 'чёрными'}`,
    );
  }
  const last = describeMove(context.lastMove);
  if (last) contextLines.push(`Последний ход: ${last}`);
  if (Array.isArray(context.history) && context.history.length) {
    const tail = context.history
      .slice(-10)
      .map((m, i) => `${i + 1}. ${describeMove(m) ?? '?'}`)
      .join(' ');
    contextLines.push(`Последние ходы: ${tail}`);
  }
  if (context.eval?.mate != null && context.eval.mate !== 0) {
    contextLines.push(
      `Eval: мат в ${Math.abs(context.eval.mate)} (${
        context.eval.mate > 0 ? 'у белых' : 'у чёрных'
      })`,
    );
  } else if (context.eval?.cp != null) {
    contextLines.push(`Eval: ${(context.eval.cp / 100).toFixed(2)} (за белых)`);
  }
  if (context.bestMove) {
    contextLines.push(`Лучший ход по движку (проверен, легален): ${context.bestMove}`);
  }
  if (Array.isArray(context.legalMoves) && context.legalMoves.length) {
    contextLines.push(
      `Легальные ходы в этой позиции (${context.legalMoves.length}): ${context.legalMoves.join(', ')}`,
    );
  }

  const contextBlock = contextLines.length
    ? `Контекст партии:\n${contextLines.join('\n')}\n\n`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_QA },
  ];

  // Prior chat history (so the LLM remembers earlier turns in this session)
  if (Array.isArray(context.priorMessages) && context.priorMessages.length) {
    for (const m of context.priorMessages) {
      if (m && typeof m.content === 'string' && m.role !== 'system') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  messages.push({
    role: 'user',
    content: `${contextBlock}Вопрос игрока: ${q}`,
  });

  return callQCoreAIChat(messages, {
    ...opts,
    temperature: opts.temperature ?? 0.55,
    maxTokens: opts.maxTokens ?? 900,
  });
}

// Exposed so the route layer can avoid duplicating signature joining etc.
export const __internal = { joinSignals, callQCoreAIChat };

export default buildComment;
