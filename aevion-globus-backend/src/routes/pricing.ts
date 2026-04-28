import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import {
  TIERS,
  MODULES_PRICING,
  BUNDLES,
  CURRENCY_RATES,
  PROMO_CODES,
  buildQuote,
  getTier,
  getModulePrice,
  resolvePromoCode,
  type CurrencyCode,
  type BillingPeriod,
  type TierId,
} from "../data/pricing";
import { projects } from "../data/projects";
import { TESTIMONIALS, TRUST_NUMBERS, TRUST_BADGES } from "../data/trust";
import { ROADMAP, PHASE_META } from "../data/roadmap";
import { CASE_STUDIES, getCaseStudy } from "../data/cases";

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
  const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim().slice(0, 40) : undefined;

  const quote = buildQuote({ tierId, modules, seats, period, currency, promoCode });
  res.json(quote);
});

/**
 * POST /api/pricing/promo/validate
 * Body: { code, tierId }
 * Возвращает: { valid, promo?, reason? }
 *
 * Используется фронтом для отдельной проверки кода до отправки full-quote.
 */
pricingRouter.post("/promo/validate", (req, res) => {
  const body = req.body ?? {};
  const code = typeof body.code === "string" ? body.code.trim().slice(0, 40) : "";
  const tierId = body.tierId as TierId;
  if (!code) {
    return res.status(400).json({ valid: false, reason: "empty_code" });
  }
  if (!tierId || !["free", "pro", "business", "enterprise"].includes(tierId)) {
    return res.status(400).json({ valid: false, reason: "invalid_tier" });
  }
  const { promo, reason } = resolvePromoCode(code, tierId);
  if (!promo) {
    return res.json({ valid: false, reason });
  }
  res.json({
    valid: true,
    promo: {
      code: promo.code,
      kind: promo.kind,
      amount: promo.amount,
      description: promo.description,
    },
  });
});

/**
 * GET /api/pricing/promo
 * Публичный список действующих промо-кодов (без maxUses, для маркетинга).
 * Полезно для GTM-баннеров и landing pages.
 */
pricingRouter.get("/promo", (_req, res) => {
  const now = new Date();
  const items = PROMO_CODES.filter((p) => !p.validUntil || new Date(p.validUntil) > now).map((p) => ({
    code: p.code,
    kind: p.kind,
    amount: p.amount,
    description: p.description,
    validUntil: p.validUntil,
    tiers: p.tiers ?? [],
  }));
  res.json({ items, total: items.length });
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
 * GET /api/pricing/leads
 * Список последних лидов. Защищён ADMIN_TOKEN (header X-Admin-Token).
 * Если ADMIN_TOKEN не задан — endpoint полностью недоступен (401).
 *
 * ?limit=N — последние N (макс 500), по умолчанию 100
 */
pricingRouter.get("/leads", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    return res.status(401).json({ error: "admin_token_not_configured" });
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (got !== required) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10), 1), 500);

  try {
    if (!existsSync(LEADS_FILE)) return res.json({ items: [], total: 0 });
    const content = readFileSync(LEADS_FILE, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const tail = lines.slice(-limit).reverse();
    const items: PricingLead[] = [];
    for (const line of tail) {
      try {
        items.push(JSON.parse(line) as PricingLead);
      } catch {
        // skip malformed
      }
    }
    res.json({ items, total: lines.length });
  } catch (e) {
    console.error("[pricing/leads] read failed", e);
    res.status(500).json({ error: "read_error" });
  }
});

/**
 * GET /api/pricing/roadmap
 * Публичный roadmap по 27 модулям: timeline, фазы, прогресс.
 * Обогащает каждую запись данными из projects.ts (name, code, description).
 */
