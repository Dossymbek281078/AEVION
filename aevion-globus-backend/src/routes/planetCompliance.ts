import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { canonicalizeCodeFiles, type CodeFileInput, type CodeIndex } from "../lib/planetCodeCanon";
import {
  canonicalizeMediaInput,
  jaccardStringSets,
  type MediaDescriptor,
  type MediaIndex,
} from "../lib/planetMediaCanon";
import { getPool } from "../lib/dbPool";
import { stableStringify } from "../lib/stableStringify";
import { buildMerkleTree, merkleProofForLeaf, sortedIndex, verifyMerkleProof } from "../lib/merkle";
import { rateLimit } from "../lib/rateLimit";
// Reuse the privacy-aware Referer hostname bucket from QRight Tier 2 — same
// behaviour, same lowercasing/www-strip, "(direct)" fallback.
import { refererHost } from "../lib/qrightHelpers";
import { deliverWebhook } from "../lib/webhookDelivery";

const PLANET_WEBHOOK_DELIVERY_CFG = {
  webhookTable: "PlanetWebhook",
  deliveryTable: "PlanetWebhookDelivery",
  entityColumn: "certificateId",
  userAgent: "AEVION-Planet-Webhook/1.0",
} as const;

export const planetComplianceRouter = Router();

const pool = getPool();

// Public surfaces (embed JSON, badge SVG, transparency) are loaded by
// third-party sites; they get a higher cap than the owner/admin reads.
const planetEmbedRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "planet:embed",
});

let ensuredTables = false;
async function ensurePlanetTables() {
  if (ensuredTables) return;

  // We use raw SQL bootstrapping because current backend is raw-pg + express (no Prisma in this module).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetSubmission" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "artifactType" TEXT NOT NULL,
      "productKey" TEXT NOT NULL,
      "tier" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "PlanetArtifactVersion" (
      "id" TEXT PRIMARY KEY,
      "submissionId" TEXT NOT NULL,
      "versionNo" INT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "artifactType" TEXT NOT NULL,
      "productKey" TEXT NOT NULL,
      "tier" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "inputSetHash" TEXT NOT NULL,
      "generationParamsHash" TEXT NOT NULL,
      "canonicalArtifactHash" TEXT NOT NULL,
      "evidenceRoot" TEXT,
      "certificateId" TEXT,
      "validatorResultsJson" JSONB,
      "codeIndexJson" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "PlanetCertificate" (
      "id" TEXT PRIMARY KEY,
      "artifactVersionId" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "publicPayloadJson" JSONB NOT NULL,
      "privatePayloadJson" JSONB NOT NULL,
      "policyManifestHash" TEXT NOT NULL,
      "evidenceRoot" TEXT NOT NULL,
      "signature" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "revokedAt" TIMESTAMPTZ,
      "revokeReason" TEXT
    );

    CREATE TABLE IF NOT EXISTS "PlanetCodeSymbolHistory" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "codeSymbol" TEXT NOT NULL,
      "validFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "validUntil" TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS "PlanetVote" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "artifactVersionId" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL DEFAULT 'general',
      "score" INT NOT NULL,
      "codeSymbol" TEXT NOT NULL,
      "leafHash" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("userId", "artifactVersionId", "categoryId")
    );

    CREATE TABLE IF NOT EXISTS "PlanetVoteSnapshot" (
      "id" TEXT PRIMARY KEY,
      "artifactVersionId" TEXT NOT NULL,
      "seasonId" TEXT NOT NULL,
      "publicSalt" TEXT NOT NULL,
      "rootHash" TEXT NOT NULL,
      "voteCount" INT NOT NULL,
      "leavesOrderedJson" JSONB NOT NULL,
      "signature" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("artifactVersionId", "seasonId")
    );
  `);

  await pool.query(`
    ALTER TABLE "PlanetArtifactVersion" ADD COLUMN IF NOT EXISTS "parentVersionId" TEXT;
  `);

  await pool.query(`
    ALTER TABLE "PlanetArtifactVersion" ADD COLUMN IF NOT EXISTS "mediaIndexJson" JSONB;
  `);

  // Tier 2 (v1.2 of Planet) — public embed/badge counters + closed-set
  // revoke reason + provenance. revokedAt and revokeReason already exist
  // from Phase 1 of Planet, so ALTER is additive only.
  await pool.query(`
    ALTER TABLE "PlanetCertificate" ADD COLUMN IF NOT EXISTS "revokeReasonCode" TEXT;
    ALTER TABLE "PlanetCertificate" ADD COLUMN IF NOT EXISTS "revokedBy" TEXT;
    ALTER TABLE "PlanetCertificate" ADD COLUMN IF NOT EXISTS "embedFetches" BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE "PlanetCertificate" ADD COLUMN IF NOT EXISTS "lastFetchedAt" TIMESTAMPTZ;
  `);

  // Daily fetch buckets per certificate — drives the future sparkline UI.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetCertFetchDaily" (
      "certificateId" TEXT NOT NULL,
      "day" DATE NOT NULL,
      "fetches" BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY ("certificateId", "day")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetCertFetchDaily_day_idx" ON "PlanetCertFetchDaily" ("day");`
  );

  // Per-Referer hostname bucket — identical privacy semantics as QRight
  // (hostname only, no path/UA/IP, "(direct)" fallback).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetCertFetchSource" (
      "certificateId" TEXT NOT NULL,
      "sourceHost" TEXT NOT NULL,
      "day" DATE NOT NULL,
      "fetches" BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY ("certificateId", "sourceHost", "day")
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetCertFetchSource_cert_day_idx" ON "PlanetCertFetchSource" ("certificateId", "day");`
  );

  // Append-only audit log for privileged actions (owner.revoke,
  // admin.revoke, admin.bulk-revoke). Same shape as QRight's audit log
  // for operator muscle-memory.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetAuditLog" (
      "id" TEXT PRIMARY KEY,
      "actor" TEXT,
      "action" TEXT NOT NULL,
      "targetId" TEXT,
      "payload" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetAuditLog_at_idx" ON "PlanetAuditLog" ("at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetAuditLog_action_idx" ON "PlanetAuditLog" ("action");`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetAuditLog_target_idx" ON "PlanetAuditLog" ("targetId");`
  );

  // Owner-configured outgoing webhooks + per-attempt delivery log.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetWebhook" (
      "id" TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "secret" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastDeliveredAt" TIMESTAMPTZ,
      "lastFailedAt" TIMESTAMPTZ,
      "lastError" TEXT
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetWebhook_owner_idx" ON "PlanetWebhook" ("ownerUserId");`
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetWebhookDelivery" (
      "id" TEXT PRIMARY KEY,
      "webhookId" TEXT NOT NULL,
      "certificateId" TEXT,
      "eventType" TEXT NOT NULL,
      "requestBody" TEXT NOT NULL,
      "statusCode" INTEGER,
      "ok" BOOLEAN NOT NULL DEFAULT FALSE,
      "error" TEXT,
      "deliveredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "isRetry" BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PlanetWebhookDelivery_webhook_idx" ON "PlanetWebhookDelivery" ("webhookId", "deliveredAt" DESC);`
  );

  ensuredTables = true;
}

// Closed-set revoke reasons — same vocabulary as QRight so operators
// don't have to learn a second ontology.
const PLANET_REVOKE_REASON_CODES = new Set([
  "license-conflict",
  "withdrawn",
  "dispute",
  "mistake",
  "superseded",
  "other",
  // Admin-only:
  "admin-takedown",
]);

// Admin allowlist by email (ENV) + JWT role=admin. Empty = no email-based
// admins (only role=admin works).
function getPlanetAdminEmailAllowlist(): Set<string> {
  const raw = (process.env.PLANET_ADMIN_EMAILS || "").trim();
  if (!raw) return new Set<string>();
  return new Set(
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

function isPlanetAdmin(auth: { role?: string; email?: string } | null): boolean {
  if (!auth) return false;
  if (auth.role === "admin") return true;
  if (!auth.email) return false;
  return getPlanetAdminEmailAllowlist().has(auth.email.toLowerCase());
}

// Best-effort counter bump — never blocks the public response.
function bumpPlanetCertCounters(
  req: { headers: Record<string, string | string[] | undefined> },
  certificateId: string
): void {
  pool
    .query(
      `UPDATE "PlanetCertificate"
       SET "embedFetches" = "embedFetches" + 1, "lastFetchedAt" = NOW()
       WHERE "id" = $1`,
      [certificateId]
    )
    .catch(() => {});
  pool
    .query(
      `INSERT INTO "PlanetCertFetchDaily" ("certificateId", "day", "fetches")
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT ("certificateId", "day")
       DO UPDATE SET "fetches" = "PlanetCertFetchDaily"."fetches" + 1`,
      [certificateId]
    )
    .catch(() => {});
  const host = refererHost(req);
  pool
    .query(
      `INSERT INTO "PlanetCertFetchSource" ("certificateId", "sourceHost", "day", "fetches")
       VALUES ($1, $2, CURRENT_DATE, 1)
       ON CONFLICT ("certificateId", "sourceHost", "day")
       DO UPDATE SET "fetches" = "PlanetCertFetchSource"."fetches" + 1`,
      [certificateId, host]
    )
    .catch(() => {});
}

// Append an audit row. Fire-and-forget (never blocks the user-facing action).
function recordPlanetAudit(
  actor: string | null,
  action: string,
  targetId: string | null,
  payload: Record<string, unknown> | null
): void {
  pool
    .query(
      `INSERT INTO "PlanetAuditLog" ("id", "actor", "action", "targetId", "payload")
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), actor, action, targetId, payload ? JSON.stringify(payload) : null]
    )
    .catch((err: Error) => {
      console.warn(`[planet] audit insert failed action=${action}:`, err.message);
    });
}

// Single webhook delivery: sign, POST, persist log row, update last* counters.
// Mirrors the QRight implementation; never throws.
async function attemptPlanetWebhookDelivery(opts: {
  webhookId: string;
  url: string;
  secret: string;
  body: string;
  eventType: string;
  certificateId: string | null;
  isRetry: boolean;
}): Promise<{ ok: boolean; statusCode: number | null; error: string | null }> {
  return deliverWebhook(pool, PLANET_WEBHOOK_DELIVERY_CFG, {
    webhookId: opts.webhookId,
    url: opts.url,
    secret: opts.secret,
    body: opts.body,
    eventType: opts.eventType,
    entityId: opts.certificateId,
    isRetry: opts.isRetry,
  });
}

