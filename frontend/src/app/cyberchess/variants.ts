// Chess Variants — нестандартные правила/стартовые позиции.
// Все варианты используют chess.js-совместимые FEN'ы; спец-правила
// (twin kings = «royal queen», diceblade = move filter, reinforcement)
// проверяются в page.tsx как лёгкие хуки поверх стандартного движка.

export type VariantId = "standard" | "fischer960" | "asymmetric" | "twinkings" | "diceblade" | "reinforcement" | "atomic" | "kingofthehill" | "threecheck" | "knightriders" | "pawnapocalypse" | "powerdrop" | "crazyhouse";

export type Variant = {
  id: VariantId;
  name: string;
  emoji: string;
  shortDesc: string;
  longDesc: string;
  // For UI grouping
  tag: "Theory-free" | "Asymmetric" | "Chaos" | "Standard";
  // Display warning if some standard features (e.g. opening book, castling) are altered
  notes?: string[];
};

export const VARIANTS: Variant[] = [
  {
    id: "standard",
    name: "Стандарт",
    emoji: "♟",
    shortDesc: "Классические правила",
    longDesc: "Обычные шахматы — стандартная начальная позиция, FIDE-правила, рокировка, en passant.",
    tag: "Standard",
  },
  {
    id: "fischer960",
    name: "Fischer 960",
    emoji: "🎲",
    shortDesc: "Случайный бэкранк (Chess960)",
    longDesc: "Бэкранк перетасован случайно. Слоны на разных цветах, король между ладьями. 960 вариантов начальной позиции — теории дебютов не существует. Создан Бобби Фишером в 1996.",
    tag: "Theory-free",
    notes: ["Рокировка отключена (упрощение)", "Дебютная теория не работает"],
  },
  {
    id: "asymmetric",
    name: "Asymmetric Armies",
    emoji: "⚔",
    shortDesc: "Разные армии по 39 очков",
    longDesc: "Каждая сторона получает РАЗНЫЕ фигуры с одинаковым материалом (39 очков: Q=9, R=5, B=3, N=3, P=1). Например: белые — 2 ферзя + 4 коня; чёрные — 4 ладьи + 2 слона. Теория исключена полностью.",
    tag: "Asymmetric",
    notes: ["Рокировка отключена", "Король всегда на e-файле"],
  },
  {
    id: "twinkings",
    name: "Twin Kings",
    emoji: "👑",
    shortDesc: "Два короля — мат любого = победа",
    longDesc: "У каждой стороны 2 «короля»: обычный король + королевский ферзь. Мат короля ИЛИ взятие ферзя = поражение. Меняет всю стратегию защиты.",
    tag: "Asymmetric",
    notes: ["Ферзь на d-линии — «второй король»", "Потеря ферзя = поражение"],
  },
  {
    id: "diceblade",
    name: "Diceblade",
    emoji: "🎲",
    shortDesc: "Кубик решает тип фигуры",
    longDesc: "Перед каждым своим ходом катается кубик: 1=пешка, 2=конь, 3=слон, 4=ладья, 5=ферзь, 6=любая. Если фигурой нельзя ходить — пасуешь. Хаотично, но рейтинг фигур переоценивается.",
    tag: "Chaos",
    notes: ["Если все ходы фигурой ведут под мат — pass", "AI тоже подчиняется кубику"],
  },
  {
    id: "reinforcement",
    name: "Reinforcement",
    emoji: "🔄",
    shortDesc: "Возврат фигур каждые 10 ходов",
    longDesc: "Каждые 10 полуходов одна случайная захваченная фигура возвращается на случайное пустое поле своего лагеря. Партия не заканчивается обменом — приходится играть до мата.",
    tag: "Chaos",
    notes: ["Король не возвращается", "Спавн в первых 4 рядах своей стороны"],
  },
  {
    id: "atomic",
    name: "Atomic",
    emoji: "💥",
    shortDesc: "Взятие = взрыв 8 окрестных клеток",
    longDesc: "Каждое взятие — это атомный взрыв: исчезают взявшая фигура + взятая + ВСЕ фигуры в радиусе 1 клетки (кроме пешек, они уцелеют только если они не в эпицентре). Взрыв собственного короля = поражение. Известен как Atomic Chess.",
    tag: "Chaos",
    notes: ["Шах больше не нужен — можно взорвать короля", "Стратегия превращается в минирование"],
  },
  {
    id: "kingofthehill",
    name: "King of the Hill",
    emoji: "⛰",
    shortDesc: "Король в центре = победа",
    longDesc: "Дополнительная цель: если твой король встал на любую центральную клетку (d4, d5, e4, e5) — ты немедленно побеждаешь. Мат тоже работает. Защищать центр становится критично.",
    tag: "Theory-free",
    notes: ["Король рвётся к центру с первых ходов", "Игра ускоряется"],
  },
  {
    id: "threecheck",
    name: "Three-Check",
    emoji: "⚡",
    shortDesc: "3 шаха = победа",
    longDesc: "Если ты объявил сопернику 3 шаха суммарно за партию — ты побеждаешь. Мат тоже считается. Стратегия меняется: жертвуешь материал ради чек-комбинации.",
    tag: "Theory-free",
    notes: ["Счётчик шахов на каждой стороне", "Каждый шах ценный"],
  },
  {
    id: "knightriders",
    name: "Knight Riders",
    emoji: "🐎",
    shortDesc: "Только король + кони + пешки",
    longDesc: "У каждой стороны 6 коней вместо стандартного бэкранка (без слонов, ладей, ферзя). Только король + 6 коней + 8 пешек. Чистая тактика без линейных атак.",
    tag: "Theory-free",
    notes: ["Кони доминируют", "Пешки превращаются только в коней (по факту)"],
  },
  {
    id: "pawnapocalypse",
    name: "Pawn Apocalypse",
    emoji: "💀",
    shortDesc: "Двойной ряд пешек, без минор",
    longDesc: "Только король + ферзь + 2 ладьи + ДВА ряда пешек (горизонтали 2-3 для белых, 6-7 для чёрных). Никаких коней или слонов. Эндшпиль с первого хода — пешечная война.",
    tag: "Theory-free",
    notes: ["Прорывы пешками — вся стратегия", "Превращения часты"],
  },
  {
    id: "powerdrop",
    name: "Power Drop",
    emoji: "⚡",
    shortDesc: "Дроп фигур из пула каждые 5 ходов",
    longDesc: "Каждое взятие пополняет твой пул. Раз в 5 полуходов можешь дропнуть фигуру из пула на пустую клетку (вместо обычного хода). Король не дропается. Пешка не на 1/8. Ресурсный менеджмент Crazyhouse в стратегическом темпе.",
    tag: "Chaos",
    notes: ["Drop каждые 5 ходов", "Захваченные ферзи — самый ценный ресурс"],
  },
  {
    id: "crazyhouse",
    name: "Crazyhouse",
    emoji: "🏚",
    shortDesc: "Любое взятие можно вернуть как дроп",
    longDesc: "Полный Crazyhouse: каждое взятие пополняет пул, и в свой ход можешь либо ходить, либо дропнуть фигуру из пула на ЛЮБУЮ пустую клетку. Превращённая пешка возвращается как пешка. Самый дикий и тактически насыщенный вариант шахмат.",
    tag: "Chaos",
    notes: ["Drop каждый ход", "Жертвовать материал стало бесплатно — потом дропнешь"],
  },
];

