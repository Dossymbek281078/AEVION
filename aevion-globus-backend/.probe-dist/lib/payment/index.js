"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gumroadPaymentProvider = exports.lemonSqueezyPaymentProvider = exports.stripePaymentProvider = exports.__resetStubPaymentIntents = exports.stubPaymentProvider = void 0;
exports.getPaymentProvider = getPaymentProvider;
exports.getVerifiedTierPriceCents = getVerifiedTierPriceCents;
exports.getVerifiedTierCurrency = getVerifiedTierCurrency;
const providerGuard_1 = require("../providerGuard");
const stubProvider_1 = require("./stubProvider");
const stripeProvider_1 = require("./stripeProvider");
const lemonSqueezyProvider_1 = require("./lemonSqueezyProvider");
const gumroadProvider_1 = require("./gumroadProvider");
__exportStar(require("./provider"), exports);
var stubProvider_2 = require("./stubProvider");
Object.defineProperty(exports, "stubPaymentProvider", { enumerable: true, get: function () { return stubProvider_2.stubPaymentProvider; } });
Object.defineProperty(exports, "__resetStubPaymentIntents", { enumerable: true, get: function () { return stubProvider_2.__resetStubPaymentIntents; } });
var stripeProvider_2 = require("./stripeProvider");
Object.defineProperty(exports, "stripePaymentProvider", { enumerable: true, get: function () { return stripeProvider_2.stripePaymentProvider; } });
var lemonSqueezyProvider_2 = require("./lemonSqueezyProvider");
Object.defineProperty(exports, "lemonSqueezyPaymentProvider", { enumerable: true, get: function () { return lemonSqueezyProvider_2.lemonSqueezyPaymentProvider; } });
var gumroadProvider_2 = require("./gumroadProvider");
Object.defineProperty(exports, "gumroadPaymentProvider", { enumerable: true, get: function () { return gumroadProvider_2.gumroadPaymentProvider; } });
function getPaymentProvider() {
    const id = (process.env.BUREAU_PAYMENT_PROVIDER || "stub").toLowerCase();
    // Заглушка в проде больше не молчит — см. lib/providerGuard.ts.
    (0, providerGuard_1.warnIfStubInProduction)("BUREAU_PAYMENT_PROVIDER", id);
    switch (id) {
        case "lemonsqueezy":
        case "lemon-squeezy":
        case "lemon_squeezy":
            return lemonSqueezyProvider_1.lemonSqueezyPaymentProvider;
        case "gumroad":
            return gumroadProvider_1.gumroadPaymentProvider;
        case "stripe":
            return stripeProvider_1.stripePaymentProvider;
        case "stub":
            return stubProvider_1.stubPaymentProvider;
        default:
            throw new Error(`Unknown BUREAU_PAYMENT_PROVIDER=${id}. Supported: stub, stripe, lemonsqueezy, gumroad.`);
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
function getVerifiedTierPriceCents() {
    const raw = process.env.BUREAU_VERIFIED_PRICE_CENTS;
    if (!raw)
        return 2900; // $29.00 в месяц
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0)
        return 2900;
    return n;
}
function getVerifiedTierCurrency() {
    return (process.env.BUREAU_VERIFIED_PRICE_CURRENCY || "USD").toUpperCase();
}