// Fan out a certificate-revoke event to every webhook the cert's owner
// has registered. Best-effort.
function triggerPlanetRevokeWebhooks(
  certificateId: string,
  ownerId: string,
  payload: {
    revokedAt: string;
    reasonCode: string | null;
    reason: string | null;
    revokedBy: "owner" | "admin";
  }
): void {
  pool
    .query(
      `SELECT "id", "url", "secret"
       FROM "PlanetWebhook" WHERE "ownerUserId" = $1`,
      [ownerId]
    )
    .then(async (result: { rows: { id: string; url: string; secret: string }[] }) => {
      for (const wh of result.rows) {
        const body = JSON.stringify({
          event: "planet.certificate.revoked",
          certificateId,
          revokedAt: payload.revokedAt,
          reasonCode: payload.reasonCode,
          reason: payload.reason,
          revokedBy: payload.revokedBy,
          deliveredAt: new Date().toISOString(),
        });
        await attemptPlanetWebhookDelivery({
          webhookId: wh.id,
          url: wh.url,
          secret: wh.secret,
          body,
          eventType: "planet.certificate.revoked",
          certificateId,
          isRetry: false,
        });
      }
    })
    .catch((err: Error) => {
      console.warn(`[planet] webhook fanout failed for ${certificateId}:`, err.message);
    });
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function hmacSha256Hex(secret: string, s: string): string {
  return crypto.createHmac("sha256", secret).update(s).digest("hex");
}

function normalizeJson(value: any): any {
  // jsonb may arrive already parsed; keep it stable for stableStringify usage.
  return value;
}

function stableH(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

function jsonbMaybeParse(v: any): any {
  if (v == null) return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function requireAuth(req: any, res: any) {
  const header = req.headers?.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return null;
  }
  const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
  try {
    return jwt.verify(token, secret) as any;
  } catch (e: any) {
    res.status(401).json({ error: "invalid token", details: e?.message });
    return null;
  }
}

const VALID_ARTIFACT_TYPES = new Set(["movie", "music", "code", "web"]);

function productSecretFor(productKey: string) {
  const base = process.env.QSIGN_SECRET || "dev-qsign-secret";
  return `${base}:${productKey}`;
}

function defaultLicensePolicy(artifactType: string, productKey: string, tier: string) {
  // MVP: simple allow/deny by declared license string.
  // Later: real SBOM / dependency license scanning.
  const disallowed = ["GPL", "AGPL", "LGPL"];
  const allowed = ["MIT", "Apache", "BSD", "ISC"];
  return {
    artifactType,
    productKey,
    tier,
    allowedLicensesKeywords: allowed,
    disallowedLicensesKeywords: disallowed,
    evidenceRequired: ["license_declared", "policy_manifest_signed"],
  };
}

function policyManifest(artifactType: string, productKey: string, tier: string) {
  return {
    bureau: "AEVION-PLANET-ELECTRONIC-BUREAU",
    version: "v1",
    artifactType,
    productKey,
    tier,
    allowedActions: ["publish_in_portal", "export_signed_bundle"],
    evidence: ["integrity_binding", "validator_results", "evidence_root"],
    moderation: {
      plagiarism: { resubmitAllowed: true },
    },
    createdAt: new Date().toISOString(),
  };
}

function computeEvidenceRoot(params: {
  inputSetHash: string;
  generationParamsHash: string;
  pipelineVersion: string;
  validatorResults: any;
  canonicalArtifactHash: string;
}) {
  return stableH({
    kind: "planet_evidence_root",
    pipelineVersion: params.pipelineVersion,
    inputSetHash: params.inputSetHash,
    generationParamsHash: params.generationParamsHash,
    canonicalArtifactHash: params.canonicalArtifactHash,
    validatorResults: normalizeJson(params.validatorResults),
  });
}

function decideOverallStatus(validatorResults: Array<{ status: "passed" | "flagged" | "rejected" }>) {
  if (validatorResults.some((v) => v.status === "rejected")) return "rejected" as const;
  if (validatorResults.some((v) => v.status === "flagged")) return "flagged" as const;
  return "passed" as const;
}

function riskScanTextForSecrets(code: string) {
  const patterns: Array<{ id: string; re: RegExp }> = [
    { id: "private_key_pem", re: /-----BEGIN (RSA|EC|DSA|) PRIVATE KEY-----/i },
    { id: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
    { id: "gcp_service_account", re: /"type"\s*:\s*"service_account"/i },
    { id: "jwt_like", re: /\beyJ[A-Za-z0-9_-]{10,}\b/ },
    { id: "shell_exec_like", re: /\bexecSync\s*\(|\bspawn\s*\(|\bchild_process\b/i },
    { id: "eval_like", re: /\beval\s*\(|new Function\s*\(/i },
  ];

  const hits: string[] = [];
  for (const p of patterns) {
    if (p.re.test(code)) hits.push(p.id);
  }
  return hits;
}

function similarityJaccard(aSet: Set<string>, bSet: Set<string>) {
  if (aSet.size === 0 && bSet.size === 0) return 1;
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  const uni = aSet.size + bSet.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function computeMaxSegmentScore(newIndex: CodeIndex, refIndex: CodeIndex) {
  // Per-file block overlap ratio; then take max.
  const refBlockSet = new Set<string>();
  for (const f of refIndex.files) for (const b of f.blocks) refBlockSet.add(b.blockHash);

  let best = 0;
  for (const f of newIndex.files) {
    if (!f.blocks.length) continue;
    let matched = 0;
    for (const b of f.blocks) if (refBlockSet.has(b.blockHash)) matched++;
    const ratio = matched / f.blocks.length;
    if (ratio > best) best = ratio;
  }
  return best;
}

function selectSegmentsForCurrentVersion(newIndex: CodeIndex, refBlockSet: Set<string>) {
  const segments: Array<{ filePath: string; startLine: number; endLine: number; segmentScore: number; segmentThreshold: number }> = [];
  const segmentThreshold = 0.01; // explained by UI; real threshold driven by validator decision.

  for (const f of newIndex.files) {
    for (const b of f.blocks) {
      if (!refBlockSet.has(b.blockHash)) continue;
      segments.push({
        filePath: f.path,
        startLine: b.startLine,
        endLine: b.endLine,
        segmentScore: 1,
        segmentThreshold,
      });
    }
  }

  return segments;
}

function extractPackageJsonLicense(codeFiles: CodeFileInput[] | undefined): string | undefined {
  if (!codeFiles?.length) return undefined;
  const pj = codeFiles.find((f) =>
    f.path.replace(/\\/g, "/").toLowerCase().endsWith("package.json"),
  );
  if (!pj?.content || typeof pj.content !== "string") return undefined;
  try {
    const j = JSON.parse(pj.content) as Record<string, unknown>;
    if (typeof j.license === "string") return j.license;
    const lic = j.license as { type?: string } | undefined;
    if (lic && typeof lic.type === "string") return lic.type;
  } catch {
    /* ignore invalid JSON */
  }
  return undefined;
}

function effectiveDeclaredLicense(declared: string | undefined, codeFiles: CodeFileInput[] | undefined): string {
  const d = (declared || "").trim();
  if (d) return d;
  return (extractPackageJsonLicense(codeFiles) || "").trim();
}

function buildPublicComplianceSummary(validators: unknown): {
  plagiarism: Record<string, unknown> | null;
  license: Record<string, unknown> | null;
  risk: Record<string, unknown> | null;
} {
  const list = Array.isArray(validators) ? validators : [];
  const pick = (id: string) => {
    const v = list.find((x: any) => x?.validatorId === id) as any;
    if (!v) return null;
    return {
      validatorId: v.validatorId,
      status: v.status,
      metrics: v.metrics,
      threshold: v.threshold,
      publicExplanation: v.publicExplanation,
      evidenceRefs: v.evidenceRefs,
      resubmitPolicy: v.resubmitPolicy,
    };
  };
  return {
    plagiarism: pick("plagiarism_code_similarity") || pick("plagiarism_media_similarity"),
    license: pick("license_compliance"),
    risk: pick("risk_safety_static_scan"),
  };
}

function computeVoteStats(rows: Array<{ score: number }>): {
  count: number;
  average: number | null;
  histogram: Record<string, number>;
} {
  const n = rows.length;
  if (!n) return { count: 0, average: null, histogram: {} };
  let sum = 0;
  const histogram: Record<string, number> = {};
  for (const r of rows) {
    sum += r.score;
    const k = String(r.score);
    histogram[k] = (histogram[k] || 0) + 1;
  }
  return { count: n, average: Math.round((sum / n) * 100) / 100, histogram };
}

function computeVoteStatsByCategory(
  rows: Array<{ score: number; categoryId?: string }>
): Record<string, { count: number; average: number | null }> {
  const buckets: Record<string, number[]> = {};
  for (const r of rows) {
    const k = String(r.categoryId ?? "general");
    if (!buckets[k]) buckets[k] = [];
    buckets[k].push(r.score);
  }
  const out: Record<string, { count: number; average: number | null }> = {};
  for (const [k, scores] of Object.entries(buckets)) {
    const sum = scores.reduce((a, b) => a + b, 0);
    out[k] = {
      count: scores.length,
      average:
        scores.length === 0 ? null : Math.round((sum / scores.length) * 100) / 100,
    };
  }
  return out;
}

function safeProductKeyPrefix(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.length) return null;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(raw)) return null;
  return raw;
}

/** Публичные агрегаты для витрин премий и «X из Y» (MVP). */
planetComplianceRouter.get("/stats", async (req, res) => {
  try {
    await ensurePlanetTables();
    const [sym, voters, subs, versions, certified, shielded] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT "userId")::int AS n FROM "PlanetCodeSymbolHistory" WHERE "validUntil" IS NULL`,
      ),
      pool.query(`SELECT COUNT(DISTINCT "userId")::int AS n FROM "PlanetVote"`),
      pool.query(`SELECT COUNT(*)::int AS n FROM "PlanetSubmission"`),
      pool.query(`SELECT COUNT(*)::int AS n FROM "PlanetArtifactVersion"`),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM "PlanetArtifactVersion" WHERE "certificateId" IS NOT NULL`,
      ),
      // QuantumShield active count — wrapped in a try/catch via SQL to avoid
      // 500-ing /stats if the table does not yet exist on a fresh deploy.
      pool
        .query(
          `SELECT COUNT(*)::int AS n FROM "QuantumShield" WHERE "status" = 'active'`,
        )
        .catch(() => ({ rows: [{ n: 0 }] }) as { rows: Array<{ n: number }> }),
    ]);

    const eligibleParticipants = Number(sym.rows[0]?.n ?? 0);
    const distinctVotersAllTime = Number(voters.rows[0]?.n ?? 0);

    const pfx = safeProductKeyPrefix(req.query?.productKeyPrefix);
    let scoped: {
      productKeyPrefix: string;
      submissions: number;
      artifactVersions: number;
      certifiedArtifactVersions: number;
    } | null = null;
    if (pfx) {
      const like = `${pfx}%`;
      const [ss, vv, cc] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n FROM "PlanetSubmission" WHERE "productKey" LIKE $1`,
          [like]
        ),
        pool.query(
          `
          SELECT COUNT(*)::int AS n
          FROM "PlanetArtifactVersion" v
          JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
          WHERE s."productKey" LIKE $1
          `,
          [like]
        ),
        pool.query(
          `
          SELECT COUNT(*)::int AS n
          FROM "PlanetArtifactVersion" v
          JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
          WHERE s."productKey" LIKE $1 AND v."certificateId" IS NOT NULL
          `,
          [like]
        ),
      ]);
      scoped = {
        productKeyPrefix: pfx,
        submissions: Number(ss.rows[0]?.n ?? 0),
        artifactVersions: Number(vv.rows[0]?.n ?? 0),
        certifiedArtifactVersions: Number(cc.rows[0]?.n ?? 0),
      };
    }

    res.json({
      eligibleParticipants,
      distinctVotersAllTime,
      submissions: Number(subs.rows[0]?.n ?? 0),
      artifactVersions: Number(versions.rows[0]?.n ?? 0),
      certifiedArtifactVersions: Number(certified.rows[0]?.n ?? 0),
      shieldedObjects: Number(shielded.rows[0]?.n ?? 0),
      scopedToProductKeyPrefix: scoped,
      definitions: {
        eligibleParticipants:
          "Пользователи с активным Planet CodeSymbol (запись в PlanetCodeSymbolHistory с validUntil IS NULL). Кандидат на метрику Y для «проголосовало X из Y».",
        distinctVotersAllTime:
          "Уникальные userId, хотя бы раз голосовавшие по любому артефакту Planet.",
        shieldedObjects:
          "Активные записи Quantum Shield (Shamir 2-of-3 + Ed25519). Падает на 0 если таблица ещё не создана на этом окружении.",
        scopedToProductKeyPrefix:
          "Если передан query productKeyPrefix (безопасный префикс), дополнительно считаются submission/versions только с PlanetSubmission.productKey LIKE prefix||'%'.",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "stats failed" });
  }
});

planetComplianceRouter.post("/submissions", async (req, res) => {
  await ensurePlanetTables();

  const payload = req.body || {};
  const auth = requireAuth(req, res);
  if (!auth) return;

  const ownerId = payload.ownerId || auth.sub;

  const artifactType = payload.artifactType as string;
  const title = payload.title as string;
  const productKey = payload.productKey as string;
  const tier = (payload.tier as string) || "standard";
  const declaredLicense = payload.declaredLicense as string | undefined;
  const generationParams = payload.generationParams || {};
  const pipelineVersion = "planet-compliance-pipeline-v0.1";

  if (!VALID_ARTIFACT_TYPES.has(artifactType)) {
    return res.status(400).json({ error: "invalid artifactType" });
  }
  if (!title || !productKey) {
    return res.status(400).json({ error: "title and productKey are required" });
  }

  // Canonicalize inputs
  let inputSetHash = "";
  let canonicalArtifactHash = "";
  let codeIndex: CodeIndex | null = null;
  let mediaIndex: MediaIndex | null = null;

  if ((artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)) {
    const codeFiles = payload.codeFiles as CodeFileInput[];
    const canon = canonicalizeCodeFiles(codeFiles);
    inputSetHash = canon.inputSetHash;
    codeIndex = canon.codeIndex;
    canonicalArtifactHash = sha256Hex(stableStringify({ artifactType, inputSetHash }));
  } else {
    const mediaFingerprint = payload.mediaFingerprint as string | undefined;
    const mediaDescriptor = payload.mediaDescriptor as MediaDescriptor | undefined;
    if (!mediaFingerprint) {
      return res.status(400).json({
        error: "For movie/music, provide mediaFingerprint; for code/web provide codeFiles.",
      });
    }
    try {
      const canon = canonicalizeMediaInput({
        artifactType: artifactType as "movie" | "music",
        mediaFingerprint,
        mediaDescriptor,
        submissionTitle: title,
      });
      inputSetHash = canon.inputSetHash;
      mediaIndex = canon.mediaIndex;
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "invalid movie/music input" });
    }
    canonicalArtifactHash = sha256Hex(stableStringify({ artifactType, inputSetHash }));
  }

  const generationParamsHash = stableH({
    artifactType,
    productKey,
    tier,
    generationParams,
  });

  const submissionId = crypto.randomUUID();
  const artifactVersionId = crypto.randomUUID();
  const versionNo = 1;

  await pool.query(
    `
      INSERT INTO "PlanetSubmission" ("id","ownerId","title","artifactType","productKey","tier")
      VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [submissionId, ownerId, title, artifactType, productKey, tier]
  );

  // Run compliance validators (sync for MVP)
  const validatorResults: any[] = [];

  // 1) Integrity binding (MVP)
  validatorResults.push({
    validatorId: "integrity_binding",
    validatorVersion: "v0.1",
    status: inputSetHash && generationParamsHash ? "passed" : "rejected",
    publicExplanation: { ok: true },
  });

  // 2) License compliance
  const licensePolicy = defaultLicensePolicy(artifactType, productKey, tier);
  const codeFilesOpt =
    (artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)
      ? (payload.codeFiles as CodeFileInput[])
      : undefined;
  if (artifactType === "code" || artifactType === "web") {
    const resolved = effectiveDeclaredLicense(declaredLicense, codeFilesOpt);
    const lp = resolved.toUpperCase();
    const licenseSource = (declaredLicense || "").trim()
      ? "request_declaredLicense"
      : extractPackageJsonLicense(codeFilesOpt)
        ? "package.json"
        : "none";
    if (!lp.trim()) {
      validatorResults.push({
        validatorId: "license_compliance",
        validatorVersion: "v0.1",
        status: "flagged",
        score: 0.0,
        threshold: 1.0,
        metrics: { licenseSource },
        publicExplanation: {
          byType: [{ type: "declared_license", score: 0, threshold: 1, status: "flagged" }],
          bySegmentsSummary:
            "Не предоставлена декларация лицензии (ни в запросе, ни в package.json).",
        },
        resubmitPolicy: {
          allowed: true,
          requiredChangeDescription:
            "Укажите declaredLicense или добавьте валидный package.json с полем license.",
          minChangeRules: [{ field: "declaredLicense", minCount: 1 }],
        },
      });
    } else {
      const hasDisallowed = licensePolicy.disallowedLicensesKeywords.some((k) => lp.includes(k));
      if (hasDisallowed) {
        validatorResults.push({
          validatorId: "license_compliance",
          validatorVersion: "v0.1",
          status: "rejected",
          metrics: { licenseSource, resolvedLicense: resolved },
          publicExplanation: {
            byType: [
              { type: "license_disallowed_keyword", score: 1, threshold: 0.5, status: "rejected" },
            ],
            bySegmentsSummary: `Обнаружены запрещенные ключевые слова лицензии: ${licensePolicy.disallowedLicensesKeywords.join(", ")}`,
          },
        });
      } else {
        validatorResults.push({
          validatorId: "license_compliance",
          validatorVersion: "v0.1",
          status: "passed",
          metrics: { licenseSource, resolvedLicense: resolved },
          publicExplanation: {
            byType: [{ type: "declared_license", score: 1, threshold: 0.5, status: "passed" }],
            bySegmentsSummary: `Принята лицензия: ${resolved} (источник: ${licenseSource}).`,
          },
        });
      }
    }
  } else {
    // MVP: accept.
    validatorResults.push({
      validatorId: "license_compliance",
      validatorVersion: "v0.1",
      status: "passed",
      publicExplanation: { byType: [{ type: "license", score: 1, threshold: 0.5, status: "passed" }] },
    });
  }

  // 3) Risk & Safety (static scan for code/web)
  if (codeIndex) {
    const allText = (payload.codeFiles as CodeFileInput[])
      .map((f) => (typeof f?.content === "string" ? f.content : ""))
      .join("\n");
    const hits = riskScanTextForSecrets(allText);
    if (hits.length) {
      validatorResults.push({
        validatorId: "risk_safety_static_scan",
        validatorVersion: "v0.1",
        status: "rejected",
        metrics: { hits },
        publicExplanation: {
          byType: [{ type: "secrets/safety", score: 1, threshold: 0.1, status: "rejected" }],
          bySegmentsSummary: `Обнаружены риск-паттерны: ${hits.join(", ")}`,
        },
      });
    } else {
      validatorResults.push({
        validatorId: "risk_safety_static_scan",
        validatorVersion: "v0.1",
        status: "passed",
        publicExplanation: { byType: [{ type: "secrets/safety", score: 0, threshold: 0.1, status: "passed" }] },
      });
    }
  } else {
    validatorResults.push({
      validatorId: "risk_safety_static_scan",
      validatorVersion: "v0.1",
      status: "passed",
      publicExplanation: { byType: [{ type: "mvp", score: 0, threshold: 0.1, status: "passed" }] },
    });
  }

  // 4) Plagiarism / similarity for code/web (multi-metric)
  if (codeIndex) {
    const recent = await pool.query(
      `
        SELECT "id","codeIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "codeIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `,
      [artifactType, submissionId]
    );

    const newBlockSet = new Set<string>();
    for (const f of codeIndex.files) for (const b of f.blocks) newBlockSet.add(b.blockHash);

    let best = {
      refVersionId: null as string | null,
      overallScore: 0,
      maxSegmentScore: 0,
      refBlockSet: new Set<string>(),
    };

    for (const row of recent.rows) {
      const refCodeIndex = jsonbMaybeParse(row.codeIndexJson);
      if (!refCodeIndex || !Array.isArray(refCodeIndex.files)) continue;
      const refIndex = refCodeIndex as CodeIndex;

      const refBlockSet = new Set<string>();
      for (const f of refIndex.files) for (const b of f.blocks) refBlockSet.add(b.blockHash);

      const overallScore = similarityJaccard(newBlockSet, refBlockSet);
      const maxSegmentScore = computeMaxSegmentScore(codeIndex, refIndex);

      if (overallScore > best.overallScore) {
        best = {
          refVersionId: row.id,
          overallScore,
          maxSegmentScore,
          refBlockSet,
        };
      }
    }

    // Multi-metric thresholds (v1 defaults)
    const overallFlagT = 0.75;
    const overallRejectT = 0.92;
    const maxSegmentFlagT = 0.40;
    const maxSegmentRejectT = 0.55;

    if (best.overallScore >= overallFlagT || best.maxSegmentScore >= maxSegmentFlagT) {
      const overallStatus = best.overallScore >= overallRejectT && best.maxSegmentScore >= maxSegmentRejectT ? "rejected" : "flagged";
      const segments = selectSegmentsForCurrentVersion(codeIndex, best.refBlockSet);

      validatorResults.push({
        validatorId: "plagiarism_code_similarity",
        validatorVersion: "v0.1",
        status: overallStatus,
        metrics: {
          overallScore: best.overallScore,
          maxSegmentScore: best.maxSegmentScore,
          comparedRecentCount: recent.rowCount ?? recent.rows.length,
          excludesSameSubmission: true,
        },
        threshold: {
          overallFlagT,
          overallRejectT,
          maxSegmentFlagT,
          maxSegmentRejectT,
        },
        evidenceRefs: {
          segments: segments.slice(0, 40).map((s) => ({
            filePath: s.filePath,
            startLine: s.startLine,
            endLine: s.endLine,
            segmentScore: s.segmentScore,
            segmentThreshold: s.segmentThreshold,
          })),
        },
        publicExplanation: {
          byType: [
            {
              type: "overall_block_jaccard",
              score: best.overallScore,
              threshold: overallStatus === "rejected" ? overallRejectT : overallFlagT,
              status: overallStatus,
            },
            {
              type: "max_segment_block_overlap",
              score: best.maxSegmentScore,
              threshold: overallStatus === "rejected" ? maxSegmentRejectT : maxSegmentFlagT,
              status: overallStatus,
            },
          ],
          bySegmentsSummary:
            overallStatus === "rejected"
              ? "Сходство критически высокое по мульти-метрикам."
              : "Похоже на заимствование/копирование: в версии найдены участки совпадений выше порогов.",
        },
        resubmitPolicy: {
          allowed: true,
          requiredChangeDescription:
            "Для пересдачи при плагиате необходимо заменить входные компоненты (например: изменить хотя бы один файл/модуль или блок исходника), после чего проверки выполняются заново.",
          minChangeRules: [{ field: "changedInputFiles", minCount: 1 }],
        },
      });
    } else {
      validatorResults.push({
        validatorId: "plagiarism_code_similarity",
        validatorVersion: "v0.1",
        status: "passed",
        metrics: {
          overallScore: best.overallScore,
          maxSegmentScore: best.maxSegmentScore,
          comparedRecentCount: recent.rowCount ?? recent.rows.length,
          excludesSameSubmission: true,
        },
        publicExplanation: {
          byType: [
            { type: "overall_block_jaccard", score: best.overallScore, threshold: overallFlagT, status: "passed" },
            { type: "max_segment_block_overlap", score: best.maxSegmentScore, threshold: maxSegmentFlagT, status: "passed" },
          ],
        },
      });
    }
  }

  // 4b) Plagiarism / similarity for movie/music (metadata shingles + normalized fingerprint hash)
  if (mediaIndex) {
    const recentMedia = await pool.query(
      `
        SELECT "id","mediaIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "mediaIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `,
      [artifactType, submissionId]
    );

    let bestMedia = {
      refVersionId: null as string | null,
      overallScore: 0,
      maxSegmentScore: 0,
    };

    for (const row of recentMedia.rows) {
      const ref = jsonbMaybeParse(row.mediaIndexJson) as MediaIndex | null;
      if (!ref || ref.kind !== "planet_media_index_v1" || !Array.isArray(ref.shingles)) continue;
      const fpDup = mediaIndex.fingerprintNormHash === ref.fingerprintNormHash;
      const shingleScore = jaccardStringSets(mediaIndex.shingles, ref.shingles);
      const overallScore = fpDup ? Math.max(shingleScore, 0.99) : shingleScore;
      const maxSegmentScore = fpDup ? 1 : 0;
      if (overallScore > bestMedia.overallScore) {
        bestMedia = { refVersionId: row.id as string, overallScore, maxSegmentScore };
      }
    }

    const mOverallFlagT = 0.75;
    const mOverallRejectT = 0.92;
    const mMaxSegmentFlagT = 0.4;
    const mMaxSegmentRejectT = 0.55;

    if (bestMedia.overallScore >= mOverallFlagT || bestMedia.maxSegmentScore >= mMaxSegmentFlagT) {
      const overallStatus =
        bestMedia.overallScore >= mOverallRejectT && bestMedia.maxSegmentScore >= mMaxSegmentRejectT
          ? "rejected"
          : "flagged";
      validatorResults.push({
        validatorId: "plagiarism_media_similarity",
        validatorVersion: "v0.1",
        status: overallStatus,
        metrics: {
          overallScore: bestMedia.overallScore,
          maxSegmentScore: bestMedia.maxSegmentScore,
          fingerprintMatch: bestMedia.maxSegmentScore >= 1,
          comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
          excludesSameSubmission: true,
          refArtifactVersionId: bestMedia.refVersionId,
        },
        threshold: {
          overallFlagT: mOverallFlagT,
          overallRejectT: mOverallRejectT,
          maxSegmentFlagT: mMaxSegmentFlagT,
          maxSegmentRejectT: mMaxSegmentRejectT,
        },
        evidenceRefs: {
          media: {
            method: "char_5gram_jaccard_plus_fingerprint_hash",
            refArtifactVersionId: bestMedia.refVersionId,
          },
        },
        publicExplanation: {
          byType: [
            {
              type: "media_shingle_jaccard",
              score: bestMedia.overallScore,
              threshold: overallStatus === "rejected" ? mOverallRejectT : mOverallFlagT,
              status: overallStatus,
            },
            {
              type: "fingerprint_id_duplicate",
              score: bestMedia.maxSegmentScore,
              threshold: overallStatus === "rejected" ? mMaxSegmentRejectT : mMaxSegmentFlagT,
              status: overallStatus,
            },
          ],
          bySegmentsSummary:
            overallStatus === "rejected"
              ? "Критически высокое сходство медиа-метаданных или дубликат нормализованного fingerprint."
              : "Похоже на дубликат или сильное пересечение метаданных (шинглы + fingerprint).",
        },
        resubmitPolicy: {
          allowed: true,
          requiredChangeDescription:
            "Измените нормализованный fingerprint и/или метаданные (title/artist/ISRC/externalId), чтобы отличить выпуск.",
          minChangeRules: [{ field: "mediaFingerprintOrDescriptor", minCount: 1 }],
        },
      });
    } else {
      validatorResults.push({
        validatorId: "plagiarism_media_similarity",
        validatorVersion: "v0.1",
        status: "passed",
        metrics: {
          overallScore: bestMedia.overallScore,
          maxSegmentScore: bestMedia.maxSegmentScore,
          comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
          excludesSameSubmission: true,
        },
        publicExplanation: {
          byType: [
            { type: "media_shingle_jaccard", score: bestMedia.overallScore, threshold: mOverallFlagT, status: "passed" },
            { type: "fingerprint_id_duplicate", score: bestMedia.maxSegmentScore, threshold: mMaxSegmentFlagT, status: "passed" },
          ],
        },
      });
    }
  }

  // 5) Style/policy conformance (MVP: declared only)
  validatorResults.push({
    validatorId: "style_policy_conformance",
    validatorVersion: "v0.1",
    status: "passed",
    publicExplanation: { byType: [{ type: "declared_metadata", score: 1, threshold: 0.5, status: "passed" }] },
  });

  // 6) Full CI verification (MVP: static verification bundle for now)
  validatorResults.push({
    validatorId: "full_ci_verification_static",
    validatorVersion: "v0.1",
    status: "passed",
    publicExplanation: {
      byType: [{ type: "static-ci-bundle", score: 1, threshold: 0.5, status: "passed" }],
      bySegmentsSummary: "В MVP выполняются статические проверки целостности/безопасности/структуры пакета.",
    },
  });

  const overallStatus = decideOverallStatus(validatorResults as any);

  const evidenceRoot = computeEvidenceRoot({
    inputSetHash,
    generationParamsHash,
    pipelineVersion,
    validatorResults,
    canonicalArtifactHash,
  });

  const validatorResultsJson = validatorResults;
  const codeIndexJson = codeIndex ? codeIndex : null;

  await pool.query(
    `
      INSERT INTO "PlanetArtifactVersion"
        ("id","submissionId","versionNo","ownerId","artifactType","productKey","tier","status","inputSetHash","generationParamsHash","canonicalArtifactHash","evidenceRoot","validatorResultsJson","codeIndexJson","mediaIndexJson","parentVersionId")
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `,
    [
      artifactVersionId,
      submissionId,
      versionNo,
      ownerId,
      artifactType,
      productKey,
      tier,
      overallStatus,
      inputSetHash,
      generationParamsHash,
      canonicalArtifactHash,
      evidenceRoot,
      validatorResultsJson,
      codeIndexJson ? codeIndexJson : null,
      mediaIndex ? mediaIndex : null,
      null,
    ]
  );

  let certificate: any = null;
  if (overallStatus === "passed") {
    const certificateId = crypto.randomUUID();
    const manifest = policyManifest(artifactType, productKey, tier);
    const policyManifestHash = sha256Hex(stableStringify(manifest));
    const signaturePayload = {
      bureau: manifest.bureau,
      policyManifestHash,
      evidenceRoot,
      certificateId,
      artifactVersionId,
    };
    const signature = hmacSha256Hex(productSecretFor(productKey), stableStringify(signaturePayload));

    const publicPayloadJson = {
      certificateId,
      artifactVersionId,
      submissionId,
      status: "issued",
      artifactType,
      productKey,
      tier,
      evidenceRoot,
      policyManifestHash,
      signatureAlgo: "HMAC-SHA256",
    };

    const privatePayloadJson = {
      evidenceRoot,
      validatorResultsJson,
      pipelineVersion,
      signaturePayload,
    };

    await pool.query(
      `
        INSERT INTO "PlanetCertificate"
          ("id","artifactVersionId","ownerId","status","publicPayloadJson","privatePayloadJson","policyManifestHash","evidenceRoot","signature","revokedAt","revokeReason")
        VALUES
          ($1,$2,$3,'issued',$4,$5,$6,$7,$8,NULL,NULL)
      `,
      [
        certificateId,
        artifactVersionId,
        ownerId,
        publicPayloadJson,
        privatePayloadJson,
        policyManifestHash,
        evidenceRoot,
        signature,
      ]
    );

    await pool.query(
      `
        UPDATE "PlanetArtifactVersion"
        SET "certificateId"=$1
        WHERE "id"=$2
      `,
      [certificateId, artifactVersionId]
    );

    certificate = { certificateId, publicPayloadJson, signature };
  }

  return res.json({
    submissionId,
    artifactVersionId,
    status: overallStatus,
    evidenceRoot,
    validators: validatorResults,
    certificate,
  });
});

planetComplianceRouter.post("/submissions/:submissionId/resubmit", async (req, res) => {
  await ensurePlanetTables();
  const auth = requireAuth(req, res);
  if (!auth) return;

  const payload = req.body || {};
  const submissionId = req.params.submissionId;
  const ownerId = payload.ownerId || auth.sub;

  const recent = await pool.query(
    `
      SELECT *
      FROM "PlanetArtifactVersion"
      WHERE "submissionId"=$1 AND "ownerId"=$2
      ORDER BY "versionNo" DESC
      LIMIT 1
    `,
    [submissionId, ownerId]
  );

  if (!recent.rows?.[0]) {
    return res.status(404).json({ error: "submission latest version not found" });
  }

  const latest = recent.rows[0];
  const subTitle = await pool.query(`SELECT "title" FROM "PlanetSubmission" WHERE "id"=$1`, [submissionId]);
  const submissionTitleFromDb = subTitle.rows?.[0]?.title as string | undefined;
  const parentVersionIdForInsert = latest.id as string;
  const artifactType = latest.artifactType as string;
  const productKey = latest.productKey as string;
  const tier = latest.tier as string;
  const nextVersionNo = Number(latest.versionNo || 0) + 1;

  // Canonicalize new inputs
  let inputSetHash = "";
  let canonicalArtifactHash = "";
  let codeIndex: CodeIndex | null = null;
  let mediaIndex: MediaIndex | null = null;

  if ((artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)) {
    const codeFiles = payload.codeFiles as CodeFileInput[];
    const canon = canonicalizeCodeFiles(codeFiles);
    inputSetHash = canon.inputSetHash;
    codeIndex = canon.codeIndex;
    canonicalArtifactHash = sha256Hex(stableStringify({ artifactType, inputSetHash }));

    // Enforce “changed inputs” policy for plagiarism resubmit.
    const prevCodeIndex = jsonbMaybeParse(latest.codeIndexJson);
    const prevFileHashes = new Map<string, string>();
    if (prevCodeIndex?.files?.length) {
      for (const f of prevCodeIndex.files) prevFileHashes.set(f.path, f.fileHash);
    }
    const newFileHashes = new Map<string, string>();
    if (canon.fileHashes?.length) {
      for (const fh of canon.fileHashes) newFileHashes.set(fh.path, fh.fileHash);
    }

    let changedCount = 0;
    for (const [path, newHash] of newFileHashes.entries()) {
      if (prevFileHashes.get(path) !== newHash) changedCount++;
    }
    if (changedCount < 1) {
      return res.status(400).json({
        error: "resubmit rejected: insufficient input changes (need at least 1 changed file hash)",
        changedCount,
      });
    }
  } else {
    const mediaFingerprint = payload.mediaFingerprint as string | undefined;
    const mediaDescriptor = payload.mediaDescriptor as MediaDescriptor | undefined;
    const title = (payload.title as string | undefined) || submissionTitleFromDb;
    if (!mediaFingerprint) {
      return res.status(400).json({
        error: "For movie/music, provide mediaFingerprint; for code/web provide codeFiles.",
      });
    }
    try {
      const canon = canonicalizeMediaInput({
        artifactType: artifactType as "movie" | "music",
        mediaFingerprint,
        mediaDescriptor,
        submissionTitle: title,
      });
      inputSetHash = canon.inputSetHash;
      mediaIndex = canon.mediaIndex;
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "invalid movie/music input" });
    }
    if (inputSetHash === latest.inputSetHash) {
      return res.status(400).json({
        error: "resubmit rejected: media inputs unchanged (fingerprint/descriptor vs previous version)",
      });
    }
    canonicalArtifactHash = sha256Hex(stableStringify({ artifactType, inputSetHash }));
  }

  const generationParams = payload.generationParams || {};
  const generationParamsHash = stableH({
    artifactType,
    productKey,
    tier,
    generationParams,
  });

  const pipelineVersion = "planet-compliance-pipeline-v0.1";
  const validatorResults: any[] = [];

  validatorResults.push({
    validatorId: "integrity_binding",
    validatorVersion: "v0.1",
    status: inputSetHash && generationParamsHash ? "passed" : "rejected",
    publicExplanation: { ok: true },
  });

  // License compliance (same logic as create)
  const declaredLicense = payload.declaredLicense as string | undefined;
  const licensePolicy = defaultLicensePolicy(artifactType, productKey, tier);
  const codeFilesOptResubmit =
    (artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)
      ? (payload.codeFiles as CodeFileInput[])
      : undefined;
  if (artifactType === "code" || artifactType === "web") {
    const resolved = effectiveDeclaredLicense(declaredLicense, codeFilesOptResubmit);
    const lp = resolved.toUpperCase();
    const licenseSource = (declaredLicense || "").trim()
      ? "request_declaredLicense"
      : extractPackageJsonLicense(codeFilesOptResubmit)
        ? "package.json"
        : "none";
    if (!lp.trim()) {
      validatorResults.push({
        validatorId: "license_compliance",
        validatorVersion: "v0.1",
        status: "flagged",
        metrics: { licenseSource },
        publicExplanation: {
          byType: [{ type: "declared_license", score: 0, threshold: 1, status: "flagged" }],
          bySegmentsSummary:
            "Не предоставлена декларация лицензии (ни в запросе, ни в package.json).",
        },
        resubmitPolicy: {
          allowed: true,
          requiredChangeDescription:
            "Укажите declaredLicense или добавьте валидный package.json с полем license.",
          minChangeRules: [{ field: "declaredLicense", minCount: 1 }],
        },
      });
    } else {
      const hasDisallowed = licensePolicy.disallowedLicensesKeywords.some((k) => lp.includes(k));
      if (hasDisallowed) {
        validatorResults.push({
          validatorId: "license_compliance",
          validatorVersion: "v0.1",
          status: "rejected",
          metrics: { licenseSource, resolvedLicense: resolved },
          publicExplanation: { byType: [{ type: "license_disallowed_keyword", score: 1, threshold: 0.5, status: "rejected" }] },
        });
      } else {
        validatorResults.push({
          validatorId: "license_compliance",
          validatorVersion: "v0.1",
          status: "passed",
          metrics: { licenseSource, resolvedLicense: resolved },
          publicExplanation: {
            byType: [{ type: "declared_license", score: 1, threshold: 0.5, status: "passed" }],
            bySegmentsSummary: `Принята лицензия: ${resolved} (источник: ${licenseSource}).`,
          },
        });
      }
    }
  } else {
    validatorResults.push({
      validatorId: "license_compliance",
      validatorVersion: "v0.1",
      status: "passed",
      publicExplanation: { byType: [{ type: "license", score: 1, threshold: 0.5, status: "passed" }] },
    });
  }

  if (codeIndex) {
    const allText = (payload.codeFiles as CodeFileInput[])
      .map((f) => (typeof f?.content === "string" ? f.content : ""))
      .join("\n");
    const hits = riskScanTextForSecrets(allText);
    if (hits.length) {
      validatorResults.push({
        validatorId: "risk_safety_static_scan",
        validatorVersion: "v0.1",
        status: "rejected",
        metrics: { hits },
        publicExplanation: {
          byType: [{ type: "secrets/safety", score: 1, threshold: 0.1, status: "rejected" }],
          bySegmentsSummary: `Обнаружены риск-паттерны: ${hits.join(", ")}`,
        },
      });
    } else {
      validatorResults.push({
        validatorId: "risk_safety_static_scan",
        validatorVersion: "v0.1",
        status: "passed",
        publicExplanation: { byType: [{ type: "secrets/safety", score: 0, threshold: 0.1, status: "passed" }] },
      });
    }
  } else {
    validatorResults.push({
      validatorId: "risk_safety_static_scan",
      validatorVersion: "v0.1",
      status: "passed",
      publicExplanation: { byType: [{ type: "mvp", score: 0, threshold: 0.1, status: "passed" }] },
    });
  }

  // Plagiarism similarity (exclude other versions of the same submission)
  if (codeIndex) {
    const recent = await pool.query(
      `
        SELECT "id","codeIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "codeIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `,
      [artifactType, submissionId]
    );

    const newBlockSet = new Set<string>();
    for (const f of codeIndex.files) for (const b of f.blocks) newBlockSet.add(b.blockHash);

    let best = {
      refVersionId: null as string | null,
      overallScore: 0,
      maxSegmentScore: 0,
      refBlockSet: new Set<string>(),
    };

    for (const row of recent.rows) {
      const refCodeIndex = jsonbMaybeParse(row.codeIndexJson);
      if (!refCodeIndex || !Array.isArray(refCodeIndex.files)) continue;
      const refIndex = refCodeIndex as CodeIndex;
      const refBlockSet = new Set<string>();
      for (const f of refIndex.files) for (const b of f.blocks) refBlockSet.add(b.blockHash);
      const overallScore = similarityJaccard(newBlockSet, refBlockSet);
      const maxSegmentScore = computeMaxSegmentScore(codeIndex, refIndex);
      if (overallScore > best.overallScore) {
        best = { refVersionId: row.id, overallScore, maxSegmentScore, refBlockSet };
      }
    }

    const overallFlagT = 0.75;
    const overallRejectT = 0.92;
    const maxSegmentFlagT = 0.40;
    const maxSegmentRejectT = 0.55;

    if (best.overallScore >= overallFlagT || best.maxSegmentScore >= maxSegmentFlagT) {
      const overallStatus = best.overallScore >= overallRejectT && best.maxSegmentScore >= maxSegmentRejectT ? "rejected" : "flagged";
      const segments = selectSegmentsForCurrentVersion(codeIndex, best.refBlockSet);

      validatorResults.push({
        validatorId: "plagiarism_code_similarity",
        validatorVersion: "v0.1",
        status: overallStatus,
        metrics: {
          overallScore: best.overallScore,
          maxSegmentScore: best.maxSegmentScore,
          comparedRecentCount: recent.rowCount ?? recent.rows.length,
          excludesSameSubmission: true,
        },
        threshold: { overallFlagT, overallRejectT, maxSegmentFlagT, maxSegmentRejectT },
        evidenceRefs: {
          segments: segments.slice(0, 40).map((s) => ({
            filePath: s.filePath,
            startLine: s.startLine,
            endLine: s.endLine,
            segmentScore: s.segmentScore,
            segmentThreshold: s.segmentThreshold,
          })),
        },
        publicExplanation: {
          byType: [
            { type: "overall_block_jaccard", score: best.overallScore, threshold: overallStatus === "rejected" ? overallRejectT : overallFlagT, status: overallStatus },
            { type: "max_segment_block_overlap", score: best.maxSegmentScore, threshold: overallStatus === "rejected" ? maxSegmentRejectT : maxSegmentFlagT, status: overallStatus },
          ],
          bySegmentsSummary:
            overallStatus === "rejected"
              ? "Сходство критически высокое по мульти-метрикам."
              : "Похоже на заимствование/копирование: в версии найдены участки совпадений выше порогов.",
        },
        resubmitPolicy: {
          allowed: true,
          requiredChangeDescription:
            "Для пересдачи при плагиате необходимо заменить входные компоненты (изменить хотя бы один файл/модуль), после чего проверки выполняются заново.",
          minChangeRules: [{ field: "changedInputFiles", minCount: 1 }],
        },
      });
    } else {
      validatorResults.push({
        validatorId: "plagiarism_code_similarity",
        validatorVersion: "v0.1",
        status: "passed",
        metrics: {
          overallScore: best.overallScore,
          maxSegmentScore: best.maxSegmentScore,
          comparedRecentCount: recent.rowCount ?? recent.rows.length,
          excludesSameSubmission: true,
        },
        publicExplanation: {
          byType: [
            { type: "overall_block_jaccard", score: best.overallScore, threshold: overallFlagT, status: "passed" },
            { type: "max_segment_block_overlap", score: best.maxSegmentScore, threshold: maxSegmentFlagT, status: "passed" },
          ],
        },
      });
    }
  }

  if (mediaIndex) {
    const recentMedia = await pool.query(
      `
        SELECT "id","mediaIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "mediaIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `,
      [artifactType, submissionId]
    );

    let bestMedia = {
      refVersionId: null as string | null,
      overallScore: 0,
      maxSegmentScore: 0,
    };

    for (const row of recentMedia.rows) {
      const ref = jsonbMaybeParse(row.mediaIndexJson) as MediaIndex | null;
      if (!ref || ref.kind !== "planet_media_index_v1" || !Array.isArray(ref.shingles)) continue;
      const fpDup = mediaIndex.fingerprintNormHash === ref.fingerprintNormHash;
      const shingleScore = jaccardStringSets(mediaIndex.shingles, ref.shingles);
      const overallScore = fpDup ? Math.max(shingleScore, 0.99) : shingleScore;
      const maxSegmentScore = fpDup ? 1 : 0;
      if (overallScore > bestMedia.overallScore) {
        bestMedia = { refVersionId: row.id as string, overallScore, maxSegmentScore };
      }
    }

    const mOverallFlagT = 0.75;
    const mOverallRejectT = 0.92;
    const mMaxSegmentFlagT = 0.4;
    const mMaxSegmentRejectT = 0.55;

    if (bestMedia.overallScore >= mOverallFlagT || bestMedia.maxSegmentScore >= mMaxSegmentFlagT) {
      const overallStatus =
        bestMedia.overallScore >= mOverallRejectT && bestMedia.maxSegmentScore >= mMaxSegmentRejectT
          ? "rejected"
          : "flagged";
      validatorResults.push({
        validatorId: "plagiarism_media_similarity",
        validatorVersion: "v0.1",
        status: overallStatus,
        metrics: {
          overallScore: bestMedia.overallScore,
          maxSegmentScore: bestMedia.maxSegmentScore,
          fingerprintMatch: bestMedia.maxSegmentScore >= 1,
          comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
          excludesSameSubmission: true,
          refArtifactVersionId: bestMedia.refVersionId,
        },
        threshold: {
          overallFlagT: mOverallFlagT,
          overallRejectT: mOverallRejectT,
          maxSegmentFlagT: mMaxSegmentFlagT,
          maxSegmentRejectT: mMaxSegmentRejectT,
        },
        evidenceRefs: {
          media: {
            method: "char_5gram_jaccard_plus_fingerprint_hash",
            refArtifactVersionId: bestMedia.refVersionId,
          },
        },
        publicExplanation: {
          byType: [
            {
              type: "media_shingle_jaccard",
              score: bestMedia.overallScore,
              threshold: overallStatus === "rejected" ? mOverallRejectT : mOverallFlagT,
              status: overallStatus,
            },
            {
              type: "fingerprint_id_duplicate",
              score: bestMedia.maxSegmentScore,
              threshold: overallStatus === "rejected" ? mMaxSegmentRejectT : mMaxSegmentFlagT,
              status: overallStatus,
            },
          ],
          bySegmentsSummary:
            overallStatus === "rejected"
              ? "Критически высокое сходство медиа-метаданных или дубликат нормализованного fingerprint."
              : "Похоже на дубликат или сильное пересечение метаданных (шинглы + fingerprint).",
        },
        resubmitPolicy: {
          allowed: true,
          requiredChangeDescription:
            "Измените нормализованный fingerprint и/или метаданные (title/artist/ISRC/externalId), чтобы отличить выпуск.",
          minChangeRules: [{ field: "mediaFingerprintOrDescriptor", minCount: 1 }],
        },
      });
    } else {
      validatorResults.push({
        validatorId: "plagiarism_media_similarity",
        validatorVersion: "v0.1",
        status: "passed",
        metrics: {
          overallScore: bestMedia.overallScore,
          maxSegmentScore: bestMedia.maxSegmentScore,
          comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
          excludesSameSubmission: true,
        },
        publicExplanation: {
          byType: [
            { type: "media_shingle_jaccard", score: bestMedia.overallScore, threshold: mOverallFlagT, status: "passed" },
            { type: "fingerprint_id_duplicate", score: bestMedia.maxSegmentScore, threshold: mMaxSegmentFlagT, status: "passed" },
          ],
        },
      });
    }
  }

  validatorResults.push({
    validatorId: "style_policy_conformance",
    validatorVersion: "v0.1",
    status: "passed",
    publicExplanation: { byType: [{ type: "declared_metadata", score: 1, threshold: 0.5, status: "passed" }] },
  });

  validatorResults.push({
    validatorId: "full_ci_verification_static",
    validatorVersion: "v0.1",
    status: "passed",
    publicExplanation: {
      byType: [{ type: "static-ci-bundle", score: 1, threshold: 0.5, status: "passed" }],
      bySegmentsSummary: "В MVP выполняются статические проверки.",
    },
  });

  const overallStatus = decideOverallStatus(validatorResults as any);
  const evidenceRoot = computeEvidenceRoot({
    inputSetHash,
    generationParamsHash,
    pipelineVersion,
    validatorResults,
    canonicalArtifactHash,
  });

  const artifactVersionId = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO "PlanetArtifactVersion"
        ("id","submissionId","versionNo","ownerId","artifactType","productKey","tier","status","inputSetHash","generationParamsHash","canonicalArtifactHash","evidenceRoot","validatorResultsJson","codeIndexJson","mediaIndexJson","parentVersionId")
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `,
    [
      artifactVersionId,
      submissionId,
      nextVersionNo,
      ownerId,
      artifactType,
      productKey,
      tier,
      overallStatus,
      inputSetHash,
      generationParamsHash,
      canonicalArtifactHash,
      evidenceRoot,
      validatorResults,
      codeIndex ? codeIndex : null,
      mediaIndex ? mediaIndex : null,
      parentVersionIdForInsert,
    ]
  );

  let certificate: any = null;
  if (overallStatus === "passed") {
    const certificateId = crypto.randomUUID();
    const manifest = policyManifest(artifactType, productKey, tier);
    const policyManifestHash = sha256Hex(stableStringify(manifest));
    const signaturePayload = {
      bureau: manifest.bureau,
      policyManifestHash,
      evidenceRoot,
      certificateId,
      artifactVersionId,
    };
    const signature = hmacSha256Hex(productSecretFor(productKey), stableStringify(signaturePayload));

    const publicPayloadJson = {
      certificateId,
      artifactVersionId,
      submissionId,
      status: "issued",
      artifactType,
      productKey,
      tier,
      evidenceRoot,
      policyManifestHash,
      signatureAlgo: "HMAC-SHA256",
    };

    const privatePayloadJson = {
      evidenceRoot,
      validatorResultsJson: validatorResults,
      pipelineVersion,
      signaturePayload,
    };

    await pool.query(
      `
        INSERT INTO "PlanetCertificate"
          ("id","artifactVersionId","ownerId","status","publicPayloadJson","privatePayloadJson","policyManifestHash","evidenceRoot","signature","revokedAt","revokeReason")
        VALUES
          ($1,$2,$3,'issued',$4,$5,$6,$7,$8,NULL,NULL)
      `,
      [
        certificateId,
        artifactVersionId,
        ownerId,
        publicPayloadJson,
        privatePayloadJson,
        policyManifestHash,
        evidenceRoot,
        signature,
      ]
    );

    await pool.query(
      `
        UPDATE "PlanetArtifactVersion"
        SET "certificateId"=$1
        WHERE "id"=$2
      `,
      [certificateId, artifactVersionId]
    );

    certificate = { certificateId, publicPayloadJson, signature };
  }

  return res.json({
    submissionId,
    artifactVersionId,
    status: overallStatus,
    evidenceRoot,
    validators: validatorResults,
    certificate,
  });
});

planetComplianceRouter.get("/submissions/:submissionId/latest", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  await ensurePlanetTables();

  const submissionId = req.params.submissionId;
  const ownerId = auth.sub;
  const r = await pool.query(
    `
      SELECT *
      FROM "PlanetArtifactVersion"
      WHERE "submissionId"=$1 AND "ownerId"=$2
      ORDER BY "versionNo" DESC
      LIMIT 1
    `,
    [submissionId, ownerId]
  );
  if (!r.rows?.[0]) return res.status(404).json({ error: "not found" });
  return res.json({ item: r.rows[0] });
});

// --- CodeSymbol (псевдоним для публичного аудита голосов) ---

function genCodeSymbol(): string {
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

async function getOrCreateActiveCodeSymbol(userId: string): Promise<string> {
  await ensurePlanetTables();
  const cur = await pool.query(
    `
      SELECT "codeSymbol" FROM "PlanetCodeSymbolHistory"
      WHERE "userId"=$1 AND "validUntil" IS NULL
      ORDER BY "validFrom" DESC
      LIMIT 1
    `,
    [userId]
  );
  if (cur.rows?.[0]?.codeSymbol) return cur.rows[0].codeSymbol as string;

  const id = crypto.randomUUID();
  const sym = genCodeSymbol();
  await pool.query(
    `
      INSERT INTO "PlanetCodeSymbolHistory" ("id","userId","codeSymbol","validFrom","validUntil")
      VALUES ($1,$2,$3,NOW(),NULL)
    `,
    [id, userId, sym]
  );
  return sym;
}

planetComplianceRouter.get("/me/code-symbol", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const codeSymbol = await getOrCreateActiveCodeSymbol(auth.sub);
    res.json({ codeSymbol, userId: auth.sub });
  } catch (e: any) {
    res.status(500).json({ error: "code_symbol_failed", details: e?.message });
  }
});

planetComplianceRouter.post("/me/code-symbol/rotate", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    await ensurePlanetTables();
    await pool.query(
      `
      UPDATE "PlanetCodeSymbolHistory"
      SET "validUntil" = NOW()
      WHERE "userId"=$1 AND "validUntil" IS NULL
      `,
      [auth.sub]
    );
    const id = crypto.randomUUID();
    const sym = genCodeSymbol();
    await pool.query(
      `
      INSERT INTO "PlanetCodeSymbolHistory" ("id","userId","codeSymbol","validFrom","validUntil")
      VALUES ($1,$2,$3,NOW(),NULL)
    `,
      [id, auth.sub, sym]
    );
    res.json({
      codeSymbol: sym,
      warning:
        "Прошлые голоса в снапшотах остаются привязаны к прежнему символу на момент голосования; новый символ используется только для новых действий.",
    });
  } catch (e: any) {
    res.status(500).json({ error: "rotate_failed", details: e?.message });
  }
});

function computeVoteLeafHash(v: {
  voteId: string;
  codeSymbol: string;
  artifactVersionId: string;
  categoryId: string;
  score: number;
  createdAt: string;
}) {
  return sha256Hex(
    stableStringify({
      kind: "planet_vote_leaf",
      v: 1,
      voteId: v.voteId,
      codeSymbol: v.codeSymbol,
      artifactVersionId: v.artifactVersionId,
      categoryId: v.categoryId,
      score: v.score,
      createdAt: v.createdAt,
    }),
  );
}

/** Публичная лента сертифицированных работ (витрины, демо, инвесторы). */
planetComplianceRouter.get("/artifacts/recent", async (req, res) => {
  try {
    await ensurePlanetTables();
    const limRaw = req.query?.limit;
    let limit = 8;
    if (typeof limRaw === "string") {
      const n = parseInt(limRaw, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 50) limit = n;
    }
    const sortRaw = req.query?.sort;
    const sort =
      sortRaw === "rating" || sortRaw === "votes" || sortRaw === "created"
        ? sortRaw
        : "created";

    const pfx = safeProductKeyPrefix(req.query?.productKeyPrefix);
    const typeRaw = req.query?.artifactType;
    const artifactType =
      typeof typeRaw === "string" && VALID_ARTIFACT_TYPES.has(typeRaw) ? typeRaw : null;

    const params: unknown[] = [];
    let idx = 1;
    let where = `v."certificateId" IS NOT NULL`;
    if (pfx) {
      params.push(`${pfx}%`);
      where += ` AND s."productKey" LIKE $${idx++}`;
    }
    if (artifactType) {
      params.push(artifactType);
      where += ` AND v."artifactType" = $${idx++}`;
    }
    params.push(limit);

    const orderBy =
      sort === "rating"
        ? `vt."avg" DESC NULLS LAST, v."createdAt" DESC`
        : sort === "votes"
          ? `COALESCE(vt."cnt", 0) DESC, v."createdAt" DESC`
          : `v."createdAt" DESC`;

    const r = await pool.query(
      `
      SELECT
        v."id",
        v."artifactType",
        v."versionNo",
        v."createdAt",
        s."title" AS "submissionTitle",
        s."productKey",
        COALESCE(vt."cnt", 0)::int AS "voteCount",
        vt."avg" AS "voteAverage"
      FROM "PlanetArtifactVersion" v
      JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
      LEFT JOIN (
        SELECT "artifactVersionId",
          COUNT(*)::int AS "cnt",
          ROUND(AVG("score")::numeric, 2) AS "avg"
        FROM "PlanetVote"
        GROUP BY "artifactVersionId"
      ) vt ON vt."artifactVersionId" = v."id"
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx}
      `,
      params
    );

    res.json({
      items: r.rows,
      sort,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "recent failed" });
  }
});

planetComplianceRouter.post("/artifacts/:artifactVersionId/vote", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  await ensurePlanetTables();

  const { artifactVersionId } = req.params;
  const { score, categoryId = "general" } = req.body || {};
  const s = Number(score);
  if (!Number.isFinite(s) || s < 1 || s > 5) {
    return res.status(400).json({ error: "score must be 1..5" });
  }

  const av = await pool.query(
    `SELECT "id","certificateId" FROM "PlanetArtifactVersion" WHERE "id"=$1`,
    [artifactVersionId]
  );
  if (!av.rows?.[0]) return res.status(404).json({ error: "artifact version not found" });
  if (!av.rows[0].certificateId) {
    return res.status(403).json({ error: "voting allowed only for certified (passed) artifacts" });
  }

  const codeSymbol = await getOrCreateActiveCodeSymbol(auth.sub);
  const voteId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const leafHash = computeVoteLeafHash({
    voteId,
    codeSymbol,
    artifactVersionId,
    categoryId: String(categoryId),
    score: s,
    createdAt,
  });

  try {
    await pool.query(
      `
      INSERT INTO "PlanetVote" ("id","userId","artifactVersionId","categoryId","score","codeSymbol","leafHash","createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)
      `,
      [voteId, auth.sub, artifactVersionId, String(categoryId), s, codeSymbol, leafHash, createdAt]
    );
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "already voted for this artifact/category" });
    }
    throw e;
  }

  res.status(201).json({
    voteId,
    codeSymbol,
    leafHash,
    score: s,
    categoryId: String(categoryId),
    artifactVersionId,
    createdAt,
  });
});

planetComplianceRouter.get("/artifacts/:artifactVersionId/public", async (req, res) => {
  await ensurePlanetTables();
  const { artifactVersionId } = req.params;

  const av = await pool.query(
    `
    SELECT v.*, s."title" as "submissionTitle"
    FROM "PlanetArtifactVersion" v
    JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
    WHERE v."id"=$1
    `,
    [artifactVersionId]
  );
  if (!av.rows?.[0]) return res.status(404).json({ error: "not found" });
  const row = av.rows[0];
  if (!row.certificateId) {
    return res.status(404).json({ error: "not published (no certificate)" });
  }

  const cert = await pool.query(`SELECT * FROM "PlanetCertificate" WHERE "id"=$1`, [row.certificateId]);
  const votes = await pool.query(
    `
    SELECT "codeSymbol","score","categoryId","createdAt","leafHash"
    FROM "PlanetVote"
    WHERE "artifactVersionId"=$1
    ORDER BY "createdAt" ASC
    `,
    [artifactVersionId]
  );

  const snap = await pool.query(
    `
    SELECT * FROM "PlanetVoteSnapshot"
    WHERE "artifactVersionId"=$1
    ORDER BY "createdAt" DESC
    LIMIT 1
    `,
    [artifactVersionId]
  );

  const validatorsParsed = jsonbMaybeParse(row.validatorResultsJson);
  const voteRows = votes.rows.map((r: any) => ({
    codeSymbol: r.codeSymbol,
    score: r.score,
    categoryId: r.categoryId,
    createdAt: r.createdAt,
    leafHash: r.leafHash,
  }));

  let parentVersion: Record<string, unknown> | null = null;
  if (row.parentVersionId) {
    const pv = await pool.query(
      `
      SELECT "id","versionNo","status","evidenceRoot","canonicalArtifactHash","certificateId","createdAt"
      FROM "PlanetArtifactVersion"
      WHERE "id"=$1
      `,
      [row.parentVersionId]
    );
    parentVersion = pv.rows?.[0] || null;
  }

  res.json({
    artifact: {
      id: row.id,
      submissionId: row.submissionId,
      submissionTitle: row.submissionTitle,
      artifactType: row.artifactType,
      status: row.status,
      evidenceRoot: row.evidenceRoot,
      versionNo: row.versionNo,
      parentVersionId: row.parentVersionId || null,
    },
    certificate: cert.rows?.[0] || null,
    validators: validatorsParsed,
    complianceSummary: buildPublicComplianceSummary(validatorsParsed),
    versionLineage: {
      parentVersionId: row.parentVersionId || null,
      parentVersion,
    },
    votes: voteRows,
    voteStats: computeVoteStats(voteRows),
    voteStatsByCategory: computeVoteStatsByCategory(voteRows),
    latestSnapshot: snap.rows?.[0] || null,
  });
});

planetComplianceRouter.post("/artifacts/:artifactVersionId/votes/snapshot", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  await ensurePlanetTables();

  const { artifactVersionId } = req.params;
  const { seasonId } = req.body || {};
  if (!seasonId || typeof seasonId !== "string") {
    return res.status(400).json({ error: "seasonId required" });
  }

  const av = await pool.query(
    `SELECT "id","ownerId","certificateId" FROM "PlanetArtifactVersion" WHERE "id"=$1`,
    [artifactVersionId]
  );
  if (!av.rows?.[0]) return res.status(404).json({ error: "artifact not found" });
  if (!av.rows[0].certificateId) {
    return res.status(403).json({ error: "snapshot only for certified artifacts" });
  }
  if (av.rows[0].ownerId !== auth.sub) {
    return res.status(403).json({ error: "only artifact owner can finalize snapshot (MVP)" });
  }

  const voteRows = await pool.query(
    `SELECT "leafHash" FROM "PlanetVote" WHERE "artifactVersionId"=$1 ORDER BY "leafHash" ASC`,
    [artifactVersionId]
  );
  const leaves = voteRows.rows.map((r: any) => r.leafHash as string);
  const { root } = buildMerkleTree(leaves);
  const publicSalt = crypto.randomBytes(16).toString("hex");
  const snapId = crypto.randomUUID();
  const sigPayload = {
    kind: "planet_vote_snapshot",
    artifactVersionId,
    seasonId,
    publicSalt,
    rootHash: root,
    voteCount: leaves.length,
  };
  const signature = hmacSha256Hex(process.env.QSIGN_SECRET || "dev-qsign-secret", stableStringify(sigPayload));

  try {
    await pool.query(
      `
      INSERT INTO "PlanetVoteSnapshot"
        ("id","artifactVersionId","seasonId","publicSalt","rootHash","voteCount","leavesOrderedJson","signature")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [snapId, artifactVersionId, seasonId, publicSalt, root, leaves.length, JSON.stringify(leaves), signature]
    );
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "snapshot for this season already exists" });
    }
    throw e;
  }

  res.status(201).json({
    snapshotId: snapId,
    seasonId,
    artifactVersionId,
    publicSalt,
    rootHash: root,
    voteCount: leaves.length,
    signature,
    sigPayload,
  });
});

