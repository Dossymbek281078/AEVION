/**
 * Lemon Squeezy variant mapping — Lite / Medium / Full subscription tiers.
 *
 * LS is now the LIVE subscription processor (account activated 2026-06-04).
 * Each tier:period maps to one LS variant id, supplied via env so new variant
 * IDs are pasted without code changes:
 *
 *   LEMON_SQUEEZY_VARIANT_LITE_MONTHLY     LEMON_SQUEEZY_VARIANT_LITE_ANNUAL
 *   LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY   LEMON_SQUEEZY_VARIANT_MEDIUM_ANNUAL
 *   LEMON_SQUEEZY_VARIANT_FULL_MONTHLY     LEMON_SQUEEZY_VARIANT_FULL_ANNUAL
 *
 * Setup:
 *   1. LS dashboard → Store → Products → New product (subscription)
 *      - Lite   $19/mo  + $190/yr variant
 *      - Medium $29/mo  + $290/yr variant
 *      - Full   $49/mo  + $490/yr variant
 *   2. Open each variant; the numeric variant id is in the URL:
 *      lemonsqueezy.com/dashboard/.../products/<pid>/variants/<VARIANT_ID>
 *   3. Paste each id into the matching env var on Railway.
 *
 * Prices on the LS variant are the source of truth — they MUST match the tier
 * prices in data/pricing.ts (lite 19/190, medium 29/290, full 49/490).
 *
 * A checkout reference is "tier_<tier>_<period>" (built by routes/checkout.ts),
 * e.g. "tier_lite_monthly". The webhook reverse-maps an incoming variant_id
 * back to that reference to provision the right tier.
 */

import type { TierId } from "./pricing";

export type LemonSqueezyReference =
  | "tier_lite_monthly"
  | "tier_lite_annual"
  | "tier_medium_monthly"
  | "tier_medium_annual"
  | "tier_full_monthly"
  | "tier_full_annual";

/** reference → env var holding the LS variant id. */
const TIER_VARIANT_ENV: Record<LemonSqueezyReference, string> = {
  tier_lite_monthly: "LEMON_SQUEEZY_VARIANT_LITE_MONTHLY",
  tier_lite_annual: "LEMON_SQUEEZY_VARIANT_LITE_ANNUAL",
  tier_medium_monthly: "LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY",
  tier_medium_annual: "LEMON_SQUEEZY_VARIANT_MEDIUM_ANNUAL",
  tier_full_monthly: "LEMON_SQUEEZY_VARIANT_FULL_MONTHLY",
  tier_full_annual: "LEMON_SQUEEZY_VARIANT_FULL_ANNUAL",
};

function isReference(s: string): s is LemonSqueezyReference {
  return s in TIER_VARIANT_ENV;
}

/**
 * Resolve the LS variant id for a checkout reference ("tier_lite_monthly").
 * Returns null if the reference is unknown or its variant env isn't set yet —
 * the provider then falls back to LEMON_SQUEEZY_DEFAULT_VARIANT_ID.
 */
export function resolveLemonSqueezyVariant(reference: string): string | null {
  if (!isReference(reference)) return null;
  const id = process.env[TIER_VARIANT_ENV[reference]]?.trim();
  return id || null;
}

/** True when at least one tier variant id is configured (LS checkout is live). */
export function lemonSqueezyTiersConfigured(): boolean {
  return Object.values(TIER_VARIANT_ENV).some((k) => Boolean(process.env[k]?.trim()));
}

/**
 * Reverse lookup: a numeric LS variant_id from a webhook payload → the
 * checkout reference it belongs to. Returns null for an unrecognised id.
 */
export function referenceForVariantId(
  variantId: string | number | null | undefined,
): LemonSqueezyReference | null {
  if (variantId == null) return null;
  const id = String(variantId);
  for (const ref of Object.keys(TIER_VARIANT_ENV) as LemonSqueezyReference[]) {
    if (process.env[TIER_VARIANT_ENV[ref]]?.trim() === id) return ref;
  }
  return null;
}

/** A checkout reference → tier id. Defaults to "lite" (safest paid entry). */
export function tierForLemonSqueezyReference(ref: LemonSqueezyReference | null): TierId {
  if (!ref) return "lite";
  if (ref.includes("medium")) return "medium";
  if (ref.includes("full")) return "full";
  return "lite";
}
