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
let _initPromise: Promise<void> | null = null;

export function ensureBuildTables(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = _doEnsureBuildTables();
  return _initPromise;
}

async function _doEnsureBuildTables(): Promise<void> {
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

  // ── AEVION Resume schema v2 — construction-vertical fields ──
  // Designed for blue-collar / on-site work where HH-style resumes
  // miss critical signals: which tools you own, whether your medical
  // check / safety training is current, license categories, etc.
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "certificationsJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "portfolioJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "achievementsJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "driversLicense" TEXT;`); // e.g. "B,C,E"
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "shiftPreference" TEXT;`); // DAY|NIGHT|FLEX|ANY
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "availabilityType" TEXT;`); // FULL_TIME|PART_TIME|PROJECT|SHIFT|REMOTE
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "readyFromDate" TEXT;`); // YYYY-MM-DD or freeform
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "preferredLocationsJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "toolsOwnedJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "medicalCheckValid" BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "medicalCheckUntil" TEXT;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "safetyTrainingValid" BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "safetyTrainingUntil" TEXT;`);
  // Video intro: 30-second pitch URL (YouTube / Vimeo / direct mp4) shown
  // on the public profile. Replaces HH "wall of text" cover letters with
  // a face + voice — recruiters skim 10× faster.
  await pool.query(`ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS "introVideoUrl" TEXT;`);

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
  // Quick-questions: vacancy author can pose ≤5 short questions that
  // every applicant must answer. Replaces the HH "free-form cover
  // letter" with structured signal.
  await pool.query(`ALTER TABLE "BuildVacancy" ADD COLUMN IF NOT EXISTS "questionsJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildVacancy" ADD COLUMN IF NOT EXISTS "viewCount" INT NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE "BuildVacancy" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ;`);

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
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "answersJson" TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "aiScoresJson" TEXT;`);
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "aiScoreOverall" INTEGER;`);
  // Referral tracking: if the candidate clicked through a "share"
  // link with ?ref=<userId>, we capture who drove the application.
  // Used downstream for referrer rewards / leaderboard.
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;`);
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;`);
  // BuildPartnerApiKey: read-only API key for partner sites that want to
  // syndicate the QBuild vacancy feed (e.g. an employer's own careers page).
  // Stores a sha256 hash of the key, never the plaintext. The key itself
  // (qb_pk_*) is shown to the admin once at creation time.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildPartnerApiKey" (
      "id" TEXT PRIMARY KEY,
      "label" TEXT NOT NULL,
      "keyHash" TEXT NOT NULL UNIQUE,
      "scopesJson" TEXT NOT NULL DEFAULT '["vacancies:read"]',
      "ownerUserId" TEXT,
      "lastUsedAt" TIMESTAMPTZ,
      "usageCount" INTEGER NOT NULL DEFAULT 0,
      "revokedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildPartnerApiKey_hash_idx" ON "BuildPartnerApiKey" ("keyHash") WHERE "revokedAt" IS NULL;`);

  // BuildVacancyTemplate: recruiter-saved reusable vacancy blueprint.
  // Stores the same fields a vacancy needs (title/description/skills/salary/
  // questions) so a future post can spin up from the template instead of
  // typing it again. Per-user, no project binding — the template can be
  // applied to any project the recruiter owns.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildVacancyTemplate" (
      "id" TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "skillsJson" TEXT NOT NULL DEFAULT '[]',
      "salary" INTEGER NOT NULL DEFAULT 0,
      "salaryCurrency" TEXT,
      "city" TEXT,
      "questionsJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildVacancyTemplate_owner_idx" ON "BuildVacancyTemplate" ("ownerUserId", "createdAt" DESC);`);

  // BuildBulkTemplate: recruiter-saved message templates for bulk DMs.
  // When a recruiter writes "Спасибо за отклик, мы свяжемся в течение 48
  // часов" the same way 50 times, this lets them save it once and reuse.
  // Per-user; max 30 enforced in the route.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildBulkTemplate" (
      "id" TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildBulkTemplate_owner_idx" ON "BuildBulkTemplate" ("ownerUserId", "createdAt" DESC);`);

  // BuildNotifPrefs: per-user opt-in/out for QBuild emails.
  // jobAlerts — new vacancy alerts for talent (also gated by BuildJobAlert.active).
  // applicationEmail — recruiter-side: notify on new application to my vacancies.
  // weeklyDigest — periodic summary email (cron not yet wired).
  // marketing — product updates / launches.
  // Defaults assume opt-in (true) so existing behavior is preserved when no row exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildNotifPrefs" (
      "userId" TEXT PRIMARY KEY,
      "jobAlerts" BOOLEAN NOT NULL DEFAULT TRUE,
      "applicationEmail" BOOLEAN NOT NULL DEFAULT TRUE,
      "weeklyDigest" BOOLEAN NOT NULL DEFAULT TRUE,
      "marketing" BOOLEAN NOT NULL DEFAULT TRUE,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // AI "why match" cached explanation. Populated on demand by /ai/why-match —
  // we cache it on the application row so re-opening the same candidate
  // doesn't re-spend tokens.
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "aiWhyMatch" TEXT;`);

  // Application source tag — where the candidate landed from. Free-form
  // string (organic | widget | utm:linkedin | utm:google | referral) so
  // analytics can bucket without schema migrations.
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "sourceTag" TEXT;`);

  // Recruiter-only label e.g. SHORTLIST / INTERVIEW / HOLD / TOP_PICK.
  // Kept as a free-form short string rather than an enum so we can add
  // labels without schema migrations.
  await pool.query(`ALTER TABLE "BuildApplication" ADD COLUMN IF NOT EXISTS "labelKey" TEXT;`);
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

  // BuildTrialTask: paid trial work proposed by a recruiter to a
  // specific applicant. Replaces the HH "shoot a CV → maybe call →
  // ghost" anti-pattern with "small paid test → real signal both
  // ways". Lifecycle:
  //   PROPOSED (recruiter creates) → ACCEPTED (candidate takes it)
  //                                → REJECTED (candidate declines)
  //   ACCEPTED → SUBMITTED (candidate hands work in)
  //   SUBMITTED → APPROVED (recruiter pays out + offers job)
  //              → REJECTED (recruiter rejects work, no pay)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildTrialTask" (
      "id" TEXT PRIMARY KEY,
      "applicationId" TEXT NOT NULL,
      "vacancyId" TEXT NOT NULL,
      "recruiterId" TEXT NOT NULL,
      "candidateId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "paymentAmount" INTEGER NOT NULL DEFAULT 0,
      "paymentCurrency" TEXT NOT NULL DEFAULT 'RUB',
      "status" TEXT NOT NULL DEFAULT 'PROPOSED',
      "submissionUrl" TEXT,
      "submissionNote" TEXT,
      "rejectReason" TEXT,
      "payoutOrderId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildTrialTask_application_idx" ON "BuildTrialTask" ("applicationId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildTrialTask_candidate_idx" ON "BuildTrialTask" ("candidateId", "status");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildTrialTask_recruiter_idx" ON "BuildTrialTask" ("recruiterId", "status");`);

  // BuildBookmark: per-user star list. Polymorphic — kind tells you
  // what targetId points at (a vacancy id or a userId).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildBookmark" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "note" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "BuildBookmark_user_kind_target_uniq"
    ON "BuildBookmark" ("userId","kind","targetId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildBookmark_user_idx"
    ON "BuildBookmark" ("userId","createdAt" DESC);`);

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

  // BuildCashback: append-only AEV cashback ledger. Every PAID order
  // mints 2% AEV (cashbackBps from /loyalty). orderId is unique so the
  // mint is idempotent — paying the same order twice never doubles
  // the credit.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildCashback" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL UNIQUE,
      "orderKind" TEXT NOT NULL,
      "orderAmount" DOUBLE PRECISION NOT NULL,
      "orderCurrency" TEXT NOT NULL,
      "cashbackAev" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildCashback_user_idx" ON "BuildCashback" ("userId", "createdAt" DESC);`);
  // Claim status: PENDING (just minted) → CLAIMED (user pulled into AEV
  // wallet) — claimedAt timestamps the bridge call.
  await pool.query(`ALTER TABLE "BuildCashback" ADD COLUMN IF NOT EXISTS "claimStatus" TEXT NOT NULL DEFAULT 'PENDING';`);
  await pool.query(`ALTER TABLE "BuildCashback" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE "BuildCashback" ADD COLUMN IF NOT EXISTS "claimDeviceId" TEXT;`);

  // BuildLead: email captures from /build/why-aevion landing for the
  // pre-launch / city-by-city marketing list. We don't tie to user
  // accounts — leads might predate registration.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildLead" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL,
      "city" TEXT,
      "locale" TEXT NOT NULL DEFAULT 'ru',
      "source" TEXT NOT NULL DEFAULT 'why-aevion',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "BuildLead_email_source_uniq" ON "BuildLead" (lower("email"), "source");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildLead_created_idx" ON "BuildLead" ("createdAt" DESC);`);
  // UTM tracking: which campaign / referrer drove this lead. Keep as
  // a free-form string capped at 200 chars to avoid abuse.
  await pool.query(`ALTER TABLE "BuildLead" ADD COLUMN IF NOT EXISTS "referrer" TEXT;`);
  await pool.query(`ALTER TABLE "BuildLead" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;`);
  await pool.query(`ALTER TABLE "BuildLead" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;`);

  // BuildReview: post-engagement rating + comment. Eligibility window is
  // enforced at the route layer, not via FK constraints, so we can later
  // amend the rules (e.g. allow only after project=DONE) without a
  // migration. UNIQUE(projectId,reviewerId,revieweeId) prevents double-
  // posting; one (reviewer→reviewee) per project. Direction is recorded
  // explicitly so we can render "client → worker" vs "worker → client"
  // labels even when a review is read in isolation.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildReview" (
      "id" TEXT PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "reviewerId" TEXT NOT NULL,
      "revieweeId" TEXT NOT NULL,
      "direction" TEXT NOT NULL,
      "rating" INTEGER NOT NULL,
      "comment" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "BuildReview_pair_uniq"
    ON "BuildReview" ("projectId", "reviewerId", "revieweeId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildReview_reviewee_idx"
    ON "BuildReview" ("revieweeId", "createdAt" DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildReview_project_idx"
    ON "BuildReview" ("projectId", "createdAt" DESC);`);

  // BuildJobAlert: candidate subscribes to receive email when a new vacancy
  // matches their keywords/skills. Fire-and-forget via Resend when POST /vacancies.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildJobAlert" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "keywords" TEXT NOT NULL DEFAULT '',
      "skills" TEXT NOT NULL DEFAULT '',
      "city" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "BuildJobAlert_user_uniq" ON "BuildJobAlert" ("userId");`);

  // BuildVerificationRequest: candidate submits a request for the ✓ verified badge.
  // Admin reviews from /build/admin/users or a dedicated queue.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildVerificationRequest" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "note" TEXT,
      "adminNote" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildVerifReq_status_idx" ON "BuildVerificationRequest" ("status", "createdAt" DESC);`);

  // BuildApplicationNote: private recruiter notes attached to an application.
  // Visible only to the vacancy owner (or ADMIN). Used by the recruiter to
  // jot impressions, screening status, etc. without polluting the candidate-
  // facing rejectReason field.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildApplicationNote" (
      "id" TEXT PRIMARY KEY,
      "applicationId" TEXT NOT NULL,
      "authorUserId" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE "BuildApplicationNote" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "BuildApplicationNote_app_idx" ON "BuildApplicationNote" ("applicationId", "isPinned" DESC, "createdAt" DESC);`);

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

}

export const buildPool = pool;

export const PROJECT_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
// ARCHIVED is "closed and hidden" — owner explicitly hides the vacancy from
// public feeds (RSS, partner API, /build/vacancies, employer page) but keeps
// the row + its application history for analytics. Republish moves it back
// to OPEN and resets expiry.
export const VACANCY_STATUSES = ["OPEN", "CLOSED", "ARCHIVED"] as const;
export const APPLICATION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export const BUILD_ROLES = ["CLIENT", "CONTRACTOR", "WORKER", "ADMIN"] as const;
export const SHIFT_PREFERENCES = ["DAY", "NIGHT", "FLEX", "ANY"] as const;
export const AVAILABILITY_TYPES = ["FULL_TIME", "PART_TIME", "PROJECT", "SHIFT", "REMOTE"] as const;
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

// ── Recruiter Loyalty Tiers ─────────────────────────────────────────
// Single source of truth for tier thresholds and benefits. Used by
// /loyalty/me, /loyalty/tiers, markOrderPaid (cashback rate), and
// /subscriptions/start (sub discount). Hires-based: an "ACCEPTED"
// application on the recruiter's project counts as 1 hire, plus an
// "APPROVED" trial-task. Edit one place — every consumer follows.

export type RecruiterTierKey = "DEFAULT" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type RecruiterTier = {
  key: RecruiterTierKey;
  label: string;
  minHires: number;
  hireFeeBps: number;       // applied to HIRE_FEE orders
  cashbackBps: number;      // mint rate on PAID orders (was hardcoded 200)
  subDiscountBps: number;   // discount applied to subscription priceMonthly
  boostSlotsBonus: number;  // extra monthly boost slots on top of the plan
  perks: string[];          // marketing copy for the tier card
};

export const RECRUITER_TIERS: readonly RecruiterTier[] = [
  {
    key: "DEFAULT",
    label: "Default",
    minHires: 0,
    hireFeeBps: 1200,
    cashbackBps: 200,
    subDiscountBps: 0,
    boostSlotsBonus: 0,
    perks: ["Базовая 12% hire-fee", "2% AEV cashback на каждый PAID order"],
  },
  {
    key: "BRONZE",
    label: "Bronze",
    minHires: 3,
    hireFeeBps: 1000,
    cashbackBps: 250,
    subDiscountBps: 500,
    boostSlotsBonus: 1,
    perks: [
      "Hire-fee снижается до 10%",
      "2.5% AEV cashback (вместо 2%)",
      "−5% к подписке",
      "+1 boost-слот в месяц",
    ],
  },
  {
    key: "SILVER",
    label: "Silver",
    minHires: 10,
    hireFeeBps: 800,
    cashbackBps: 300,
    subDiscountBps: 1000,
    boostSlotsBonus: 3,
    perks: [
      "Hire-fee 8%",
      "3% AEV cashback",
      "−10% к подписке",
      "+3 boost-слота в месяц",
      "Приоритетная поддержка",
    ],
  },
  {
    key: "GOLD",
    label: "Gold",
    minHires: 25,
    hireFeeBps: 600,
    cashbackBps: 400,
    subDiscountBps: 1500,
    boostSlotsBonus: 6,
    perks: [
      "Hire-fee 6%",
      "4% AEV cashback",
      "−15% к подписке",
      "+6 boost-слотов в месяц",
      "Бейдж Gold-recruiter в карточке",
      "Verified Employer бесплатно",
    ],
  },
  {
    key: "PLATINUM",
    label: "Platinum",
    minHires: 50,
    hireFeeBps: 400,
    cashbackBps: 500,
    subDiscountBps: 2500,
    boostSlotsBonus: 12,
    perks: [
      "Hire-fee 4% (на 67% дешевле HH)",
      "5% AEV cashback",
      "−25% к подписке",
      "+12 boost-слотов в месяц",
      "Persistent featured-pin для одной активной вакансии",
      "Dedicated success manager",
      "Платиновый бейдж в карточке вакансии",
    ],
  },
] as const;

/** Pick the tier matching a hire count. Always returns a tier (DEFAULT for 0). */
export function computeRecruiterTier(hires: number): RecruiterTier {
  const safe = Math.max(0, Math.floor(hires) || 0);
  let match: RecruiterTier = RECRUITER_TIERS[0];
  for (const t of RECRUITER_TIERS) {
    if (safe >= t.minHires) match = t;
  }
  return match;
}

/** Next tier above the given one, or null if already at the top. */
export function nextRecruiterTier(current: RecruiterTier): RecruiterTier | null {
  const idx = RECRUITER_TIERS.findIndex((t) => t.key === current.key);
  return idx >= 0 && idx < RECRUITER_TIERS.length - 1 ? RECRUITER_TIERS[idx + 1] : null;
}

/** Apply a basis-points discount to an integer minor-unit amount (e.g. RUB). */
export function applyBpsDiscount(amount: number, discountBps: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(discountBps) || discountBps <= 0) return Math.round(amount);
  const factor = Math.max(0, 10000 - Math.floor(discountBps)) / 10000;
  return Math.round(amount * factor);
}

/** Resolve the active tier for a recruiter by counting their hires. */
export async function getRecruiterTier(userId: string): Promise<{
  tier: RecruiterTier;
  hires: number;
}> {
  const [accepted, trial] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT a."id")::int AS "count"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE p."clientId" = $1 AND a."status" = 'ACCEPTED'`,
      [userId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS "count"
       FROM "BuildTrialTask"
       WHERE "recruiterId" = $1 AND "status" = 'APPROVED'`,
      [userId],
    ),
  ]);
  const hires = Number(accepted.rows[0]?.count ?? 0) + Number(trial.rows[0]?.count ?? 0);
  return { tier: computeRecruiterTier(hires), hires };
}

// ── Periodic cleanup ────────────────────────────────────────────────
// Expired BuildBoost rows accumulate forever — every read query already
// filters endsAt > NOW(), but we still want to keep the table compact.
// Run a single delete when more than COOLDOWN_MS has passed since the
// last sweep, gated on a simple in-memory timestamp. No cron needed.
const CLEANUP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h
let lastCleanupAt = 0;

export async function maybeCleanupExpiredBoosts(): Promise<number> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_COOLDOWN_MS) return 0;
  lastCleanupAt = now;
  try {
    const [boosts, vacancies] = await Promise.all([
      pool.query(`DELETE FROM "BuildBoost" WHERE "endsAt" < NOW() - INTERVAL '7 days'`),
      // Auto-close vacancies whose expiresAt has passed
      pool.query(
        `UPDATE "BuildVacancy" SET "status" = 'CLOSED'
         WHERE "status" = 'OPEN' AND "expiresAt" IS NOT NULL AND "expiresAt" < NOW()`,
      ),
    ]);
    const total = (boosts.rowCount ?? 0) + (vacancies.rowCount ?? 0);
    if (total > 0) console.info(`[build] cleanup: removed ${boosts.rowCount} old boosts, closed ${vacancies.rowCount} expired vacancies`);
    return total;
  } catch (err) {
    console.warn("[build] cleanup failed:", (err as Error).message);
    return 0;
  }
}

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCELED", "PENDING"] as const;
export const ORDER_KINDS = ["SUB_START", "BOOST", "TALENT_DAY_PASS", "HIRE_FEE", "TRIAL_PAYOUT"] as const;
export const TRIAL_TASK_STATUSES = ["PROPOSED", "ACCEPTED", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export const ORDER_STATUSES = ["PENDING", "PAID", "CANCELED", "REFUNDED"] as const;
export const BOOKMARK_KINDS = ["VACANCY", "CANDIDATE"] as const;
