// Position Whisperer — голосовой объяснитель позиции.
// Принимает FEN + опц. eval (centipawns/mate) → возвращает короткую фразу
// для TTS на ru-RU. Использует heuristics: материал, безопасность короля,
// активность фигур, пешечные слабости, дебют/мидл/эндшпиль.

import { Chess, type PieceSymbol } from "chess.js";

const PV: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

type Insight = { text: string; weight: number };

function materialBalance(ch: Chess): { white: number; black: number; diff: number } {
  let w = 0, b = 0;
  for (const row of ch.board()) for (const p of row) {
    if (!p || p.type === "k") continue;
    if (p.color === "w") w += PV[p.type]; else b += PV[p.type];
  }
  return { white: w, black: b, diff: w - b };
}

function pieceCount(ch: Chess): { total: number; pieces: number; pawns: number } {
  let total = 0, pieces = 0, pawns = 0;
  for (const row of ch.board()) for (const p of row) {
    if (!p) continue;
    total++;
    if (p.type === "p") pawns++;
    else if (p.type !== "k") pieces++;
  }
  return { total, pieces, pawns };
}

function gamePhase(ch: Chess): "Opening" | "Middlegame" | "Endgame" {
  const{ pieces } = pieceCount(ch);
  const moves = ch.history().length;
  if (moves < 14 && pieces >= 12) return "Opening";
  if (pieces <= 6) return "Endgame";
  return "Middlegame";
}

function kingSafety(ch: Chess, color: "w" | "b"): "safe" | "exposed" | "danger" {
  const board = ch.board();
  let kSq = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (p?.type === "k" && p.color === color) {
      kSq = `${"abcdefgh"[c]}${8 - r}`;
    }
  }
  if (!kSq) return "safe";
  // Has the king castled? Look at file (g1, c1, g8, c8 typical)
  const file = kSq[0];
  const isCastled = file === "g" || file === "c" || file === "b";
  // Check attackers on adjacent squares
  let attackers = 0;
  // Toggle turn to count attacks on king's color
  try {
    const fenParts = ch.fen().split(" ");
    fenParts[1] = color === "w" ? "b" : "w";
    const probe = new Chess(fenParts.join(" "));
    const moves = probe.moves({ verbose: true });
    for (const m of moves) {
      const dx = Math.abs(m.to.charCodeAt(0) - kSq.charCodeAt(0));
      const dy = Math.abs(parseInt(m.to[1]) - parseInt(kSq[1]));
      if (dx <= 1 && dy <= 1) attackers++;
    }
  } catch {}
  if (attackers >= 4) return "danger";
  if (!isCastled && ch.history().length >= 14) return "exposed";
  if (attackers >= 2) return "exposed";
  return "safe";
}

function pawnStructure(ch: Chess, color: "w" | "b"): { doubled: number; isolated: number; passed: number } {
  const board = ch.board();
  const myPawns: { f: number; r: number }[] = [];
  const oppPawns: { f: number; r: number }[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p || p.type !== "p") continue;
    if (p.color === color) myPawns.push({ f: c, r });
    else oppPawns.push({ f: c, r });
  }
  let doubled = 0;
  const filesByPawn = new Map<number, number>();
  for (const p of myPawns) filesByPawn.set(p.f, (filesByPawn.get(p.f) || 0) + 1);
  for (const [, n] of filesByPawn) if (n > 1) doubled += n - 1;
  let isolated = 0;
  for (const p of myPawns) {
    const has = filesByPawn.has(p.f - 1) || filesByPawn.has(p.f + 1);
    if (!has) isolated++;
  }
  let passed = 0;
  for (const p of myPawns) {
    let blocked = false;
    for (const o of oppPawns) {
      if (Math.abs(o.f - p.f) > 1) continue;
      const aheadForWhite = color === "w" ? o.r < p.r : o.r > p.r;
      if (aheadForWhite) { blocked = true; break }
    }
    if (!blocked) passed++;
  }
  return { doubled, isolated, passed };
}

function centerControl(ch: Chess): { white: number; black: number } {
  // Count pieces attacking d4, d5, e4, e5
  const center = ["d4", "d5", "e4", "e5"];
  let w = 0, b = 0;
  // Hack: probe by toggling color
  for (const turn of ["w", "b"] as const) {
    try {
      const parts = ch.fen().split(" "); parts[1] = turn;
      const probe = new Chess(parts.join(" "));
      const mvs = probe.moves({ verbose: true });
      for (const m of mvs) if (center.includes(m.to)) {
        if (turn === "w") w++; else b++;
      }
    } catch {}
  }
  return { white: w, black: b };
}

