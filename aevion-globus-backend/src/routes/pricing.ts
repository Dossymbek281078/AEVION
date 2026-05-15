import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { createHmac, timingSafeEqual } from "crypto";
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
import { CHANGELOG, type ChangelogKind } from "../data/changelog";
import { sendEmail } from "./provisioning";

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

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL?.trim() || "hello@aevion.io";

const PROGRAM_LABELS: Record<ProgramApplication["kind"], { label: string; eta: string; subject: string }> = {
  affiliate: {
    label: "Affiliate Program",
    eta: "1-2 рабочих дня",
    subject: "AEVION Affiliate — заявка получена",
  },
  partner: {
    label: "Partner Program",
    eta: "1-2 рабочих дня",
    subject: "AEVION Partner — заявка получена",
  },
  edu: {
    label: "Education Program",
    eta: "1-2 рабочих дня (с verification)",
    subject: "AEVION for Education — заявка получена",
  },
};

function applicantHtml(app: ProgramApplication): string {
  const meta = PROGRAM_LABELS[app.kind];
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a">
  <div style="background:#fff;border-radius:14px;padding:28px;border:1px solid rgba(15,23,42,0.08)">
    <div style="font-size:11px;font-weight:800;color:#0d9488;letter-spacing:0.06em;margin-bottom:8px">AEVION · ${meta.label.toUpperCase()}</div>
    <h1 style="font-size:22px;margin:0 0 12px">Заявка получена, ${escapeHtml(app.name)}</h1>
    <p style="font-size:14px;line-height:1.5;color:#475569;margin:0 0 16px">
      Спасибо за интерес к ${meta.label}. Customer Success рассмотрит заявку и свяжется в течение <strong>${meta.eta}</strong>.
    </p>
    <div style="background:#f8fafc;border-radius:8px;padding:14px;font-size:13px;color:#475569;font-family:ui-monospace,monospace">
      ID заявки: <strong style="color:#0f172a">${escapeHtml(app.id)}</strong>
    </div>
    <p style="font-size:13px;color:#94a3b8;margin:16px 0 0">
      Вопросы — отвечайте на это письмо или пишите ${NOTIFY_EMAIL}.
    </p>
  </div>
</body></html>`;
}

function applicantText(app: ProgramApplication): string {
  const meta = PROGRAM_LABELS[app.kind];
  return `Заявка получена, ${app.name}

Спасибо за интерес к ${meta.label}. Customer Success рассмотрит заявку и свяжется в течение ${meta.eta}.

ID заявки: ${app.id}

Вопросы — отвечайте на это письмо или пишите ${NOTIFY_EMAIL}.

— AEVION`;
}

function notifyHtml(app: ProgramApplication): string {
  const meta = PROGRAM_LABELS[app.kind];
  const fields: Array<[string, string | undefined]> = [
    ["Имя", app.name],
    ["Email", app.email],
    ["Организация", app.organization],
    ["Страна", app.country],
    ["Канал", app.channel],
    ["Тип партнёра", app.partnerType],
    ["Домен вуза", app.institutionDomain],
    ["Детали", app.details],
  ];
  const rows = fields
    .filter(([, v]) => v && v.trim().length > 0)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;color:#64748b;font-weight:700;vertical-align:top">${k}</td><td style="padding:6px 10px;color:#0f172a">${escapeHtml(v as string)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px">
  <div style="font-size:11px;font-weight:800;color:#0d9488;letter-spacing:0.06em;margin-bottom:6px">NEW ${meta.label.toUpperCase()} APPLICATION</div>
  <h2 style="margin:0 0 14px;font-size:18px">${escapeHtml(app.name)} · ${escapeHtml(app.organization ?? "—")}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
  <div style="margin-top:14px;font-size:11px;color:#94a3b8;font-family:ui-monospace,monospace">
    ID: ${escapeHtml(app.id)} · IP: ${escapeHtml(app.ip)} · ${escapeHtml(app.ts)}
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function notifyApplication(app: ProgramApplication): Promise<void> {
  const meta = PROGRAM_LABELS[app.kind];
  // Auto-reply заявителю
  sendEmail({
    to: app.email,
    subject: meta.subject,
    html: applicantHtml(app),
    text: applicantText(app),
  }).catch((e) => console.error(`[apply/${app.kind}] applicant email failed`, e));
  // Внутреннее уведомление
  sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[${app.kind}] ${app.name} · ${app.organization ?? "—"}`,
    html: notifyHtml(app),
    text: `New ${app.kind} application: ${app.name} (${app.email}) · ${app.organization ?? "—"}\nID: ${app.id}\nDetails: ${app.details ?? "—"}`,
  }).catch((e) => console.error(`[apply/${app.kind}] notify email failed`, e));
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

  notifyApplication(app);
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

  notifyApplication(app);
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

  notifyApplication(app);
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
 * Magic-link auth для self-service dashboards (affiliate, partners).
 * HMAC(email + ":" + scope, DASHBOARD_SECRET) → токен 24-hex.
 *
 * DASHBOARD_SECRET по умолчанию = ADMIN_TOKEN (если не задан отдельно).
 * Это not super-secret — даёт доступ только к данным конкретного email.
 */
