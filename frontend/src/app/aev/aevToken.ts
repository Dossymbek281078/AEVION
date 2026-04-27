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
