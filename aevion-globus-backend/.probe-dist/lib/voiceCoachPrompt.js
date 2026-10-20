"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__internal = void 0;
exports.buildComment = buildComment;
exports.buildCommentLLM = buildCommentLLM;
exports.legalMovesFromFen = legalMovesFromFen;
exports.describeBoardPieces = describeBoardPieces;
exports.answerQuestion = answerQuestion;
const chess_js_1 = require("chess.js");
const pieceNameRu = {
    p: 'пешка',
    n: 'конь',
    b: 'слон',
    r: 'ладья',
    q: 'ферзь',
    k: 'король',
};
const pieceVerbMoveRu = {
    p: 'пешка пошла',
    n: 'конь прыгнул',
    b: 'слон вышел',
    r: 'ладья перешла',
    q: 'ферзь вышел',
    k: 'король отошёл',
};
function sideRu(c) {
    if (c === 'w')
        return 'Белые';
    if (c === 'b')
        return 'Чёрные';
    return 'Игрок';
}
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
/**
 * Estimate how much the eval changed for the side that just moved.
 * Returns delta in centipawns from the perspective of the player who moved.
 * Positive delta = the mover improved their position.
 * Negative delta = the mover worsened their position (potential mistake/blunder).
 */
function evalDelta(prev, curr, moverColor) {
    if (!prev || !curr)
        return null;
    if (prev.cp == null || curr.cp == null)
        return null;
    const delta = curr.cp - prev.cp;
    // eval is always from White's POV, so flip if mover is Black
    return moverColor === 'b' ? -delta : delta;
}
/**
 * Main entry point: build a 1-2 sentence Russian comment for the latest move.
 * Pure / deterministic — used both as standalone output and as LLM fallback.
 */
