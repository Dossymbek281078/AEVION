/**
 * Bureau Phase A — Verified tier API.
 *
 * Two-stage gate: a certificate is upgraded to "verified" only when
 *   1. KYC has been completed (provider.getSession returns "approved")
 *   2. Payment for the upgrade has cleared (provider.getIntent returns "paid")
 *
 * The two stages live in a single BureauVerification row so we have one
 * audit-trail record per upgrade. The /upgrade/:certId endpoint refuses
 * to mark the cert verified unless both conditions are satisfied at the
 * moment of upgrade — the client cannot bypass either by skipping the
 * webhook.
 */
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getKycProvider } from "../lib/kyc";
import {
  getPaymentProvider,
  getVerifiedTierCurrency,
  getVerifiedTierPriceCents,
} from "../lib/payment";
import { rateLimit } from "../lib/rateLimit";
import { refererHost } from "../lib/qrightHelpers";

const bureauEmbedRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "bureau:embed",
});

export const bureauRouter = Router();
const pool = getPool();

let bureauTablesReady = false;

async function ensureBureauTables(): Promise<void> {
  if (bureauTablesReady) return;
  await pool.query(
    `ALTER TABLE "IPCertificate"
       ADD COLUMN IF NOT EXISTS "authorVerificationLevel" TEXT NOT NULL DEFAULT 'anonymous';`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate"
       ADD COLUMN IF NOT EXISTS "authorVerificationProvider" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate"
       ADD COLUMN IF NOT EXISTS "authorVerificationRef" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate"
       ADD COLUMN IF NOT EXISTS "authorVerifiedAt" TIMESTAMPTZ;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate"
       ADD COLUMN IF NOT EXISTS "authorVerifiedName" TEXT;`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauVerification" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "email" TEXT,
      "kycProvider" TEXT NOT NULL,
      "kycSessionId" TEXT NOT NULL,
      "kycStatus" TEXT NOT NULL DEFAULT 'pending',
      "kycDecision" TEXT,
      "kycVerifiedName" TEXT,
      "kycVerifiedDocType" TEXT,
      "kycVerifiedCountry" TEXT,
      "kycRawJson" JSONB,
      "paymentProvider" TEXT,
      "paymentIntentId" TEXT,
      "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
      "paymentAmountCents" INTEGER,
      "paymentCurrency" TEXT,
      "paymentRawJson" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "completedAt" TIMESTAMPTZ
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauVerification_userId_idx" ON "BureauVerification" ("userId");`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauVerification_kycSessionId_idx" ON "BureauVerification" ("kycSessionId");`,
  );
  // Phase B — organizations.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauOrganization" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "ownerUserId" TEXT NOT NULL,
      "plan" TEXT NOT NULL DEFAULT 'free',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "billingEmail" TEXT,
      "billingCountry" TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauMember" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL REFERENCES "BureauOrganization"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE("orgId", "userId")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauMember_userId_idx" ON "BureauMember" ("userId");`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauOrgInvite" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL REFERENCES "BureauOrganization"("id") ON DELETE CASCADE,
      "invitedEmail" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "acceptedAt" TIMESTAMPTZ,
      "acceptedByUserId" TEXT,
      "expiresAt" TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauOrgInvite_orgId_idx" ON "BureauOrgInvite" ("orgId");`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauOrgInvite_invitedEmail_idx" ON "BureauOrgInvite" ("invitedEmail");`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "orgId" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "BureauVerification" ADD COLUMN IF NOT EXISTS "orgId" TEXT;`,
  );
  // Phase C scaffold — notary registry (rows added manually by admin).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauNotary" (
      "id" TEXT PRIMARY KEY,
      "fullName" TEXT NOT NULL,
      "licenseNumber" TEXT NOT NULL UNIQUE,
      "jurisdiction" TEXT NOT NULL,
      "city" TEXT,
      "publicKeyEd25519" TEXT NOT NULL,
      "publicKeyFingerprint" TEXT NOT NULL,
      "contactEmail" TEXT,
      "contractSignedAt" TIMESTAMPTZ,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deactivatedAt" TIMESTAMPTZ,
      "monthlyVolumeLimit" INTEGER NOT NULL DEFAULT 200
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauNotary_jurisdiction_idx" ON "BureauNotary" ("jurisdiction");`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauNotarySignature" (
      "id" TEXT PRIMARY KEY,
      "notaryId" TEXT NOT NULL REFERENCES "BureauNotary"("id"),
      "certId" TEXT NOT NULL,
      "signedHash" TEXT NOT NULL,
      "signature" TEXT NOT NULL,
      "notaryRegistryRef" TEXT,
      "signedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "revokedAt" TIMESTAMPTZ,
      "revocationReason" TEXT
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauNotarySignature_certId_idx" ON "BureauNotarySignature" ("certId");`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauNotarySignature_notaryId_idx" ON "BureauNotarySignature" ("notaryId");`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "notarySignatureId" TEXT;`,
  );
  // Tier 2: per-Referer hostname counters for embed/badge fetches (no PII).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauCertFetchSource" (
      "certId" TEXT NOT NULL,
      "sourceHost" TEXT NOT NULL,
      "day" DATE NOT NULL,
      "fetches" BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY ("certId", "sourceHost", "day")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauCertFetchSource_cert_day_idx" ON "BureauCertFetchSource" ("certId", "day");`,
  );
  // Tier 2: append-only admin audit (force-verify, revoke-verification).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BureauAuditLog" (
      "id" TEXT PRIMARY KEY,
      "action" TEXT NOT NULL,
      "certId" TEXT,
      "verificationId" TEXT,
      "actor" TEXT,
      "payload" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauAuditLog_at_idx" ON "BureauAuditLog" ("at" DESC);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "BureauAuditLog_action_at_idx" ON "BureauAuditLog" ("action", "at" DESC);`,
  );
  bureauTablesReady = true;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function resolveUser(
  req: Request,
): Promise<{ userId: string | null; name: string | null; email: string | null }> {
  const auth = verifyBearerOptional(req);
  if (!auth) return { userId: null, name: null, email: null };
  await ensureUsersTable(pool);
  const u = await pool.query(
    `SELECT "id","name","email" FROM "AEVIONUser" WHERE "id"=$1`,
    [auth.sub],
  );
  const row = u.rows?.[0];
  if (!row) return { userId: null, name: null, email: null };
  return { userId: row.id, name: row.name, email: row.email };
}

