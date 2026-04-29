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
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getKycProvider } from "../lib/kyc";
import {
  getPaymentProvider,
  getVerifiedTierCurrency,
  getVerifiedTierPriceCents,
} from "../lib/payment";

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
