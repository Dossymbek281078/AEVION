// Round-Up Stash — virtual savings that grows from spare change.
// Pure-derivation observer: each outgoing transfer rounds up to the next
// whole 1 / 5 / 10 AEC; the rounding diff accumulates into a virtual stash
// shown to the user. When user "claims" the stash, the diff is added to a
// chosen goal via useSavings.contribute(); a `realizedAt` cursor stores the
// timestamp of the last claim so we don't double-count past ops.

import type { Operation } from "./types";

const CONFIG_KEY = "aevion_bank_roundup_config_v1";
export const ROUNDUP_EVENT = "aevion:roundup-changed";

export type RoundUpIncrement = 1 | 5 | 10;

export type RoundUpConfig = {
  enabled: boolean;
  increment: RoundUpIncrement;
  /** Goal id to receive the stash on claim. null = unclaimed pool. */
  targetGoalId: string | null;
  /** ISO timestamp of last realize-claim — ops before this are ignored. */
  realizedCursor: string | null;
  /** Lifetime AEC redirected to goals via round-up (informational). */
  lifetimeRealized: number;
};

export const DEFAULT_CONFIG: RoundUpConfig = {
  enabled: false,
  increment: 1,
  targetGoalId: null,
  realizedCursor: null,
  lifetimeRealized: 0,
};

function isConfig(x: unknown): x is RoundUpConfig {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<RoundUpConfig>;
  return (
    typeof c.enabled === "boolean" &&
    (c.increment === 1 || c.increment === 5 || c.increment === 10) &&
    (c.targetGoalId === null || typeof c.targetGoalId === "string") &&
    (c.realizedCursor === null || typeof c.realizedCursor === "string") &&
    typeof c.lifetimeRealized === "number"
  );
}

export function loadRoundUpConfig(): RoundUpConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return isConfig(parsed) ? parsed : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveRoundUpConfig(c: RoundUpConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    window.dispatchEvent(new Event(ROUNDUP_EVENT));
  } catch {
    // quota — silent
  }
}

/** Diff between `amount` and the next multiple of `increment`. */
export function roundUpDiff(amount: number, increment: RoundUpIncrement): number {
  if (amount <= 0) return 0;
  const remainder = amount % increment;
  if (remainder === 0) return 0;
  return Number((increment - remainder).toFixed(2));
}

/** Sum of round-up diffs from outgoing transfers since `cursorMs`. */
export function pendingStash(
  operations: Operation[],
  myId: string,
  increment: RoundUpIncrement,
  cursorMs: number,
): { amount: number; opCount: number } {
  let total = 0;
  let count = 0;
  for (const op of operations) {
    if (op.kind !== "transfer") continue;
    if (op.from !== myId) continue;
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts) || ts <= cursorMs) continue;
    const diff = roundUpDiff(op.amount, increment);
    if (diff <= 0) continue;
    total += diff;
    count++;
  }
  return { amount: Number(total.toFixed(2)), opCount: count };
}

/** Year-to-date stash (claimed + pending) — informational, for the "saved this year" tile. */
export function yearToDateStash(
  operations: Operation[],
  myId: string,
  increment: RoundUpIncrement,
  lifetimeRealized: number,
): { ytd: number; pendingThisYear: number } {
  const start = new Date(new Date().getFullYear(), 0, 1).getTime();
  let pending = 0;
  for (const op of operations) {
    if (op.kind !== "transfer" || op.from !== myId) continue;
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < start) continue;
    pending += roundUpDiff(op.amount, increment);
  }
  pending = Number(pending.toFixed(2));
  // lifetimeRealized is cumulative across all years; we approximate "ytd realized" as
  // min(lifetimeRealized, pending) since that's the upper bound of what could have been
  // realized this year. Good enough for the informational tile.
  const realizedThisYear = Math.min(lifetimeRealized, pending);
  return { ytd: pending, pendingThisYear: pending - realizedThisYear };
}
