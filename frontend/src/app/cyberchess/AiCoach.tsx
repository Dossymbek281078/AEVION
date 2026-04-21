"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Chess, type Square } from "chess.js";

/* ══════════════════════════════════════════════════════════════════════
   AEVION CyberChess — AI Coach v35

   v35 changes:
   - Each Coach request now runs Stockfish (depth 22, MultiPV 3) BEFORE calling
     Claude. Claude gets a precise engine report with evals and best lines.
   - Live Coach only comments on KEY MOMENTS (blunders, mistakes, great moves,
     opening moves) — not every single move.
   - Best-move hints: when you play a bad move, coach tells you what was better.
   ══════════════════════════════════════════════════════════════════════ */

type Msg = { role: "user" | "assistant"; content: string };

type PVLine = { pv: number; cp: number; mate: number; depth: number; moves: string[] };

type EngineReport = {
  fen: string;
  evalCp: number;
  evalMate: number;
  lines: PVLine[];
  lastMoveDelta?: number;
  lastMoveQuality?: "great" | "good" | "inaccuracy" | "mistake" | "blunder";
};

type Props = {
  fen: string;
  moves: string[];
  fenHist: string[];
  evalCp: number;
  evalMate: number;
  opening?: { eco: string; name: string; desc: string } | null;
  playerColor: "w" | "b";
  visible: boolean;
  onClose: () => void;
  runEngine?: (fen: string, depth: number, pvCount: number) => Promise<PVLine[]>;
  quickEval?: (fen: string, depth: number) => Promise<{ cp: number; mate: number }>;
};

const SYSTEM_DEEP = `You are a Grandmaster-level chess coach inside CyberChess by AEVION.

═══ GROUND TRUTH: ENGINE REPORT ═══
You will receive a Stockfish engine report at the top of the user message. This is
your source of truth. Never contradict it. Never invent variations not shown in it.
All evaluation numbers in your response must exactly match the engine block.

═══ CHESS ACCURACY RULES (critical) ═══
1. CHECK WHOSE PIECE before saying anything "hangs". If eval shows Black is winning
   but you want to say "the bishop hangs" — first verify which color bishop, on
   which square, and who can capture it. If unsure, don't claim it.
2. When discussing a move, always state COLOR explicitly:
   "White's 14.Nf3 is..." / "Black's 14...Nd3 threatens..." / never ambiguous.
3. Evaluation convention: ALL eval numbers in the report are from White's perspective.
   +2.40 = White better by 2.4 pawns. -2.40 = Black better by 2.4 pawns.
4. When the report shows "BLUNDER by White", the position went FROM better FOR WHITE
   TO worse FOR WHITE. Don't confuse the arrow direction.
5. To identify hanging pieces, use the FEN + move list. If you can't verify, say
   "the position is critical" without naming a specific hanging piece.
6. Use SAN from the engine's best-lines block — those are guaranteed legal.

═══ STYLE ═══
- Respond in the user's language (Russian default, also English/Kazakh).
- Algebraic notation: e4, Nf3, Qxf7+, O-O.
- Concrete over vague: "+0.4 advantage from better development" beats "you're a bit better".
- 2-4 paragraphs. No fluff.
- When user's move was bad, cite the engine's better move from the Best Lines section.
- Reference ECO codes for openings.
- Explain WHY: weak squares, tempo, king safety, pawn structure, piece activity, material.

═══ STRATEGIC PLANS (when asked) ═══
When the user asks for plans/ideas/strategy for a side (White, Black, or both):
1. START with SIDE NAME IN BOLD (e.g., **План белых:**)
2. Structure each side's plan as:
   - **Сильные стороны:** what they have going for them
   - **Слабости соперника:** what to target
   - **Конкретные маневры:** "Конь с f3 → d2 → f1 → g3", "Слон на большой диагонали a1-h8"
   - **Куда играть:** king-side attack / queen-side / center
   - **Тактика:** specific tactical ideas with concrete moves from engine lines
3. Be CONCRETE. "Develop pieces" is bad. "Перегруппировать коня: Nb1-d2-f1-g3 чтобы подключить к атаке на королевский фланг" is good.
4. Use engine's best lines to ANCHOR your plan in real variations.

═══ NEVER ═══
- Invent variations not in the engine report.
- Describe a piece as "hanging" without verifying which side owns it.
- Contradict the engine's eval or best line.
- Give vague praise; be specific and honest about mistakes.`;

