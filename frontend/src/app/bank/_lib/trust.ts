import type { ChessSummary } from "./chess";
import type { EcosystemEarningsSummary } from "./ecosystem";
import type { RoyaltyStreamSummary } from "./royalties";
import type { Account, Operation } from "./types";

export type TrustTier = "new" | "growing" | "trusted" | "elite";

export type TrustFactor = {
  key: string;
  label: string;
  cluster: "banking" | "ecosystem";
  points: number;
  max: number;
  hint: string;
};

export type TrustScore = {
  score: number;
  tier: TrustTier;
  factors: TrustFactor[];
};

export type TrustInputs = {
  account: Account;
  operations: Operation[];
  royalty?: RoyaltyStreamSummary | null;
  chess?: ChessSummary | null;
  ecosystem?: EcosystemEarningsSummary | null;
};

export function computeEcosystemTrustScore(input: TrustInputs): TrustScore {
  const { account, operations, royalty, chess, ecosystem } = input;

  const ageDays = Math.max(0, (Date.now() - new Date(account.createdAt).getTime()) / 86_400_000);

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

  const planetBonuses = ecosystem?.perSource.planet.last90d ?? 0;
  const planetTasksCount = Math.round((ecosystem?.perSource.planet.last90d ?? 0) / 18);

  const factors: TrustFactor[] = [
    {
      key: "age",
      label: "Account age",
      cluster: "banking",
      points: Math.round(Math.min(100, (ageDays / 60) * 100)),
      max: 100,
      hint: `${Math.round(ageDays)}d`,
    },
    {
      key: "volume",
      label: "Banking volume",
      cluster: "banking",
      points: Math.round(Math.min(100, (volume / 2000) * 100)),
      max: 100,
      hint: `${volume.toFixed(0)} AEC`,
    },
    {
      key: "network",
      label: "Network",
      cluster: "banking",
      points: Math.round(Math.min(100, counterparties.size * 10)),
      max: 100,
      hint: `${counterparties.size} contacts`,
    },
    {
      key: "activity",
      label: "Activity",
      cluster: "banking",
      points: Math.round(Math.min(100, operations.length * 5)),
      max: 100,
      hint: `${operations.length} ops`,
    },
    {
      key: "ip-portfolio",
      label: "IP portfolio",
      cluster: "ecosystem",
      points: Math.round(Math.min(100, ipWorks * 10)),
      max: 100,
      hint: `${ipWorks} works`,
    },
    {
      key: "ip-reach",
      label: "IP reach",
      cluster: "ecosystem",
      points: Math.round(Math.min(100, (ipVerifications / 200) * 100)),
      max: 100,
      hint: `${ipVerifications} verifications`,
    },
    {
      key: "chess",
      label: "Chess skill",
      cluster: "ecosystem",
      points: Math.round(Math.max(0, Math.min(100, ((chessRating - 1000) / 1400) * 100))),
      max: 100,
      hint: chessRating ? `${chessRating} · ${chessTopThree} podiums` : "no games",
    },
    {
      key: "planet",
      label: "Planet progress",
      cluster: "ecosystem",
      points: Math.round(Math.min(100, (planetBonuses / 120) * 100)),
      max: 100,
      hint: `${planetTasksCount} tasks`,
    },
  ];

  const totalPoints = factors.reduce((s, f) => s + f.points, 0);
  const score = Math.round(totalPoints / factors.length);
  const tier: TrustTier = score < 25 ? "new" : score < 50 ? "growing" : score < 80 ? "trusted" : "elite";

  return { score, tier, factors };
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