function dashboardSecret(): string {
  return (
    process.env.DASHBOARD_SECRET?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    "aevion-dashboard-default-rotate-me"
  );
}

function dashboardToken(email: string, scope: "affiliate" | "partners"): string {
  return createHmac("sha256", dashboardSecret())
    .update(`${email.toLowerCase()}:${scope}`)
    .digest("hex")
    .slice(0, 32);
}

function verifyDashboardToken(email: string, scope: "affiliate" | "partners", got: string): boolean {
  const want = dashboardToken(email, scope);
  if (want.length !== got.length) return false;
  try {
    return timingSafeEqual(Buffer.from(want), Buffer.from(got));
  } catch {
    return false;
  }
}

function readJsonlAll<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  try {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const out: T[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line) as T);
      } catch {
        // skip malformed
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Детерминированный реферальный код по email + scope.
 * Один email → один стабильный ref-code, чтобы повторные magic-link сессии
 * не порождали разные коды.
 */
function refCode(email: string, scope: "aff" | "prt"): string {
  return (
    scope +
    "_" +
    createHmac("sha256", dashboardSecret())
      .update(`ref:${email.toLowerCase()}:${scope}`)
      .digest("hex")
      .slice(0, 8)
  );
}

const SITE_BASE = process.env.PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.io";

function magicLinkHtml(
  appName: string,
  link: string,
  scope: "Affiliate" | "Partner",
): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a">
  <div style="background:#fff;border-radius:14px;padding:28px;border:1px solid rgba(15,23,42,0.08)">
    <div style="font-size:11px;font-weight:800;color:#0d9488;letter-spacing:0.06em;margin-bottom:8px">AEVION · ${scope.toUpperCase()} DASHBOARD</div>
    <h1 style="font-size:22px;margin:0 0 12px">Войти в дашборд</h1>
    <p style="font-size:14px;line-height:1.5;color:#475569;margin:0 0 16px">
      Привет, ${escapeHtml(appName)}. Перейдите по ссылке, чтобы открыть ваш ${scope.toLowerCase()}-дашборд.
      Ссылка действительна для текущего устройства.
    </p>
    <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:linear-gradient(135deg, #0d9488, #0ea5e9);color:#fff;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px">
      Открыть дашборд
    </a>
    <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;font-family:ui-monospace,monospace;word-break:break-all">${escapeHtml(link)}</p>
  </div>
</body></html>`;
}

/**
 * POST /api/pricing/affiliate/magic-link
 * Body: { email }
 * Если email есть в affiliate-applications — отправляет magic-link на email.
 * Всегда отвечает 204 (не раскрываем существование email).
 */
pricingRouter.post("/affiliate/magic-link", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (programRateLimited(ip, "affiliate")) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const apps = readJsonlAll<ProgramApplication>(AFFILIATE_FILE);
  const found = apps.find((a) => a.email === email);

  if (found) {
    const token = dashboardToken(email, "affiliate");
    const link = `${SITE_BASE}/pricing/affiliate-dashboard?email=${encodeURIComponent(email)}&token=${token}`;
    sendEmail({
      to: email,
      subject: "AEVION Affiliate — вход в дашборд",
      html: magicLinkHtml(found.name, link, "Affiliate"),
      text: `Здравствуйте, ${found.name}.\n\nСсылка для входа в Affiliate-дашборд:\n${link}\n\n— AEVION`,
    }).catch((e) => console.error("[affiliate/magic-link] email failed", e));
  }

  // Always 204, don't leak existence.
  res.status(204).end();
});

/**
 * GET /api/pricing/affiliate/dashboard?email=&token=
 * Возвращает данные заявки и заглушки трекинга по аффилиату.
 * Рефкод детерминирован по email — один email = один стабильный код.
 */
pricingRouter.get("/affiliate/dashboard", (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";

  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
  if (!token || !verifyDashboardToken(email, "affiliate", token)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const apps = readJsonlAll<ProgramApplication>(AFFILIATE_FILE);
  const found = apps.find((a) => a.email === email);
  if (!found) return res.status(404).json({ error: "not_found" });

  const code = refCode(email, "aff");
  const refLink = `${SITE_BASE}/?ref=${code}`;

  // Tracking infrastructure не собирает affiliate-клики ещё;
  // отдаём честные нули. Когда появится — заменим на реальные агрегаты.
  const stats = {
    clicks: 0,
    signups: 0,
    mrr_usd: 0,
    pending_payout_usd: 0,
    paid_payout_usd: 0,
    commission_percent: 20,
    cookie_days: 60,
  };

  res.json({
    application: {
      id: found.id,
      ts: found.ts,
      name: found.name,
      email: found.email,
      organization: found.organization ?? null,
      country: found.country ?? null,
      channel: found.channel ?? null,
      status: "submitted",
    },
    refCode: code,
    refLink,
    stats,
    history: [] as Array<{ ts: string; kind: string; value?: number }>,
  });
});

/**
 * POST /api/pricing/partners/magic-link
 * Идентично affiliate, но для partners.
 */
pricingRouter.post("/partners/magic-link", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (programRateLimited(ip, "partners")) {
    return res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
  }
  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const apps = readJsonlAll<ProgramApplication>(PARTNERS_FILE);
  const found = apps.find((a) => a.email === email);

  if (found) {
    const token = dashboardToken(email, "partners");
    const link = `${SITE_BASE}/pricing/partners-portal?email=${encodeURIComponent(email)}&token=${token}`;
    sendEmail({
      to: email,
      subject: "AEVION Partner — вход в портал",
      html: magicLinkHtml(found.name, link, "Partner"),
      text: `Здравствуйте, ${found.name}.\n\nСсылка для входа в Partner-портал:\n${link}\n\n— AEVION`,
    }).catch((e) => console.error("[partners/magic-link] email failed", e));
  }
  res.status(204).end();
});

const PARTNER_DEALS_FILE = process.env.PARTNER_DEALS_FILE
  ? process.env.PARTNER_DEALS_FILE
  : join(process.cwd(), "data", "partner-deals.jsonl");

interface PartnerDeal {
  id: string;
  ts: string;
  partnerEmail: string;
  customer: string;
  customerEmail?: string;
  modules: string[];
  dealSizeUsd: number;
  expectedClose?: string;
  notes?: string;
  status: "registered" | "qualified" | "won" | "lost";
}

function persistDeal(deal: PartnerDeal) {
  const dir = dirname(PARTNER_DEALS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(PARTNER_DEALS_FILE, JSON.stringify(deal) + "\n", "utf8");
}

/**
 * GET /api/pricing/partners/dashboard?email=&token=
 * Партнёрский портал: данные заявки + список зарегистрированных сделок этого партнёра.
 */
pricingRouter.get("/partners/dashboard", (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";

  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
  if (!token || !verifyDashboardToken(email, "partners", token)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const apps = readJsonlAll<ProgramApplication>(PARTNERS_FILE);
  const found = apps.find((a) => a.email === email);
  if (!found) return res.status(404).json({ error: "not_found" });

  const allDeals = readJsonlAll<PartnerDeal>(PARTNER_DEALS_FILE);
  const myDeals = allDeals
    .filter((d) => d.partnerEmail === email)
    .sort((a, b) => b.ts.localeCompare(a.ts));

  const totals = {
    count: myDeals.length,
    pipeline_usd: myDeals.filter((d) => d.status === "registered" || d.status === "qualified").reduce((s, d) => s + d.dealSizeUsd, 0),
    won_usd: myDeals.filter((d) => d.status === "won").reduce((s, d) => s + d.dealSizeUsd, 0),
    lost_usd: myDeals.filter((d) => d.status === "lost").reduce((s, d) => s + d.dealSizeUsd, 0),
  };

  res.json({
    application: {
      id: found.id,
      ts: found.ts,
      name: found.name,
      email: found.email,
      organization: found.organization ?? null,
      country: found.country ?? null,
      partnerType: found.partnerType ?? null,
      status: "submitted",
    },
    deals: myDeals,
    totals,
    margin_percent: 30,
  });
});

/**
 * POST /api/pricing/partners/deals
 * Body: { email, token, customer, customerEmail?, modules[], dealSizeUsd, expectedClose?, notes? }
 * Регистрирует сделку партнёра (deal registration).
 */
pricingRouter.post("/partners/deals", (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });
  if (!token || !verifyDashboardToken(email, "partners", token)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const apps = readJsonlAll<ProgramApplication>(PARTNERS_FILE);
  if (!apps.find((a) => a.email === email)) {
    return res.status(404).json({ error: "partner_not_found" });
  }

  const customer = typeof body.customer === "string" ? body.customer.trim().slice(0, 200) : "";
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase().slice(0, 200) : undefined;
  const modules = Array.isArray(body.modules)
    ? body.modules.filter((m: unknown): m is string => typeof m === "string").slice(0, 20).map((m: string) => m.slice(0, 60))
    : [];
  const dealSizeUsd = Number.isFinite(body.dealSizeUsd) ? Math.max(0, Math.min(10_000_000, Number(body.dealSizeUsd))) : 0;
  const expectedClose = typeof body.expectedClose === "string" ? body.expectedClose.slice(0, 20) : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : undefined;

  if (!customer) return res.status(400).json({ error: "invalid_customer" });
  if (modules.length === 0) return res.status(400).json({ error: "modules_required" });

  const deal: PartnerDeal = {
    id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    partnerEmail: email,
    customer,
    customerEmail,
    modules,
    dealSizeUsd,
    expectedClose,
    notes,
    status: "registered",
  };

  try {
    persistDeal(deal);
  } catch (e) {
    console.error("[partners/deals] write failed", e);
    return res.status(500).json({ error: "storage_error" });
  }

  // Notify channel team
  sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[partner-deal] ${customer} · $${dealSizeUsd.toLocaleString("en-US")}`,
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:20px">
      <div style="font-size:11px;font-weight:800;color:#7c3aed;letter-spacing:0.06em;margin-bottom:6px">NEW DEAL REGISTRATION</div>
      <h2 style="margin:0 0 14px;font-size:18px">${escapeHtml(customer)} · $${dealSizeUsd.toLocaleString("en-US")}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:700">Партнёр</td><td style="padding:6px 10px">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:700">Модули</td><td style="padding:6px 10px">${escapeHtml(modules.join(", "))}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:700">Expected close</td><td style="padding:6px 10px">${escapeHtml(expectedClose ?? "—")}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:700;vertical-align:top">Заметки</td><td style="padding:6px 10px">${escapeHtml(notes ?? "—")}</td></tr>
      </table>
      <div style="margin-top:14px;font-size:11px;color:#94a3b8;font-family:ui-monospace,monospace">ID: ${escapeHtml(deal.id)} · ${escapeHtml(deal.ts)}</div>
    </body></html>`,
    text: `New deal: ${customer} · $${dealSizeUsd}\nPartner: ${email}\nModules: ${modules.join(", ")}\nExpected close: ${expectedClose ?? "—"}\nNotes: ${notes ?? "—"}\nID: ${deal.id}`,
  }).catch((e) => console.error("[partners/deals] notify failed", e));

  res.status(201).json({ ok: true, deal });
});

/**
 * GET /api/pricing/changelog
 * Публичный journal изменений pricing-блока.
 * Параметры:
 *   - kind=added|changed|removed|deprecated|promo|module — фильтр по типу
 *   - since=YYYY-MM-DD — отдавать только записи >= даты
 *   - limit (default 100, max 500), offset (default 0)
 *
 * Сортировка по date desc (новейшие сверху).
 */
pricingRouter.get("/changelog", (req, res) => {
  const KIND_VALUES: ChangelogKind[] = ["added", "changed", "removed", "deprecated", "promo", "module"];
  const kind = typeof req.query.kind === "string" ? (req.query.kind as ChangelogKind) : undefined;
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10), 1), 500);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10), 0);

  if (kind && !KIND_VALUES.includes(kind)) {
    return res.status(400).json({ error: "invalid_kind", kind });
  }

  // Универсум по `since` — нужен для подсчёта counts (кол-во по каждому kind),
  // чтобы UI-фильтры не пропадали при выбранном kind.
  const universe = CHANGELOG.filter((e) => !since || e.date >= since);

  const filtered = universe
    .filter((e) => !kind || e.kind === kind)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit);

  const counts: Partial<Record<ChangelogKind, number>> = {};
  for (const e of universe) counts[e.kind] = (counts[e.kind] ?? 0) + 1;

  res.json({ items, total, counts, kind: kind ?? null, since: since ?? null });
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