pricingRouter.get("/roadmap", (_req, res) => {
  const items = ROADMAP.map((r) => {
    const p = projects.find((x) => x.id === r.id);
    return {
      ...r,
      name: p?.name ?? r.id,
      code: p?.code ?? r.id.toUpperCase(),
      description: p?.description ?? "",
      tags: p?.tags ?? [],
    };
  }).sort((a, b) => a.targetSortKey - b.targetSortKey);

  res.json({
    items,
    total: items.length,
    phases: PHASE_META,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/pricing/cases
 * Customer case studies для /pricing/cases.
 * Фильтры: ?industry=&tier=&module=
 *
 * Возвращает summary-объекты (без полного challenge/solution/outcome),
 * чтобы листинг грузился быстро. Для полного — /api/pricing/cases/:id.
 */
pricingRouter.get("/cases", (req, res) => {
  const industry = typeof req.query.industry === "string" ? req.query.industry : undefined;
  const tier = typeof req.query.tier === "string" ? req.query.tier : undefined;
  const moduleId = typeof req.query.module === "string" ? req.query.module : undefined;

  const items = CASE_STUDIES.filter(
    (c) =>
      (!industry || c.industry === industry) &&
      (!tier || c.tier === tier) &&
      (!moduleId || c.modules.includes(moduleId)),
  );

  res.json({ items, total: items.length });
});

/**
 * GET /api/pricing/cases/:id
 * Детальный case study.
 */
pricingRouter.get("/cases/:id", (req, res) => {
  const c = getCaseStudy(req.params.id);
  if (!c) {
    return res.status(404).json({ error: "case_not_found", id: req.params.id });
  }
  res.json(c);
});

/**
 * GET /api/pricing/testimonials
 * Публичные отзывы — фильтрация по ?industry= и ?module=.
 */
pricingRouter.get("/testimonials", (req, res) => {
  const industry = typeof req.query.industry === "string" ? req.query.industry : undefined;
  const moduleId = typeof req.query.module === "string" ? req.query.module : undefined;
  const items = TESTIMONIALS.filter(
    (t) =>
      (!industry || t.industry === industry) && (!moduleId || t.module === moduleId),
  );
  res.json({ items, total: items.length });
});

/**
 * GET /api/pricing/trust
 * Trust signals: цифры + бейджи compliance.
 */
pricingRouter.get("/trust", (_req, res) => {
  res.json({
    numbers: TRUST_NUMBERS,
    badges: TRUST_BADGES,
  });
});

/* ===========================
 * Newsletter signup
 * Хранение: data/newsletter.jsonl (gitignored).
 * =========================== */

const NEWSLETTER_FILE = process.env.NEWSLETTER_FILE
  ? process.env.NEWSLETTER_FILE
  : join(process.cwd(), "data", "newsletter.jsonl");

const NEWSLETTER_RATE = new Map<string, { count: number; reset: number }>();
function newsletterRateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = NEWSLETTER_RATE.get(ip);
  if (!cur || cur.reset < now) {
    NEWSLETTER_RATE.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return false;
  }
  if (cur.count >= 3) return true;
  cur.count += 1;
  return false;
}

interface NewsletterEntry {
  id: string;
  ts: string;
  email: string;
  source?: string;
  ip: string;
}

/**
 * POST /api/pricing/newsletter
 * Body: { email, source? }
 *
 * Лёгкий signup-форм для лидгена тех, кто не готов покупать.
 */
pricingRouter.post("/newsletter", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (newsletterRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 60) : undefined;

  const entry: NewsletterEntry = {
    id: `nl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    email,
    source,
    ip,
  };

  try {
    const dir = dirname(NEWSLETTER_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(NEWSLETTER_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    console.error("[newsletter] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(201).json({ ok: true, id: entry.id });
});

/**
 * GET /api/pricing/newsletter/count
 * Количество подписчиков — не PII.
 */
pricingRouter.get("/newsletter/count", (_req, res) => {
  try {
    if (!existsSync(NEWSLETTER_FILE)) return res.json({ total: 0 });
    const content = readFileSync(NEWSLETTER_FILE, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    res.json({ total: lines.length });
  } catch (e) {
    console.error("[newsletter/count] read failed", e);
    res.status(500).json({ error: "read_error" });
  }
});

/* ===========================
 * Affiliate / Partner programs
 * Хранение: data/affiliate.jsonl, data/partners.jsonl, data/edu.jsonl
 * =========================== */

const AFFILIATE_FILE = process.env.AFFILIATE_FILE
  ? process.env.AFFILIATE_FILE
  : join(process.cwd(), "data", "affiliate.jsonl");

const PARTNERS_FILE = process.env.PARTNERS_FILE
  ? process.env.PARTNERS_FILE
  : join(process.cwd(), "data", "partners.jsonl");

const EDU_FILE = process.env.EDU_FILE
  ? process.env.EDU_FILE
  : join(process.cwd(), "data", "edu.jsonl");

const PROGRAM_RATE = new Map<string, { count: number; reset: number }>();
function programRateLimited(ip: string, kind: string): boolean {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const cur = PROGRAM_RATE.get(key);
  if (!cur || cur.reset < now) {
    PROGRAM_RATE.set(key, { count: 1, reset: now + 10 * 60 * 1000 });
    return false;
  }
  if (cur.count >= 3) return true;
  cur.count += 1;
  return false;
}

interface ProgramApplication {
  id: string;
  ts: string;
  kind: "affiliate" | "partner" | "edu";
  name: string;
  email: string;
  organization?: string;
  country?: string;
  details?: string;
  ip: string;
  /** affiliate-only: предполагаемый канал привлечения */
  channel?: string;
  /** partner-only: тип партнёра */
  partnerType?: "reseller" | "system_integrator" | "agency";
  /** edu-only: домен .edu / название университета */
  institutionDomain?: string;
}

function persistApplication(file: string, app: ProgramApplication) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(file, JSON.stringify(app) + "\n", "utf8");
}

/**
 * POST /api/pricing/affiliate/apply
 * Body: { name, email, organization?, country?, channel?, details? }
 * Заявка на участие в реферальной программе AEVION (20% recurring lifetime).
 */
pricingRouter.post("/affiliate/apply", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (programRateLimited(ip, "affiliate")) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const organization = typeof body.organization === "string" ? body.organization.trim().slice(0, 200) : undefined;
  const country = typeof body.country === "string" ? body.country.trim().slice(0, 100) : undefined;
  const channel = typeof body.channel === "string" ? body.channel.trim().slice(0, 200) : undefined;
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : undefined;

  if (!name || name.length < 2) return res.status(400).json({ error: "invalid_name" });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });

  const app: ProgramApplication = {
    id: `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    kind: "affiliate",
    name,
    email,
    organization,
    country,
    channel,
    details,
    ip,
  };

  try {
    persistApplication(AFFILIATE_FILE, app);
  } catch (e) {
    console.error("[affiliate/apply] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(201).json({ ok: true, id: app.id });
});

/**
 * POST /api/pricing/partners/apply
 * Body: { name, email, organization, country, partnerType, details? }
 */
pricingRouter.post("/partners/apply", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (programRateLimited(ip, "partners")) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const organization = typeof body.organization === "string" ? body.organization.trim().slice(0, 200) : "";
  const country = typeof body.country === "string" ? body.country.trim().slice(0, 100) : undefined;
  const partnerType = ["reseller", "system_integrator", "agency"].includes(body.partnerType)
    ? body.partnerType
    : undefined;
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : undefined;

  if (!name || name.length < 2) return res.status(400).json({ error: "invalid_name" });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
  if (!organization) return res.status(400).json({ error: "invalid_organization" });
  if (!partnerType) return res.status(400).json({ error: "invalid_partner_type" });

  const app: ProgramApplication = {
    id: `prt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    kind: "partner",
    name,
    email,
    organization,
    country,
    partnerType,
    details,
    ip,
  };

  try {
    persistApplication(PARTNERS_FILE, app);
  } catch (e) {
    console.error("[partners/apply] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(201).json({ ok: true, id: app.id });
});

/**
 * POST /api/pricing/edu/apply
 * Body: { name, email, organization, institutionDomain, country?, details? }
 */
pricingRouter.post("/edu/apply", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (programRateLimited(ip, "edu")) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const organization = typeof body.organization === "string" ? body.organization.trim().slice(0, 200) : "";
  const institutionDomain = typeof body.institutionDomain === "string" ? body.institutionDomain.trim().toLowerCase().slice(0, 200) : "";
  const country = typeof body.country === "string" ? body.country.trim().slice(0, 100) : undefined;
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : undefined;

  if (!name || name.length < 2) return res.status(400).json({ error: "invalid_name" });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
  if (!organization) return res.status(400).json({ error: "invalid_organization" });

  const app: ProgramApplication = {
    id: `edu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    kind: "edu",
    name,
    email,
    organization,
    country,
    institutionDomain,
    details,
    ip,
  };

  try {
    persistApplication(EDU_FILE, app);
  } catch (e) {
    console.error("[edu/apply] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(201).json({ ok: true, id: app.id });
});

/**
 * GET /api/pricing/applications?kind=affiliate|partner|edu
 * Token-gated: x-admin-token. Возвращает последние N заявок из соответствующего JSONL.
 * Используется /pricing/admin для мониторинга всех program-applications в одном месте.
 */
pricingRouter.get("/applications", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    return res.status(401).json({ error: "admin_token_not_configured" });
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (got !== required) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const kind = req.query.kind === "affiliate" || req.query.kind === "partner" || req.query.kind === "edu"
    ? (req.query.kind as "affiliate" | "partner" | "edu")
    : null;
  if (!kind) {
    return res.status(400).json({ error: "invalid_kind", expected: ["affiliate", "partner", "edu"] });
  }
  const file =
    kind === "affiliate" ? AFFILIATE_FILE : kind === "partner" ? PARTNERS_FILE : EDU_FILE;

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10), 1), 500);

  try {
    if (!existsSync(file)) return res.json({ items: [], total: 0, kind });
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const tail = lines.slice(-limit).reverse();
    const items: ProgramApplication[] = [];
    for (const line of tail) {
      try {
        items.push(JSON.parse(line) as ProgramApplication);
      } catch {
        // skip malformed
      }
    }
    res.json({ items, total: lines.length, kind });
  } catch (e) {
    console.error(`[applications/${kind}] read failed`, e);
    res.status(500).json({ error: "read_error" });
  }
});

/**
 * GET /api/pricing/newsletter/list
 * Token-gated: список последних подписчиков newsletter (без PII в публичном /count).
 */
pricingRouter.get("/newsletter/list", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    return res.status(401).json({ error: "admin_token_not_configured" });
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (got !== required) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10), 1), 500);

  try {
    if (!existsSync(NEWSLETTER_FILE)) return res.json({ items: [], total: 0 });
    const content = readFileSync(NEWSLETTER_FILE, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const tail = lines.slice(-limit).reverse();
    const items: NewsletterEntry[] = [];
    for (const line of tail) {
      try {
        items.push(JSON.parse(line) as NewsletterEntry);
      } catch {
        // skip
      }
    }
    res.json({ items, total: lines.length });
  } catch (e) {
    console.error("[newsletter/list] read failed", e);
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
