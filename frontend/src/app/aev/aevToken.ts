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
    qtrade_dca_run:         { aev: 0.05, label: "QTrade · DCA bot tick" },
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

// ─── H. Proof-of-Insight ──────────────────────────────────────────
// Ты задаёшь качественный вопрос AI Coach'у (любой модуль AEVION). Запрос
// кэшируется. Когда другой юзер задаёт похожий вопрос — cache-hit на твой,
// и ты получаешь AEV. Награда за уникальный, содержательный вопрос.
// Симулируется на клиенте: каждый tick есть quality-зависимый шанс hit'а.

const INSIGHT_KEY = "aevion_aev_insight_v1";

export type InsightTopic = "chess" | "qsign" | "qright" | "qtrade" | "compute" | "general";

export type InsightQuestion = {
  id: string;
  q: string;                  // текст вопроса
  topic: InsightTopic;
  ts: number;
  hits: number;               // сколько раз cache-hit'нулось (≈ скольким помог)
  earned: number;             // сколько AEV заработано с этого вопроса
  quality: number;            // 0..100 — авто-оценка качества вопроса
  lastHitTs: number;
};

export type InsightState = {
  v: 1;
  questions: InsightQuestion[];
  totalHits: number;
  totalEarned: number;
};

export const INSIGHT = {
  perHitAev: 0.25,            // AEV за каждый cache-hit
  dailyAskLimit: 20,          // anti-spam: max 20 вопросов в день
  maxQuestions: 100,          // total cap
  hitTickMs: 12_000,          // каждые 12s проверяем hit'ы
  hitProbBase: 0.18,          // базовый шанс hit'а на тик
  hitProbQualityMul: 0.55,    // + до +55% от quality/100
  topics: ["chess", "qsign", "qright", "qtrade", "compute", "general"] as const,
} as const;

export const TOPIC_META: Record<InsightTopic, { emoji: string; label: string; color: string }> = {
  chess:    { emoji: "♟", label: "CyberChess",   color: "#0ea5e9" },
  qsign:    { emoji: "✍", label: "QSign",        color: "#10b981" },
  qright:   { emoji: "📜", label: "QRight",       color: "#8b5cf6" },
  qtrade:   { emoji: "📈", label: "QTrade",       color: "#f59e0b" },
  compute:  { emoji: "🧠", label: "Compute / AI", color: "#3b82f6" },
  general:  { emoji: "💬", label: "General",      color: "#64748b" },
};

export function ldInsight(): InsightState {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(INSIGHT_KEY) : null;
    if (!s) return { v: 1, questions: [], totalHits: 0, totalEarned: 0 };
    const r = JSON.parse(s);
    if (!r || r.v !== 1) return { v: 1, questions: [], totalHits: 0, totalEarned: 0 };
    return {
      v: 1,
      questions: Array.isArray(r.questions) ? r.questions : [],
      totalHits: typeof r.totalHits === "number" ? r.totalHits : 0,
      totalEarned: typeof r.totalEarned === "number" ? r.totalEarned : 0,
    };
  } catch { return { v: 1, questions: [], totalHits: 0, totalEarned: 0 } }
}

export function svInsight(s: InsightState) {
  try { localStorage.setItem(INSIGHT_KEY, JSON.stringify(s)) } catch {}
}

export function questionsToday(qs: InsightQuestion[]): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return qs.filter((q) => q.ts >= start.getTime()).length;
}

// Quality score (0..100): длина + знак вопроса + word-count + уникальность слов.
// Detalised, но детерминированный — короткие/повторяющиеся вопросы получают мало hit'ов.
function scoreQuality(q: string): number {
  const s = q.trim();
  const len = Math.min(s.length, 240);
  const lenScore = (len / 240) * 50;
  const hasQuestion = /[?]/.test(s) ? 10 : 0;
  const words = s.split(/\s+/).filter(Boolean);
  const wordScore = Math.min(20, words.length * 1.5);
  const uniqWords = new Set(s.toLowerCase().split(/\s+/).filter(Boolean)).size;
  const uniqScore = Math.min(20, uniqWords * 2);
  return Math.round(Math.min(100, lenScore + hasQuestion + wordScore + uniqScore));
}

// Pre-compute quality для UI (превью награды до submit'а)
export function previewQuality(q: string): number {
  return scoreQuality(q);
}

