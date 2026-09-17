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
import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";

export const constitutionCheckoutRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "constitution-checkout" });
const withLimit = limiter as unknown as (req: Request, res: Response, next: () => void) => void;

function publicBase(): string {
  return (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
}

constitutionCheckoutRouter.post("/session", withLimit, (_req: Request, res: Response) => {
  res.status(410).json({
    error: "not_sold_separately",
    message:
      "Конституция отдельно больше не продаётся — она входит в подписку AEVION. " +
      "Выберите срок подписки на странице цен.",
    pricingUrl: `${publicBase()}/pricing`,
  });
});

constitutionCheckoutRouter.get("/go/:tier", withLimit, (_req: Request, res: Response) => {
  res.redirect(302, `${publicBase()}/pricing`);
});
