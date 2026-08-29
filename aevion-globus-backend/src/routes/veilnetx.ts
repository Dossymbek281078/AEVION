/**
 * VeilNetX — privacy exposure scanner (live) + proxy-network waitlist.
 *
 * Live tools (shippable today, no login):
 *   GET  /inspect      — what your request reveals to any server: IP chain,
 *                        proxy detection, geo leak, UA, Client-Hints, referer,
 *                        cookie → categorized exposure score + letter grade.
 *   POST /fingerprint  — browser fingerprint entropy analysis: per-attribute
 *                        identifying bits, uniqueness estimate, WebRTC local-IP
 *                        leak check → fingerprint-surface score + grade.
 *
 * Roadmap: the actual Tor-routed proxy network is Q4 2026 (waitlist below).
 * Persists the waitlist to Postgres if available; falls back to in-memory.
 * The scanner endpoints are deterministic and DB-free.
 */

import { Router, type Request, type Response } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import { randomUUID, createHash } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { scoreExposure, gradeFor } from "../lib/veilnetxExposure";
import { mountConceptBoard } from "../lib/conceptBoardStore";

const captureVeilNetXError = makeServiceCapture("veilnetx");

export const veilnetxRouter = Router();

// The privacy SCANNER (inspect + fingerprint) is live today; the Tor-routed
// proxy network remains a roadmap milestone (Q4 2026). Phase reflects the
// shipped tools, not the future proxy.
const PHASE = "live-tool";
const ETA = "Q4 2026";
const VERSION = "0.2.0";

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
    status: "live",
    phase: PHASE,
    eta: ETA,
    version: VERSION,
    waitlistCount: count,
    liveTools: [
      { id: "inspect", label: "Server-visible exposure scan (IP/geo/UA/Client-Hints)", path: "/api/veilnetx/inspect" },
      { id: "fingerprint", label: "Browser fingerprint entropy analysis", path: "/api/veilnetx/fingerprint" },
    ],
    roadmap: { proxy: { label: "Tor-routed proxy network", eta: ETA, status: "planned" } },
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

  // ── Client Hints — modern fingerprinting surface most users don't know about.
  // Chromium sends Sec-CH-UA-* headers that pin the exact browser major version,
  // platform, mobile flag and (with high-entropy hints) CPU architecture/model.
  const clientHints = {
    ua: headerStr(req.headers["sec-ch-ua"]) ?? null,
    platform: headerStr(req.headers["sec-ch-ua-platform"]) ?? null,
    mobile: headerStr(req.headers["sec-ch-ua-mobile"]) ?? null,
    arch: headerStr(req.headers["sec-ch-ua-arch"]) ?? null,
    model: headerStr(req.headers["sec-ch-ua-model"]) ?? null,
    fullVersion: headerStr(req.headers["sec-ch-ua-full-version-list"]) ?? null,
  };
  const clientHintsLeaked = Object.values(clientHints).some(Boolean);
  // Referer / cookie presence — cross-site linkage signals.
  const referer = headerStr(req.headers["referer"]) ?? null;
  const cookiePresent = Boolean(headerStr(req.headers["cookie"]));

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

  // ── Exposure scoring ──────────────────────────────────────────────────────
  // Логика вынесена в lib/veilnetxExposure, чтобы шкалу можно было проверить
  // тестом: пока она жила здесь, её единственным способом измерения был живой
  // HTTP-запрос — и месяцами не замечали, что лучшая оценка недостижима (#785).
  const exposure = scoreExposure({
    proxyDetected,
    geoLeaked,
    geoLabel: [geo.country, geo.city].filter(Boolean).join(", "),
    uaRaw: ua.raw ?? null,
    uaBrowser: ua.browser,
    uaOs: ua.os,
    clientHintsLeaked,
    clientHintsLabel: [clientHints.platform, clientHints.arch, clientHints.model].filter(Boolean).join(" · "),
    primaryLanguage,
    refererPresent: Boolean(referer),
    cookiePresent,
    dnt,
  });
  const { findings, exposureScore, level, grade, byCategory } = exposure;

  res.json({
    module: "veilnetx",
    tool: "inspect",
    ip: clientIp,
    ipChain,
    proxyDetected,
    userAgent: ua,
    clientHints,
    acceptLanguage,
    primaryLanguage,
    doNotTrack: dnt,
    referer: referer ? "(present)" : null,
    cookiePresent,
    geo,
    geoLeaked,
    via: via ?? null,
    serverTime: new Date().toISOString(),
    exposure: { score: exposureScore, level, grade, byCategory, findings },
    note: "Это видит ЛЮБОЙ сервер, к которому ты обращаешься напрямую. Запусти полный скан на /veilnetx — он добавит анализ браузерного отпечатка.",
  });
});

