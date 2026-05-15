// Smart Suggestions — heuristic-driven tips that surface what the user
// can do next given their data. Pure derivation; no separate state.

import { evaluateCaps, loadBudgetCaps } from "./budgetCaps";
import { computeEcosystemTrustScore, type TrustTier } from "./trust";
import { categorise } from "./spending";
import { loadGoals } from "./savings";
import { loadVault } from "./vault";
import { loadRoundUpConfig } from "./roundUp";
import { loadRecurring } from "./recurring";
import type { Account, Operation } from "./types";

export type SuggestionAction = {
  labelKey: string;
  /** Anchor inside /bank to scroll to */
  anchor?: string;
};

export type Suggestion = {
  id: string;
  /** 1 = top-priority, ascending. Sorted ascending. */
  priority: number;
  toneColor: string;
  icon: string;
  titleKey: string;
  titleVars?: Record<string, string | number>;
  bodyKey: string;
  bodyVars?: Record<string, string | number>;
  action?: SuggestionAction;
};

const TIER_RANK: Record<TrustTier, number> = {
  new: 0,
  growing: 1,
  trusted: 2,
  elite: 3,
};

export function gatherSuggestions({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}): Suggestion[] {
  const out: Suggestion[] = [];
  const now = Date.now();

  // 1) Idle balance: if balance > 200 AEC and no Vault positions, suggest opening one
  const positions = loadVault();
  const activeVault = positions.filter((p) => !p.claimedAt).length;
  if (account.balance >= 200 && activeVault === 0) {
    out.push({
      id: "idle:no-vault",
      priority: 2,
      toneColor: "#7c3aed",
      icon: "🏦",
      titleKey: "sugg.idle.title",
      bodyKey: "sugg.idle.body",
      bodyVars: { balance: account.balance.toFixed(0) },
      action: { labelKey: "sugg.action.openVault", anchor: "bank-anchor-vault" },
    });
  }

  // 2) Subscription drag — if subscriptions > 30% of last-30d outflow, flag
  const last30 = now - 30 * 86_400_000;
  let outflow30 = 0;
  let subs30 = 0;
  for (const op of operations) {
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < last30) continue;
    if (op.kind !== "transfer" || op.from !== account.id) continue;
    outflow30 += op.amount;
    if (categorise(op, account.id) === "subscriptions") subs30 += op.amount;
  }
  if (outflow30 > 0 && subs30 / outflow30 >= 0.3) {
    out.push({
      id: "sub-drag",
      priority: 1,
      toneColor: "#dc2626",
      icon: "🔍",
      titleKey: "sugg.subDrag.title",
      bodyKey: "sugg.subDrag.body",
      bodyVars: { pct: Math.round((subs30 / outflow30) * 100) },
      action: { labelKey: "sugg.action.scanSubs", anchor: "bank-anchor-recurring" },
    });
  }

  // 3) Trust Score path: if a tier is one bump away, surface the path
  try {
    const score = computeEcosystemTrustScore(
      { account, operations, royalty: null, chess: null, ecosystem: null },
      (k) => k,
    );
    if (score.nextTier && TIER_RANK[score.tier] < TIER_RANK[score.nextTier]) {
      out.push({
        id: `trust:next:${score.nextTier}`,
        priority: 3,
        toneColor: "#0d9488",
        icon: "↑",
        titleKey: "sugg.trust.title",
        titleVars: { tier: `trust.tier.${score.nextTier}.label` },
        bodyKey: "sugg.trust.body",
        bodyVars: { points: score.pointsToNextTier ?? 0 },
        action: { labelKey: "sugg.action.viewTrust", anchor: "bank-anchor-trust" },
      });
    }
  } catch {
    // trust calc may fail without ecosystem context — silent
  }

  // 4) Goal-less wallet: balance > 100 and no goals
  const goals = loadGoals();
  if (account.balance >= 100 && goals.length === 0) {
    out.push({
      id: "no-goals",
      priority: 2,
      toneColor: "#0ea5e9",
      icon: "🎯",
      titleKey: "sugg.noGoals.title",
      bodyKey: "sugg.noGoals.body",
      action: { labelKey: "sugg.action.pickTemplate", anchor: "bank-anchor-trust" },
    });
  }

  // 5) Round-Up off but stash potential: if user has > 5 outgoing transfers in last 30d, suggest
  const outgoing30 = operations.filter((op) => {
    const ts = new Date(op.createdAt).getTime();
    return (
      Number.isFinite(ts) &&
      ts >= last30 &&
      op.kind === "transfer" &&
      op.from === account.id
    );
  }).length;
  const roundUp = loadRoundUpConfig();
  if (!roundUp.enabled && outgoing30 >= 5) {
    out.push({
      id: "roundup-off",
      priority: 4,
      toneColor: "#0d9488",
      icon: "🪙",
      titleKey: "sugg.roundup.title",
      bodyKey: "sugg.roundup.body",
      bodyVars: { count: outgoing30 },
      action: { labelKey: "sugg.action.enableRoundup", anchor: "bank-anchor-trust" },
    });
  }

  // 6) Caps unused: if no caps configured and outflow > 0
  const caps = loadBudgetCaps();
  const anyCapSet =
    caps.subscriptions !== null ||
    caps.tips !== null ||
    caps.contacts !== null ||
    caps.untagged !== null;
  if (!anyCapSet && outflow30 > 50) {
    out.push({
      id: "no-caps",
      priority: 5,
      toneColor: "#d97706",
      icon: "⚖",
      titleKey: "sugg.noCaps.title",
      bodyKey: "sugg.noCaps.body",
      action: { labelKey: "sugg.action.setCaps", anchor: "bank-anchor-flow" },
    });
  } else if (anyCapSet) {
    // 7) Cap warnings
    const progress = evaluateCaps(operations, account.id, caps);
    const warnings = progress.filter((p) => p.status === "warning");
    if (warnings.length > 0) {
      out.push({
        id: `cap-warn:${warnings.map((w) => w.category).join(",")}`,
        priority: 2,
        toneColor: "#d97706",
        icon: "⚠",
        titleKey: "sugg.capWarn.title",
        bodyKey: "sugg.capWarn.body",
        bodyVars: { count: warnings.length },
        action: { labelKey: "sugg.action.viewCaps", anchor: "bank-anchor-flow" },
      });
    }
  }

  // 8) Stagnant recurring: any active recurring not run in 60 days
  const stale = loadRecurring().filter(
    (r) =>
      r.active &&
      r.lastRunAt &&
      Number.isFinite(new Date(r.lastRunAt).getTime()) &&
      now - new Date(r.lastRunAt).getTime() > 60 * 86_400_000,
  );
  if (stale.length > 0) {
    out.push({
      id: `stale-recurring:${stale.map((r) => r.id).join(",")}`,
      priority: 3,
      toneColor: "#64748b",
      icon: "🕸",
      titleKey: "sugg.staleRec.title",
      bodyKey: "sugg.staleRec.body",
      bodyVars: { count: stale.length },
      action: { labelKey: "sugg.action.scanSubs", anchor: "bank-anchor-recurring" },
    });
  }

  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, 6);
}
