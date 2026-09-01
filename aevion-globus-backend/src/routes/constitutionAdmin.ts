/**
 * Constitution — admin metrics + abuse shield.
 *
 *   GET  /api/admin/constitution/metrics   (admin only)
 *   POST /api/admin/constitution/ban       { ip, hours? }  (admin only)
 *   POST /api/admin/constitution/unban     { ip }          (admin only)
 *
 * Telemetry: a tiny in-process rolling 24h tracker (every request through
 * `constitutionTelemetry` middleware updates counters). On metrics GET we
 * compute top endpoints + top IPs + suspicious-IP flag.
 *
 * Abuse shield: soft-ban list (Set<ip>) with TTL. The exported
 * `isBanned(req)` is plugged in by /api/constitution/* and
 * /api/planet/constitution-artifacts routes via an early middleware.
 *
 * Admin auth: JWT payload.role === "admin" OR payload.email in
 * CONSTITUTION_ADMIN_ALLOWLIST. Same convention as the Pro tier.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { checkAdmin, type AdminVerdict } from "../lib/adminAuth";
import { clientIp as sharedClientIp } from "../lib/rateLimit";

const SUSPICIOUS_SCENARIOS_PER_DAY = Number(process.env.SUSPICIOUS_SCENARIOS || "50");
const SUSPICIOUS_VOTES_PER_DAY = Number(process.env.SUSPICIOUS_VOTES || "100");

// Реализация вынесена в lib/adminAuth: копий было две, с разными типами
// возврата. Форма сохранена богатая — здесь используются reason и email.
function isAdmin(req: Request): AdminVerdict {
  return checkAdmin(req);
}

/* ─── In-process rolling 24h telemetry ─────────────────────────────── */

type EndpointStats = {
  path: string;
  method: string;
  count: number;
  errors: number;
  lastSeen: number;
};
type IpStats = {
  ip: string;
  count: number;
  scenarios: number;
  votes: number;
  comments: number;
  lastSeen: number;
};

const endpointMap = new Map<string, EndpointStats>();
const ipMap = new Map<string, IpStats>();
const BUCKET_MS = 24 * 60 * 60 * 1000;

function bucketKey(method: string, path: string): string {
  // Normalize :id-style paths so /artifacts/a-uuid and /artifacts/b-uuid collapse.
  const norm = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi, "/:id$1")
    .replace(/\?.*$/, "");
  return `${method} ${norm}`;
}

function clientIp(req: Request): string {
  // Читать X-Forwarded-For напрямую нельзя: прокси дописывает себя СПРАВА,
  // поэтому левый элемент пишет сам клиент и его никто не проверяет. Здесь
  // значение идёт в isBanned() — то есть подделка одного заголовка снимала
  // бан. `req.ip` читает тот же заголовок, но только по узлам, которые
  // приложение объявило доверенными (app.set("trust proxy", 1) в index.ts),
  // и helper дополнительно нормализует адрес, закрывая обход по IPv6.
  return sharedClientIp(req);
}

function rotate(): void {
  const cutoff = Date.now() - BUCKET_MS;
  for (const [k, v] of endpointMap) {
    if (v.lastSeen < cutoff) endpointMap.delete(k);
  }
  for (const [k, v] of ipMap) {
    if (v.lastSeen < cutoff) ipMap.delete(k);
  }
}

/** Middleware — track every constitution-namespaced request. */
export function constitutionTelemetry(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const t0 = Date.now();
  const ip = clientIp(req);
  const path = req.path || req.url;
  const key = bucketKey(req.method, path);

  res.on("finish", () => {
    const now = Date.now();
    if (Math.random() < 0.01) rotate();
    const ep = endpointMap.get(key) ?? {
      path: key.split(" ")[1] ?? path,
      method: req.method,
      count: 0,
      errors: 0,
      lastSeen: 0,
    };
    ep.count += 1;
    if (res.statusCode >= 400) ep.errors += 1;
    ep.lastSeen = now;
    endpointMap.set(key, ep);

    const ipStat = ipMap.get(ip) ?? {
      ip,
      count: 0,
      scenarios: 0,
      votes: 0,
      comments: 0,
      lastSeen: 0,
    };
    ipStat.count += 1;
    if (req.method === "POST" && path.includes("/scenarios")) ipStat.scenarios += 1;
    if (req.method === "POST" && path.endsWith("/vote")) ipStat.votes += 1;
    if (req.method === "POST" && path.endsWith("/comment")) ipStat.comments += 1;
    ipStat.lastSeen = now;
    ipMap.set(ip, ipStat);
  });
  void t0; // hold for future latency tracking
  next();
}

