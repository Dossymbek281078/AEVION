// Smart Subscription Scanner — flags stale / expensive / duplicate recurring entries.
// Pure derivation over loadRecurring() + spending categorisation.

import { type Recurring } from "./recurring";

export type ScanFlag = "stale" | "expensive" | "duplicate";

export type ScanFinding = {
  recurring: Recurring;
  flags: ScanFlag[];
  severity: "low" | "medium" | "high";
  // For "expensive" flag: how many × the median this entry is
  expensiveRatio: number | null;
  // For "duplicate" flag: ids of other recurring entries with same recipient + amount + period
  duplicateOfIds: string[];
  // Days since last run, or null if never ran
  daysSinceRun: number | null;
};

const STALE_DAYS = 60;
const EXPENSIVE_RATIO = 2;

function periodMonthlyEquivalent(amount: number, period: Recurring["period"]): number {
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function scanRecurring(items: Recurring[]): ScanFinding[] {
  if (items.length === 0) return [];

  const monthlyEquivs = items
    .filter((r) => r.active)
    .map((r) => periodMonthlyEquivalent(r.amount, r.period));
  const medianMonthly = median(monthlyEquivs);

  // Build duplicate buckets keyed by recipient + period + rounded amount
  const byKey = new Map<string, Recurring[]>();
  for (const r of items) {
    const key = `${r.toAccountId}|${r.period}|${r.amount.toFixed(2)}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }

  const out: ScanFinding[] = [];
  for (const r of items) {
    const flags: ScanFlag[] = [];
    let expensiveRatio: number | null = null;
    let duplicateOfIds: string[] = [];

    // Stale check
    let daysSinceRun: number | null = null;
    if (r.lastRunAt) {
      const last = new Date(r.lastRunAt).getTime();
      if (Number.isFinite(last)) {
        daysSinceRun = Math.floor((Date.now() - last) / 86_400_000);
      }
    } else {
      // never ran — count from creation
      const created = new Date(r.createdAt).getTime();
      if (Number.isFinite(created)) {
        daysSinceRun = Math.floor((Date.now() - created) / 86_400_000);
      }
    }
    if (r.active && daysSinceRun !== null && daysSinceRun >= STALE_DAYS) {
      flags.push("stale");
    }

    // Expensive check (only if median > 0 and entry is active)
    if (r.active && medianMonthly > 0) {
      const myMonthly = periodMonthlyEquivalent(r.amount, r.period);
      const ratio = myMonthly / medianMonthly;
      if (ratio >= EXPENSIVE_RATIO) {
        flags.push("expensive");
        expensiveRatio = ratio;
      }
    }

    // Duplicate check
    const key = `${r.toAccountId}|${r.period}|${r.amount.toFixed(2)}`;
    const bucket = byKey.get(key) ?? [];
    if (bucket.length > 1) {
      flags.push("duplicate");
      duplicateOfIds = bucket.filter((b) => b.id !== r.id).map((b) => b.id);
    }

    if (flags.length === 0) continue;

    const severity: ScanFinding["severity"] =
      flags.length >= 2 ? "high" : flags.includes("duplicate") ? "medium" : "low";

    out.push({ recurring: r, flags, severity, expensiveRatio, duplicateOfIds, daysSinceRun });
  }
  return out;
}

export function totalMonthlySpend(items: Recurring[]): number {
  return items
    .filter((r) => r.active)
    .reduce((s, r) => s + periodMonthlyEquivalent(r.amount, r.period), 0);
}
