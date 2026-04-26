/**
 * Stripe payment provider — production skeleton.
 *
 * Wire this up by setting:
 *   BUREAU_PAYMENT_PROVIDER=stripe
 *   STRIPE_SECRET_KEY=sk_live_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   STRIPE_BUREAU_PRODUCT_PRICE=price_...   # configured in Stripe dashboard
 *
 * Reference:
 *   https://docs.stripe.com/api/checkout/sessions
 *   https://docs.stripe.com/webhooks/signatures
 *
 * Until the env keys are present, this provider throws on every call.
 * Switch back to BUREAU_PAYMENT_PROVIDER=stub for local dev.
 */
import {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
} from "./provider";

function need(envKey: string): string {
  const v = process.env[envKey];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `Stripe payment: ${envKey} env is not set. Either configure it or set BUREAU_PAYMENT_PROVIDER=stub for development.`,
    );
  }
  return v;
}

export const stripePaymentProvider: PaymentProvider = {
  id: "stripe",

  async createIntent(_input: PaymentIntentInput): Promise<PaymentIntent> {
    need("STRIPE_SECRET_KEY");
    // TODO: stripe.checkout.sessions.create({
    //   mode: 'payment',
    //   line_items: [{ price: STRIPE_BUREAU_PRODUCT_PRICE, quantity: 1 }],
    //   metadata: { reference: input.reference },
    //   customer_email: input.email,
    //   success_url, cancel_url,
    // })
    // TODO: return { intentId: session.id, checkoutUrl: session.url, ... }
    throw new Error("Stripe provider not yet implemented — populate createIntent");
  },

  async getIntent(_intentId: string): Promise<PaymentResult> {
    need("STRIPE_SECRET_KEY");
    // TODO: stripe.checkout.sessions.retrieve(intentId)
    // TODO: map session.payment_status (paid/unpaid) → PaymentStatus
    throw new Error("Stripe provider not yet implemented — populate getIntent");
  },

  parseWebhook(_headers: Record<string, string>, _rawBody: string) {
    need("STRIPE_WEBHOOK_SECRET");
    // TODO: stripe.webhooks.constructEvent(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)
    // TODO: handle checkout.session.completed event
    throw new Error("Stripe provider not yet implemented — populate parseWebhook with signature verification");
  },
};
