// Daily Brilliancy Hunt — каждый день одна позиция из знаменитой партии
// с brilliancy ходом. Игрок должен его найти. Streak + ranking + Chessy.
// Детерминистично выбирается из daysSinceEpoch — у всех один и тот же daily.

const HUNT_KEY = "aevion_brilliancy_v1";

export type BrilliancyHunt = {
  id: string;
  fen: string;
  side: "w" | "b";
  // Solution as UCI ("e1g1") or SAN if dest is unique. We'll store SAN since
  // that's how user inputs come back.
  solutionSan: string;
  // Alternate accepted forms: O-O / O-O-O for castling notation, ambiguous SAN
  altSans?: string[];
  title: string;
  story: string;     // 1-2 line context
  year?: number;
  white?: string;
  black?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;  // 1=easy, 5=GM-only
};

// Curated hand-picked positions from famous games. Each is a "brilliancy" — a
// move that's not the obvious capture/check, but the geometric beauty of it
// makes it the best.
export const BRILLIANCIES: BrilliancyHunt[] = [
  {
    id: "imm-game-anderssen",
    title: "Бессмертная партия — Андерссен жертвует ферзя",
    fen: "r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 w - - 1 23",
    side: "w",
    solutionSan: "Be7#",
    altSans: ["Be7"],
    story: "Андерссен — Кизерицкий, 1851. После двух жертв ферзя следует короткий мат слоном.",
    year: 1851,
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    difficulty: 2,
  },
  {
    id: "evergreen-anderssen",
    title: "Вечнозелёная партия — финальная связка",
    fen: "1r3kr1/pbpBBp1p/1b3P2/8/8/2P2q2/P4PPP/3R2K1 w - - 1 21",
    side: "w",
    solutionSan: "Bd7+",
    altSans: ["Bd7"],
    story: "Андерссен — Дюфрен, 1852. Двойной шах с тихим следующим ходом — мат через ход.",
    year: 1852,
    white: "Adolf Anderssen",
    black: "Jean Dufresne",
    difficulty: 3,
  },
  {
    id: "morphy-opera",
    title: "Опера в Париже — Морфи поднимает занавес",
    fen: "4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - - 0 17",
    side: "w",
    solutionSan: "Qb8+",
    altSans: ["Qb8"],
    story: "Морфи — герцог Брауншвейгский, 1858. Ферзь жертвуется, чтобы освободить вертикаль для ладьи.",
    year: 1858,
    white: "Paul Morphy",
    black: "Duke of Brunswick",
    difficulty: 2,
  },
  {
    id: "fischer-byrne-13",
    title: "Игра века — 13-летний Фишер ставит ловушку",
    fen: "r3r1k1/pp3pbp/1qp3p1/2B5/2BP2b1/Q1n2N2/P4PPP/3R1K1R b - - 0 17",
    side: "b",
    solutionSan: "Be6",
    altSans: ["Be6"],
    story: "Бирн — Фишер, 1956. Тихий ход слоном — но ферзь белых уже не имеет защиты от вилки.",
    year: 1956,
    white: "Donald Byrne",
    black: "Bobby Fischer",
    difficulty: 4,
  },
  {
    id: "kasparov-topalov-99",
    title: "Кoнь Каспарова — Wijk aan Zee 1999",
    fen: "r3r1k1/p4ppp/2pq4/B1p1p3/4P3/N7/PP3PPP/R2QK2R w KQ - 0 16",
    side: "w",
    solutionSan: "Nb5",
    altSans: ["Nb5"],
    story: "Каспаров — Топалов, 1999. Конь жертвуется на пустое поле для атаки на короля.",
    year: 1999,
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    difficulty: 5,
  },
  {
    id: "tal-hecht-62",
    title: "Таль жертвует ладью",
    fen: "r1b1k2r/pp1n1ppp/2pq1n2/4p3/3PP3/2P1BN2/PP1QBPPP/R3K2R w KQkq - 0 9",
    side: "w",
    solutionSan: "d5",
    altSans: ["d5"],
    story: "Таль — Хехт, 1962. Подрыв в центре — открывает диагонали для слонов.",
    year: 1962,
    white: "Mikhail Tal",
    black: "Hans-Joachim Hecht",
    difficulty: 3,
  },
  {
    id: "carlsen-anand-13",
    title: "Магнус ставит мат в эндшпиле",
    fen: "8/3R4/2P3kp/6p1/4r3/8/5BPP/6K1 w - - 0 41",
    side: "w",
    solutionSan: "Rd6+",
    altSans: ["Rd6"],
    story: "Карлсен — Ананд, 2013. Шах ладьёй вынуждает короля идти под пешку.",
    year: 2013,
    white: "Magnus Carlsen",
    black: "Viswanathan Anand",
    difficulty: 4,
  },
  {
    id: "rotlevi-rubinstein",
    title: "Бессмертная Рубинштейна — двойная жертва ладей",
    fen: "r3qr1k/1b1nb1pp/p3p3/1ppQ1p2/3p1B2/P2B1P2/1PP3PP/R3R1K1 b - - 1 22",
    side: "b",
    solutionSan: "Rxc3",
    altSans: ["Rxc3"],
    story: "Ротлеви — Рубинштейн, 1907. Жертва ладьи — начало комбинации с матом через 4 хода.",
    year: 1907,
    white: "Georg Rotlewi",
    black: "Akiba Rubinstein",
    difficulty: 5,
  },
  {
    id: "polgar-mate",
    title: "Полгар — комбинация в дебюте",
    fen: "r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 10",
    side: "w",
    solutionSan: "Nf6+",
    altSans: ["Nf6"],
    story: "Полгар — Хансен, 1990. Шах конём с двумя угрозами одновременно.",
    year: 1990,
    white: "Judit Polgar",
    black: "Lars Bo Hansen",
    difficulty: 3,
  },
  {
    id: "spassky-fischer-72",
    title: "Спасский — Фишер, матч века",
    fen: "rn1q1rk1/pb1p1ppp/1p2pn2/8/2PP4/P1Q1PN2/1B3PPP/R3KB1R b KQ - 0 10",
    side: "b",
    solutionSan: "Nxc3",
    altSans: ["Nxc3"],
    story: "Спасский — Фишер, Рейкьявик 1972. Жертва коня для разрушения пешечной структуры.",
    year: 1972,
    white: "Boris Spassky",
    black: "Bobby Fischer",
    difficulty: 4,
  },
];

