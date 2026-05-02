import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { verifyBearerOptional } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import {
  areDemoEndpointsEnabled,
  getQSignSecret,
  HMAC_KEY_VERSION,
  listAvailableHmacVersions,
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
import {
  stampHash as otsStampHash,
  upgradeProof as otsUpgradeProof,
  verifyProof as otsVerifyProof,
} from "../lib/opentimestamps/anchor";
import { computeWitnessCid } from "../lib/shamir/witnessCid";
import {
  CosignError,
  reverifyAuthorCosign,
  verifyAuthorCosign,
} from "../lib/cosign/authorCosign";
import { applyOgEtag } from "../lib/ogEtag";

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

function computeQSignHmac(
  payload: QSignPayload,
  version: number = HMAC_KEY_VERSION,
): string {
  const raw = JSON.stringify({
    objectId: payload.objectId,
    title: payload.title,
    contentHash: payload.contentHash,
    signedAt: payload.signedAt,
  });
  // getQSignSecret(version) throws if the version is not configured — that
  // correctly propagates as a 500 for the caller to handle.
  return crypto
    .createHmac("sha256", getQSignSecret(version))
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
  // v3: distribution policy. 'legacy_all_local' for pre-v3 rows (all 3 shards
  // sit in the `shards` column — not a real Shamir distribution). For v3 rows,
  // `shards` holds ONLY the AEVION vault shard; the author shard is wiped
  // after being returned to the client; the witness shard lives in
  // "PublicShardWitness" and is fetched via CID.
  await pool.query(
    `ALTER TABLE "QuantumShield" ADD COLUMN IF NOT EXISTS "distribution_policy" TEXT NOT NULL DEFAULT 'legacy_all_local';`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PublicShardWitness" (
      "shieldId" TEXT PRIMARY KEY,
      "shardIndex" INTEGER NOT NULL,
      "sssShare" TEXT NOT NULL,
      "hmac" TEXT NOT NULL,
      "hmacKeyVersion" INTEGER NOT NULL,
      "witnessCid" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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
  // v3 (Phase 3 — HMAC rotation): the QSign HMAC version that signed this
  // row. Verify uses the secret for THIS version (not the current one), so
  // rotated records still verify under their original key.
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "qsignKeyVersion" INTEGER NOT NULL DEFAULT 1;`,
  );
  // v3 (Phase 4 — author co-signing): the user's browser-held Ed25519
  // pubkey (base64, 32 raw bytes) and signature over `contentHash`
  // (base64, 64 raw bytes). NULL for legacy pre-v3 rows; verify reports
  // `present: false` for those.
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "authorPublicKey" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "authorSignature" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "authorKeyAlgo" TEXT;`,
  );
  // v3: Bitcoin-anchored timestamp proof (OpenTimestamps).
  // Pending immediately after /protect; upgraded to bitcoin-confirmed via
  // POST /pipeline/ots/:certId/upgrade once the OT calendar network has
  // folded the hash into a Bitcoin block (typically 1-6h).
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "otsProof" BYTEA;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "otsStatus" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "otsBitcoinBlockHeight" INTEGER;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "otsStampedAt" TIMESTAMPTZ;`,
  );
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "otsUpgradedAt" TIMESTAMPTZ;`,
  );
  // fileHash: SHA-256 of raw file bytes, supplied client-side when the user
  // uploads a file. Stored alongside contentHash (which is the canonical
  // text-field hash) so prior-art search can match either.
  await pool.query(
    `ALTER TABLE "IPCertificate" ADD COLUMN IF NOT EXISTS "fileHash" TEXT;`,
  );
  await pool.query(
    `ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "fileHash" TEXT;`,
  );

  // Tier 2: append-only admin audit (force-revoke, etc).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PipelineAuditLog" (
      "id" TEXT PRIMARY KEY,
      "action" TEXT NOT NULL,
      "certId" TEXT,
      "objectId" TEXT,
      "actor" TEXT,
      "payload" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PipelineAuditLog_at_idx" ON "PipelineAuditLog" ("at" DESC);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PipelineAuditLog_action_at_idx" ON "PipelineAuditLog" ("action", "at" DESC);`,
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

    const {
      title,
      description,
      kind,
      ownerName,
      ownerEmail,
      country,
      city,
      authorPublicKey,
      authorSignature,
      fileHash,
    } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "title and description are required" });
    }
    if (fileHash !== undefined && fileHash !== null && !/^[a-f0-9]{64}$/i.test(String(fileHash))) {
      return res.status(400).json({ error: "fileHash must be a 64-character lowercase hex SHA-256" });
    }
    const safeFileHash: string | null = fileHash ? String(fileHash).toLowerCase() : null;

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

    /* ── Author co-sign (optional, but verified before any DB write) ── */
    // The user's browser holds an Ed25519 keypair; the signature on
    // `contentHash` is sent alongside the form. We verify here so a bad
    // payload fails before we register the work or split shards.
    let cosign: ReturnType<typeof verifyAuthorCosign> | null = null;
    const cosignProvided =
      typeof authorPublicKey === "string" && authorPublicKey.length > 0;
    if (cosignProvided) {
      try {
        cosign = verifyAuthorCosign(
          {
            authorPublicKey,
            authorSignature: typeof authorSignature === "string" ? authorSignature : "",
          },
          contentHash,
        );
      } catch (cosErr) {
        if (cosErr instanceof CosignError) {
          return res.status(400).json({
            error: cosErr.message,
            code: `COSIGN_${cosErr.code}`,
          });
        }
        throw cosErr;
      }
    }

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
        `INSERT INTO "QRightObject" ("id","title","description","kind","contentHash","fileHash","ownerName","ownerEmail","ownerUserId","country","city","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
        [
          objectId,
          title,
          description,
          effectiveKind,
          contentHash,
          safeFileHash,
          authorName,
          authorEmail,
          authorUserId,
          country || null,
          city || null,
        ],
      );

      // v3 distributed Shamir:
      //   shards[0] → author (returned in response, NOT stored)
      //   shards[1] → AEVION vault (QuantumShield.shards = [this one only])
      //   shards[2] → public witness (PublicShardWitness table + CID)
      // For v3 `shards` holds a JSON array with exactly ONE element — the
      // vault shard. Reconstruction requires the author's downloaded shard
      // plus either the vault OR the public witness.
      const vaultShard = shards[1];
      const witnessShard = shards[2];
      const witnessCid = computeWitnessCid(witnessShard);

      await client.query(
        `INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","legacy","hmac_key_version","distribution_policy","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',false,$10,'distributed_v2',NOW())`,
        [
          shieldId,
          objectId,
          title,
          "Shamir's Secret Sharing + Ed25519",
          SHAMIR_THRESHOLD,
          SHAMIR_SHARDS,
          JSON.stringify([vaultShard]),
          signatureEd25519,
          publicKeySpkiHex,
          HMAC_KEY_VERSION,
        ],
      );

      await client.query(
        `INSERT INTO "PublicShardWitness" ("shieldId","shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [
          shieldId,
          witnessShard.index,
          witnessShard.sssShare,
          witnessShard.hmac,
          witnessShard.hmacKeyVersion,
          witnessCid,
        ],
      );

      await client.query(
        `INSERT INTO "IPCertificate" ("id","objectId","shieldId","title","kind","description","authorName","authorEmail","country","city","contentHash","fileHash","signatureHmac","signatureEd25519","publicKeyEd25519","shardCount","shardThreshold","algorithm","legalBasis","status","protectedAt","signedAt","qsignKeyVersion","authorPublicKey","authorSignature","authorKeyAlgo")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'active',$20,$21,$22,$23,$24,$25)`,
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
          safeFileHash,
          signatureHmac,
          signatureEd25519,
          publicKeySpkiHex,
          SHAMIR_SHARDS,
          SHAMIR_THRESHOLD,
          algorithm,
          JSON.stringify(legalBasis),
          protectedAt,
          signedAt,
          HMAC_KEY_VERSION,
          cosign?.authorPublicKey ?? null,
          cosign?.authorSignature ?? null,
          cosign?.authorKeyAlgo ?? null,
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

    // Fire-and-forget Bitcoin anchor via OpenTimestamps. We don't block the
    // response on calendar RTT (1-5s); the proof is persisted asynchronously
    // and the client can poll /api/pipeline/verify/:id (or trigger
    // /api/pipeline/ots/:id/upgrade) to see the bitcoin-confirmed state.
    void (async () => {
      try {
        const r = await otsStampHash(contentHash);
        if (r.otsProof) {
          await pool.query(
            `UPDATE "IPCertificate"
             SET "otsProof" = $1,
                 "otsStatus" = $2,
                 "otsBitcoinBlockHeight" = $3,
                 "otsStampedAt" = NOW()
             WHERE "id" = $4`,
            [r.otsProof, r.status, r.bitcoinBlockHeight, certId],
          );
          console.log(
            `[OT] cert=${certId} status=${r.status} height=${r.bitcoinBlockHeight ?? "pending"} proofBytes=${r.otsProof.length}`,
          );
        } else {
          await pool.query(
            `UPDATE "IPCertificate" SET "otsStatus" = 'failed', "otsStampedAt" = NOW() WHERE "id" = $1`,
            [certId],
          );
          console.error(`[OT] cert=${certId} stamp failed: ${r.error}`);
        }
      } catch (err) {
        console.error(
          `[OT] cert=${certId} unexpected:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

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

    // Re-derive for response (shadowing inner scope).
    const responseVaultShard = shards[1];
    const responseWitnessShard = shards[2];
    const responseWitnessCid = computeWitnessCid(responseWitnessShard);

    res.status(201).json({
      success: true,
      message: cosign
        ? "Protected. 4 cryptographic layers active (incl. your browser-held author key) + Bitcoin anchor + international legal basis."
        : "Protected. 3 cryptographic layers active + Bitcoin anchor + international legal basis.",
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
        distributionPolicy: "distributed_v2",
      },
      // v3 distributed Shamir — the author shard is returned here ONCE.
      // The client MUST save it (download JSON) because it is immediately
      // wiped from server memory and is not persisted in our DB.
      // Without this shard, reconstruction needs AEVION vault AND the
      // public witness (a 2-of-3 recovery, not 1-of-3).
      authorShard: {
        shieldId,
        shard: shards[0],
        warning:
          "Save this shard offline (downloads, USB, password manager) — AEVION never keeps a copy. With your shard plus either the AEVION vault or the public Witness Shard you can reconstruct the proof independently of AEVION. Without it, recovery falls back to the AEVION vault + public Witness — which works, but requires us to be online.",
        recoveryPaths: [
          "Your Author Shard + AEVION vault — offline recovery, only AEVION needed for one shard",
          "Your Author Shard + public Witness Shard — full recovery without AEVION at all",
          "AEVION vault + public Witness Shard — fallback if you lose your Author Shard",
        ],
      },
      vaultShard: {
        index: responseVaultShard.index,
        location: "AEVION Platform vault",
        stored: true,
      },
      witness: {
        index: responseWitnessShard.index,
        location: "Public Witness",
        cid: responseWitnessCid,
        witnessUrl: `/api/pipeline/shield/${shieldId}/witness`,
      },
      cosign: cosign
        ? {
            present: true,
            algo: cosign.authorKeyAlgo,
            authorKeyFingerprint: cosign.authorKeyFingerprint,
          }
        : { present: false },
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
        // Use the version that was in effect when the cert was signed.
        // For pre-Phase-3 rows qsignKeyVersion defaults to 1 via the
        // ALTER TABLE DEFAULT.
        const certVersion =
          typeof cert.qsignKeyVersion === "number" && cert.qsignKeyVersion >= 1
            ? cert.qsignKeyVersion
            : 1;
        const expected = computeQSignHmac(
          {
            objectId: cert.objectId,
            title: cert.title,
            contentHash: cert.contentHash,
            signedAt: signedAtIso,
          },
          certVersion,
        );
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

    /* Check Quantum Shield status + distribution policy */
    let shieldStatus = "unknown";
    let shieldLegacy = false;
    type DistributionPolicy = "legacy_all_local" | "distributed_v2";
    let distributionPolicy: DistributionPolicy = "legacy_all_local";
    let witnessInfo: {
      cid: string;
      cidValid: boolean;
      witnessUrl: string;
    } | null = null;

    if (cert.shieldId) {
      const shield = await pool.query(
        `SELECT "status","legacy","distribution_policy" FROM "QuantumShield" WHERE "id" = $1`,
        [cert.shieldId],
      );
      const sh = shield.rows?.[0];
      shieldStatus = sh?.status || "not_found";
      shieldLegacy = sh?.legacy === true;
      distributionPolicy =
        sh?.distribution_policy === "distributed_v2"
          ? "distributed_v2"
          : "legacy_all_local";

      if (distributionPolicy === "distributed_v2") {
        const w = await pool.query(
          `SELECT "shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid"
           FROM "PublicShardWitness" WHERE "shieldId" = $1`,
          [cert.shieldId],
        );
        const wr = w.rows?.[0];
        if (wr) {
          const reDerived = computeWitnessCid({
            index: wr.shardIndex,
            sssShare: wr.sssShare,
            hmac: wr.hmac,
            hmacKeyVersion: wr.hmacKeyVersion,
          });
          witnessInfo = {
            cid: wr.witnessCid,
            cidValid: reDerived === wr.witnessCid,
            witnessUrl: `/api/pipeline/shield/${cert.shieldId}/witness`,
          };
        }
      }
    }

    const legalBasis =
      typeof cert.legalBasis === "string"
        ? JSON.parse(cert.legalBasis)
        : cert.legalBasis;

    /* ── Re-verify author co-signature against current contentHash ── */
    const cosignStatus = reverifyAuthorCosign(
      cert.authorPublicKey,
      cert.authorSignature,
      cert.contentHash,
    );

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
        fileHash: cert.fileHash || null,
        signatureHmac: cert.signatureHmac,
        signatureEd25519: cert.signatureEd25519
          ? cert.signatureEd25519.slice(0, 64) + "..."
          : null,
        algorithm: cert.algorithm,
        protectedAt: cert.protectedAt,
        status: cert.status,
        verificationLevel: cert.authorVerificationLevel || "anonymous",
        verifiedName: cert.authorVerifiedName || null,
        verifiedAt: cert.authorVerifiedAt || null,
        verifiedBy: cert.authorVerificationProvider || null,
      },
      integrity: {
        contentHashValid: hashValid,
        signatureHmacValid,
        signatureHmacReason,
        qsignKeyVersion:
          typeof cert.qsignKeyVersion === "number" ? cert.qsignKeyVersion : 1,
        currentKeyVersion: HMAC_KEY_VERSION,
        keyRotatedSinceSigning:
          (typeof cert.qsignKeyVersion === "number"
            ? cert.qsignKeyVersion
            : 1) !== HMAC_KEY_VERSION,
        quantumShieldStatus: shieldStatus,
        shieldLegacy,
        shieldId: cert.shieldId || null,
        shards: cert.shardCount,
        threshold: cert.shardThreshold,
        authorCosign: cosignStatus,
      },
      shardDistribution: {
        policy: distributionPolicy,
        // Real distribution means the AEVION DB cannot recover the key on
        // its own — an external source (author or witness) is required.
        realDistributed: distributionPolicy === "distributed_v2",
        locations:
          distributionPolicy === "distributed_v2"
            ? [
                { index: 1, place: "Author Vault", held: "author (offline download)", serverHasCopy: false },
                { index: 2, place: "AEVION Platform", held: "our DB", serverHasCopy: true },
                { index: 3, place: "Public Witness", held: "content-addressed CID", serverHasCopy: true, cid: witnessInfo?.cid, cidValid: witnessInfo?.cidValid },
              ]
            : [
                { index: 1, place: "Author Vault (legacy — stored locally)", held: "our DB", serverHasCopy: true },
                { index: 2, place: "AEVION Platform", held: "our DB", serverHasCopy: true },
                { index: 3, place: "Witness Node (legacy — stored locally)", held: "our DB", serverHasCopy: true },
              ],
        witness: witnessInfo,
      },
      bitcoinAnchor: {
        status: cert.otsStatus ?? "not_stamped",
        bitcoinBlockHeight: cert.otsBitcoinBlockHeight ?? null,
        stampedAt: cert.otsStampedAt ?? null,
        upgradedAt: cert.otsUpgradedAt ?? null,
        hasProof: Boolean(cert.otsProof),
        network: "OpenTimestamps → Bitcoin",
        proofUrl: cert.otsProof
          ? `/api/pipeline/ots/${cert.id}/proof`
          : null,
        upgradeUrl: cert.otsStatus === "pending"
          ? `/api/pipeline/ots/${cert.id}/upgrade`
          : null,
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
      `SELECT "id","objectId","shieldId","title","kind","authorName","country","city","contentHash","fileHash","algorithm","status","protectedAt","verifiedCount"
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
        fileHash: r.fileHash || null,
        algorithm: r.algorithm,
        protectedAt: r.protectedAt,
        verifiedCount: r.verifiedCount || 0,
        shieldId: r.shieldId || null,
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

/**
 * GET /api/pipeline/ots/:certId/proof
 *
 * Returns the raw `.ots` proof for independent verification with the
 * standard OpenTimestamps CLI / any OT-compatible tool. This is what makes
 * the Bitcoin anchor genuinely third-party-verifiable — the user does not
 * have to trust our server.
 *
 *   curl -o cert-XX.ots https://host/api/pipeline/ots/cert-XX/proof
 *   ots verify cert-XX.ots   # independent check against Bitcoin
 */
pipelineRouter.get("/ots/:certId/proof", async (req, res) => {
  try {
    await ensureTables();
    const { certId } = req.params;
    const { rows } = await pool.query(
      `SELECT "otsProof","contentHash" FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "certificate not found" });
    }
    const proof = rows[0].otsProof as Buffer | null;
    if (!proof) {
      return res.status(404).json({
        error: "proof not ready",
        reason: "OT_PROOF_PENDING",
      });
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${certId}.ots"`,
    );
    res.setHeader(
      "X-Content-Hash",
      String(rows[0].contentHash || ""),
    );
    return res.send(proof);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "proof fetch failed";
    console.error("[OT] proof fetch error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/pipeline/ots/:certId/upgrade
 *
 * Try to upgrade a pending OT proof to a Bitcoin-confirmed attestation.
 * Idempotent: if the proof is already bitcoin-confirmed, returns the stored
 * height without network I/O. Safe to poll — the OT calendar network handles
 * its own rate-limiting.
 */
pipelineRouter.post("/ots/:certId/upgrade", async (req, res) => {
  try {
    await ensureTables();
    const { certId } = req.params;
    const { rows } = await pool.query(
      `SELECT "otsProof","otsStatus","otsBitcoinBlockHeight" FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "certificate not found" });
    }
    const proof = rows[0].otsProof as Buffer | null;
    if (!proof) {
      return res.status(409).json({
        error: "no proof to upgrade",
        reason: "OT_PROOF_PENDING",
        status: rows[0].otsStatus ?? "not_stamped",
      });
    }
    // Short-circuit: already confirmed.
    if (rows[0].otsStatus === "bitcoin-confirmed") {
      return res.json({
        upgraded: false,
        status: "bitcoin-confirmed",
        bitcoinBlockHeight: rows[0].otsBitcoinBlockHeight,
        note: "already confirmed; nothing to upgrade",
      });
    }

    const r = await otsUpgradeProof(proof);
    if (r.upgraded && r.otsProof) {
      await pool.query(
        `UPDATE "IPCertificate"
         SET "otsProof" = $1,
             "otsStatus" = $2,
             "otsBitcoinBlockHeight" = $3,
             "otsUpgradedAt" = NOW()
         WHERE "id" = $4`,
        [r.otsProof, r.status, r.bitcoinBlockHeight, certId],
      );
      console.log(
        `[OT] cert=${certId} upgraded height=${r.bitcoinBlockHeight}`,
      );
      return res.json({
        upgraded: true,
        status: r.status,
        bitcoinBlockHeight: r.bitcoinBlockHeight,
      });
    }
    return res.json({
      upgraded: false,
      status: r.status,
      bitcoinBlockHeight: r.bitcoinBlockHeight,
      note: "still pending Bitcoin confirmation — try again in 1-6 hours",
      error: r.error,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "upgrade failed";
    console.error("[OT] upgrade error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/hmac-versions
 *
 * Introspection for key rotation: which HMAC versions are configured on
 * this deployment, which is the current one (used to sign new records),
 * and how many records in the DB reference each version. Useful during
 * rotation windows — lets ops confirm "every row is verifiable under a
 * secret we still have" before retiring an old secret.
 */
pipelineRouter.get("/hmac-versions", async (_req, res) => {
  try {
    await ensureTables();
    const v = listAvailableHmacVersions();

    // Per-version row counts.
    const certCounts = await pool.query(
      `SELECT "qsignKeyVersion" as version, COUNT(*)::int as rows
       FROM "IPCertificate"
       GROUP BY "qsignKeyVersion"
       ORDER BY "qsignKeyVersion" ASC`,
    );
    const shieldCounts = await pool.query(
      `SELECT "hmac_key_version" as version, COUNT(*)::int as rows
       FROM "QuantumShield"
       GROUP BY "hmac_key_version"
       ORDER BY "hmac_key_version" ASC`,
    );

    return res.json({
      current: v.current,
      configured: {
        shardSecretVersions: v.shardVersions,
        qsignSecretVersions: v.qsignVersions,
      },
      usage: {
        certificatesByVersion: certCounts.rows,
        shieldsByVersion: shieldCounts.rows,
      },
      rotationReady: v.shardVersions.length > 1 || v.qsignVersions.length > 1,
      note:
        "To rotate: add SHARD_HMAC_SECRET_V{N+1} and QSIGN_SECRET_V{N+1} env vars, then set HMAC_KEY_VERSION={N+1} and restart. Old records keep their version and stay verifiable against the old secrets.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "hmac-versions failed";
    console.error("[HMAC] versions error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/shield/:shieldId/witness
 *
 * Public witness shard (shard 3 of 3). Distributed under a content-addressed
 * CID — anyone can fetch, any third party can re-derive the CID and verify
 * this shard has not been tampered with since publication. Combined with the
 * author's downloaded shard OR the AEVION vault shard, this reconstructs the
 * Ed25519 private key via real 2-of-3 Shamir SSS.
 *
 * This endpoint is intentionally public — that's the whole point of a
 * witness. Rate-limited against abuse.
 */
pipelineRouter.get("/shield/:shieldId/witness", async (req, res) => {
  try {
    await ensureTables();
    const ip = clientIp({ ip: req.ip, headers: req.headers });
    const rl = reconstructRateLimiter.check(ip);
    if (!rl.allowed) {
      res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
      return res.status(429).json({
        error: "Too Many Requests",
        reason: "RATE_LIMITED" satisfies QRightErrorCode,
      });
    }

    const { shieldId } = req.params;
    const { rows } = await pool.query(
      `SELECT "shieldId","shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid","createdAt"
       FROM "PublicShardWitness" WHERE "shieldId" = $1`,
      [shieldId],
    );
    if (rows.length === 0) {
      return res.status(404).json({
        error: "witness not found",
        reason: "WITNESS_NOT_FOUND" satisfies QRightErrorCode,
      });
    }
    const w = rows[0];
    // Re-derive CID to prove the shard hasn't been tampered with in our DB.
    const reDerived = computeWitnessCid({
      index: w.shardIndex,
      sssShare: w.sssShare,
      hmac: w.hmac,
      hmacKeyVersion: w.hmacKeyVersion,
    });
    const cidValid = reDerived === w.witnessCid;

    return res.json({
      shieldId: w.shieldId,
      shard: {
        index: w.shardIndex,
        sssShare: w.sssShare,
        hmac: w.hmac,
        hmacKeyVersion: w.hmacKeyVersion,
        location: "Public Witness",
        createdAt: w.createdAt,
        lastVerified: new Date().toISOString(),
      },
      cid: w.witnessCid,
      cidValid,
      createdAt: w.createdAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "witness fetch failed";
    console.error("[Witness] fetch error:", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/pipeline/ots/:certId/verify
 *
 * Cryptographically re-verify the OT proof against the certificate's content
 * hash. If the proof carries a Bitcoin attestation, the library checks the
 * Merkle root against public block explorers — making this end-to-end
 * independent of our DB.
 */
pipelineRouter.post("/ots/:certId/verify", async (req, res) => {
  try {
    await ensureTables();
    const { certId } = req.params;
    const { rows } = await pool.query(
      `SELECT "otsProof","contentHash" FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "certificate not found" });
    }
    const proof = rows[0].otsProof as Buffer | null;
    const contentHash = String(rows[0].contentHash || "");
    if (!proof || !contentHash) {
      return res.status(409).json({
        ok: false,
        error: "proof or hash missing",
      });
    }
    const v = await otsVerifyProof(contentHash, proof);
    return res.json({
      ok: v.ok,
      bitcoinBlockHeight: v.bitcoinBlockHeight,
      attestations: v.attestations,
      error: v.error,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "verify failed";
    console.error("[OT] verify error:", msg);
    return res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * GET /api/pipeline/certificate/:certId/bundle.json
 *
 * Self-contained verification bundle: a single JSON document that lets a
 * third party verify the certificate's authenticity without contacting
 * AEVION ever again. If our servers go down or the company ceases to
 * exist, the holder of this bundle can still prove their claim.
 *
 * Bundle contents:
 *  - certificate metadata (display fields)
 *  - the canonical content hash + the exact JSON payload AEVION signed
 *  - AEVION's Ed25519 public key + signature (verifiable with any
 *    standard Ed25519 implementation)
 *  - the QSign HMAC fields (informational — verifying HMAC requires the
 *    server-side secret, so this is identity, not proof)
 *  - the author's co-signing public key + signature, if present
 *  - the OpenTimestamps proof bytes inline (base64) — verifiable against
 *    the Bitcoin blockchain by any OT client
 *  - the public Shamir witness shard + CID, so an external party can
 *    re-anchor the witness to IPFS / Arweave for survival beyond AEVION
 *
 * The bundle is intentionally large (OT proof can be ~kB), but it's the
 * one artifact a patent-bureau client should keep regardless of any
 * other state in the world.
 */
pipelineRouter.get("/certificate/:certId/bundle.json", async (req, res) => {
  try {
    await ensureTables();
    const { certId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM "IPCertificate" WHERE "id" = $1`,
      [certId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "certificate not found" });
    }
    const cert = rows[0];

    // Reconstruct the exact payload AEVION's Ed25519 signed at /protect
    // time. Must stay byte-for-byte aligned with the JSON.stringify({...})
    // call there — see /protect for the source of truth. We extract the
    // raw 32-byte public key by stripping the 12-byte Ed25519 SPKI prefix
    // (RFC 8410, fixed format).
    const spkiHex = String(cert.publicKeyEd25519 || "");
    const spkiBuf = Buffer.from(spkiHex, "hex");
    const aevionPublicKeyRawHex =
      spkiBuf.length === 44 ? spkiBuf.subarray(12).toString("hex") : "";

    const signedAtIso =
      cert.signedAt instanceof Date
        ? cert.signedAt.toISOString()
        : cert.signedAt
          ? String(cert.signedAt)
          : null;

    const aevionSignedPayload = signedAtIso
      ? JSON.stringify({
          objectId: cert.objectId,
          title: cert.title,
          contentHash: cert.contentHash,
          signatureHmac: cert.signatureHmac,
          publicKeyRawHex: aevionPublicKeyRawHex,
          signedAt: signedAtIso,
        })
      : null;

    // Public Shamir witness — anyone can re-pin it to IPFS to make the
    // witness survive AEVION going down.
    let witness: {
      shieldId: string;
      shardIndex: number;
      sssShare: string;
      hmac: string;
      hmacKeyVersion: number;
      witnessCid: string;
    } | null = null;
    if (cert.shieldId) {
      const w = await pool.query(
        `SELECT "shardIndex","sssShare","hmac","hmacKeyVersion","witnessCid"
         FROM "PublicShardWitness" WHERE "shieldId" = $1`,
        [cert.shieldId],
      );
      const wr = w.rows?.[0];
      if (wr) {
        witness = {
          shieldId: cert.shieldId,
          shardIndex: wr.shardIndex,
          sssShare: wr.sssShare,
          hmac: wr.hmac,
          hmacKeyVersion: wr.hmacKeyVersion,
          witnessCid: wr.witnessCid,
        };
      }
    }

    const otsProof = cert.otsProof as Buffer | null;
    const bundle = {
      version: 1 as const,
      bundleType: "aevion-verification-bundle" as const,
      exportedAt: new Date().toISOString(),
      certificate: {
        id: cert.id,
        objectId: cert.objectId,
        shieldId: cert.shieldId,
        title: cert.title,
        kind: cert.kind,
        description: cert.description,
        author: cert.authorName || "Anonymous",
        email: cert.authorEmail || null,
        location:
          [cert.city, cert.country].filter(Boolean).join(", ") || null,
        contentHash: cert.contentHash,
        algorithm: cert.algorithm,
        protectedAt: cert.protectedAt,
        status: cert.status,
      },
      proofs: {
        contentHash: {
          algo: "SHA-256",
          value: cert.contentHash,
          // Inputs are listed so the verifier can recompute the hash
          // from these exact fields — same canonicalization as the
          // AEVION server (see canonicalContentHash).
          canonicalInputs: {
            title: cert.title,
            description: cert.description,
            kind: cert.kind,
            country: cert.country || null,
            city: cert.city || null,
          },
        },
        aevionEd25519: aevionSignedPayload
          ? {
              algo: "Ed25519",
              publicKeySpkiHex: spkiHex,
              publicKeyRawHex: aevionPublicKeyRawHex,
              signedPayload: aevionSignedPayload,
              signature: cert.signatureEd25519,
            }
          : null,
        qsignHmac: signedAtIso
          ? {
              algo: "HMAC-SHA256",
              keyVersion:
                typeof cert.qsignKeyVersion === "number"
                  ? cert.qsignKeyVersion
                  : 1,
              signedAt: signedAtIso,
              signature: cert.signatureHmac,
              note: "HMAC verification requires AEVION's server-side secret. Included for identity continuity; offline verifiers should rely on Ed25519.",
            }
          : null,
        authorCosign:
          cert.authorPublicKey && cert.authorSignature
            ? {
                algo: cert.authorKeyAlgo || "ed25519",
                publicKeyBase64: cert.authorPublicKey,
                signature: cert.authorSignature,
                signedMessage: "contentHash (utf8)",
                note: "Verify by signing the contentHash hex string (utf8 bytes) with this public key.",
              }
            : null,
        openTimestamps: cert.otsStatus
          ? {
              status: cert.otsStatus,
              bitcoinBlockHeight: cert.otsBitcoinBlockHeight ?? null,
              stampedAt: cert.otsStampedAt ?? null,
              upgradedAt: cert.otsUpgradedAt ?? null,
              proofBase64: otsProof ? otsProof.toString("base64") : null,
              note: "Verify with any OpenTimestamps client against the Bitcoin blockchain. The proof targets the contentHash exactly.",
            }
          : null,
      },
      shamirWitness: witness,
      verification: {
        howTo: [
          "1. Recompute SHA-256 of stableStringify({city, country, description, kind, title}) where each value is NFC-normalized; missing kind defaults to 'other'. Compare with proofs.contentHash.value.",
          "2. Verify proofs.aevionEd25519.signature using publicKeyRawHex over the UTF-8 bytes of proofs.aevionEd25519.signedPayload (a JSON string).",
          "3. If proofs.authorCosign is present, verify its signature using publicKeyBase64 over the UTF-8 bytes of proofs.contentHash.value (the hex string itself).",
          "4. If proofs.openTimestamps.proofBase64 is present, decode and run any OT client (https://opentimestamps.org) against it; the protected file is the raw bytes of proofs.contentHash.value as a hex string. A bitcoinBlockHeight >= 1 means the timestamp is locked to a real Bitcoin block.",
          "5. If proofs.openTimestamps shows status: bitcoin-confirmed, the certificate's existence is mathematically anchored to that block — independent of AEVION, IPFS, or any other party.",
        ],
        independence: [
          "AEVION's Ed25519 signature can be verified with any Ed25519 library — we are not in the trust path.",
          "The OpenTimestamps proof can be verified against Bitcoin block explorers — Bitcoin is the trust anchor.",
          "If author co-signing is present, the user's own key — held only by them — provides a second independent layer.",
          "This bundle is sufficient for proof of existence and authorship even if AEVION ceases to exist.",
        ],
      },
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="aevion-bundle-${certId}.json"`,
    );
    res.send(JSON.stringify(bundle, null, 2));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "bundle export failed";
    console.error("[Pipeline] bundle error:", msg);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 2: transparency + admin + audit
// (Embed/badge for individual certs lives at /api/bureau/cert/:certId/* —
//  Bureau owns the per-cert public surface; Pipeline owns lifecycle ops.)
// ─────────────────────────────────────────────────────────────────────────

function pipelineAdminEmailsAllowlist(): Set<string> {
  const raw = String(process.env.PIPELINE_ADMIN_EMAILS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
}

function isPipelineAdmin(req: Request): { ok: boolean; email: string | null; reason: string | null } {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) return { ok: false, email: null, reason: "no-bearer" };
  const token = auth.slice(7).trim();
  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    const email = String(decoded.email || "").toLowerCase();
    const role = String(decoded.role || "").toLowerCase();
    if (role === "admin") return { ok: true, email, reason: null };
    const allow = pipelineAdminEmailsAllowlist();
    if (allow.has(email)) return { ok: true, email, reason: null };
    return { ok: false, email, reason: "not-in-allowlist" };
  } catch {
    return { ok: false, email: null, reason: "invalid-token" };
  }
}

async function logPipelineAudit(opts: {
  action: string;
  certId: string | null;
  objectId: string | null;
  actor: string | null;
  payload: Record<string, unknown> | null;
}): Promise<void> {
  await pool
    .query(
      `INSERT INTO "PipelineAuditLog" ("id","action","certId","objectId","actor","payload")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        crypto.randomUUID(),
        opts.action,
        opts.certId,
        opts.objectId,
        opts.actor,
        opts.payload ? JSON.stringify(opts.payload) : null,
      ]
    )
    .catch(() => {});
}

// 🔹 GET /transparency — public counts only (no PII).
pipelineRouter.get("/transparency", async (_req, res) => {
  try {
    await ensureTables();
    const totals = await pool.query(
      `SELECT COUNT(*)::int AS "n",
              SUM(CASE WHEN "status"='active' THEN 1 ELSE 0 END)::int AS "active",
              SUM(CASE WHEN "status"='revoked' THEN 1 ELSE 0 END)::int AS "revoked"
       FROM "IPCertificate"`
    );
    const byKind = await pool.query(
      `SELECT "kind","status", COUNT(*)::int AS "n"
       FROM "IPCertificate" GROUP BY "kind","status" ORDER BY "n" DESC`
    );
    const byCountry = await pool.query(
      `SELECT "country", COUNT(*)::int AS "n"
       FROM "IPCertificate" WHERE "country" IS NOT NULL
       GROUP BY "country" ORDER BY "n" DESC LIMIT 10`
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      totals: {
        certificates: totals.rows[0]?.n || 0,
        active: totals.rows[0]?.active || 0,
        revoked: totals.rows[0]?.revoked || 0,
      },
      byKind: byKind.rows.map((r: any) => ({ kind: r.kind, status: r.status, count: r.n })),
      topCountries: byCountry.rows.map((r: any) => ({ country: r.country, count: r.n })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "transparency failed", details: err.message });
  }
});

// 🔹 Admin probe.
pipelineRouter.get("/admin/whoami", (req, res) => {
  const a = isPipelineAdmin(req);
  res.json({ isAdmin: a.ok, email: a.email, reason: a.reason });
});

// 🔹 Admin: list certs (?status, ?kind, ?q, ?limit≤200).
pipelineRouter.get("/admin/certificates", async (req, res) => {
  const a = isPipelineAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureTables();
  const status = String(req.query.status || "").trim();
  const kind = String(req.query.kind || "").trim();
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const conds: string[] = [];
  const args: any[] = [];
  if (status) { args.push(status); conds.push(`"status" = $${args.length}`); }
  if (kind) { args.push(kind); conds.push(`"kind" = $${args.length}`); }
  if (q && q.length >= 2) { args.push(`%${q}%`); conds.push(`"title" ILIKE $${args.length}`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  args.push(limit);
  const r = await pool.query(
    `SELECT "id","objectId","title","kind","authorName","country","status","protectedAt","authorVerificationLevel"
     FROM "IPCertificate" ${where}
     ORDER BY "protectedAt" DESC LIMIT $${args.length}`,
    args
  );
  res.json({ items: r.rows });
});

// 🔹 Admin: force-revoke a cert (reason required, audit logged).
pipelineRouter.post("/admin/certificate/:certId/revoke", async (req, res) => {
  const a = isPipelineAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureTables();
  const certId = String(req.params.certId);
  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  if (!reason) return res.status(400).json({ error: "reason_required" });
  const cur = await pool.query(
    `SELECT "id","objectId","status" FROM "IPCertificate" WHERE "id" = $1`,
    [certId]
  );
  if (cur.rowCount === 0) return res.status(404).json({ error: "cert_not_found" });
  if (cur.rows[0].status === "revoked") return res.status(409).json({ error: "already_revoked" });
  await pool.query(`UPDATE "IPCertificate" SET "status" = 'revoked' WHERE "id" = $1`, [certId]);
  await logPipelineAudit({
    action: "admin.revoke-cert",
    certId,
    objectId: cur.rows[0].objectId,
    actor: a.email,
    payload: { reason, prevStatus: cur.rows[0].status },
  });
  res.json({ ok: true });
});

// 🔹 Admin: audit reader.
pipelineRouter.get("/admin/audit", async (req, res) => {
  const a = isPipelineAdmin(req);
  if (!a.ok) return res.status(403).json({ error: "admin_required", reason: a.reason });
  await ensureTables();
  const action = String(req.query.action || "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const args: any[] = [];
  let where = "";
  if (action) { args.push(action); where = `WHERE "action" = $1`; }
  args.push(limit);
  const r = await pool.query(
    `SELECT "id","action","certId","objectId","actor","payload","at"
     FROM "PipelineAuditLog" ${where}
     ORDER BY "at" DESC LIMIT $${args.length}`,
    args
  );
  res.json({ items: r.rows });
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 3 amplifier — OG cards, sitemap, per-cert RSS
// (Pipeline has no /pipeline/* frontend; public cert page lives at
//  /bureau/cert/:certId since both surfaces share IPCertificate.)
// ─────────────────────────────────────────────────────────────────────────

function pipelineEsc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pipelineWrap(text: string, perLine: number, maxLines: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > perLine) {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length === maxLines) {
    lines[maxLines - 1] = (lines[maxLines - 1] || "").replace(/\s+\S+$/, "") + "…";
  }
  return lines;
}

// 🔹 GET /certificate/:certId/og.svg — 1200x630 social-share card.
//    Status drives accent (green=active, red=revoked).
pipelineRouter.get("/certificate/:certId/og.svg", async (req, res) => {
  try {
    await ensureTables();
    const certId = String(req.params.certId);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const r = await pool.query(
      `SELECT "id","title","kind","authorName","status","protectedAt","country"
       FROM "IPCertificate" WHERE "id" = $1 LIMIT 1`,
      [certId]
    );
    if (r.rowCount === 0) {
      const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="60" y="320" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="900" fill="#e2e8f0">Certificate not found</text>
  <text x="60" y="380" font-family="ui-monospace, monospace" font-size="24" fill="#64748b">${pipelineEsc(certId)}</text>
</svg>`;
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(fallback);
    }
    const row = r.rows[0] as any;
    const status = String(row.status || "active");
    const protectedAtMs = row.protectedAt
      ? (row.protectedAt instanceof Date ? row.protectedAt.getTime() : new Date(row.protectedAt).getTime())
      : 0;
    if (applyOgEtag(req, res, `pipeline-cert-${certId}-${status}-${protectedAtMs}`)) return;
    const isRevoked = status === "revoked";
    const accent = isRevoked ? "#dc2626" : "#16a34a";
    const label = isRevoked ? "REVOKED" : "ACTIVE";
    const titleLines = pipelineWrap(row.title || certId, 24, 2);
    const protectedAt = row.protectedAt
      ? (row.protectedAt instanceof Date ? row.protectedAt.toISOString() : String(row.protectedAt)).slice(0, 10)
      : null;
    const subLine = [
      row.authorName ? `by ${row.authorName}` : "anonymous author",
      row.kind ? `kind=${row.kind}` : null,
      row.country ? row.country : null,
      protectedAt ? `protected ${protectedAt}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const subLines = pipelineWrap(subLine, 60, 2);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION PIPELINE</text>
    <g transform="translate(60, 170)">
      ${titleLines
        .map(
          (line, i) =>
            `<text y="${i * 92}" font-size="80" font-weight="900" letter-spacing="-2">${pipelineEsc(line)}</text>`
        )
        .join("\n      ")}
    </g>
    <g transform="translate(60, ${170 + titleLines.length * 92 + 40})">
      ${subLines
        .map(
          (line, i) =>
            `<text y="${i * 38}" font-size="28" font-weight="500" fill="#cbd5e1">${pipelineEsc(line)}</text>`
        )
        .join("\n      ")}
    </g>
    <g transform="translate(60, 540)">
      <rect width="${label.length * 18 + 56}" height="44" rx="22" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
      <text x="22" y="30" font-size="22" font-weight="900" fill="${accent}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${pipelineEsc(label)}</text>
    </g>
    <g transform="translate(${1200 - 60}, 540)" text-anchor="end">
      <text font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">${pipelineEsc(certId.slice(0, 18))}</text>
    </g>
  </g>
</svg>`;

    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: "cert og failed", details: err.message });
  }
});

// 🔹 GET /og.svg — index-page social-share card (totals + active + revoked).
pipelineRouter.get("/og.svg", async (req, res) => {
  try {
    await ensureTables();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const totals = await pool.query(
      `SELECT COUNT(*)::int AS "n",
              SUM(CASE WHEN "status"='active' THEN 1 ELSE 0 END)::int AS "active",
              SUM(CASE WHEN "status"='revoked' THEN 1 ELSE 0 END)::int AS "revoked"
       FROM "IPCertificate"`
    );
    const t = (totals.rows[0] || {}) as any;
    const total = t.n || 0;
    const active = t.active || 0;
    const revoked = t.revoked || 0;
    if (applyOgEtag(req, res, `pipeline-index-${total}-${active}-${revoked}`)) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#16a34a"/>
      <stop offset="1" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION PIPELINE</text>
    <text x="60" y="200" font-size="96" font-weight="900" letter-spacing="-2">${pipelineEsc(String(total))} certificates</text>
    <text x="60" y="252" font-size="32" font-weight="600" fill="#cbd5e1">Tamper-evident IP protection — HMAC + Ed25519 + OTS.</text>
    <g transform="translate(60, 380)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <g>
        <rect width="220" height="80" rx="14" fill="#16a34a" fill-opacity="0.15" stroke="#16a34a" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#16a34a">${pipelineEsc(String(active))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#86efac">ACTIVE</text>
      </g>
      <g transform="translate(240, 0)">
        <rect width="220" height="80" rx="14" fill="#dc2626" fill-opacity="0.15" stroke="#dc2626" stroke-width="2"/>
        <text x="20" y="36" font-size="40" font-weight="900" fill="#fca5a5">${pipelineEsc(String(revoked))}</text>
        <text x="20" y="64" font-size="14" font-weight="700" fill="#fecaca">REVOKED</text>
      </g>
    </g>
    <text x="60" y="585" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.tech / pipeline</text>
  </g>
</svg>`;

    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: "index og failed", details: err.message });
  }
});

// 🔹 GET /certificate/:certId/changelog.rss — RSS 2.0 of admin events
//    (force-revoke etc.) sourced from PipelineAuditLog.
pipelineRouter.get("/certificate/:certId/changelog.rss", async (req, res) => {
  try {
    await ensureTables();
    const certId = String(req.params.certId);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const selfUrl = `${proto}://${host}/api/pipeline/certificate/${encodeURIComponent(certId)}/changelog.rss`;
    const siteUrl = `${proto}://${host}/bureau/cert/${encodeURIComponent(certId)}`;

    const certRow = await pool.query(
      `SELECT "title" FROM "IPCertificate" WHERE "id" = $1 LIMIT 1`,
      [certId]
    );
    const certTitle = certRow.rows[0]?.title || certId;

    const r = await pool.query(
      `SELECT "id","action","actor","payload","at"
       FROM "PipelineAuditLog"
       WHERE "certId" = $1
       ORDER BY "at" DESC
       LIMIT $2`,
      [certId, limit]
    );

    function describe(row: any): string {
      const p = row.payload || {};
      switch (row.action) {
        case "admin.revoke-cert":
          return `Force-revoked by ${row.actor || "admin"}${p.reason ? ` — ${p.reason}` : ""}`;
        default:
          return row.action || "Pipeline event";
      }
    }

    const items = r.rows
      .map((row: any) => {
        const at = row.at instanceof Date ? row.at : new Date(row.at);
        const pubDate = at.toUTCString();
        const summary = describe(row);
        const title = `${certTitle} — ${summary}`;
        const guid = `aevion-pipeline-${row.id}`;
        return `    <item>
      <title>${pipelineEsc(title)}</title>
      <link>${pipelineEsc(siteUrl)}</link>
      <guid isPermaLink="false">${pipelineEsc(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${pipelineEsc(summary)}</description>
    </item>`;
      })
      .join("\n");

    const lastBuild = r.rows[0]
      ? (r.rows[0].at instanceof Date ? r.rows[0].at : new Date(r.rows[0].at)).toUTCString()
      : new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AEVION Pipeline · ${pipelineEsc(certTitle)} — events</title>
    <link>${pipelineEsc(siteUrl)}</link>
    <atom:link href="${pipelineEsc(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Admin events for AEVION Pipeline certificate ${pipelineEsc(certId)}.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: "cert rss failed", details: err.message });
  }
});

// 🔹 GET /sitemap.xml — sitemap. Pipeline has no /pipeline/* frontend, so
//    each cert links to its public Bureau page (/bureau/cert/:id). Limited
//    to active certs (revoked → de-indexed).
pipelineRouter.get("/sitemap.xml", async (req, res) => {
  try {
    await ensureTables();
    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const origin = `${proto}://${host}`;
    const today = new Date().toISOString().slice(0, 10);

    const r = await pool.query(
      `SELECT "id","protectedAt"
       FROM "IPCertificate"
       WHERE "status" = 'active'
       ORDER BY "protectedAt" DESC
       LIMIT 5000`
    );

    const urls: string[] = [];
    for (const row of r.rows as any[]) {
      const lastmodSrc = row.protectedAt;
      const lastmod = lastmodSrc
        ? (lastmodSrc instanceof Date ? lastmodSrc.toISOString() : String(lastmodSrc)).slice(0, 10)
        : today;
      urls.push(`  <url>
    <loc>${pipelineEsc(origin)}/bureau/cert/${pipelineEsc(row.id)}</loc>
    <lastmod>${pipelineEsc(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: "sitemap failed", details: err.message });
  }
});
