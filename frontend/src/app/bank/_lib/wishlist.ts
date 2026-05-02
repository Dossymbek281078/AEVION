// Smart Wishlist — items the user wants, each with its own auto-savings
// counter. When savedSoFar >= priceAec the item flips to "ready". Pure
// localStorage; the saved counter is logical only — money stays in the
// main wallet (same convention as SavingsGoals).

const STORAGE_KEY = "aevion_bank_wishlist_v1";
export const WISHLIST_EVENT = "aevion:wishlist-changed";

export type WishPriority = "must" | "nice" | "dream";
export type WishStatus = "saving" | "ready" | "purchased" | "dropped";

export type WishItem = {
  id: string;
  label: string;
  url: string;
  priceAec: number;
  savedSoFar: number;
  priority: WishPriority;
  targetDateISO: string | null;
  notes: string;
  emoji: string;
  status: WishStatus;
  createdAt: string;
  closedAt: string | null;
};

export const PRIORITY_RANK: Record<WishPriority, number> = {
  must: 0,
  nice: 1,
  dream: 2,
};

const EMOJI_FALLBACKS = ["🎁", "🛍", "📱", "💻", "🎧", "📚", "🚲", "🛻", "👟", "🪑"];

function isItem(x: unknown): x is WishItem {
  if (!x || typeof x !== "object") return false;
  const i = x as Partial<WishItem>;
  return (
    typeof i.id === "string" &&
    typeof i.label === "string" &&
    typeof i.url === "string" &&
    typeof i.priceAec === "number" &&
    typeof i.savedSoFar === "number" &&
    (i.priority === "must" || i.priority === "nice" || i.priority === "dream") &&
    (i.targetDateISO === null || typeof i.targetDateISO === "string") &&
    typeof i.notes === "string" &&
    typeof i.emoji === "string" &&
    (i.status === "saving" || i.status === "ready" || i.status === "purchased" || i.status === "dropped") &&
    typeof i.createdAt === "string" &&
    (i.closedAt === null || typeof i.closedAt === "string")
  );
}

export function loadWishlist(): WishItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isItem);
  } catch {
    return [];
  }
}

export function saveWishlist(items: WishItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(WISHLIST_EVENT));
  } catch {
    // quota — silent
  }
}

export function newItem(input: {
  label: string;
  url: string;
  priceAec: number;
  priority: WishPriority;
  targetDateISO: string | null;
  notes: string;
  emoji: string;
}): WishItem {
  const id = `wish_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: input.label,
    url: input.url,
    priceAec: input.priceAec,
    savedSoFar: 0,
    priority: input.priority,
    targetDateISO: input.targetDateISO,
    notes: input.notes,
    emoji: input.emoji || EMOJI_FALLBACKS[Math.floor(Math.random() * EMOJI_FALLBACKS.length)],
    status: "saving",
    createdAt: new Date().toISOString(),
    closedAt: null,
  };
}

export function refreshStatus(items: WishItem[]): WishItem[] {
  let mutated = false;
  const out = items.map((it) => {
    if (it.status === "saving" && it.savedSoFar >= it.priceAec) {
      mutated = true;
      return { ...it, status: "ready" as const };
    }
    if (it.status === "ready" && it.savedSoFar < it.priceAec) {
      mutated = true;
      return { ...it, status: "saving" as const };
    }
    return it;
  });
  return mutated ? out : items;
}

export function activeItems(items: WishItem[]): WishItem[] {
  return items.filter((i) => i.status === "saving" || i.status === "ready");
}

export function totalSaved(items: WishItem[]): number {
  return activeItems(items).reduce((s, i) => s + i.savedSoFar, 0);
}

export function totalGoalPrice(items: WishItem[]): number {
  return activeItems(items).reduce((s, i) => s + i.priceAec, 0);
}

export function readyCount(items: WishItem[]): number {
  return items.filter((i) => i.status === "ready").length;
}

export function paceHint(item: WishItem, now: Date = new Date()): {
  perDay: number;
  daysToTarget: number | null;
} {
  const ageDays = Math.max(0.1, (now.getTime() - new Date(item.createdAt).getTime()) / 86_400_000);
  const perDay = item.savedSoFar / ageDays;
  const remaining = Math.max(0, item.priceAec - item.savedSoFar);
  const daysToTarget = perDay > 0 ? remaining / perDay : null;
  return { perDay, daysToTarget };
}