// ── Fischer 960 ──────────────────────────────────────────
// Generate random Chess960 backrank that satisfies:
// - 2 bishops on opposite-colored squares
// - king between 2 rooks
// Returns 8-char string of piece symbols.
export function generate960Backrank(seed?: number): string {
  // Deterministic if seed given (1..960)
  // For UX, just random.
  const tries = 100;
  for (let t = 0; t < tries; t++) {
    const slots: (string | null)[] = [null, null, null, null, null, null, null, null];
    // Place light-square bishop (file 1,3,5,7)
    const lightSlots = [1, 3, 5, 7];
    const bL = lightSlots[Math.floor(Math.random() * 4)];
    slots[bL] = "B";
    const darkSlots = [0, 2, 4, 6];
    const bD = darkSlots[Math.floor(Math.random() * 4)];
    slots[bD] = "B";
    // Place queen on any free
    const free1 = slots.map((v, i) => v === null ? i : -1).filter(x => x >= 0);
    const q = free1[Math.floor(Math.random() * free1.length)];
    slots[q] = "Q";
    // Place 2 knights on any 2 free
    const free2 = slots.map((v, i) => v === null ? i : -1).filter(x => x >= 0);
    if (free2.length < 5) continue;
    const idx1 = Math.floor(Math.random() * free2.length);
    const n1 = free2[idx1];
    slots[n1] = "N";
    const free3 = slots.map((v, i) => v === null ? i : -1).filter(x => x >= 0);
    const n2 = free3[Math.floor(Math.random() * free3.length)];
    slots[n2] = "N";
    // Remaining 3 free slots → R K R (king MUST be between rooks)
    const free4 = slots.map((v, i) => v === null ? i : -1).filter(x => x >= 0).sort((a, b) => a - b);
    if (free4.length !== 3) continue;
    slots[free4[0]] = "R";
    slots[free4[1]] = "K";
    slots[free4[2]] = "R";
    return slots.join("");
  }
  // Fallback: standard
  return "RNBQKBNR";
}

