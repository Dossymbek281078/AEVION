/* ═══ Master Games Library ═══
   Встроенная коллекция знаменитых партий с краткими аннотациями.
   Пользователь может: 1) пройти replay, 2) угадывать ход мастера. */

import { Chess } from "chess.js";

export type MasterGame = {
  id: string;
  white: string;
  black: string;
  event: string;
  year: number;
  result: "1-0" | "0-1" | "1/2-1/2";
  // SAN ходы — массив, проверяется на load.
  moves: string[];
  // Краткая «легенда» партии — почему она знаменита.
  blurb: string;
  // Заметки на ключевых ходах: idx (0-based) → текст.
  notes: Record<number, string>;
  // С чьей стороны интереснее «угадывать ход» — обычно того, кто играл лучше.
  guessSide: "w" | "b";
  // Дидактический тег
  theme: "Attack" | "Sacrifice" | "Endgame" | "Strategy" | "Defense";
};

export const MASTER_GAMES: MasterGame[] = [
  {
    id: "immortal-1851",
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    event: "London casual",
    year: 1851,
    result: "1-0",
    blurb:
      "«Бессмертная партия». Андерссен жертвует обе ладьи, слона и ферзя — и матует тремя лёгкими фигурами. Эталон комбинационного шахматного искусства XIX века.",
    moves: [
      "e4","e5","f4","exf4","Bc4","Qh4+","Kf1","b5","Bxb5","Nf6","Nf3","Qh6",
      "d3","Nh5","Nh4","Qg5","Nf5","c6","g4","Nf6","Rg1","cxb5","h4","Qg6",
      "h5","Qg5","Qf3","Ng8","Bxf4","Qf6","Nc3","Bc5","Nd5","Qxb2","Bd6","Bxg1",
      "e5","Qxa1+","Ke2","Na6","Nxg7+","Kd8","Qf6+","Nxf6","Be7#",
    ],
    notes: {
      11: "Кажется, белые теряют слона — но Андерссен уже видит концовку.",
      32: "Жертва слона — поле b2 и поле b8 разменены на катастрофу для чёрных.",
      40: "21.Nxg7+! Конь жертвуется ради темпа.",
      44: "23.Be7#! Финальный мат тремя лёгкими фигурами при потере целого ферзевого фланга.",
    },
    guessSide: "w",
    theme: "Sacrifice",
  },
  {
    id: "opera-1858",
    white: "Paul Morphy",
    black: "Duke of Brunswick / Count Isouard",
    event: "Paris Opera",
    year: 1858,
    result: "1-0",
    blurb:
      "Морфи играет в ложе Парижской оперы — и за 17 ходов даёт мастер-класс по развитию фигур. Без единой ошибки, всё естественно и точно.",
    moves: [
      "e4","e5","Nf3","d6","d4","Bg4","dxe5","Bxf3","Qxf3","dxe5","Bc4","Nf6",
      "Qb3","Qe7","Nc3","c6","Bg5","b5","Nxb5","cxb5","Bxb5+","Nbd7","O-O-O","Rd8",
      "Rxd7","Rxd7","Rd1","Qe6","Bxd7+","Nxd7","Qb8+","Nxb8","Rd8#",
    ],
    notes: {
      18: "Жертва коня вскрывает позицию короля чёрных — каждый темп Морфи использует.",
      28: "Жертва ферзя для финального матового аккорда!",
      32: "Rd8# — мат двумя ладьями (одной из них уже нет) и слоном. Идеальная партия.",
    },
    guessSide: "w",
    theme: "Attack",
  },
  {
    id: "century-1956",
    white: "Donald Byrne",
    black: "Robert Fischer",
    event: "Rosenwald Memorial NYC",
    year: 1956,
    result: "0-1",
    blurb:
      "«Партия столетия». 13-летний Фишер жертвует ферзя на 17-м ходу и доводит партию до мата. После этой партии о нём заговорил весь шахматный мир.",
    moves: [
      "Nf3","Nf6","c4","g6","Nc3","Bg7","d4","O-O","Bf4","d5","Qb3","dxc4",
      "Qxc4","c6","e4","Nbd7","Rd1","Nb6","Qc5","Bg4","Bg5","Na4","Qa3","Nxc3",
      "bxc3","Nxe4","Bxe7","Qb6","Bc4","Nxc3","Bc5","Rfe8+","Kf1","Be6","Bxb6","Bxc4+",
      "Kg1","Ne2+","Kf1","Nxd4+","Kg1","Ne2+","Kf1","Nc3+","Kg1","axb6","Qb4","Ra4",
      "Qxb6","Nxd1","h3","Rxa2","Kh2","Nxf2","Re1","Rxe1","Qd8+","Bf8","Nxe1","Bd5",
      "Nf3","Ne4","Qb8","b5","h4","h5","Ne5","Kg7","Kg1","Bc5+","Kf1","Ng3+",
      "Ke1","Bb4+","Kd1","Bb3+","Kc1","Ne2+","Kb1","Nc3+","Kc1","Rc2#",
    ],
    notes: {
      31: "17...Be6!! — жертва ферзя для серии разменов и мощной координации фигур.",
      44: "Чёрный конь и слон создают «вечный шах», пока чёрные забирают материал.",
      80: "41...Rc2# — финальный мат, 80 ходов, до сих пор анализируется в школах.",
    },
    guessSide: "b",
    theme: "Sacrifice",
  },
  {
    id: "kasparov-topalov-1999",
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    event: "Hoogovens Wijk aan Zee",
    year: 1999,
    result: "1-0",
    blurb:
      "«Бессмертная партия №2». Каспаров жертвует ладью на 24-м ходу и гонит чёрного короля через всю доску. Лучшая партия конца XX века.",
    moves: [
      "e4","d6","d4","Nf6","Nc3","g6","Be3","Bg7","Qd2","c6","f3","b5",
      "Nge2","Nbd7","Bh6","Bxh6","Qxh6","Bb7","a3","e5","O-O-O","Qe7","Kb1","a6",
      "Nc1","O-O-O","Nb3","exd4","Rxd4","c5","Rd1","Nb6","g3","Kb8","Na5","Ba8",
      "Bh3","d5","Qf4+","Ka7","Rhe1","d4","Nd5","Nbxd5","exd5","Qd6","Rxd4","cxd4",
      "Re7+","Kb6","Qxd4+","Kxa5","b4+","Ka4","Qc3","Qxd5","Ra7","Bb7","Rxb7","Qc4",
      "Qxf6","Kxa3","Qxa6+","Kxb4","c3+","Kxc3","Qa1+","Kd2","Qb2+","Kd1","Bf1","Rd2",
      "Rd7","Rxd7","Bxc4","bxc4","Qxh8","Rd3","Qa8","c3","Qa4+","Ke1","f4","f5",
      "Kc1","Rd2","Qa7",
    ],
    notes: {
      46: "24.Rxd4! — жертва ладьи, чтобы вскрыть линии у короля.",
      48: "25.Re7+!! — ещё одна жертва. Король чёрных идёт в марш через всю доску.",
      62: "31.Qxf6! — Каспаров видит мат через 6 ходов с жертвой ещё одной фигуры.",
    },
    guessSide: "w",
    theme: "Attack",
  },
  {
    id: "reti-tartakower-1910",
    white: "Richard Réti",
    black: "Savielly Tartakower",
    event: "Vienna",
    year: 1910,
    result: "1-0",
    blurb:
      "Знаменитая миниатюра — Рети ловит чёрного короля в матовую сеть всего за 11 ходов. Эталон того, как одна-единственная неточность ведёт к катастрофе в открытой позиции.",
    moves: [
      "e4","c6","d4","d5","Nc3","dxe4","Nxe4","Nf6","Qd3","e5","dxe5","Qa5+",
      "Bd2","Qxe5","O-O-O","Nxe4","Qd8+","Kxd8","Bg5+","Kc7","Bd8#",
    ],
    notes: {
      8: "9.Qd3? — слабый ход, но создаёт ловушку.",
      14: "Чёрные забирают пешку — и попадают под огонь.",
      16: "17.Qd8+!! — гениальная жертва ферзя, после которой мата не избежать.",
      20: "11.Bd8# — финальный мат малой партии в 11 ходов.",
    },
    guessSide: "w",
    theme: "Sacrifice",
  },
  {
    id: "adams-torre-1920",
    white: "Edwin Adams",
    black: "Carlos Torre",
    event: "New Orleans",
    year: 1920,
    result: "1-0",
    blurb:
      "«Танец ферзей». Адамс пять ходов подряд предлагает чёрным взять ферзя — каждое взятие проигрывает. Этюд по теме «слабая 8-я горизонталь».",
    moves: [
      "e4","e5","Nf3","d6","d4","exd4","Qxd4","Nc6","Bb5","Bd7","Bxc6","Bxc6",
      "Nc3","Nf6","O-O","Be7","Nd5","Bxd5","exd5","O-O","Bg5","c6","c4","cxd5",
      "cxd5","Re8","Rfe1","a5","Re2","Rc8","Rae1","Qd7","Bxf6","Bxf6","Qg4","Qb5",
      "Qc4","Qd7","Qc7","Qb5","a4","Qxa4","Re4","Qb5","Qxb7",
    ],
    notes: {
      34: "18.Qg4! — ферзь предлагает себя в жертву трижды подряд: чёрные не могут взять из-за слабости 8-й горизонтали.",
      38: "20.Qc7! Qb5 — ещё одна попытка размена, и снова нет!",
      44: "23.Qxb7! — наконец берёт пешку и угрожает матом. Чёрные сдались.",
    },
    guessSide: "w",
    theme: "Strategy",
  },
];

