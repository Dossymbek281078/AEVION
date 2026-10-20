"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constitutionCheckoutRouter = void 0;
/**
 * Constitution checkout — СНЯТ С ПРОДАЖИ 15.09.2026.
 *
 * Слово основателя: отдельно продаются только пять приложений (CyberChess,
 * Multichat, QVenture, IP Bureau, DevHub). Конституция входит в подписку AEVION
 * на любой срок (data/pricing.ts, TERM_*); Constitution Pro $9 и Team $49 больше
 * не продаются.
 *
 * Ручки оставлены, чтобы старые ссылки из писем и QR-кодов не вели в 404:
 *   POST /api/constitution/checkout/session → 410 и адрес страницы цен
 *   GET  /api/constitution/checkout/go/:tier → переход на страницу цен
 * В кассу не ходит ничего: продажа по старой цене после смены политики была бы
 * третьей ценой одного и того же доступа. Уже купленное не отзывается — выдача
 * живёт в routes/constitutionPro.ts и вебхуках.
 */
const express_1 = require("express");
const rateLimit_1 = require("../lib/rateLimit");
exports.constitutionCheckoutRouter = (0, express_1.Router)();
const limiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 20, keyPrefix: "constitution-checkout" });
const withLimit = limiter;
function publicBase() {
    return (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
}
exports.constitutionCheckoutRouter.post("/session", withLimit, (_req, res) => {
    res.status(410).json({
        error: "not_sold_separately",
        message: "Конституция отдельно больше не продаётся — она входит в подписку AEVION. " +
            "Выберите срок подписки на странице цен.",
        pricingUrl: `${publicBase()}/pricing`,
    });
});
exports.constitutionCheckoutRouter.get("/go/:tier", withLimit, (_req, res) => {
    res.redirect(302, `${publicBase()}/pricing`);
});
