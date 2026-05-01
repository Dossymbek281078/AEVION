// Ghost Mode — играй против "призрака" гроссмейстера.
// База знаменитых партий → если позиция совпадает (по placement+color),
// бот делает ИХ ход. Иначе fallback: AI level + стилевой weighting
// (Tal жертвует, Petrosian защищается, Magnus жмёт эндшпиль).

import { Chess, type Square, type Move } from "chess.js";

export type GhostId = "magnus" | "hikaru" | "tal" | "fischer" | "kasparov" | "petrosian";

export type Ghost = {
  id: GhostId;
  name: string;
  flag: string;
  era: string;
  rating: number;
  aiLevel: number;
  // Style preference for tiebreaker scoring
  style: {
    aggression: number;     // -1..1: prefer captures, attacks
    sacrifice: number;      // 0..1: tendency to give material
    positional: number;     // 0..1: prefer center+development over tactics
    endgameAffinity: number;// 0..1: in endgame, plays more carefully
  };
  motto: string;
  signatureGames: string;  // Description for UI
};

export const GHOSTS: Ghost[] = [
  {
    id: "magnus", name: "Magnus Carlsen", flag: "🇳🇴", era: "2010-н.в.", rating: 2847,
    aiLevel: 5, motto: "Я никогда не сдаюсь — я выжимаю каждую позицию.",
    signatureGames: "Universal — давит соперника в любой стадии",
    style: { aggression: 0.3, sacrifice: 0.1, positional: 0.9, endgameAffinity: 1.0 },
  },
  {
    id: "hikaru", name: "Hikaru Nakamura", flag: "🇺🇸", era: "2010-н.в.", rating: 2795,
    aiLevel: 5, motto: "Bullet — это шахматы. Атака — это жизнь.",
    signatureGames: "Tactical machine — ловушки и инициатива",
    style: { aggression: 0.7, sacrifice: 0.4, positional: 0.4, endgameAffinity: 0.6 },
  },
  {
    id: "tal", name: "Mikhail Tal", flag: "🇷🇺", era: "1957-1992", rating: 2705,
    aiLevel: 4, motto: "Жертвую — потому что не люблю считать.",
    signatureGames: "Магия комбинаций — жертвы фигур ради атаки",
    style: { aggression: 0.95, sacrifice: 0.95, positional: 0.1, endgameAffinity: 0.3 },
  },
  {
    id: "fischer", name: "Bobby Fischer", flag: "🇺🇸", era: "1958-1972", rating: 2785,
    aiLevel: 5, motto: "Шахматы — война на доске.",
    signatureGames: "Кинжальная точность — без слабостей",
    style: { aggression: 0.5, sacrifice: 0.2, positional: 0.7, endgameAffinity: 0.85 },
  },
  {
    id: "kasparov", name: "Garry Kasparov", flag: "🇷🇺", era: "1985-2005", rating: 2851,
    aiLevel: 5, motto: "Атака — лучшая защита.",
    signatureGames: "Динамика и инициатива — партии-лекции",
    style: { aggression: 0.85, sacrifice: 0.5, positional: 0.5, endgameAffinity: 0.7 },
  },
  {
    id: "petrosian", name: "Tigran Petrosian", flag: "🇦🇲", era: "1956-1984", rating: 2645,
    aiLevel: 4, motto: "Я не жертвую. Я предотвращаю.",
    signatureGames: "Профилактика — невозможно атаковать его позицию",
    style: { aggression: -0.3, sacrifice: 0.05, positional: 0.95, endgameAffinity: 0.95 },
  },
];

// Mini opening book per ghost — first 5 plies of their famous-game preferences.
// Keyed by FEN-placement (positions+side); value is preferred SAN move.
// Compact — only most-known opening lines per ghost.
const GHOST_BOOK: Record<GhostId, { fen: string; san: string }[]> = {
  magnus: [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", san: "d4" },
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b", san: "Nf6" },
    // Catalan-style
    { fen: "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w", san: "c4" },
    { fen: "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w", san: "g3" },
  ],
  hikaru: [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", san: "e4" },
    // Sicilian Najdorf
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b", san: "c5" },
    { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w", san: "Nf3" },
    { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b", san: "d6" },
  ],
  tal: [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", san: "e4" },
    // King's Gambit lover
    { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w", san: "f4" },
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b", san: "e5" },
  ],
  fischer: [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", san: "e4" },
    // Sozin
    { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b", san: "Nc6" },
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b", san: "c5" },
  ],
  kasparov: [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", san: "d4" },
    // King's Indian as black
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b", san: "Nf6" },
    { fen: "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w", san: "c4" },
    { fen: "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w", san: "Nc3" },
  ],
  petrosian: [
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", san: "Nf3" },
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b", san: "e6" },
    // French / Caro-Kann lover
    { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b", san: "e6" },
  ],
};

// Returns the FEN placement+side key (for matching in book).
function fenKey(ch: Chess): string {
  const parts = ch.fen().split(" ");
  return `${parts[0]} ${parts[1]}`;
}

// Look up a book move for ghost in current position. Returns SAN or null.
export function ghostBookMove(g: Ghost, ch: Chess): string | null {
  const key = fenKey(ch);
  const book = GHOST_BOOK[g.id] || [];
  const hit = book.find(b => b.fen === key);
  return hit ? hit.san : null;
}

const PV: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Style-weighted move scoring. Given a list of legal moves, picks one matching
// the ghost's stylistic preferences. The supplied `engineMove` (from minimax/SF)
// is the rational baseline — we score nearby moves to find a stylistic fit.
// Returns a Move from the list.
export function pickGhostStyleMove(g: Ghost, ch: Chess, candidates: Move[]): Move {
  if (!candidates.length) throw new Error("no candidates");
  if (candidates.length === 1) return candidates[0];
  const isEndgame = ch.board().flat().filter(p => p && p.type !== "k" && p.type !== "p").length <= 6;
  const scored = candidates.map(m => {
    let s = 0;
    // Capture bonus (aggression)
    if (m.captured) {
      const v = PV[m.captured] || 0;
      s += v * (g.style.aggression + 0.3);
    }
    // Sacrifice: moving high-value piece to attacked square
    const myVal = PV[m.piece] || 0;
    if (m.captured) {
      const theirVal = PV[m.captured] || 0;
      if (myVal > theirVal && g.style.sacrifice > 0.3) s += g.style.sacrifice * 4;
    }
    // Positional: development moves (knight, bishop) early get bonus
    if (ch.history().length < 12 && (m.piece === "n" || m.piece === "b")) {
      s += g.style.positional * 1.5;
    }
    // Castling: positional ghosts love it
    if (m.flags.includes("k") || m.flags.includes("q")) s += g.style.positional * 3;
    // Endgame affinity
    if (isEndgame && (m.piece === "k" || m.piece === "p")) {
      s += g.style.endgameAffinity * 2;
    }
    // Tal-style: queen sacrifice or pawn break with check
    if (m.san.includes("+") && g.style.aggression > 0.5) s += g.style.aggression * 1.5;
    // Petrosian: prefer non-capture defensive moves
    if (g.style.aggression < 0 && !m.captured) s += Math.abs(g.style.aggression);
    // Random small noise so two equal-scored moves don't always pick the first
    s += (Math.random() - 0.5) * 0.4;
    return { move: m, score: s };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].move;
}
