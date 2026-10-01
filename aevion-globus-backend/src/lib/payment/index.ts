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

/**
 * Цена отметки Verified — ЕДИНСТВЕННЫЙ источник числа на всей платформе.
 *
 * 🔴 $29 В МЕСЯЦ — решение основателя: цена названа 14.09.2026, период
 * подтверждён 15.09 («оплата ежемесячная»). До 30.09 здесь стояло 1900, а на
 * витрине — «$19», и это расхождение было не косметикой: товар в кассе
 * (подписка AEVION IP Bureau) стоит $29, то есть сайт обещал одну цену, а
 * списали бы другую. Числа в разметке не зашиваем: витрина берёт цену из
 * ответа `/api/bureau/health`, а сторож сверяет её с этим числом.
 *
 * Переменной `BUREAU_VERIFIED_PRICE_CENTS` можно переназначить, но умолчание
 * обязано совпадать с товаром в кассе: у запасного пути цену назначаем мы, а у
 * товара `app_ip_bureau` цену назначает КАССА, и разойтись им нельзя.
 */
export function getVerifiedTierPriceCents(): number {
  const raw = process.env.BUREAU_VERIFIED_PRICE_CENTS;
  if (!raw) return 2900; // $29.00 в месяц
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 2900;
  return n;
}

export function getVerifiedTierCurrency(): string {
  return (process.env.BUREAU_VERIFIED_PRICE_CURRENCY || "USD").toUpperCase();
}
