/**
 * VeilNetX — pre-launch status + waitlist for the privacy proxy network.
 *
 * The actual Tor-routed proxy is on the long-term roadmap (Q4 2026). For now
 * this surface gives partners a live status endpoint and a waitlist they can
 * subscribe to. Persists to Postgres if available; falls back to in-memory.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID, createHash } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { mountConceptBoard } from "../lib/conceptBoardStore";

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
    res.status(500).json({ error: "waitlist-failed" });
  }
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
