import { PaymentProvider } from "./provider";
import { stubPaymentProvider } from "./stubProvider";
import { stripePaymentProvider } from "./stripeProvider";

export * from "./provider";
export { stubPaymentProvider, __resetStubPaymentIntents } from "./stubProvider";
export { stripePaymentProvider } from "./stripeProvider";

export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.BUREAU_PAYMENT_PROVIDER || "stub").toLowerCase();
  switch (id) {
    case "stripe":
      return stripePaymentProvider;
    case "stub":
      return stubPaymentProvider;
    default:
      throw new Error(
        `Unknown BUREAU_PAYMENT_PROVIDER=${id}. Supported: stub, stripe.`,
      );
  }
}

/** Default amount for the Verified tier upgrade. Override with env BUREAU_VERIFIED_PRICE_CENTS. */
export function getVerifiedTierPriceCents(): number {
  const raw = process.env.BUREAU_VERIFIED_PRICE_CENTS;
  if (!raw) return 1900; // $19.00
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 1900;
  return n;
}

export function getVerifiedTierCurrency(): string {
  return (process.env.BUREAU_VERIFIED_PRICE_CURRENCY || "USD").toUpperCase();
}