const SYSTEM_LIVE = `You are a live chess coach commenting on KEY MOMENTS.

═══ ENGINE IS GROUND TRUTH ═══
The user message contains a Stockfish engine report. All your numbers MUST match it.
All piece references MUST match the FEN. Never invent variations.

═══ CHESS ACCURACY (critical) ═══
- ALL eval numbers are White's perspective: +X = White better, -X = Black better.
- BEFORE saying any piece "hangs" or "is attacked", verify its color from the FEN.
- When stating "the better move was X" — X must come from the engine's best-lines.
- State the color of the mover explicitly ("White's 16.Bg5" not just "16.Bg5").

═══ STYLE ═══
- 1-3 short sentences. Punchy. Russian default.
- Algebraic notation: 16.Bg5, 14...Qxf2+.
- If mistake/blunder: state eval drop + specific better move from engine block.
- If great move: say what concrete idea it achieves (mate threat, win of material, etc).
- Never generic praise ("interesting", "creative").`;

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://aevion-production-a70c.up.railway.app");

/* Helpers */

function uciLineToSan(startFen: string, uci: string[]): string {
  try {
    const ch = new Chess(startFen);
    const sans: string[] = [];
    const startColor = ch.turn();
    const startMoveNum = Math.floor(parseInt(startFen.split(" ")[5] || "1"));
    let ply = 0;
    for (const u of uci) {
      if (u.length < 4) break;
      const mv = ch.move({
        from: u.slice(0, 2) as Square,
        to: u.slice(2, 4) as Square,
        promotion: u.length > 4 ? (u[4] as any) : undefined,
      });
      if (!mv) break;
      const absPly = ply + (startColor === "w" ? 0 : 1);
      const isWhiteMove = absPly % 2 === 0;
      const currentMoveNum = startMoveNum + Math.floor(absPly / 2);
      if (isWhiteMove) {
        sans.push(`${currentMoveNum}.${mv.san}`);
      } else if (ply === 0 && startColor === "b") {
        sans.push(`${currentMoveNum}...${mv.san}`);
      } else {
        sans.push(mv.san);
      }
      ply++;
    }
    return sans.join(" ");
  } catch {
    return uci.join(" ");
  }
}

function formatEval(cp: number, mate: number): string {
  if (mate !== 0) return `#${mate > 0 ? mate : -mate}${mate > 0 ? "" : " (opp)"}`;
  const s = (cp / 100).toFixed(2);
  return cp >= 0 ? `+${s}` : s;
}

function classifyDelta(deltaCp: number): "great" | "good" | "inaccuracy" | "mistake" | "blunder" {
  if (deltaCp <= -50) return "great";
  if (deltaCp < 70) return "good";
  if (deltaCp < 150) return "inaccuracy";
  if (deltaCp < 300) return "mistake";
  return "blunder";
}

function qualityLabelRu(q: string): string {
  return q === "blunder" ? "Зевок"
       : q === "mistake" ? "Ошибка"
       : q === "inaccuracy" ? "Неточность"
       : q === "great" ? "Отличный ход"
       : "Хороший ход";
}

