// Spending Forecast — projects next month's outflow per category from
// recurring schedules + historical category run-rate.
//
// Method:
//   1. For each active recurring entry, project monthly contribution
//      (period-normalised to monthly equivalent).
//   2. For non-subscription categories, take average of last 30 / 90 days
//      and use the higher floor as ad-hoc baseline.
//   3. Confidence band = ±25% on each projection (rough heuristic).
// Pure derivation; no separate state.

import { categorise, type SpendCategory } from "./spending";
import { loadRecurring, type Recurring } from "./recurring";
import type { Operation } from "./types";

export type CategoryForecast = {
  category: SpendCategory;
  projected: number;
  low: number;
  high: number;
  currentMonth: number;
  prevMonth: number;
  confidencePct: number;
};

export type SpendForecast = {
  categories: CategoryForecast[];
  total: { projected: number; low: number; high: number };
  recurringMonthly: number;
  adHocMonthly: number;
};

function periodMonthly(amount: number, period: Recurring["period"]): number {
  switch (period) {
    case "daily":
      return amount * 30;
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "monthly":
      return amount;
  }
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function computeSpendForecast(
  operations: Operation[],
  myId: string,
  now: Date = new Date(),
): SpendForecast {
  const recurring = loadRecurring().filter((r) => r.active);
  const recurringByCat: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };
  for (const r of recurring) {
    // Treat all active recurring as "subscriptions" for forecast purposes
    recurringByCat.subscriptions += periodMonthly(r.amount, r.period);
  }

  // Historical 30 / 90 day spend per category
  const t = now.getTime();
  const last30 = t - 30 * 86_400_000;
  const last90 = t - 90 * 86_400_000;
  const byCat30: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };
  const byCat90: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };
  // Current calendar month + previous calendar month
  const monthStart = startOfMonth(now).getTime();
  const prevMonthStart = startOfMonth(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  ).getTime();
  const byCatCurMonth: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };
  const byCatPrevMonth: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };

  for (const op of operations) {
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    const cat = categorise(op, myId);
    if (!cat) continue;

    if (ts >= last30) byCat30[cat] += op.amount;
    if (ts >= last90) byCat90[cat] += op.amount;
    if (ts >= monthStart) byCatCurMonth[cat] += op.amount;
    if (ts >= prevMonthStart && ts < monthStart) byCatPrevMonth[cat] += op.amount;
  }

  const cats: SpendCategory[] = ["subscriptions", "tips", "contacts", "untagged"];
  const projections: CategoryForecast[] = cats.map((c) => {
    const adHoc30 = byCat30[c];
    const adHoc90Avg = byCat90[c] / 3;
    // Use the larger of recent 30d and 90-day average to be slightly conservative
    const adHocBase = Math.max(adHoc30, adHoc90Avg);
    const recurringMonthly = recurringByCat[c];
    // For subscriptions, recurring covers it; subtract overlap with adHoc
    let projected: number;
    if (c === "subscriptions") {
      projected = Math.max(recurringMonthly, adHocBase);
    } else {
      projected = adHocBase;
    }
    const low = projected * 0.75;
    const high = projected * 1.25;
    // Confidence: more historical data → higher confidence
    const sample90 = byCat90[c];
    const confidencePct =
      sample90 > 0 ? Math.min(95, 60 + Math.log10(sample90 + 1) * 10) : 50;
    return {
      category: c,
      projected: Number(projected.toFixed(2)),
      low: Number(low.toFixed(2)),
      high: Number(high.toFixed(2)),
      currentMonth: Number(byCatCurMonth[c].toFixed(2)),
      prevMonth: Number(byCatPrevMonth[c].toFixed(2)),
      confidencePct: Math.round(confidencePct),
    };
  });

  const total = {
    projected: Number(projections.reduce((s, p) => s + p.projected, 0).toFixed(2)),
    low: Number(projections.reduce((s, p) => s + p.low, 0).toFixed(2)),
    high: Number(projections.reduce((s, p) => s + p.high, 0).toFixed(2)),
  };

  const recurringMonthlyTotal = Object.values(recurringByCat).reduce((s, v) => s + v, 0);
  const adHocMonthly = Math.max(0, total.projected - recurringMonthlyTotal);

  return {
    categories: projections,
    total,
    recurringMonthly: Number(recurringMonthlyTotal.toFixed(2)),
    adHocMonthly: Number(adHocMonthly.toFixed(2)),
  };
}
