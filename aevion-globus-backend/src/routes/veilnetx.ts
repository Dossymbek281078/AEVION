/**
 * VeilNetX — pre-launch status + waitlist for the privacy proxy network.
 *
 * The actual Tor-routed proxy is on the long-term roadmap (Q4 2026). For now
 * this surface gives partners a live status endpoint and a waitlist they can
 * subscribe to. Persists to Postgres if available; falls back to in-memory.
 */

import { Router, type Request, type Response } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import { randomUUID, createHash } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { mountConceptBoard } from "../lib/conceptBoardStore";

const captureVeilNetXError = makeServiceCapture("veilnetx");

export const veilnetxRouter = Router();

const PHASE = "planning";
const ETA = "Q4 2026";
const VERSION = "0.0.1-preview";

// ── Storage ─────────────────────────────────────────────────────────────────

const memoryWaitlist = new Map<string, { id: string; email: string; createdAt: string }>();
let tablesReady = false;
let dbAvailable = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS veilnetx_waitlist (
        id          TEXT PRIMARY KEY,
        email_hash  TEXT UNIQUE NOT NULL,
        email       TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_veilnetx_waitlist_created ON veilnetx_waitlist (created_at DESC);
    `);
    tablesReady = true;
    dbAvailable = true;
  } catch (err) {
    tablesReady = true;
    dbAvailable = false;
    console.warn(
      "[veilnetx] table init skipped — using in-memory waitlist:",
      err instanceof Error ? err.message : err,
    );
  }
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function getWaitlistCount(): Promise<number> {
  await ensureTables();
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query("SELECT COUNT(*)::int AS c FROM veilnetx_waitlist");
      return r.rows[0]?.c ?? 0;
    } catch {
      return memoryWaitlist.size;
    }
  }
  return memoryWaitlist.size;
}

async function addToWaitlist(email: string): Promise<{ created: boolean; id: string }> {
  await ensureTables();
  const id = randomUUID();
  const emailHash = hashEmail(email);
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `INSERT INTO veilnetx_waitlist (id, email_hash, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (email_hash) DO NOTHING
         RETURNING id`,
        [id, emailHash, email],
      );
      return { created: r.rowCount > 0, id: r.rows[0]?.id ?? id };
    } catch {
      // fall through to memory
    }
  }
  if (memoryWaitlist.has(emailHash)) {
    return { created: false, id: memoryWaitlist.get(emailHash)!.id };
  }
  memoryWaitlist.set(emailHash, { id, email, createdAt: new Date().toISOString() });
  return { created: true, id };
}

// ── Endpoints ───────────────────────────────────────────────────────────────

const waitlistLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "veilnetx:waitlist",
  message: "rate_limit_exceeded: max 5 signups per minute per IP",
});

veilnetxRouter.get("/health", async (_req, res) => {
  await ensureTables();
  const count = await getWaitlistCount();
  res.json({ ok: true, module: "veilnetx", phase: PHASE, eta: ETA, version: VERSION, waitlistCount: count });
});

veilnetxRouter.get("/status", async (_req, res) => {
  await ensureTables();
  const count = await getWaitlistCount();
  res.json({
    module: "veilnetx",
    status: "mvp",
    phase: PHASE,
    eta: ETA,
    version: VERSION,
    waitlistCount: count,
    principles: [
      "Tor-routed by default",
      "No access logs",
      "No KYC, no email signup required",
      "Anti-fingerprint client",
      "Open-source clients (CLI / desktop / mobile)",
      "Wireguard fast-path for non-paranoid mode",
    ],
    threatModel: {
      protectsFrom: [
        "Global passive observer (ISP / state-level sniffer)",
        "Content censorship (DPI, SNI blocks)",
        "Browser fingerprinting",
        "DNS / WebRTC leaks",
      ],
      doesNotProtectFrom: [
        "Malware / keyloggers on user device",
        "Cross-site deanonymization (e.g. logging into Google)",
        "Targeted attacks on Tor itself (nation-state)",
        "Social engineering",
      ],
    },
    nextMilestones: [
      { id: "spec", label: "Public protocol spec", status: "planned" },
      { id: "client-cli", label: "Reference CLI client", status: "planned" },
      { id: "exit-pilot", label: "First exit-node pilot", status: "planned" },
    ],
  });
});

veilnetxRouter.post("/waitlist", waitlistLimiter, async (req: Request, res: Response) => {
  const email = (req.body || {}).email;
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "invalid-email" });
  }
  try {
    const { created, id } = await addToWaitlist(email);
    const count = await getWaitlistCount();
    res.status(created ? 201 : 200).json({ ok: true, id, alreadyJoined: !created, waitlistCount: count });
  } catch (err) {
    captureVeilNetXError(err, { route: "veilnetx/POST/waitlist" });
    res.status(500).json({ error: "waitlist-failed" });
  }
});

// ── Privacy inspect — live tool, no DB, no deps ──────────────────────────────
//
// Reports exactly what the request reveals about the caller to any server it
// talks to. This is the honest, shippable-today core of VeilNetX: the Tor proxy
// is still Q4 2026, but "see what you're leaking" works right now.

function headerStr(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function parseUserAgent(ua: string | undefined): {
  raw: string | null;
  browser: string;
  os: string;
  mobile: boolean;
} {
  if (!ua) return { raw: null, browser: "unknown", os: "unknown", mobile: false };
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "unknown";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/(iPhone|iPad|iPod)/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { raw: ua, browser, os, mobile };
}

veilnetxRouter.get("/inspect", (req: Request, res: Response) => {
  // IP chain: X-Forwarded-For is leftmost-original-client first.
  const xff = headerStr(req.headers["x-forwarded-for"]);
  const rawChain = xff
    ? xff.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  // Railway/CF terminate TLS and append their own hop(s) to X-Forwarded-For.
  // Those trailing entries are our own edge infrastructure, not a privacy proxy
  // the visitor chose — strip them before judging exposure, otherwise every
  // direct visitor is wrongly told "you're behind a proxy". Defaults to 1 hop on
  // Railway (RAILWAY_ENVIRONMENT set), 0 elsewhere; override via env for other edges.
  const trustedEdgeHops = Number(
    process.env.VEILNETX_TRUSTED_EDGE_HOPS ??
      (process.env.RAILWAY_ENVIRONMENT ? "1" : "0"),
  );
  const ipChain =
    trustedEdgeHops > 0 && rawChain.length > trustedEdgeHops
      ? rawChain.slice(0, rawChain.length - trustedEdgeHops)
      : rawChain;
  const directIp =
    (req.socket && req.socket.remoteAddress) || req.ip || null;
  const clientIp = ipChain[0] || directIp || null;

  const via = headerStr(req.headers["via"]);
  const forwarded = headerStr(req.headers["forwarded"]);
  // A proxy is "in front" only if the client-visible chain (after stripping our
  // own edge hops) still has more than one hop, or a Via/Forwarded header is set.
  const proxyDetected = Boolean(via || forwarded || ipChain.length > 1);

  const ua = parseUserAgent(headerStr(req.headers["user-agent"]));
  const acceptLanguage = headerStr(req.headers["accept-language"]) ?? null;
  const primaryLanguage = acceptLanguage
    ? acceptLanguage.split(",")[0]?.split(";")[0]?.trim() ?? null
    : null;
  const dnt = headerStr(req.headers["dnt"]) === "1";

  // Geo hints leaked by the edge proxy (Cloudflare / Railway / generic).
  const geo = {
    country:
      headerStr(req.headers["cf-ipcountry"]) ??
      headerStr(req.headers["x-vercel-ip-country"]) ??
      null,
    city:
      headerStr(req.headers["cf-ipcity"]) ??
      headerStr(req.headers["x-vercel-ip-city"]) ??
      null,
    region:
      headerStr(req.headers["cf-region"]) ??
      headerStr(req.headers["x-vercel-ip-country-region"]) ??
      null,
  };
  const geoLeaked = Boolean(geo.country || geo.city || geo.region);

  // ── Exposure scoring: 0 = invisible, 100 = fully exposed ──────────────────
  const findings: { id: string; label: string; severity: "low" | "med" | "high"; exposed: boolean }[] = [
    {
      id: "real-ip",
      label: proxyDetected
        ? "Запрос идёт через прокси — реальный IP скрыт от конечного сервера"
        : "Реальный IP виден серверу напрямую (нет прокси/Tor)",
      severity: "high",
      exposed: !proxyDetected,
    },
    {
      id: "geo",
      label: geoLeaked
        ? `Гео определяется по IP: ${[geo.country, geo.city].filter(Boolean).join(", ") || "да"}`
        : "Гео по IP не раскрыто на этом хопе",
      severity: "high",
      exposed: geoLeaked,
    },
    {
      id: "user-agent",
      label: ua.raw
        ? `User-Agent раскрывает браузер/ОС: ${ua.browser} / ${ua.os}`
        : "User-Agent не передан",
      severity: "med",
      exposed: Boolean(ua.raw),
    },
    {
      id: "language",
      label: primaryLanguage
        ? `Accept-Language раскрывает локаль: ${primaryLanguage}`
        : "Accept-Language не передан",
      severity: "low",
      exposed: Boolean(primaryLanguage),
    },
    {
      id: "dnt",
      label: dnt
        ? "Do-Not-Track включён"
        : "Do-Not-Track не установлен (большинство сайтов его игнорируют, но это маркер)",
      severity: "low",
      exposed: !dnt,
    },
  ];

  const weight = { low: 8, med: 18, high: 30 } as const;
  const exposureScore = Math.min(
    100,
    findings.reduce((sum, f) => (f.exposed ? sum + weight[f.severity] : sum), 0),
  );
  const level = exposureScore >= 60 ? "red" : exposureScore >= 30 ? "yellow" : "green";

  res.json({
    module: "veilnetx",
    tool: "inspect",
    ip: clientIp,
    ipChain,
    proxyDetected,
    userAgent: ua,
    acceptLanguage,
    primaryLanguage,
    doNotTrack: dnt,
    geo,
    geoLeaked,
    via: via ?? null,
    serverTime: new Date().toISOString(),
    exposure: { score: exposureScore, level, findings },
    note: "Это видит ЛЮБОЙ сервер, к которому ты обращаешься напрямую. VeilNetX (Q4 2026) скроет IP+гео через Tor.",
  });
});

// ── MVP concept board surface ───────────────────────────────────────────────

mountConceptBoard({
  router: veilnetxRouter,
  moduleId: "veilnetx",
  defaultTag: "veilnetx",
  fieldMap: { idea: "useCase", rationale: "threatModel" },
  writeLimit: waitlistLimiter,
});

veilnetxRouter.options("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

veilnetxRouter.get("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const base = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/$/, "");
  res.json({
    openapi: "3.1.0",
    info: {
      title: "AEVION VeilNetX",
      version: "0.1.0",
      description:
        "Pre-launch privacy proxy network. Currently exposes status + waitlist endpoints. Production proxy targeted Q4 2026.",
      contact: { name: "AEVION", url: "https://aevion.app", email: "support@aevion.app" },
    },
    servers: [{ url: `${base}/api/veilnetx`, description: "Production" }],
    paths: {
      "/health": { get: { summary: "Service health" } },
      "/status": { get: { summary: "Public status, ETA, principles, threat model, milestones" } },
      "/inspect": {
        get: {
          summary: "Live privacy check — what the request reveals about the caller (IP, geo, UA, exposure score)",
          responses: { "200": { description: "Server-visible exposure report" } },
        },
      },
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
            "201": { description: "added to waitlist" },
            "400": { description: "invalid email" },
            "429": { description: "rate limited" },
          },
        },
      },
    },
  });
});
