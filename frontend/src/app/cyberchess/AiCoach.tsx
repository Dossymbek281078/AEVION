"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
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
  phaseLabel?: string;       // "Дебют" / "Миттельшпиль" / "Эндшпиль" — если знаем стадию
  coachLevel?: "beginner" | "intermediate" | "advanced"; // уровень ученика — калибрует глубину объяснений
  weaknesses?: string;       // компактная сводка повторяющихся слабостей из истории партий (Game DNA)
  structure?: string;        // распознанная пешечная структура миттельшпиля ("имя — суть")
};

/* ── Level-differentiated system prompts ──────────────────────────────────
   Previously coachLevel only added one sentence to the user-turn context,
   while THIS system prompt (sent on every request regardless of level) was
   uniformly GM-register and explicitly forbade the one style of talk
   ("develop your pieces") that an actual beginner needs — the beginner
   instruction was fighting the system prompt it rode alongside, and Live
   mode received no level signal at all. The truth/accuracy rules (never
   contradict the engine, cite only Best Lines, explicit color) are shared
   across all three tiers — that's correctness, not pedagogy, and must not
   soften. What genuinely changes per tier: vocabulary, how many plies deep
   a line goes, how much is explained vs assumed, and tone. */

const SHARED_TRUTH_RULES = `═══ ИСТОЧНИК ИСТИНЫ: ОТЧЁТ ДВИЖКА ═══
В начале сообщения ученика ты получаешь отчёт Stockfish. Это твоя единственная опора. Никогда не противоречь ему. Никогда не придумывай варианты, которых в нём нет. Все числовые оценки в твоём ответе должны совпадать с блоком.

═══ ТОЧНОСТЬ (критично) ═══
1. Прежде чем сказать "фигура висит", проверь по FEN: чья она, на каком поле, кто может съесть. Не уверен — не называй конкретную фигуру, скажи "позиция острая" или "материальный перевес на стороне X".
2. Всегда явно указывай цвет: "белые играют 14.Кf3", "у чёрных 14...Кd3", никаких "кто-то куда-то пошёл".
3. Оценка отчёта — с точки зрения белых. +2.40 = белые лучше, -2.40 = чёрные лучше. Не путай направление.
4. "Зевок белых" значит что позиция БЕЛЫХ ухудшилась. Не перекрути.
5. Ходы приводи только из блока Best Lines — они гарантированно легальны.`;

const SHARED_CANT = `═══ НЕЛЬЗЯ ═══
- Придумывать варианты, которых нет в отчёте.
- Называть фигуру "висящей" без проверки владельца.
- Противоречить оценке или лучшей линии движка.
- Размытая похвала. Размытая критика. "Интересно", "неплохо", "любопытно" — в топку.`;

