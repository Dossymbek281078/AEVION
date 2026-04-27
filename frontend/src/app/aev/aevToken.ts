// AEV — AEVION native token. Multi-mode emission with three live engines:
//
//  A. Proof-of-Play         — токен начисляется за проверяемые действия в продуктах
//                             AEVION (партии CyberChess, подписи QSign, регистрации
//                             прав в QRight, проверки в Bureau, handoff в Multichat).
//  B. Proof-of-Useful-Compute — токен начисляется за реально выполненные compute-юниты
//                               (моделируется как симуляция AI-агента, в реале — workload).
//  C. Proof-of-Stewardship  — никакого «майнинга»: только staking. Застейканный AEV
//                             начисляет dividend на каждый epoch (модель «доход держателя»).
//
// Все три движка живут в одном wallet'е и могут работать одновременно или раздельно.
// Хард-кап supply, чтобы не было гипер-инфляции, и каждый mint() режется при достижении кэпа.

const WALLET_KEY = "aevion_aev_wallet_v1";

export type EmissionMode = "play" | "compute" | "stewardship";

export type RewardSource =
  | { kind: "play"; module: PlayModule; action: string }
  | { kind: "compute"; agent: string; units: number }
  | { kind: "stewardship"; epochs: number }
  | { kind: "trade"; pair: string; side: "buy" | "sell" }
  | { kind: "spend"; what: string }
  | { kind: "stake"; verb: "lock" | "unlock" }
  | { kind: "custom"; tag: string };

export type PlayModule =
  | "cyberchess"
  | "qsign"
  | "qright"
  | "bureau"
  | "multichat"
  | "qtrade"
  | "qcoreai";

export type MiningEvent = {
  id: string;
  ts: number;
  source: RewardSource;
  amount: number;       // mint > 0; spend / stake-lock < 0
  reason: string;
  balanceAfter: number;
};

export type StakeEntry = {
  id: string;
  amount: number;
  startTs: number;
  lastDividendTs: number;
};

export type StreakState = {
  current: number;        // текущий streak (дней)
  longest: number;        // лучший за всю историю
  lastDayKey: string;     // YYYY-MM-DD когда был последний claim
  totalClaims: number;
};

export type AEVWallet = {
  v: 1;
  balance: number;
  lifetimeMined: number;
  lifetimeSpent: number;
  globalSupplyMined: number;       // сколько всего сэмиттилось во всех модулях у этого юзера
  modes: Record<EmissionMode, boolean>;
  stake: StakeEntry[];
  recent: MiningEvent[];           // last 80 ивентов
  startTs: number;
  dividendsClaimed: number;
  streak?: StreakState;            // optional для backward-compat со старыми кошельками
};

const DEFAULT_WALLET: AEVWallet = {
  v: 1,
  balance: 0,
  lifetimeMined: 0,
  lifetimeSpent: 0,
  globalSupplyMined: 0,
  modes: { play: true, compute: false, stewardship: true },
  stake: [],
  recent: [],
  startTs: Date.now(),
  dividendsClaimed: 0,
};

