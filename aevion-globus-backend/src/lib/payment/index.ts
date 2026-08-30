import { warnIfStubInProduction } from "../providerGuard";
import { PaymentProvider } from "./provider";
import { stubPaymentProvider } from "./stubProvider";
import { stripePaymentProvider } from "./stripeProvider";
import { lemonSqueezyPaymentProvider } from "./lemonSqueezyProvider";
import { gumroadPaymentProvider } from "./gumroadProvider";

export * from "./provider";
export { stubPaymentProvider, __resetStubPaymentIntents } from "./stubProvider";
export { stripePaymentProvider } from "./stripeProvider";
export { lemonSqueezyPaymentProvider } from "./lemonSqueezyProvider";
export { gumroadPaymentProvider } from "./gumroadProvider";

export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.BUREAU_PAYMENT_PROVIDER || "stub").toLowerCase();
  // Заглушка в проде больше не молчит — см. lib/providerGuard.ts.
  warnIfStubInProduction("BUREAU_PAYMENT_PROVIDER", id);
  switch (id) {
    case "lemonsqueezy":
    case "lemon-squeezy":
    case "lemon_squeezy":
      return lemonSqueezyPaymentProvider;
    case "gumroad":
      return gumroadPaymentProvider;
    case "stripe":
      return stripePaymentProvider;
    case "stub":
      return stubPaymentProvider;
    default:
      throw new Error(
        `Unknown BUREAU_PAYMENT_PROVIDER=${id}. Supported: stub, stripe, lemonsqueezy, gumroad.`,
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