// Build full FEN from backrank
export function fischer960Fen(seed?: number): string {
  const backrank = generate960Backrank(seed);
  const blackBack = backrank.toLowerCase();
  // Use "-" castling to keep it simple (no castling in our 960)
  return `${blackBack}/pppppppp/8/8/8/8/PPPPPPPP/${backrank} w - - 0 1`;
}

// ── Asymmetric Armies ────────────────────────────────────
// Generate two armies, each costing exactly 39 points (standard back-rank value).
// King + 8 pawns are fixed. The 7 back-rank slots (excluding king) are filled
// randomly with pieces summing to 39 - 0 (king free) - already-fixed king's slot.
// Standard back-rank value: 8R+8R+3B+3B+3N+3N+9Q = 39 ↔ matches FIDE start.
export type ArmySlot = { piece: "Q" | "R" | "B" | "N"; count: number };

const PIECE_VAL: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3 };

// Random army with piece variety constraints to keep things playable.
export function randomArmy(seed?: number): { piecesByFile: string[]; pieces: ArmySlot[] } {
  // 7 non-king back-rank slots, target sum = 30 (39 - 9 for the queen-equivalent; but standard is 30 actually: 5+5+3+3+3+3+9=31... let's pick 30)
  // Actually standard back rank value WITHOUT the king = 8R+8R+3B+3B+3N+3N+9Q = 39. So 7 slots = 39 points.
  const tries = 200;
  for (let t = 0; t < tries; t++) {
    const slots: string[] = [];
    let remaining = 39;
    let openSlots = 7;
    const pool = ["Q", "R", "R", "B", "B", "N", "N"];
    // Random pick: weighted toward variety
    while (openSlots > 0 && remaining > 0) {
      const candidates = pool.filter(p => PIECE_VAL[p] <= remaining);
      // Ensure remaining slots can fill remaining points: each slot min 3
      const slotsLeft = openSlots;
      const minPossible = (slotsLeft - 1) * 3 + 3; // minimum N or B per slot
      if (remaining < minPossible) {
        // We've over-filled with high-value pieces; restart
        slots.length = 0; remaining = 39; openSlots = 7;
        continue;
      }
      // Filter candidates to those that don't make remaining un-fillable
      const filtered = candidates.filter(p => {
        const newRem = remaining - PIECE_VAL[p];
        const newSlots = openSlots - 1;
        if (newSlots === 0) return newRem === 0;
        // Each remaining slot needs ≥3, ≤9
        return newRem >= newSlots * 3 && newRem <= newSlots * 9;
      });
      if (filtered.length === 0) {
        slots.length = 0; remaining = 39; openSlots = 7; continue;
      }
      const pick = filtered[Math.floor(Math.random() * filtered.length)];
      slots.push(pick);
      remaining -= PIECE_VAL[pick];
      openSlots--;
    }
    if (slots.length === 7 && remaining === 0) {
      // Place king at file e (index 4) — slots fill files 0,1,2,3,5,6,7 in order
      // Sort slots by aesthetic: heavier pieces near center
      slots.sort((a, b) => PIECE_VAL[b] - PIECE_VAL[a]);
      // Distribute: outermost slots get rooks/lighter, inner get heavier
      const filesOrder = [0, 7, 1, 6, 2, 5, 3]; // outside-in
      const piecesByFile: string[] = ["", "", "", "", "K", "", "", ""];
      // Map slots to file order: place strongest (queen) closer to king
      // Reverse — strongest LAST so they end up in middle
      const placeOrder = filesOrder.slice().reverse();
      for (let i = 0; i < 7; i++) {
        piecesByFile[placeOrder[i]] = slots[i];
      }
      // Aggregate counts
      const counts: Record<string, number> = {};
      for (const p of slots) counts[p] = (counts[p] || 0) + 1;
      const pieces: ArmySlot[] = Object.entries(counts).map(([p, count]) => ({ piece: p as any, count }));
      return { piecesByFile, pieces };
    }
  }
  // Fallback to standard army
  return {
    piecesByFile: ["R", "N", "B", "Q", "K", "B", "N", "R"],
    pieces: [{ piece: "R", count: 2 }, { piece: "N", count: 2 }, { piece: "B", count: 2 }, { piece: "Q", count: 1 }],
  };
}