planetComplianceRouter.get("/artifacts/:artifactVersionId/votes/snapshot/latest", async (req, res) => {
  await ensurePlanetTables();
  const { artifactVersionId } = req.params;
  const r = await pool.query(
    `
    SELECT * FROM "PlanetVoteSnapshot"
    WHERE "artifactVersionId"=$1
    ORDER BY "createdAt" DESC
    LIMIT 1
    `,
    [artifactVersionId]
  );
  if (!r.rows?.[0]) return res.status(404).json({ error: "no snapshot" });
  res.json({ snapshot: r.rows[0] });
});

planetComplianceRouter.get("/artifacts/:artifactVersionId/votes/my-proof", async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  await ensurePlanetTables();

  const { artifactVersionId } = req.params;
  const seasonId = req.query.seasonId as string;
  if (!seasonId) return res.status(400).json({ error: "seasonId query required" });
  const categoryId =
    typeof req.query.categoryId === "string" && req.query.categoryId.length > 0
      ? req.query.categoryId
      : "general";

  const snapR = await pool.query(
    `
    SELECT * FROM "PlanetVoteSnapshot"
    WHERE "artifactVersionId"=$1 AND "seasonId"=$2
    `,
    [artifactVersionId, seasonId]
  );
  if (!snapR.rows?.[0]) return res.status(404).json({ error: "snapshot not found" });

  const voteR = await pool.query(
    `
    SELECT * FROM "PlanetVote"
    WHERE "artifactVersionId"=$1 AND "userId"=$2 AND "categoryId"=$3
    LIMIT 1
    `,
    [artifactVersionId, auth.sub, categoryId]
  );
  if (!voteR.rows?.[0]) return res.status(404).json({ error: "no vote from this user" });

  const snap = snapR.rows[0];
  const leaves: string[] = jsonbMaybeParse(snap.leavesOrderedJson);
  if (!Array.isArray(leaves)) return res.status(500).json({ error: "invalid snapshot data" });

  const leafHash = voteR.rows[0].leafHash as string;
  const idx = sortedIndex(leaves, leafHash);
  if (idx < 0) return res.status(404).json({ error: "leaf not in snapshot (vote after snapshot?)" });

  const proof = merkleProofForLeaf(leaves, leafHash);
  if (!proof) return res.status(500).json({ error: "proof failed" });

  const ok = verifyMerkleProof(leafHash, proof, snap.rootHash as string, idx);

  res.json({
    seasonId,
    categoryId,
    artifactVersionId,
    rootHash: snap.rootHash,
    publicSalt: snap.publicSalt,
    leafHash,
    leafIndex: idx,
    proof,
    verifyOk: ok,
    codeSymbol: voteR.rows[0].codeSymbol,
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 (Planet v1.2) — public embed surfaces
// ─────────────────────────────────────────────────────────────────────────

// 🔹 GET /certificates/:certId/embed — sanitized JSON for third-party embeds
//    Drops the privatePayloadJson, evidence, and signature internals; surfaces
//    only what's safe to render on someone else's site. CORS open, ETag/304.
planetComplianceRouter.get("/certificates/:certId/embed", planetEmbedRateLimit, async (req, res) => {
  try {
    await ensurePlanetTables();
    const certId = String(req.params.certId);

    // JOIN with the artifact version + submission so the embed can show
    // a human-meaningful title and link back to the public artifact page.
    const result = await pool.query(
      `SELECT c."id", c."status", c."createdAt", c."revokedAt",
              c."revokeReason", c."revokeReasonCode",
              v."id" AS "artifactVersionId", v."artifactType", v."versionNo",
              v."canonicalArtifactHash", s."title" AS "submissionTitle"
       FROM "PlanetCertificate" c
       LEFT JOIN "PlanetArtifactVersion" v ON v."id" = c."artifactVersionId"
       LEFT JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       WHERE c."id" = $1
       LIMIT 1`,
      [certId]
    );

    if (result.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.status(404).json({ id: certId, status: "not_found" });
    }

    const row = result.rows[0] as {
      id: string;
      status: string;
      createdAt: Date | string;
      revokedAt: Date | string | null;
      revokeReason: string | null;
      revokeReasonCode: string | null;
      artifactVersionId: string | null;
      artifactType: string | null;
      versionNo: number | null;
      canonicalArtifactHash: string | null;
      submissionTitle: string | null;
    };

    const createdAtMs =
      row.createdAt instanceof Date
        ? row.createdAt.getTime()
        : new Date(row.createdAt).getTime();
    const revokedAtMs = row.revokedAt
      ? row.revokedAt instanceof Date
        ? row.revokedAt.getTime()
        : new Date(row.revokedAt).getTime()
      : 0;
    const etag = `W/"planet-cert-${row.id}-${createdAtMs}-${revokedAtMs}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(304).end();
    }

    bumpPlanetCertCounters(req, row.id);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: row.id,
      status: row.revokedAt ? "revoked" : row.status,
      title: row.submissionTitle,
      artifactType: row.artifactType,
      versionNo: row.versionNo,
      canonicalArtifactHash: row.canonicalArtifactHash,
      canonicalArtifactHashPrefix: row.canonicalArtifactHash?.slice(0, 16) || null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      revokedAt: row.revokedAt
        ? row.revokedAt instanceof Date
          ? row.revokedAt.toISOString()
          : row.revokedAt
        : null,
      revokeReason: row.revokeReason,
      revokeReasonCode: row.revokeReasonCode,
      artifactVersionId: row.artifactVersionId,
      verifyUrl: row.artifactVersionId
        ? `/planet/artifact/${row.artifactVersionId}`
        : null,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "DB error",
      code: err.code,
      details: err.message,
    });
  }
});

// 🔹 GET /certificates/:certId/badge.svg — shields.io-style badge
//    Two-segment: "AEVION PLANET" + status. Theme via ?theme=dark|light.
//    Flips to red on revoke.
planetComplianceRouter.get("/certificates/:certId/badge.svg", planetEmbedRateLimit, async (req, res) => {
  try {
    await ensurePlanetTables();
    const certId = String(req.params.certId);
    const theme = String(req.query.theme || "dark").toLowerCase() === "light" ? "light" : "dark";

    const result = await pool.query(
      `SELECT c."id", c."createdAt", c."revokedAt", v."artifactType"
       FROM "PlanetCertificate" c
       LEFT JOIN "PlanetArtifactVersion" v ON v."id" = c."artifactVersionId"
       WHERE c."id" = $1 LIMIT 1`,
      [certId]
    );

    function svgShell(left: string, right: string, rightFill: string): string {
      const padX = 8;
      const charW = 6.6;
      const lW = Math.max(70, Math.round(left.length * charW + padX * 2));
      const rW = Math.max(70, Math.round(right.length * charW + padX * 2));
      const total = lW + rW;
      const leftFill = theme === "light" ? "#e2e8f0" : "#1e293b";
      const leftText = theme === "light" ? "#0f172a" : "#e2e8f0";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${escapeXml(
        left
      )}: ${escapeXml(right)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".08"/>
  </linearGradient>
  <rect width="${total}" height="22" rx="4" fill="${leftFill}"/>
  <rect x="${lW}" width="${rW}" height="22" rx="4" fill="${rightFill}"/>
  <rect x="${lW - 4}" width="8" height="22" fill="${rightFill}"/>
  <rect width="${total}" height="22" rx="4" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700">
    <text x="${lW / 2}" y="15" fill="${leftText}">${escapeXml(left)}</text>
    <text x="${lW + rW / 2}" y="15">${escapeXml(right)}</text>
  </g>
</svg>`;
    }

    function escapeXml(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (result.rowCount === 0) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.send(svgShell("AEVION PLANET", "not found", "#94a3b8"));
    }

    const row = result.rows[0] as {
      id: string;
      createdAt: Date | string;
      revokedAt: Date | string | null;
      artifactType: string | null;
    };
    const createdAt =
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const revokedAtMs = row.revokedAt
      ? row.revokedAt instanceof Date
        ? row.revokedAt.getTime()
        : new Date(row.revokedAt).getTime()
      : 0;
    const etag = `W/"planet-badge-${row.id}-${createdAt.getTime()}-${revokedAtMs}-${theme}"`;

    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(304).end();
    }

    const dateLabel = createdAt.toISOString().slice(0, 10);
    bumpPlanetCertCounters(req, row.id);

    if (row.revokedAt) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(svgShell("AEVION PLANET", `REVOKED · ${dateLabel}`, "#dc2626"));
    }

    const right = `${(row.artifactType || "cert").toUpperCase()} · ${dateLabel}`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(svgShell("AEVION PLANET", right, "#0d9488"));
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /transparency — public aggregate. Totals + revoke breakdown
//    + by artifact type. CORS open, 5-min cache. Safe to render on the
//    homepage / pitch deck.
planetComplianceRouter.get("/transparency", planetEmbedRateLimit, async (_req, res) => {
  try {
    await ensurePlanetTables();

    const totalsP = pool.query(
      `SELECT
         COUNT(*)::bigint AS "total",
         COUNT(*) FILTER (WHERE "revokedAt" IS NULL)::bigint AS "active",
         COUNT(*) FILTER (WHERE "revokedAt" IS NOT NULL)::bigint AS "revoked",
         MIN("createdAt") AS "firstAt",
         MAX("createdAt") AS "lastAt"
       FROM "PlanetCertificate"`
    );
    const reasonsP = pool.query(
      `SELECT COALESCE("revokeReasonCode", 'unspecified') AS "code",
              COUNT(*)::bigint AS "count"
       FROM "PlanetCertificate"
       WHERE "revokedAt" IS NOT NULL
       GROUP BY 1
       ORDER BY 2 DESC`
    );
    const typesP = pool.query(
      `SELECT v."artifactType" AS "type", COUNT(*)::bigint AS "count"
       FROM "PlanetCertificate" c
       JOIN "PlanetArtifactVersion" v ON v."id" = c."artifactVersionId"
       GROUP BY 1
       ORDER BY 2 DESC`
    );

    const [totals, reasons, types] = await Promise.all([totalsP, reasonsP, typesP]);
    const t = totals.rows[0] as {
      total: string | number;
      active: string | number;
      revoked: string | number;
      firstAt: Date | string | null;
      lastAt: Date | string | null;
    };

    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        certificates: Number(t.total) || 0,
        active: Number(t.active) || 0,
        revoked: Number(t.revoked) || 0,
        firstIssuedAt: t.firstAt
          ? t.firstAt instanceof Date
            ? t.firstAt.toISOString()
            : t.firstAt
          : null,
        lastIssuedAt: t.lastAt
          ? t.lastAt instanceof Date
            ? t.lastAt.toISOString()
            : t.lastAt
          : null,
      },
      revokesByReasonCode: reasons.rows.map(
        (r: { code: string; count: string | number }) => ({
          code: r.code,
          count: Number(r.count) || 0,
        })
      ),
      certificatesByArtifactType: types.rows.map(
        (r: { type: string; count: string | number }) => ({
          type: r.type,
          count: Number(r.count) || 0,
        })
      ),
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — owner revoke + admin tooling
// ─────────────────────────────────────────────────────────────────────────

// 🔹 POST /certificates/:certId/revoke — owner-only certificate revoke
//    Closed-set reasonCode (excludes admin-takedown). Original cert is kept;
//    revokedAt + revokeReason* are populated. Embed + badge surfaces flip
//    to revoked state. Owner webhooks fire.
planetComplianceRouter.post("/certificates/:certId/revoke", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;

    const certId = String(req.params.certId);
    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const reasonCodeRaw = String(req.body?.reasonCode || "").trim();
    const reasonCode = reasonCodeRaw || null;
    if (reasonCode === "admin-takedown") {
      return res.status(403).json({ error: "admin-takedown is reserved for admins" });
    }
    if (reasonCode && !PLANET_REVOKE_REASON_CODES.has(reasonCode)) {
      return res.status(400).json({
        error: "Unknown reasonCode",
        allowed: Array.from(PLANET_REVOKE_REASON_CODES).filter((c) => c !== "admin-takedown"),
      });
    }

    const owned = await pool.query(
      `SELECT "id", "ownerId", "revokedAt" FROM "PlanetCertificate" WHERE "id" = $1 LIMIT 1`,
      [certId]
    );
    if (owned.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const cert = owned.rows[0] as {
      id: string;
      ownerId: string;
      revokedAt: Date | string | null;
    };
    if (cert.ownerId !== auth.sub) {
      return res.status(403).json({ error: "Not your certificate" });
    }
    if (cert.revokedAt) {
      return res.status(409).json({ error: "Already revoked" });
    }

    const now = new Date().toISOString();
    await pool.query(
      `UPDATE "PlanetCertificate"
         SET "revokedAt" = NOW(),
             "revokeReason" = $2,
             "revokeReasonCode" = $3,
             "revokedBy" = 'owner'
       WHERE "id" = $1`,
      [certId, reason, reasonCode]
    );

    recordPlanetAudit(auth.email || auth.sub || null, "owner.revoke", certId, {
      reasonCode,
      reason,
    });
    triggerPlanetRevokeWebhooks(certId, cert.ownerId, {
      revokedAt: now,
      reasonCode,
      reason,
      revokedBy: "owner",
    });

    res.json({ id: certId, revokedAt: now, reasonCode, revokedBy: "owner" });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /admin/whoami — admin probe (lets the frontend gate views)
planetComplianceRouter.get("/admin/whoami", (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  res.json({
    isAdmin: isPlanetAdmin(auth),
    email: auth.email || null,
    role: auth.role || null,
  });
});

// 🔹 GET /admin/certificates — list all (admin-only). Filters: status, q.
planetComplianceRouter.get("/admin/certificates", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!isPlanetAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status === "active") conds.push(`c."revokedAt" IS NULL`);
    else if (status === "revoked") conds.push(`c."revokedAt" IS NOT NULL`);
    if (q.length >= 2) {
      params.push(`%${q}%`);
      conds.push(`(s."title" ILIKE $${params.length} OR c."id" ILIKE $${params.length})`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const r = await pool.query(
      `SELECT c."id", c."ownerId", c."status", c."createdAt",
              c."revokedAt", c."revokeReason", c."revokeReasonCode", c."revokedBy",
              c."embedFetches", c."lastFetchedAt",
              v."id" AS "artifactVersionId", v."artifactType", v."versionNo",
              s."title" AS "submissionTitle"
       FROM "PlanetCertificate" c
       LEFT JOIN "PlanetArtifactVersion" v ON v."id" = c."artifactVersionId"
       LEFT JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       ${where}
       ORDER BY c."createdAt" DESC
       LIMIT $${params.length}`,
      params
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        id: row.id,
        ownerId: row.ownerId,
        status: row.status,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        revokedAt: row.revokedAt
          ? row.revokedAt instanceof Date
            ? row.revokedAt.toISOString()
            : row.revokedAt
          : null,
        revokeReason: row.revokeReason,
        revokeReasonCode: row.revokeReasonCode,
        revokedBy: row.revokedBy,
        embedFetches: Number(row.embedFetches) || 0,
        lastFetchedAt: row.lastFetchedAt
          ? row.lastFetchedAt instanceof Date
            ? row.lastFetchedAt.toISOString()
            : row.lastFetchedAt
          : null,
        artifactVersionId: row.artifactVersionId,
        artifactType: row.artifactType,
        versionNo: row.versionNo,
        submissionTitle: row.submissionTitle,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /admin/certificates.csv — admin-only CSV export mirroring the
//    on-screen view. RFC 4180 escaping.
planetComplianceRouter.get("/admin/certificates.csv", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!isPlanetAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const conds: string[] = [];
    const params: unknown[] = [];
    if (status === "active") conds.push(`c."revokedAt" IS NULL`);
    else if (status === "revoked") conds.push(`c."revokedAt" IS NOT NULL`);
    if (q.length >= 2) {
      params.push(`%${q}%`);
      conds.push(`(s."title" ILIKE $${params.length} OR c."id" ILIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const r = await pool.query(
      `SELECT c."id", c."ownerId", c."createdAt", c."revokedAt",
              c."revokeReasonCode", c."revokeReason", c."revokedBy",
              c."embedFetches", c."lastFetchedAt",
              v."artifactType", v."versionNo", s."title" AS "submissionTitle"
       FROM "PlanetCertificate" c
       LEFT JOIN "PlanetArtifactVersion" v ON v."id" = c."artifactVersionId"
       LEFT JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
       ${where}
       ORDER BY c."createdAt" DESC`,
      params
    );

    function csvCell(v: unknown): string {
      if (v === null || v === undefined) return "";
      const s = v instanceof Date ? v.toISOString() : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }
    const header = [
      "id",
      "ownerId",
      "title",
      "artifactType",
      "versionNo",
      "createdAt",
      "revokedAt",
      "revokeReasonCode",
      "revokeReason",
      "revokedBy",
      "embedFetches",
      "lastFetchedAt",
    ].join(",");
    const lines = r.rows.map((row: any) =>
      [
        row.id,
        row.ownerId,
        row.submissionTitle,
        row.artifactType,
        row.versionNo,
        row.createdAt,
        row.revokedAt,
        row.revokeReasonCode,
        row.revokeReason,
        row.revokedBy,
        row.embedFetches,
        row.lastFetchedAt,
      ]
        .map(csvCell)
        .join(",")
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="planet-certificates-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.send([header, ...lines].join("\r\n"));
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 POST /admin/certificates/:certId/revoke — admin force-revoke.
//    Bypasses ownership check. Audit-logged. Webhooks fire to the owner.
planetComplianceRouter.post("/admin/certificates/:certId/revoke", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!isPlanetAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const certId = String(req.params.certId);
    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const reasonCodeRaw = String(req.body?.reasonCode || "admin-takedown").trim();
    const reasonCode = reasonCodeRaw || "admin-takedown";
    if (!PLANET_REVOKE_REASON_CODES.has(reasonCode)) {
      return res.status(400).json({
        error: "Unknown reasonCode",
        allowed: Array.from(PLANET_REVOKE_REASON_CODES),
      });
    }

    const cur = await pool.query(
      `SELECT "id", "ownerId", "revokedAt" FROM "PlanetCertificate" WHERE "id" = $1 LIMIT 1`,
      [certId]
    );
    if (cur.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const row = cur.rows[0] as { id: string; ownerId: string; revokedAt: Date | string | null };
    if (row.revokedAt) return res.status(409).json({ error: "Already revoked" });

    const now = new Date().toISOString();
    await pool.query(
      `UPDATE "PlanetCertificate"
         SET "revokedAt" = NOW(),
             "revokeReason" = $2,
             "revokeReasonCode" = $3,
             "revokedBy" = 'admin'
       WHERE "id" = $1`,
      [certId, reason, reasonCode]
    );

    console.warn(
      `[planet] admin force-revoke id=${certId} by=${auth.email || auth.sub} code=${reasonCode}`
    );
    recordPlanetAudit(auth.email || auth.sub || null, "admin.revoke", certId, {
      reasonCode,
      reason,
      ownerId: row.ownerId,
    });
    triggerPlanetRevokeWebhooks(certId, row.ownerId, {
      revokedAt: now,
      reasonCode,
      reason,
      revokedBy: "admin",
    });

    res.json({ id: certId, revokedAt: now, reasonCode, revokedBy: "admin" });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 POST /admin/certificates/revoke-bulk — admin bulk force-revoke.
//    Up to 200 ids per request. Returns per-bucket partition.
const PLANET_BULK_LIMIT = 200;
planetComplianceRouter.post("/admin/certificates/revoke-bulk", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!isPlanetAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x: unknown) => String(x)) : [];
    if (ids.length === 0) return res.status(400).json({ error: "ids[] required" });
    if (ids.length > PLANET_BULK_LIMIT) {
      return res.status(400).json({ error: `at most ${PLANET_BULK_LIMIT} ids per request` });
    }
    const reason = String(req.body?.reason || "").slice(0, 500) || null;
    const reasonCodeRaw = String(req.body?.reasonCode || "admin-takedown").trim();
    const reasonCode = reasonCodeRaw || "admin-takedown";
    if (!PLANET_REVOKE_REASON_CODES.has(reasonCode)) {
      return res.status(400).json({ error: "Unknown reasonCode" });
    }

    // Snapshot current state so we can partition input.
    const existing = await pool.query(
      `SELECT "id", "ownerId", "revokedAt"
       FROM "PlanetCertificate"
       WHERE "id" = ANY($1::text[])`,
      [ids]
    );
    const known = new Map<string, { ownerId: string; revokedAt: Date | string | null }>();
    for (const r of existing.rows as { id: string; ownerId: string; revokedAt: any }[]) {
      known.set(r.id, { ownerId: r.ownerId, revokedAt: r.revokedAt });
    }
    const notFound: string[] = [];
    const alreadyRevoked: string[] = [];
    const toRevoke: { id: string; ownerId: string }[] = [];
    for (const id of ids) {
      const k = known.get(id);
      if (!k) notFound.push(id);
      else if (k.revokedAt) alreadyRevoked.push(id);
      else toRevoke.push({ id, ownerId: k.ownerId });
    }

    let revoked: string[] = [];
    if (toRevoke.length > 0) {
      const targetIds = toRevoke.map((x) => x.id);
      const upd = await pool.query(
        `UPDATE "PlanetCertificate"
           SET "revokedAt" = NOW(),
               "revokeReason" = $2,
               "revokeReasonCode" = $3,
               "revokedBy" = 'admin'
         WHERE "id" = ANY($1::text[]) AND "revokedAt" IS NULL
         RETURNING "id"`,
        [targetIds, reason, reasonCode]
      );
      revoked = (upd.rows as { id: string }[]).map((r) => r.id);
    }

    const now = new Date().toISOString();
    recordPlanetAudit(auth.email || auth.sub || null, "admin.bulk-revoke", null, {
      reasonCode,
      reason,
      input: ids,
      revoked,
      alreadyRevoked,
      notFound,
    });
    for (const r of toRevoke) {
      if (revoked.includes(r.id)) {
        triggerPlanetRevokeWebhooks(r.id, r.ownerId, {
          revokedAt: now,
          reasonCode,
          reason,
          revokedBy: "admin",
        });
      }
    }

    res.json({ revoked, alreadyRevoked, notFound, reasonCode });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /admin/audit — paginated audit reader.
planetComplianceRouter.get("/admin/audit", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!isPlanetAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
    const action = String(req.query.action || "").trim();
    const targetId = String(req.query.targetId || "").trim();

    const conds: string[] = [];
    const params: unknown[] = [];
    if (action) {
      params.push(action);
      conds.push(`"action" = $${params.length}`);
    }
    if (targetId) {
      params.push(targetId);
      conds.push(`"targetId" = $${params.length}`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const r = await pool.query(
      `SELECT id, actor, action, "targetId", payload, at
       FROM "PlanetAuditLog"
       ${where}
       ORDER BY "at" DESC
       LIMIT $${params.length}`,
      params
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      filter: { action: action || null, targetId: targetId || null, limit },
      items: r.rows.map(
        (row: { id: string; actor: string | null; action: string; targetId: string | null; payload: unknown; at: Date | string }) => ({
          id: row.id,
          actor: row.actor,
          action: row.action,
          targetId: row.targetId,
          payload: row.payload,
          at: row.at instanceof Date ? row.at.toISOString() : row.at,
        })
      ),
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /admin/sources — top embed source hosts across all certificates.
planetComplianceRouter.get("/admin/sources", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!isPlanetAdmin(auth)) return res.status(403).json({ error: "Admin role required" });

    const daysRaw = parseInt(String(req.query.days || "30"), 10);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;

    const r = await pool.query(
      `SELECT "sourceHost",
              SUM("fetches")::bigint AS total,
              COUNT(DISTINCT "certificateId")::int AS certificates
       FROM "PlanetCertFetchSource"
       WHERE "day" >= (CURRENT_DATE - ($1::int * INTERVAL '1 day'))
       GROUP BY "sourceHost"
       ORDER BY total DESC
       LIMIT $2`,
      [days, limit]
    );
    const rows = r.rows.map(
      (row: { sourceHost: string; total: string | number; certificates: number }) => ({
        host: row.sourceHost,
        totalFetches: Number(row.total) || 0,
        uniqueCertificates: Number(row.certificates) || 0,
      })
    );
    const totalFetches = rows.reduce(
      (acc: number, x: { totalFetches: number }) => acc + x.totalFetches,
      0
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      days,
      uniqueHosts: rows.length,
      totalFetches,
      hosts: rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — owner-configured outgoing webhooks
// ─────────────────────────────────────────────────────────────────────────

const PLANET_WEBHOOK_CAP = 10;

// 🔹 GET /webhooks — list mine. Secret redacted to a 6-char prefix.
planetComplianceRouter.get("/webhooks", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT "id", "url", "secret", "createdAt", "lastDeliveredAt", "lastFailedAt", "lastError"
       FROM "PlanetWebhook"
       WHERE "ownerUserId" = $1
       ORDER BY "createdAt" DESC`,
      [auth.sub]
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      cap: PLANET_WEBHOOK_CAP,
      items: r.rows.map((row: any) => ({
        id: row.id,
        url: row.url,
        secretPrefix: typeof row.secret === "string" ? row.secret.slice(0, 6) : "",
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        lastDeliveredAt: row.lastDeliveredAt
          ? row.lastDeliveredAt instanceof Date
            ? row.lastDeliveredAt.toISOString()
            : row.lastDeliveredAt
          : null,
        lastFailedAt: row.lastFailedAt
          ? row.lastFailedAt instanceof Date
            ? row.lastFailedAt.toISOString()
            : row.lastFailedAt
          : null,
        lastError: row.lastError,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 POST /webhooks — add. Returns the secret ONCE (never displayed again).
planetComplianceRouter.post("/webhooks", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    const url = String(req.body?.url || "").trim();
    if (!url || url.length > 500) {
      return res.status(400).json({ error: "url required (≤ 500 chars)" });
    }
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "url must start with http:// or https://" });
    }
    const cnt = await pool.query(
      `SELECT COUNT(*)::int AS c FROM "PlanetWebhook" WHERE "ownerUserId" = $1`,
      [auth.sub]
    );
    if ((cnt.rows[0] as { c: number }).c >= PLANET_WEBHOOK_CAP) {
      return res.status(400).json({ error: `webhook cap reached (${PLANET_WEBHOOK_CAP}/owner)` });
    }
    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(16).toString("hex");
    await pool.query(
      `INSERT INTO "PlanetWebhook" ("id", "ownerUserId", "url", "secret") VALUES ($1, $2, $3, $4)`,
      [id, auth.sub, url, secret]
    );
    res.status(201).json({ id, url, secret });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 DELETE /webhooks/:id — owner-scoped. 404-mask "not yours" identically.
planetComplianceRouter.delete("/webhooks/:id", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const r = await pool.query(
      `DELETE FROM "PlanetWebhook" WHERE "id" = $1 AND "ownerUserId" = $2`,
      [id, auth.sub]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ id, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 PATCH /webhooks/:id — edit URL without rotating secret.
planetComplianceRouter.patch("/webhooks/:id", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const url = String(req.body?.url || "").trim();
    if (!url || url.length > 500) {
      return res.status(400).json({ error: "url required (≤ 500 chars)" });
    }
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "url must start with http:// or https://" });
    }
    const r = await pool.query(
      `UPDATE "PlanetWebhook"
         SET "url" = $1
       WHERE "id" = $2 AND "ownerUserId" = $3
       RETURNING "id", "url"`,
      [url, id, auth.sub]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ id: r.rows[0].id, url: r.rows[0].url, updated: true });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 GET /webhooks/:id/deliveries — owner-scoped delivery log.
planetComplianceRouter.get("/webhooks/:id/deliveries", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    const id = String(req.params.id);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const own = await pool.query(
      `SELECT "id" FROM "PlanetWebhook" WHERE "id" = $1 AND "ownerUserId" = $2 LIMIT 1`,
      [id, auth.sub]
    );
    if (own.rowCount === 0) return res.status(404).json({ error: "Not found" });

    const r = await pool.query(
      `SELECT "id", "certificateId", "eventType", "requestBody", "statusCode", "ok", "error", "deliveredAt", "isRetry"
       FROM "PlanetWebhookDelivery"
       WHERE "webhookId" = $1
       ORDER BY "deliveredAt" DESC
       LIMIT $2`,
      [id, limit]
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      webhookId: id,
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        id: row.id,
        certificateId: row.certificateId,
        eventType: row.eventType,
        requestBody: row.requestBody,
        statusCode: row.statusCode,
        ok: row.ok,
        error: row.error,
        deliveredAt:
          row.deliveredAt instanceof Date ? row.deliveredAt.toISOString() : row.deliveredAt,
        isRetry: row.isRetry,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

// 🔹 POST /webhooks/:id/retry/:deliveryId — re-issue original body.
planetComplianceRouter.post("/webhooks/:id/retry/:deliveryId", async (req, res) => {
  try {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth) return;
    const webhookId = String(req.params.id);
    const deliveryId = String(req.params.deliveryId);

    const lookup = await pool.query(
      `SELECT w."id" AS "webhookId", w."url", w."secret",
              d."requestBody", d."eventType", d."certificateId"
       FROM "PlanetWebhook" w
       JOIN "PlanetWebhookDelivery" d ON d."webhookId" = w."id"
       WHERE w."id" = $1 AND w."ownerUserId" = $2 AND d."id" = $3
       LIMIT 1`,
      [webhookId, auth.sub, deliveryId]
    );
    if (lookup.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const row = lookup.rows[0] as {
      webhookId: string;
      url: string;
      secret: string;
      requestBody: string;
      eventType: string;
      certificateId: string | null;
    };

    const result = await attemptPlanetWebhookDelivery({
      webhookId: row.webhookId,
      url: row.url,
      secret: row.secret,
      body: row.requestBody,
      eventType: row.eventType,
      certificateId: row.certificateId,
      isRetry: true,
    });
    res.json({
      webhookId,
      retriedDeliveryId: deliveryId,
      ok: result.ok,
      statusCode: result.statusCode,
      error: result.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", code: err.code, details: err.message });
  }
});

