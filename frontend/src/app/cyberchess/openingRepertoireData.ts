// Opening Repertoire — types + storage helpers
// Storage key: cc_opening_repertoire_v1

export type RepertoireColor = "white" | "black";

export type RepertoireBranch = {
  id: string;
  name: string;
  color: RepertoireColor;
  eco: string;
  moves: string[];
  notes?: string;
  attempts: number;
  successes: number;
  created: number;
  lastReview: number;
};

export type EcoPreset = {
  eco: string;
  name: string;
  moves: string[];
  color: RepertoireColor;
};

const STORAGE_KEY = "cc_opening_repertoire_v1";

// 20 ECO presets — classic openings
export const ECO_PRESETS: EcoPreset[] = [
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"], color: "white" },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"], color: "white" },
  { eco: "C20", name: "King's Pawn Game", moves: ["e4", "e5"], color: "white" },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"], color: "black" },
  { eco: "B90", name: "Sicilian Najdorf", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"], color: "black" },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"], color: "black" },
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"], color: "black" },
  { eco: "B07", name: "Pirc Defense", moves: ["e4", "d6", "d4", "Nf6"], color: "black" },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"], color: "black" },
  { eco: "C40", name: "King's Knight Opening", moves: ["e4", "e5", "Nf3"], color: "white" },
  { eco: "D02", name: "Queen's Pawn Game", moves: ["d4", "d5"], color: "white" },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"], color: "white" },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"], color: "black" },
  { eco: "D80", name: "Grünfeld Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"], color: "black" },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6"], color: "black" },
  { eco: "E00", name: "Catalan Opening", moves: ["d4", "Nf6", "c4", "e6", "g3"], color: "white" },
  { eco: "A04", name: "Réti Opening", moves: ["Nf3"], color: "white" },
  { eco: "A10", name: "English Opening", moves: ["c4"], color: "white" },
  { eco: "A45", name: "Trompowsky Attack", moves: ["d4", "Nf6", "Bg5"], color: "white" },
  { eco: "C45", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"], color: "white" },
];

// Mock book stats (Lichess-style) — top-3 replies + winrate
export type BookReply = {
  move: string;
  games: number;
  white: number; // %
  draw: number; // %
  black: number; // %
};

export function mockBookStats(branch: RepertoireBranch): BookReply[] {
  // Deterministic mock based on branch id hash
  const hash = branch.id
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = (hash % 30) + 20;

  // Common reply moves
  const replyPools: Record<string, string[]> = {
    e4: ["e5", "c5", "e6", "c6", "d5"],
    d4: ["d5", "Nf6", "f5", "e6", "d6"],
    Nf3: ["d5", "Nf6", "c5", "g6"],
    c4: ["e5", "c5", "Nf6", "e6"],
  };
  const lastMove = branch.moves[branch.moves.length - 1] || "e4";
  const candidates = replyPools[lastMove] || ["Nf6", "d5", "e6"];

  return candidates.slice(0, 3).map((m, i) => {
    const games = 12000 - i * 3200 - (hash % 500);
    const white = base + (i === 0 ? 8 : i === 1 ? 2 : -4) + (hash % 5);
    const draw = 28 + (i * 3) - (hash % 4);
    const black = Math.max(100 - white - draw, 10);
    return { move: m, games, white, draw, black };
  });
}

export function loadRepertoire(): RepertoireBranch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = defaultRepertoire();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultRepertoire();
    return parsed as RepertoireBranch[];
  } catch {
    return defaultRepertoire();
  }
}

export function saveRepertoire(branches: RepertoireBranch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branches));
  } catch {
    // ignore quota errors
  }
}

export function defaultRepertoire(): RepertoireBranch[] {
  const now = Date.now();
  return [
    {
      id: "seed-italian",
      name: "Italian Game — main line",
      color: "white",
      eco: "C50",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
      notes: "Classical Giuoco Piano — solid white setup.",
      attempts: 0,
      successes: 0,
      created: now - 86400000 * 7,
      lastReview: 0,
    },
    {
      id: "seed-caro",
      name: "Caro-Kann — Advance variation",
      color: "black",
      eco: "B10",
      moves: ["e4", "c6", "d4", "d5", "e5", "Bf5"],
      notes: "Solid Black setup vs 1.e4. Develop Bf5 before e6.",
      attempts: 0,
      successes: 0,
      created: now - 86400000 * 5,
      lastReview: 0,
    },
    {
      id: "seed-najdorf",
      name: "Sicilian Najdorf",
      color: "black",
      eco: "B90",
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
      notes: "Razor-sharp — needs concrete prep.",
      attempts: 0,
      successes: 0,
      created: now - 86400000 * 3,
      lastReview: 0,
    },
    {
      id: "seed-qgd",
      name: "Queen's Gambit — main",
      color: "white",
      eco: "D06",
      moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
      notes: "Closed positional play. Aim for minority attack.",
      attempts: 0,
      successes: 0,
      created: now - 86400000,
      lastReview: 0,
    },
  ];
}

export function newBranchFromPreset(preset: EcoPreset, name?: string): RepertoireBranch {
  const now = Date.now();
  return {
    id: `branch-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || preset.name,
    color: preset.color,
    eco: preset.eco,
    moves: [...preset.moves],
    notes: "",
    attempts: 0,
    successes: 0,
    created: now,
    lastReview: 0,
  };
}

export function successRate(b: RepertoireBranch): number {
  if (b.attempts === 0) return 0;
  return Math.round((b.successes / b.attempts) * 100);
}

// Mock 7-day streak — derived from id hash + attempts
export function recentStreak(b: RepertoireBranch): boolean[] {
  const hash = b.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 7 }, (_, i) => {
    const v = (hash + i * 31 + b.attempts) % 5;
    return v < 3; // ~60% success days
  });
}