export function askQuestion(
  s: InsightState,
  q: string,
  topic: InsightTopic = "general",
): { state: InsightState } | { error: string } {
  const text = q.trim();
  if (!text) return { error: "Вопрос пустой" };
  if (text.length < 12) return { error: "Слишком коротко — добавь контекст (мин 12 символов)" };
  if (questionsToday(s.questions) >= INSIGHT.dailyAskLimit) {
    return { error: `Дневной лимит ${INSIGHT.dailyAskLimit} вопросов исчерпан · возвращайся завтра` };
  }
  const quality = scoreQuality(text);
  const item: InsightQuestion = {
    id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    q: text.slice(0, 240),
    topic,
    ts: Date.now(),
    hits: 0,
    earned: 0,
    quality,
    lastHitTs: 0,
  };
  return {
    state: {
      ...s,
      questions: [item, ...s.questions].slice(0, INSIGHT.maxQuestions),
    },
  };
}

export function removeQuestion(s: InsightState, id: string): InsightState {
  return { ...s, questions: s.questions.filter((q) => q.id !== id) };
}

// Каждый tick, каждый вопрос имеет quality-зависимый шанс получить cache-hit.
// Per-hit мintit AEV в wallet и инкрементит hits/earned у вопроса.
export function simulateInsightTick(
  w: AEVWallet,
  s: InsightState,
): { wallet: AEVWallet; insight: InsightState } {
  if (s.questions.length === 0) return { wallet: w, insight: s };
  let curWallet = w;
  let totalNewHits = 0;
  let totalNewEarned = 0;
  const newQuestions = s.questions.map((q) => {
    const probability = INSIGHT.hitProbBase + INSIGHT.hitProbQualityMul * (q.quality / 100);
    if (Math.random() > probability) return q;
    const reward = INSIGHT.perHitAev;
    curWallet = mint(
      curWallet,
      reward,
      { kind: "play", module: "qcoreai", action: "insight_hit" },
      `💡 Cache-hit · «${q.q.slice(0, 40)}${q.q.length > 40 ? "…" : ""}»`,
    );
    totalNewHits += 1;
    totalNewEarned += reward;
    return { ...q, hits: q.hits + 1, earned: q.earned + reward, lastHitTs: Date.now() };
  });
  return {
    wallet: curWallet,
    insight: {
      ...s,
      questions: newQuestions,
      totalHits: s.totalHits + totalNewHits,
      totalEarned: s.totalEarned + totalNewEarned,
    },
  };
}

// Manual trigger одного hit'а для конкретного вопроса (UI «⚡»).
export function triggerInsightHit(
  w: AEVWallet,
  s: InsightState,
  qid: string,
): { wallet: AEVWallet; insight: InsightState } {
  const target = s.questions.find((q) => q.id === qid);
  if (!target) return { wallet: w, insight: s };
  const reward = INSIGHT.perHitAev;
  const newWallet = mint(
    w,
    reward,
    { kind: "play", module: "qcoreai", action: "insight_hit" },
    `💡 Cache-hit · «${target.q.slice(0, 40)}${target.q.length > 40 ? "…" : ""}»`,
  );
  const newQuestions = s.questions.map((q) =>
    q.id === qid ? { ...q, hits: q.hits + 1, earned: q.earned + reward, lastHitTs: Date.now() } : q,
  );
  return {
    wallet: newWallet,
    insight: {
      ...s,
      questions: newQuestions,
      totalHits: s.totalHits + 1,
      totalEarned: s.totalEarned + reward,
    },
  };
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

// ─── Quests / Achievements ────────────────────────────────────────
// Cross-module milestone tracking. Quest progress вычисляется из QuestSnapshot —
// агрегированного состояния всех движков. Reward minted при claim.

const QUESTS_CLAIMED_KEY = "aevion_aev_quests_claimed_v1";

export type QuestSnapshot = {
  walletBalance: number;
  walletLifetimeMined: number;
  walletLifetimeSpent: number;
  walletDividendsClaimed: number;
  pinsCount: number;
  pinsUpvotes: number;
  studentsCount: number;
  studentsMilestones: number;
  invitedCount: number;
  insightQuestions: number;
  insightHits: number;
  streakCurrent: number;
  streakLongest: number;
  totalStaked: number;
  closedWinningCount: number;
  closedTotalCount: number;
  computeUnits: number;
  marketplaceOwned: number;
  modesActive: number;        // сколько mining-modes включено
};

export type Quest = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  reward: number;
  target: (s: QuestSnapshot) => number;
  progress: (s: QuestSnapshot) => number;
  category: "play" | "stewardship" | "social" | "trading" | "compute" | "milestone";
};

