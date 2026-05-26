/**
 * Constitution Pro gate middleware.
 *
 * Call requirePro / requireProOrSigned inside route handlers to enforce
 * tier limits server-side. All gates degrade gracefully — free users get
 * a 402 with { error, plan: "free", upgradeUrl } so the frontend can show
 * the paywall rather than a generic error.
 *
 * Plan resolution: JWT payload.plan === "pro"  OR  email allowlist  OR
 * active paid subscription via getActivePlan(email) (same as /me/plan).
 */

import type { Request, Response, NextFunction } from "express";
import { verifyBearerOptional } from "./authJwt";
import { getActivePlan } from "../routes/provisioning";

const ALLOWLIST = (process.env.CONSTITUTION_PRO_ALLOWLIST || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");

export type PlanInfo = { plan: "free" | "pro"; email: string | null; reason: string };

/**
 * Single source of truth for Constitution plan resolution. Used by both the
 * server-side gates (requirePro / aiRateGate) and the /me/plan endpoint the
 * frontend reads — keep them on this one resolver so the paywall the user
 * sees can never disagree with what the server actually enforces.
 *
 * Priority: JWT plan=pro → email allowlist → active paid subscription → free.
 */
export function resolvePlan(req: Request): PlanInfo {
  const payload = verifyBearerOptional(req);
  if (!payload) return { plan: "free", email: null, reason: "no-token" };
  const p = payload as Record<string, unknown>;
  const email = typeof p.email === "string" ? p.email.toLowerCase() : null;
  if (p.plan === "pro") return { plan: "pro", email, reason: "jwt-plan" };
  if (email && ALLOWLIST.includes(email)) return { plan: "pro", email, reason: "allowlist" };
  if (email) {
    const active = getActivePlan(email);
    if (active.active && active.tierId !== "free") {
      return { plan: "pro", email, reason: `subscription:${active.tierId}` };
    }
  }
  return { plan: "free", email, reason: "default" };
}

function upgradeResponse(res: Response): void {
  res.status(402).json({
    error: "pro_required",
    plan: "free",
    upgradeUrl: `${PUBLIC_BASE}/constitution/pricing`,
    message: "Функция доступна в Constitution Pro ($9/мес). Upgrade: /constitution/pricing",
  });
}

/** Middleware: 402 if not Pro. */
export function requirePro(req: Request, res: Response, next: NextFunction): void {
  const { plan } = resolvePlan(req);
  if (plan === "pro") { next(); return; }
  upgradeResponse(res);
}

/** Returns plan info without blocking — use when you need soft behaviour. */
export function planMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as unknown as { _constitutionPlan?: PlanInfo })._constitutionPlan = resolvePlan(req);
  next();
}

export function getPlanFromReq(req: Request): PlanInfo {
  return (req as unknown as { _constitutionPlan?: PlanInfo })._constitutionPlan ?? resolvePlan(req);
}

/* ───── Per-IP daily AI counter (free tier soft limit) ──────────── */

type Counter = { count: number; resetAt: number };
const aiCounters = new Map<string, Counter>();
const AI_FREE_DAILY_LIMIT = Number(process.env.CONSTITUTION_AI_FREE_DAILY || "10");
const DAY_MS = 24 * 60 * 60 * 1000;

function clientKey(req: Request): string {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress ?? "unknown";
  return ip;
}

/** Returns true when the free user is within daily AI limit and increments. */
function checkAndIncrementAiUsage(key: string): { allowed: boolean; used: number; limit: number } {
  const now = Date.now();
  let c = aiCounters.get(key);
  if (!c || c.resetAt < now) {
    c = { count: 0, resetAt: now + DAY_MS };
    aiCounters.set(key, c);
  }
  if (c.count >= AI_FREE_DAILY_LIMIT) return { allowed: false, used: c.count, limit: AI_FREE_DAILY_LIMIT };
  c.count += 1;
  return { allowed: true, used: c.count, limit: AI_FREE_DAILY_LIMIT };
}

/** Middleware: 429 if free AND over daily AI limit. Pro → pass through. */
export function aiRateGate(req: Request, res: Response, next: NextFunction): void {
  const { plan } = resolvePlan(req);
  if (plan === "pro") { next(); return; }
  const key = clientKey(req);
  const { allowed, used, limit } = checkAndIncrementAiUsage(key);
  if (allowed) { next(); return; }
  res.status(429).json({
    error: "ai_daily_limit",
    plan: "free",
    used,
    limit,
    resetInHours: 24,
    upgradeUrl: `${PUBLIC_BASE}/constitution/pricing`,
    message: `Free tier: ${limit} AI-запросов в день. Ты использовал ${used}. Upgrade → Pro для безлимита.`,
  });
}

/* ───── Scenario save limit check (free: 5 cloud saves) ─────────── */

export const FREE_SAVE_LIMIT = Number(process.env.CONSTITUTION_FREE_SAVE_LIMIT || "5");

/** Call this after a save is counted. Returns { allowed, current, limit }. */
export function checkSaveLimit(plan: "free" | "pro", savedTotal: number): { allowed: boolean } {
  if (plan === "pro") return { allowed: true };
  return { allowed: savedTotal < FREE_SAVE_LIMIT };
}