// ─── Rate card ────────────────────────────────────────────────────
// Базовая «стоимость» каждого действия в AEV. Менять через issuance-policy proposals.
export const RATE_CARD = {
  play: {
    cyberchess_win_easy:    { aev: 0.4, label: "CyberChess · победа над Beginner/Casual" },
    cyberchess_win_med:     { aev: 1.5, label: "CyberChess · победа над Club/Advanced" },
    cyberchess_win_hard:    { aev: 4.0, label: "CyberChess · победа над Expert/Master" },
    cyberchess_puzzle:      { aev: 0.2, label: "CyberChess · решённый пазл" },
    cyberchess_puzzle_rush: { aev: 1.0, label: "CyberChess · Puzzle Rush финал" },
    cyberchess_brilliant:   { aev: 1.5, label: "CyberChess · brilliant move в партии" },
    cyberchess_blunder_fix: { aev: 0.8, label: "CyberChess · переигран свой блундер" },
    qsign_sign:             { aev: 1.5, label: "QSign · подпись документа" },
    qsign_verify:           { aev: 0.5, label: "QSign · подтверждённая верификация" },
    qright_register:        { aev: 2.5, label: "QRight · зарегистрировано право" },
    bureau_verify:          { aev: 1.0, label: "Bureau · бизнес-верификация" },
    multichat_handoff:      { aev: 0.15, label: "Multichat · корректный handoff между LLM" },
    qtrade_close_winning:   { aev: 0.4, label: "QTrade · закрыта прибыльная позиция" },
    qcore_run_complete:     { aev: 0.3, label: "QCoreAI · run агента завершился" },
  },
  compute: {
    perUnit: 0.05,         // AEV за 1 «compute-unit» (≈ 1 GPU-минута)
    minBatch: 1,
    maxBatch: 200,
  },
  stewardship: {
    apyAnnual: 0.072,      // 7.2% APY при стейкинге
    epochSeconds: 300,     // эмиссия dividend раз в 5 минут (для ощутимого pulse'а в UI)
    minStake: 1,
  },
  streak: {
    base: 0.1,             // AEV за обычный день
    week7Bonus: 1.0,       // дополнительный бонус на 7-дневный milestone
    month30Bonus: 5.0,     // на 30-дневный
    century100Bonus: 25.0, // на 100-дневный
    multiplierPerWeek: 0.05, // +5% за каждую завершённую неделю streak'а
    maxMultiplier: 2.0,    // capped 2x чтобы не разносило
  },
  // Хард-кап как у BTC — психологически удобно
  totalSupplyCap: 21_000_000,
} as const;

export type PlayAction = keyof typeof RATE_CARD.play;

// ─── Persistence ──────────────────────────────────────────────────
export function ldWallet(): AEVWallet {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(WALLET_KEY) : null;
    if (!s) return { ...DEFAULT_WALLET, startTs: Date.now() };
    const r = JSON.parse(s);
    if (!r || r.v !== 1) return { ...DEFAULT_WALLET, startTs: Date.now() };
    return {
      ...DEFAULT_WALLET,
      ...r,
      modes: { ...DEFAULT_WALLET.modes, ...(r.modes || {}) },
      stake: Array.isArray(r.stake) ? r.stake : [],
      recent: Array.isArray(r.recent) ? r.recent : [],
    };
  } catch { return { ...DEFAULT_WALLET, startTs: Date.now() } }
}

export function svWallet(w: AEVWallet) {
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(w)) } catch {}
}

// ─── Internal helpers ─────────────────────────────────────────────
function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushEvent(w: AEVWallet, e: MiningEvent): AEVWallet {
  const recent = [e, ...w.recent].slice(0, 80);
  return { ...w, recent };
}

// ─── Mint / spend ─────────────────────────────────────────────────
// Mint clamps against the global supply cap; if cap reached → returns wallet unchanged.
export function mint(w: AEVWallet, requestedAmount: number, source: RewardSource, reason: string): AEVWallet {
  if (requestedAmount <= 0) return w;
  const remainingCap = Math.max(0, RATE_CARD.totalSupplyCap - w.globalSupplyMined);
  const amount = Math.min(requestedAmount, remainingCap);
  if (amount <= 0) return w;
  const next: AEVWallet = {
    ...w,
    balance: w.balance + amount,
    lifetimeMined: w.lifetimeMined + amount,
    globalSupplyMined: w.globalSupplyMined + amount,
  };
  return pushEvent(next, {
    id: uid(), ts: Date.now(), source, amount, reason, balanceAfter: next.balance,
  });
}

export function spend(w: AEVWallet, amount: number, reason: string): AEVWallet | null {
  if (amount <= 0) return w;
  if (w.balance < amount) return null;
  const next: AEVWallet = {
    ...w,
    balance: w.balance - amount,
    lifetimeSpent: w.lifetimeSpent + amount,
  };
  return pushEvent(next, {
    id: uid(), ts: Date.now(), source: { kind: "spend", what: reason }, amount: -amount, reason, balanceAfter: next.balance,
  });
}

