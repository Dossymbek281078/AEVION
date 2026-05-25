/**
 * Lemon Squeezy Variant IDs — stub.
 *
 * Filled when LS account is set up:
 *   1. Lemon Squeezy dashboard → Store → Products
 *   2. Create one Product per bundle (Fintech, Build, AI, Gaming) + one
 *      All-Access subscription product.
 *   3. Each product gets a Variant — the numeric variant ID is in the URL
 *      when you open the variant detail page: lemonsqueezy.com/dashboard/
 *      stores/<storeId>/products/<productId>/variants/<VARIANT_ID>
 *   4. Paste the number (as a string — LS IDs are >2^31 sometimes) into
 *      the matching field below and remove the `null` placeholder.
 *
 * Consumers (lemonSqueezyProvider.createIntent) should fall back to
 * LEMON_SQUEEZY_DEFAULT_VARIANT_ID (env) when a bundle/all-access map
 * entry is still `null`. That keeps the provider usable in early launch
 * before all four bundles are listed.
 *
 * Numeric prices here are the published monthly USD prices we plan to
 * charge — they MUST match what's set on the LS variant. If they drift,
 * checkout still works (LS variant is the source of truth) but
 * /api/aevion/pricing will show inconsistent numbers vs the receipt.
 */

import type { BundleId } from "./modulePricing";

export interface LemonSqueezyVariant {
  /** LS variant id (numeric string from dashboard URL). null until set. */
  variantId: string | null;
  /** Display price in USD/month — must match LS variant price. */
  monthlyUsd: number;
  /** Short human label, mirrors what /pricing shows in the bundle card. */
  label: string;
}

// monthlyUsd MUST mirror BUNDLE_USD / ALL_ACCESS_USD in modulePricing.ts.
export const LEMON_SQUEEZY_BUNDLE_VARIANTS: Record<BundleId, LemonSqueezyVariant> = {
  fintech: { variantId: null, monthlyUsd: 29, label: "Fintech bundle" },
  build:   { variantId: null, monthlyUsd: 19, label: "Build & IP bundle" },
  ai:      { variantId: null, monthlyUsd: 29, label: "AI bundle" },
  gaming:  { variantId: null, monthlyUsd: 19, label: "Gaming & UX bundle" },
};

export const LEMON_SQUEEZY_ALL_ACCESS_VARIANT: LemonSqueezyVariant = {
  variantId: null,
  monthlyUsd: 59,
  label: "All-Access (every paid module)",
};

/** A checkout/subscription target: one of the 4 bundles or all-access. */
export type LemonSqueezyReference = BundleId | "all-access";

/**
 * Resolves the right LS variant for a checkout reference like "bundle:ai"
 * or "all-access". Returns null if the variant isn't published yet —
 * caller should fall back to LEMON_SQUEEZY_DEFAULT_VARIANT_ID env.
 */
export function resolveLemonSqueezyVariant(reference: string): LemonSqueezyVariant | null {
  if (reference === "all-access") return LEMON_SQUEEZY_ALL_ACCESS_VARIANT;
  const m = reference.match(/^bundle:(fintech|build|ai|gaming)$/);
  if (m) return LEMON_SQUEEZY_BUNDLE_VARIANTS[m[1] as BundleId];
  return null;
}

/**
 * Reverse lookup: given a numeric LS variant_id from a webhook payload,
 * return which bundle / all-access it maps to. Returns null while the
 * variant IDs are still unset (stub) OR for an unrecognised id — the
 * webhook handler then falls back to a generic "pro" activation.
 */
export function referenceForVariantId(variantId: string | number | null | undefined): LemonSqueezyReference | null {
  if (variantId == null) return null;
  const id = String(variantId);
  if (LEMON_SQUEEZY_ALL_ACCESS_VARIANT.variantId === id) return "all-access";
  for (const key of Object.keys(LEMON_SQUEEZY_BUNDLE_VARIANTS) as BundleId[]) {
    if (LEMON_SQUEEZY_BUNDLE_VARIANTS[key].variantId === id) return key;
  }
  return null;
}
