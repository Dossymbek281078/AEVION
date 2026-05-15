/**
 * billing.ts — wire-up Chessy Pro/Ultimate purchase to QPayNet payment-request.
 *
 * Contract reference (read-only, see aevion-globus-backend/src/routes/qpaynet.ts):
 *   POST /api/qpaynet/requests
 *     Bearer JWT required.
 *     Body : { toWalletId, amount, description, note?, expiresAt?, notifyUrl? }
 *     201  : { id, token, payUrl, amount, currency }
 *   GET  /api/qpaynet/requests/:token (public, no auth)
 *     200 : { id, amount, currency, description, status, paidAt, expiresAt, createdAt }
 *
 * Known limitations / TODO:
 *   1. Backend `amount` is validated as MONEY in KZT (toTiin). CyberChess
 *      tiers are priced in AEV (Pro=500, Ultimate=5000). For now we pass the
 *      AEV-quantity as the KZT-amount field — pending real AEV ↔ KZT pricing
 *      or a dedicated AEV-currency payment-request endpoint. Description
 *      makes the AEV intent explicit so backers can reconcile manually.
 *   2. `toWalletId` (platform wallet that will collect tier payments) is not
 *      configured yet. We read it from:
 *        a) localStorage key `aevion_platform_wallet_id` (set by ops), or
 *        b) the PLATFORM_WALLET_ID constant below (currently null).
 *      If neither is set → returns { ok: false, error: "platform_wallet_not_configured" }
 *      and the UI falls back to its existing test-activation flow.
 *   3. Public GET endpoint uses :token (not :id) and exposes `status` + `paidAt`.
 *      Poll uses `token`, but `createTierPaymentRequest` still surfaces `requestId`
 *      for analytics / future deep-links.
 */

export type ChessyTier = "pro" | "ultimate";

export type CreateBillingResult =
  | { ok: true; requestId: string; token: string; payUrl: string }
  | { ok: false; error: string };

/** Set this once the platform wallet UUID is known (or rely on the localStorage override). */
const PLATFORM_WALLET_ID: string | null = null;

const PLATFORM_WALLET_LS_KEY = "aevion_platform_wallet_id";

function resolvePlatformWallet(): string | null {
  if (typeof window !== "undefined") {
    try {
      const v = window.localStorage.getItem(PLATFORM_WALLET_LS_KEY);
      if (v && v.trim()) return v.trim();
    } catch {
      // ignore localStorage failures (private mode, SSR-edge)
    }
  }
  return PLATFORM_WALLET_ID;
}

function tierDescription(tier: ChessyTier, amountAev: number): string {
  const label = tier === "pro" ? "Pro" : "Ultimate";
  return `CyberChess ${label} tier — ${amountAev} AEV (entrance ticket)`;
}

/**
 * Create a payment request via POST /api/qpaynet/requests.
 * Caller must hold a valid JWT (else 401 → { ok:false, error:"auth_required" }).
 */
export async function createTierPaymentRequest(
  tier: ChessyTier,
  amountAev: number,
  jwt: string,
): Promise<CreateBillingResult> {
  if (!jwt) return { ok: false, error: "auth_required" };
  const toWalletId = resolvePlatformWallet();
  if (!toWalletId) return { ok: false, error: "platform_wallet_not_configured" };

  try {
    const res = await fetch("/api/qpaynet/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        toWalletId,
        amount: amountAev, // see note (1) above — currently treated as KZT-money by backend
        description: tierDescription(tier, amountAev),
        note: `cyberchess-${tier}`,
      }),
    });
    if (!res.ok) {
      let err = `http_${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j && typeof j.error === "string") err = j.error;
      } catch {
        // body not JSON — keep http_NNN
      }
      return { ok: false, error: err };
    }
    const j = (await res.json()) as {
      id?: string;
      token?: string;
      payUrl?: string;
    };
    if (!j.id || !j.token || !j.payUrl) {
      return { ok: false, error: "malformed_response" };
    }
    return { ok: true, requestId: j.id, token: j.token, payUrl: j.payUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/**
 * Poll the public GET /api/qpaynet/requests/:token endpoint until status flips
 * away from "pending" (i.e. paid / expired / cancelled). Returns true only on
 * status === "paid" or a non-null paidAt. False on timeout / other terminal state.
 *
 * Note: this is best-effort and does NOT consume the JWT (the public endpoint
 * is auth-free), so it works even if the user's session expires mid-flow.
 *
 * @param token  Public request token returned from createTierPaymentRequest.
 * @param _jwt   Reserved — kept in signature for forward-compat (no auth needed today).
 * @param opts   intervalMs (default 3000), timeoutMs (default 60000).
 */
export async function pollPaymentRequest(
  token: string,
  _jwt: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<boolean> {
  const intervalMs = opts?.intervalMs ?? 3000;
  const timeoutMs = opts?.timeoutMs ?? 60000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`/api/qpaynet/requests/${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const j = (await res.json()) as { status?: string; paidAt?: string | null };
        if (j && (j.status === "paid" || j.paidAt)) return true;
        if (j && j.status && j.status !== "pending") return false;
      }
    } catch {
      // network blip — keep polling until deadline
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
