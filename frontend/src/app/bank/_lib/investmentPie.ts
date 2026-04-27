// Investment Pie — auto-split rules for incoming flows.
// One global pie with two slices (goal + vault) plus the leftover that stays
// in the wallet. User applies pending splits manually; applied op-ids are
// tracked so the same inflow is never double-routed.

import type { Operation } from "./types";
import { type VaultTerm } from "./vault";

const STORAGE_KEY = "aevion_bank_pie_v1";
const APPLIED_KEY = "aevion_bank_pie_applied_v1";
export const PIE_EVENT = "aevion:pie-changed";

export type PieConfig = {
  enabled: boolean;
  threshold: number;
  goalId: string | null;
  goalPct: number;
  vaultTermDays: VaultTerm;
  vaultPct: number;
  lifetimeApplied: number;
  lifetimeRouted: number;
};

export const DEFAULT_PIE: PieConfig = {
  enabled: false,
  threshold: 50,
  goalId: null,
  goalPct: 20,
  vaultTermDays: 90,
  vaultPct: 10,
  lifetimeApplied: 0,
  lifetimeRouted: 0,
};

function isConfig(x: unknown): x is PieConfig {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<PieConfig>;
  return (
    typeof c.enabled === "boolean" &&
    typeof c.threshold === "number" &&
    (c.goalId === null || typeof c.goalId === "string") &&
    typeof c.goalPct === "number" &&
    (c.vaultTermDays === 30 || c.vaultTermDays === 90 || c.vaultTermDays === 180) &&
    typeof c.vaultPct === "number" &&
    typeof c.lifetimeApplied === "number" &&
    typeof c.lifetimeRouted === "number"
  );
}

export function loadPie(): PieConfig {
  if (typeof window === "undefined") return { ...DEFAULT_PIE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PIE };
    const parsed = JSON.parse(raw);
    return isConfig(parsed) ? parsed : { ...DEFAULT_PIE };
  } catch {
    return { ...DEFAULT_PIE };
  }
}

export function savePie(c: PieConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    window.dispatchEvent(new Event(PIE_EVENT));
  } catch {
    // quota — silent
  }
}

export function loadApplied(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(APPLIED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveApplied(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPLIED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // quota — silent
  }
}

export function isInflowToMe(op: Operation, myId: string): boolean {
  if (op.kind === "topup") return true;
  if (op.kind === "transfer" && op.to === myId) return true;
  return false;
}

export function pendingInflows(
  operations: Operation[],
  myId: string,
  cfg: PieConfig,
  applied: Set<string>,
): Operation[] {
  return operations.filter(
    (op) => isInflowToMe(op, myId) && op.amount >= cfg.threshold && !applied.has(op.id),
  );
}

export function splitFor(op: Operation, cfg: PieConfig): {
  goal: number;
  vault: number;
  remainder: number;
} {
  const goal = Number((op.amount * (cfg.goalPct / 100)).toFixed(2));
  const vault = Number((op.amount * (cfg.vaultPct / 100)).toFixed(2));
  const remainder = Number((op.amount - goal - vault).toFixed(2));
  return { goal, vault, remainder };
}
