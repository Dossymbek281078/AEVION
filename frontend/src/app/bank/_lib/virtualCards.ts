// Virtual Cards — UI-side mock for managing multiple "virtual" cards
// against a single AEC account. No real card issuing; supports naming,
// freezing, monthly spend limits, and a deterministic last-4 / brand
// mock derived from the card id so identifiers feel stable.

import type { Operation } from "./types";

const STORAGE_KEY = "aevion_bank_vcards_v1";
export const VCARDS_EVENT = "aevion:vcards-changed";

export type VCardBrand = "visa" | "mastercard" | "aevion";
export type VCardPurpose = "default" | "online" | "subscriptions" | "travel" | "shared";

export type VirtualCard = {
  id: string;
  label: string;
  brand: VCardBrand;
  purpose: VCardPurpose;
  last4: string;
  /** monthly spend limit; null = unlimited */
  limit: number | null;
  frozen: boolean;
  createdAt: string;
  /** Earliest createdAt of operations counted toward this card. */
  startTrackingFrom: string;
  /** Color accent (hex) */
  color: string;
};

const COLORS = ["#0d9488", "#0ea5e9", "#7c3aed", "#dc2626", "#d97706", "#059669"];
const BRAND_LABEL: Record<VCardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  aevion: "AEVION",
};

export function brandLabel(b: VCardBrand): string {
  return BRAND_LABEL[b];
}

function deterministicLast4(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, "0");
}

function isCard(x: unknown): x is VirtualCard {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<VirtualCard>;
  return (
    typeof c.id === "string" &&
    typeof c.label === "string" &&
    (c.brand === "visa" || c.brand === "mastercard" || c.brand === "aevion") &&
    (c.purpose === "default" ||
      c.purpose === "online" ||
      c.purpose === "subscriptions" ||
      c.purpose === "travel" ||
      c.purpose === "shared") &&
    typeof c.last4 === "string" &&
    (c.limit === null || typeof c.limit === "number") &&
    typeof c.frozen === "boolean" &&
    typeof c.createdAt === "string" &&
    typeof c.startTrackingFrom === "string" &&
    typeof c.color === "string"
  );
}

export function loadCards(): VirtualCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isCard);
  } catch {
    return [];
  }
}

export function saveCards(cards: VirtualCard[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    window.dispatchEvent(new Event(VCARDS_EVENT));
  } catch {
    // quota — silent
  }
}

export function newCard(input: {
  label: string;
  brand: VCardBrand;
  purpose: VCardPurpose;
  limit: number | null;
  index: number;
}): VirtualCard {
  const id = `vcard_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const last4 = deterministicLast4(id);
  return {
    id,
    label: input.label,
    brand: input.brand,
    purpose: input.purpose,
    last4,
    limit: input.limit,
    frozen: false,
    createdAt: new Date().toISOString(),
    startTrackingFrom: new Date().toISOString(),
    color: COLORS[input.index % COLORS.length],
  };
}

/** Total amount spent through this card this calendar month.
 *  We attribute outflows to the *first* card that matches the purpose tag,
 *  so it's stable as long as you don't reorder cards mid-month.
 *  Without per-tx card tagging this is a heuristic over operation memos /
 *  category — for the demo it shows even split as a default. */
export function spentThisMonth(
  card: VirtualCard,
  cards: VirtualCard[],
  operations: Operation[],
  myId: string,
  now: Date = new Date(),
): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  // Heuristic: spread outflows evenly across non-frozen cards by index.
  const sortedCards = [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const cardIndex = sortedCards.findIndex((c) => c.id === card.id);
  if (cardIndex === -1) return 0;
  const activeCount = Math.max(1, sortedCards.filter((c) => !c.frozen).length);

  let total = 0;
  let n = 0;
  for (const op of operations) {
    if (op.kind !== "transfer" || op.from !== myId) continue;
    const ts = new Date(op.createdAt).getTime();
    if (ts < monthStart || ts >= monthEnd) continue;
    if (ts < new Date(card.startTrackingFrom).getTime()) continue;
    if (n % activeCount === cardIndex && !card.frozen) total += op.amount;
    n++;
  }
  return total;
}

export type CardStatus = {
  card: VirtualCard;
  spent: number;
  ratio: number;
  state: "ok" | "warning" | "over" | "frozen" | "unlimited";
};

export function summariseCards(
  cards: VirtualCard[],
  operations: Operation[],
  myId: string,
  now: Date = new Date(),
): CardStatus[] {
  return cards.map((card) => {
    if (card.frozen) {
      return { card, spent: 0, ratio: 0, state: "frozen" as const };
    }
    const spent = spentThisMonth(card, cards, operations, myId, now);
    if (card.limit === null || card.limit <= 0) {
      return { card, spent, ratio: 0, state: "unlimited" as const };
    }
    const ratio = spent / card.limit;
    const state: CardStatus["state"] =
      ratio >= 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
    return { card, spent, ratio, state };
  });
}