// ─── A. Proof-of-Play ─────────────────────────────────────────────
export function recordPlay(w: AEVWallet, action: PlayAction, module: PlayModule = "cyberchess", overrideAev?: number): AEVWallet {
  if (!w.modes.play) return w;
  const card = RATE_CARD.play[action];
  if (!card) return w;
  const aev = overrideAev ?? card.aev;
  return mint(w, aev, { kind: "play", module, action }, card.label);
}

// ─── B. Proof-of-Useful-Compute ───────────────────────────────────
// Симулируется как «работа AI-агента»: за каждый завершённый compute-unit капает aev.
export function recordCompute(w: AEVWallet, agent: string, units: number): AEVWallet {
  if (!w.modes.compute) return w;
  const u = Math.min(RATE_CARD.compute.maxBatch, Math.max(0, Math.floor(units)));
  if (u < RATE_CARD.compute.minBatch) return w;
  const aev = u * RATE_CARD.compute.perUnit;
  return mint(w, aev, { kind: "compute", agent, units: u }, `${agent} · ${u} compute-units`);
}

// ─── C. Proof-of-Stewardship ──────────────────────────────────────
export function stake(w: AEVWallet, amount: number): AEVWallet | null {
  if (!w.modes.stewardship) return null;
  if (amount < RATE_CARD.stewardship.minStake) return null;
  if (w.balance < amount) return null;
  const entry: StakeEntry = { id: uid(), amount, startTs: Date.now(), lastDividendTs: Date.now() };
  const next: AEVWallet = {
    ...w,
    balance: w.balance - amount,
    stake: [entry, ...w.stake],
  };
  return pushEvent(next, {
    id: uid(), ts: Date.now(),
    source: { kind: "stake", verb: "lock" },
    amount: -amount,
    reason: `Lock ${amount.toFixed(4)} AEV в stewardship`,
    balanceAfter: next.balance,
  });
}

export function unstake(w: AEVWallet, id: string): AEVWallet {
  const entry = w.stake.find((s) => s.id === id);
  if (!entry) return w;
  const next: AEVWallet = {
    ...w,
    balance: w.balance + entry.amount,
    stake: w.stake.filter((s) => s.id !== id),
  };
  return pushEvent(next, {
    id: uid(), ts: Date.now(),
    source: { kind: "stake", verb: "unlock" },
    amount: entry.amount,
    reason: `Unlock ${entry.amount.toFixed(4)} AEV из stewardship`,
    balanceAfter: next.balance,
  });
}

export function totalStaked(w: AEVWallet): number {
  return w.stake.reduce((s, x) => s + x.amount, 0);
}

// Pending dividend = staked × (APY / yearSeconds) × elapsedSeconds, накопленный с
// последней claim'а. Считаем поэнтри, чтобы новый стейк не получил дивиденд за время до lock.
export function pendingDividend(w: AEVWallet, now = Date.now()): number {
  const apySec = RATE_CARD.stewardship.apyAnnual / (365 * 24 * 3600);
  let total = 0;
  for (const e of w.stake) {
    const dt = Math.max(0, (now - e.lastDividendTs) / 1000);
    total += e.amount * apySec * dt;
  }
  return total;
}

