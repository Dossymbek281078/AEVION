// Gift cards — decorated transfers with a message and visual theme.
// TODO backend: shared /api/gifts store + /bank/gift/[id] pickup route so the recipient
// sees the card. Currently sender-side history only; money transfers via normal qtrade.

const STORAGE_KEY = "aevion_bank_gifts_v1";
const MAX_KEEP = 30;
export const GIFTS_EVENT = "aevion:gifts-changed";
/** Commit-lock window — no cancel after this many ms until unlockAt remain.
 *  Prevents last-second revocation. */
export const GIFT_COMMIT_LOCK_MS = 60 * 60 * 1000; // 1 hour

export type GiftThemeId =
  | "birthday"
  | "thanks"
  | "wedding"
  | "congrats"
  | "royalty"
  | "general";

export type GiftTheme = {
  id: GiftThemeId;
  label: string;
  gradient: string;
  accent: string;
  icon: string;
  textColor: string;
};

export const GIFT_THEMES: GiftTheme[] = [
  {
    id: "birthday",
    label: "Birthday",
    gradient: "linear-gradient(135deg, #db2777 0%, #f59e0b 100%)",
    accent: "#fde047",
    icon: "♫",
    textColor: "#ffffff",
  },
  {
    id: "thanks",
    label: "Thank you",
    gradient: "linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)",
    accent: "#99f6e4",
    icon: "♥",
    textColor: "#ffffff",
  },
  {
    id: "wedding",
    label: "Wedding",
    gradient: "linear-gradient(135deg, #f472b6 0%, #fdf2f8 100%)",
    accent: "#fbcfe8",
    icon: "☆",
    textColor: "#831843",
  },
  {
    id: "congrats",
    label: "Congrats",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)",
    accent: "#e9d5ff",
    icon: "★",
    textColor: "#ffffff",
  },
  {
    id: "royalty",
    label: "Royalty",
    gradient: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
    accent: "#78350f",
    icon: "✦",
    textColor: "#ffffff",
  },
  {
    id: "general",
    label: "General",
    gradient: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
    accent: "#cbd5e1",
    icon: "◆",
    textColor: "#ffffff",
  },
];

export function getTheme(id: GiftThemeId): GiftTheme {
  return GIFT_THEMES.find((t) => t.id === id) ?? GIFT_THEMES[GIFT_THEMES.length - 1];
}

export type GiftStatus = "pending" | "sent" | "cancelled";

export type Gift = {
  id: string;
  recipientAccountId: string;
  recipientNickname: string;
  amount: number;
  themeId: GiftThemeId;
  message: string;
  sentAt: string;
  /** ISO timestamp — when transfer should auto-fire. If missing or ≤ sentAt,
   *  the gift was sent immediately (legacy behaviour). */
  unlockAt?: string;
  /** "pending" until unlock fires; "sent" once the transfer landed;
   *  "cancelled" if the sender aborted before the commit-lock window. */
  status?: GiftStatus;
};

function isGift(x: unknown): x is Gift {
  if (!x || typeof x !== "object") return false;
  const g = x as Partial<Gift>;
  return (
    typeof g.id === "string" &&
    typeof g.recipientAccountId === "string" &&
    typeof g.amount === "number" &&
    typeof g.themeId === "string" &&
    typeof g.message === "string" &&
    typeof g.sentAt === "string"
  );
}

export function loadGifts(): Gift[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isGift).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  } catch {
    return [];
  }
}

export function saveGifts(items: Gift[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_KEEP)));
    window.dispatchEvent(new Event(GIFTS_EVENT));
  } catch {
    // ignore
  }
}

export function appendGift(g: Gift): void {
  saveGifts([g, ...loadGifts()]);
}

export function updateGiftStatus(id: string, patch: Partial<Gift>): void {
  const current = loadGifts();
  const next = current.map((g) => (g.id === id ? { ...g, ...patch } : g));
  saveGifts(next);
}

/** Gifts in pending-lock state (scheduled transfers awaiting unlockAt). */
export function pendingGifts(): Gift[] {
  return loadGifts().filter((g) => g.status === "pending");
}

/** Pending gifts whose unlockAt has passed — ready to auto-fire. */
export function readyToUnlockGifts(now: number = Date.now()): Gift[] {
  return pendingGifts().filter((g) => {
    if (!g.unlockAt) return false;
    const t = Date.parse(g.unlockAt);
    return Number.isFinite(t) && t <= now;
  });
}

export function canCancelGift(g: Gift, now: number = Date.now()): boolean {
  if (g.status !== "pending") return false;
  if (!g.unlockAt) return false;
  const t = Date.parse(g.unlockAt);
  if (!Number.isFinite(t)) return false;
  return t - now > GIFT_COMMIT_LOCK_MS;
}

/** Sum of pending-gift amounts whose unlockAt lands within the next windowMs.
 *  Used by SendForm and Autopilot to guard against accidental drains that
 *  would make an upcoming auto-fire fail at unlock time. */
export function timelockReserveWithin(windowMs: number, now: number = Date.now()): number {
  const cutoff = now + windowMs;
  let sum = 0;
  for (const g of pendingGifts()) {
    if (!g.unlockAt) continue;
    const t = Date.parse(g.unlockAt);
    if (!Number.isFinite(t)) continue;
    if (t <= cutoff) sum += g.amount;
  }
  return sum;
}