export const QUESTS: Quest[] = [
  // Play / mining
  { id: "first_mint",      emoji: "🌱", title: "Первый AEV",        desc: "Намайни хотя бы 0.01 AEV любым способом.", reward: 0.5,  category: "play",        target: () => 0.01, progress: (s) => Math.min(s.walletLifetimeMined, 0.01) },
  { id: "hundred_strong",  emoji: "💯", title: "Hundred Strong",    desc: "Накопи 100 AEV (lifetime mined).",          reward: 5,    category: "milestone",   target: () => 100,  progress: (s) => Math.min(s.walletLifetimeMined, 100) },
  { id: "whale",           emoji: "🐳", title: "Whale",             desc: "Накопи 500 AEV (lifetime mined).",          reward: 25,   category: "milestone",   target: () => 500,  progress: (s) => Math.min(s.walletLifetimeMined, 500) },
  { id: "all_engines",     emoji: "🌟", title: "All Engines On",    desc: "Включи все 3 mining-mode (Play/Compute/Stewardship).", reward: 2, category: "play", target: () => 3, progress: (s) => Math.min(s.modesActive, 3) },

  // Curation / social
  { id: "curator",         emoji: "📌", title: "Curator",            desc: "Запинни 5 items в Curation Wall.",          reward: 1.5,  category: "social",      target: () => 5,    progress: (s) => Math.min(s.pinsCount, 5) },
  { id: "curator_loved",   emoji: "❤", title: "Loved Curator",      desc: "Получи 10 upvotes на свои pins.",            reward: 2.5,  category: "social",      target: () => 10,   progress: (s) => Math.min(s.pinsUpvotes, 10) },
  { id: "mentor",          emoji: "🎓", title: "Mentor",             desc: "Зарегистрируй 3 students в Mentorship.",     reward: 1.5,  category: "social",      target: () => 3,    progress: (s) => Math.min(s.studentsCount, 3) },
  { id: "mentor_progress", emoji: "📈", title: "Master Teacher",     desc: "Студенты пройдут 10 milestones совокупно.",  reward: 5,    category: "social",      target: () => 10,   progress: (s) => Math.min(s.studentsMilestones, 10) },
  { id: "networker",       emoji: "🌐", title: "Networker",          desc: "Пригласи 3 users через свой code.",          reward: 1,    category: "social",      target: () => 3,    progress: (s) => Math.min(s.invitedCount, 3) },

  // Insight / Streak
  { id: "insight_sage",    emoji: "💡", title: "Insight Sage",       desc: "Получи 10 cache-hits на свои вопросы.",      reward: 2,    category: "play",        target: () => 10,   progress: (s) => Math.min(s.insightHits, 10) },
  { id: "streaker_7",      emoji: "🔥", title: "Week Warrior",       desc: "Достигни 7-дневного streak'а.",              reward: 3,    category: "play",        target: () => 7,    progress: (s) => Math.min(s.streakCurrent, 7) },
  { id: "streaker_30",     emoji: "🚀", title: "Month Champion",     desc: "Streak в 30 дней — настоящий ритм.",         reward: 15,   category: "milestone",   target: () => 30,   progress: (s) => Math.min(s.streakLongest, 30) },

  // Stewardship
  { id: "stewart",         emoji: "🛡", title: "Stewart",            desc: "Застейкай 10 AEV в Stewardship.",           reward: 1.5,  category: "stewardship", target: () => 10,   progress: (s) => Math.min(s.totalStaked, 10) },
  { id: "patient",         emoji: "⏳", title: "Patient Steward",    desc: "Получи 1 AEV из dividend'ов суммарно.",      reward: 2,    category: "stewardship", target: () => 1,    progress: (s) => Math.min(s.walletDividendsClaimed, 1) },

  // Trading
  { id: "trader_5",        emoji: "📈", title: "Trader",             desc: "Закрой 5 прибыльных позиций в QTrade.",      reward: 2,    category: "trading",     target: () => 5,    progress: (s) => Math.min(s.closedWinningCount, 5) },
  { id: "trader_20",       emoji: "💎", title: "Veteran Trader",     desc: "Закрой 20 сделок (любых) в QTrade.",         reward: 4,    category: "trading",     target: () => 20,   progress: (s) => Math.min(s.closedTotalCount, 20) },

  // Compute
  { id: "compute_100",     emoji: "🧠", title: "Compute Lord",       desc: "Выполни 100 compute-юнитов.",                reward: 1.5,  category: "compute",     target: () => 100,  progress: (s) => Math.min(s.computeUnits, 100) },

  // Spend cycle
  { id: "spender",         emoji: "🛒", title: "Spender",            desc: "Потрать 20 AEV в Marketplace или продав.",   reward: 2,    category: "milestone",   target: () => 20,   progress: (s) => Math.min(s.walletLifetimeSpent, 20) },
  { id: "collector",       emoji: "🏆", title: "Collector",          desc: "Купи 5 items в Marketplace.",                reward: 3,    category: "milestone",   target: () => 5,    progress: (s) => Math.min(s.marketplaceOwned, 5) },
];