// Распределяет накопленный дивиденд в balance, обновляет lastDividendTs у всех стейков.
export function claimDividend(w: AEVWallet, now = Date.now()): AEVWallet {
  if (!w.modes.stewardship) return w;
  const apySec = RATE_CARD.stewardship.apyAnnual / (365 * 24 * 3600);
  let total = 0;
  let totalEpochs = 0;
  const newStake = w.stake.map((e) => {
    const dt = Math.max(0, (now - e.lastDividendTs) / 1000);
    total += e.amount * apySec * dt;
    totalEpochs += Math.floor(dt / RATE_CARD.stewardship.epochSeconds);
    return { ...e, lastDividendTs: now };
  });
  if (total <= 0) return w;
  const minted = mint(
    { ...w, stake: newStake },
    total,
    { kind: "stewardship", epochs: totalEpochs },
    `Dividend · ${totalEpochs} эпох × ${totalStaked(w).toFixed(2)} AEV staked`,
  );
  return { ...minted, dividendsClaimed: w.dividendsClaimed + total };
}

// ─── Mode toggles ─────────────────────────────────────────────────
export function setMode(w: AEVWallet, mode: EmissionMode, on: boolean): AEVWallet {
  return { ...w, modes: { ...w.modes, [mode]: on } };
}

// ─── D. Proof-of-Curation ─────────────────────────────────────────
// AEV за курирование на платформе: pin своих лучших партий/пазлов/трейдов,
// peer-review других пользователей. Anti-spam через дневной лимит pin'ов.

const PINS_KEY = "aevion_aev_pins_v1";

export type PinKind = "game" | "puzzle" | "trade" | "quote" | "position" | "guide";

export type PinnedItem = {
  id: string;
  kind: PinKind;
  title: string;
  note?: string;
  link?: string;
  ts: number;
  upvotes: number;       // peer-review (mock — увеличивается со временем)
};

export const CURATION = {
  perPinAev: 0.5,          // базовая награда за pin
  upvoteBonusAev: 0.05,    // бонус когда твой pin получает upvote (от другого юзера)
  dailyPinLimit: 5,        // anti-spam: максимум 5 pin'ов в день
  maxPins: 50,             // total cap
} as const;

export function ldPins(): PinnedItem[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(PINS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as PinnedItem[] : [];
  } catch { return [] }
}

export function svPins(p: PinnedItem[]) {
  try { localStorage.setItem(PINS_KEY, JSON.stringify(p.slice(0, CURATION.maxPins))) } catch {}
}

export function pinsToday(pins: PinnedItem[]): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return pins.filter((p) => p.ts >= start.getTime()).length;
}