const DEEP_TIER: Record<"beginner" | "intermediate" | "advanced", string> = {
  beginner: `═══ УРОВЕНЬ: НОВИЧОК ═══
Твой ученик только начинает — знает как ходят фигуры, но ещё не видит простые тактики с одного взгляда. Твоя думающая сила остаётся супергроссмейстерской (ты всегда видишь правильный ответ через отчёт движка), но ОБЪЯСНЯЕШЬ как терпеливый тренер начинающему, а не как гроссмейстер гроссмейстеру:
- Простые слова прежде терминов. Используешь термин (вилка, связка, форпост, цугцванг) — в той же фразе поясни его смысл, не жди что ученик его знает.
- Один главный пункт за раз. Не вываливай 3-5-полуходовый вариант — покажи 1-2 хода вперёд и объясни почему, этого достаточно.
- "Развивай фигуры", "не выводи ферзя рано", "думай про безопасность короля" — это НЕ запрещённые фразы для новичка, это ровно то, что ему сейчас нужно услышать. Базовые принципы — признак хорошего тренера именно на этом уровне, не слабости.
- Хвали конкретно: "ты правильно увидел, что слон под ударом" полезнее, чем просто "хорошо".
- Если ход плохой — одна главная причина и один лучший ход, без разворачивания вглубь — глубже начнёт запутывать, а не помогать.
- 2-3 коротких абзаца.

═══ ЕСЛИ СПРАШИВАЕТ ПЛАН/СТРАТЕГИЮ ═══
Одна ясная идея за раз ("сейчас цель — вывести коня и слона и спрятать короля рокировкой"), не таблица с 4 подпунктами.`,

  intermediate: `═══ УРОВЕНЬ: СРЕДНИЙ КЛУБНЫЙ ИГРОК ═══
Ученик знает базовые принципы и типовые тактики, но ещё не считает вглубь и не всегда помнит названия приёмов.
- Называй приёмы и структуры по именам (вилка, связка, форпост, изолированная пешка), но кратко поясняй суть при первом упоминании в разговоре.
- Варианты на 2-3 полухода вперёд — глубже ученик не удержит в голове без доски.
- Конкретика вместо воды: "+0.4, потому что у белых лучшее развитие и открытая линия e" — нормально. "Позиция чуть лучше" — нет.
- Если ход плохой — скажи прямо, приведи лучший ход из Best Lines, без разворачивания на несколько абзацев.
- 2-3 абзаца.

═══ ЕСЛИ СПРАШИВАЕТ ПЛАН/СТРАТЕГИЮ ═══
Сильные стороны / слабости соперника / куда играть (фланг или центр) / один конкретный манёвр с маршрутом фигуры. Без лишней детализации тактики за пределами 2-3 ходов.`,

  advanced: `═══ УРОВЕНЬ: ПРОДВИНУТЫЙ / КАНДИДАТ В МАСТЕРА ═══
Думаешь и оцениваешь позицию на уровне супергроссмейстера (2800+ Эло), сверяясь с движком. Разговариваешь как тренер, который сам понимает глубину — без разжёвывания базовых принципов.
- Глубина максимальная: конкретные варианты на 3-5 полуходов вперёд, типовые приёмы и стратегические мотивы по именам без пояснений (карлсбадская структура, висячие пешки, принцип двух слабостей, цугцванг, перевод коня на форпост) — ученик их уже знает.
- Никогда не упрощай до уровня "развивай фигуры" — это уровень новичка, ученик выше него.
- Если ход плохой — приведи лучший ход и объясни глубинную причину (не "теряет пешку", а "теряет пешку, потому что после размена ладей эндшпиль с изолятором технически проигран").
- 2-4 абзаца, разрешена полная плотность.

═══ СТРАТЕГИЧЕСКИЕ ПЛАНЫ ═══
Если ученик спрашивает план / идею / стратегию за какую-то сторону:
1. Начни с имени стороны жирным: **План белых:**
2. Структура: **Сильные стороны** / **Слабости соперника** / **Конкретные маневры** ("Кb1 → d2 → f1 → g3 чтобы подключить к атаке на королевский фланг" — с маршрутом) / **Куда играть** / **Тактика** с конкретными ходами из вариантов движка.
3. Якорь план в реальные варианты из Best Lines.`,
};

function systemDeepFor(level?: "beginner" | "intermediate" | "advanced"): string {
  const tier = DEEP_TIER[level || "intermediate"];
  return `Ты — Алексей, шахматный тренер внутри CyberChess by AEVION.

${tier}

${SHARED_TRUTH_RULES}

═══ ЯЗЫК ═══
Русский по умолчанию (английский/казахский — если ученик пишет на них). Алгебраика: e4, Кf3, Фxf7+, О-О. Говори как тренер за столом, не как учебник — но без панибратства и без смайликов в каждой строке. Называй дебют по ECO когда знаешь. Без дисклеймеров, без "надеюсь, это поможет".

${SHARED_CANT}`;
}

