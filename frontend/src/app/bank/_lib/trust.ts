import type { Account, Operation } from "./types";

export type TrustTier = "new" | "growing" | "trusted" | "elite";

export type TrustScore = {
  score: number;
  tier: TrustTier;
  breakdown: Array<{ label: string; points: number; max: number; hint: string }>;
};

// AEVION-specific Trust Graph reputation, computed locally from public on-chain data.
// Four factors, each capped at 25 points — tier at 25/50/80.
export function computeTrustScore(account: Account, operations: Operation[]): TrustScore {
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

  const opsCount = operations.length;

  const age = Math.min(25, (ageDays / 30) * 25);
  const vol = Math.min(25, (volume / 1000) * 25);
  const net = Math.min(25, counterparties.size * 5);
  const act = Math.min(25, opsCount * 2.5);

  const score = Math.round(age + vol + net + act);
  const tier: TrustTier = score < 25 ? "new" : score < 50 ? "growing" : score < 80 ? "trusted" : "elite";

  return {
    score,
    tier,
    breakdown: [
      { label: "Account age", points: Math.round(age), max: 25, hint: `${Math.round(ageDays)}d` },
      { label: "Volume", points: Math.round(vol), max: 25, hint: `${volume.toFixed(0)} AEC` },
      { label: "Network", points: Math.round(net), max: 25, hint: `${counterparties.size} contacts` },
      { label: "Activity", points: Math.round(act), max: 25, hint: `${opsCount} ops` },
    ],
  };
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