// Add a curation pin. Returns null if daily limit hit. Mints +CURATION.perPinAev.
export function recordPin(
  w: AEVWallet,
  pins: PinnedItem[],
  draft: { kind: PinKind; title: string; note?: string; link?: string },
): { wallet: AEVWallet; pins: PinnedItem[] } | { error: string } {
  if (pinsToday(pins) >= CURATION.dailyPinLimit) {
    return { error: `Дневной лимит ${CURATION.dailyPinLimit} pin'ов исчерпан · возвращайся завтра` };
  }
  if (!draft.title.trim()) return { error: "Title обязателен" };
  const item: PinnedItem = {
    id: `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    kind: draft.kind,
    title: draft.title.trim().slice(0, 120),
    note: draft.note?.trim().slice(0, 240),
    link: draft.link?.trim().slice(0, 200),
    ts: Date.now(),
    upvotes: 0,
  };
  const newPins = [item, ...pins].slice(0, CURATION.maxPins);
  const newWallet = mint(
    w,
    CURATION.perPinAev,
    { kind: "play", module: "qcoreai", action: "curation_pin" },
    `🧭 Curation: ${draft.kind} · ${item.title.slice(0, 40)}`,
  );
  return { wallet: newWallet, pins: newPins };
}

export function removePin(pins: PinnedItem[], id: string): PinnedItem[] {
  return pins.filter((p) => p.id !== id);
}

// Симуляция peer-review: время от времени pin получает upvote, и автору капает бонус.
// В продакшне будет реальный upvote от другого юзера через API.
export function simulateUpvote(
  w: AEVWallet,
  pins: PinnedItem[],
  pinId: string,
): { wallet: AEVWallet; pins: PinnedItem[] } {
  const target = pins.find((p) => p.id === pinId);
  if (!target) return { wallet: w, pins };
  const newPins = pins.map((p) => p.id === pinId ? { ...p, upvotes: p.upvotes + 1 } : p);
  const newWallet = mint(
    w,
    CURATION.upvoteBonusAev,
    { kind: "play", module: "qcoreai", action: "curation_upvote" },
    `👍 Upvote получен · ${target.title.slice(0, 40)}`,
  );
  return { wallet: newWallet, pins: newPins };
}

// ─── G. Proof-of-Network ──────────────────────────────────────────
// Invite chain: ты приглашаешь юзера через свой code, приглашённый совершает
// quality actions, ты получаешь % от его эмиссии (downstream royalty).
// Симулируется на клиенте: simulateInviteJoin добавляет mock-друга, а
// simulateInviteActivity — каждый "tick" этого друга что-то майнит, и нам капает.

const NETWORK_KEY = "aevion_aev_network_v1";

export type InvitedUser = {
  id: string;            // mock-id (стабильный)
  name: string;          // имя для UI
  city?: string;
  joinedTs: number;
  qualityActions: number; // сколько quality-actions совершил downstream user
  earnedFromMe: number;   // сколько AEV ты получил downstream от него
};

export type NetworkState = {
  v: 1;
  myCode: string;        // 8-char inviting code (стабильный для юзера)
  invited: InvitedUser[];
  totalDownstreamEarned: number;
};

export const NETWORK = {
  royaltyPct: 0.10,        // 10% от downstream activity капает upstream'у
  perActionAev: 0.4,       // средний AEV за quality action приглашённого
  maxInvites: 50,
  // Псевдо-стабильные имена для симуляции активности приглашённых
  cities: ["Алматы", "Астана", "Шымкент", "Караганда", "Актобе", "Атырау", "Туркестан", "Тараз"],
  firstNames: ["Айгерим", "Ержан", "Дамир", "Айдос", "Алина", "Нурлан", "Зарина", "Михаил", "Виктор", "Светлана", "Алмас", "Гульнара"],
} as const;

export function ldNetwork(): NetworkState {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(NETWORK_KEY) : null;
    if (!s) return makeNetwork();
    const r = JSON.parse(s);
    if (!r || r.v !== 1 || !r.myCode) return makeNetwork();
    return {
      v: 1,
      myCode: r.myCode,
      invited: Array.isArray(r.invited) ? r.invited : [],
      totalDownstreamEarned: typeof r.totalDownstreamEarned === "number" ? r.totalDownstreamEarned : 0,
    };
  } catch { return makeNetwork() }
}

function makeNetwork(): NetworkState {
  // Stable code from a Crockford-friendly alphabet (no I/O/0/1 для ясности)
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "AEV-";
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return { v: 1, myCode: code, invited: [], totalDownstreamEarned: 0 };
}

export function svNetwork(n: NetworkState) {
  try { localStorage.setItem(NETWORK_KEY, JSON.stringify(n)) } catch {}
}

// Invite a (mock) user: appends to invited list. No AEV minted yet — friend
// must DO something quality-actions first.
export function simulateInviteJoin(n: NetworkState, name?: string): NetworkState {
  if (n.invited.length >= NETWORK.maxInvites) return n;
  const fname = name?.trim() || NETWORK.firstNames[Math.floor(Math.random() * NETWORK.firstNames.length)];
  const city = NETWORK.cities[Math.floor(Math.random() * NETWORK.cities.length)];
  const id = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const u: InvitedUser = {
    id,
    name: fname,
    city,
    joinedTs: Date.now(),
    qualityActions: 0,
    earnedFromMe: 0,
  };
  return { ...n, invited: [u, ...n.invited] };
}

// Simulate downstream activity: pick one invited user, increment their actions,
// mint royalty to upstream wallet. Returns next wallet + next network. If no
// invitees yet, no-op.
export function simulateNetworkTick(
  w: AEVWallet,
  n: NetworkState,
  forceUserId?: string,
): { wallet: AEVWallet; network: NetworkState } {
  if (n.invited.length === 0) return { wallet: w, network: n };
  const target = forceUserId
    ? n.invited.find((u) => u.id === forceUserId)
    : n.invited[Math.floor(Math.random() * n.invited.length)];
  if (!target) return { wallet: w, network: n };
  const royalty = NETWORK.perActionAev * NETWORK.royaltyPct;
  const newWallet = mint(
    w,
    royalty,
    { kind: "play", module: "qcoreai", action: "network_royalty" },
    `🌐 Royalty от ${target.name} · ${target.city ?? "?"}`,
  );
  const newInvited = n.invited.map((u) =>
    u.id === target.id
      ? { ...u, qualityActions: u.qualityActions + 1, earnedFromMe: u.earnedFromMe + royalty }
      : u,
  );
  return {
    wallet: newWallet,
    network: {
      ...n,
      invited: newInvited,
      totalDownstreamEarned: n.totalDownstreamEarned + royalty,
    },
  };
}

export function removeInvited(n: NetworkState, id: string): NetworkState {
  return { ...n, invited: n.invited.filter((u) => u.id !== id) };
}

// ─── E. Proof-of-Mentorship ───────────────────────────────────────
// Ты — mentor; у тебя есть students. Каждый student имеет рейтинг,
// который тикает со временем (биас к upward). Когда student пересекает
// rating-milestone (каждые 100 пунктов от 1300), mentor получает AEV.
// Чем больше students прогрессируют — тем больше AEV mentor'у.

const MENTOR_KEY = "aevion_aev_mentorship_v1";

export type Student = {
  id: string;
  name: string;
  startRating: number;
  rating: number;
  startTs: number;
  lastTickTs: number;
  passedMilestones: number[];   // массив милестоунов которые student уже прошёл
  earnedFromMe: number;         // сколько AEV mentor получил с этого студента
};

export type MentorshipState = {
  v: 1;
  students: Student[];
  totalEarned: number;
};

export const MENTORSHIP = {
  perMilestoneAev: 0.5,         // AEV mentor'у когда student пересекает milestone
  milestoneStep: 100,           // каждые +100 рейтинга = milestone (1300, 1400, ...)
  startMilestone: 1300,         // первый milestone
  maxStudents: 30,
  ratingTickMs: 18_000,         // каждые 18s rating студента ticks
  ratingDriftPerTick: 6,        // средний прогресс +6 рейтинга за tick
  ratingNoise: 14,              // случайность ±
  defaultStartRating: 1200,
  // Имена для генерации
  firstNames: ["Бахытжан", "Айдана", "Ермек", "Сабина", "Канат", "Жанна", "Айбек", "Мадина", "Тимур", "Лейла", "Ринат", "Карина"],
} as const;

export function ldMentorship(): MentorshipState {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(MENTOR_KEY) : null;
    if (!s) return { v: 1, students: [], totalEarned: 0 };
    const r = JSON.parse(s);
    if (!r || r.v !== 1) return { v: 1, students: [], totalEarned: 0 };
    return {
      v: 1,
      students: Array.isArray(r.students) ? r.students.map((s: Student) => ({
        ...s,
        passedMilestones: Array.isArray(s.passedMilestones) ? s.passedMilestones : [],
      })) : [],
      totalEarned: typeof r.totalEarned === "number" ? r.totalEarned : 0,
    };
  } catch { return { v: 1, students: [], totalEarned: 0 } }
}

export function svMentorship(m: MentorshipState) {
  try { localStorage.setItem(MENTOR_KEY, JSON.stringify(m)) } catch {}
}

export function addStudent(m: MentorshipState, name?: string, startRating?: number): MentorshipState {
  if (m.students.length >= MENTORSHIP.maxStudents) return m;
  const fname = name?.trim() || MENTORSHIP.firstNames[Math.floor(Math.random() * MENTORSHIP.firstNames.length)];
  const id = `stu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const r = startRating ?? MENTORSHIP.defaultStartRating;
  const student: Student = {
    id,
    name: fname,
    startRating: r,
    rating: r,
    startTs: Date.now(),
    lastTickTs: Date.now(),
    passedMilestones: [],
    earnedFromMe: 0,
  };
  return { ...m, students: [student, ...m.students] };
}

export function removeStudent(m: MentorshipState, id: string): MentorshipState {
  return { ...m, students: m.students.filter((s) => s.id !== id) };
}

// Tick all students: progress rating, mint AEV per milestone crossed.
// Return new wallet + new mentorship state. Ticks each student independently
// based on elapsed time since lastTickTs (no missed ticks even if tab closed).
export function tickStudents(w: AEVWallet, m: MentorshipState): { wallet: AEVWallet; mentorship: MentorshipState } {
  if (m.students.length === 0) return { wallet: w, mentorship: m };
  const now = Date.now();
  let curWallet = w;
  let totalNewEarned = 0;
  const newStudents = m.students.map((s) => {
    const elapsed = now - s.lastTickTs;
    if (elapsed < MENTORSHIP.ratingTickMs) return s;
    const ticks = Math.floor(elapsed / MENTORSHIP.ratingTickMs);
    let rating = s.rating;
    for (let i = 0; i < ticks; i++) {
      const change = MENTORSHIP.ratingDriftPerTick + (Math.random() - 0.5) * MENTORSHIP.ratingNoise * 2;
      rating = Math.max(800, Math.min(2800, rating + change));
    }
    rating = Math.round(rating);
    // Detect new milestones crossed
    const milestones: number[] = [];
    for (let mm = MENTORSHIP.startMilestone; mm <= 2500; mm += MENTORSHIP.milestoneStep) {
      if (rating >= mm && !s.passedMilestones.includes(mm)) milestones.push(mm);
    }
    let earned = 0;
    if (milestones.length > 0) {
      for (const mm of milestones) {
        const reward = MENTORSHIP.perMilestoneAev;
        curWallet = mint(
          curWallet,
          reward,
          { kind: "play", module: "qcoreai", action: "mentorship_milestone" },
          `🎓 ${s.name} достиг рейтинга ${mm}`,
        );
        earned += reward;
      }
      totalNewEarned += earned;
    }
    return {
      ...s,
      rating,
      lastTickTs: s.lastTickTs + ticks * MENTORSHIP.ratingTickMs,
      passedMilestones: [...s.passedMilestones, ...milestones],
      earnedFromMe: s.earnedFromMe + earned,
    };
  });
  return {
    wallet: curWallet,
    mentorship: {
      ...m,
      students: newStudents,
      totalEarned: m.totalEarned + totalNewEarned,
    },
  };
}

// ─── F. Proof-of-Streak ───────────────────────────────────────────
function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  // Both keys are YYYY-MM-DD; produce day-difference accounting for tz-naive midnight.
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

// Returns null if user has already claimed today (no-op). Otherwise returns the
// updated wallet with bumped streak + minted reward + event in feed.
export function recordDailyVisit(w: AEVWallet, now = new Date()): AEVWallet | null {
  const today = dayKey(now);
  const cur = w.streak ?? { current: 0, longest: 0, lastDayKey: "", totalClaims: 0 };
  if (cur.lastDayKey === today) return null; // уже клеймили сегодня
  const gap = cur.lastDayKey ? daysBetween(cur.lastDayKey, today) : 1;
  const newCurrent = gap === 1 ? cur.current + 1 : 1; // если пропустил день+ — reset на 1
  const longest = Math.max(cur.longest, newCurrent);
  // Reward = base × (1 + multiplierPerWeek × completedWeeks), clamped
  const completedWeeks = Math.floor(newCurrent / 7);
  const mult = Math.min(
    RATE_CARD.streak.maxMultiplier,
    1 + RATE_CARD.streak.multiplierPerWeek * completedWeeks,
  );
  let reward = RATE_CARD.streak.base * mult;
  // Milestone bonuses (additive)
  let milestone = "";
  if (newCurrent === 7) { reward += RATE_CARD.streak.week7Bonus; milestone = "🔥 неделя без пропусков" }
  else if (newCurrent === 30) { reward += RATE_CARD.streak.month30Bonus; milestone = "🚀 30 дней — milestone" }
  else if (newCurrent === 100) { reward += RATE_CARD.streak.century100Bonus; milestone = "👑 100 дней — век" }
  const reason = milestone
    ? `${milestone} · day ${newCurrent}`
    : `Streak day ${newCurrent} · ×${mult.toFixed(2)}`;
  const updated: AEVWallet = {
    ...w,
    streak: {
      current: newCurrent,
      longest,
      lastDayKey: today,
      totalClaims: cur.totalClaims + 1,
    },
  };
  return mint(updated, reward, { kind: "play", module: "qtrade", action: "streak" }, reason);
}

export function previewStreakReward(w: AEVWallet): number {
  const today = dayKey();
  const cur = w.streak ?? { current: 0, longest: 0, lastDayKey: "", totalClaims: 0 };
  if (cur.lastDayKey === today) return 0;
  const gap = cur.lastDayKey ? daysBetween(cur.lastDayKey, today) : 1;
  const newCurrent = gap === 1 ? cur.current + 1 : 1;
  const completedWeeks = Math.floor(newCurrent / 7);
  const mult = Math.min(
    RATE_CARD.streak.maxMultiplier,
    1 + RATE_CARD.streak.multiplierPerWeek * completedWeeks,
  );
  let reward = RATE_CARD.streak.base * mult;
  if (newCurrent === 7) reward += RATE_CARD.streak.week7Bonus;
  else if (newCurrent === 30) reward += RATE_CARD.streak.month30Bonus;
  else if (newCurrent === 100) reward += RATE_CARD.streak.century100Bonus;
  return reward;
}

// ─── QTrade integration helpers ───────────────────────────────────
// Sell AEV at simulated price → debits balance, returns USD-equivalent (not deposited
// anywhere yet, just shows up in event log; backend mock).
export function sellAev(w: AEVWallet, amount: number, atPrice: number): AEVWallet | null {
  if (amount <= 0 || w.balance < amount) return null;
  const usd = amount * atPrice;
  const next: AEVWallet = {
    ...w,
    balance: w.balance - amount,
    lifetimeSpent: w.lifetimeSpent + amount,
  };
  return pushEvent(next, {
    id: uid(), ts: Date.now(),
    source: { kind: "trade", pair: "AEV/USD", side: "sell" },
    amount: -amount,
    reason: `Продано ${amount.toFixed(4)} AEV @ $${atPrice.toFixed(4)} ≈ $${usd.toFixed(2)}`,
    balanceAfter: next.balance,
  });
}

export function buyAev(w: AEVWallet, amount: number, atPrice: number): AEVWallet {
  if (amount <= 0) return w;
  // Buying AEV from QTrade — это не майнинг, это circulating supply, не прибавляем
  // к globalSupplyMined.
  const next: AEVWallet = { ...w, balance: w.balance + amount };
  const usd = amount * atPrice;
  return pushEvent(next, {
    id: uid(), ts: Date.now(),
    source: { kind: "trade", pair: "AEV/USD", side: "buy" },
    amount,
    reason: `Куплено ${amount.toFixed(4)} AEV @ $${atPrice.toFixed(4)} ≈ $${usd.toFixed(2)}`,
    balanceAfter: next.balance,
  });
}

// ─── Formatting ───────────────────────────────────────────────────
export function fmtAev(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} AEV`;
}

export function fmtSupplyPct(w: AEVWallet): string {
  const pct = (w.globalSupplyMined / RATE_CARD.totalSupplyCap) * 100;
  return `${pct.toFixed(8)}% от cap`;
}
