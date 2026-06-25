/**
 * Client-side paywall plumbing.
 *
 * The backend module gate (aevion-globus-backend/lib/planGate.ts) answers a
 * gated request with HTTP 402 + { error: "upgrade_required", module, plan,
 * requiredTiers, upgradeUrl, message }. Rather than retrofit every module's
 * fetch call, we install ONE global fetch interceptor that watches for that
 * shape and raises a window event. <PaywallModal/> (mounted once in
 * ClientProviders) listens and renders the upgrade prompt.
 *
 * The interceptor is transparent: it never alters the response the caller
 * receives (callers still get their 402), it only side-channels the event so
 * the UI can react consistently across all modules.
 */

export const PAYWALL_EVENT = "aevion:paywall";

/** Canonical tiers the backend reports as unlocking a module (excludes free). */
export type PaywallTier = "lite" | "medium" | "full" | "enterprise";

export interface PaywallInfo {
  /** Module id from MODULES_PRICING (e.g. "qcoreai"). */
  module: string;
  /** The caller's current resolved plan. */
  plan: string;
  /** Tiers that unlock the module. */
  requiredTiers: PaywallTier[];
  /** Absolute URL to the pricing/upgrade page. */
  upgradeUrl: string;
  /** Human-readable message (already localised by the backend). */
  message?: string;
}

/** Shape of the backend 402 body. */
interface UpgradeBody {
  error?: string;
  module?: string;
  plan?: string;
  requiredTiers?: string[];
  upgradeUrl?: string;
  message?: string;
}

const VALID_TIERS: PaywallTier[] = ["lite", "medium", "full", "enterprise"];

function normaliseInfo(body: UpgradeBody): PaywallInfo {
  const tiers = (body.requiredTiers ?? []).filter(
    (t): t is PaywallTier => VALID_TIERS.includes(t as PaywallTier),
  );
  return {
    module: body.module ?? "unknown",
    plan: body.plan ?? "free",
    requiredTiers: tiers.length ? tiers : ["full"],
    upgradeUrl: body.upgradeUrl || "/pricing",
    message: body.message,
  };
}

/** Fire the global paywall event so the modal can surface. */
export function triggerPaywall(info: PaywallInfo): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PaywallInfo>(PAYWALL_EVENT, { detail: info }));
}

const INSTALLED = Symbol.for("aevion.paywall.fetchPatched");

/**
 * Monkeypatch window.fetch once so any module's 402 upgrade_required answer
 * raises the paywall event. Idempotent and SSR-safe.
 */
export function installPaywallInterceptor(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<symbol, boolean> & { fetch: typeof fetch };
  if (w[INSTALLED]) return;
  w[INSTALLED] = true;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await original(input, init);
    // Only 402s are interesting; everything else passes straight through
    // untouched (no clone → no overhead, streaming responses unaffected).
    if (res.status !== 402) return res;
    try {
      const body = (await res.clone().json()) as UpgradeBody;
      if (body && body.error === "upgrade_required") {
        triggerPaywall(normaliseInfo(body));
      }
    } catch {
      /* not a JSON upgrade_required body — leave it to the caller */
    }
    return res;
  };
}

const TIER_LABELS: Record<PaywallTier, string> = {
  lite: "Lite",
  medium: "Medium",
  full: "Full",
  enterprise: "Enterprise",
};

/** Pretty tier list for display, e.g. ["full"] → "Full". */
export function formatTiers(tiers: PaywallTier[]): string {
  return tiers.map((t) => TIER_LABELS[t]).join(" / ");
}