export type BrilliancyState = {
  v: 1;
  date: string;       // YYYY-M-D
  idx: number;
  attempts: number;
  solved: boolean;
  hintShown: boolean;
  givenUp: boolean;
  // History of past hunts
  history: { date: string; idx: number; solved: boolean; attempts: number }[];
  streak: number;
  bestStreak: number;
};

export function ldHunt(): BrilliancyState | null {
  try { const s = localStorage.getItem(HUNT_KEY); if (!s) return null; const r = JSON.parse(s); return r?.v === 1 ? r : null } catch { return null }
}
export function svHunt(s: BrilliancyState) {
  try { localStorage.setItem(HUNT_KEY, JSON.stringify(s)) } catch {}
}

function todayKeyLocal() {
  const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function daysSinceEpochLocal() {
  return Math.floor(Date.now() / 86400000);
}
function pickIdx(total: number) {
  if (total <= 0) return 0;
  const n = daysSinceEpochLocal();
  let h = n * 2654435761; h = (h ^ (h >>> 16)) >>> 0;
  return h % total;
}

// Get today's hunt; create a new state if needed.
export function todayHunt(): { hunt: BrilliancyHunt; state: BrilliancyState; isNew: boolean } {
  const idx = pickIdx(BRILLIANCIES.length);
  const today = todayKeyLocal();
  const prev = ldHunt();
  if (prev && prev.date === today) {
    return { hunt: BRILLIANCIES[prev.idx], state: prev, isNew: false };
  }
  // Update streak: if yesterday was solved → +1, else reset to 0 (about to do today)
  let newStreak = 0;
  let bestStreak = prev?.bestStreak || 0;
  if (prev) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    if (prev.date === yk && prev.solved) newStreak = prev.streak;
    // else: missed yesterday or didn't solve → streak=0
  }
  const next: BrilliancyState = {
    v: 1, date: today, idx, attempts: 0, solved: false, hintShown: false, givenUp: false,
    history: prev?.history || [], streak: newStreak, bestStreak,
  };
  svHunt(next);
  return { hunt: BRILLIANCIES[idx], state: next, isNew: true };
}

