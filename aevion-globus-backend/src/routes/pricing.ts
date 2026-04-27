import { Router } from "express";
import {
  TIERS,
  MODULES_PRICING,
  BUNDLES,
  CURRENCY_RATES,
  buildQuote,
  getTier,
  getModulePrice,
  type CurrencyCode,
  type BillingPeriod,
  type TierId,
} from "../data/pricing";
import { projects } from "../data/projects";

export const pricingRouter = Router();

/**
 * GET /api/pricing
 * Полный прайс-лист: тарифы, модули, бандлы, валюты.
 * Используется фронтом /pricing для одного запроса вместо 4-х.
 */
pricingRouter.get("/", (_req, res) => {
  // Обогащаем модули названием из projects.ts (избегаем рассинхрона)
  const modulesEnriched = MODULES_PRICING.map((m) => {
    const p = projects.find((x) => x.id === m.id);
    return {
      ...m,
      name: p?.name ?? m.id,
      code: p?.code ?? m.id.toUpperCase(),
      kind: p?.kind ?? "product",
      tags: p?.tags ?? [],
    };
  });

  res.json({
    generatedAt: new Date().toISOString(),
    currency: "USD",
    annualDiscountPercent: 16,
    tiers: TIERS,
    modules: modulesEnriched,
    bundles: BUNDLES,
    currencies: CURRENCY_RATES,
    notes: [
      "Цены указаны в USD. Конвертация в KZT/RUB/EUR — справочная, окончательный счёт в USD.",
      "Annual billing экономит 16% (≈2 месяца бесплатно).",
      "Enterprise — индивидуальный договор, фиксированный SLA, NDA/DPA.",
    ],
  });
});

/**
 * GET /api/pricing/tiers
 * Только тарифы (легче для фронта, если модули не нужны).
 */
pricingRouter.get("/tiers", (_req, res) => {
  res.json({ items: TIERS, total: TIERS.length });
});

/**
 * GET /api/pricing/tiers/:id
 * Один тариф детально.
 */
pricingRouter.get("/tiers/:id", (req, res) => {
  const tier = getTier(req.params.id);
  if (!tier) {
    return res.status(404).json({ error: "tier_not_found", id: req.params.id });
  }
  res.json(tier);
});

/**
 * GET /api/pricing/modules
 * Прайс по модулям (с обогащением из projects.ts).
 */
pricingRouter.get("/modules", (_req, res) => {
  const items = MODULES_PRICING.map((m) => {
    const p = projects.find((x) => x.id === m.id);
    return {
      ...m,
      name: p?.name ?? m.id,
      code: p?.code ?? m.id.toUpperCase(),
    };
  });
  res.json({ items, total: items.length });
});

/**
 * GET /api/pricing/modules/:id
 * Цена одного модуля + метаданные.
 */
pricingRouter.get("/modules/:id", (req, res) => {
  const m = getModulePrice(req.params.id);
  if (!m) {
    return res.status(404).json({ error: "module_not_found", id: req.params.id });
  }
  const p = projects.find((x) => x.id === m.id);
  res.json({
    ...m,
    name: p?.name ?? m.id,
    code: p?.code ?? m.id.toUpperCase(),
    description: p?.description,
    tags: p?.tags ?? [],
  });
});

/**
 * GET /api/pricing/bundles
 * Готовые сборки модулей.
 */
pricingRouter.get("/bundles", (_req, res) => {
  res.json({ items: BUNDLES, total: BUNDLES.length });
});

/**
 * POST /api/pricing/quote
 * Body: { tierId, modules?, seats?, period?, currency? }
 * Возвращает смету: lines, subtotal, discount, total.
 *
 * Validation:
 *   - tierId обязателен и должен быть из known set
 *   - seats: integer 1..1000
 *   - modules: массив строк <= 30
 *   - period: 'monthly' | 'annual'
 *   - currency: 'USD' | 'EUR' | 'KZT' | 'RUB'
 */
pricingRouter.post("/quote", (req, res) => {
  const body = req.body ?? {};
  const tierId = body.tierId as TierId | undefined;
  if (!tierId || !["free", "pro", "business", "enterprise"].includes(tierId)) {
    return res.status(400).json({ error: "invalid_tier", tierId });
  }
  const seats = Number.isFinite(body.seats) ? Math.min(1000, Math.max(1, Math.floor(body.seats))) : 1;
  const period: BillingPeriod = body.period === "annual" ? "annual" : "monthly";
  const currency: CurrencyCode =
    typeof body.currency === "string" && body.currency in CURRENCY_RATES
      ? (body.currency as CurrencyCode)
      : "USD";
  const modules = Array.isArray(body.modules) ? body.modules.slice(0, 30).filter((x: unknown) => typeof x === "string") : [];

  const quote = buildQuote({ tierId, modules, seats, period, currency });
  res.json(quote);
});

/**
 * GET /api/pricing/healthz
 * Sanity-check для CI/мониторинга.
 */
pricingRouter.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    tiers: TIERS.length,
    modules: MODULES_PRICING.length,
    bundles: BUNDLES.length,
    timestamp: new Date().toISOString(),
  });
});
