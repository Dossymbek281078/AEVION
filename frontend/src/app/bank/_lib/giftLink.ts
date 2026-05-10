// Portable gift links: encode a Gift snapshot into a URL-safe base64 string
// so the recipient can open /bank/gift/<id>?p=<payload> on any device and
// see the card. The sender keeps the original gift in localStorage; the
// link is purely a self-contained presentation payload.
//
// Real money settlement still goes through /api/qtrade/transfer when the
// gift unlocks. This module only handles the recipient-facing card UI.

import type { Gift } from "./gifts";

// Bumping CURRENT_VERSION breaks old links — only do that for incompatible
// schema changes; additive changes can stay at v1.
export const GIFT_LINK_VERSION = 1;

export type GiftLinkPayload = {
  v: number;
  g: Gift;
  // Sender display name — kept separately from the Gift schema because the
  // sender's account ID is not normally surfaced in the recipient view.
  from?: string;
};

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlSafe(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return padded + "=".repeat(pad);
}

export function encodeGiftLink(payload: GiftLinkPayload): string {
  const json = JSON.stringify(payload);
  // btoa only handles latin1; gift messages may contain Cyrillic / emoji.
  // URL-encode first so multibyte chars survive the round-trip.
  const utf8 = unescape(encodeURIComponent(json));
  return toUrlSafe(btoa(utf8));
}

export function decodeGiftLink(s: string): GiftLinkPayload | null {
  try {
    const utf8 = atob(fromUrlSafe(s));
    const json = decodeURIComponent(escape(utf8));
    const obj = JSON.parse(json) as unknown;
    if (!isPayload(obj)) return null;
    if (obj.v > GIFT_LINK_VERSION) return null;
    return obj;
  } catch {
    return null;
  }
}

function isPayload(x: unknown): x is GiftLinkPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.v !== "number") return false;
  const g = o.g as Partial<Gift> | undefined;
  if (!g || typeof g !== "object") return false;
  return (
    typeof g.id === "string" &&
    typeof g.amount === "number" &&
    typeof g.themeId === "string" &&
    typeof g.message === "string" &&
    typeof g.sentAt === "string"
  );
}

export function buildGiftShareUrl(
  origin: string,
  gift: Gift,
  fromName?: string,
): string {
  const payload: GiftLinkPayload = {
    v: GIFT_LINK_VERSION,
    g: gift,
    ...(fromName ? { from: fromName } : {}),
  };
  const encoded = encodeGiftLink(payload);
  return `${origin.replace(/\/$/, "")}/bank/gift/${encodeURIComponent(gift.id)}?p=${encoded}`;
}
