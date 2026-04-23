import type { ChessSummary } from "./chess";
import type { EcosystemEarningsSummary } from "./ecosystem";
import type { RoyaltyStreamSummary } from "./royalties";
import type { Account, Operation } from "./types";

export type TrustTier = "new" | "growing" | "trusted" | "elite";

export type TrustFactorKey =
  | "age"
  | "volume"
  | "network"
  | "activity"
  | "ip-portfolio"
  | "ip-reach"
  | "chess"
  | "planet";

export type TrustFactor = {
  key: TrustFactorKey;
  label: string;
  cluster: "banking" | "ecosystem";
  points: number;
  max: number;
  weight: number;
  hint: string;
  nextMilestone: string | null;
};

export type TrustScore = {
  score: number;
  tier: TrustTier;
  nextTier: TrustTier | null;
  pointsToNextTier: number;
  factors: TrustFactor[];
  checklist: Array<{ key: TrustFactorKey; label: string; delta: number }>;
};

export type TrustInputs = {
  account: Account;
  operations: Operation[];
  royalty?: RoyaltyStreamSummary | null;
  chess?: ChessSummary | null;
  ecosystem?: EcosystemEarningsSummary | null;
};

// Sub-linear curve: rewards early progress while still saturating at the target.
// pow(r, 0.55) gives ~47 at r=0.25, ~68 at r=0.5, 100 at r=1. Clamps to 100.
function curve(value: number, target: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target) || value <= 0 || target <= 0) return 0;
  const r = value / target;
  return Math.round(Math.min(100, Math.pow(r, 0.55) * 100));
}

// Tier gates. Softened vs v2 so early activity visibly moves the needle.
const TIER_GATE: Record<TrustTier, number> = { new: 0, growing: 20, trusted: 50, elite: 80 };
const TIER_ORDER: TrustTier[] = ["new", "growing", "trusted", "elite"];

function tierFor(score: number): TrustTier {
  if (score >= TIER_GATE.elite) return "elite";
  if (score >= TIER_GATE.trusted) return "trusted";
  if (score >= TIER_GATE.growing) return "growing";
  return "new";
}

function nextTier(current: TrustTier): TrustTier | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