export function ldClaimedQuests(): string[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(QUESTS_CLAIMED_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as string[] : [];
  } catch { return [] }
}

export function svClaimedQuests(c: string[]) {
  try { localStorage.setItem(QUESTS_CLAIMED_KEY, JSON.stringify(c)) } catch {}
}

export function isQuestComplete(q: Quest, snap: QuestSnapshot): boolean {
  return q.progress(snap) >= q.target(snap);
}

export function claimQuest(
  w: AEVWallet,
  claimed: string[],
  questId: string,
  snap: QuestSnapshot,
): { wallet: AEVWallet; claimed: string[] } | { error: string } {
  if (claimed.includes(questId)) return { error: "Уже заклеймлено" };
  const q = QUESTS.find((x) => x.id === questId);
  if (!q) return { error: "Quest не найден" };
  if (!isQuestComplete(q, snap)) return { error: "Цель ещё не достигнута" };
  const next = mint(
    w,
    q.reward,
    { kind: "play", module: "qcoreai", action: "quest_complete" },
    `🏆 Quest: ${q.title}`,
  );
  return { wallet: next, claimed: [...claimed, questId] };
}

// ─── Marketplace ──────────────────────────────────────────────────
// Закрывает петлю эмиссии: AEV mint → AEV spend на cosmetic / utility
// items. Owned items persist отдельно от wallet'а — они unlock'ают
// фичи UI (themes / badges / slot expansions). Boost'ы имеют expiresTs.

const MARKETPLACE_OWNED_KEY = "aevion_aev_marketplace_owned_v1";
const MARKETPLACE_BOOSTS_KEY = "aevion_aev_marketplace_boosts_v1";

export type ItemCategory = "theme" | "badge" | "boost" | "slot" | "cosmetic";

export type MarketplaceItem = {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  price: number;
  category: ItemCategory;
  durationHours?: number;       // только для boost'ов
};

export type ActiveBoost = {
  itemId: string;
  expiresTs: number;
};

export const MARKETPLACE: MarketplaceItem[] = [
  // Themes (cosmetic UI palettes)
  { id: "theme_aurora",   emoji: "🌌", name: "Theme: Aurora",   desc: "Северное-сияние палитра для /qtrade и /aev. Cosmetic, никаких механик.", price: 10, category: "theme" },
  { id: "theme_onyx",     emoji: "🖤", name: "Theme: Onyx",     desc: "Чёрный premium-вид: deep blacks + subtle gold accents. Cosmetic.", price: 8,  category: "theme" },
  { id: "theme_sunset",   emoji: "🌅", name: "Theme: Sunset",   desc: "Тёплая магма-палитра: orange/red/gold. Cosmetic.", price: 6,  category: "theme" },

  // Badges (profile flair)
  { id: "badge_founder",   emoji: "👑", name: "Founder Badge",  desc: "Золотая иконка «Founder» рядом с балансом — перманентная.", price: 25, category: "badge" },
  { id: "badge_pioneer",   emoji: "🚀", name: "Early Pioneer",  desc: "Маленький pioneer-знак — для wave-1 юзеров AEVION.", price: 12, category: "badge" },
  { id: "badge_oracle",    emoji: "🔮", name: "Oracle",         desc: "Иконка предсказателя — для тех, кто шарит в QTrade.", price: 18, category: "badge" },

  // Boosts (temporary multipliers)
  { id: "boost_streak_2x", emoji: "⚡", name: "Streak ×2 · 24h", desc: "Удваивает streak rate на следующие 24 часа.", price: 8,  category: "boost", durationHours: 24 },
  { id: "boost_bot_2x",    emoji: "🤖", name: "Bot ×2 · 1h",     desc: "Удваивает AEV mint от DCA bot тиков на 1 час.", price: 5,  category: "boost", durationHours: 1  },
  { id: "boost_play_2x",   emoji: "🎮", name: "Play ×2 · 12h",   desc: "Удваивает AEV от Proof-of-Play действий на 12 часов.", price: 12, category: "boost", durationHours: 12 },

  // Slot expansions (extends caps)
  { id: "slot_curation_5", emoji: "📌", name: "+5 Curation slots", desc: "Расширяет cap pin'ов с 50 до 55. Кумулятивно.", price: 6,  category: "slot" },
  { id: "slot_mentor_5",   emoji: "🎓", name: "+5 Student slots",  desc: "Расширяет cap students с 30 до 35. Кумулятивно.", price: 7,  category: "slot" },
  { id: "slot_invite_10",  emoji: "🌐", name: "+10 Invite slots",  desc: "Расширяет cap invitees с 50 до 60. Кумулятивно.", price: 8,  category: "slot" },

  // Cosmetic / fun
  { id: "cosmetic_quote",  emoji: "💬", name: "Custom Quote",      desc: "Закрепи свою цитату на /aev hero (до 80 char).", price: 4,  category: "cosmetic" },
  { id: "cosmetic_glow",   emoji: "✨", name: "Wallet Glow",       desc: "Добавляет золотое свечение на balance card.", price: 9, category: "cosmetic" },
];

