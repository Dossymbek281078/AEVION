// AEC Vault — simulated yield positions.
// Pure offline accounting: positions track principal + APY + lock window;
// claiming a position credits the user's balance with the accrued yield via
// the existing topup() mutation. The principal itself is never actually
// debited from balance — Vault is a *yield simulator* layered on top of
// the wallet, not real escrow.

const STORAGE_KEY = "aevion_bank_vault_positions_v1";
export const VAULT_EVENT = "aevion:vault-changed";

export type VaultTerm = 30 | 90 | 180;

export const TERM_APY: Record<VaultTerm, number> = {
  30: 0.03,
  90: 0.05,
  180: 0.08,
};

export type VaultPosition = {
  id: string;
  principal: number;
  apy: number;
  termDays: VaultTerm;
  lockedAt: string;
  lockUntil: string;
  claimedAt: string | null;
  claimedYield: number;
};

function isPosition(x: unknown): x is VaultPosition {
  if (!x || typeof x !== "object") return false;
  const p = x as Partial<VaultPosition>;
  return (
    typeof p.id === "string" &&
    typeof p.principal === "number" &&
    typeof p.apy === "number" &&
    typeof p.termDays === "number" &&
    typeof p.lockedAt === "string" &&
    typeof p.lockUntil === "string" &&
    (p.claimedAt === null || typeof p.claimedAt === "string") &&
    typeof p.claimedYield === "number"
  );
}

export function loadVault(): VaultPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isPosition);
  } catch {
    return [];
  }
}

export function saveVault(items: VaultPosition[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(VAULT_EVENT));
  } catch {
    // quota — silent
  }
}

export function newPositionId(): string {
  return `vault_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Continuous yield since lock at the position's APY, capped at lock-until. */
export function accruedYield(p: VaultPosition, now: Date = new Date()): number {
  if (p.claimedAt) return 0;
  const start = new Date(p.lockedAt).getTime();
  const end = Math.min(now.getTime(), new Date(p.lockUntil).getTime());
  const elapsedSec = Math.max(0, (end - start) / 1000);
  const yearSec = 365 * 86_400;
  return Number((p.principal * p.apy * (elapsedSec / yearSec)).toFixed(4));
}

export function isMature(p: VaultPosition, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(p.lockUntil).getTime();
}

export function timeLeftHours(p: VaultPosition, now: Date = new Date()): number {
  return Math.max(0, Math.floor((new Date(p.lockUntil).getTime() - now.getTime()) / 3_600_000));
}

/**
 * Claim a position. Returns the credited yield amount; for early claims
 * before maturity, a 50% penalty is applied to the accrued yield.
 */
export function computeClaimAmount(p: VaultPosition, now: Date = new Date()): {
  yieldEarned: number;
  penalty: number;
  net: number;
  early: boolean;
} {
  if (p.claimedAt) return { yieldEarned: 0, penalty: 0, net: 0, early: false };
  const yieldEarned = accruedYield(p, now);
  const early = !isMature(p, now);
  const penalty = early ? Number((yieldEarned * 0.5).toFixed(4)) : 0;
  const net = Number((yieldEarned - penalty).toFixed(4));
  return { yieldEarned, penalty, net, early };
}

export function lifetimeStats(positions: VaultPosition[]): {
  activeCount: number;
  lockedPrincipal: number;
  pendingYield: number;
  claimedTotal: number;
  matureCount: number;
} {
  const now = new Date();
  let activeCount = 0;
  let lockedPrincipal = 0;
  let pendingYield = 0;
  let claimedTotal = 0;
  let matureCount = 0;
  for (const p of positions) {
    if (p.claimedAt) {
      claimedTotal += p.claimedYield;
    } else {
      activeCount++;
      lockedPrincipal += p.principal;
      pendingYield += accruedYield(p, now);
      if (isMature(p, now)) matureCount++;
    }
  }
  return {
    activeCount,
    lockedPrincipal: Number(lockedPrincipal.toFixed(2)),
    pendingYield: Number(pendingYield.toFixed(2)),
    claimedTotal: Number(claimedTotal.toFixed(2)),
    matureCount,
  };
}
