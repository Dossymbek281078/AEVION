/**
 * Payment provider abstraction.
 *
 * Concrete providers (Stripe, Kaspi-Pay, Paddle) implement this interface;
 * the route layer is provider-agnostic. Default in dev/CI is the
 * deterministic stub provider — it auto-completes payments so the upgrade
 * flow runs end-to-end.
 *
 * In production, env BUREAU_PAYMENT_PROVIDER selects a real implementation,
 * which uses signed webhooks to confirm payments asynchronously (the
 * client polls /payment/status until the webhook arrives — never trust
 * the client-reported "paid" claim).
 */

export type PaymentStatus =
  | "unpaid" // intent created, not yet paid
  | "processing" // user clicked pay, awaiting confirmation
  | "paid" // confirmed by provider webhook
  | "refunded"
  | "failed"
  | "expired";

export interface PaymentIntentInput {
  /** What the user is paying for — opaque to the provider, used in webhooks. */
  reference: string;
  amountCents: number;
  currency: string; // ISO-4217, e.g. "USD"
  /** Description shown on hosted checkout page. */
  description: string;
  email?: string | null;
}

export interface PaymentIntent {
  intentId: string;
  /** URL to send the user to (hosted checkout). */
  checkoutUrl: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
}

export interface PaymentResult {
  status: PaymentStatus;
  paidAt: string | null;
  reason: string | null;
  raw: unknown;
}

export interface PaymentProvider {
  readonly id: string;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  getIntent(intentId: string): Promise<PaymentResult>;
  parseWebhook(headers: Record<string, string>, rawBody: string): {
    intentId: string;
    result: PaymentResult;
  };
}
