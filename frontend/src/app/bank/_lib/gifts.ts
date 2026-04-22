// Gift cards — decorated transfers with a message and visual theme.
// TODO backend: shared /api/gifts store + /bank/gift/[id] pickup route so the recipient
// sees the card. Currently sender-side history only; money transfers via normal qtrade.

const STORAGE_KEY = "aevion_bank_gifts_v1";
const MAX_KEEP = 30;

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

export type Gift = {
  id: string;
  recipientAccountId: string;
  recipientNickname: string;
  amount: number;
  themeId: GiftThemeId;
  message: string;
  sentAt: string;
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
  } catch {
    // ignore
  }
}

export function appendGift(g: Gift): void {
  saveGifts([g, ...loadGifts()]);
}