// ── Browser fingerprint entropy analysis — POST /fingerprint ─────────────────
//
// The client collects its own fingerprint (canvas hash, WebGL renderer, screen,
// timezone, fonts, WebRTC local IPs, …) and posts it here. We estimate how many
// bits of identifying entropy each attribute carries — i.e. how much it narrows
// down *which* device you are — and roll it up into a "fingerprint surface"
// score. Bit priors are order-of-magnitude estimates from public fingerprinting
// research (Panopticlick / AmIUnique); this is an educational estimate, not a
// measurement against a live population. Deterministic, no DB, no deps.

// ~33 bits ≈ globally unique (2^33 > world population). Attribute → entropy bits.
const FP_BITS: Record<string, number> = {
  canvas: 10,
  webgl: 8,
  fonts: 7,
  userAgent: 6,
  screen: 5,
  timezone: 3.5,
  language: 3,
  platform: 2,
  cores: 2,
  memory: 1.5,
  touch: 1,
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const fingerprintLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "veilnetx:fingerprint",
  message: "rate_limit_exceeded: max 20 fingerprint scans per minute per IP",
});

veilnetxRouter.post("/fingerprint", fingerprintLimiter, (req: Request, res: Response) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const screen = (b.screen && typeof b.screen === "object" ? b.screen : {}) as Record<string, unknown>;
  const webrtcLocalIps = Array.isArray(b.webrtcLocalIps)
    ? (b.webrtcLocalIps as unknown[]).map(String).filter(Boolean).slice(0, 8)
    : [];
  const fontsCount = num(b.fonts);

  type Attr = { id: string; label: string; bits: number; present: boolean; advice: string };
  const attrs: Attr[] = [
    {
      id: "canvas",
      label: b.canvasHash ? "Canvas-отпечаток уникален (2D-рендеринг шрифтов/сглаживания)" : "Canvas-отпечаток не собран",
      bits: b.canvasHash ? FP_BITS.canvas : 0,
      present: Boolean(b.canvasHash),
      advice: "Tor Browser рандомизирует/блокирует canvas. Расширения вроде CanvasBlocker добавляют шум.",
    },
    {
      id: "webgl",
      label: b.webglRenderer ? `WebGL раскрывает GPU: ${String(b.webglRenderer).slice(0, 60)}` : "WebGL-рендерер не раскрыт",
      bits: b.webglRenderer ? FP_BITS.webgl : 0,
      present: Boolean(b.webglRenderer),
      advice: "Точная модель GPU сильно сужает круг. Отключи WebGL или используй Tor Browser (safest mode).",
    },
    {
      id: "fonts",
      label: fontsCount && fontsCount > 0 ? `Обнаружено шрифтов: ${fontsCount} — набор часто уникален` : "Список шрифтов не собран",
      bits: fontsCount && fontsCount > 0 ? Math.min(FP_BITS.fonts, 2 + Math.log2(Math.max(1, fontsCount))) : 0,
      present: Boolean(fontsCount && fontsCount > 0),
      advice: "Установленные шрифты выдают ОС и софт. Tor Browser ограничивает перечисление шрифтов.",
    },
    {
      id: "userAgent",
      label: b.userAgent ? "User-Agent передан (браузер/ОС/версия)" : "User-Agent не собран",
      bits: b.userAgent ? FP_BITS.userAgent : 0,
      present: Boolean(b.userAgent),
      advice: "Унифицируй UA (Tor Browser) — так ты выглядишь как миллионы других.",
    },
    {
      id: "screen",
      label: screen.width && screen.height
        ? `Экран ${screen.width}×${screen.height}, depth ${screen.colorDepth ?? "?"}, ratio ${screen.pixelRatio ?? "?"}`
        : "Параметры экрана не собраны",
      bits: screen.width && screen.height ? FP_BITS.screen : 0,
      present: Boolean(screen.width && screen.height),
      advice: "Нестандартное разрешение/масштаб выделяет. Tor Browser округляет размер окна до типовых значений (letterboxing).",
    },
    {
      id: "timezone",
      label: b.timezone ? `Часовой пояс: ${String(b.timezone).slice(0, 40)}` : "Часовой пояс не собран",
      bits: b.timezone ? FP_BITS.timezone : 0,
      present: Boolean(b.timezone),
      advice: "Часовой пояс выдаёт регион независимо от IP. Tor Browser ставит UTC.",
    },
    {
      id: "language",
      label: b.language ? `Язык: ${String(b.language).slice(0, 20)}` : "Язык не собран",
      bits: b.language ? FP_BITS.language : 0,
      present: Boolean(b.language),
      advice: "Локаль сужает круг. Держи en-US как большинство.",
    },
    {
      id: "platform",
      label: b.platform ? `Платформа: ${String(b.platform).slice(0, 20)}` : "Платформа не собрана",
      bits: b.platform ? FP_BITS.platform : 0,
      present: Boolean(b.platform),
      advice: "navigator.platform дублирует ОС из UA — унифицируется в Tor Browser.",
    },
    {
      id: "cores",
      label: num(b.hardwareConcurrency) ? `Ядер CPU: ${num(b.hardwareConcurrency)}` : "hardwareConcurrency не собран",
      bits: num(b.hardwareConcurrency) ? FP_BITS.cores : 0,
      present: Boolean(num(b.hardwareConcurrency)),
      advice: "Число ядер — слабый, но складывающийся сигнал. Tor Browser отдаёт фиксированное значение.",
    },
    {
      id: "memory",
      label: num(b.deviceMemory) ? `Память устройства: ${num(b.deviceMemory)} ГБ` : "deviceMemory не собран",
      bits: num(b.deviceMemory) ? FP_BITS.memory : 0,
      present: Boolean(num(b.deviceMemory)),
      advice: "navigator.deviceMemory — грубый бакет (0.25–8 ГБ), но добавляет биты.",
    },
    {
      id: "touch",
      label: num(b.touchPoints) !== null ? `maxTouchPoints: ${num(b.touchPoints)}` : "touch-возможности не собраны",
      bits: num(b.touchPoints) !== null ? FP_BITS.touch : 0,
      present: num(b.touchPoints) !== null,
      advice: "Наличие тач-экрана разделяет десктоп/мобайл/гибрид.",
    },
  ];

  const totalBits = Math.round(attrs.reduce((s, a) => s + a.bits, 0) * 10) / 10;
  // Surface score: 33 bits ≈ globally unique → 100. Linear cap.
  const surfaceScore = Math.min(100, Math.round((totalBits / 33) * 100));
  const grade = gradeFor(surfaceScore);
  // Uniqueness "1 in N" — cap the exponent so the number stays sane to display.
  const oneInN = Math.round(Math.pow(2, Math.min(totalBits, 40)));

  // WebRTC local-IP leak is a distinct, high-severity deanonymization vector —
  // it can reveal your real LAN/host IP even behind a VPN.
  const webrtcLeak = webrtcLocalIps.length > 0;

  const verdict =
    surfaceScore >= 60
      ? "Твой браузер легко узнаваем — набор атрибутов близок к уникальному."
      : surfaceScore >= 30
        ? "Средняя узнаваемость — несколько атрибутов заметно сужают круг."
        : "Низкая узнаваемость — ты неплохо сливаешься с толпой.";

  res.json({
    module: "veilnetx",
    tool: "fingerprint",
    totalBits,
    surface: { score: surfaceScore, grade, level: surfaceScore >= 60 ? "red" : surfaceScore >= 30 ? "yellow" : "green" },
    uniquenessOneIn: oneInN,
    verdict,
    webrtc: {
      leak: webrtcLeak,
      localIps: webrtcLocalIps,
      severity: webrtcLeak ? "high" : "none",
      advice: webrtcLeak
        ? "WebRTC раскрывает локальный IP даже через VPN. Отключи WebRTC в браузере или расширением (uBlock Origin → Prevent WebRTC leak)."
        : "WebRTC-утечки локального IP не обнаружено.",
    },
    attributes: attrs,
    note: "Оценка энтропии — образовательная (приоры из публичных исследований fingerprinting), не замер по живой популяции.",
    serverTime: new Date().toISOString(),
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
      version: "0.2.0",
      description:
        "Privacy exposure scanner (live): /inspect (server-visible exposure) + /fingerprint (browser fingerprint entropy). Tor-routed proxy network on roadmap (Q4 2026, waitlist).",
      contact: { name: "AEVION", url: "https://aevion.app", email: "support@aevion.app" },
    },
    servers: [{ url: `${base}/api/veilnetx`, description: "Production" }],
    paths: {
      "/health": { get: { summary: "Service health" } },
      "/status": { get: { summary: "Public status, ETA, principles, threat model, milestones" } },
      "/inspect": {
        get: {
          summary: "Live privacy check — what the request reveals (IP, geo, UA, Client-Hints, referer, cookie) + categorized exposure score & grade",
          responses: { "200": { description: "Server-visible exposure report" } },
        },
      },
      "/fingerprint": {
        post: {
          summary: "Browser fingerprint entropy analysis — client posts collected attributes, gets per-attribute bits, uniqueness estimate, WebRTC-leak check, surface score & grade",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userAgent: { type: "string" },
                    platform: { type: "string" },
                    timezone: { type: "string" },
                    language: { type: "string" },
                    screen: { type: "object" },
                    hardwareConcurrency: { type: "number" },
                    deviceMemory: { type: "number" },
                    touchPoints: { type: "number" },
                    canvasHash: { type: "string" },
                    webglRenderer: { type: "string" },
                    fonts: { type: "number" },
                    webrtcLocalIps: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Fingerprint entropy report" } },
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
