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
  /** Extra key/values echoed back in the webhook's custom_data (e.g. the chosen
   *  module for a Lite subscription). Provider-specific: LemonSqueezy forwards
   *  it on subscription events. */
  customData?: Record<string, string>;
  /**
   * Идентификатор купленного модуля — ТОЛЬКО для адреса возврата, чтобы
   * страница после оплаты назвала то, за что заплатили. Намеренно отдельно
   * от customData: та уезжает провайдеру и возвращается в вебхуке, и её
   * расширение меняло бы выдачу прав, а не подпись на экране.
   */
  successAppId?: string;
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
    /** Provider-side unique id for this webhook delivery (Stripe `evt_*`).
     *  Used for at-least-once dedup; if absent, dedup falls back to a hash of
     *  the raw body. */
    eventId?: string;
    result: PaymentResult;
  };
}
