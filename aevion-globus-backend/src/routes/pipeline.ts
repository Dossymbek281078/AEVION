import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import {
  areDemoEndpointsEnabled,
  getQSignSecret,
  HMAC_KEY_VERSION,
  SHAMIR_SHARDS,
  SHAMIR_THRESHOLD,
} from "../config/qright";
import { QRightError, type QRightErrorCode } from "../lib/errors/QRightError";
import { canonicalContentHash } from "../lib/contentHash";
import {
  combineAndVerify,
  generateEphemeralEd25519,
  splitAndAuthenticate,
  wipeBuffer,
  type AuthenticatedShard,
} from "../lib/shamir/shield";
import {
  clientIp,
  createInMemoryRateLimiter,
} from "../lib/rateLimit/inMemoryWindow";

export const pipelineRouter = Router();
const pool = getPool();

const demoRateLimiter = createInMemoryRateLimiter({ max: 10 });
// 30 / мин / IP — достаточно для легитимного клиента-проверяющего, но
// отсекает грубый перебор shard-комбинаций (brute-force Lagrange probe).
const reconstructRateLimiter = createInMemoryRateLimiter({ max: 30 });

interface QSignPayload {
  objectId: string;
  title: string;
  contentHash: string;
  signedAt: string; // ISO-8601, хранится в БД для последующей верификации
}

function computeQSignHmac(payload: QSignPayload): string {
  const raw = JSON.stringify({
    objectId: payload.objectId,
    title: payload.title,
    contentHash: payload.contentHash,
    signedAt: payload.signedAt,
  });
  return crypto
    .createHmac("sha256", getQSignSecret())
    .update(raw)
    .digest("hex");
}

/* ── Ensure tables ── */
let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QRightObject" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "contentHash" TEXT NOT NULL,
      "ownerName" TEXT,
      "ownerEmail" TEXT,
      "ownerUserId" TEXT,
      "country" TEXT,
      "city" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "country" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "city" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QuantumShield" (
      "id" TEXT PRIMARY KEY,
      "objectId" TEXT,
      "objectTitle" TEXT,
      "algorithm" TEXT NOT NULL DEFAULT 'Shamir''s Secret Sharing + Ed25519',
      "threshold" INT NOT NULL DEFAULT 2,
      "totalShards" INT NOT NULL DEFAULT 3,
      "shards" TEXT NOT NULL,
      "signature" TEXT,
      "publicKey" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "legacy" BOOLEAN NOT NULL DEFAULT false;`,
  );
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "hmac_key_version" INTEGER NOT NULL DEFAULT 1;`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "IPCertificate" (
      "id" TEXT PRIMARY KEY,
      "objectId" TEXT NOT NULL,
      "shieldId" TEXT,
      "title" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "authorName" TEXT,
      "authorEmail" TEXT,
      "country" TEXT,
      "city" TEXT,
      "contentHash" TEXT NOT NULL,
      "signatureHmac" TEXT NOT NULL,
      "signatureEd25519" TEXT,
      "publicKeyEd25519" TEXT,
      "shardCount" INT DEFAULT 3,
      "shardThreshold" INT DEFAULT 2,
      "algorithm" TEXT NOT NULL,
      "legalBasis" JSONB NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "protectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "verifiedCount" INT NOT NULL DEFAULT 0,
      "lastVerifiedAt" TIMESTAMPTZ
    );
  `);
  // v2: signedAt хранит момент, вошедший в HMAC-пейлоад; без него
  // GET /verify/:certId не может пересчитать signatureHmac.
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMPTZ;`,
  );

  tablesReady = true;
}

