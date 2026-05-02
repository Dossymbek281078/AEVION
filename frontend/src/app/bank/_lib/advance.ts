// Instant salary advance — credit line keyed to Trust Score tier.
// TODO backend: dedicated credit table + repayment hook on incoming ops.
// Current demo: principal is delivered via qtrade topup; ledger tracked in localStorage;
// repayments simulated on a visual tick (1% outstanding every 4 seconds).

const STORAGE_KEY = "aevion_bank_advance_v1";

import type { TrustTier } from "./trust";

export type Repayment = {
  amount: number;
  at: string;
  kind: "auto" | "manual";
};

export type Advance = {
  id: string;
  principal: number;
  outstanding: number;
  startedAt: string;
  repayments: Repayment[];
  closedAt: string | null;
};

export type Eligibility = {
  limit: number;
  rateLabel: string;
  reason: string;
};

export function eligibilityFor(tier: TrustTier): Eligibility {
  switch (tier) {
    case "new":
      return { limit: 0, rateLabel: "—", reason: "Build Trust Score to unlock advances" };
    case "growing":
      return { limit: 100, rateLabel: "~1%/day", reason: "Growing reputation — small advances available" };
    case "trusted":
      return { limit: 500, rateLabel: "~1%/day", reason: "Trusted — mid-range advances available" };
    case "elite":
      return { limit: 2000, rateLabel: "~1%/day", reason: "Elite — flagship advance limit unlocked" };
  }
}

function isAdvance(x: unknown): x is Advance {
  if (!x || typeof x !== "object") return false;
  const a = x as Partial<Advance>;
  return (
    typeof a.id === "string" &&
    typeof a.principal === "number" &&
    typeof a.outstanding === "number" &&
    typeof a.startedAt === "string"
  );
}

export function loadAdvance(): Advance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return isAdvance(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveAdvance(a: Advance | null): void {
  if (typeof window === "undefined") return;
  try {
    if (a) localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function newAdvance(principal: number): Advance {
  return {
    id: `adv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    principal,
    outstanding: principal,
    startedAt: new Date().toISOString(),
    repayments: [],
    closedAt: null,
  };
}