/* ─── Soft-ban list ──────────────────────────────────────────────── */

type Ban = { ip: string; until: number; reason: string };
const bans = new Map<string, Ban>();

export function isBanned(ip: string): Ban | null {
  const b = bans.get(ip);
  if (!b) return null;
  if (b.until < Date.now()) {
    bans.delete(ip);
    return null;
  }
  return b;
}

/** Express middleware — reject requests from banned IPs with 429. */
export function constitutionBanGate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const b = isBanned(clientIp(req));
  if (b) {
    res.status(429).json({
      error: "ip_banned",
      until: new Date(b.until).toISOString(),
      reason: b.reason,
    });
    return;
  }
  next();
}

/* ─── Router ─────────────────────────────────────────────────────── */

export const constitutionAdminRouter = Router();

function adminGuard(req: Request, res: Response, next: NextFunction): void {
  const a = isAdmin(req);
  if (!a.ok) {
    res.status(403).json({ error: "admin_required", reason: a.reason });
    return;
  }
  next();
}

constitutionAdminRouter.get("/metrics", adminGuard, (_req: Request, res: Response) => {
  rotate();
  const totalRequests = Array.from(endpointMap.values()).reduce((s, v) => s + v.count, 0);
  const totalErrors = Array.from(endpointMap.values()).reduce((s, v) => s + v.errors, 0);

  const topEndpoints = Array.from(endpointMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topIps = Array.from(ipMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const suspicious = Array.from(ipMap.values())
    .filter((v) => v.scenarios >= SUSPICIOUS_SCENARIOS_PER_DAY || v.votes >= SUSPICIOUS_VOTES_PER_DAY)
    .map((v) => ({
      ...v,
      reasons: [
        v.scenarios >= SUSPICIOUS_SCENARIOS_PER_DAY ? `scenarios ${v.scenarios}/day` : null,
        v.votes >= SUSPICIOUS_VOTES_PER_DAY ? `votes ${v.votes}/day` : null,
      ].filter(Boolean),
    }));

  res.json({
    bucketHours: 24,
    totalRequests,
    totalErrors,
    errorRatePct: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 1000) / 10 : 0,
    topEndpoints,
    topIps,
    suspicious,
    bans: Array.from(bans.values()).map((b) => ({
      ip: b.ip,
      until: new Date(b.until).toISOString(),
      reason: b.reason,
    })),
    thresholds: {
      scenariosPerDay: SUSPICIOUS_SCENARIOS_PER_DAY,
      votesPerDay: SUSPICIOUS_VOTES_PER_DAY,
    },
  });
});

constitutionAdminRouter.post("/ban", adminGuard, (req: Request, res: Response) => {
  const body = (req.body && typeof req.body === "object")
    ? (req.body as Record<string, unknown>)
    : {};
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  const hours = Math.max(1, Math.min(24 * 30, Number(body.hours ?? 24)));
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "admin-soft-ban";
  if (!ip) return res.status(400).json({ error: "missing_ip" });
  const until = Date.now() + hours * 60 * 60 * 1000;
  bans.set(ip, { ip, until, reason });
  res.json({ ok: true, until: new Date(until).toISOString(), hours });
});

constitutionAdminRouter.post("/unban", adminGuard, (req: Request, res: Response) => {
  const body = (req.body && typeof req.body === "object")
    ? (req.body as Record<string, unknown>)
    : {};
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  if (!ip) return res.status(400).json({ error: "missing_ip" });
  const had = bans.delete(ip);
  res.json({ ok: true, removed: had });
});
