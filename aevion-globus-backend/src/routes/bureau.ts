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
  bureauTablesReady = true;
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