export function computeEcosystemTrustScore(input: TrustInputs): TrustScore {
  const { account, operations, royalty, chess, ecosystem } = input;

  const createdMs = new Date(account.createdAt).getTime();
  const ageDays = Number.isFinite(createdMs)
    ? Math.max(0, (Date.now() - createdMs) / 86_400_000)
    : 0;

  const transferOps = operations.filter((op) => op.kind === "transfer");
  const counterparties = new Set<string>();
  for (const op of transferOps) {
    if (op.from && op.from !== account.id) counterparties.add(op.from);
    if (op.to && op.to !== account.id) counterparties.add(op.to);
  }

  let volume = 0;
  for (const op of operations) {
    if (op.to === account.id || op.from === account.id) volume += op.amount;
  }

  const ipWorks = royalty?.works.length ?? 0;
  const ipVerifications = royalty?.works.reduce((s, w) => s + w.verifications, 0) ?? 0;

  const chessRating = chess?.currentRating ?? 0;
  const chessTopThree = chess?.topThreeFinishes ?? 0;
  // Sub-linear rating score: 900 → 0, 1200 → 43, 1500 → 80, 1800 → 100+.
  const chessScore = chessRating > 900 ? curve(chessRating - 900, 700) : 0;

  const planetBonuses = ecosystem?.perSource.planet.last90d ?? 0;
  const planetTasksCount = Math.round(planetBonuses / 18);

  // Targets are "80 %-ish" reference points; the curve keeps going to 100
  // beyond the target. Soft targets mean first real steps feel rewarding.
  const TARGET = {
    ageDays: 14,
    volumeAec: 300,
    network: 5,
    activity: 10,
    ipWorks: 3,
    ipReach: 30,
    planetAec: 50,
  } as const;

  // Weighted by business value. Banking cluster weights slightly higher than
  // optional ecosystem participation (chess, planet) — but still counts.
  const factors: TrustFactor[] = [
    {
      key: "age",
      label: "Account age",
      cluster: "banking",
      points: curve(ageDays, TARGET.ageDays),
      max: 100,
      weight: 0.8,
      hint: `${Math.round(ageDays)}d`,
      nextMilestone:
        ageDays < TARGET.ageDays ? `${Math.max(1, Math.ceil(TARGET.ageDays - ageDays))}d to hit target` : null,
    },
    {
      key: "volume",
      label: "Banking volume",
      cluster: "banking",
      points: curve(volume, TARGET.volumeAec),
      max: 100,
      weight: 1.2,
      hint: `${volume.toFixed(0)} AEC`,
      nextMilestone: volume < TARGET.volumeAec ? `${Math.ceil(TARGET.volumeAec - volume)} AEC to target` : null,
    },
    {
      key: "network",
      label: "Network",
      cluster: "banking",
      points: curve(counterparties.size, TARGET.network),
      max: 100,
      weight: 1.0,
      hint: `${counterparties.size} contact${counterparties.size === 1 ? "" : "s"}`,
      nextMilestone:
        counterparties.size < TARGET.network ? `${TARGET.network - counterparties.size} more contacts` : null,
    },
    {
      key: "activity",
      label: "Activity",
      cluster: "banking",
      points: curve(operations.length, TARGET.activity),
      max: 100,
      weight: 1.1,
      hint: `${operations.length} op${operations.length === 1 ? "" : "s"}`,
      nextMilestone:
        operations.length < TARGET.activity ? `${TARGET.activity - operations.length} more operations` : null,
    },
    {
      key: "ip-portfolio",
      label: "IP portfolio",
      cluster: "ecosystem",
      points: curve(ipWorks, TARGET.ipWorks),
      max: 100,
      weight: 1.2,
      hint: `${ipWorks} work${ipWorks === 1 ? "" : "s"}`,
      nextMilestone: ipWorks < TARGET.ipWorks ? `Register ${TARGET.ipWorks - ipWorks} more in QRight` : null,
    },
    {
      key: "ip-reach",
      label: "IP reach",
      cluster: "ecosystem",
      points: curve(ipVerifications, TARGET.ipReach),
      max: 100,
      weight: 1.1,
      hint: `${ipVerifications} verifications`,
      nextMilestone:
        ipVerifications < TARGET.ipReach ? `${TARGET.ipReach - ipVerifications} verifications to target` : null,
    },
    {
      key: "chess",
      label: "Chess skill",
      cluster: "ecosystem",
      points: chessScore,
      max: 100,
      weight: 0.7,
      hint: chessRating ? `${chessRating} · ${chessTopThree} podium${chessTopThree === 1 ? "" : "s"}` : "no games",
      nextMilestone: chessScore < 80 ? "Place top-3 in a tournament" : null,
    },
    {
      key: "planet",
      label: "Planet progress",
      cluster: "ecosystem",
      points: curve(planetBonuses, TARGET.planetAec),
      max: 100,
      weight: 1.0,
      hint: `${planetTasksCount} task${planetTasksCount === 1 ? "" : "s"}`,
      nextMilestone:
        planetBonuses < TARGET.planetAec ? `${Math.ceil(TARGET.planetAec - planetBonuses)} AEC in bonuses` : null,
    },
  ];

  // Weighted mean. Avoids penalising specialists too hard while requiring
  // breadth (8 factors × weight 0.7..1.2) to crack elite.
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weightedSum = factors.reduce((s, f) => s + f.points * f.weight, 0);
  const rawMean = weightedSum / totalWeight;

  // Tiny encouragement bonus: if at least one factor is meaningfully active
  // (>= 30 points), bump the score by 3. Stops brand-new users from feeling
  // stuck on zero after their first top-up.
  const engagementBonus = factors.some((f) => f.points >= 30) ? 3 : 0;

  const score = Math.max(0, Math.min(100, Math.round(rawMean + engagementBonus)));
  const tier = tierFor(score);
  const next = nextTier(tier);
  const pointsToNextTier = next ? Math.max(0, TIER_GATE[next] - score) : 0;

  // Checklist: lowest-scoring factor-per-cluster shows up first so suggestion
  // surface picks the easiest wins.
  const checklist = factors
    .filter((f) => f.nextMilestone)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((f) => ({
      key: f.key,
      label: f.nextMilestone ?? f.label,
      delta: Math.max(0, 80 - f.points),
    }));

  return { score, tier, nextTier: next, pointsToNextTier, factors, checklist };
}

export const tierColor: Record<TrustTier, string> = {
  new: "#64748b",
  growing: "#0d9488",
  trusted: "#7c3aed",
  elite: "#d97706",
};

export const tierLabel: Record<TrustTier, string> = {
  new: "New",
  growing: "Growing",
  trusted: "Trusted",
  elite: "Elite",
};

export const tierDescription: Record<TrustTier, string> = {
  new: "Just started — build reputation via activity across AEVION modules.",
  growing: "Active participant. Earning trust across banking and ecosystem.",
  trusted: "Recognised contributor. Transfers, IP and tournaments trusted by peers.",
  elite: "Top tier. Your Trust Graph unlocks perks across the ecosystem.",
};
