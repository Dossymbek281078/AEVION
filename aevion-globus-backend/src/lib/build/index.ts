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

  ensured = true;
}

export const buildPool = pool;

export const PROJECT_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export const VACANCY_STATUSES = ["OPEN", "CLOSED"] as const;
export const APPLICATION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export const BUILD_ROLES = ["CLIENT", "CONTRACTOR", "WORKER", "ADMIN"] as const;
