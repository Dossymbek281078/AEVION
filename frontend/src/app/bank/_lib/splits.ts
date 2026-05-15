// Split bills — divide a total between contacts and track who paid.
// Everything local (localStorage). Marks-as-paid are manual; future backend would
// cross-reference incoming transfers by memo.

const STORAGE_KEY = "aevion_bank_splits_v1";
export const SPLITS_EVENT = "aevion:splits-changed";

export type SplitShare = {
  accountId: string;
  nickname: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
};

export type SplitBill = {
  id: string;
  label: string;
  totalAec: number;
  createdAt: string;
  shares: SplitShare[];
};

function isShare(x: unknown): x is SplitShare {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<SplitShare>;
  return (
    typeof s.accountId === "string" &&
    typeof s.nickname === "string" &&
    typeof s.amount === "number" &&
    typeof s.paid === "boolean"
  );
}

function isBill(x: unknown): x is SplitBill {
  if (!x || typeof x !== "object") return false;
  const b = x as Partial<SplitBill>;
  return (
    typeof b.id === "string" &&
    typeof b.label === "string" &&
    typeof b.totalAec === "number" &&
    typeof b.createdAt === "string" &&
    Array.isArray(b.shares) &&
    b.shares.every(isShare)
  );
}

export function loadSplits(): SplitBill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isBill);
  } catch {
    return [];
  }
}

export function saveSplits(items: SplitBill[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(SPLITS_EVENT));
  } catch {
    // ignore
  }
}

// Equal split with rounding to 2dp; any leftover cents go to the first participant.
export function splitEqually(
  total: number,
  participants: Array<{ accountId: string; nickname: string }>,
): SplitShare[] {
  if (participants.length === 0) return [];
  const baseRaw = total / participants.length;
  const rounded = Math.floor(baseRaw * 100) / 100;
  const assigned = rounded * participants.length;
  const leftover = +(total - assigned).toFixed(2);
  return participants.map((p, i) => ({
    accountId: p.accountId,
    nickname: p.nickname,
    amount: i === 0 ? +(rounded + leftover).toFixed(2) : rounded,
    paid: false,
    paidAt: null,
  }));
}

export function billStatus(b: SplitBill): { paid: number; total: number; settled: boolean } {
  let paid = 0;
  for (const s of b.shares) if (s.paid) paid++;
  return { paid, total: b.shares.length, settled: paid === b.shares.length && b.shares.length > 0 };
}
