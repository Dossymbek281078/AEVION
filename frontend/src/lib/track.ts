import { apiUrl } from "./apiBase";

/**
 * Лёгкий analytics-трекер для GTM-страниц.
 * Без cookies, без fingerprinting — только sessionStorage sid и body event.
 *
 * Использует navigator.sendBeacon когда возможно — гарантирует доставку
 * даже при unload (клик "Купить" → redirect → fetch отменяется в обычном
 * случае, beacon — нет).
 */

const SID_KEY = "aevion_gtm_sid";

export type EventType =
  | "page_view"
  | "cta_click"
  | "calculator_open"
  | "calculator_quote"
  | "checkout_start"
  | "checkout_success"
  | "checkout_cancel"
  | "lead_submit"
  | "tier_view"
  | "industry_view"
  | "faq_open"
  | "comparison_view";

export interface TrackPayload {
  type: EventType;
  source?: string;
  tier?: string;
  industry?: string;
  value?: number;
  meta?: Record<string, string | number | boolean | null>;
}

function getSid(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

export function track(payload: TrackPayload): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    sid: getSid(),
    path: window.location.pathname + window.location.search,
  });

  const url = apiUrl("/api/pricing/events");

  // sendBeacon — лучший выбор: переживёт unload, не блокирует UI
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch {
      // fall through to fetch
    }
  }

  // Fallback: fire-and-forget fetch с keepalive
  try {
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Аналитика не должна ломать UX — глотаем
    });
  } catch {
    // ignore
  }
}
