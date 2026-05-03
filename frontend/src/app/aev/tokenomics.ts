// Derived tokenomics metrics. Pulls live state from the user's wallet
// (single-source-of-truth in MVP) и формирует «протокольный» взгляд: distribution
// per engine, halving schedule, supply velocity, ETA to cap. Чисто client-side,
// никаких новых стораджей — только маппинг событий из wallet.recent.

import { RATE_CARD, type AEVWallet, type MiningEvent, type RewardSource } from "./aevToken";

// ─── Engine taxonomy ──────────────────────────────────────────────
// Все 8 эмиссионных движков, по которым агрегируем эмиссии. Тэг — для UI,
// match — функция, определяющая принадлежит ли event этому движку.

export type EngineId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type EngineMeta = {
  id: EngineId;
  label: string;
  short: string;
  emoji: string;
  color: string;
  // Подбор соответствия mining-event'а к движку. На основе RewardSource.kind/action.
  match: (e: MiningEvent) => boolean;
  // Для рейт-карты в UI: одна строка с актуальной ставкой.
  rate: string;
  // Описание для tooltip / детальной карточки.
  desc: string;
};

const isPlayAction = (e: MiningEvent, action: string) =>
  e.source.kind === "play" && (e.source as Extract<RewardSource, { kind: "play" }>).action === action;

const isPlayActionPrefix = (e: MiningEvent, prefix: string) =>
  e.source.kind === "play" && (e.source as Extract<RewardSource, { kind: "play" }>).action.startsWith(prefix);

export const ENGINES: EngineMeta[] = [
  {
    id: "A", label: "Proof-of-Play", short: "Play", emoji: "🎮", color: "#22c55e",
    match: (e) => e.source.kind === "play" && !isPlayActionPrefix(e, "curation_") && !isPlayActionPrefix(e, "mentorship_") && !isPlayActionPrefix(e, "network_") && !isPlayActionPrefix(e, "insight_") && !isPlayAction(e, "streak"),
    rate: "0.15–4.00 AEV / action",
    desc: "Действия в продуктах AEVION (CyberChess партии, QSign подписи, QRight регистрации, Bureau, Multichat, QTrade, QCoreAI). Не нужны GPU — нужны мозги.",
  },
  {
    id: "B", label: "Proof-of-Useful-Compute", short: "Compute", emoji: "🧠", color: "#3b82f6",
    match: (e) => e.source.kind === "compute",
    rate: `${RATE_CARD.compute.perUnit} AEV / unit`,
    desc: "Выполненный compute-юнит (≈1 GPU-минута полезной AI-работы). Не пустой hash — а run агента, classification, embedding, и т.п.",
  },
  {
    id: "C", label: "Proof-of-Stewardship", short: "Stewardship", emoji: "🛡", color: "#f59e0b",
    match: (e) => e.source.kind === "stewardship",
    rate: `${(RATE_CARD.stewardship.apyAnnual * 100).toFixed(1)}% APY`,
    desc: "Стейкинг → epoch-based dividend (5 минут эпоха). Долгосрочные держатели формируют base-load протокола. Никакого «майнинга» — только lock.",
  },
  {
    id: "D", label: "Proof-of-Curation", short: "Curation", emoji: "📌", color: "#8b5cf6",
    match: (e) => isPlayActionPrefix(e, "curation_"),
    rate: "0.5 AEV / pin · 0.05 / upvote",
    desc: "Pin best plays, puzzles, trades. Anti-spam: 5 pin/day. Bonus за peer-upvotes — если другие юзеры подтверждают качество.",
  },
  {
    id: "E", label: "Proof-of-Mentorship", short: "Mentorship", emoji: "🎓", color: "#06b6d4",
    match: (e) => isPlayAction(e, "mentorship_milestone"),
    rate: "0.5 AEV / milestone (+100 rating)",
    desc: "У тебя students. Когда они переходят rating-milestone (1300, 1400, …) — mentor получает AEV. Награда за progression downstream.",
  },
  {
    id: "F", label: "Proof-of-Streak", short: "Streak", emoji: "🔥", color: "#f97316",
    match: (e) => isPlayAction(e, "streak"),
    rate: "0.1 AEV / day · ×2 max",
    desc: "Ежедневный visit-claim. Multipliers за неделю/месяц/век. Reset при пропуске дня. Вознаграждает consistency.",
  },
  {
    id: "G", label: "Proof-of-Network", short: "Network", emoji: "🌐", color: "#10b981",
    match: (e) => isPlayAction(e, "network_royalty"),
    rate: "10% royalty downstream",
    desc: "Invite chain: ты пригласил юзера, он что-то делает в AEVION → тебе капает % от его эмиссии. Награда за рост сети.",
  },
  {
    id: "H", label: "Proof-of-Insight", short: "Insight", emoji: "💡", color: "#eab308",
    match: (e) => isPlayAction(e, "insight_hit"),
    rate: "0.25 AEV / cache-hit",
    desc: "Качественный вопрос → cache. Когда другой юзер задаёт похожий — тебе AEV. Награда за уникальный, содержательный insight.",
  },
];

// ─── Halving schedule (BTC-style, но «engine-aware») ──────────────
// Вместо одного глобального halving у нас есть 4-year cycles с уменьшением
// rate factor. Старт — год запуска протокола (2026). Последний halving — когда
// suppy almost asymptotic.

export const HALVING = {
  startYear: 2026,
  cycleYears: 4,
  cycles: 7,            // 7 халвингов до ~99%+ supply (как BTC)
  reductionFactor: 0.5, // каждый cycle: rate × 0.5
} as const;