// Validate at module load (in dev) — silently filter out games where chess.js
// rejects a SAN string, so the UI never crashes on bad data.
let _validated: MasterGame[] | null = null;
export function getValidGames(): MasterGame[] {
  if (_validated) return _validated;
  const out: MasterGame[] = [];
  for (const g of MASTER_GAMES) {
    try {
      const c = new Chess();
      let ok = true;
      for (const san of g.moves) {
        const mv = c.move(san);
        if (!mv) { ok = false; break; }
      }
      if (ok) out.push(g);
    } catch {
      // skip
    }
  }
  _validated = out;
  return out;
}

// Build cumulative FEN list for a game (one per ply + initial position).
export function buildFenLine(g: MasterGame): string[] {
  const c = new Chess();
  const fens = [c.fen()];
  for (const san of g.moves) {
    try { c.move(san); fens.push(c.fen()); } catch { break; }
  }
  return fens;
}

// Score a guess against the actual master move. Exact match = 100, else 0.
// (Could be smarter — e.g. equal piece move on same square — but keeping
// the bar high makes the game feel meaningful.)
export type GuessResult = {
  correct: boolean;
  actual: string;
  guess: string;
  reward: number;
};
export function scoreGuess(actualSan: string, guessSan: string | null): GuessResult {
  const correct = !!guessSan && guessSan === actualSan;
  return {
    correct,
    actual: actualSan,
    guess: guessSan || "",
    reward: correct ? 15 : 0,
  };
}

// Per-game progress in localStorage.
const PK = "aevion_chess_master_progress_v1";
export type MasterProgress = {
  v: 1;
  byId: Record<string, { lastPly: number; bestGuessRate: number; completed: boolean }>;
};
const DEFAULT_PROGRESS: MasterProgress = { v: 1, byId: {} };

export function loadProgress(): MasterProgress {
  try {
    const s = localStorage.getItem(PK);
    if (!s) return { ...DEFAULT_PROGRESS };
    const r = JSON.parse(s);
    return r?.v === 1 ? r : { ...DEFAULT_PROGRESS };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(p: MasterProgress) {
  try { localStorage.setItem(PK, JSON.stringify(p)); } catch {}
}

export function recordCompletion(id: string, lastPly: number, guessRate: number) {
  const p = loadProgress();
  const prev = p.byId[id] || { lastPly: 0, bestGuessRate: 0, completed: false };
  p.byId[id] = {
    lastPly: Math.max(prev.lastPly, lastPly),
    bestGuessRate: Math.max(prev.bestGuessRate, guessRate),
    completed: true,
  };
  saveProgress(p);
  return p;
}
