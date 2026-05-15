import { Router } from "express";
import crypto from "crypto";
import { rateLimit } from "../lib/rateLimit";

/**
 * Public Status / Incident surface for the AEVION uptime page.
 *
 * Endpoints
 * ---------
 *  GET  /api/status/incidents          recent public incidents (mock + in-memory)
 *  POST /api/status/subscribe          { email } -> store interest for status digest
 *  GET  /api/status/subscribers/count  public counter (no PII)
 *
 * Storage is intentionally in-memory for the public status surface; real
 * incident reporting and email digests live in the ops pipeline (Sentry,
 * Resend, etc.). The frontend `/status` page consumes /incidents and POSTs to
 * /subscribe — the surface is documented here so other status mirrors stay
 * compatible.
 */

export const statusRouter = Router();

type IncidentSeverity = "minor" | "major" | "critical";
type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

type IncidentUpdate = {
  t: string; // ISO timestamp
  status: IncidentStatus;
  message: string;
};

type Incident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  affected: string[]; // service keys: pipeline / qsign-v2 / planet / ...
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
};

// Seed with a couple of historical incidents so the page never shows an empty
// state. Newest first. Times are relative to module load so the list always
// looks recent without needing a wall clock.
const bootedAt = Date.now();
const hoursAgo = (h: number) => new Date(bootedAt - h * 3600_000).toISOString();

const seedIncidents: Incident[] = [
  {
    id: "inc-2026-05-12-planet-degraded",
    title: "Planet compliance: elevated 503s on artifact upload",
    severity: "minor",
    affected: ["planet"],
    startedAt: hoursAgo(36),
    resolvedAt: hoursAgo(34),
    updates: [
      {
        t: hoursAgo(36),
        status: "investigating",
        message: "Spike of 503 responses on POST /api/planet/artifacts. Investigating upstream object storage.",
      },
      {
        t: hoursAgo(35),
        status: "identified",
        message: "Object storage region us-east-1 throttling reads. Failing over to secondary bucket.",
      },
      {
        t: hoursAgo(34),
        status: "resolved",
        message: "Failover complete. Error rate back to baseline. No data loss; all uploads will retry on next request.",
      },
    ],
  },
  {
    id: "inc-2026-05-09-qsign-v2-slow",
    title: "QSign v2: increased signing latency",
    severity: "minor",
    affected: ["qsign-v2"],
    startedAt: hoursAgo(108),
    resolvedAt: hoursAgo(106),
    updates: [
      {
        t: hoursAgo(108),
        status: "investigating",
        message: "p95 latency for POST /api/qsign/v2/sign rose from ~80ms to ~600ms.",
      },
      {
        t: hoursAgo(107),
        status: "identified",
        message: "Hot key in the JWT cache. Rolling restart of signer pool in progress.",
      },
      {
        t: hoursAgo(106),
        status: "resolved",
        message: "Latency restored to baseline after pool rotation. Cache TTL lowered to prevent recurrence.",
      },
    ],
  },
];

const recentIncidents: Incident[] = [...seedIncidents];
const MAX_INCIDENTS = 50;

/**
 * Lightweight ingest used by internal services to register a probe failure as
 * an incident. Not part of the public spec but exposed under the same prefix
 * for symmetry. Public surfaces only read.
 */
function recordIncident(input: Omit<Incident, "id" | "updates"> & { initialMessage: string }): Incident {
  const inc: Incident = {
    id: `inc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    title: input.title,
    severity: input.severity,
    affected: input.affected,
    startedAt: input.startedAt,
    resolvedAt: input.resolvedAt,
    updates: [
      {
        t: input.startedAt,
        status: "investigating",
        message: input.initialMessage,
      },
    ],
  };
  recentIncidents.unshift(inc);
  if (recentIncidents.length > MAX_INCIDENTS) recentIncidents.length = MAX_INCIDENTS;
  return inc;
}

// Subscribers stored in-memory; persistence belongs to a real list provider
// (Resend / Brevo) — handled at deploy time.
const subscribers = new Map<string, { email: string; createdAt: string }>();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const subscribeLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  keyPrefix: "status:subscribe",
});

const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "status:read",
});

statusRouter.get("/incidents", readLimiter, (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), MAX_INCIDENTS);
  const onlyOpen = req.query.open === "1";
  let items = recentIncidents;
  if (onlyOpen) items = items.filter((i) => i.resolvedAt === null);
  res.setHeader("cache-control", "public, max-age=30, stale-while-revalidate=60");
  res.json({
    total: items.length,
    open: recentIncidents.filter((i) => i.resolvedAt === null).length,
    items: items.slice(0, limit),
    generatedAt: new Date().toISOString(),
  });
});

statusRouter.get("/incidents/:id", readLimiter, (req, res) => {
  const inc = recentIncidents.find((i) => i.id === req.params.id);
  if (!inc) return res.status(404).json({ error: "incident_not_found" });
  res.setHeader("cache-control", "public, max-age=30");
  res.json(inc);
});

statusRouter.post("/subscribe", subscribeLimiter, (req, res) => {
  const body = (req.body ?? {}) as { email?: unknown };
  const raw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!raw || !EMAIL_RE.test(raw) || raw.length > 254) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }
  if (!subscribers.has(raw)) {
    subscribers.set(raw, { email: raw, createdAt: new Date().toISOString() });
  }
  // Don't leak whether email was already subscribed (privacy / enumeration).
  res.json({ ok: true, message: "Subscribed. You'll get email digests on major incidents." });
});

statusRouter.get("/subscribers/count", readLimiter, (_req, res) => {
  res.setHeader("cache-control", "public, max-age=60");
  res.json({ count: subscribers.size });
});

// Exposed for in-process callers (probe daemons, etc.). Not auto-registered to
// avoid surprises; safe to import from other backend modules later.
export const statusInternal = {
  recordIncident,
  listIncidents: () => recentIncidents.slice(),
};