export type HalvingPoint = {
  year: number;
  cycle: number;          // 0 = genesis
  multiplier: number;     // относительно genesis (1.0)
  cumulativeShare: number; // фракция cap, добытая к этому моменту [0..1]
};

export function halvingSchedule(): HalvingPoint[] {
  const out: HalvingPoint[] = [];
  // Геометрический ряд: cumSupply = sum_{i=0}^{n-1} (0.5)^i = 2 × (1 - 0.5^n)
  // Нормализуем к 1 (full cap == infinity, но 7 cycles ≈ 99.2% supply).
  for (let c = 0; c <= HALVING.cycles; c++) {
    const year = HALVING.startYear + c * HALVING.cycleYears;
    const multiplier = Math.pow(HALVING.reductionFactor, c);
    // share после c полных циклов: 2 × (1 - 0.5^c) / 2 = 1 - 0.5^c, normalized
    // Но будем использовать «emitted by cycle c» = 1 - 0.5^c, окончательная нормализация
    // даст нам 1 - 0.5^cycles ≈ 0.992 для 7 cycles.
    const cumulativeShare = 1 - Math.pow(HALVING.reductionFactor, c);
    out.push({ year, cycle: c, multiplier, cumulativeShare });
  }
  return out;
}

// Текущий cycle на основе сегодняшней даты
export function currentCycle(now = new Date()): { cycle: number; year: number; nextHalvingYear: number; daysToNext: number } {
  const y = now.getFullYear();
  const elapsed = Math.max(0, y - HALVING.startYear);
  const cycle = Math.min(HALVING.cycles - 1, Math.floor(elapsed / HALVING.cycleYears));
  const nextHalvingYear = HALVING.startYear + (cycle + 1) * HALVING.cycleYears;
  const next = new Date(`${nextHalvingYear}-01-01T00:00:00Z`).getTime();
  const daysToNext = Math.max(0, Math.ceil((next - now.getTime()) / 86400000));
  return { cycle, year: y, nextHalvingYear, daysToNext };
}

// ─── Engine distribution from wallet events ────────────────────────
export type EngineSlice = {
  engine: EngineMeta;
  amount: number;       // AEV сэмиченные через этот движок (lifetime подсчёт по recent + extrapolation)
  events: number;       // # ивентов в feed'е
  pct: number;          // 0..100 от total из feed
};

// Из recent feed считаем долю каждого движка. Это не lifetime (recent capped 80),
// но ratio репрезентативен.
export function engineDistribution(w: AEVWallet): EngineSlice[] {
  const mints = w.recent.filter((e) => e.amount > 0);
  const total = mints.reduce((s, e) => s + e.amount, 0) || 1;
  return ENGINES.map((engine) => {
    const sliceMints = mints.filter(engine.match);
    const amount = sliceMints.reduce((s, e) => s + e.amount, 0);
    return {
      engine,
      amount,
      events: sliceMints.length,
      pct: (amount / total) * 100,
    };
  }).sort((a, b) => b.amount - a.amount);
}

// ─── Supply velocity / ETA to cap ──────────────────────────────────
export type SupplyVelocity = {
  ageDays: number;
  perDay: number;       // AEV в день (lifetimeMined / age)
  remainingCap: number;
  daysToCap: number | null;
  yearsToCap: number | null;
  // ratio of cap mined
  pct: number;
};

export function supplyVelocity(w: AEVWallet): SupplyVelocity {
  const ageMs = Math.max(60_000, Date.now() - w.startTs);
  const ageDays = ageMs / 86_400_000;
  const perDay = w.lifetimeMined / Math.max(0.0001, ageDays);
  const remainingCap = Math.max(0, RATE_CARD.totalSupplyCap - w.globalSupplyMined);
  const daysToCap = perDay > 0 ? remainingCap / perDay : null;
  const yearsToCap = daysToCap !== null ? daysToCap / 365 : null;
  return {
    ageDays,
    perDay,
    remainingCap,
    daysToCap,
    yearsToCap,
    pct: (w.globalSupplyMined / RATE_CARD.totalSupplyCap) * 100,
  };
}

// ─── Network estimate (mocked, based on user activity scaled) ──────
// Грубый extrapolation: «сколько было бы AEV, если 100k активных юзеров
// с похожей активностью». Дает ощущение «реального» протокола, а не локалки.
export function networkEstimate(w: AEVWallet, assumedUsers = 100_000): {
  estTotalSupply: number;
  estDailyEmission: number;
  estCapHitYear: number | null;
  assumedUsers: number;
} {
  const v = supplyVelocity(w);
  const estTotalSupply = Math.min(RATE_CARD.totalSupplyCap, w.lifetimeMined * assumedUsers);
  const estDailyEmission = v.perDay * assumedUsers;
  const remaining = Math.max(0, RATE_CARD.totalSupplyCap - estTotalSupply);
  const estCapHitYear = estDailyEmission > 0
    ? new Date().getFullYear() + Math.ceil(remaining / estDailyEmission / 365)
    : null;
  return { estTotalSupply, estDailyEmission, estCapHitYear, assumedUsers };
}

// ─── Format helpers ────────────────────────────────────────────────
export function fmtBigAev(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

export function fmtSupplyPctPrecise(amt: number, cap = RATE_CARD.totalSupplyCap): string {
  const pct = (amt / cap) * 100;
  if (pct < 0.0001) return pct.toExponential(2) + "%";
  if (pct < 0.01) return pct.toFixed(6) + "%";
  if (pct < 1) return pct.toFixed(4) + "%";
  return pct.toFixed(2) + "%";
}