/* ─────────────────────────────────────────────────────────────────── */

/**
 * POST /api/bureau/verify/start
 * Body: { declaredName?, declaredCountry? }
 *
 * Creates a BureauVerification row and returns the KYC provider's hosted
 * widget URL the user must visit.
 */
bureauRouter.post("/verify/start", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    const { declaredName, declaredCountry } = req.body || {};

    const kyc = getKycProvider();
    const session = await kyc.startSession({
      email: user.email,
      userId: user.userId,
      declaredName: typeof declaredName === "string" ? declaredName : null,
      declaredCountry:
        typeof declaredCountry === "string" ? declaredCountry : null,
    });

    const id = "bvf-" + crypto.randomBytes(8).toString("hex");
    await pool.query(
      `INSERT INTO "BureauVerification"
         ("id","userId","email","kycProvider","kycSessionId","kycStatus","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [id, user.userId, user.email, kyc.id, session.sessionId, session.status],
    );

    res.status(201).json({
      verificationId: id,
      kycProvider: kyc.id,
      kycSessionId: session.sessionId,
      redirectUrl: session.redirectUrl,
      expiresAt: session.expiresAt,
      status: session.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "verify/start failed";
    console.error("[Bureau] verify/start:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/bureau/verify/status/:verificationId
 * Returns the current KYC + payment state. Refreshes from provider on each
 * call so the client can poll.
 */
bureauRouter.get("/verify/status/:verificationId", async (req, res) => {
  try {
    await ensureBureauTables();
    const { verificationId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM "BureauVerification" WHERE "id" = $1`,
      [verificationId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "verification not found" });
    }
    const v = rows[0];

    // Refresh KYC status if not yet decided.
    if (v.kycStatus === "pending" || v.kycStatus === "review") {
      const kyc = getKycProvider();
      try {
        const result = await kyc.getSession(v.kycSessionId);
        await pool.query(
          `UPDATE "BureauVerification"
             SET "kycStatus" = $1,
                 "kycDecision" = $2,
                 "kycVerifiedName" = $3,
                 "kycVerifiedDocType" = $4,
                 "kycVerifiedCountry" = $5,
                 "kycRawJson" = $6
           WHERE "id" = $7`,
          [
            result.status,
            result.reason,
            result.verifiedName,
            result.verifiedDocType,
            result.verifiedCountry,
            JSON.stringify(result.raw ?? null),
            verificationId,
          ],
        );
        v.kycStatus = result.status;
        v.kycVerifiedName = result.verifiedName;
        v.kycVerifiedDocType = result.verifiedDocType;
        v.kycVerifiedCountry = result.verifiedCountry;
      } catch (kycErr) {
        console.error("[Bureau] KYC refresh:", kycErr);
      }
    }

    // Refresh payment status if intent exists and not yet paid.
    if (v.paymentIntentId && v.paymentStatus !== "paid") {
      const pay = getPaymentProvider();
      try {
        const result = await pay.getIntent(v.paymentIntentId);
        await pool.query(
          `UPDATE "BureauVerification"
             SET "paymentStatus" = $1,
                 "paymentRawJson" = $2
           WHERE "id" = $3`,
          [result.status, JSON.stringify(result.raw ?? null), verificationId],
        );
        v.paymentStatus = result.status;
      } catch (payErr) {
        console.error("[Bureau] payment refresh:", payErr);
      }
    }

    res.json({
      verificationId: v.id,
      kyc: {
        provider: v.kycProvider,
        sessionId: v.kycSessionId,
        status: v.kycStatus,
        verifiedName: v.kycVerifiedName,
        verifiedCountry: v.kycVerifiedCountry,
        decision: v.kycDecision,
      },
      payment: {
        provider: v.paymentProvider,
        intentId: v.paymentIntentId,
        status: v.paymentStatus,
        amountCents: v.paymentAmountCents,
        currency: v.paymentCurrency,
      },
      ready: v.kycStatus === "approved" && v.paymentStatus === "paid",
      createdAt: v.createdAt,
      completedAt: v.completedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "status failed";
    console.error("[Bureau] verify/status:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/bureau/payment/intent
 * Body: { verificationId }
 * Creates a payment intent for the bureau Verified tier.
 */
bureauRouter.post("/payment/intent", async (req, res) => {
  try {
    await ensureBureauTables();
    const { verificationId } = req.body || {};
    if (typeof verificationId !== "string") {
      return res.status(400).json({ error: "verificationId is required" });
    }
    const { rows } = await pool.query(
      `SELECT * FROM "BureauVerification" WHERE "id" = $1`,
      [verificationId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "verification not found" });
    }
    const v = rows[0];
    if (v.paymentIntentId) {
      return res.status(409).json({
        error: "Payment intent already exists for this verification",
        paymentIntentId: v.paymentIntentId,
      });
    }

    const pay = getPaymentProvider();
    const amountCents = getVerifiedTierPriceCents();
    const currency = getVerifiedTierCurrency();
    const intent = await pay.createIntent({
      reference: verificationId,
      amountCents,
      currency,
      description: "AEVION Bureau — Verified tier upgrade",
      email: v.email,
    });

    await pool.query(
      `UPDATE "BureauVerification"
         SET "paymentProvider" = $1,
             "paymentIntentId" = $2,
             "paymentStatus" = $3,
             "paymentAmountCents" = $4,
             "paymentCurrency" = $5
       WHERE "id" = $6`,
      [
        pay.id,
        intent.intentId,
        intent.status,
        amountCents,
        currency,
        verificationId,
      ],
    );

    res.status(201).json({
      verificationId,
      intentId: intent.intentId,
      checkoutUrl: intent.checkoutUrl,
      amountCents,
      currency,
      status: intent.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "payment/intent failed";
    console.error("[Bureau] payment/intent:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/bureau/upgrade/:certId
 * Body: { verificationId }
 *
 * Apply Verified tier to the certificate, gated by approved KYC and paid
 * intent. Idempotent: re-calling on an already-verified cert is a no-op
 * that returns the current state.
 */
bureauRouter.post("/upgrade/:certId", async (req, res) => {
  try {
    await ensureBureauTables();
    const { certId } = req.params;
    const { verificationId } = req.body || {};
    if (typeof verificationId !== "string") {
      return res.status(400).json({ error: "verificationId is required" });
    }

    const { rows: vRows } = await pool.query(
      `SELECT * FROM "BureauVerification" WHERE "id" = $1`,
      [verificationId],
    );
    if (vRows.length === 0) {
      return res.status(404).json({ error: "verification not found" });
    }
    const v = vRows[0];

    if (v.kycStatus !== "approved") {
      return res.status(409).json({
        error: "KYC has not been approved",
        kycStatus: v.kycStatus,
        reason: v.kycDecision,
      });
    }
    if (v.paymentStatus !== "paid") {
      return res.status(409).json({
        error: "Payment has not been confirmed",
        paymentStatus: v.paymentStatus,
      });
    }

    const { rows: cRows } = await pool.query(
      `SELECT "id","authorVerificationLevel" FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );
    if (cRows.length === 0) {
      return res.status(404).json({ error: "certificate not found" });
    }
    if (cRows[0].authorVerificationLevel === "verified") {
      return res.json({
        certId,
        verificationLevel: "verified",
        idempotent: true,
      });
    }

    await pool.query(
      `UPDATE "IPCertificate"
         SET "authorVerificationLevel" = 'verified',
             "authorVerificationProvider" = $1,
             "authorVerificationRef" = $2,
             "authorVerifiedAt" = NOW(),
             "authorVerifiedName" = $3
       WHERE "id" = $4`,
      [v.kycProvider, verificationId, v.kycVerifiedName, certId],
    );

    await pool.query(
      `UPDATE "BureauVerification" SET "completedAt" = NOW() WHERE "id" = $1`,
      [verificationId],
    );

    res.json({
      certId,
      verificationLevel: "verified",
      verifiedName: v.kycVerifiedName,
      verifiedAt: new Date().toISOString(),
      provider: v.kycProvider,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "upgrade failed";
    console.error("[Bureau] upgrade:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/bureau/dashboard
 * Returns the user's certificates with their verification status. Requires
 * auth — anonymous users have no portfolio in our DB to show.
 */
bureauRouter.get("/dashboard", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    if (!user.userId) {
      return res.status(401).json({ error: "authentication required" });
    }
    const { rows: certs } = await pool.query(
      `SELECT c."id", c."title", c."kind", c."contentHash", c."protectedAt",
              c."authorVerificationLevel", c."authorVerifiedAt", c."authorVerifiedName"
         FROM "IPCertificate" c
         JOIN "QRightObject" o ON o."id" = c."objectId"
        WHERE o."ownerUserId" = $1
        ORDER BY c."protectedAt" DESC
        LIMIT 200`,
      [user.userId],
    );
    const { rows: verifications } = await pool.query(
      `SELECT "id","kycStatus","paymentStatus","createdAt","completedAt"
         FROM "BureauVerification"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 20`,
      [user.userId],
    );
    res.json({
      certificates: certs,
      verifications,
      pricing: {
        verifiedTierCents: getVerifiedTierPriceCents(),
        currency: getVerifiedTierCurrency(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "dashboard failed";
    console.error("[Bureau] dashboard:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/bureau/verify/webhook
 * Provider-hit endpoint. Body shape varies by provider — parseWebhook
 * handles signature verification + decoding. We only update status; the
 * client must hit /upgrade/:certId separately to apply Verified tier.
 */
bureauRouter.post("/verify/webhook", async (req, res) => {
  try {
    await ensureBureauTables();
    const kyc = getKycProvider();
    const headers: Record<string, string> = {};
    for (const [k, val] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(val) ? val.join(",") : String(val ?? "");
    }
    const rawBody = JSON.stringify(req.body ?? {});
    const { sessionId, result } = kyc.parseWebhook(headers, rawBody);

    await pool.query(
      `UPDATE "BureauVerification"
         SET "kycStatus" = $1,
             "kycDecision" = $2,
             "kycVerifiedName" = $3,
             "kycVerifiedDocType" = $4,
             "kycVerifiedCountry" = $5,
             "kycRawJson" = $6
       WHERE "kycSessionId" = $7`,
      [
        result.status,
        result.reason,
        result.verifiedName,
        result.verifiedDocType,
        result.verifiedCountry,
        JSON.stringify(result.raw ?? null),
        sessionId,
      ],
    );
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "kyc webhook failed";
    console.error("[Bureau] kyc webhook:", msg);
    res.status(400).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/bureau/payment/webhook
 * Provider payment confirmation. Same pattern as KYC webhook.
 */
bureauRouter.post("/payment/webhook", async (req, res) => {
  try {
    await ensureBureauTables();
    const pay = getPaymentProvider();
    const headers: Record<string, string> = {};
    for (const [k, val] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(val) ? val.join(",") : String(val ?? "");
    }
    const rawBody = JSON.stringify(req.body ?? {});
    const { intentId, result } = pay.parseWebhook(headers, rawBody);
    await pool.query(
      `UPDATE "BureauVerification"
         SET "paymentStatus" = $1,
             "paymentRawJson" = $2
       WHERE "paymentIntentId" = $3`,
      [result.status, JSON.stringify(result.raw ?? null), intentId],
    );
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "payment webhook failed";
    console.error("[Bureau] payment webhook:", msg);
    res.status(400).json({ ok: false, error: msg });
  }
});

/* ─────────────────── Stub-only helper for demo flow ─────────────────── */

/**
 * GET /api/bureau/kyc-stub/:sessionId
 *
 * The stub KYC provider returns a redirectUrl pointing at this endpoint.
 * In real life it'd be the vendor's hosted widget; here we just return
 * a tiny HTML that auto-redirects back to the upgrade page after a
 * second, simulating the user finishing verification.
 *
 * Production deployments NEVER hit this — they redirect to the real
 * vendor URL. The route exists so end-to-end demos work without a
 * vendor account.
 */
/* ─────────────────────  Notary registry (Phase C scaffold)  ────────── */

/**
 * GET /api/bureau/notaries
 *
 * Public list of active notarial partners. Verifiers use this to
 * resolve a notarySignatureId on a certificate to a known, AEVION-vetted
 * notary record. Anyone may read (this is metadata, not PII).
 */
bureauRouter.get("/notaries", async (req, res) => {
  try {
    await ensureBureauTables();
    const jurisdiction =
      typeof req.query.jurisdiction === "string"
        ? req.query.jurisdiction
        : null;
    const params: string[] = [];
    let where = `WHERE "active" = TRUE`;
    if (jurisdiction) {
      params.push(jurisdiction);
      where += ` AND "jurisdiction" = $1`;
    }
    const { rows } = await pool.query(
      `SELECT "id","fullName","licenseNumber","jurisdiction","city",
              "publicKeyFingerprint","contractSignedAt","createdAt"
         FROM "BureauNotary"
        ${where}
        ORDER BY "createdAt" ASC`,
      params,
    );
    res.json({ notaries: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "list notaries failed";
    console.error("[Bureau] notaries list:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/bureau/notaries/:notaryId
 *
 * Detail view of a single notary, including the full Ed25519 public key
 * (offline verifiers use this to check notary signatures without
 * contacting AEVION).
 */
bureauRouter.get("/notaries/:notaryId", async (req, res) => {
  try {
    await ensureBureauTables();
    const { notaryId } = req.params;
    const { rows } = await pool.query(
      `SELECT "id","fullName","licenseNumber","jurisdiction","city",
              "publicKeyEd25519","publicKeyFingerprint","contractSignedAt",
              "createdAt","active","deactivatedAt"
         FROM "BureauNotary"
        WHERE "id" = $1`,
      [notaryId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "notary not found" });
    }
    res.json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "notary detail failed";
    console.error("[Bureau] notary detail:", msg);
    res.status(500).json({ error: msg });
  }
});

/* ─────────────────────────  Organizations  ─────────────────────── */

/**
 * POST /api/bureau/org
 * Body: { name, billingEmail?, billingCountry? }
 *
 * Create an organization. The caller becomes the owner. A unique slug
 * is auto-generated from the name; collisions are resolved by appending
 * a short random suffix.
 */
bureauRouter.post("/org", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    if (!user.userId) {
      return res.status(401).json({ error: "authentication required" });
    }
    const { name, billingEmail, billingCountry } = req.body || {};
    if (typeof name !== "string" || name.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "name is required (min 2 chars)" });
    }
    const baseSlug = slugify(name) || "org";
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await pool.query(
        `SELECT 1 FROM "BureauOrganization" WHERE "slug" = $1`,
        [slug],
      );
      if (exists.rows.length === 0) break;
      slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
    }
    const orgId = "org-" + crypto.randomBytes(8).toString("hex");
    const memberId = "mem-" + crypto.randomBytes(8).toString("hex");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "BureauOrganization" ("id","name","slug","ownerUserId","billingEmail","billingCountry")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          orgId,
          name.trim(),
          slug,
          user.userId,
          typeof billingEmail === "string" ? billingEmail : user.email,
          typeof billingCountry === "string" ? billingCountry : null,
        ],
      );
      await client.query(
        `INSERT INTO "BureauMember" ("id","orgId","userId","role")
         VALUES ($1,$2,$3,'owner')`,
        [memberId, orgId, user.userId],
      );
      await client.query("COMMIT");
    } catch (txErr) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore rollback errors */
      }
      throw txErr;
    } finally {
      client.release();
    }
    res.status(201).json({
      id: orgId,
      slug,
      name: name.trim(),
      role: "owner",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "create org failed";
    console.error("[Bureau] org create:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/bureau/org/mine
 * List organizations the caller belongs to.
 */
bureauRouter.get("/org/mine", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    if (!user.userId) {
      return res.status(401).json({ error: "authentication required" });
    }
    const { rows } = await pool.query(
      `SELECT o."id", o."name", o."slug", o."plan", o."createdAt", m."role"
         FROM "BureauOrganization" o
         JOIN "BureauMember" m ON m."orgId" = o."id"
        WHERE m."userId" = $1
        ORDER BY o."createdAt" DESC`,
      [user.userId],
    );
    res.json({ organizations: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "list orgs failed";
    console.error("[Bureau] org/mine:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/bureau/org/:orgId
 * Fetch one org plus member list. Caller must be a member.
 */
bureauRouter.get("/org/:orgId", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    if (!user.userId) {
      return res.status(401).json({ error: "authentication required" });
    }
    const { orgId } = req.params;
    const access = await pool.query(
      `SELECT "role" FROM "BureauMember" WHERE "orgId" = $1 AND "userId" = $2`,
      [orgId, user.userId],
    );
    if (access.rows.length === 0) {
      return res.status(403).json({ error: "not a member of this org" });
    }
    const orgRow = await pool.query(
      `SELECT * FROM "BureauOrganization" WHERE "id" = $1`,
      [orgId],
    );
    if (orgRow.rows.length === 0) {
      return res.status(404).json({ error: "org not found" });
    }
    const members = await pool.query(
      `SELECT m."id", m."userId", m."role", m."joinedAt", u."name", u."email"
         FROM "BureauMember" m
         LEFT JOIN "AEVIONUser" u ON u."id" = m."userId"
        WHERE m."orgId" = $1
        ORDER BY m."joinedAt" ASC`,
      [orgId],
    );
    const invites = await pool.query(
      `SELECT "id","invitedEmail","role","createdAt","expiresAt","acceptedAt"
         FROM "BureauOrgInvite"
        WHERE "orgId" = $1 AND "acceptedAt" IS NULL AND "expiresAt" > NOW()
        ORDER BY "createdAt" DESC`,
      [orgId],
    );
    res.json({
      organization: orgRow.rows[0],
      members: members.rows,
      invites: invites.rows,
      myRole: access.rows[0].role,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "get org failed";
    console.error("[Bureau] org get:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/bureau/org/:orgId/invite
 * Body: { email, role? }
 * Owner / admin can invite. Returns a token-bearing accept URL.
 */
bureauRouter.post("/org/:orgId/invite", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    if (!user.userId) {
      return res.status(401).json({ error: "authentication required" });
    }
    const { orgId } = req.params;
    const access = await pool.query(
      `SELECT "role" FROM "BureauMember" WHERE "orgId" = $1 AND "userId" = $2`,
      [orgId, user.userId],
    );
    if (
      access.rows.length === 0 ||
      !["owner", "admin"].includes(access.rows[0].role)
    ) {
      return res
        .status(403)
        .json({ error: "owner / admin role required to invite" });
    }
    const { email, role } = req.body || {};
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "valid email is required" });
    }
    const safeRole = role === "admin" || role === "member" ? role : "member";
    const inviteId = "inv-" + crypto.randomBytes(8).toString("hex");
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO "BureauOrgInvite" ("id","orgId","invitedEmail","role","token","expiresAt")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [inviteId, orgId, email.trim().toLowerCase(), safeRole, token, expiresAt],
    );
    res.status(201).json({
      id: inviteId,
      email: email.trim().toLowerCase(),
      role: safeRole,
      acceptUrl: `/bureau/org/accept/${token}`,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "invite failed";
    console.error("[Bureau] org invite:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/bureau/org/accept/:token
 * Accepts an invite. Caller must be authed and their email must match
 * the invite (or the invite must be email-blank for any-user accept,
 * which is not currently supported).
 */
bureauRouter.post("/org/accept/:token", async (req, res) => {
  try {
    await ensureBureauTables();
    const user = await resolveUser(req);
    if (!user.userId) {
      return res.status(401).json({ error: "authentication required" });
    }
    const { token } = req.params;
    const inv = await pool.query(
      `SELECT * FROM "BureauOrgInvite" WHERE "token" = $1`,
      [token],
    );
    if (inv.rows.length === 0) {
      return res.status(404).json({ error: "invite not found" });
    }
    const invite = inv.rows[0];
    if (invite.acceptedAt) {
      return res.status(409).json({ error: "invite already accepted" });
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({ error: "invite expired" });
    }
    if (
      user.email &&
      invite.invitedEmail &&
      invite.invitedEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      return res.status(403).json({
        error: "this invite was issued for a different email address",
      });
    }
    const memberId = "mem-" + crypto.randomBytes(8).toString("hex");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "BureauMember" ("id","orgId","userId","role")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("orgId","userId") DO NOTHING`,
        [memberId, invite.orgId, user.userId, invite.role],
      );
      await client.query(
        `UPDATE "BureauOrgInvite"
            SET "acceptedAt" = NOW(), "acceptedByUserId" = $1
          WHERE "id" = $2`,
        [user.userId, invite.id],
      );
      await client.query("COMMIT");
    } catch (txErr) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw txErr;
    } finally {
      client.release();
    }
    res.json({ orgId: invite.orgId, role: invite.role });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "accept failed";
    console.error("[Bureau] org accept:", msg);
    res.status(500).json({ error: msg });
  }
});

/* ─────────────────── Stub-only helper for demo flow ─────────────────── */

bureauRouter.get("/kyc-stub/:sessionId", (req: Request, res: Response) => {
  if (process.env.BUREAU_KYC_PROVIDER && process.env.BUREAU_KYC_PROVIDER !== "stub") {
    return res.status(404).json({ error: "stub flow disabled in this environment" });
  }
  const { sessionId } = req.params;
  const back = String(req.query.return || "/bureau");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html><head><title>AEVION KYC (stub)</title>
  <meta charset="utf-8"/></head><body style="font-family:system-ui;padding:40px;background:#0f172a;color:#fff;">
  <h1>AEVION Bureau — KYC stub</h1>
  <p>Session: <code>${sessionId}</code></p>
  <p>This is a development-only stub. In production, you'd be uploading
  your ID to a real KYC provider (Sumsub / Veriff / etc). Returning to
  the upgrade page in 1 second...</p>
  <script>setTimeout(() => { window.location.href = ${JSON.stringify(back)}; }, 1000);</script>
  </body></html>`);
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 2: embed + badge + transparency + admin + audit
// ─────────────────────────────────────────────────────────────────────────

function bumpCertFetchCounter(req: Request, certId: string): void {
  const host = refererHost(req);
  const day = new Date().toISOString().slice(0, 10);
  pool
    .query(
      `INSERT INTO "BureauCertFetchSource" ("certId","sourceHost","day","fetches")
       VALUES ($1,$2,$3,1)
       ON CONFLICT ("certId","sourceHost","day")
       DO UPDATE SET "fetches" = "BureauCertFetchSource"."fetches" + 1`,
      [certId, host, day]
    )
    .catch(() => {});
}

function bureauAdminEmailsAllowlist(): Set<string> {
  const raw = String(process.env.BUREAU_ADMIN_EMAILS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isBureauAdmin(req: Request): { ok: boolean; email: string | null; reason: string | null } {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) return { ok: false, email: null, reason: "no-bearer" };
  const token = auth.slice(7).trim();
  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    const email = String(decoded.email || "").toLowerCase();
    const role = String(decoded.role || "").toLowerCase();
    if (role === "admin") return { ok: true, email, reason: null };
    const allow = bureauAdminEmailsAllowlist();
    if (allow.has(email)) return { ok: true, email, reason: null };
    return { ok: false, email, reason: "not-in-allowlist" };
  } catch {
    return { ok: false, email: null, reason: "invalid-token" };
  }
}

async function logBureauAudit(opts: {
  action: string;
  certId: string | null;
  verificationId: string | null;
  actor: string | null;
  payload: Record<string, unknown> | null;
}): Promise<void> {
  await pool
    .query(
      `INSERT INTO "BureauAuditLog" ("id","action","certId","verificationId","actor","payload")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        crypto.randomUUID(),
        opts.action,
        opts.certId,
        opts.verificationId,
        opts.actor,
        opts.payload ? JSON.stringify(opts.payload) : null,
      ]
    )
    .catch(() => {});
}

// 🔹 GET /cert/:certId/embed — sanitized JSON for third-party pages.
bureauRouter.get("/cert/:certId/embed", bureauEmbedRateLimit, async (req, res) => {
  try {
    await ensureBureauTables();
    const certId = String(req.params.certId);
    const r = await pool.query(
      `SELECT "id","title","kind","authorVerificationLevel","authorVerifiedName",
              "authorVerifiedAt","protectedAt","status"
       FROM "IPCertificate" WHERE "id" = $1 LIMIT 1`,
      [certId]
    );
    if (r.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.status(404).json({ id: certId, status: "not_found" });
    }
    const row = r.rows[0] as any;
    const verifiedAtMs = row.authorVerifiedAt
      ? (row.authorVerifiedAt instanceof Date ? row.authorVerifiedAt.getTime() : new Date(row.authorVerifiedAt).getTime())
      : 0;
    const etag = `W/"bureau-embed-${certId}-${row.authorVerificationLevel}-${verifiedAtMs}-${row.status}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(304).end();
    }
    bumpCertFetchCounter(req, certId);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: row.id,
      title: row.title,
      kind: row.kind,
      verificationLevel: row.authorVerificationLevel || "anonymous",
      verifiedName: row.authorVerifiedName || null,
      verifiedAt: row.authorVerifiedAt
        ? row.authorVerifiedAt instanceof Date
          ? row.authorVerifiedAt.toISOString()
          : row.authorVerifiedAt
        : null,
      protectedAt: row.protectedAt instanceof Date ? row.protectedAt.toISOString() : row.protectedAt,
      status: row.status,
      verifyUrl: `/bureau/upgrade/${row.id}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "embed failed", details: err.message });
  }
});

// 🔹 GET /cert/:certId/badge.svg — verification badge.
bureauRouter.get("/cert/:certId/badge.svg", bureauEmbedRateLimit, async (req, res) => {
  try {
    await ensureBureauTables();
    const certId = String(req.params.certId);
    const theme = String(req.query.theme || "dark").toLowerCase() === "light" ? "light" : "dark";
    const r = await pool.query(
      `SELECT "authorVerificationLevel","status" FROM "IPCertificate" WHERE "id" = $1 LIMIT 1`,
      [certId]
    );

    function esc(s: string): string {
      return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    }
    function svgShell(left: string, right: string, rightFill: string): string {
      const padX = 8;
      const charW = 6.6;
      const lW = Math.max(70, Math.round(left.length * charW + padX * 2));
      const rW = Math.max(80, Math.round(right.length * charW + padX * 2));
      const total = lW + rW;
      const leftFill = theme === "light" ? "#e2e8f0" : "#1e293b";
      const leftText = theme === "light" ? "#0f172a" : "#e2e8f0";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${esc(left)}: ${esc(right)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-opacity=".08"/></linearGradient>
  <rect width="${total}" height="22" rx="4" fill="${leftFill}"/>
  <rect x="${lW}" width="${rW}" height="22" rx="4" fill="${rightFill}"/>
  <rect x="${lW - 4}" width="8" height="22" fill="${rightFill}"/>
  <rect width="${total}" height="22" rx="4" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700">
    <text x="${lW / 2}" y="15" fill="${leftText}">${esc(left)}</text>
    <text x="${lW + rW / 2}" y="15">${esc(right)}</text>
  </g>
</svg>`;
    }

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (r.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.send(svgShell("AEVION BUREAU", "not found", "#94a3b8"));
    }
    const row = r.rows[0] as any;
    const lvl = String(row.authorVerificationLevel || "anonymous");
    const status = String(row.status || "active");
    let label: string;
    let color: string;
    if (status === "revoked") {
      label = "revoked";
      color = "#dc2626";
    } else if (lvl === "verified") {
      label = "✓ Verified";
      color = "#16a34a";
    } else if (lvl === "notarized") {
      label = "⚖ Notarized";
      color = "#7c3aed";
    } else {
      label = "anonymous";
      color = "#475569";
    }
    const etag = `W/"bureau-badge-${certId}-${lvl}-${status}-${theme}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(304).end();
    }
    bumpCertFetchCounter(req, certId);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(svgShell("AEVION BUREAU", label, color));
  } catch (err: any) {
    res.status(500).json({ error: "badge failed", details: err.message });
  }
});

// 🔹 GET /transparency — public aggregate counts (no PII).
bureauRouter.get("/transparency", bureauEmbedRateLimit, async (_req, res) => {
  try {
    await ensureBureauTables();
    const totals = await pool.query(
      `SELECT "authorVerificationLevel" AS "level", COUNT(*)::int AS "n"
       FROM "IPCertificate" GROUP BY "authorVerificationLevel"`
    );
    const verifs = await pool.query(
      `SELECT "kycStatus" AS "k", COUNT(*)::int AS "n"
       FROM "BureauVerification" GROUP BY "kycStatus"`
    );
    const countries = await pool.query(
      `SELECT "kycVerifiedCountry" AS "c", COUNT(*)::int AS "n"
       FROM "BureauVerification"
       WHERE "kycVerifiedCountry" IS NOT NULL
       GROUP BY "kycVerifiedCountry" ORDER BY "n" DESC LIMIT 10`
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      totalsByLevel: Object.fromEntries(totals.rows.map((r: any) => [r.level || "anonymous", r.n])),
      verificationsByStatus: Object.fromEntries(verifs.rows.map((r: any) => [r.k, r.n])),
      topCountries: countries.rows.map((r: any) => ({ country: r.c, count: r.n })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "transparency failed", details: err.message });
  }
});

// 🔹 Admin probe.
bureauRouter.get("/admin/whoami", (req, res) => {
  const a = isBureauAdmin(req);
  res.json({ isAdmin: a.ok, email: a.email, reason: a.reason });
});

// 🔹 Admin: list verifications (?status, ?limit≤200).
bureauRouter.get("/admin/verifications", async (req, res) => {
  const a = isBureauAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureBureauTables();
  const status = String(req.query.status || "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const args: any[] = [];
  let where = "";
  if (status) {
    args.push(status);
    where = `WHERE "kycStatus" = $1`;
  }
  args.push(limit);
  const r = await pool.query(
    `SELECT "id","userId","email","kycProvider","kycStatus","kycVerifiedName",
            "kycVerifiedCountry","paymentStatus","createdAt","completedAt","orgId"
     FROM "BureauVerification" ${where}
     ORDER BY "createdAt" DESC LIMIT $${args.length}`,
    args
  );
  res.json({ items: r.rows });
});

// 🔹 Admin: force-verify a cert (bypass payment / KYC).
bureauRouter.post("/admin/cert/:certId/force-verify", async (req, res) => {
  const a = isBureauAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureBureauTables();
  const certId = String(req.params.certId);
  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  const verifiedName = String(req.body?.verifiedName || "").trim().slice(0, 200) || null;
  const cur = await pool.query(
    `SELECT "id","authorVerificationLevel" FROM "IPCertificate" WHERE "id" = $1`,
    [certId]
  );
  if (cur.rowCount === 0) return res.status(404).json({ error: "cert_not_found" });
  await pool.query(
    `UPDATE "IPCertificate"
       SET "authorVerificationLevel" = 'verified',
           "authorVerificationProvider" = 'admin',
           "authorVerifiedAt" = NOW(),
           "authorVerifiedName" = COALESCE($2, "authorVerifiedName")
     WHERE "id" = $1`,
    [certId, verifiedName]
  );
  await logBureauAudit({
    action: "admin.force-verify",
    certId,
    verificationId: null,
    actor: a.email,
    payload: { reason, verifiedName, prevLevel: cur.rows[0].authorVerificationLevel },
  });
  res.json({ ok: true });
});

// 🔹 Admin: revoke a cert's verification status.
bureauRouter.post("/admin/cert/:certId/revoke-verification", async (req, res) => {
  const a = isBureauAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureBureauTables();
  const certId = String(req.params.certId);
  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  if (!reason) return res.status(400).json({ error: "reason_required" });
  const cur = await pool.query(
    `SELECT "id","authorVerificationLevel","authorVerifiedName" FROM "IPCertificate" WHERE "id" = $1`,
    [certId]
  );
  if (cur.rowCount === 0) return res.status(404).json({ error: "cert_not_found" });
  await pool.query(
    `UPDATE "IPCertificate"
       SET "authorVerificationLevel" = 'anonymous',
           "authorVerifiedAt" = NULL,
           "authorVerifiedName" = NULL
     WHERE "id" = $1`,
    [certId]
  );
  await logBureauAudit({
    action: "admin.revoke-verification",
    certId,
    verificationId: null,
    actor: a.email,
    payload: { reason, prevLevel: cur.rows[0].authorVerificationLevel, prevName: cur.rows[0].authorVerifiedName },
  });
  res.json({ ok: true });
});

// 🔹 Admin: audit reader.
bureauRouter.get("/admin/audit", async (req, res) => {
  const a = isBureauAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureBureauTables();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const action = String(req.query.action || "").trim();
  const args: any[] = [];
  let where = "";
  if (action) {
    args.push(action);
    where = `WHERE "action" = $1`;
  }
  args.push(limit);
  const r = await pool.query(
    `SELECT "id","action","certId","verificationId","actor","payload","at"
     FROM "BureauAuditLog" ${where}
     ORDER BY "at" DESC LIMIT $${args.length}`,
    args
  );
  res.json({ items: r.rows });
});
