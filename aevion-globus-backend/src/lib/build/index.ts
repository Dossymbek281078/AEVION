import type { Request, Response } from "express";
import { verifyBearerOptional, type JwtPayload } from "../authJwt";
import { getPool } from "../dbPool";
import { ensureUsersTable } from "../ensureUsersTable";

// ── Response envelope ─────────────────────────────────────────────────
// QBuild surfaces wrap every success in { success: true, data } so the
// /build/* frontend has a single shape to read. Errors stay as flat
// { error, ... } so they don't collide with Express's default error path.

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

export function fail(
  res: Response,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return res.status(status).json({ success: false, error: message, ...(extra ?? {}) });
}

// ── Auth ─────────────────────────────────────────────────────────────

export function requireBuildAuth(req: Request, res: Response): JwtPayload | null {
  const auth = verifyBearerOptional(req);
  if (!auth) {
    fail(res, 401, "Bearer token required");
    return null;
  }
  return auth;
}

// ── Validators (manual, project convention — no zod / class-validator) ─

export type StringRule = { min?: number; max?: number; allowEmpty?: boolean };

export function vString(
  raw: unknown,
  field: string,
  rule: StringRule = {},
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: `${field} must be a string` };
  const trimmed = raw.trim();
  if (!rule.allowEmpty && trimmed.length === 0) return { ok: false, error: `${field} is required` };
  if (rule.min !== undefined && trimmed.length < rule.min) {
    return { ok: false, error: `${field} must be at least ${rule.min} chars` };
  }
  if (rule.max !== undefined && trimmed.length > rule.max) {
    return { ok: false, error: `${field} must be at most ${rule.max} chars` };
  }
  return { ok: true, value: trimmed };
}

export function vNumber(
  raw: unknown,
  field: string,
  rule: { min?: number; max?: number } = {},
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return { ok: false, error: `${field} must be a finite number` };
  if (rule.min !== undefined && n < rule.min) return { ok: false, error: `${field} must be >= ${rule.min}` };
  if (rule.max !== undefined && n > rule.max) return { ok: false, error: `${field} must be <= ${rule.max}` };
  return { ok: true, value: n };
}

export function vEnum<T extends string>(
  raw: unknown,
  field: string,
  allowed: readonly T[],
): { ok: true; value: T } | { ok: false; error: string } {
  if (typeof raw !== "string" || !(allowed as readonly string[]).includes(raw)) {
    return { ok: false, error: `${field} must be one of ${allowed.join(", ")}` };
  }
  return { ok: true, value: raw as T };
}

// ── DB bootstrap ─────────────────────────────────────────────────────

const pool = getPool();
let ensured = false;

