import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
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
 * Хранилище лидов: JSONL по строке на лид.
 * Путь: aevion-globus-backend/data/leads.jsonl
 * Один файл — append-only, потокобезопасно для одного процесса.
 */
const LEADS_FILE = process.env.LEADS_FILE
  ? process.env.LEADS_FILE
  : join(process.cwd(), "data", "leads.jsonl");

function ensureLeadsDir() {
  const dir = dirname(LEADS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

interface PricingLead {
  id: string;
  ts: string;
  name: string;
  email: string;
  company?: string;
  industry?: string;
  tier?: TierId;
  modules?: string[];
  seats?: number;
  message?: string;
  source?: string;
  ip?: string;
}

function rateLimitKey(ip: string): string {
  return `lead:${ip}`;
}
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 мин
const RATE_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = rateLimitKey(ip);
  const cur = RATE_LIMIT.get(key);
  if (!cur || cur.reset < now) {
    RATE_LIMIT.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  if (cur.count >= RATE_MAX) return true;
  cur.count += 1;
  return false;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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
 * POST /api/pricing/lead
 * Body: { name, email, company?, industry?, tier?, modules?, seats?, message?, source? }
 *
 * Создаёт лид в JSONL-файле. Простая защита: rate-limit 5/10мин на IP +
 * валидация email + длины полей. Без БД — для GTM-этапа этого достаточно.
 *
 * Returns: { ok: true, id }
 */
pricingRouter.post("/lead", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const company = typeof body.company === "string" ? body.company.trim().slice(0, 200) : undefined;
  const industry = typeof body.industry === "string" ? body.industry.trim().slice(0, 60) : undefined;
  const tier = typeof body.tier === "string" && ["free", "pro", "business", "enterprise"].includes(body.tier)
    ? (body.tier as TierId)
    : undefined;
  const seats = Number.isFinite(body.seats) ? Math.min(10000, Math.max(1, Math.floor(body.seats))) : undefined;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : undefined;
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 60) : undefined;
  const modules = Array.isArray(body.modules)
    ? body.modules.slice(0, 30).filter((x: unknown) => typeof x === "string").map((s: string) => s.slice(0, 60))
    : undefined;

  if (!name || name.length < 2) {
    return res.status(400).json({ error: "invalid_name" });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const lead: PricingLead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    name,
    email,
    company,
    industry,
    tier,
    modules,
    seats,
    message,
    source,
    ip,
  };

  try {
    ensureLeadsDir();
    appendFileSync(LEADS_FILE, JSON.stringify(lead) + "\n", "utf8");
  } catch (e) {
    console.error("[pricing/lead] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(201).json({ ok: true, id: lead.id });
});

/**
 * GET /api/pricing/leads/count
 * Общее число лидов — для GTM-дашборда. БЕЗ доступа к содержимому.
 */
pricingRouter.get("/leads/count", (_req, res) => {
  try {
    if (!existsSync(LEADS_FILE)) return res.json({ total: 0 });
    const content = readFileSync(LEADS_FILE, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    res.json({ total: lines.length });
  } catch (e) {
    console.error("[pricing/leads/count] read failed", e);
    res.status(500).json({ error: "read_error" });
  }
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