/* ── Legal basis references ── */
function getLegalBasis(country?: string | null): Record<string, unknown> {
  // TODO: Disclaimer text below is pending rewrite — do not edit without the
  // updated wording from product/legal. Target line: `disclaimer` key in this
  // object (see `pipeline.ts:getLegalBasis`).
  const basis: Record<string, unknown> = {
    framework: "AEVION Digital IP Bureau",
    version: "1.0",
    type: "Proof of Prior Art / Proof of Existence",
    description:
      "This certificate constitutes cryptographic proof that the described intellectual property existed at the recorded timestamp, authored by the named party. It serves as evidence of prior art and authorship under international copyright frameworks.",
    international: [
      {
        name: "Berne Convention for the Protection of Literary and Artistic Works",
        article: "Article 5(2)",
        principle:
          "Copyright protection is automatic upon creation — no registration required. This certificate provides timestamp proof of creation.",
        members: "181 member states",
        url: "https://www.wipo.int/treaties/en/ip/berne/",
      },
      {
        name: "WIPO Copyright Treaty (WCT)",
        year: 1996,
        principle:
          "Extends Berne Convention to digital works including software, databases, and digital content.",
        url: "https://www.wipo.int/treaties/en/ip/wct/",
      },
      {
        name: "TRIPS Agreement (WTO)",
        principle:
          "Establishes minimum standards for IP protection across 164 WTO member states.",
        url: "https://www.wto.org/english/tratop_e/trips_e/trips_e.htm",
      },
    ],
    digitalSignature: [
      {
        name: "eIDAS Regulation (EU)",
        number: "910/2014",
        principle:
          "Advanced electronic signatures have legal effect equivalent to handwritten signatures.",
        scope: "European Union",
      },
      {
        name: "ESIGN Act (USA)",
        year: 2000,
        principle:
          "Electronic signatures have the same legal standing as handwritten signatures.",
        scope: "United States",
      },
      {
        name: "Law of Republic of Kazakhstan on Electronic Digital Signature",
        number: "370-II",
        year: 2003,
        principle:
          "Electronic digital signatures are legally equivalent to handwritten signatures.",
        scope: "Kazakhstan",
      },
    ],
    cryptography: {
      hashAlgorithm: "SHA-256 (NIST FIPS 180-4)",
      signatureAlgorithm: "HMAC-SHA256 + Ed25519 (RFC 8032)",
      keyProtection: "Shamir's Secret Sharing (2-of-3 threshold, GF(256))",
      timestampIntegrity: "Server-side UTC timestamp at moment of registration",
    },
    disclaimer:
      "This certificate is issued by AEVION Digital IP Bureau as cryptographic proof of existence and authorship at the recorded time. It does not constitute a patent, trademark, or government-issued copyright registration. It serves as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.",
  };

  if (country) {
    const c = country.toLowerCase();
    if (c === "kazakhstan" || c === "kz" || c === "казахстан") {
      (basis as { national?: unknown }).national = {
        name: "Law of Republic of Kazakhstan 'On Copyright and Related Rights'",
        number: "6-II",
        article: "Article 6",
        principle:
          "Copyright arises from the moment of creation of the work. Registration is not required for protection.",
        additionalNote:
          "This certificate provides timestamped cryptographic proof recognized under Kazakhstan law on electronic documents and digital signatures.",
      };
    }
  }

  return basis;
}

/* ── Resolve auth user ── */
async function resolveUser(
  req: Request,
): Promise<{ userId: string | null; name: string | null; email: string | null }> {
  const auth = verifyBearerOptional(req);
  let name: string | null = null;
  let email: string | null = null;
  let userId: string | null = null;

  if (auth) {
    await ensureUsersTable(pool);
    const u = await pool.query(
      `SELECT "id","name","email" FROM "AEVIONUser" WHERE "id"=$1`,
      [auth.sub],
    );
    const row = u.rows?.[0];
    if (row) {
      userId = row.id;
      name = row.name;
      email = row.email;
    }
  }

  return { userId, name, email };
}

/**
 * POST /api/pipeline/protect
 *
 * One-click IP protection:
 *   1. Register in QRight (SHA-256 hash)
 *   2. Sign with QSign (HMAC-SHA256)
 *   3. Create Quantum Shield (Ed25519 + real 2-of-3 Shamir SSS over GF(256))
 *   4. Issue IP Certificate with legal basis
 *
 * Body: { title, description, kind, ownerName?, ownerEmail?, country?, city? }
 */