export async function ensureBuildTables(): Promise<void> {
  if (ensured) return;
  await ensureUsersTable(pool); // BuildProfile.userId references AEVIONUser.id

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildProfile" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "phone" TEXT,
      "city" TEXT,
      "description" TEXT,
      "buildRole" TEXT NOT NULL DEFAULT 'CLIENT',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildProfile_role_idx" ON "BuildProfile" ("buildRole");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildProfile_city_idx" ON "BuildProfile" ("city");`);

  // Resume-style fields. Added with ADD COLUMN IF NOT EXISTS so the
  // base CREATE TABLE above stays the legacy minimal shape and existing
  // installs migrate forward without a separate migration tool.
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "title" TEXT;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "summary" TEXT;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "skillsJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "languagesJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "salaryMin" INTEGER;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "salaryMax" INTEGER;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "salaryCurrency" TEXT DEFAULT 'RUB';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "availability" TEXT;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "experienceYears" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "openToWork" BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "verifiedReason" TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildExperience" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "company" TEXT NOT NULL,
      "city" TEXT,
      "fromDate" TEXT,
      "toDate" TEXT,
      "current" BOOLEAN NOT NULL DEFAULT FALSE,
      "description" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildExperience_user_idx" ON "BuildExperience" ("userId", "sortOrder", "createdAt");`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildEducation" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "institution" TEXT NOT NULL,
      "degree" TEXT,
      "field" TEXT,
      "fromYear" INTEGER,
      "toYear" INTEGER,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildEducation_user_idx" ON "BuildEducation" ("userId", "createdAt" DESC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildProject" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "city" TEXT,
      "clientId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildProject_client_created_idx" ON "BuildProject" ("clientId", "createdAt" DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildProject_status_idx" ON "BuildProject" ("status");`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildVacancy" (
      "id" TEXT PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildVacancy_project_created_idx" ON "BuildVacancy" ("projectId", "createdAt" DESC);`);
  await pool.query(`ALTER TABLE "BuildVacancy" ADD COLUMN IF NOT EXISTS "skillsJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildVacancy" ADD COLUMN IF NOT EXISTS "city" TEXT;`);
  await pool.query(`ALTER TABLE "BuildVacancy" ADD COLUMN IF NOT EXISTS "salaryCurrency" TEXT DEFAULT 'RUB';`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildApplication" (
      "id" TEXT PRIMARY KEY,
      "vacancyId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "message" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "BuildApplication_vacancy_user_uniq" ON "BuildApplication" ("vacancyId", "userId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildApplication_user_created_idx" ON "BuildApplication" ("userId", "createdAt" DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildApplication_vacancy_status_idx" ON "BuildApplication" ("vacancyId", "status");`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildMessage" (
      "id" TEXT PRIMARY KEY,
      "senderId" TEXT NOT NULL,
      "receiverId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "readAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildMessage_thread_idx" ON "BuildMessage" ("senderId", "receiverId", "createdAt");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildMessage_inbox_idx" ON "BuildMessage" ("receiverId", "readAt");`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildFile" (
      "id" TEXT PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "name" TEXT,
      "mimeType" TEXT,
      "sizeBytes" INTEGER,
      "uploaderId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildFile_project_created_idx" ON "BuildFile" ("projectId", "createdAt" DESC);`);

  // ── Pricing ──────────────────────────────────────────────────────
  // BuildPlan: catalog of subscription tiers. Seeded with the 4 plans
  // QBuild ships with (FREE / PRO / AGENCY / PPHIRE).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildPlan" (
      "key" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "tagline" TEXT,
      "priceMonthly" INTEGER NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'RUB',
      "vacancySlots" INTEGER NOT NULL DEFAULT 0,
      "talentSearchPerMonth" INTEGER NOT NULL DEFAULT 0,
      "boostsPerMonth" INTEGER NOT NULL DEFAULT 0,
      "hireFeeBps" INTEGER NOT NULL DEFAULT 0,
      "featuresJson" TEXT NOT NULL DEFAULT '[]',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // BuildSubscription: at most one ACTIVE row per user.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildSubscription" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "planKey" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "endsAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "BuildSubscription_user_active_uniq"
    ON "BuildSubscription" ("userId") WHERE "status" = 'ACTIVE';`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildSubscription_user_idx" ON "BuildSubscription" ("userId", "createdAt" DESC);`);

  // BuildOrder: payment / state-change ledger for plans, boosts, day-passes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildOrder" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "ref" TEXT,
      "amount" INTEGER NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'RUB',
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "metaJson" TEXT NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildOrder_user_idx" ON "BuildOrder" ("userId", "createdAt" DESC);`);

  // BuildBoost: featured-pin entries for vacancies. Vacancy is
  // considered "boosted" when a row exists with endsAt > NOW().
  // We never delete — expired rows are kept for analytics.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildBoost" (
      "id" TEXT PRIMARY KEY,
      "vacancyId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "endsAt" TIMESTAMPTZ NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'PLAN',
      "orderId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildBoost_vacancy_idx" ON "BuildBoost" ("vacancyId", "endsAt" DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildBoost_user_idx" ON "BuildBoost" ("userId", "createdAt" DESC);`);

  // BuildPlanUsage: per-month counters for plan-limited actions.
  // Composite PK so increments are idempotent via ON CONFLICT.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildPlanUsage" (
      "userId" TEXT NOT NULL,
      "monthKey" TEXT NOT NULL,
      "talentSearches" INTEGER NOT NULL DEFAULT 0,
      "boostsUsed" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("userId","monthKey")
    );
  `);

  // Idempotent seed of the 4 default plans. ON CONFLICT DO NOTHING so
  // operators can edit a plan in DB without it being clobbered on boot.
  await pool.query(
    `INSERT INTO "BuildPlan"
       ("key","name","tagline","priceMonthly","currency","vacancySlots","talentSearchPerMonth","boostsPerMonth","hireFeeBps","featuresJson","sortOrder","active")
     VALUES
       ('FREE','Free Forever','For tiny teams hiring their first contractor.',0,'RUB',1,5,0,0,
         $1, 10, TRUE),
       ('PRO','Pro','For growing companies with steady hiring needs.',4990,'RUB',10,-1,5,0,
         $2, 20, TRUE),
       ('AGENCY','Agency','For staffing agencies and large operators.',14990,'RUB',-1,-1,20,0,
         $3, 30, TRUE),
       ('PPHIRE','Pay-per-Hire','Zero upfront. Pay only on a successful hire.',0,'RUB',-1,-1,0,1200,
         $4, 40, TRUE)
     ON CONFLICT ("key") DO NOTHING;`,
    [
      JSON.stringify([
        "1 active vacancy",
        "All resumes visible — no paywall",
        "5 talent searches per month",
        "Direct messages with candidates",
        "Public project page + share link",
      ]),
      JSON.stringify([
        "10 active vacancies",
        "Unlimited talent search",
        "5 boost-vacancy add-ons / month",
        "Priority placement in feed",
        "Email + chat support",
      ]),
      JSON.stringify([
        "Unlimited vacancies",
        "Unlimited talent search",
        "20 boost-vacancy / month",
        "White-label public pages",
        "API access (planned)",
        "Dedicated success manager",
      ]),
      JSON.stringify([
        "0 ₽ upfront — no monthly fee",
        "12% of monthly salary on successful hire (vs HH 15-20%)",
        "Escrow held until candidate's first day",
        "Unlimited active vacancies",
        "Full platform access",
      ]),
    ],
  );

  ensured = true;
}

export const buildPool = pool;

export const PROJECT_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export const VACANCY_STATUSES = ["OPEN", "CLOSED"] as const;
export const APPLICATION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export const BUILD_ROLES = ["CLIENT", "CONTRACTOR", "WORKER", "ADMIN"] as const;
export const PLAN_KEYS = ["FREE", "PRO", "AGENCY", "PPHIRE"] as const;

export function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Plan resolution + usage ─────────────────────────────────────────

export type PlanRow = {
  key: "FREE" | "PRO" | "AGENCY" | "PPHIRE";
  name: string;
  priceMonthly: number;
  currency: string;
  vacancySlots: number;
  talentSearchPerMonth: number;
  boostsPerMonth: number;
  hireFeeBps: number;
};

export type UsageRow = {
  userId: string;
  monthKey: string;
  talentSearches: number;
  boostsUsed: number;
};

export function currentMonthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Resolve the active plan for a user. Falls back to FREE when no
 * ACTIVE subscription exists, so every signed-in user always has a
 * plan to gate against.
 */
export async function getUserPlan(userId: string): Promise<PlanRow> {
  const sub = await pool.query(
    `SELECT "planKey" FROM "BuildSubscription"
     WHERE "userId" = $1 AND "status" = 'ACTIVE'
     ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
  const planKey = sub.rows[0]?.planKey ?? "FREE";
  const plan = await pool.query(
    `SELECT "key","name","priceMonthly","currency","vacancySlots","talentSearchPerMonth","boostsPerMonth","hireFeeBps"
     FROM "BuildPlan" WHERE "key" = $1 AND "active" = TRUE LIMIT 1`,
    [planKey],
  );
  if (plan.rowCount === 0) {
    // FREE row missing — extreme edge case (DB tampering). Synthesize
    // a safe-by-default FREE row instead of crashing.
    return {
      key: "FREE",
      name: "Free Forever",
      priceMonthly: 0,
      currency: "RUB",
      vacancySlots: 1,
      talentSearchPerMonth: 5,
      boostsPerMonth: 0,
      hireFeeBps: 0,
    };
  }
  return plan.rows[0] as PlanRow;
}

export async function ensureUsageRow(userId: string, monthKey = currentMonthKey()): Promise<UsageRow> {
  await pool.query(
    `INSERT INTO "BuildPlanUsage" ("userId","monthKey")
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [userId, monthKey],
  );
  const r = await pool.query(
    `SELECT * FROM "BuildPlanUsage" WHERE "userId" = $1 AND "monthKey" = $2 LIMIT 1`,
    [userId, monthKey],
  );
  return r.rows[0] as UsageRow;
}

export async function bumpUsage(
  userId: string,
  field: "talentSearches" | "boostsUsed",
  monthKey = currentMonthKey(),
): Promise<UsageRow> {
  await ensureUsageRow(userId, monthKey);
  const r = await pool.query(
    `UPDATE "BuildPlanUsage"
       SET "${field}" = "${field}" + 1, "updatedAt" = NOW()
     WHERE "userId" = $1 AND "monthKey" = $2
     RETURNING *`,
    [userId, monthKey],
  );
  return r.rows[0] as UsageRow;
}

/** -1 in plan column means "unlimited". */
export function isUnlimited(planLimit: number): boolean {
  return planLimit === -1;
}

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCELED", "PENDING"] as const;
export const ORDER_KINDS = ["SUB_START", "BOOST", "TALENT_DAY_PASS", "HIRE_FEE"] as const;
export const ORDER_STATUSES = ["PENDING", "PAID", "CANCELED", "REFUNDED"] as const;
