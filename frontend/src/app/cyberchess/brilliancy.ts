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
    title: "Бессмертная партия — мат без ферзя и ладей",
    fen: "r1bk3r/p2p1pNp/n2B1n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 w - - 0 23",
    side: "w",
    solutionSan: "Be7#",
    altSans: ["Be7"],
    story: "Андерссен — Кизерицкий, Лондон 1851. Белые отдали обе ладьи и ферзя. Осталось три лёгких фигуры — и этого хватит.",
    year: 1851,
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    difficulty: 2,
  },
  {
    id: "evergreen-anderssen",
    title: "Вечнозелёная партия — вызов королю",
    fen: "1r2k1r1/pbppnp1p/1b3P2/8/Q7/B1PB1q2/P4PPP/3R2K1 w - - 0 21",
    side: "w",
    solutionSan: "Qxd7+",
    altSans: ["Qxd7"],
    story: "Андерссен — Дюфрен, Берлин 1852. Чёрные грозят матом на g2. Белые начинают с того, что отдают ферзя.",
    year: 1852,
    white: "Adolf Anderssen",
    black: "Jean Dufresne",
    difficulty: 4,
  },
  {
    id: "morphy-opera",
    title: "Опера в Париже — Морфи опускает занавес",
    fen: "4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16",
    side: "w",
    solutionSan: "Qb8+",
    altSans: ["Qb8"],
    story: "Морфи — герцог Брауншвейгский и граф Изуар, Париж 1858. Партия игралась в ложе во время «Севильского цирюльника».",
    year: 1858,
    white: "Paul Morphy",
    black: "Duke of Brunswick & Count Isouard",
    difficulty: 2,
  },
  {
    id: "byrne-fischer-56",
    title: "Партия века — 13-летний Фишер",
    fen: "r3r1k1/pp3pbp/1qp3p1/2B5/2BP2b1/Q1n2N2/P4PPP/3R1K1R b - - 3 17",
    side: "b",
    solutionSan: "Be6",
    altSans: [],
    story: "Бирн — Фишер, Нью-Йорк 1956. Ферзь под боем, но тихий ход слоном сильнее любого шаха.",
    year: 1956,
    white: "Donald Byrne",
    black: "Bobby Fischer",
    difficulty: 5,
  },
  {
    id: "byrne-fischer-63",
    title: "Фишер взрывает рокировку",
    fen: "r2qr1k1/p4pbp/bp3np1/3p4/8/BPNnP1P1/P1Q1NPBP/R2R2K1 b - - 3 15",
    side: "b",
    solutionSan: "Nxf2",
    altSans: [],
    story: "Бирн — Фишер, чемпионат США 1963. Комментаторы в соседнем зале решили, что чёрные просто зевнули фигуру.",
    year: 1963,
    white: "Robert Byrne",
    black: "Bobby Fischer",
    difficulty: 4,
  },
  {
    id: "rotlevi-rubinstein",
    title: "Бессмертная Рубинштейна",
    fen: "2rr2k1/1b3ppp/pb2p3/1p2P3/1P2BPnq/P1N3P1/1B2Q2P/R4R1K b - - 0 22",
    side: "b",
    solutionSan: "Rxc3",
    altSans: [],
    story: "Ротлеви — Рубинштейн, Лодзь 1907. Ферзь на h4 под боем — и чёрные бьют совсем другую фигуру.",
    year: 1907,
    white: "Georg Rotlewi",
    black: "Akiba Rubinstein",
    difficulty: 5,
  },
  {
    id: "lasker-bauer-89",
    title: "Двойная жертва слонов — первый слон",
    fen: "r4rk1/1b2bppp/ppq1p3/2ppB2n/5P2/1P1BP3/P1PPQ1PP/R4RK1 w - - 0 15",
    side: "w",
    solutionSan: "Bxh7+",
    altSans: ["Bxh7"],
    story: "Ласкер — Бауэр, Амстердам 1889. Шаблон, который с тех пор носит имя автора: сначала один слон, затем второй.",
    year: 1889,
    white: "Emanuel Lasker",
    black: "Johann Bauer",
    difficulty: 3,
  },
  {
    id: "lasker-thomas-12",
    title: "Король идёт через всю доску",
    fen: "rn3rk1/pbppq1pp/1p2pb2/4N2Q/3PN3/3B4/PPP2PPP/R3K2R w KQ - 6 11",
    side: "w",
    solutionSan: "Qxh7+",
    altSans: ["Qxh7"],
    story: "Эдвард Ласкер — Томас, Лондон 1912. Жертва ферзя, после которой чёрного короля гонят с h8 до g1.",
    year: 1912,
    white: "Edward Lasker",
    black: "George Thomas",
    difficulty: 3,
  },
  {
    id: "steinitz-bardeleben-95",
    title: "Стейниц — соперник ушёл из зала",
    fen: "r1r1k3/pp1qn2p/5pp1/3p2N1/6Q1/8/PP3PPP/2R1R1K1 w - - 2 22",
    side: "w",
    solutionSan: "Rxe7+",
    altSans: ["Rxe7"],
    story: "Стейниц — фон Барделебен, Гастингс 1895. Ладья под четырьмя боями и ни одного взятия нет.",
    year: 1895,
    white: "Wilhelm Steinitz",
    black: "Curt von Bardeleben",
    difficulty: 4,
  },
  {
    id: "kasparov-topalov-99",
    title: "Жемчужина Вейк-ан-Зее",
    fen: "b2r3r/k4p1p/p2q1np1/NppP4/3p1Q2/P4PPB/1PP4P/1K1RR3 w - - 1 24",
    side: "w",
    solutionSan: "Rxd4",
    altSans: [],
    story: "Каспаров — Топалов, 1999. Короля чёрных погонят с a7 до a4 — начало здесь.",
    year: 1999,
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    difficulty: 5,
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

export function todayKeyLocal(d: Date = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* Номер суток ПО МЕСТНОМУ календарю.
 *
 * Раньше здесь стояло `Math.floor(Date.now()/86400000)` под именем
 * daysSinceEpochLocal — имя обещало местное время, а формула считала UTC. Дата
 * состояния при этом бралась местная (todayKeyLocal), и две величины
 * переключались в разные моменты: для UTC+6 местная дата меняется в полночь,
 * а UTC-сутки — только в 6 утра.
 *
 * Что это давало игроку в Казахстане каждую ночь с 00:00 до 06:00: дата уже
 * новая, поэтому todayHunt() заводил новое состояние, но индекс задачи считался
 * по старым UTC-суткам — то есть выдавалась ВЧЕРАШНЯЯ задача, уже решённая, и
 * её повторное решение поднимало серию. Шесть часов в сутки, каждые сутки.
 *
 * Теперь номер суток переключается ровно тогда же, когда меняется строка даты.
 */
export function localDayNumber(d: Date = new Date()): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** Индекс задачи дня. Экспортирован ради теста связки «дата ↔ индекс». */
export function pickIdx(total: number, day: number = localDayNumber()) {
  if (total <= 0) return 0;
  let h = day * 2654435761; h = (h ^ (h >>> 16)) >>> 0;
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

/* This used to be `simulatedLeaderboard` — invented player counts and solve rates,
   seeded by the date, shown on screen beside the player's real streak with nothing to
   say they were made up. There is no server collecting hunt results, so there is no
   community number to show. What the player's own history does support is counted
   here instead: how many hunts they solved, and how many tries it took.

   `avgAttempts` counts only solved hunts — attempts on a hunt that was given up say
   how soon the player quit, not how hard the puzzle was. It is null until there is
   something to average. */
export function personalStats(state: BrilliancyState): {
  played: number;
  solved: number;
  solveRate: number | null;
  avgAttempts: number | null;
} {
  /* applyGuess and giveUp both push today's result into history the moment the hunt
     ends, so history is the whole record — appending today again would count it twice.
     It holds the last 30 hunts. */
  const rows = state.history;
  const played = rows.length;
  const won = rows.filter((r) => r.solved);
  const tries = won.reduce((a, r) => a + r.attempts, 0);
  return {
    played,
    solved: won.length,
    solveRate: played ? +((won.length / played) * 100).toFixed(0) : null,
    avgAttempts: won.length ? +(tries / won.length).toFixed(1) : null,
  };
}
