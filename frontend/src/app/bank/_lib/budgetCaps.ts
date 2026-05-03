// Budget Caps — monthly spending limit per category.
// Pure-derivation observer over operations + spending categorise().
// Stored in localStorage; no backend.

import { categorise, type SpendCategory } from "./spending";
import type { Operation } from "./types";

const STORAGE_KEY = "aevion_bank_budget_caps_v1";
export const BUDGET_CAPS_EVENT = "aevion:budget-caps-changed";

export type BudgetCaps = Record<SpendCategory, number | null>;

export const DEFAULT_CAPS: BudgetCaps = {
  subscriptions: null,
  tips: null,
  contacts: null,
  untagged: null,
};

function isCaps(x: unknown): x is BudgetCaps {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<BudgetCaps>;
  for (const cat of ["subscriptions", "tips", "contacts", "untagged"] as SpendCategory[]) {
    const v = c[cat];
    if (v !== null && typeof v !== "number") return false;
  }
  return true;
}

export function loadBudgetCaps(): BudgetCaps {
  if (typeof window === "undefined") return { ...DEFAULT_CAPS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CAPS };
    const parsed = JSON.parse(raw);
    return isCaps(parsed) ? { ...DEFAULT_CAPS, ...parsed } : { ...DEFAULT_CAPS };
  } catch {
    return { ...DEFAULT_CAPS };
  }
}

export function saveBudgetCaps(caps: BudgetCaps): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(caps));
    window.dispatchEvent(new Event(BUDGET_CAPS_EVENT));
  } catch {
    // quota — silent
  }
}

export type CapStatus = "ok" | "warning" | "breach" | "uncapped";

export type CapProgress = {
  category: SpendCategory;
  cap: number | null;
  spent: number;
  ratio: number;
  status: CapStatus;
};

/** Returns spending-this-month per category against caps. */
export function evaluateCaps(
  operations: Operation[],
  myId: string,
  caps: BudgetCaps,
  now: Date = new Date(),
): CapProgress[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const spent: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };
  for (const op of operations) {
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < monthStart || ts >= monthEnd) continue;
    const cat = categorise(op, myId);
    if (!cat) continue;
    spent[cat] += op.amount;
  }
  return (Object.keys(spent) as SpendCategory[]).map((c) => {
    const cap = caps[c];
    const amt = spent[c];
    if (cap === null || cap <= 0) {
      return { category: c, cap, spent: amt, ratio: 0, status: "uncapped" };
    }
    const ratio = amt / cap;
    const status: CapStatus = ratio >= 1 ? "breach" : ratio >= 0.8 ? "warning" : "ok";
    return { category: c, cap, spent: amt, ratio, status };
  });
}
