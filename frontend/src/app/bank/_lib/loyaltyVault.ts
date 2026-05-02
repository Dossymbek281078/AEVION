// Loyalty Vault — track external loyalty programs (airlines, retailers,
// neobanks) with point balances + expiry. Pure local; no real
// integrations. Surfaces "expiring soon" rewards so users don't lose
// points the way they always do.

const STORAGE_KEY = "aevion_bank_loyalty_v1";
export const LOYALTY_EVENT = "aevion:loyalty-changed";

export type LoyaltyKind = "airline" | "hotel" | "retail" | "cashback" | "other";

export type LoyaltyAccount = {
  id: string;
  brand: string;
  kind: LoyaltyKind;
  /** Points / miles balance (integer). */
  points: number;
  /** Optional notional cash value of one point in user's currency. */
  pointValue: number | null;
  /** ISO date when current points expire; null = no expiry. */
  expiresOn: string | null;
  /** Free-form member id (last-6 displayed only). */
  memberRef: string;
  notes: string;
  color: string;
  createdAt: string;
};

const PALETTE = ["#0d9488", "#0ea5e9", "#7c3aed", "#dc2626", "#d97706", "#059669", "#2563eb", "#db2777"];

function isAccount(x: unknown): x is LoyaltyAccount {
  if (!x || typeof x !== "object") return false;
  const a = x as Partial<LoyaltyAccount>;
  return (
    typeof a.id === "string" &&
    typeof a.brand === "string" &&
    (a.kind === "airline" || a.kind === "hotel" || a.kind === "retail" || a.kind === "cashback" || a.kind === "other") &&
    typeof a.points === "number" &&
    (a.pointValue === null || typeof a.pointValue === "number") &&
    (a.expiresOn === null || typeof a.expiresOn === "string") &&
    typeof a.memberRef === "string" &&
    typeof a.notes === "string" &&
    typeof a.color === "string" &&
    typeof a.createdAt === "string"
  );
}

export function loadLoyalty(): LoyaltyAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isAccount);
  } catch {
    return [];
  }
}

export function saveLoyalty(items: LoyaltyAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(LOYALTY_EVENT));
  } catch {
    // quota — silent
  }
}

export function newLoyalty(input: {
  brand: string;
  kind: LoyaltyKind;
  points: number;
  pointValue: number | null;
  expiresOn: string | null;
  memberRef?: string;
  notes?: string;
  index: number;
}): LoyaltyAccount {
  const id = `loy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    brand: input.brand,
    kind: input.kind,
    points: input.points,
    pointValue: input.pointValue,
    expiresOn: input.expiresOn,
    memberRef: input.memberRef ?? "",
    notes: input.notes ?? "",
    color: PALETTE[input.index % PALETTE.length],
    createdAt: new Date().toISOString(),
  };
}

export type LoyaltyStatus = "fresh" | "active" | "expiringSoon" | "expired" | "noExpiry";

export function statusOf(a: LoyaltyAccount, now: Date = new Date()): LoyaltyStatus {
  if (!a.expiresOn) return "noExpiry";
  const ts = new Date(a.expiresOn).getTime();
  if (!Number.isFinite(ts)) return "noExpiry";
  const diffDays = (ts - now.getTime()) / 86_400_000;
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiringSoon";
  if (diffDays <= 180) return "active";
  return "fresh";
}

export function totalEstimatedValue(items: LoyaltyAccount[]): number {
  return items.reduce((s, a) => {
    if (a.pointValue == null) return s;
    if (statusOf(a) === "expired") return s;
    return s + a.points * a.pointValue;
  }, 0);
}

export function expiringSoonCount(items: LoyaltyAccount[]): number {
  return items.filter((a) => statusOf(a) === "expiringSoon").length;
}

export function maskedRef(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 6) return trimmed;
  return `…${trimmed.slice(-6)}`;
}