// Returns a short ru-RU description (1-3 short sentences) of the position.
// evalCp: positive = white better; mate: positive = white mates.
export function whisperPosition(fen: string, evalCp = 0, mate = 0): string {
  let ch: Chess;
  try { ch = new Chess(fen) } catch { return "Не могу разобрать позицию." }
  const phase = gamePhase(ch);
  const mat = materialBalance(ch);
  const turn = ch.turn();
  const insights: Insight[] = [];

  // Eval-based opening
  if (mate !== 0) {
    insights.push({ text: `Мат через ${Math.abs(mate)} ход${Math.abs(mate) === 1 ? "" : "ов"} в пользу ${mate > 0 ? "белых" : "чёрных"}.`, weight: 100 });
  } else if (Math.abs(evalCp) >= 300) {
    insights.push({ text: `Позиция выиграна для ${evalCp > 0 ? "белых" : "чёрных"} — преимущество ${(Math.abs(evalCp) / 100).toFixed(1)} пешки.`, weight: 90 });
  } else if (Math.abs(evalCp) >= 100) {
    insights.push({ text: `${evalCp > 0 ? "Белые" : "Чёрные"} стоят чуть лучше.`, weight: 60 });
  } else if (evalCp !== 0) {
    insights.push({ text: `Позиция примерно равна.`, weight: 30 });
  }

  // Material
  if (Math.abs(mat.diff) >= 3) {
    const side = mat.diff > 0 ? "белых" : "чёрных";
    insights.push({ text: `У ${side} лишний материал — около ${Math.abs(mat.diff)} пешек.`, weight: 70 });
  }

  // Phase context
  if (phase === "Endgame") {
    insights.push({ text: "Эндшпиль — каждая пешка на счету.", weight: 25 });
  }

  // King safety
  const wKing = kingSafety(ch, "w");
  const bKing = kingSafety(ch, "b");
  if (wKing === "danger") insights.push({ text: "Король белых в опасности.", weight: 80 });
  else if (bKing === "danger") insights.push({ text: "Король чёрных в опасности.", weight: 80 });
  else if (wKing === "exposed" && phase !== "Endgame") insights.push({ text: "Король белых не в безопасности.", weight: 50 });
  else if (bKing === "exposed" && phase !== "Endgame") insights.push({ text: "Король чёрных не в безопасности.", weight: 50 });

  // Pawn structure
  for (const c of ["w", "b"] as const) {
    const ps = pawnStructure(ch, c);
    const sideName = c === "w" ? "белых" : "чёрных";
    if (ps.passed >= 2) insights.push({ text: `У ${sideName} проходные пешки.`, weight: 55 });
    else if (ps.passed === 1) insights.push({ text: `У ${sideName} есть проходная пешка.`, weight: 40 });
    if (ps.doubled >= 2) insights.push({ text: `Сдвоенные пешки у ${sideName} — слабость.`, weight: 35 });
    if (ps.isolated >= 2) insights.push({ text: `Изолированные пешки у ${sideName}.`, weight: 30 });
  }

  // Center control
  if (phase !== "Endgame") {
    const cc = centerControl(ch);
    if (cc.white - cc.black >= 4) insights.push({ text: "Белые контролируют центр.", weight: 35 });
    else if (cc.black - cc.white >= 4) insights.push({ text: "Чёрные контролируют центр.", weight: 35 });
  }

  // Check status
  if (ch.isCheck()) {
    insights.push({ text: `${turn === "w" ? "Белый" : "Чёрный"} король под шахом.`, weight: 75 });
  }
  if (ch.isCheckmate()) {
    return `Мат. ${turn === "w" ? "Чёрные" : "Белые"} победили.`;
  }
  if (ch.isStalemate()) return "Пат — ничья.";

  // Whose move
  const myTurn = `Ход ${turn === "w" ? "белых" : "чёрных"}.`;

  // Pick top 2 insights by weight + always-include turn
  insights.sort((a, b) => b.weight - a.weight);
  const top = insights.slice(0, 2).map(i => i.text);
  if (top.length === 0) return myTurn + " Стандартная позиция, без видимых слабостей.";
  return [myTurn, ...top].join(" ");
}

// Speak a string via Web Speech API — ru-RU, returns a Promise resolving when done.
export function speak(text: string, opts: { rate?: number; volume?: number; pitch?: number } = {}): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === "undefined" || !window.speechSynthesis) { resolve(); return }
    try {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "ru-RU";
      utt.rate = opts.rate ?? 1.05;
      utt.volume = opts.volume ?? 0.85;
      utt.pitch = opts.pitch ?? 1.0;
      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    } catch { resolve() }
  });
}

// Convenience: analyze + speak in one call
export async function whisperAndSpeak(fen: string, evalCp = 0, mate = 0): Promise<string> {
  const text = whisperPosition(fen, evalCp, mate);
  await speak(text);
  return text;
}
