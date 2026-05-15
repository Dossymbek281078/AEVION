import type { FintechClient } from "./client";
import type { Charge, Mask, MaskKind } from "./types";

/** Body for {@link QMaskCardModule.issueMask}. */
export interface IssueMaskBody {
  label: string;
  kind?: MaskKind;
  /** When `kind === "merchant-locked"`, restricts the mask to this merchant. */
  lockedToMerchant?: string;
  /** When `kind === "category-locked"`, restricts the mask to this category. */
  lockedToCategory?: string;
  currency?: string;
  /** Spend limit in cents — 100 (1 unit) up to 100_000_000 (1M units). */
  spendLimitCents: number;
  /** Time-to-live in hours. Defaults to 168 (7 days). Max 8760 (1 year). */
  ttlHours?: number;
}

/** Response from {@link QMaskCardModule.issueMask}. */
export interface IssueMaskResponse {
  id: string;
  virtualPan: string;
  kind: MaskKind;
  label: string;
  spendLimitCents: number;
  remainingCents: number;
  currency: string;
  expiresAt: string | null;
  note: string;
}

/** Body for {@link QMaskCardModule.authorize}. */
export interface AuthorizeChargeBody {
  maskId: string;
  amountCents: number;
  currency?: string;
  merchantName?: string;
  merchantCategory?: string;
  geoCountry?: string;
  paymentRef?: string;
}

/** Authorized response from {@link QMaskCardModule.authorize}. */
export interface AuthorizedChargeResponse {
  id: string;
  maskId: string;
  status: "authorized";
  amountCents: number;
  riskScore: number;
  autoRevoked: boolean;
}

/** Declined response from {@link QMaskCardModule.authorize}. HTTP 402. */
export interface DeclinedChargeResponse {
  id: string;
  status: "declined";
  reason: string;
}

/** Response from {@link QMaskCardModule.stats}. */
export interface QMaskCardStatsResponse {
  active_masks: number;
  total_masks: number;
  authorized_charges: number;
  declined_charges: number;
  volume_cents: string;
  service: "qmaskcard";
}

/**
 * QMaskCard — privacy-preserving virtual cards (single-use, merchant-locked,
 * category-locked, or recurring).
 *
 * Endpoints: `/api/qmaskcard/*`. All endpoints (except `/stats`) require auth.
 *
 * Note: a successful charge against a `single-use` mask auto-revokes it. The
 * `authorize` response carries `autoRevoked: true` so the caller can update UI.
 */
export class QMaskCardModule {
  constructor(private readonly client: FintechClient) {}

  /** Issue a fresh virtual card (mask). Requires auth. */
  issueMask(body: IssueMaskBody): Promise<IssueMaskResponse> {
    return this.client.request("POST", `/api/qmaskcard/masks`, body);
  }

  /** List the authenticated user's masks. */
  listMasks(
    opts: { includeRevoked?: boolean } = {},
  ): Promise<{ masks: Mask[]; total: number }> {
    const tail = opts.includeRevoked ? `?includeRevoked=1` : "";
    return this.client.request("GET", `/api/qmaskcard/masks${tail}`);
  }

  /** Revoke a mask. After this, further charges against it will be declined. */
  revokeMask(id: string): Promise<{ ok: true; revokedId: string }> {
    return this.client.request(
      "POST",
      `/api/qmaskcard/masks/${encodeURIComponent(id)}/revoke`,
    );
  }

  /**
   * Authorize a charge against a mask. Returns 201 with `authorized` on
   * success, or throws `SDKError` with status 402 on decline (HTTP-coded,
   * caller can inspect `err.code` for `mask_revoked`, `insufficient_balance`,
   * `merchant_locked`, etc.).
   */
  authorize(
    body: AuthorizeChargeBody,
  ): Promise<AuthorizedChargeResponse> {
    return this.client.request("POST", `/api/qmaskcard/charges`, body);
  }

  /** List the authenticated user's charges, optionally scoped to one mask. */
  listCharges(
    opts: { maskId?: string } = {},
  ): Promise<{ charges: Charge[]; total: number }> {
    const qs = new URLSearchParams();
    if (opts.maskId) qs.set("maskId", opts.maskId);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return this.client.request("GET", `/api/qmaskcard/charges${tail}`);
  }

  /** Aggregate stats — active masks / total / authorized vs declined / volume. */
  stats(): Promise<QMaskCardStatsResponse> {
    return this.client.request("GET", `/api/qmaskcard/stats`);
  }
}