function buildComment(input) {
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
const SYSTEM_PROMPT_COACH = 'Ты — гроссмейстер и комментатор мирового уровня (сила игры 2600+ Elo), ' +
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
    '- Где уместно — подскажи идею следующего хода или план в 1-2 словах. Если называешь ' +
    'конкретный ход-идею — он ДОЛЖЕН дословно совпадать с одним из ходов в списке «Легальные ' +
    'ходы» из контекста; если не уверен в конкретной нотации — говори про план словами, не ' +
    'выдумывай ход.\n' +
    '- Стандартная нотация (e4, Nf3, O-O). Без воды, без англицизмов, без пустых фраз.';
const SYSTEM_PROMPT_QA = 'Ты — гроссмейстер (2600+ Elo) и личный тренер игрока, отвечаешь по-русски. ' +
    'Отвечай конкретно и содержательно (2-4 предложения), опираясь на FEN, оценку движка ' +
    'и историю ходов. Называй конкретные ходы-кандидаты в нотации, тактические мотивы, ' +
    'сильные/слабые поля и типовые планы за обе стороны — как настоящий тренер, а не общими ' +
    'словами. КРИТИЧЕСКИ ВАЖНО: любой ход, который ты называешь как возможный/рекомендуемый ' +
    'ход В ТЕКУЩЕЙ позиции, ДОЛЖЕН дословно совпадать с одним из ходов в списке «Легальные ' +
    'ходы» из контекста — если хода там нет, он невозможен на доске, не называй его. Если не ' +
    'уверен в конкретном ходе — говори про идею/план словами, а не выдумывай нотацию. «Лучший ' +
    'ход по движку», если он есть в контексте, уже проверен и всегда легален — используй его ' +
    'как основу для конкретных рекомендаций. Если вопрос про состав доски (какие фигуры где ' +
    'стоят, перечисли фигуры/пешки) — бери ответ ДОСЛОВНО из строки «Фигуры на доске» в ' +
    'контексте, не воображай позицию по памяти и не пересчитывай FEN самостоятельно — там уже ' +
    'детерминированный список. Если вопрос не про шахматы — мягко верни диалог к партии.';
function joinSignals(...signals) {
    const ctrl = new AbortController();
    for (const s of signals) {
        if (!s)
            continue;
        if (s.aborted) {
            ctrl.abort();
            break;
        }
        s.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    return ctrl.signal;
}
function withTimeout(ms, parent) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    if (parent) {
        if (parent.aborted)
            ctrl.abort();
        else
            parent.addEventListener('abort', () => ctrl.abort(), { once: true });
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
async function callQCoreAIChat(messages, opts = {}) {
    const base = (opts.qcoreaiBase ?? '/api/qcoreai').replace(/\/+$/, '');
    const url = `${base}/chat`;
    const { signal: timeoutSignal, cancel } = withTimeout(opts.timeoutMs ?? 4000, opts.signal);
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
        const data = (await r.json());
        const content = data?.reply ??
            data?.choices?.[0]?.message?.content ??
            data?.text ??
            data?.content ??
            '';
        const text = typeof content === 'string' ? content.trim() : '';
        if (!text)
            throw new Error('qcoreai: empty content');
        return text;
    }
    finally {
        cancel();
    }
}
/**
 * Build the user-side prompt for per-move commentary.
 */
function buildCoachUserMessage(input) {
    const move = input.lastMove ?? null;
    const ev = input.eval ?? null;
    const prev = input.prevEval ?? null;
    const flags = [];
    if (input.isCheck)
        flags.push('шах');
    if (input.isCapture)
        flags.push('взятие');
    if (input.isCastling)
        flags.push('рокировка');
    if (input.isPromotion)
        flags.push('превращение пешки');
    const lines = [];
    if (input.fen) {
        lines.push(`FEN: ${input.fen}`);
        const legal = legalMovesFromFen(input.fen);
        if (legal.length) {
            lines.push(`Легальные ходы в этой позиции (${legal.length}): ${legal.join(', ')}`);
        }
    }
    if (move?.san) {
        const fromTo = move.from && move.to ? ` (${move.from}-${move.to})` : '';
        lines.push(`Ход: ${move.san}${fromTo}`);
    }
    if (move?.color) {
        lines.push(`Сторона: ${move.color === 'w' ? 'Белые' : 'Чёрные'}`);
    }
    if (input.phase)
        lines.push(`Фаза: ${input.phase}`);
    if (input.moveNumber != null)
        lines.push(`Номер хода: ${input.moveNumber}`);
    if (ev?.mate != null && ev.mate !== 0) {
        lines.push(`Eval: мат в ${Math.abs(ev.mate)} (${ev.mate > 0 ? 'у белых' : 'у чёрных'})`);
    }
    else if (ev?.cp != null) {
        lines.push(`Eval: ${(ev.cp / 100).toFixed(2)} (от лица белых)`);
        if (prev?.cp != null) {
            const d = ev.cp - prev.cp;
            lines.push(`Δeval: ${(d / 100).toFixed(2)} (изменение оценки от предыдущей позиции)`);
        }
    }
    if (flags.length)
        lines.push(`Особенности: ${flags.join(', ')}`);
    lines.push('Дай гроссмейстерский комментарий (1-2 предложения): что этот ход реально ' +
        'меняет в позиции, какая теперь главная угроза или план. Конкретно, ' +
        'по существу, без общих фраз.');
    return lines.join('\n');
}
/**
 * Build a real-LLM comment via QCoreAI.
 * Falls back to the rule-based `buildComment` on any error / timeout.
 */
async function buildCommentLLM(input, opts = {}) {
    try {
        const userMsg = buildCoachUserMessage(input);
        const text = await callQCoreAIChat([
            { role: 'system', content: SYSTEM_PROMPT_COACH },
            { role: 'user', content: userMsg },
        ], { ...opts, temperature: opts.temperature ?? 0.4 });
        return text;
    }
    catch (err) {
        // Silent fallback — LLM is best-effort.
        return buildComment(input);
    }
}
function describeMove(m) {
    if (!m)
        return null;
    if (typeof m === 'string')
        return m;
    if (m.san)
        return m.san;
    if (m.from && m.to)
        return `${m.from}-${m.to}`;
    return null;
}
const PIECE_RU = {
    k: 'Кр',
    q: 'Ф',
    r: 'Л',
    b: 'С',
    n: 'К',
    p: 'п',
};
/**
 * Deterministic legal-move list for `buildCommentLLM`'s per-move commentary,
 * computed server-side from the FEN alone (same trick as `describeBoardPieces`
 * below). `answerQuestion`'s hallucinated-move fix (#794/#803) relied on the
 * frontend passing `legalMoves`/`bestMove` — but `buildCommentLLM` is a
 * separate LLM touchpoint (per-move "GM разбор" remark, fired after every
 * move) that never got that grounding, even though its prompt explicitly
 * invites the model to suggest a next-move idea. Returns [] (not undefined)
 * on an invalid FEN so callers can treat "no moves" and "bad FEN" the same.
 */
function legalMovesFromFen(fen) {
    try {
        return new chess_js_1.Chess(fen).moves();
    }
    catch {
        return [];
    }
}
/**
 * Deterministic, chess.js-derived piece list for the current FEN — same
 * grounding pattern as `legalMoves`/`bestMove`. Descriptive "what's on the
 * board" questions aren't covered by legalMoves (that only fixes move
 * selection), so the model was omitting/inventing pieces when asked to
 * enumerate them (issue #858). Computed server-side from the FEN itself so
 * every caller gets it automatically, with no frontend changes required.
 */
function describeBoardPieces(fen) {
    let chess;
    try {
        chess = new chess_js_1.Chess(fen);
    }
    catch {
        return null;
    }
    const white = [];
    const black = [];
    for (const row of chess.board()) {
        for (const cell of row) {
            if (!cell)
                continue;
            const label = `${PIECE_RU[cell.type] ?? cell.type}${cell.square}`;
            (cell.color === 'w' ? white : black).push(label);
        }
    }
    if (!white.length && !black.length)
        return null;
    return (`Фигуры на доске (детерминированно из FEN, используй дословно при перечислении): ` +
        `белые (${white.length}) — ${white.join(', ')}; чёрные (${black.length}) — ${black.join(', ')}.`);
}
/**
 * Multi-turn Q&A: user asks "почему мой ход плохой?" etc.
 * Throws on LLM failure — caller decides how to surface the error.
 */
async function answerQuestion(question, context = {}, opts = {}) {
    const q = (question ?? '').trim();
    if (!q)
        throw new Error('answerQuestion: empty question');
    const contextLines = [];
    if (context.fen) {
        contextLines.push(`FEN: ${context.fen}`);
        const pieces = describeBoardPieces(context.fen);
        if (pieces)
            contextLines.push(pieces);
    }
    if (context.userSide) {
        contextLines.push(`Игрок играет: ${context.userSide === 'w' ? 'белыми' : 'чёрными'}`);
    }
    const last = describeMove(context.lastMove);
    if (last)
        contextLines.push(`Последний ход: ${last}`);
    if (Array.isArray(context.history) && context.history.length) {
        const tail = context.history
            .slice(-10)
            .map((m, i) => `${i + 1}. ${describeMove(m) ?? '?'}`)
            .join(' ');
        contextLines.push(`Последние ходы: ${tail}`);
    }
    if (context.eval?.mate != null && context.eval.mate !== 0) {
        contextLines.push(`Eval: мат в ${Math.abs(context.eval.mate)} (${context.eval.mate > 0 ? 'у белых' : 'у чёрных'})`);
    }
    else if (context.eval?.cp != null) {
        contextLines.push(`Eval: ${(context.eval.cp / 100).toFixed(2)} (за белых)`);
    }
    if (context.bestMove) {
        contextLines.push(`Лучший ход по движку (проверен, легален): ${context.bestMove}`);
    }
    if (Array.isArray(context.legalMoves) && context.legalMoves.length) {
        contextLines.push(`Легальные ходы в этой позиции (${context.legalMoves.length}): ${context.legalMoves.join(', ')}`);
    }
    const contextBlock = contextLines.length
        ? `Контекст партии:\n${contextLines.join('\n')}\n\n`
        : '';
    const messages = [
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
exports.__internal = { joinSignals, callQCoreAIChat };
exports.default = buildComment;
