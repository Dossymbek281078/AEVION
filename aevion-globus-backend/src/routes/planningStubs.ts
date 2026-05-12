/**
 * Planning-stub router factory.
 *
 * Many AEVION modules are still at the "landing + waitlist" stage. Rather than
 * copy-paste a separate router per module, this factory produces a Router
 * exposing /status, /health, /waitlist, /openapi.json for any given module
 * config. A single shared `planning_waitlist` table holds all signups, keyed
 * by module id.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { sendWaitlistConfirmation } from "../lib/planningEmail";

import { requireProdSecret as _reqPS } from "../lib/qsignSecret";
const getUnsubSecret = () => _reqPS("WAITLIST_UNSUB_SECRET", "aevion-waitlist-unsub-dev-only-key");

/** token = base64url(moduleId).base64url(emailHash).hmac
 *  Tamper-evident; user can only unsubscribe themselves. */
function makeUnsubToken(moduleId: string, emailHash: string): string {
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  const payload = `${b64(moduleId)}.${b64(emailHash)}`;
  const sig = createHmac("sha256", getUnsubSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyUnsubToken(token: string): { moduleId: string; emailHash: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [b64Mod, b64Hash, sig] = parts;
  const payload = `${b64Mod}.${b64Hash}`;
  const expected = createHmac("sha256", getUnsubSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return {
      moduleId: Buffer.from(b64Mod, "base64url").toString("utf8"),
      emailHash: Buffer.from(b64Hash, "base64url").toString("utf8"),
    };
  } catch {
    return null;
  }
}

async function removeFromWaitlist(moduleId: string, emailHash: string): Promise<boolean> {
  await ensureTables();
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `DELETE FROM planning_waitlist WHERE module_id = $1 AND email_hash = $2 RETURNING id`,
        [moduleId, emailHash],
      );
      return (r.rowCount ?? 0) > 0;
    } catch {
      // fall through to memory
    }
  }
  const mod = memoryWaitlist.get(moduleId);
  if (!mod) return false;
  return mod.delete(emailHash);
}

export { makeUnsubToken };

export type PlanningStubConfig = {
  id: string;               // "qgood"
  title: string;            // "AEVION QGood"
  description: string;      // shown in OpenAPI and /status
  phase: "idea" | "planning" | "research" | "pre-launch";
  eta: string;              // "Q3 2027"
  principles: string[];
  milestones: { id: string; label: string; status: "planned" | "in-progress" | "done" }[];
};

