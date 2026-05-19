/**
 * Shared Paddle Billing v2 API client.
 * Used by checkout.ts, qstore.ts, revenue.ts.
 */
import crypto from "crypto";

export const PADDLE_KEY = () => process.env.PADDLE_API_KEY?.trim() || "";
export const PADDLE_WEBHOOK_SECRET = () => process.env.PADDLE_WEBHOOK_SECRET?.trim() || "";
export const IS_PADDLE_SANDBOX = () => process.env.PADDLE_SANDBOX !== "false"; // sandbox unless explicitly "false"
export const PADDLE_BASE_URL = () =>
  IS_PADDLE_SANDBOX()
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";

export async function paddleGet(path: string): Promise<unknown | null> {
  const key = PADDLE_KEY();
  if (!key) return null;
  try {
    const r = await fetch(`${PADDLE_BASE_URL()}${path}`, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { console.error("[paddle] GET", r.status, path); return null; }
    return await r.json();
  } catch (e) { console.error("[paddle] GET failed", e); return null; }
}

export async function paddlePost(path: string, body: unknown): Promise<unknown | null> {
  const key = PADDLE_KEY();
  if (!key) return null;
  try {
    const r = await fetch(`${PADDLE_BASE_URL()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { console.error("[paddle] POST", r.status, path); return null; }
    return await r.json();
  } catch (e) { console.error("[paddle] POST failed", e); return null; }
}

/** Verifies Paddle webhook HMAC-SHA256 signature (format: ts=...;h1=<hex>) */
export function verifyPaddleWebhook(
  rawBody: Buffer | string,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    const parts = Object.fromEntries(signatureHeader.split(";").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }));
    const ts = parts["ts"];
    const h1 = parts["h1"];
    if (!ts || !h1) return false;
    const payload = `${ts}:${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(h1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

/** Create a Paddle transaction (checkout session) */
export async function createPaddleTransaction(opts: {
  amountCents: number;
  currency: string;
  description: string;
  email?: string | null;
  successUrl: string;
  cancelUrl?: string;
  customData?: Record<string, string>;
}): Promise<{ url: string; transactionId: string } | null> {
  const currency = opts.currency.toLowerCase();

  // Paddle needs a price — create a custom price inline
  const itemBody: Record<string, unknown> = {
    price: {
      description: opts.description.slice(0, 255),
      unit_price: { amount: String(opts.amountCents), currency_code: currency.toUpperCase() },
      product: {
        name: opts.description.slice(0, 255),
        tax_category: "standard",
      },
    },
    quantity: 1,
  };

  const txBody: Record<string, unknown> = {
    items: [itemBody],
    checkout: { url: opts.successUrl },
    ...(opts.customData ? { custom_data: opts.customData } : {}),
  };

  if (opts.email) {
    // Find or create customer
    const existing = await paddleGet(`/customers?email=${encodeURIComponent(opts.email)}&per_page=1`) as { data?: { id: string }[] } | null;
    const customerId = existing?.data?.[0]?.id;
    if (customerId) {
      txBody.customer_id = customerId;
    } else {
      const newCust = await paddlePost("/customers", { email: opts.email }) as { data?: { id: string } } | null;
      if (newCust?.data?.id) txBody.customer_id = newCust.data.id;
    }
  }

  const tx = await paddlePost("/transactions", txBody) as {
    data?: { id: string; checkout?: { url: string } };
  } | null;

  if (!tx?.data) return null;
  return {
    transactionId: tx.data.id,
    url: tx.data.checkout?.url ?? opts.successUrl,
  };
}
