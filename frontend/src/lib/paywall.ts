/**
 * Paywall — shared types + fetch helpers for handling 402 upgrade_required
 * responses from the platform-wide module paywall gate (backend planGate.ts,
 * shipped in PR #434). Pairs with components/PaywallScreen.tsx for the UI.
 *
 * The 402 payload shape (from planGate.upgradeResponse):
 *   {
 *     error: "upgrade_required",
 *     module: "qcoreai",
 *     plan: "free",
 *     requiredTiers: ["medium", "full", "enterprise"],
 *     upgradeUrl: "https://aevion.app/pricing",
 *     message: "Модуль «qcoreai» доступен на тарифах: medium, full, enterprise. ..."
 *   }
 */

import { apiUrl } from "./apiBase";

export type CanonicalTier = "free" | "lite" | "medium" | "full" | "enterprise";

export interface PaywallPayload {
  error: "upgrade_required";
  module: string;
  plan: CanonicalTier;
  requiredTiers: CanonicalTier[];
  upgradeUrl: string;
  message: string;
}

export class PaywallError extends Error {
  readonly payload: PaywallPayload;
  constructor(payload: PaywallPayload) {
    super(payload.message);
    this.name = "PaywallError";
    this.payload = payload;
  }
}

function isPaywallPayload(x: unknown): x is PaywallPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.error === "upgrade_required" &&
    typeof o.module === "string" &&
    typeof o.plan === "string" &&
    Array.isArray(o.requiredTiers) &&
    typeof o.upgradeUrl === "string" &&
    typeof o.message === "string"
  );
}

/**
 * Server-side helper: fetch an API path and either return the parsed JSON,
 * or return `{ paywall: PaywallPayload }` if the gate blocked the request.
 *
 * Use in RSC pages so the page can render <PaywallScreen> instead of the
 * gated content without an exception:
 *
 *   const r = await fetchOrPaywall<MyData>("/api/qcoreai/health");
 *   if ("paywall" in r) return <PaywallScreen payload={r.paywall} />;
 *   // ...render r.data
 */
export async function fetchOrPaywall<T>(
  apiPath: string,
  init?: RequestInit,
): Promise<{ data: T } | { paywall: PaywallPayload }> {
  const res = await fetch(apiUrl(apiPath), { cache: "no-store", ...init });
  if (res.status === 402) {
    const body = await res.json().catch(() => null);
    if (isPaywallPayload(body)) return { paywall: body };
  }
  if (!res.ok) {
    throw new Error(`fetchOrPaywall(${apiPath}) — HTTP ${res.status}`);
  }
  return { data: (await res.json()) as T };
}

/**
 * Client-side helper: fetch and either resolve with JSON, or throw a
 * PaywallError that the caller catches to render <PaywallScreen>.
 *
 *   try {
 *     const data = await apiFetchOrPaywall<MyData>("/api/qcoreai/...");
 *   } catch (e) {
 *     if (e instanceof PaywallError) setPaywall(e.payload);
 *     else throw e;
 *   }
 */
export async function apiFetchOrPaywall<T>(
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(apiPath), init);
  if (res.status === 402) {
    const body = await res.json().catch(() => null);
    if (isPaywallPayload(body)) throw new PaywallError(body);
  }
  if (!res.ok) {
    throw new Error(`apiFetchOrPaywall(${apiPath}) — HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

const TIER_LABELS: Record<CanonicalTier, string> = {
  free: "Free",
  lite: "Lite",
  medium: "Medium",
  full: "Full",
  enterprise: "Enterprise",
};

export function tierLabel(t: CanonicalTier): string {
  return TIER_LABELS[t] ?? t;
}