export function ldOwned(): string[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(MARKETPLACE_OWNED_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    return Array.isArray(r) ? r as string[] : [];
  } catch { return [] }
}

export function svOwned(o: string[]) {
  try { localStorage.setItem(MARKETPLACE_OWNED_KEY, JSON.stringify(o)) } catch {}
}

export function ldBoosts(): ActiveBoost[] {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(MARKETPLACE_BOOSTS_KEY) : null;
    if (!s) return [];
    const r = JSON.parse(s);
    if (!Array.isArray(r)) return [];
    // Drop expired при load
    const now = Date.now();
    return (r as ActiveBoost[]).filter((b) => b.expiresTs > now);
  } catch { return [] }
}

export function svBoosts(b: ActiveBoost[]) {
  try { localStorage.setItem(MARKETPLACE_BOOSTS_KEY, JSON.stringify(b)) } catch {}
}

export function isBoostActive(boosts: ActiveBoost[], itemId: string, now = Date.now()): boolean {
  return boosts.some((b) => b.itemId === itemId && b.expiresTs > now);
}

export function getBoostExpiry(boosts: ActiveBoost[], itemId: string, now = Date.now()): number | null {
  const active = boosts.filter((b) => b.itemId === itemId && b.expiresTs > now);
  if (active.length === 0) return null;
  // Самый дальний expiry если несколько раз куплен
  return Math.max(...active.map((b) => b.expiresTs));
}

export function purchaseItem(
  w: AEVWallet,
  owned: string[],
  boosts: ActiveBoost[],
  itemId: string,
): { wallet: AEVWallet; owned: string[]; boosts: ActiveBoost[] } | { error: string } {
  const item = MARKETPLACE.find((i) => i.id === itemId);
  if (!item) return { error: "Item not found" };
  // Не-boost items не разрешаем покупать дважды
  const isBoost = item.category === "boost";
  const isSlot = item.category === "slot";
  const isStackable = isBoost || isSlot;
  if (!isStackable && owned.includes(itemId)) return { error: "Already owned" };
  if (w.balance < item.price) return { error: `Не хватает AEV: нужно ${item.price.toFixed(2)}, есть ${w.balance.toFixed(2)}` };
  const newWallet = spend(w, item.price, `🛒 Marketplace: ${item.name}`);
  if (!newWallet) return { error: "Spend failed" };
  let newOwned = owned;
  let newBoosts = boosts;
  if (isBoost && item.durationHours) {
    const exp = Date.now() + item.durationHours * 3600 * 1000;
    newBoosts = [...boosts, { itemId, expiresTs: exp }];
    if (!owned.includes(itemId)) newOwned = [...owned, itemId];
  } else if (isSlot) {
    // Slots: stack via duplicate entries
    newOwned = [...owned, itemId];
  } else {
    newOwned = [...owned, itemId];
  }
  return { wallet: newWallet, owned: newOwned, boosts: newBoosts };
}

// Helper: count slot expansions of a given type (для cap-bonus вычислений в UI)
export function countSlotItems(owned: string[], itemId: string): number {
  return owned.filter((o) => o === itemId).length;
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