function buildEngineBlock(
  report: EngineReport,
  lastMoveSan?: string,
  sideWhoMoved?: "w" | "b",
  evalBeforeWhitePov?: number
): string {
  const lines: string[] = [];
  lines.push("═══ STOCKFISH ENGINE REPORT ═══");
  lines.push(`Position FEN: ${report.fen}`);
  const sideToMove = report.fen.split(" ")[1];
  lines.push(`Side to move: ${sideToMove === "w" ? "White" : "Black"}`);
  lines.push(`Current evaluation: ${formatEval(report.evalCp, report.evalMate)} (White's perspective: positive = White better)`);

  if (lastMoveSan && sideWhoMoved && typeof evalBeforeWhitePov === "number") {
    const evalAfterWhitePov = report.evalMate !== 0
      ? (report.evalMate > 0 ? 10000 : -10000)
      : report.evalCp;
    const deltaWhitePov = evalAfterWhitePov - evalBeforeWhitePov;
    // For the mover: if they're White, delta is positive when good for them.
    // If they're Black, delta is negative when good for them.
    const deltaForMover = sideWhoMoved === "w" ? deltaWhitePov : -deltaWhitePov;
    const quality = classifyDelta(-deltaForMover); // classifyDelta expects positive=worsened
    const movedColor = sideWhoMoved === "w" ? "White" : "Black";

    lines.push("");
    lines.push(`Last move played: ${lastMoveSan} by ${movedColor}`);
    lines.push(`  Eval BEFORE this move: ${formatEval(evalBeforeWhitePov, 0)} (White's perspective)`);
    lines.push(`  Eval AFTER this move:  ${formatEval(evalAfterWhitePov, report.evalMate)} (White's perspective)`);
    lines.push(`  → ${movedColor}'s position changed by ${(deltaForMover / 100).toFixed(2)} pawns`);
    lines.push(`  → Classification: ${qualityLabelRu(quality)}${quality === "blunder" || quality === "mistake" ? " — " + movedColor + " made a losing choice" : ""}`);
  } else if (lastMoveSan && sideWhoMoved) {
    lines.push("");
    lines.push(`Last move played: ${lastMoveSan} by ${sideWhoMoved === "w" ? "White" : "Black"}`);
  }

  if (report.lines.length > 0) {
    lines.push("");
    lines.push(`Best moves for ${sideToMove === "w" ? "White" : "Black"} (to move now):`);
    report.lines.forEach((l, i) => {
      const san = uciLineToSan(report.fen, l.moves);
      lines.push(`  ${i + 1}. [eval ${formatEval(l.cp, l.mate)}] ${san}`);
    });
    lines.push("");
    lines.push("These are the only variations you may cite. Do not invent others.");
  }
  lines.push("═══ END ENGINE REPORT ═══");
  return lines.join("\n");
}

function buildMovesStr(moves: string[]): string {
  if (!moves.length) return "Starting position";
  return moves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m)).join(" ");
}

/* Component */