let tablesReady = false;
let dbAvailable = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planning_waitlist (
        id          TEXT PRIMARY KEY,
        module_id   TEXT NOT NULL,
        email_hash  TEXT NOT NULL,
        email       TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (module_id, email_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_planning_waitlist_module ON planning_waitlist (module_id, created_at DESC);
    `);
    tablesReady = true;
    dbAvailable = true;
  } catch (err) {
    tablesReady = true;
    dbAvailable = false;
    console.warn(
      "[planning-stubs] table init skipped — using in-memory waitlist:",
      err instanceof Error ? err.message : err,
    );
  }
}

// Per-module in-memory fallback: moduleId → email-hash → record
const memoryWaitlist = new Map<string, Map<string, { id: string; email: string; createdAt: string }>>();

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function getWaitlistCount(moduleId: string): Promise<number> {
  await ensureTables();
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        "SELECT COUNT(*)::int AS c FROM planning_waitlist WHERE module_id = $1",
        [moduleId],
      );
      return r.rows[0]?.c ?? 0;
    } catch {
      return memoryWaitlist.get(moduleId)?.size ?? 0;
    }
  }
  return memoryWaitlist.get(moduleId)?.size ?? 0;
}

async function addToWaitlist(
  moduleId: string,
  email: string,
): Promise<{ created: boolean; id: string }> {
  await ensureTables();
  const id = randomUUID();
  const emailHash = hashEmail(email);
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `INSERT INTO planning_waitlist (id, module_id, email_hash, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (module_id, email_hash) DO NOTHING
         RETURNING id`,
        [id, moduleId, emailHash, email],
      );
      return { created: r.rowCount > 0, id: r.rows[0]?.id ?? id };
    } catch {
      // fall through
    }
  }
  let mod = memoryWaitlist.get(moduleId);
  if (!mod) {
    mod = new Map();
    memoryWaitlist.set(moduleId, mod);
  }
  if (mod.has(emailHash)) {
    return { created: false, id: mod.get(emailHash)!.id };
  }
  mod.set(emailHash, { id, email, createdAt: new Date().toISOString() });
  return { created: true, id };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · AEVION</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#020617;color:#e2e8f0;margin:0;padding:24px;display:flex;align-items:center;justify-content:center;min-height:90vh}.card{max-width:520px;background:#0f172a;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08)}h2{margin:0 0 12px;font-size:22px;color:#f8fafc}p{margin:0 0 12px;line-height:1.6;color:#cbd5e1;font-size:14px}a{color:#22d3ee;font-weight:600}.logo{font-size:13px;font-weight:800;color:#22d3ee;letter-spacing:.08em;margin-bottom:20px;text-transform:uppercase}</style></head><body><div class="card"><div class="logo">AEVION</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><p><a href="https://aevion.app/">← на главную</a></p></div></body></html>`;
}

export function createPlanningStubRouter(config: PlanningStubConfig): Router {
  const router = Router();

  const waitlistLimiter = rateLimit({
    windowMs: 60_000,
    max: 5,
    keyPrefix: `planning:${config.id}:waitlist`,
    message: "rate_limit_exceeded: max 5 signups per minute per IP",
  });

  router.get("/health", async (_req, res) => {
    const count = await getWaitlistCount(config.id);
    res.json({ ok: true, module: config.id, phase: config.phase, eta: config.eta, waitlistCount: count });
  });

  router.get("/status", async (_req, res) => {
    const count = await getWaitlistCount(config.id);
    res.json({
      module: config.id,
      title: config.title,
      description: config.description,
      phase: config.phase,
      eta: config.eta,
      waitlistCount: count,
      principles: config.principles,
      milestones: config.milestones,
    });
  });

  router.post("/waitlist", waitlistLimiter, async (req: Request, res: Response) => {
    const email = (req.body || {}).email;
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "invalid-email" });
    }
    try {
      const { created, id } = await addToWaitlist(config.id, email);
      const count = await getWaitlistCount(config.id);
      if (created) {
        const emailHash = hashEmail(email);
        const unsubToken = makeUnsubToken(config.id, emailHash);
        // Fire-and-forget confirmation. Silently skips if SMTP isn't configured.
        sendWaitlistConfirmation({
          toEmail: email,
          moduleId: config.id,
          moduleTitle: config.title,
          modulePhase: config.phase,
          moduleEta: config.eta,
          moduleDescription: config.description,
          unsubToken,
        });
      }
      res.status(created ? 201 : 200).json({ ok: true, id, alreadyJoined: !created, waitlistCount: count });
    } catch {
      res.status(500).json({ error: "waitlist-failed" });
    }
  });

  router.get("/unsubscribe", async (req: Request, res: Response) => {
    const token = String(req.query.token ?? "").trim();
    if (!token) {
      return res.status(400).send(htmlPage("Bad request", "Параметр token отсутствует."));
    }
    const decoded = verifyUnsubToken(token);
    if (!decoded || decoded.moduleId !== config.id) {
      return res.status(400).send(htmlPage("Invalid token", "Ссылка повреждена или относится к другому модулю."));
    }
    const removed = await removeFromWaitlist(decoded.moduleId, decoded.emailHash);
    if (!removed) {
      return res.status(200).send(htmlPage(
        "Уже отписаны",
        `Вы уже не в списке ${config.title}. Это окончательно.`,
      ));
    }
    res.status(200).send(htmlPage(
      "Отписка подтверждена",
      `Вы удалены из списка ${config.title}. Мы больше не отправим вам уведомления о запуске.`,
    ));
  });

  router.options("/openapi.json", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.status(204).end();
  });

  router.get("/openapi.json", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const base = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/$/, "");
    res.json({
      openapi: "3.1.0",
      info: {
        title: config.title,
        version: "0.1.0",
        description: config.description,
        contact: { name: "AEVION", url: "https://aevion.app", email: "support@aevion.app" },
      },
      servers: [{ url: `${base}/api/${config.id}`, description: "Production" }],
      paths: {
        "/health": { get: { summary: "Service health" } },
        "/status": { get: { summary: "Public status, phase, ETA, principles, milestones" } },
        "/waitlist": {
          post: {
            summary: "Join the launch waitlist (rate-limited 5/min/IP)",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["email"],
                    properties: { email: { type: "string", format: "email" } },
                  },
                },
              },
            },
            responses: {
              "200": { description: "already joined" },
              "201": { description: "added" },
              "400": { description: "invalid email" },
              "429": { description: "rate limited" },
            },
          },
        },
      },
    });
  });

  return router;
}

// ── Module configs ──────────────────────────────────────────────────────────

