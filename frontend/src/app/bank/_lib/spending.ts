// Client-side spending insights — auto-categorisation of outgoing operations.
// Pure derivation from data we already have (operations + recurring + contacts).
// No new backend endpoint required.

import { contactsById } from "./contacts";
import { loadRecurring } from "./recurring";
import type { Operation } from "./types";

export type SpendCategory = "subscriptions" | "tips" | "contacts" | "untagged";

export const CATEGORY_LABEL: Record<SpendCategory, string> = {
  subscriptions: "Subscriptions",
  tips: "Tips & micro",
  contacts: "Contacts",
  untagged: "Other transfers",
};

export const CATEGORY_COLOR: Record<SpendCategory, string> = {
  subscriptions: "#d97706",
  tips: "#db2777",
  contacts: "#0ea5e9",
  untagged: "#475569",
};

export const CATEGORY_DESCRIPTION: Record<SpendCategory, string> = {
  subscriptions: "Outgoing matched to a recurring schedule",
  tips: "Small outgoing transfers under 5 AEC",
  contacts: "Outgoing to people in your address book",
  untagged: "Outgoing transfers we couldn't classify",
};

// i18n keys parallel to CATEGORY_LABEL / CATEGORY_DESCRIPTION.
// UI should use these with the global `t()` helper; raw English maps stay for export paths.
export const CATEGORY_LABEL_KEY: Record<SpendCategory, string> = {
  subscriptions: "spending.category.subscriptions.label",
  tips: "spending.category.tips.label",
  contacts: "spending.category.contacts.label",
  untagged: "spending.category.untagged.label",
};

export const CATEGORY_DESCRIPTION_KEY: Record<SpendCategory, string> = {
  subscriptions: "spending.category.subscriptions.description",
  tips: "spending.category.tips.description",
  contacts: "spending.category.contacts.description",
  untagged: "spending.category.untagged.description",
};

export type CategorisedOp = {
  op: Operation;
  category: SpendCategory;
  signed: number;
};

export type CategoryBreakdown = {
  category: SpendCategory;
  amount: number;
  count: number;
};

export type SpendingPeriod = "thisMonth" | "last30d";

export const PERIOD_LABEL: Record<SpendingPeriod, string> = {
  thisMonth: "This month",
  last30d: "Last 30 days",
};

export const PERIOD_LABEL_KEY: Record<SpendingPeriod, string> = {
  thisMonth: "spending.period.thisMonth.label",
  last30d: "spending.period.last30d.label",
};

function periodWindow(period: SpendingPeriod): { start: number; end: number; prevStart: number; prevEnd: number } {
  const end = Date.now();
  if (period === "last30d") {
    const start = end - 30 * 86_400_000;
    const prevEnd = start;
    const prevStart = prevEnd - 30 * 86_400_000;
    return { start, end, prevStart, prevEnd };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevEnd = start;
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  return { start, end, prevStart, prevEnd };
}

export function categorise(op: Operation, accountId: string): SpendCategory | null {
  if (op.kind === "topup") return null;
  if (op.from !== accountId) return null;
  const recurring = loadRecurring();
  const cb = contactsById();
  for (const r of recurring) {
    if (r.toAccountId === op.to && Math.abs(r.amount - op.amount) < 0.01) return "subscriptions";
  }
  if (op.amount < 5) return "tips";
  if (op.to && cb.has(op.to)) return "contacts";
  return "untagged";
}

export function categoriseOps(ops: Operation[], accountId: string): CategorisedOp[] {
  const out: CategorisedOp[] = [];
  for (const op of ops) {
    const cat = categorise(op, accountId);
    if (!cat) continue;
    out.push({ op, category: cat, signed: -op.amount });
  }
  return out;
}

export type SpendingSummary = {
  period: SpendingPeriod;
  totalSpent: number;
  totalSpentPrev: number;
  pctVsPrev: number;
  byCategory: CategoryBreakdown[];
  byCategoryPrev: Record<SpendCategory, number>;
  topCategory: SpendCategory | null;
  biggestTx: { op: Operation; category: SpendCategory } | null;
  count: number;
};

export function summariseSpending(
  ops: Operation[],
  accountId: string,
  period: SpendingPeriod,
): SpendingSummary {
  const win = periodWindow(period);

  const byCat: Record<SpendCategory, { amount: number; count: number }> = {
    subscriptions: { amount: 0, count: 0 },
    tips: { amount: 0, count: 0 },
    contacts: { amount: 0, count: 0 },
    untagged: { amount: 0, count: 0 },
  };
  const byCatPrev: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };

  let totalSpent = 0;
  let totalSpentPrev = 0;
  let count = 0;
  let biggest: { op: Operation; category: SpendCategory } | null = null;

  for (const op of ops) {
    const cat = categorise(op, accountId);
    if (!cat) continue;
    const t = new Date(op.createdAt).getTime();
    if (!Number.isFinite(t)) continue;

    if (t >= win.start && t <= win.end) {
      byCat[cat].amount += op.amount;
      byCat[cat].count++;
      totalSpent += op.amount;
      count++;
      if (!biggest || op.amount > biggest.op.amount) biggest = { op, category: cat };
    } else if (t >= win.prevStart && t < win.prevEnd) {
      byCatPrev[cat] += op.amount;
      totalSpentPrev += op.amount;
    }
  }

  const breakdown: CategoryBreakdown[] = (Object.keys(byCat) as SpendCategory[])
    .map((c) => ({ category: c, amount: byCat[c].amount, count: byCat[c].count }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = breakdown.find((b) => b.amount > 0)?.category ?? null;
  const pctVsPrev =
    totalSpentPrev > 0
      ? ((totalSpent - totalSpentPrev) / totalSpentPrev) * 100
      : totalSpent > 0
        ? 100
        : 0;

  return {
    period,
    totalSpent,
    totalSpentPrev,
    pctVsPrev,
    byCategory: breakdown,
    byCategoryPrev: byCatPrev,
    topCategory,
    biggestTx: biggest,
    count,
  };
}