pipelineRouter.post("/protect", async (req, res) => {
  try {
    await ensureTables();

    const { title, description, kind, ownerName, ownerEmail, country, city } =
      req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "title and description are required" });
    }

    const user = await resolveUser(req);
    const authorName = ownerName || user.name || null;
    const authorEmail = ownerEmail || user.email || null;
    const authorUserId = user.userId || null;

    // Pre-flight: проверяем env, чтобы не делать частичную запись в БД
    // ради того, чтобы упасть на QSign-шаге.
    getQSignSecret();

    /* ── Pre-compute: canonical content hash (NFC + sorted keys) ── */
    const effectiveKind = kind || "other";
    const contentHash = canonicalContentHash({
      title,
      description,
      kind: effectiveKind,
      country,
      city,
    });

    /* ── Pre-compute: QSign HMAC (signedAt stored for verify re-check) ── */
    const objectId = crypto.randomUUID();
    const signedAt = new Date().toISOString();
    const protectedAt = signedAt; // тот же момент; храним раздельно для ясности
    const signatureHmac = computeQSignHmac({
      objectId,
      title,
      contentHash,
      signedAt,
    });

    /* ── Pre-compute: Ed25519 sign + Shamir split (no DB yet) ── */
    const shieldId = "qs-" + crypto.randomBytes(8).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex, publicKeyRawHex } =
      generateEphemeralEd25519();

    const dataToProtect = JSON.stringify({
      objectId,
      title,
      contentHash,
      signatureHmac,
      publicKeyRawHex,
      signedAt,
    });

    const pkcs8Prefix = Buffer.from(
      "302e020100300506032b657004220420",
      "hex",
    );
    const pkcs8Signing = Buffer.concat([pkcs8Prefix, privateKeyRaw]);
    const signingKey = crypto.createPrivateKey({
      key: pkcs8Signing,
      format: "der",
      type: "pkcs8",
    });
    const signatureEd25519 = crypto
      .sign(null, Buffer.from(dataToProtect), signingKey)
      .toString("hex");
    wipeBuffer(pkcs8Signing);

    let shards: AuthenticatedShard[];
    try {
      shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    } finally {
      wipeBuffer(privateKeyRaw);
    }

    /* ── All 4 DB writes in a single transaction ── */
    const certId = "cert-" + crypto.randomBytes(8).toString("hex");
    const legalBasis = getLegalBasis(country);
    const algorithm =
      "SHA-256 + HMAC-SHA256 + Ed25519 + Shamir's Secret Sharing (2-of-3)";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO "QRightObject" ("id","title","description","kind","contentHash","ownerName","ownerEmail","ownerUserId","country","city","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        [
          objectId,
          title,
          description,
          effectiveKind,
          contentHash,
          authorName,
          authorEmail,
          authorUserId,
          country || null,
          city || null,
        ],
      );

      await client.query(
        `INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","legacy","hmac_key_version","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',false,$10,NOW())`,
        [
          shieldId,
          objectId,
          title,
          "Shamir's Secret Sharing + Ed25519",
          SHAMIR_THRESHOLD,
          SHAMIR_SHARDS,
          JSON.stringify(shards),
          signatureEd25519,
          publicKeySpkiHex,
          HMAC_KEY_VERSION,
        ],
      );

      await client.query(
        `INSERT INTO "IPCertificate" ("id","objectId","shieldId","title","kind","description","authorName","authorEmail","country","city","contentHash","signatureHmac","signatureEd25519","publicKeyEd25519","shardCount","shardThreshold","algorithm","legalBasis","status","protectedAt","signedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'active',$19,$20)`,
        [
          certId,
          objectId,
          shieldId,
          title,
          effectiveKind,
          description,
          authorName,
          authorEmail,
          country || null,
          city || null,
          contentHash,
          signatureHmac,
          signatureEd25519,
          publicKeySpkiHex,
          SHAMIR_SHARDS,
          SHAMIR_THRESHOLD,
          algorithm,
          JSON.stringify(legalBasis),
          protectedAt,
          signedAt,
        ],
      );

      await client.query("COMMIT");
    } catch (txErr) {
      try {
        await client.query("ROLLBACK");
      } catch (rbErr) {
        console.error(
          "[Pipeline] ROLLBACK failed:",
          rbErr instanceof Error ? rbErr.message : String(rbErr),
        );
      }
      throw txErr;
    } finally {
      client.release();
    }

    /* ── Response ── */
    const certificate = {
      id: certId,
      objectId,
      shieldId,
      title,
      kind: effectiveKind,
      description,
      author: authorName || "Anonymous",
      email: authorEmail || null,
      location: [city, country].filter(Boolean).join(", ") || null,
      contentHash,
      signatureHmac,
      signatureEd25519: signatureEd25519.slice(0, 64) + "...",
      publicKey: publicKeySpkiHex.slice(0, 32) + "...",
      shards: SHAMIR_SHARDS,
      threshold: SHAMIR_THRESHOLD,
      algorithm,
      legalBasis: {
        framework: legalBasis.framework,
        type: legalBasis.type,
        international: (legalBasis.international as Array<{ name: string }>).map(
          (l) => l.name,
        ),
        disclaimer: legalBasis.disclaimer,
      },
      protectedAt,
      status: "active",
      verifyUrl: `https://aevion.vercel.app/verify/${certId}`,
    };

    res.status(201).json({
      success: true,
      message:
        "Your work is now protected with 3-layer cryptographic security and legal backing",
      qright: {
        id: objectId,
        title,
        contentHash,
        createdAt: protectedAt,
      },
      qsign: { signature: signatureHmac, algo: "HMAC-SHA256" },
      shield: {
        id: shieldId,
        signature: signatureEd25519.slice(0, 64) + "...",
        publicKey: publicKeySpkiHex.slice(0, 32) + "...",
        shards: SHAMIR_SHARDS,
        threshold: SHAMIR_THRESHOLD,
        hmacKeyVersion: HMAC_KEY_VERSION,
      },
      certificate,
    });
  } catch (err: unknown) {
    if (err instanceof QRightError) {
      console.error(
        `[Pipeline] protect ${err.code}: ${err.message}`,
      );
      return res
        .status(err.httpStatus)
        .json({ error: err.message, code: err.code });
    }
    const msg = err instanceof Error ? err.message : "pipeline failed";
    console.error("[Pipeline] protect error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/pipeline/reconstruct
 *
 * Verifies shard ownership and integrity by reconstructing the Ed25519 private
 * key via Lagrange interpolation, signing a probe message, and checking the
 * signature against the stored public key. Never returns the private key.
 */
interface ReconstructBody {
  shieldId?: unknown;
  shards?: unknown;
}

function isShardInput(v: unknown): v is {
  index: number;
  sssShare: string;
  hmac: string;
  hmacKeyVersion: number;
} {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.index === "number" &&
    typeof s.sssShare === "string" &&
    typeof s.hmac === "string" &&
    typeof s.hmacKeyVersion === "number"
  );
}

pipelineRouter.post("/reconstruct", async (req, res) => {
  const ip = clientIp({ ip: req.ip, headers: req.headers });
  const rl = reconstructRateLimiter.check(ip);
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
    return res.status(429).json({
      valid: false,
      reconstructed: false,
      reason: "RATE_LIMITED" satisfies QRightErrorCode,
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const body = req.body as ReconstructBody;
  const shieldId = typeof body.shieldId === "string" ? body.shieldId : null;
  const shardsInput = Array.isArray(body.shards) ? body.shards : [];

  if (!shieldId) {
    return res.status(400).json({
      valid: false,
      reconstructed: false,
      reason: "INVALID_SHARD_FORMAT" satisfies QRightErrorCode,
    });
  }

  if (shardsInput.length < SHAMIR_THRESHOLD) {
    console.log(
      `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=invalid reason=INSUFFICIENT_SHARDS`,
    );
    return res.status(400).json({
      valid: false,
      reconstructed: false,
      reason: "INSUFFICIENT_SHARDS" satisfies QRightErrorCode,
    });
  }

  for (const s of shardsInput) {
    if (!isShardInput(s)) {
      console.log(
        `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=invalid reason=INVALID_SHARD_FORMAT`,
      );
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: "INVALID_SHARD_FORMAT" satisfies QRightErrorCode,
      });
    }
  }

  try {
    await ensureTables();

    const { rows } = await pool.query(
      `SELECT "publicKey","legacy" FROM "QuantumShield" WHERE "id" = $1`,
      [shieldId],
    );

    if (rows.length === 0) {
      console.log(
        `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=invalid reason=SHIELD_NOT_FOUND`,
      );
      return res.status(404).json({
        valid: false,
        reconstructed: false,
        reason: "SHIELD_NOT_FOUND" satisfies QRightErrorCode,
      });
    }

    const row = rows[0] as { publicKey: string | null; legacy: boolean };

    if (row.legacy === true) {
      console.log(
        `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=invalid reason=LEGACY_RECORD`,
      );
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: "LEGACY_RECORD" satisfies QRightErrorCode,
      });
    }

    if (!row.publicKey) {
      console.log(
        `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=invalid reason=RECONSTRUCTION_FAILED`,
      );
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: "RECONSTRUCTION_FAILED" satisfies QRightErrorCode,
      });
    }

    const result = combineAndVerify(
      shardsInput as Parameters<typeof combineAndVerify>[0],
      shieldId,
      row.publicKey,
    );

    if (!result.ok) {
      console.log(
        `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=invalid reason=${result.reason}`,
      );
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: result.reason ?? "RECONSTRUCTION_FAILED",
      });
    }

    console.log(
      `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=valid`,
    );
    return res.status(200).json({
      valid: true,
      reconstructed: true,
      shieldId,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    if (err instanceof QRightError) {
      console.log(
        `[Reconstruct] shieldId=${shieldId} shardCount=${shardsInput.length} result=error reason=${err.code}`,
      );
      return res
        .status(err.httpStatus)
        .json({ valid: false, reconstructed: false, reason: err.code });
    }
    const msg = err instanceof Error ? err.message : "reconstruct failed";
    console.error(
      `[Reconstruct] shieldId=${shieldId} unexpected error: ${msg}`,
    );
    return res
      .status(500)
      .json({ valid: false, reconstructed: false, reason: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/pipeline/demo-generate
 *
 * Investor/press demo: creates an ephemeral Ed25519 keypair, splits it via
 * real Shamir SSS (2-of-3), authenticates shards with HMAC, and returns the
 * entire payload in the response. Nothing persisted.
 *
 * Gated by ENABLE_DEMO_ENDPOINTS env (default off). Rate-limited 10 req/min/IP.
 */
pipelineRouter.post("/demo-generate", (req, res) => {
  if (!areDemoEndpointsEnabled()) {
    return res.status(404).json({
      error: "Not Found",
      reason: "DEMO_DISABLED" satisfies QRightErrorCode,
    });
  }

  const ip = clientIp({ ip: req.ip, headers: req.headers });
  const rl = demoRateLimiter.check(ip);
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
    return res.status(429).json({
      error: "Too Many Requests",
      reason: "RATE_LIMITED" satisfies QRightErrorCode,
      retryAfterMs: rl.retryAfterMs,
    });
  }

  try {
    res.setHeader("X-Demo", "true");

    const shieldId = "qs-demo-" + crypto.randomBytes(8).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex, publicKeyRawHex } =
      generateEphemeralEd25519();

    let shards: AuthenticatedShard[];
    try {
      shards = splitAndAuthenticate(privateKeyRaw, shieldId);
    } finally {
      wipeBuffer(privateKeyRaw);
    }

    return res.status(200).json({
      demo: true,
      ephemeral: true,
      shieldId,
      publicKeySpkiHex,
      publicKeyRawHex,
      threshold: SHAMIR_THRESHOLD,
      totalShards: SHAMIR_SHARDS,
      hmacKeyVersion: HMAC_KEY_VERSION,
      shards,
      note: "This shield is NOT persisted. Reconstruction against /api/pipeline/reconstruct will return SHIELD_NOT_FOUND because the record does not exist in the DB. The shards below are, however, cryptographically valid — HMAC verifies, and combining 2 of 3 reconstructs the Ed25519 private key.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "demo generation failed";
    console.error("[Demo] generate error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/pipeline/demo-reconstruct
 *
 * Stateless sibling of /reconstruct for the demo UI. Takes an ephemeral
 * shieldId + publicKeySpkiHex + shards and verifies reconstruction without
 * touching the DB. Gated + rate-limited identically to /demo-generate.
 */
pipelineRouter.post("/demo-reconstruct", (req, res) => {
  if (!areDemoEndpointsEnabled()) {
    return res.status(404).json({
      error: "Not Found",
      reason: "DEMO_DISABLED" satisfies QRightErrorCode,
    });
  }

  const ip = clientIp({ ip: req.ip, headers: req.headers });
  const rl = demoRateLimiter.check(ip);
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
    return res.status(429).json({
      error: "Too Many Requests",
      reason: "RATE_LIMITED" satisfies QRightErrorCode,
      retryAfterMs: rl.retryAfterMs,
    });
  }

  res.setHeader("X-Demo", "true");

  const body = req.body as {
    shieldId?: unknown;
    publicKeySpkiHex?: unknown;
    shards?: unknown;
  };
  const shieldId = typeof body.shieldId === "string" ? body.shieldId : null;
  const publicKeySpkiHex =
    typeof body.publicKeySpkiHex === "string" ? body.publicKeySpkiHex : null;
  const shardsInput = Array.isArray(body.shards) ? body.shards : [];

  if (!shieldId || !publicKeySpkiHex) {
    return res.status(400).json({
      valid: false,
      reconstructed: false,
      reason: "INVALID_SHARD_FORMAT" satisfies QRightErrorCode,
    });
  }

  if (shardsInput.length < SHAMIR_THRESHOLD) {
    return res.status(400).json({
      valid: false,
      reconstructed: false,
      reason: "INSUFFICIENT_SHARDS" satisfies QRightErrorCode,
    });
  }

  for (const s of shardsInput) {
    if (!isShardInput(s)) {
      return res.status(400).json({
        valid: false,
        reconstructed: false,
        reason: "INVALID_SHARD_FORMAT" satisfies QRightErrorCode,
      });
    }
  }

  const result = combineAndVerify(
    shardsInput as Parameters<typeof combineAndVerify>[0],
    shieldId,
    publicKeySpkiHex,
  );

  if (!result.ok) {
    return res.status(400).json({
      valid: false,
      reconstructed: false,
      reason: result.reason ?? "RECONSTRUCTION_FAILED",
    });
  }

  return res.status(200).json({
    demo: true,
    valid: true,
    reconstructed: true,
    shieldId,
    verifiedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/pipeline/verify/:certId
 *
 * Public verification — anyone can verify a certificate by ID.
 * Used by QR codes on PDF certificates and verify page.
 */
pipelineRouter.get("/verify/:certId", async (req, res) => {
  try {
    await ensureTables();

    const { certId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ valid: false, error: "Certificate not found" });
    }

    const cert = rows[0];

    /* Increment verify count */
    await pool.query(
      `UPDATE "IPCertificate" SET "verifiedCount" = "verifiedCount" + 1, "lastVerifiedAt" = NOW() WHERE "id" = $1`,
      [certId],
    );

    /* Re-verify content hash (canonical: NFC + sorted keys + null defaults) */
    const hashCheck = canonicalContentHash({
      title: cert.title,
      description: cert.description,
      kind: cert.kind,
      country: cert.country,
      city: cert.city,
    });
    const hashValid = hashCheck === cert.contentHash;

    /* Re-verify QSign HMAC using stored signedAt (null for pre-v2 rows) */
    let signatureHmacValid: boolean | null = null;
    let signatureHmacReason: "OK" | "NO_SIGNED_AT" | "MISMATCH" | "ERROR" =
      "ERROR";
    try {
      const signedAtRaw = cert.signedAt;
      if (!signedAtRaw) {
        signatureHmacValid = null;
        signatureHmacReason = "NO_SIGNED_AT";
      } else {
        const signedAtIso =
          signedAtRaw instanceof Date
            ? signedAtRaw.toISOString()
            : String(signedAtRaw);
        const expected = computeQSignHmac({
          objectId: cert.objectId,
          title: cert.title,
          contentHash: cert.contentHash,
          signedAt: signedAtIso,
        });
        signatureHmacValid = crypto.timingSafeEqual(
          Buffer.from(expected, "hex"),
          Buffer.from(cert.signatureHmac, "hex"),
        );
        signatureHmacReason = signatureHmacValid ? "OK" : "MISMATCH";
      }
    } catch (hmacErr) {
      console.error(
        "[Pipeline] verify HMAC re-check failed:",
        hmacErr instanceof Error ? hmacErr.message : String(hmacErr),
      );
      signatureHmacValid = false;
      signatureHmacReason = "ERROR";
    }

    /* Check Quantum Shield status */
    let shieldStatus = "unknown";
    let shieldLegacy = false;
    if (cert.shieldId) {
      const shield = await pool.query(
        `SELECT "status","legacy" FROM "QuantumShield" WHERE "id" = $1`,
        [cert.shieldId],
      );
      const sh = shield.rows?.[0];
      shieldStatus = sh?.status || "not_found";
      shieldLegacy = sh?.legacy === true;
    }

    const legalBasis =
      typeof cert.legalBasis === "string"
        ? JSON.parse(cert.legalBasis)
        : cert.legalBasis;

    res.json({
      valid: true,
      verified: true,
      verifiedAt: new Date().toISOString(),
      certificate: {
        id: cert.id,
        objectId: cert.objectId,
        title: cert.title,
        kind: cert.kind,
        description: cert.description,
        author: cert.authorName || "Anonymous",
        email: cert.authorEmail || null,
        location: [cert.city, cert.country].filter(Boolean).join(", ") || null,
        contentHash: cert.contentHash,
        signatureHmac: cert.signatureHmac,
        signatureEd25519: cert.signatureEd25519
          ? cert.signatureEd25519.slice(0, 64) + "..."
          : null,
        algorithm: cert.algorithm,
        protectedAt: cert.protectedAt,
        status: cert.status,
      },
      integrity: {
        contentHashValid: hashValid,
        signatureHmacValid,
        signatureHmacReason,
        quantumShieldStatus: shieldStatus,
        shieldLegacy,
        shards: cert.shardCount,
        threshold: cert.shardThreshold,
      },
      legalBasis: {
        framework: legalBasis?.framework,
        type: legalBasis?.type,
        international: Array.isArray(legalBasis?.international)
          ? legalBasis.international.map((l: { name: string; principle: string }) => ({
              name: l.name,
              principle: l.principle,
            }))
          : [],
        digitalSignature: Array.isArray(legalBasis?.digitalSignature)
          ? legalBasis.digitalSignature.map((l: { name: string; scope: string }) => ({
              name: l.name,
              scope: l.scope,
            }))
          : [],
        disclaimer: legalBasis?.disclaimer,
      },
      stats: {
        verifiedCount: (cert.verifiedCount || 0) + 1,
        lastVerifiedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "verify failed";
    console.error("[Pipeline] verify error:", msg);
    res.status(500).json({ valid: false, error: msg });
  }
});

/**
 * GET /api/pipeline/certificates
 *
 * List all certificates (public registry).
 */
pipelineRouter.get("/certificates", async (_req, res) => {
  try {
    await ensureTables();

    const { rows } = await pool.query(
      `SELECT "id","objectId","title","kind","authorName","country","city","contentHash","algorithm","status","protectedAt","verifiedCount"
       FROM "IPCertificate" WHERE "status" = 'active' ORDER BY "protectedAt" DESC LIMIT 100`,
    );

    res.json({
      certificates: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        author: r.authorName || "Anonymous",
        location: [r.city, r.country].filter(Boolean).join(", ") || null,
        contentHash: r.contentHash,
        algorithm: r.algorithm,
        protectedAt: r.protectedAt,
        verifiedCount: r.verifiedCount || 0,
        verifyUrl: `https://aevion.vercel.app/verify/${r.id}`,
      })),
      total: rows.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "list failed";
    console.error("[Pipeline] certificates error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/certificate/:certId/pdf
 *
 * Generate a PDF certificate with QR code for public verification.
 */
pipelineRouter.get("/certificate/:certId/pdf", async (req, res: Response) => {
  try {
    await ensureTables();

    const { certId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    const cert = rows[0];
    const PDFDocument = (await import("pdfkit")).default;
    const QRCode = await import("qrcode");

    const verifyUrl = `https://aevion.vercel.app/verify/${cert.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBuffer = Buffer.from(qrBase64, "base64");

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="AEVION-Certificate-${cert.id}.pdf"`,
    );
    doc.pipe(res);

    const W = doc.page.width - 100;
    const pageW = doc.page.width;

    /* ── Header bar ── */
    doc.rect(0, 0, pageW, 90).fill("#0f172a");
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text("AEVION", 50, 28);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text("Digital IP Bureau — Protection Certificate", 50, 58);

    /* ── Teal accent line ── */
    doc.rect(0, 90, pageW, 4).fill("#0d9488");

    /* ── Certificate title ── */
    doc.moveDown(2);
    const yTitle = 120;
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#0d9488")
      .text(
        "CERTIFICATE OF INTELLECTUAL PROPERTY PROTECTION",
        50,
        yTitle,
        { align: "center", width: W },
      );
    doc.moveDown(0.5);
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text(cert.title, 50, yTitle + 22, { align: "center", width: W });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(
        `Type: ${cert.kind}  ·  Status: ${cert.status.toUpperCase()}`,
        50,
        yTitle + 52,
        { align: "center", width: W },
      );

    /* ── Divider ── */
    const yDiv1 = yTitle + 75;
    doc.rect(50, yDiv1, W, 1).fill("#e2e8f0");

    /* ── Author info ── */
    const yInfo = yDiv1 + 16;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#94a3b8")
      .text("AUTHOR", 50, yInfo);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text(cert.authorName || "Anonymous", 50, yInfo + 14);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#94a3b8")
      .text("LOCATION", 280, yInfo);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text(
        [cert.city, cert.country].filter(Boolean).join(", ") ||
          "Not specified",
        280,
        yInfo + 14,
      );

    const yDate = yInfo + 40;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#94a3b8")
      .text("PROTECTED AT", 50, yDate);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text(
        new Date(cert.protectedAt).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        50,
        yDate + 14,
      );

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#94a3b8")
      .text("CERTIFICATE ID", 280, yDate);
    doc
      .fontSize(10)
      .font("Courier")
      .fillColor("#0f172a")
      .text(cert.id, 280, yDate + 14);

    /* ── Description ── */
    const yDesc = yDate + 45;
    doc.rect(50, yDesc, W, 1).fill("#e2e8f0");
    const yDescText = yDesc + 12;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#94a3b8")
      .text("DESCRIPTION", 50, yDescText);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#334155")
      .text(
        (cert.description || "").slice(0, 500),
        50,
        yDescText + 14,
        { width: W, lineGap: 3 },
      );

    /* ── Cryptographic proof ── */
    const yCrypto =
      yDescText +
      14 +
      Math.min((cert.description || "").length, 500) * 0.15 +
      40;
    doc.rect(50, yCrypto, W, 1).fill("#e2e8f0");

    const yCryptoTitle = yCrypto + 12;
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text("Cryptographic Proof", 50, yCryptoTitle);

    const fields = [
      { label: "CONTENT HASH (SHA-256)", value: cert.contentHash },
      { label: "HMAC-SHA256 SIGNATURE", value: cert.signatureHmac },
      {
        label: "Ed25519 SIGNATURE",
        value: (cert.signatureEd25519 || "").slice(0, 64) + "...",
      },
      { label: "ALGORITHM", value: cert.algorithm },
      { label: "QUANTUM SHIELD ID", value: cert.shieldId || "N/A" },
      {
        label: "PROTECTION",
        value: `${cert.shardCount} shards, threshold ${cert.shardThreshold} (Shamir's Secret Sharing)`,
      },
    ];

    let yField = yCryptoTitle + 22;
    for (const f of fields) {
      doc
        .fontSize(7)
        .font("Helvetica-Bold")
        .fillColor("#94a3b8")
        .text(f.label, 50, yField);
      doc
        .fontSize(8)
        .font("Courier")
        .fillColor("#334155")
        .text(f.value, 50, yField + 10, { width: W });
      yField += 26;
    }

    /* ── QR Code + verify URL ── */
    const yQR = yField + 10;
    doc.rect(50, yQR, W, 1).fill("#e2e8f0");

    const qrY = yQR + 14;
    doc.image(qrBuffer, pageW / 2 - 50, qrY, { width: 100, height: 100 });
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#0d9488")
      .text("Scan to verify this certificate", 50, qrY + 105, {
        align: "center",
        width: W,
      });
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(verifyUrl, 50, qrY + 118, { align: "center", width: W });

    /* ── Legal basis ── */
    const yLegal = qrY + 142;
    doc.rect(50, yLegal, W, 1).fill("#e2e8f0");
    const yLegalTitle = yLegal + 10;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#0f172a")
      .text("Legal Framework", 50, yLegalTitle);
    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#475569")
      .text(
        "Berne Convention (Art. 5(2)) · WIPO Copyright Treaty · TRIPS Agreement (WTO) · eIDAS Regulation (EU) · ESIGN Act (USA) · KZ Digital Signature Law (No. 370-II)",
        50,
        yLegalTitle + 14,
        { width: W, lineGap: 2 },
      );

    /* ── Disclaimer ── */
    const yDisclaimer = yLegalTitle + 40;
    doc
      .fontSize(6.5)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(
        "This certificate is issued by AEVION Digital IP Bureau as cryptographic proof of existence and authorship at the recorded time. " +
          "It does not constitute a patent, trademark, or government-issued copyright registration. " +
          "It serves as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.",
        50,
        yDisclaimer,
        { width: W, lineGap: 2 },
      );

    /* ── Footer bar ── */
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY, pageW, 40).fill("#0f172a");
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(
        "AEVION Digital IP Bureau  ·  aevion.vercel.app  ·  Powered by SHA-256, Ed25519, Shamir's Secret Sharing",
        50,
        footerY + 14,
        { align: "center", width: W },
      );

    doc.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    console.error("[Pipeline] PDF error:", msg);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

/* GET /api/pipeline/health */
pipelineRouter.get("/health", (_req, res) => {
  res.json({
    service: "AEVION IP Pipeline",
    ok: true,
    steps: [
      "qright-registration",
      "qsign-hmac",
      "quantum-shield-ed25519-sss",
      "certificate-issuance",
    ],
    legalFrameworks: [
      "Berne Convention",
      "WIPO Copyright Treaty",
      "TRIPS Agreement",
      "eIDAS",
      "ESIGN Act",
      "KZ Digital Signature Law",
    ],
    shamir: {
      threshold: SHAMIR_THRESHOLD,
      shards: SHAMIR_SHARDS,
      hmacKeyVersion: HMAC_KEY_VERSION,
      field: "GF(256)",
    },
    at: new Date().toISOString(),
  });
});
