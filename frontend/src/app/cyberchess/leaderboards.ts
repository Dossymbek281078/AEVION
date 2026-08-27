// Симулированные лидерборды по категориям. Детерминированные данные на основе
// сидов — позволяет показывать «весь топ» без бэкенда. Юзер встраивается своим
// рейтингом (rat) и попадает на честное место в списке.

export type LbEntry = {
  rank: number;
  name: string;
  country: string;
  rating: number;
  games?: number;
  isMe?: boolean;
};

export type LbCategory = "blitz" | "rapid" | "bullet" | "puzzles" | "rush";

const FIRST_NAMES = [
  // Только выдуманные ники — намеренно, и вот почему.
  //
  // Раньше здесь стояли имена ЖИВЫХ гроссмейстеров, а в фамилиях — фамилии
  // чемпионов мира. Таблица при этом синтетическая (бэкенд отдаёт leaderboard
  // total=0), пометки «демо» на странице нет, а флаги подставляются независимым
  // индексом — то есть люди оказывались под чужими флагами. Получалось, что
  // страница показывает выдуманные результаты под именами реальных людей.
  //
  // Их собственный смоук cyberchess-prod-smoke это ловит и был красным на проде.
  // Настоящих имён здесь быть не должно: ни в этом массиве, ни в LAST_NAMES.
  "Cyber","Zen","Ghost","Nova","Pixel","Rocket","Shadow","Storm","Vortex","Phoenix",
  "Neo","Echo","Quantum","Zero","Apex","Blaze","Crash","Drift","Edge","Flash",
  "Onyx","Lumen","Raven","Delta","Karma","Vector","Prism","Nyx","Orbit","Rune",
  "Sable","Talon","Umbra","Vega","Wisp","Xeno","Yarrow","Zephyr","Aster","Bolt"
];

const LAST_NAMES = [
  // Тот же принцип: ни одной настоящей фамилии.
  "Wraith","Nightfall","Cipher","Specter","Cyclone","Tempest","Inferno","Maverick","Rogue","Solace",
  "Reverb","Glitch","Synthwave","Static","Verge","Surge","Blitzwave","Pulse","Fractal","Halcyon",
  "Ironside","Jetstream","Kilowatt","Lodestar","Mirage","Northwind","Obsidian","Paradox","Quicksilver","Riptide",
  "Sandstorm","Thunderhead","Updraft","Vanguard","Wavelength","Xenon","Yardarm","Zenith","Afterglow","Bedrock"
];

const COUNTRIES = ["🇳🇴","🇺🇸","🇮🇹","🇨🇳","🇷🇺","🇳🇱","🇺🇸","🇫🇷","🇦🇲","🇷🇺","🇷🇺","🇺🇿","🇨🇳","🇩🇪","🇮🇳","🇮🇳","🇮🇳","🇮🇷","🇦🇿","🇵🇱","🇰🇿","🇧🇾","🇺🇦","🇬🇪","🇧🇬"];

// Mulberry32 — детерминированный pseudo-random для стабильных данных по seed.
function mulberry32(a: number) {
  return function() {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const CATEGORY_TOP_RATING: Record<LbCategory, number> = {
  blitz: 3245,
  rapid: 2890,
  bullet: 3380,
  puzzles: 4120,
  rush: 95,
};

const CATEGORY_SEED: Record<LbCategory, number> = {
  blitz: 1001,
  rapid: 2002,
  bullet: 3003,
  puzzles: 4004,
  rush: 5005,
};

// Размер пула — 200 игроков на категорию.
const LB_SIZE = 200;

function genName(rng: () => number): string {
  const f = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${f} ${l}`;
}

function genCountry(rng: () => number): string {
  return COUNTRIES[Math.floor(rng() * COUNTRIES.length)];
}

// Build a stable simulated top for a category.
function buildTop(category: LbCategory): LbEntry[] {
  const rng = mulberry32(CATEGORY_SEED[category]);
  const topRating = CATEGORY_TOP_RATING[category];
  const list: LbEntry[] = [];
  let cur = topRating;
  for (let i = 0; i < LB_SIZE; i++) {
    // Падение рейтинга по экспоненте — реалистичная кривая лидерборда.
    if (i > 0) {
      const drop = i < 10 ? 8 + rng() * 12 : i < 50 ? 6 + rng() * 10 : 4 + rng() * 8;
      cur -= drop;
    }
    list.push({
      rank: i + 1,
      name: genName(rng),
      country: genCountry(rng),
      rating: Math.round(cur),
      games: Math.floor(500 + rng() * 8500),
    });
  }
  return list;
}

const _cache = new Map<LbCategory, LbEntry[]>();

export function getLeaderboard(category: LbCategory): LbEntry[] {
  let lb = _cache.get(category);
  if (!lb) { lb = buildTop(category); _cache.set(category, lb); }
  return lb;
}

// Найти позицию пользователя по его рейтингу в этой категории.
// Если рейтинг выше всех — позиция 1; если ниже всех — последняя+1.
export function findMyRank(category: LbCategory, myRating: number): number {
  const lb = getLeaderboard(category);
  for (let i = 0; i < lb.length; i++) {
    if (myRating >= lb[i].rating) return i + 1;
  }
  return lb.length + 1;
}

// Top N + me (с правильной позицией). Юзер вставляется как entry с isMe=true.
export function getTopWithMe(category: LbCategory, myRating: number, myName: string, topN = 3): LbEntry[] {
  const lb = getLeaderboard(category);
  const myRank = findMyRank(category, myRating);
  const top = lb.slice(0, topN).map(e => ({ ...e }));
  if (myRank <= topN) {
    // Юзер в топе — заменяем соответствующую позицию.
    const idx = myRank - 1;
    top[idx] = { rank: myRank, name: myName, country: "🎯", rating: myRating, isMe: true };
  } else {
    // Добавляем строку «...я» снизу.
    top.push({ rank: myRank, name: myName, country: "🎯", rating: myRating, isMe: true });
  }
  return top;
}

// Полный список вокруг моей позиции — для разворота «весь топ».
export function getFullBoardAroundMe(category: LbCategory, myRating: number, myName: string): LbEntry[] {
  const lb = getLeaderboard(category);
  const myRank = findMyRank(category, myRating);
  const out: LbEntry[] = lb.map(e => ({ ...e }));
  // Insert me at correct position. Если в пределах LB_SIZE — заменяем.
  if (myRank <= LB_SIZE) {
    out[myRank - 1] = { rank: myRank, name: myName, country: "🎯", rating: myRating, isMe: true };
  } else {
    out.push({ rank: myRank, name: myName, country: "🎯", rating: myRating, isMe: true });
  }
  return out;
}

export const CATEGORY_LABEL: Record<LbCategory, string> = {
  blitz: "⚡ Blitz",
  rapid: "🕐 Rapid",
  bullet: "💨 Bullet",
  puzzles: "🧩 Пазлы",
  rush: "🏃 Puzzle Rush",
};