export function asymmetricFen(): { fen: string; whiteArmy: ArmySlot[]; blackArmy: ArmySlot[] } {
  const w = randomArmy();
  const b = randomArmy();
  const whiteRank = w.piecesByFile.join("");
  const blackRank = b.piecesByFile.join("").toLowerCase();
  const fen = `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w - - 0 1`;
  return { fen, whiteArmy: w.pieces, blackArmy: b.pieces };
}

// Manual army builder: given user-picked piece counts (must sum to 39 points
// across exactly 7 slots), build the FEN.
export function buildArmyFen(whiteSlots: ("Q"|"R"|"B"|"N")[], blackSlots: ("Q"|"R"|"B"|"N")[]): { fen: string; whiteArmy: ArmySlot[]; blackArmy: ArmySlot[] } | null {
  if (whiteSlots.length !== 7 || blackSlots.length !== 7) return null;
  // Validate budget
  const wBudget = whiteSlots.reduce((a, p) => a + (PIECE_VAL[p] || 0), 0);
  const bBudget = blackSlots.reduce((a, p) => a + (PIECE_VAL[p] || 0), 0);
  if (wBudget !== 39 || bBudget !== 39) return null;
  // Place: heavy pieces toward center (sorted by value, alternated outside-in)
  const place = (slots: string[]) => {
    const sorted = [...slots].sort((a, b) => (PIECE_VAL[b] || 0) - (PIECE_VAL[a] || 0));
    const filesOrder = [3, 5, 2, 6, 1, 7, 0]; // center-out
    const out: string[] = ["", "", "", "", "K", "", "", ""];
    for (let i = 0; i < 7; i++) out[filesOrder[i]] = sorted[i];
    return out;
  };
  const wRank = place(whiteSlots).join("");
  const bRank = place(blackSlots).join("").toLowerCase();
  const counts = (slots: string[]): ArmySlot[] => {
    const m: Record<string, number> = {};
    for (const p of slots) m[p] = (m[p] || 0) + 1;
    return Object.entries(m).map(([p, c]) => ({ piece: p as any, count: c }));
  };
  return {
    fen: `${bRank}/pppppppp/8/8/8/8/PPPPPPPP/${wRank} w - - 0 1`,
    whiteArmy: counts(whiteSlots),
    blackArmy: counts(blackSlots),
  };
}