// Apply a guess, returns updated state + verdict.
export function applyGuess(hunt: BrilliancyHunt, state: BrilliancyState, sanInput: string): { state: BrilliancyState; correct: boolean; reward: number } {
  if (state.solved || state.givenUp) return { state, correct: false, reward: 0 };
  const acc = [hunt.solutionSan, ...(hunt.altSans || [])].map(s => s.replace(/[+#]/g, ""));
  const cleaned = sanInput.replace(/[+#]/g, "");
  const correct = acc.some(a => a === cleaned);
  const next: BrilliancyState = { ...state, attempts: state.attempts + 1 };
  let reward = 0;
  if (correct) {
    next.solved = true;
    next.streak = state.streak + 1;
    next.bestStreak = Math.max(state.bestStreak, next.streak);
    next.history = [{ date: state.date, idx: state.idx, solved: true, attempts: next.attempts }, ...state.history].slice(0, 30);
    // Reward: scaled by difficulty + first-try bonus
    const baseRewards = { 1: 20, 2: 30, 3: 50, 4: 80, 5: 120 } as const;
    reward = baseRewards[hunt.difficulty];
    if (next.attempts === 1) reward += 30;
    else if (next.attempts === 2) reward += 15;
    if (state.hintShown) reward = Math.round(reward * 0.6);
    // Streak bonus
    if (next.streak >= 7) reward += 50;
    else if (next.streak >= 3) reward += 20;
  }
  svHunt(next);
  return { state: next, correct, reward };
}

export function showHint(hunt: BrilliancyHunt, state: BrilliancyState): BrilliancyState {
  if (state.hintShown) return state;
  const next = { ...state, hintShown: true };
  svHunt(next);
  return next;
}

export function giveUp(hunt: BrilliancyHunt, state: BrilliancyState): BrilliancyState {
  if (state.solved || state.givenUp) return state;
  const next: BrilliancyState = {
    ...state, givenUp: true,
    history: [{ date: state.date, idx: state.idx, solved: false, attempts: state.attempts }, ...state.history].slice(0, 30),
    streak: 0,
  };
  svHunt(next);
  return next;
}

// Hint heuristic: name the piece + starting square
export function hintFor(hunt: BrilliancyHunt): string {
  const san = hunt.solutionSan.replace(/[+#]/g, "");
  if (san.startsWith("O-O-O")) return "Длинная рокировка.";
  if (san.startsWith("O-O")) return "Короткая рокировка.";
  // Pawn moves are lowercase first char
  if (/^[a-h]/.test(san)) {
    const file = san[0];
    return `Пешечный ход на вертикали ${file}.`;
  }
  const piece = san[0];
  const map: Record<string, string> = { K: "королём", Q: "ферзём", R: "ладьёй", B: "слоном", N: "конём" };
  return `Ход ${map[piece] || piece}. ${san.includes("x") ? "Со взятием!" : "Тихий ход."}`;
}

// Simulated leaderboard for today's hunt — deterministic stats per day.
export function simulatedLeaderboard(idx: number): { players: number; solved: number; avgAttempts: number; topPercent: number } {
  // Deterministic but varied per day
  const seed = idx * 31337 + Math.floor(Date.now() / 86400000);
  const rng = (n: number) => Math.abs((seed * 9301 + n * 49297) % 233280) / 233280;
  const players = 2000 + Math.floor(rng(1) * 5000);
  const solved = Math.floor(players * (0.18 + rng(2) * 0.45));
  const avgAttempts = +(2.1 + rng(3) * 1.8).toFixed(1);
  const topPercent = +((solved / players) * 100).toFixed(1);
  return { players, solved, avgAttempts, topPercent };
}