export default function AiCoach({
  fen, moves, fenHist, evalCp, evalMate, opening, playerColor, visible, onClose,
  runEngine, quickEval,
}: Props) {
  const [msgs, sMsgs] = useState<Msg[]>([]);
  const [input, sInput] = useState("");
  const [loading, sLoading] = useState(false);
  const [error, sError] = useState("");
  const [engineThinking, sEngineThinking] = useState(false);

  const [liveMode, sLiveMode] = useState(false);
  const [liveComments, sLiveComments] = useState<
    { move: number; san: string; comment: string; quality?: string }[]
  >([]);
  const lastCommentedMoveIdx = useRef(0);
  const prevEvalCache = useRef<Map<string, number>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);
  useEffect(() => {
    liveRef.current?.scrollTo({ top: liveRef.current.scrollHeight, behavior: "smooth" });
  }, [liveComments]);

  const analyzePosition = useCallback(
    async (targetFen: string, depth = 22, pvCount = 3): Promise<EngineReport | null> => {
      if (!runEngine) return null;
      try {
        const lines = await runEngine(targetFen, depth, pvCount);
        if (!lines.length) return null;
        const sideToMove = targetFen.split(" ")[1];
        const sign = sideToMove === "w" ? 1 : -1;
        const normalized = lines.map((l) => ({ ...l, cp: l.cp * sign, mate: l.mate * sign }));
        const best = normalized[0];
        return { fen: targetFen, evalCp: best.cp, evalMate: best.mate, lines: normalized };
      } catch {
        return null;
      }
    },
    [runEngine]
  );

  const computeMoveDelta = useCallback(
    async (fenBefore: string, fenAfter: string): Promise<number | null> => {
      if (!quickEval) return null;
      try {
        let evalBefore = prevEvalCache.current.get(fenBefore);
        if (evalBefore === undefined) {
          const r = await quickEval(fenBefore, 14);
          const sideBefore = fenBefore.split(" ")[1];
          const signBefore = sideBefore === "w" ? 1 : -1;
          evalBefore = r.mate !== 0 ? (r.mate > 0 ? 10000 : -10000) * signBefore : r.cp * signBefore;
          prevEvalCache.current.set(fenBefore, evalBefore);
        }
        const rAfter = await quickEval(fenAfter, 14);
        const sideAfter = fenAfter.split(" ")[1];
        const signAfter = sideAfter === "w" ? 1 : -1;
        const evalAfter = rAfter.mate !== 0
          ? (rAfter.mate > 0 ? 10000 : -10000) * signAfter
          : rAfter.cp * signAfter;
        prevEvalCache.current.set(fenAfter, evalAfter);

        const moverWasWhite = fenBefore.split(" ")[1] === "w";
        // Delta = how much the position worsened for the mover.
        // Positive delta = mover's eval dropped (bad move).
        const delta = moverWasWhite ? evalBefore - evalAfter : evalAfter - evalBefore;
        return delta;
      } catch {
        return null;
      }
    },
    [quickEval]
  );

  const send = useCallback(
    async (userText?: string, opts?: { skipEngine?: boolean }) => {
      const userMsg = userText || input.trim();
      if (!userMsg && msgs.length === 0) return;

      const newMsgs: Msg[] = [...msgs];
      if (userMsg) {
        newMsgs.push({ role: "user", content: userMsg });
        sMsgs(newMsgs);
        sInput("");
      }

      sLoading(true);
      sError("");

      try {
        let engineBlock = "";
        if (!opts?.skipEngine && newMsgs.length === 1) {
          sEngineThinking(true);
          const report = await analyzePosition(fen, 22, 3);
          sEngineThinking(false);
          if (report) {
            let evalBeforeWhitePov: number | undefined;
            if (moves.length > 0 && fenHist.length >= 2 && quickEval) {
              const prevFen = fenHist[fenHist.length - 2];
              // Get eval of prev position in White's perspective
              const prev = await quickEval(prevFen, 14);
              const prevSide = prevFen.split(" ")[1];
              const prevSign = prevSide === "w" ? 1 : -1;
              evalBeforeWhitePov = prev.mate !== 0
                ? (prev.mate > 0 ? 10000 : -10000) * prevSign
                : prev.cp * prevSign;
            }
            const lastSan = moves[moves.length - 1];
            const sideMoved = moves.length > 0
              ? ((moves.length % 2 === 1) ? "w" : "b") as "w" | "b"
              : undefined;
            engineBlock = buildEngineBlock(report, lastSan, sideMoved, evalBeforeWhitePov);
          }
        }

        const apiMsgs: Msg[] = newMsgs.map((m, i) => {
          if (i === 0 && m.role === "user") {
            const ctx: string[] = [];
            if (engineBlock) ctx.push(engineBlock);
            ctx.push("");
            ctx.push(`Game moves so far: ${buildMovesStr(moves)}`);
            if (opening) ctx.push(`Opening: ${opening.eco} ${opening.name} (${opening.desc})`);
            ctx.push(`You are coaching ${playerColor === "w" ? "White" : "Black"}.`);
            ctx.push("");
            ctx.push("User question:");
            ctx.push(m.content);
            return { role: "user", content: ctx.join("\n") };
          }
          return m;
        });

        const res = await fetch(`${BACKEND}/api/coach/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: SYSTEM_DEEP,
            messages: apiMsgs,
            maxTokens: 1200,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `Server error ${res.status}`);
        }
        const data = await res.json();
        const reply =
          data.content?.filter((c: any) => c.type === "text" || c.text)
            .map((c: any) => c.text || "").join("") || "No response";
        sMsgs([...newMsgs, { role: "assistant", content: reply }]);
      } catch (e: any) {
        sError(e.message || "Connection failed");
      } finally {
        sLoading(false);
        sEngineThinking(false);
      }
    },
    [fen, moves, fenHist, opening, playerColor, msgs, input, analyzePosition, computeMoveDelta]
  );

  // Live Coach — only on key moments
  useEffect(() => {
    if (!liveMode || !visible || moves.length === 0) return;
    if (moves.length <= lastCommentedMoveIdx.current) return;

    const moveIdx = moves.length;
    lastCommentedMoveIdx.current = moveIdx;

    const lastSan = moves[moves.length - 1];
    const moveNum = Math.ceil(moves.length / 2);
    const side: "w" | "b" = moves.length % 2 === 1 ? "w" : "b";

    (async () => {
      if (fenHist.length < 2 || !quickEval || !runEngine) return;

      const fenBefore = fenHist[fenHist.length - 2];
      // Get eval BEFORE the move (White perspective)
      const before = await quickEval(fenBefore, 14);
      const beforeSide = fenBefore.split(" ")[1];
      const beforeSign = beforeSide === "w" ? 1 : -1;
      const evalBeforeWhitePov = before.mate !== 0
        ? (before.mate > 0 ? 10000 : -10000) * beforeSign
        : before.cp * beforeSign;

      const delta = await computeMoveDelta(fenBefore, fen);
      if (delta === null) return;

      const quality = classifyDelta(delta);
      // Comment on every move when live mode is on (was: only key moments)

      // Analyze the BEFORE position — this gives us the best alternative moves
      // that were available (so we can say "should have played X instead").
      const reportBefore = await analyzePosition(fenBefore, 18, 3);
      if (!reportBefore) return;

      // For the engine block, we show:
      //   - Position: reportBefore (shows alternatives the mover had)
      //   - lastMoveSan: what they actually played
      //   - evalBeforeWhitePov: position eval before the move
      // But we also need the eval AFTER so Claude sees the drop. Let's build a custom prompt.
      const afterEval = await quickEval(fen, 14);
      const afterSide = fen.split(" ")[1];
      const afterSign = afterSide === "w" ? 1 : -1;
      const evalAfterWhitePov = afterEval.mate !== 0
        ? (afterEval.mate > 0 ? 10000 : -10000) * afterSign
        : afterEval.cp * afterSign;

      // Build a block focused on the BEFORE position with clear delta explanation
      const blockLines: string[] = [];
      blockLines.push("═══ STOCKFISH ENGINE REPORT ═══");
      blockLines.push(`Position BEFORE the move: ${fenBefore}`);
      blockLines.push(`Position AFTER the move:  ${fen}`);
      blockLines.push(`Move to evaluate: ${side === "w" ? "White" : "Black"} played ${moveNum}${side === "w" ? "." : "..."} ${lastSan}`);
      blockLines.push("");
      blockLines.push(`Eval BEFORE move: ${formatEval(evalBeforeWhitePov, 0)} (White's perspective)`);
      blockLines.push(`Eval AFTER move:  ${formatEval(evalAfterWhitePov, 0)} (White's perspective)`);
      const mover = side === "w" ? "White" : "Black";
      const movePtsChange = side === "w"
        ? (evalAfterWhitePov - evalBeforeWhitePov) / 100
        : (evalBeforeWhitePov - evalAfterWhitePov) / 100;
      blockLines.push(`→ ${mover}'s position changed by ${movePtsChange.toFixed(2)} pawns`);
      blockLines.push(`→ Classification: ${qualityLabelRu(quality)}`);
      blockLines.push("");
      blockLines.push(`Best moves that were available for ${mover} in the BEFORE position:`);
      reportBefore.lines.forEach((l, i) => {
        const san = uciLineToSan(fenBefore, l.moves);
        blockLines.push(`  ${i + 1}. [eval ${formatEval(l.cp, l.mate)}] ${san}`);
      });
      blockLines.push("═══ END ENGINE REPORT ═══");
      const engineBlock = blockLines.join("\n");

      const prompt = `${engineBlock}

Comment briefly on ${mover}'s move ${lastSan}.
${quality === "blunder" || quality === "mistake"
    ? `This was a ${qualityLabelRu(quality)}. State what was better (cite engine's best move) and why ${lastSan} was bad.`
    : quality === "great"
    ? `This was an excellent move. Explain the concrete idea: tactic, material gain, positional win.`
    : `Comment briefly in opening-theory context.`}`;

      try {
        const res = await fetch(`${BACKEND}/api/coach/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: SYSTEM_LIVE,
            messages: [{ role: "user", content: prompt }],
            maxTokens: 400,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const comment = data.content?.filter((c: any) => c.type === "text" || c.text)
          .map((c: any) => c.text || "").join("") || "";
        if (comment) {
          sLiveComments((prev) => [...prev, { move: moveNum, san: lastSan, comment, quality }]);
        }
      } catch {
        // silent
      }
    })();
  }, [moves.length, liveMode, visible, fen, fenHist, quickEval, runEngine, computeMoveDelta, analyzePosition]);

  const quickActions = [
    { label: "📊 Анализ", prompt: "Проанализируй позицию с опорой на engine report. Кто лучше стоит и почему? Ключевые факторы?" },
    { label: "💡 Лучший ход", prompt: "Какой лучший ход согласно engine? Объясни идею и что он даёт." },
    { label: "🤍 План белых", prompt: "Подробно распиши стратегический план ЗА БЕЛЫХ в этой позиции. Какие у них сильные стороны, слабости соперника которые можно использовать, конкретные идеи: пешечная атака, типовые маневры фигур (какой конь куда, слон на какой диагонали), какие поля контролировать, на какой фланг играть, тактические возможности. Укажи 3-5 ближайших конкретных ходов из engine lines с объяснением плана за каждым." },
    { label: "🖤 План чёрных", prompt: "Подробно распиши стратегический план ЗА ЧЁРНЫХ в этой позиции. Их сильные стороны, слабости белых для атаки, конкретные идеи: контригра, перегруппировка фигур (куда какой конь/слон), какие поля важны, где искать шансы — на королевском фланге, в центре или на ферзевом, тактические возможности. Укажи 3-5 ближайших ходов из engine lines с объяснением плана за каждым." },
    { label: "⚖️ Планы обеих сторон", prompt: "Разбей позицию на два блока: сначала **План белых** (их сильные стороны, конкретные идеи на ближайшие 5-7 ходов, тактика, стратегия), потом **План чёрных** (то же самое). В каждом блоке: (1) сильные стороны, (2) слабости соперника, (3) конкретные маневры фигур, (4) куда играть (фланг), (5) тактические ресурсы. Используй ходы из engine lines." },
    { label: "⚠️ Мои ошибки", prompt: "Пройдись по ходам партии и укажи серьёзные ошибки. Покажи что было лучше в каждом случае." },
    { label: "📚 Дебют", prompt: "Расскажи про текущий дебют: идеи, планы обеих сторон, типичные ошибки." },
    { label: "🎯 План действий", prompt: "Предложи конкретный план на 5-7 ходов с опорой на engine lines." },
    { label: "🏰 Эндшпиль", prompt: "Принципы эндшпиля для текущей позиции. Если ещё не эндшпиль — на что ориентироваться." },
    { label: "🏁 Разбор партии", prompt: "Краткий обзор партии: 3 ключевых момента с оценкой, основные ошибки, что проработать." },
  ];

  if (!visible) return null;

  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
      overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 620,
    }}>
      <div style={{
        padding: "10px 14px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>♟</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900 }}>AI Тренер v35</div>
            <div style={{ fontSize: 9, opacity: 0.8 }}>Sonnet 4.6 + Stockfish 18</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => {
            sLiveMode(!liveMode);
            if (!liveMode) { lastCommentedMoveIdx.current = moves.length; sLiveComments([]); }
          }}
            style={{
              background: liveMode ? "#fbbf24" : "rgba(255,255,255,0.2)", border: "none",
              color: liveMode ? "#111" : "#fff", borderRadius: 6, padding: "4px 10px",
              fontSize: 10, fontWeight: 800, cursor: "pointer",
            }}>
            {liveMode ? "🔴 LIVE" : "▶ Live"}
          </button>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>✕</button>
        </div>
      </div>

      {liveMode && (
        <div style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ padding: "6px 12px", background: "#fffbeb", fontSize: 10, fontWeight: 700, color: "#92400e" }}>
            🔴 Live — комментирую только ключевые моменты (зевки, ошибки, отличные ходы, дебют)
          </div>
          <div ref={liveRef} style={{ maxHeight: 200, overflowY: "auto", padding: "6px 12px" }}>
            {liveComments.length === 0 && (
              <div style={{ fontSize: 10, color: "#9ca3af", padding: "8px 0", textAlign: "center" }}>
                Играй дальше — скажу когда случится что-то важное
              </div>
            )}
            {liveComments.map((c, i) => {
              const qColor =
                c.quality === "blunder" ? "#dc2626"
                : c.quality === "mistake" ? "#ea580c"
                : c.quality === "great" ? "#059669"
                : "#374151";
              const qIcon =
                c.quality === "blunder" ? "❌"
                : c.quality === "mistake" ? "⚠️"
                : c.quality === "great" ? "⭐"
                : "▸";
              return (
                <div key={i} style={{ marginBottom: 8, fontSize: 11, lineHeight: 1.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{qIcon}</span>
                    <span style={{ fontWeight: 800, color: qColor, fontFamily: "monospace" }}>
                      {c.move}. {c.san}
                    </span>
                  </div>
                  <div style={{ color: "#374151", marginLeft: 18, marginTop: 2 }}>{c.comment}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!liveMode && msgs.length === 0 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => send(a.prompt)} style={{
                padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb",
                background: "#f9fafb", fontSize: 10, fontWeight: 600, color: "#374151", cursor: "pointer",
              }}>{a.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 6 }}>
            Каждый запрос запускает Stockfish (depth 22, 3 линии) перед ответом — 3-7 секунд.
          </div>
        </div>
      )}

      {!liveMode && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 12px", minHeight: 80, maxHeight: 300 }}>
          {msgs.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#9ca3af", fontSize: 11 }}>
              Выбери действие выше или задай свой вопрос
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{
              marginBottom: 8, display: "flex", flexDirection: "column",
              alignItems: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                padding: "8px 12px", borderRadius: 10, maxWidth: "90%", fontSize: 12, lineHeight: 1.5,
                background: m.role === "user" ? "#059669" : "#f3f4f6",
                color: m.role === "user" ? "#fff" : "#111827",
                borderBottomRightRadius: m.role === "user" ? 2 : 10,
                borderBottomLeftRadius: m.role === "assistant" ? 2 : 10,
                whiteSpace: "pre-wrap",
              }}>{m.content}</div>
            </div>
          ))}
          {engineThinking && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#7c3aed", fontSize: 11, fontWeight: 700 }}>
              <span style={{ animation: "pulse 1s infinite" }}>⚡</span> Stockfish считает (depth 22, 3 линии)...
            </div>
          )}
          {loading && !engineThinking && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 11, fontWeight: 700 }}>
              <span style={{ animation: "pulse 1s infinite" }}>●</span> Sonnet анализирует...
            </div>
          )}
          {error && (
            <div style={{ padding: "6px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 10, marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {!liveMode && (
        <div style={{ padding: "8px 12px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 6 }}>
          <input
            value={input}
            onChange={(e) => sInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) send(); }}
            placeholder="Задай вопрос о позиции..."
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, outline: "none" }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: loading ? "#9ca3af" : "#059669", color: "#fff",
              fontSize: 12, fontWeight: 800, cursor: loading ? "default" : "pointer",
            }}>→</button>
        </div>
      )}
    </div>
  );
}