// Daily variant — deterministic per day, picks from non-standard variants
export function dailyVariant(): VariantId {
  const days = Math.floor(Date.now() / 86400000);
  let h = days * 2654435761; h = (h ^ (h >>> 16)) >>> 0;
  // Skip "standard" — daily challenge should always be non-standard
  const pool = VARIANTS.filter(v => v.id !== "standard").map(v => v.id);
  return pool[h % pool.length];
}

// Random variant from non-standard pool
export function randomVariant(): VariantId {
  const pool = VARIANTS.filter(v => v.id !== "standard").map(v => v.id);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Per-variant stats
export type VariantStats = Record<VariantId, { w: number; l: number; d: number }>;
const VS_KEY = "aevion_variant_stats_v1";

export function ldVariantStats(): VariantStats {
  try { const s = localStorage.getItem(VS_KEY); if (!s) return makeEmptyStats(); const r = JSON.parse(s); return { ...makeEmptyStats(), ...r } } catch { return makeEmptyStats() }
}
export function svVariantStats(s: VariantStats) {
  try { localStorage.setItem(VS_KEY, JSON.stringify(s)) } catch {}
}
function makeEmptyStats(): VariantStats {
  const out: any = {};
  for (const v of VARIANTS) out[v.id] = { w: 0, l: 0, d: 0 };
  return out;
}
export function recordVariantResult(stats: VariantStats, variant: VariantId, result: "w" | "l" | "d"): VariantStats {
  return { ...stats, [variant]: { ...stats[variant], [result]: stats[variant][result] + 1 } };
}

// Daily variant state — track if today's daily was won (for x2 Chessy bonus once per day)
type DailyVariantState = { v: 1; date: string; variant: VariantId; played: boolean; won: boolean };
const DV_KEY = "aevion_daily_variant_v1";

export function ldDailyVariantState(): DailyVariantState | null {
  try { const s = localStorage.getItem(DV_KEY); if (!s) return null; const r = JSON.parse(s); return r?.v === 1 ? r : null } catch { return null }
}
export function svDailyVariantState(s: DailyVariantState) {
  try { localStorage.setItem(DV_KEY, JSON.stringify(s)) } catch {}
}
function todayKey() {
  const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function getDailyVariantState(): DailyVariantState {
  const today = todayKey();
  const prev = ldDailyVariantState();
  if (prev && prev.date === today) return prev;
  const fresh: DailyVariantState = { v: 1, date: today, variant: dailyVariant(), played: false, won: false };
  svDailyVariantState(fresh);
  return fresh;
}
export function markDailyVariantPlayed(won: boolean): DailyVariantState {
  const cur = getDailyVariantState();
  const next = { ...cur, played: true, won: cur.won || won };
  svDailyVariantState(next);
  return next;
}

// Preset armies — curated combinations to spark ideas
export const ARMY_PRESETS: { name: string; emoji: string; slots: ("Q"|"R"|"B"|"N")[]; desc: string }[] = [
  { name: "FIDE Standard", emoji: "♟", slots: ["R","R","B","B","N","N","Q"], desc: "Классика" },
  { name: "Triple Queen", emoji: "👑", slots: ["Q","Q","Q","B","B","N","N"], desc: "3 ферзя — мать тактики" },
  { name: "Cavalry", emoji: "🐎", slots: ["N","N","N","N","N","N","R"], desc: "6 коней + ладья" },
  { name: "Rook Fortress", emoji: "🏰", slots: ["R","R","R","R","R","R","Q"], desc: "6 ладей + ферзь" },
  { name: "Bishop Storm", emoji: "🌪", slots: ["B","B","B","B","B","B","R"], desc: "6 слонов + ладья" },
  { name: "Quad Queen", emoji: "👑👑", slots: ["Q","Q","Q","Q","N","N","B"], desc: "4 ферзя — апокалипсис" },
  { name: "Tactical", emoji: "⚔", slots: ["N","N","N","B","B","B","Q"], desc: "3N+3B+Q — лёгкая армия" },
  { name: "Heavy Steel", emoji: "💪", slots: ["Q","R","R","R","R","B","B"], desc: "тяжёлый материал" },
];

// ── Twin Kings ───────────────────────────────────────────
// Standard FEN, but the queen is treated as "royal" — losing it = loss.
// We just return standard FEN; the page.tsx will check queen capture.
export function twinKingsFen(): string {
  // Use standard start; the variant rules (queen = royal) are enforced in checkGameOver
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

// Check if either side has lost their queen (Twin Kings royal-queen rule).
// Returns the side that lost (and so the OPPOSITE side wins), or null.
export function twinKingsLossSide(fen: string): "w" | "b" | null {
  // Parse placement
  const placement = fen.split(" ")[0];
  const ranks = placement.split("/");
  let whiteQ = 0, blackQ = 0;
  for (const r of ranks) {
    for (const c of r) {
      if (c === "Q") whiteQ++;
      else if (c === "q") blackQ++;
    }
  }
  if (whiteQ === 0) return "w";
  if (blackQ === 0) return "b";
  return null;
}

// ── Diceblade ────────────────────────────────────────────
// Roll a die. Returns piece type code matching chess.js (lowercase).
// 1=p (pawn), 2=n, 3=b, 4=r, 5=q, 6=any (returns "")
export function rollDice(): { face: 1 | 2 | 3 | 4 | 5 | 6; pieceType: string; label: string } {
  const face = (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  const map: Record<number, { type: string; label: string }> = {
    1: { type: "p", label: "Пешка" },
    2: { type: "n", label: "Конь" },
    3: { type: "b", label: "Слон" },
    4: { type: "r", label: "Ладья" },
    5: { type: "q", label: "Ферзь" },
    6: { type: "", label: "Любая фигура!" },
  };
  return { face, pieceType: map[face].type, label: map[face].label };
}

// Filter chess.js verbose moves by allowed piece type. Empty pieceType = all allowed.
// King moves are always allowed (otherwise stalemate-ish lock).
export function filterMovesByDice<T extends { piece: string }>(moves: T[], pieceType: string): T[] {
  if (!pieceType) return moves;
  return moves.filter(m => m.piece === pieceType || m.piece === "k");
}

// ── Atomic ───────────────────────────────────────────────
// Standard start; explosion logic applied AFTER each capture.
export function atomicFen(): string {
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

// Apply explosion: remove all non-pawn pieces in 3x3 around `sq`,
// plus any piece on `sq` itself. Returns new placement string.
// `sq` like "e4". Returns updated FEN string.
export function applyExplosion(fen: string, sq: string): { fen: string; whiteKingDead: boolean; blackKingDead: boolean } {
  const parts = fen.split(" ");
  const ranks = parts[0].split("/");
  // Convert each rank to a 8-char array (digits expanded)
  const grid: string[][] = ranks.map(r => {
    const row: string[] = [];
    for (const c of r) {
      if (/\d/.test(c)) for (let k = 0; k < parseInt(c); k++) row.push(".");
      else row.push(c);
    }
    return row;
  });
  const file = sq.charCodeAt(0) - 97;
  const rank = 8 - parseInt(sq[1]);
  let whiteKingDead = false, blackKingDead = false;
  for (let dr = -1; dr <= 1; dr++) {
    for (let df = -1; df <= 1; df++) {
      const r = rank + dr, f = file + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      const p = grid[r][f];
      if (p === ".") continue;
      // Pawns survive UNLESS they're on the epicenter
      if ((p === "P" || p === "p") && (dr !== 0 || df !== 0)) continue;
      // Track king deaths
      if (p === "K") whiteKingDead = true;
      if (p === "k") blackKingDead = true;
      grid[r][f] = ".";
    }
  }
  // Reconstruct FEN ranks (collapse dots into digits)
  const newRanks = grid.map(row => {
    let out = "", run = 0;
    for (const c of row) {
      if (c === ".") run++;
      else { if (run > 0) { out += run; run = 0 } out += c }
    }
    if (run > 0) out += run;
    return out;
  });
  parts[0] = newRanks.join("/");
  return { fen: parts.join(" "), whiteKingDead, blackKingDead };
}

// ── King of the Hill ─────────────────────────────────────
// Standard start; check after each move if a king reached a center square.
export function kothFen(): string {
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

const KOTH_CENTER = ["d4", "d5", "e4", "e5"];

// Returns "w" or "b" if their king is on a center square; null otherwise.
export function kothWinner(fen: string): "w" | "b" | null {
  try {
    const placement = fen.split(" ")[0];
    const ranks = placement.split("/");
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const c of ranks[r]) {
        if (/\d/.test(c)) { f += parseInt(c); continue }
        const sq = `${"abcdefgh"[f]}${8 - r}`;
        if ((c === "K" || c === "k") && KOTH_CENTER.includes(sq)) {
          return c === "K" ? "w" : "b";
        }
        f++;
      }
    }
  } catch {}
  return null;
}

// ── Three-Check ──────────────────────────────────────────
// Standard start; track checks delivered by each side. 3 → win.
export function threeCheckFen(): string {
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

// ── Knight Riders ────────────────────────────────────────
// 6 knights instead of standard backrank. King on e1/e8.
export function knightRidersFen(): string {
  // White: NNNKNNNN — but we need knight + king + knights. Place king at e (file 4).
  // 8 slots: NNNNKNNN (king on file 4)
  return "nnnnknnn/pppppppp/8/8/8/8/PPPPPPPP/NNNNKNNN w - - 0 1";
}

// ── Pawn Apocalypse ──────────────────────────────────────
// King + queen + 2 rooks; double row of pawns (ranks 2-3 for white, 6-7 for black).
// No minor pieces.
export function pawnApocalypseFen(): string {
  // White back rank (rank 1): R - - Q K - - R = "R2QK2R"
  // Rank 2: pppppppp
  // Rank 3: pppppppp
  // Black back rank (rank 8): "r2qk2r"
  // Rank 7: pppppppp
  // Rank 6: pppppppp
  return "r2qk2r/pppppppp/pppppppp/8/8/PPPPPPPP/PPPPPPPP/R2QK2R w KQkq - 0 1";
}

// ── Reinforcement ───────────────────────────────────────
// Pick one captured piece (from given pool) to drop on a random empty
// square in the owner's first 4 ranks. Returns null if no candidate.
export type CapturedSet = string[]; // piece codes like 'P', 'N', 'b'

export function pickReinforcement(captured: CapturedSet, side: "w" | "b", boardFen: string): { piece: string; sq: string } | null {
  if (captured.length === 0) return null;
  // Filter pieces to side
  const myPieces = captured.filter(p => (side === "w") === (p === p.toUpperCase()));
  if (myPieces.length === 0) return null;
  const piece = myPieces[Math.floor(Math.random() * myPieces.length)];
  // Find empty squares in side's first 4 ranks
  const placement = boardFen.split(" ")[0];
  const ranks = placement.split("/"); // index 0 = rank 8 (black)
  const startRank = side === "w" ? 4 : 0; // ranks 1..4 for white = indexes 7..4 (reversed); ranks 5..8 for black = indexes 3..0
  // Actually: white owns ranks 1-4 (indexes 7,6,5,4); black owns 5-8 (indexes 3,2,1,0)
  const myRankIndexes = side === "w" ? [4, 5, 6, 7] : [0, 1, 2, 3];
  const emptySquares: string[] = [];
  for (const rIdx of myRankIndexes) {
    let file = 0;
    for (const c of ranks[rIdx]) {
      if (/\d/.test(c)) {
        for (let k = 0; k < parseInt(c); k++) {
          emptySquares.push(`${"abcdefgh"[file]}${8 - rIdx}`);
          file++;
        }
      } else {
        file++;
      }
    }
  }
  if (emptySquares.length === 0) return null;
  const sq = emptySquares[Math.floor(Math.random() * emptySquares.length)];
  return { piece, sq };
}