const LIVE_TIER: Record<"beginner" | "intermediate" | "advanced", string> = {
  beginner: `═══ УРОВЕНЬ: НОВИЧОК ═══
1-2 простых предложения. Термин без объяснения не используй — сказал "вилка", тут же поясни "конь бьёт две фигуры сразу". Зевок/ошибка — назови что случилось простыми словами и один лучший ход, без варианта вглубь. Отличный ход — конкретно похвали за что именно (выиграл фигуру / поставил мат в 2 / защитил короля).`,
  intermediate: `═══ УРОВЕНЬ: СРЕДНИЙ ═══
1-3 коротких предложения. Термины можно, без долгих пояснений. Зевок/ошибка — просадка оценки + лучший ход из отчёта. Отличный ход — что конкретно он даёт.`,
  advanced: `═══ УРОВЕНЬ: ПРОДВИНУТЫЙ ═══
1-3 коротких предложения, максимальная плотность мысли — как топ-игрок топ-игроку, не разжёвывая. Термины и мотивы по именам без пояснений. Зевок/ошибка — просадка + лучший ход + глубинная причина одной фразой.`,
};

function systemLiveFor(level?: "beginner" | "intermediate" | "advanced"): string {
  const tier = LIVE_TIER[level || "intermediate"];
  return `Ты — Алексей, живой тренер CyberChess. Комментируешь ход коротко, по делу, как если бы подсказывал вживую над плечом.

${tier}

═══ ИСТОЧНИК ИСТИНЫ ═══
В сообщении ученика есть отчёт Stockfish. Твои числа должны совпадать с ним. Фигуры — из FEN. Варианты не выдумывай.

═══ ТОЧНОСТЬ ═══
- Оценка — с точки зрения белых: +X = белые лучше, -X = чёрные лучше.
- Прежде чем сказать что фигура висит, проверь цвет по FEN.
- Лучший ход называй только из блока Best Lines.
- Цвет играющего — явно: "14.Сg5 белых" или "14...Фxf2+ чёрных", не просто "14.Сg5".`;
}

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://api.aevion.app");

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
  runEngine, quickEval, phaseLabel, coachLevel, weaknesses, structure,
}: Props) {
  const [msgs, sMsgs] = useState<Msg[]>([]);
  const [input, sInput] = useState("");
  const [loading, sLoading] = useState(false);
  const [error, sError] = useState("");
  const [engineThinking, sEngineThinking] = useState(false);

  const [liveMode, sLiveMode] = useState(false); // OFF по умолчанию — каждый ход = API call, шум во время игры
  const [liveComments, sLiveComments] = useState<
    { move: number; san: string; comment: string; quality?: string }[]
  >([]);
  const lastCommentedMoveIdx = useRef(0);
  const prevEvalCache = useRef<Map<string, number>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // TTS — browser SpeechSynthesis. Auto-reads the latest coach reply when enabled.
  const TTS_KEY = "aevion_coach_tts_v1";
  const TTS_VOICE_KEY = "aevion_coach_tts_voice_v1";
  const [ttsOn, sTtsOn] = useState<boolean>(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(TTS_KEY) === "1"; } catch { return false; }
  });
  const [ttsSpeaking, sTtsSpeaking] = useState(false);
  const [voices, sVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, sVoiceName] = useState<string>(() => {
    try { return typeof window !== "undefined" ? localStorage.getItem(TTS_VOICE_KEY) || "" : ""; } catch { return ""; }
  });
  useEffect(() => { try { localStorage.setItem(TTS_KEY, ttsOn ? "1" : "0"); } catch {} }, [ttsOn]);
  useEffect(() => { try { localStorage.setItem(TTS_VOICE_KEY, voiceName); } catch {} }, [voiceName]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      sVoices(v);
      if (!voiceName) {
        const ru = v.find(x => x.lang.toLowerCase().startsWith("ru"));
        if (ru) sVoiceName(ru.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    // Strip markdown emphasis and engine labels that sound weird spoken.
    const clean = text.replace(/[*_`]/g, "").replace(/═/g, "").slice(0, 1500);
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "ru-RU";
    utt.rate = 1.05;
    utt.pitch = 1.0;
    if (voiceName) {
      const v = voices.find(x => x.name === voiceName);
      if (v) utt.voice = v;
    }
    utt.onstart = () => sTtsSpeaking(true);
    utt.onend = () => sTtsSpeaking(false);
    utt.onerror = () => sTtsSpeaking(false);
    try { window.speechSynthesis.speak(utt); } catch {}
  }, [voiceName, voices]);
  const stopSpeak = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch {}
    sTtsSpeaking(false);
  }, []);
  // Stop speech when the coach panel closes or the component unmounts.
  // Without the unmount cleanup, Chrome/Safari keep the utterance playing
  // after the Coach disappears.
  useEffect(() => {
    if (!visible) stopSpeak();
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, [visible, stopSpeak]);
  // Auto-speak the latest assistant reply when TTS is on
  const lastSpokenIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (!ttsOn || !visible) return;
    const lastIdx = msgs.length - 1;
    if (lastIdx <= lastSpokenIdxRef.current) return;
    const last = msgs[lastIdx];
    if (!last || last.role !== "assistant") return;
    lastSpokenIdxRef.current = lastIdx;
    speakText(last.content);
  }, [msgs, ttsOn, visible, speakText]);
  // Auto-speak the latest live comment
  const lastSpokenLiveIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (!ttsOn || !visible || !liveMode) return;
    const lastIdx = liveComments.length - 1;
    if (lastIdx <= lastSpokenLiveIdxRef.current) return;
    const last = liveComments[lastIdx];
    if (!last) return;
    lastSpokenLiveIdxRef.current = lastIdx;
    speakText(`${last.san}. ${last.comment}`);
  }, [liveComments, ttsOn, visible, liveMode, speakText]);

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
        // Bound cache growth — strip oldest entries once we pass 500 FENs.
        if (prevEvalCache.current.size > 500) {
          const it = prevEvalCache.current.keys();
          for (let k = 0; k < 100; k++) { const n = it.next(); if (n.done) break; prevEvalCache.current.delete(n.value); }
        }

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
            if (phaseLabel) ctx.push(`Текущая стадия партии: ${phaseLabel}. Формулируй ответ в терминах этой стадии — для дебюта про развитие/центр/рокировку, для миттельшпиля про слабости/планы/инициативу, для эндшпиля про активность короля/проходные/типовые позиции.`);
            if (structure) ctx.push(`Распознанная пешечная структура: ${structure}. Если позиция миттельшпильная — называй структуру по имени и давай типовой план именно для неё (атака базы цепи, блокада изолятора, миноритарная атака, форпост и т.п.), а не общие слова.`);
            // Level register now lives in the system prompt itself (systemDeepFor)
            // — this is just a same-turn reminder, not the primary mechanism.
            if (coachLevel) ctx.push(`Уровень ученика: ${coachLevel === "beginner" ? "новичок" : coachLevel === "advanced" ? "продвинутый/кандидат в мастера" : "средний клубный игрок"}.`);
            if (weaknesses) ctx.push(`Повторяющиеся слабости ученика (из истории его партий): ${weaknesses}. Если текущая позиция иллюстрирует одну из этих слабостей — прямо укажи на связь и дай адресный совет; не притягивай за уши, когда позиция не про это.`);
            ctx.push(`You are coaching ${playerColor === "w" ? "White" : "Black"}.`);
            ctx.push("");
            ctx.push("User question:");
            ctx.push(m.content);
            return { role: "user", content: ctx.join("\n") };
          }
          return m;
        });

        // 30 секунд timeout — если backend не отвечает, не зависаем навсегда.
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 30000);
        let res: Response;
        try {
          res = await fetch(`${BACKEND}/api/coach/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system: systemDeepFor(coachLevel),
              messages: apiMsgs,
              maxTokens: 1200,
            }),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

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
        if (e?.name === "AbortError") {
          sError("ИИ-тренер не ответил за 30 секунд. Сервер может быть перегружен — попробуй ещё раз через минуту, или используй Stockfish-анализ ниже.");
        } else if (/fetch|network|Failed to fetch/i.test(e?.message || "")) {
          sError("Не удалось связаться с ИИ-тренером. Проверь соединение или используй Stockfish-разбор (он работает локально).");
        } else {
          sError(e?.message || "Connection failed");
        }
      } finally {
        sLoading(false);
        sEngineThinking(false);
      }
    },
    [fen, moves, fenHist, opening, playerColor, msgs, input, analyzePosition, computeMoveDelta]
  );

  // Live Coach — only on key moments
  useEffect(() => {
    // Новая партия / откат: история ходов сжалась → сбрасываем курсор комментариев,
    // иначе после длинной партии следующая НЕ комментируется, пока не превысит её длину.
    if (moves.length < lastCommentedMoveIdx.current) lastCommentedMoveIdx.current = moves.length;
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

      const weaknessLine = weaknesses && (quality === "blunder" || quality === "mistake")
        ? `\nПовторяющиеся слабости этого ученика: ${weaknesses}. Если этот промах — проявление одной из них, коротко отметь связь.`
        : "";
      const prompt = `${engineBlock}

Comment briefly on ${mover}'s move ${lastSan}.
${quality === "blunder" || quality === "mistake"
    ? `This was a ${qualityLabelRu(quality)}. State what was better (cite engine's best move) and why ${lastSan} was bad.`
    : quality === "great"
    ? `This was an excellent move. Explain the concrete idea: tactic, material gain, positional win.`
    : `Comment briefly in opening-theory context.`}${weaknessLine}`;

      try {
        const res = await fetch(`${BACKEND}/api/coach/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: systemLiveFor(coachLevel),
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
    { label: "💡 Лучший ход", prompt: "Какой лучший ход по мнению движка? Объясни идею и что он даёт." },
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
          {ttsSpeaking && (
            <button onClick={stopSpeak} title="Остановить озвучку"
              style={{ background: "rgba(255,255,255,0.9)", border: "none", color: "#059669", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
              ❚❚
            </button>
          )}
          <button onClick={() => sTtsOn(v => !v)} title={ttsOn ? "Выкл. озвучку" : "Вкл. озвучку"}
            style={{ background: ttsOn ? "#fbbf24" : "rgba(255,255,255,0.2)", border: "none", color: ttsOn ? "#111" : "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
            {ttsOn ? "🔊 Voice" : "🔈 Voice"}
          </button>
          {ttsOn && voices.length > 0 && (
            <select aria-label="Голос коуча" value={voiceName} onChange={e => sVoiceName(e.target.value)} title="Голос"
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer", maxWidth: 110 }}>
              {voices.filter(v => v.lang.toLowerCase().startsWith("ru") || v.lang.toLowerCase().startsWith("en")).slice(0, 12).map(v => (
                <option key={v.name} value={v.name} style={{ color: "#111" }}>{v.name.slice(0, 18)}</option>
              ))}
            </select>
          )}
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
          <button aria-label="Закрыть" onClick={onClose} style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>✕</button>
        </div>
      </div>

      {liveMode && (
        <div style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ padding: "6px 12px", background: "#fffbeb", fontSize: 10, fontWeight: 700, color: "#92400e" }}>
            🔴 Live — комментирую каждый ход после его совершения
          </div>
          <div ref={liveRef} style={{ maxHeight: 200, overflowY: "auto", padding: "6px 12px" }}>
            {liveComments.length === 0 && (
              <div style={{ fontSize: 10, color: "#9ca3af", padding: "8px 0", textAlign: "center" }}>
                Жду твой ход — прокомментирую сразу после
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
              {m.role === "assistant" && typeof window !== "undefined" && "speechSynthesis" in window && (
                <button onClick={() => (ttsSpeaking ? stopSpeak() : speakText(m.content))}
                  title={ttsSpeaking ? "Остановить" : "Озвучить"}
                  style={{ marginTop: 3, padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 5, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer" }}>
                  {ttsSpeaking ? "❚❚ Стоп" : "🔊 Озвучить"}
                </button>
              )}
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
          <input aria-label="Вопрос коучу"
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