export const PLANNING_MODULES: PlanningStubConfig[] = [
  // NOTE: qgood removed from factory — has dedicated MVP router at /api/qgood
  //       (mounted via qgoodRouter in index.ts) with /campaigns, /donations, /stats.
  {
    id: "voice-of-earth",
    title: "AEVION Voice of Earth",
    description:
      "Международный музыкальный проект: позитивные песни на разных языках, объединённые сквозной темой и протоколом авторства через QRight.",
    phase: "idea",
    eta: "Q1 2027",
    principles: [
      "Каждая композиция — на отдельном языке/культуре",
      "QRight + QSign — встроенная фиксация авторства",
      "Open royalties — публичный счётчик распределения",
      "Лонг-форм видеосерия в Awards / Globus",
    ],
    milestones: [
      { id: "first-track", label: "Первый трек (пилот)", status: "planned" },
      { id: "language-board", label: "Совет языков (10 культур)", status: "planned" },
      { id: "royalty-engine", label: "On-chain royalty splitter", status: "planned" },
    ],
  },
  {
    id: "kids-ai-content",
    title: "AEVION Kids AI Content",
    description:
      "Безопасный многоязычный AI-контент для детей: мультформаты, логопедический эффект, родительский контроль и измеримая образовательная польза.",
    phase: "planning",
    eta: "Q4 2026",
    principles: [
      "Жёсткие фильтры контента + родительский dashboard",
      "Многоязычность с первого дня (3+ языка)",
      "Логопедический модуль через произношение",
      "Tied образовательный план с возрастной шкалой",
    ],
    milestones: [
      { id: "pilot-corpus", label: "Пилотный корпус 50 уроков", status: "planned" },
      { id: "parent-dashboard", label: "Родительский dashboard", status: "planned" },
      { id: "speech-loop", label: "Логопедический цикл произношения", status: "planned" },
    ],
  },
  {
    id: "startup-exchange",
    title: "AEVION Startup Exchange",
    description:
      "Биржа стартапов и идей с встроенной защитой авторства через QRight + QSign и безопасной коммуникацией основателей с инвесторами.",
    phase: "planning",
    eta: "Q2 2027",
    principles: [
      "Pitch автоматически фиксируется в QRight",
      "Smart-NDA через QContract до раскрытия",
      "Эскроу-платежи поверх QPayNet",
      "Public reputation — без анонимных инвесторов",
    ],
    milestones: [
      { id: "founder-pitch-mvp", label: "Pitch + Smart-NDA MVP", status: "planned" },
      { id: "investor-room", label: "Инвестор-комната с QSign-аудитом", status: "planned" },
      { id: "escrow", label: "QPayNet эскроу", status: "planned" },
    ],
  },
  {
    id: "shadownet",
    title: "AEVION ShadowNet",
    description:
      "Концепция альтернативной приватной сети поверх VeilNetX — анонимный форум, mesh-обмен и off-grid коммуникации.",
    phase: "idea",
    eta: "Q2 2028",
    principles: [
      "Поверх VeilNetX Tor-маршрутизации",
      "Mesh fallback при отсутствии интернета",
      "End-to-end шифрование без метаданных",
      "Open-source клиенты + воспроизводимые сборки",
    ],
    milestones: [
      { id: "spec", label: "Публичная спецификация протокола", status: "planned" },
      { id: "mesh-pilot", label: "Mesh-пилот на одной территории", status: "planned" },
      { id: "anon-forum", label: "Анонимный форум поверх VeilNetX", status: "planned" },
    ],
  },
  {
    id: "deepsan",
    title: "AEVION DeepSan",
    description:
      "Антихаос-приложение: планирование, структурирование задач, поддержка фокуса и измеримое снижение когнитивной нагрузки.",
    phase: "research",
    eta: "Q4 2027",
    principles: [
      "Задачи как состояния (intent → action → close)",
      "AI-разбор хаоса в inbox: 1 клик → структура",
      "Принудительные фокус-сессии (анти-task-switch)",
      "Интеграция с QCoreAI / Multichat",
    ],
    milestones: [
      { id: "inbox-parser", label: "AI inbox-парсер", status: "planned" },
      { id: "focus-engine", label: "Engine фокус-сессий", status: "planned" },
      { id: "qcore-bridge", label: "Bridge к QCoreAI агентам", status: "planned" },
    ],
  },
  // NOTE: qmaskcard removed from factory — has dedicated MVP router at /api/qmaskcard
  //       (mounted via qmaskcardRouter in index.ts) with /masks, /charges, /stats endpoints.
  {
    id: "qpersona",
    title: "AEVION QPersona",
    description:
      "Цифровой аватар-заместитель: AI-двойник по вашим текстам, голосу и истории решений. Делегирует рутинные коммуникации, сохраняя ваш стиль.",
    phase: "research",
    eta: "Q3 2027",
    principles: [
      "3 модальности: текст / голос / прошлые решения",
      "Стиль клонируется по 1000+ сообщений, не по «промпт-инжинирингу»",
      "Эскалация к человеку на спорных случаях",
      "Авторизация и аудит каждого ответа аватара через QSign",
    ],
    milestones: [
      { id: "text-clone", label: "Клон стиля из 1000+ сообщений", status: "planned" },
      { id: "voice-clone", label: "Голосовой клон (5 мин референса)", status: "planned" },
      { id: "escalation-engine", label: "Engine эскалации", status: "planned" },
    ],
  },
  {
    id: "qlife",
    title: "AEVION QLife",
    description:
      "Personal OS — сборка-композит 6 столпов AEVION (HealthAI / QRight / Multichat / QGood / QTradeOffline / QSign) в единый «жизненный» интерфейс.",
    phase: "idea",
    eta: "Q2 2028",
    principles: [
      "Не отдельный продукт — а интегрированный shell над AEVION-модулями",
      "Один dashboard: здоровье / финансы / контент / коммуникации",
      "Cross-module insights (AI: «вы реже звоните, когда HRV падает»)",
      "Polyglot UI: 3+ языка с первого дня",
    ],
    milestones: [
      { id: "shell-mvp", label: "Shell над HealthAI + Multichat + QGood", status: "planned" },
      { id: "cross-insights", label: "Cross-module AI insights", status: "planned" },
      { id: "polyglot", label: "Polyglot UI (3 языка)", status: "planned" },
    ],
  },
  {
    id: "psyapp-deps",
    title: "AEVION PsyApp",
    description:
      "Платформа выхода из зависимостей (алкоголь / курение / ставки): триггер-детекция, групповая поддержка, профилактика срывов на основе поведенческой аналитики.",
    phase: "research",
    eta: "Q4 2027",
    principles: [
      "Trigger-детектор: ML на time-series поведения",
      "Anonymous-by-default групповая поддержка",
      "Профилактика срывов (early-warning за 12-48ч)",
      "Эскалация к специалисту QGood при риске",
    ],
    milestones: [
      { id: "trigger-detector", label: "ML trigger-детектор", status: "planned" },
      { id: "group-support", label: "Анонимные группы поддержки", status: "planned" },
      { id: "early-warning", label: "Early-warning срывов", status: "planned" },
    ],
  },
  {
    id: "mapreality",
    title: "AEVION MapReality",
    description:
      "Карта реальных событий и потребностей: агрегирование сигналов общества — где нужны волонтёры, врачи, инструменты, информация. Без «новостной» искажающей подачи.",
    phase: "idea",
    eta: "Q1 2028",
    principles: [
      "Сигналы — от граждан, не от редакторов",
      "Сырые данные с гео-привязкой, без интерпретации",
      "QSign-аудит источников сигнала",
      "Open API — любой может строить свою визуализацию",
    ],
    milestones: [
      { id: "signal-collector", label: "Сборщик сигналов через QRight", status: "planned" },
      { id: "geo-cluster", label: "Гео-кластеризация и фильтры", status: "planned" },
      { id: "open-api", label: "Open API для сторонних карт", status: "planned" },
    ],
  },
  {
    id: "z-tide",
    title: "AEVION Z-Tide",
    description:
      "Концептуальная валюта, связанная с энергией / эмоциями / социальным вкладом. Research-проект: можно ли строить экономику, где «единица» не truha количество, а энергозатраты + социальная польза.",
    phase: "idea",
    eta: "TBD",
    principles: [
      "Чисто research — не product roadmap",
      "Привязка к измеримым актам (объём работы / влияние)",
      "Без анонимности — каждая единица аудируема через QSign",
      "Не replace AEV — параллельный экспериментальный слой",
    ],
    milestones: [
      { id: "whitepaper", label: "Whitepaper v0", status: "planned" },
      { id: "pilot-loop", label: "Pilot замкнутый контур", status: "planned" },
      { id: "audit", label: "Внешний аудит концепции", status: "planned" },
    ],
  },
  {
    id: "lifebox",
    title: "AEVION LifeBox",
    description:
      "Цифровой сейф для будущего «я»: документы, знания, инструкции, ценности. Долгоживущее хранилище с протоколом доступа после смерти и наследованием через QShield (Shamir-разбиение).",
    phase: "planning",
    eta: "Q2 2027",
    principles: [
      "100-летнее хранилище (forward-compatible форматы)",
      "Inheritance через QShield Shamir-shares (наследники + опекуны)",
      "QSign-аудит каждого доступа",
      "Triggers: смерть / недееспособность / явное открытие",
    ],
    milestones: [
      { id: "long-term-storage", label: "Хранилище с проверкой целостности", status: "planned" },
      { id: "shamir-inheritance", label: "Наследование через QShield", status: "planned" },
      { id: "trigger-engine", label: "Engine триггеров доступа", status: "planned" },
    ],
  },
  // NOTE: qchaingov removed from factory — has dedicated MVP router at /api/qchaingov
  //       (mounted via qchaingovRouter in index.ts) with vote-engine + initiatives.
];
