/**
 * Stripe payment provider — production implementation.
 *
 * Activate via env:
 *   BUREAU_PAYMENT_PROVIDER=stripe
 *   STRIPE_SECRET_KEY=sk_(test|live)_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   AEVION_PUBLIC_BASE_URL=https://aevion.app   (used for success/cancel redirects)
 *
 * Reference:
 *   https://docs.stripe.com/api/checkout/sessions/create
 *   https://docs.stripe.com/api/checkout/sessions/retrieve
 *   https://docs.stripe.com/webhooks/signatures
 *
 * Mapping notes:
 * - We generate our own `bureauIntentId` (UUID) and pass it through Stripe
 *   `payment_intent_data.metadata.bureauIntentId`. The webhook then has it on
 *   `payment_intent.metadata.bureauIntentId`, letting parseWebhook stay
 *   synchronous (no Stripe API roundtrip needed).
 * - The Checkout Session's id is stored locally as `stripeCheckoutSessionId`
 *   (in metadata) so getIntent() can retrieve it for polling.
 * - In createIntent we return `{ intentId: bureauIntentId, checkoutUrl: session.url }`.
 *   Bureau code stores `intentId` as `paymentIntentId`; the webhook updates
 *   the same row WHERE paymentIntentId = bureauIntentId.
 */
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
} from "./provider";

// Stripe SDK exports `Stripe` as both a class and a namespace with types.
// Some TS resolutions (notably stricter Railway builds) reject using
// `Stripe` as a value-type alias, so we capture the class instance type
// and re-declare the slim shape we actually consume.
type StripeInstance = InstanceType<typeof Stripe>;

interface MinimalPaymentIntent {
  id: string;
  status: string | null;
  amount: number;
  currency: string;
  created: number;
  metadata?: Record<string, string> | null;
  last_payment_error?: { message?: string } | null;
}

function need(envKey: string): string {
  const v = process.env[envKey];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `Stripe payment: ${envKey} env is not set. Either configure it or set BUREAU_PAYMENT_PROVIDER=stub for development.`,
    );
  }
  return v;
}

let _stripe: StripeInstance | null = null;
function getStripe(): StripeInstance {
  if (_stripe) return _stripe;
  const apiKey = need("STRIPE_SECRET_KEY");
  // apiVersion cast widened to string to avoid `Stripe.LatestApiVersion`
  // namespace lookup (TS2694 on some resolutions).
  _stripe = new Stripe(apiKey, { apiVersion: "2025-04-30.basil" } as ConstructorParameters<typeof Stripe>[1]);
  return _stripe;
}

function publicBaseUrl(): string {
  return (
    process.env.AEVION_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://aevion.app"
  );
}

function mapStripeStatus(piStatus: string | null | undefined): PaymentStatus {
  switch (piStatus) {
    case "succeeded":
      return "paid";
    case "processing":
    case "requires_capture":
      return "processing";
    case "canceled":
      return "expired";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return "unpaid";
    default:
      return "unpaid";
  }
}

// Bureau intent id stored in Stripe payment_intent metadata so the webhook
// can map back to our row without an extra API call.
const META_BUREAU_INTENT_ID = "bureauIntentId";
const META_BUREAU_REFERENCE = "bureauReference";

export const stripePaymentProvider: PaymentProvider = {
  id: "stripe",

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const stripe = getStripe();
    const bureauIntentId = randomUUID();
    const base = publicBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: {
              name: input.description,
            },
          },
        },
      ],
      // Customer email pre-fills the form when present.
      ...(input.email ? { customer_email: input.email } : {}),
      // client_reference_id is searchable on Stripe side; useful for ops.
      client_reference_id: input.reference.slice(0, 200),
      metadata: {
        [META_BUREAU_INTENT_ID]: bureauIntentId,
        [META_BUREAU_REFERENCE]: input.reference,
      },
      // Same metadata on the embedded PaymentIntent so the webhook payload has it.
      payment_intent_data: {
        metadata: {
          [META_BUREAU_INTENT_ID]: bureauIntentId,
          [META_BUREAU_REFERENCE]: input.reference,
        },
        description: input.description,
      },
      success_url: `${base}/bureau?paid=1&reference=${encodeURIComponent(input.reference)}`,
      cancel_url: `${base}/bureau?paid=0&reference=${encodeURIComponent(input.reference)}`,
    });

    return {
      intentId: bureauIntentId,
      checkoutUrl: session.url ?? `${base}/bureau`,
      status: "unpaid",
      amountCents: input.amountCents,
      currency: input.currency,
    };
  },

  async getIntent(bureauIntentId: string): Promise<PaymentResult> {
    const stripe = getStripe();
    // Look up the PaymentIntent via search on metadata. Stripe Search API
    // requires an index; metadata.<key>:'<val>' is supported.
    const search = await stripe.paymentIntents.search({
      query: `metadata['${META_BUREAU_INTENT_ID}']:'${bureauIntentId}'`,
      limit: 1,
    });
    if (search.data.length === 0) {
      return { status: "unpaid", paidAt: null, reason: "not_found", raw: null };
    }
    const pi = search.data[0];
    return {
      status: mapStripeStatus(pi.status),
      paidAt: pi.status === "succeeded" ? new Date(pi.created * 1000).toISOString() : null,
      reason: pi.last_payment_error?.message ?? null,
      raw: { id: pi.id, status: pi.status, amount: pi.amount, currency: pi.currency },
    };
  },

  parseWebhook(headers: Record<string, string>, rawBody: string) {
    const stripe = getStripe();
    const secret = need("STRIPE_WEBHOOK_SECRET");
    const sig = headers["stripe-signature"];
    if (!sig) throw new Error("missing stripe-signature header");

    // constructEvent throws on bad signature — bureau route catches and returns 400.
    const event = stripe.webhooks.constructEvent(rawBody, sig, secret);

    // We listen for payment_intent.succeeded + payment_intent.payment_failed
    // (the events configured at https://dashboard.stripe.com/webhooks).
    if (
      event.type !== "payment_intent.succeeded" &&
      event.type !== "payment_intent.payment_failed"
    ) {
      throw new Error(`unhandled stripe event type: ${event.type}`);
    }

    const pi = event.data.object as MinimalPaymentIntent;
    const bureauIntentId = (pi.metadata && pi.metadata[META_BUREAU_INTENT_ID]) || "";
    if (!bureauIntentId) {
      throw new Error(`stripe event ${event.id}: missing metadata.${META_BUREAU_INTENT_ID}`);
    }

    const status: PaymentStatus =
      event.type === "payment_intent.succeeded" ? "paid" : "failed";

    return {
      intentId: bureauIntentId,
      result: {
        status,
        paidAt: status === "paid" ? new Date(pi.created * 1000).toISOString() : null,
        reason: pi.last_payment_error?.message ?? null,
        raw: {
          id: pi.id,
          status: pi.status,
          amount: pi.amount,
          currency: pi.currency,
          eventId: event.id,
          eventType: event.type,
        },
      } satisfies PaymentResult,
    };
  },
};
