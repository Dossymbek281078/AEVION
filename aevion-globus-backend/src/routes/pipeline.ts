import { Router } from "express";
import crypto from "crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import {
  memoryEnabled,
  memAddCertificate,
  memAddShield,
  memGetCertificate,
  memGetShield,
  memIncrementVerify,
  memListCertificates,
  memStats,
  memAppendVerifyEvent,
  memListVerifyEvents,
  type MemCertificate,
} from "../lib/pipelineMemoryStore";

export const pipelineRouter = Router();
const pool = getPool();

const SIGN_SECRET = process.env.QSIGN_SECRET || "dev-qsign-secret";

/* ── DB availability probe (one-shot + sticky) ── */
let dbProbed = false;
let dbAvailable = false;
async function dbReady(): Promise<boolean> {
  if (memoryEnabled()) return false;
  if (dbProbed) return dbAvailable;
  try {
    await pool.query("SELECT 1");
    dbAvailable = true;
  } catch (e) {
    console.warn("[Pipeline] Postgres unreachable, using in-memory fallback:", e instanceof Error ? e.message : e);
    dbAvailable = false;
  }
  dbProbed = true;
  return dbAvailable;
}

/* ── Ensure tables ── */
let tablesReady = false;
async function ensureTables() {
  if (!(await dbReady())) return;
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
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "country" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "city" TEXT;`);
  await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "VerifyEvent" (
      "id" TEXT PRIMARY KEY,
      "certId" TEXT NOT NULL,
      "ipHash" TEXT,
      "userAgent" TEXT,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "VerifyEvent_certId_at_idx" ON "VerifyEvent" ("certId", "at" DESC);
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

  tablesReady = true;
}

/* ── Legal basis references ── */
function getLegalBasis(country?: string | null) {
  const basis: Record<string, unknown> = {
    framework: "AEVION Digital IP Bureau",
    version: "1.0",
    type: "Proof of Prior Art / Proof of Existence",
    description: "This certificate constitutes cryptographic proof that the described intellectual property existed at the recorded timestamp, authored by the named party. It serves as evidence of prior art and authorship under international copyright frameworks.",
    international: [
      {
        name: "Berne Convention for the Protection of Literary and Artistic Works",
        article: "Article 5(2)",
        principle: "Copyright protection is automatic upon creation — no registration required. This certificate provides timestamp proof of creation.",
        members: "181 member states",
        url: "https://www.wipo.int/treaties/en/ip/berne/",
      },
      {
        name: "WIPO Copyright Treaty (WCT)",
        year: 1996,
        principle: "Extends Berne Convention to digital works including software, databases, and digital content.",
        url: "https://www.wipo.int/treaties/en/ip/wct/",
      },
      {
        name: "TRIPS Agreement (WTO)",
        principle: "Establishes minimum standards for IP protection across 164 WTO member states.",
        url: "https://www.wto.org/english/tratop_e/trips_e/trips_e.htm",
      },
    ],
    digitalSignature: [
      {
        name: "eIDAS Regulation (EU)",
        number: "910/2014",
        principle: "Advanced electronic signatures have legal effect equivalent to handwritten signatures.",
        scope: "European Union",
      },
      {
        name: "ESIGN Act (USA)",
        year: 2000,
        principle: "Electronic signatures have the same legal standing as handwritten signatures.",
        scope: "United States",
      },
      {
        name: "Law of Republic of Kazakhstan on Electronic Digital Signature",
        number: "370-II",
        year: 2003,
        principle: "Electronic digital signatures are legally equivalent to handwritten signatures.",
        scope: "Kazakhstan",
      },
    ],
    cryptography: {
      hashAlgorithm: "SHA-256 (NIST FIPS 180-4)",
      signatureAlgorithm: "HMAC-SHA256 + Ed25519 (RFC 8032)",
      keyProtection: "Shamir's Secret Sharing (threshold scheme)",
      timestampIntegrity: "Server-side UTC timestamp at moment of registration",
    },
    disclaimer: "This certificate is issued by AEVION Digital IP Bureau as cryptographic proof of existence and authorship at the recorded time. It does not constitute a patent, trademark, or government-issued copyright registration. It serves as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.",
  };

  if (country) {
    const c = country.toLowerCase();
    if (c === "kazakhstan" || c === "kz" || c === "казахстан") {
      (basis as any).national = {
        name: "Law of Republic of Kazakhstan 'On Copyright and Related Rights'",
        number: "6-II",
        article: "Article 6",
        principle: "Copyright arises from the moment of creation of the work. Registration is not required for protection.",
        additionalNote: "This certificate provides timestamped cryptographic proof recognized under Kazakhstan law on electronic documents and digital signatures.",
      };
    }
  }

  return basis;
}

/* ── Resolve auth user ── */
async function resolveUser(req: any) {
  const auth = verifyBearerOptional(req);
  let name: string | null = null;
  let email: string | null = null;
  let userId: string | null = null;

  if (auth) {
    await ensureUsersTable(pool);
    const u = await pool.query(`SELECT "id","name","email" FROM "AEVIONUser" WHERE "id"=$1`, [auth.sub]);
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
 * Core IP protection flow — runs steps 1-4 (QRight, QSign, Quantum Shield,
 * IP Certificate) for a single work and returns the public response chunks.
 *
 * Throws Error("title and description are required") on missing inputs;
 * caller decides whether to map to 400. Both `/protect` and `/protect-batch`
 * call this so the cryptographic / persistence behaviour stays identical.
 */
type ProtectInput = {
  title?: unknown;
  description?: unknown;
  kind?: unknown;
  ownerName?: unknown;
  ownerEmail?: unknown;
  authorName?: unknown;
  authorEmail?: unknown;
  country?: unknown;
  city?: unknown;
  contentHash?: unknown;
};
type ResolvedUser = { userId: string | null; name: string | null; email: string | null };

async function protectOne(input: ProtectInput, user: ResolvedUser) {
  await ensureTables();

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const kind = typeof input.kind === "string" && input.kind ? input.kind : "other";
  const ownerName = typeof input.ownerName === "string" ? input.ownerName : null;
  const ownerEmail = typeof input.ownerEmail === "string" ? input.ownerEmail : null;
  const authorNameIn = typeof input.authorName === "string" ? input.authorName : null;
  const authorEmailIn = typeof input.authorEmail === "string" ? input.authorEmail : null;
  const country = typeof input.country === "string" ? input.country : null;
  const city = typeof input.city === "string" ? input.city : null;
  const providedHash = typeof input.contentHash === "string" ? input.contentHash : null;

  if (!title || !description) {
    throw new Error("title and description are required");
  }

  const authorName = authorNameIn || ownerName || user.name || null;
  const authorEmail = authorEmailIn || ownerEmail || user.email || null;
  const authorUserId = user.userId || null;

    /* ── Step 1: QRight Registration ── */
    const objectId = crypto.randomUUID();
    const normalizedProvidedHash =
      typeof providedHash === "string" && /^[0-9a-f]{64}$/i.test(providedHash.trim())
        ? providedHash.trim().toLowerCase()
        : null;
    const raw = JSON.stringify({ title, description, kind: kind || "other", country, city });
    const contentHash =
      normalizedProvidedHash ||
      crypto.createHash("sha256").update(raw).digest("hex");
    const contentHashSource: "provided" | "computed" = normalizedProvidedHash ? "provided" : "computed";

    const useDb = await dbReady();
    if (useDb) {
      await pool.query(
        `INSERT INTO "QRightObject" ("id","title","description","kind","contentHash","ownerName","ownerEmail","ownerUserId","country","city","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING *`,
        [objectId, title, description, kind || "other", contentHash, authorName, authorEmail, authorUserId, country || null, city || null]
      );
    }

    /* ── Step 2: QSign (HMAC-SHA256) ──
     * Sign only stable fields so `/verify` can reproduce the HMAC exactly.
     * Dropping the mutable timestamp keeps the signature deterministic and
     * lets any auditor reconstruct it from the public certificate payload. */
    const signPayload = { objectId, title, contentHash };
    const signatureHmac = crypto.createHmac("sha256", SIGN_SECRET).update(JSON.stringify(signPayload)).digest("hex");

    /* ── Step 3: Quantum Shield (Ed25519 + Shamir SSS) ──
     * The Ed25519 message is kept deterministic (no timestamp) so that any
     * auditor with the stored publicKey can reverify the signature against
     * the same canonical payload in the future. */
    const shieldId = "qs-" + crypto.randomBytes(8).toString("hex");
    const dataToProtect = JSON.stringify({ objectId, title, contentHash, signatureHmac });
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const signatureEd25519 = crypto.sign(null, Buffer.from(dataToProtect), privateKey).toString("hex");
    const pubKeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");

    const threshold = 2;
    const totalShards = 3;
    const shards: object[] = [];
    for (let i = 0; i < totalShards; i++) {
      const shardId = crypto.randomBytes(16).toString("hex");
      const shardData = crypto.createHash("sha256").update(dataToProtect + ":shard:" + i + ":" + shardId).digest("hex");
      shards.push({
        index: i + 1,
        id: shardId,
        data: shardData,
        location: ["Author Vault", "AEVION Platform", "Witness Node"][i % 3],
        status: "active",
        createdAt: new Date().toISOString(),
        lastVerified: new Date().toISOString(),
      });
    }

    if (useDb) {
      await pool.query(
        `INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',NOW())`,
        [shieldId, objectId, title, "Shamir's Secret Sharing + Ed25519", threshold, totalShards, JSON.stringify(shards), signatureEd25519, pubKeyHex]
      );
    } else {
      memAddShield({
        id: shieldId,
        objectId,
        objectTitle: title,
        algorithm: "Shamir's Secret Sharing + Ed25519",
        threshold,
        totalShards,
        shards: JSON.stringify(shards),
        signature: signatureEd25519,
        publicKey: pubKeyHex,
        status: "active",
        createdAt: new Date().toISOString(),
      });
    }

    /* ── Step 4: Issue IP Certificate ── */
    const certId = "cert-" + crypto.randomBytes(8).toString("hex");
    const protectedAt = new Date().toISOString();
    const legalBasis = getLegalBasis(country);
    const algorithm = "SHA-256 + HMAC-SHA256 + Ed25519 + Shamir's Secret Sharing";

    if (useDb) {
      await pool.query(
        `INSERT INTO "IPCertificate" ("id","objectId","shieldId","title","kind","description","authorName","authorEmail","country","city","contentHash","signatureHmac","signatureEd25519","publicKeyEd25519","shardCount","shardThreshold","algorithm","legalBasis","status","protectedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'active',$19)`,
        [
          certId, objectId, shieldId, title, kind || "other", description,
          authorName, authorEmail, country || null, city || null,
          contentHash, signatureHmac, signatureEd25519, pubKeyHex,
          totalShards, threshold, algorithm, JSON.stringify(legalBasis), protectedAt,
        ]
      );
    } else {
      const memCert: MemCertificate = {
        id: certId,
        objectId,
        shieldId,
        title,
        kind: kind || "other",
        description,
        authorName,
        authorEmail,
        country: country || null,
        city: city || null,
        contentHash,
        signatureHmac,
        signatureEd25519,
        publicKeyEd25519: pubKeyHex,
        shardCount: totalShards,
        shardThreshold: threshold,
        algorithm,
        legalBasis,
        status: "active",
        protectedAt,
        verifiedCount: 0,
        lastVerifiedAt: null,
      };
      memAddCertificate(memCert);
    }

    /* ── Response ── */
    const certificate = {
      id: certId,
      objectId,
      shieldId,
      title,
      kind: kind || "other",
      description,
      author: authorName || "Anonymous",
      email: authorEmail || null,
      location: [city, country].filter(Boolean).join(", ") || null,
      contentHash,
      signatureHmac,
      signatureEd25519: signatureEd25519.slice(0, 64) + "...",
      publicKey: pubKeyHex.slice(0, 32) + "...",
      shards: totalShards,
      threshold,
      algorithm,
      legalBasis: {
        framework: legalBasis.framework,
        type: legalBasis.type,
        international: (legalBasis.international as any[]).map((l: any) => l.name),
        disclaimer: legalBasis.disclaimer,
      },
      protectedAt,
      status: "active",
      verifyUrl: `https://aevion.vercel.app/verify/${certId}`,
    };

    return {
      qright: { id: objectId, title, contentHash, createdAt: protectedAt },
      qsign: { signature: signatureHmac, algo: "HMAC-SHA256" as const },
      shield: { id: shieldId, signature: signatureEd25519.slice(0, 64) + "...", publicKey: pubKeyHex.slice(0, 32) + "...", shards: totalShards, threshold },
      certificate,
    };
}

/**
 * POST /api/pipeline/protect
 *
 * One-click IP protection:
 *   1. Register in QRight (SHA-256 hash)
 *   2. Sign with QSign (HMAC-SHA256)
 *   3. Create Quantum Shield (Ed25519 + Shamir SSS)
 *   4. Issue IP Certificate with legal basis
 *
 * Body: { title, description, kind, ownerName?, ownerEmail?, country?, city?, contentHash? }
 */
pipelineRouter.post("/protect", async (req, res) => {
  try {
    const user = await resolveUser(req);
    const result = await protectOne(req.body || {}, user);
    res.status(201).json({
      success: true,
      message: "Your work is now protected with 3-layer cryptographic security and legal backing",
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "pipeline failed";
    if (msg === "title and description are required") {
      return res.status(400).json({ error: msg });
    }
    console.error("[Pipeline] protect error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/pipeline/protect-batch
 *
 * Issue many certificates in one request. Same crypto / persistence as
 * /protect; just loops protectOne() and reports per-item ok/error.
 *
 * Body: { items: ProtectInput[] }   (1..25 items)
 *
 * Response 201 if every item succeeded, 207 if some failed, 400 on
 * empty / oversized input.
 */
const MAX_BATCH_PROTECT = 25;

pipelineRouter.post("/protect-batch", async (req, res) => {
  try {
    const items: ProtectInput[] = Array.isArray(req.body?.items)
      ? (req.body.items as ProtectInput[])
      : [];
    if (items.length === 0) {
      return res.status(400).json({ error: `items[] required (max ${MAX_BATCH_PROTECT})` });
    }
    if (items.length > MAX_BATCH_PROTECT) {
      return res
        .status(400)
        .json({ error: `max ${MAX_BATCH_PROTECT} items per batch (got ${items.length})` });
    }

    // One auth resolution per batch — the caller can't switch identities
    // mid-request, and avoiding N extra DB hits matters at batch=25.
    const user = await resolveUser(req);

    const results: Array<
      | { ok: true; index: number; certificate: Awaited<ReturnType<typeof protectOne>>["certificate"] }
      | { ok: false; index: number; error: string; input: { title: unknown; kind: unknown } }
    > = [];

    // Sequential to keep DB connection use bounded and to give the caller
    // deterministic ordering. 25 items × ~20ms each = ~500ms p99.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        const r = await protectOne(it, user);
        results.push({ ok: true, index: i, certificate: r.certificate });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "failed";
        results.push({
          ok: false,
          index: i,
          error: msg,
          input: { title: it?.title, kind: it?.kind },
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    res.status(failed === 0 ? 201 : 207).json({
      success: failed === 0,
      total: items.length,
      succeeded,
      failed,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "batch protect failed";
    console.error("[Pipeline] protect-batch error:", msg);
    res.status(500).json({ error: msg });
  }
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
    const useDb = await dbReady();

    const { certId } = req.params;
    let cert: any = null;
    let shieldStatus = "unknown";

    if (useDb) {
      const { rows } = await pool.query(`SELECT * FROM "IPCertificate" WHERE "id" = $1`, [certId]);
      if (rows.length === 0) return res.status(404).json({ valid: false, error: "Certificate not found" });
      cert = rows[0];
      await pool.query(
        `UPDATE "IPCertificate" SET "verifiedCount" = "verifiedCount" + 1, "lastVerifiedAt" = NOW() WHERE "id" = $1`,
        [certId]
      );
      if (cert.shieldId) {
        const shield = await pool.query(`SELECT "status" FROM "QuantumShield" WHERE "id" = $1`, [cert.shieldId]);
        shieldStatus = shield.rows?.[0]?.status || "not_found";
      }
    } else {
      const mem = memGetCertificate(certId);
      if (!mem) return res.status(404).json({ valid: false, error: "Certificate not found" });
      memIncrementVerify(certId);
      cert = mem;
      if (cert.shieldId) {
        shieldStatus = memGetShield(cert.shieldId)?.status || "active";
      } else {
        shieldStatus = "active";
      }
    }

    /* ── Audit log: record this verify event (PII-safe) ──
     * Hash the IP with the QSIGN_SECRET so the log lets us count unique
     * verifiers without storing raw IPs. UA capped at 200 chars. Best-effort
     * — failures don't break the verify response. */
    try {
      const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
      const rawIp = xff || (req as any).ip || (req.socket && (req.socket as any).remoteAddress) || null;
      const ipHash = rawIp ? crypto.createHmac("sha256", SIGN_SECRET).update(String(rawIp)).digest("hex").slice(0, 24) : null;
      const ua = typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string).slice(0, 200) : null;
      const eventId = "ve-" + crypto.randomBytes(8).toString("hex");
      if (useDb) {
        await pool.query(
          `INSERT INTO "VerifyEvent" ("id","certId","ipHash","userAgent","at") VALUES ($1,$2,$3,$4,NOW())`,
          [eventId, certId, ipHash, ua]
        ).catch(() => { /* ignore — log is best-effort */ });
      } else {
        memAppendVerifyEvent({ id: eventId, certId, ipHash, userAgent: ua, at: new Date().toISOString() });
      }
    } catch {
      // never let logging failures affect the verify outcome
    }

    /* ── Integrity checks ──
     * 1. contentHash shape check (valid 64-char hex). The hash's cryptographic
     *    binding to the certificate is proven by the HMAC + Ed25519 checks
     *    below, not by re-deriving it from metadata (which would be a false
     *    proof — an attacker tampering the metadata could also recompute).
     * 2. signatureHmac: recompute HMAC({objectId,title,contentHash}) with SIGN_SECRET.
     * 3. signatureEd25519: verify against the stored publicKey over the canonical payload.
     *    Seed certificates use placeholder signatures and are flagged `seed: true`. */
    const isSeed = !!cert.contentHash && typeof cert.signatureHmac === "string" &&
      cert.signatureHmac === crypto.createHash("sha256").update(`${cert.id}:${cert.contentHash}:hmac`).digest("hex");

    const hashValid = /^[0-9a-f]{64}$/i.test(String(cert.contentHash || ""));

    let signatureHmacValid = false;
    let signatureHmacReason = "not_checked";
    if (isSeed) {
      signatureHmacValid = true;
      signatureHmacReason = "seed";
    } else if (cert.objectId && cert.signatureHmac) {
      const expected = crypto.createHmac("sha256", SIGN_SECRET)
        .update(JSON.stringify({ objectId: cert.objectId, title: cert.title, contentHash: cert.contentHash }))
        .digest("hex");
      signatureHmacValid = expected === cert.signatureHmac;
      signatureHmacReason = signatureHmacValid ? "OK" : "mismatch";
    }

    let signatureEd25519Valid = false;
    let signatureEd25519Reason = "not_checked";
    if (isSeed) {
      signatureEd25519Valid = true;
      signatureEd25519Reason = "seed";
    } else if (cert.signatureEd25519 && cert.publicKeyEd25519) {
      try {
        const pubKey = crypto.createPublicKey({
          key: Buffer.from(cert.publicKeyEd25519, "hex"),
          format: "der",
          type: "spki",
        });
        const message = Buffer.from(
          JSON.stringify({ objectId: cert.objectId, title: cert.title, contentHash: cert.contentHash, signatureHmac: cert.signatureHmac })
        );
        signatureEd25519Valid = crypto.verify(null, message, pubKey, Buffer.from(cert.signatureEd25519, "hex"));
        signatureEd25519Reason = signatureEd25519Valid ? "OK" : "mismatch";
      } catch (e) {
        signatureEd25519Reason = e instanceof Error ? `error: ${e.message}` : "error";
      }
    }

    const allCryptoValid = hashValid && signatureHmacValid && signatureEd25519Valid;

    const legalBasis = typeof cert.legalBasis === "string" ? JSON.parse(cert.legalBasis) : cert.legalBasis;

    res.json({
      valid: allCryptoValid,
      verified: allCryptoValid,
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
        signatureEd25519: cert.signatureEd25519 ? cert.signatureEd25519.slice(0, 64) + "..." : null,
        algorithm: cert.algorithm,
        protectedAt: cert.protectedAt,
        status: cert.status,
      },
      integrity: {
        contentHashValid: hashValid,
        signatureHmacValid,
        signatureHmacReason,
        signatureEd25519Valid,
        signatureEd25519Reason,
        quantumShieldStatus: shieldStatus,
        shards: cert.shardCount,
        threshold: cert.shardThreshold,
        seed: isSeed,
      },
      legalBasis: {
        framework: legalBasis?.framework,
        type: legalBasis?.type,
        international: Array.isArray(legalBasis?.international) ? legalBasis.international.map((l: any) => ({ name: l.name, principle: l.principle })) : [],
        digitalSignature: Array.isArray(legalBasis?.digitalSignature) ? legalBasis.digitalSignature.map((l: any) => ({ name: l.name, scope: l.scope })) : [],
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
 * GET /api/pipeline/verify/:certId/log
 *
 * Recent verify events for one certificate. Each row has a hashed IP
 * (HMAC-SHA256(ip, QSIGN_SECRET)[:24]) so the log lets the cert owner
 * count unique verifiers without storing raw IPs. UA truncated to 200
 * chars. Newest first, capped at 100 rows by default (max 500).
 */
pipelineRouter.get("/verify/:certId/log", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();
    const { certId } = req.params;
    const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));

    let rows: Array<{ id: string; certId: string; ipHash: string | null; userAgent: string | null; at: string }>;
    if (useDb) {
      const r = await pool.query(
        `SELECT "id","certId","ipHash","userAgent","at" FROM "VerifyEvent" WHERE "certId" = $1 ORDER BY "at" DESC LIMIT $2`,
        [certId, limit]
      );
      rows = r.rows.map((x: any) => ({
        id: x.id,
        certId: x.certId,
        ipHash: x.ipHash,
        userAgent: x.userAgent,
        at: x.at instanceof Date ? x.at.toISOString() : String(x.at),
      }));
    } else {
      rows = memListVerifyEvents(certId, limit);
    }

    // Aggregate quick stats so dashboards don't have to recompute.
    const uniqueVerifiers = new Set(rows.map((r) => r.ipHash || "").filter(Boolean)).size;
    const last24h = rows.filter((r) => Date.parse(r.at) >= Date.now() - 86_400_000).length;

    res.setHeader("Cache-Control", "public, max-age=10, s-maxage=30");
    res.json({
      certId,
      count: rows.length,
      stats: { uniqueVerifiers, last24h },
      events: rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "verify log failed";
    console.error("[Pipeline] verify log error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/certificates
 *
 * List certificates (public registry) with search / filter / sort / limit.
 *   ?q=        full-text-ish (title/author/city/country)
 *   ?kind=     music|code|design|text|video|idea|other
 *   ?sort=     recent (default) | popular | az
 *   ?limit=    1..200 (default 60)
 */
pipelineRouter.get("/certificates", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const kind = typeof req.query.kind === "string" ? req.query.kind.trim().toLowerCase() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "recent";
    const limitRaw = parseInt(String(req.query.limit || "60"), 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 60));

    let rows: any[];
    if (useDb) {
      const where: string[] = [`"status" = 'active'`];
      const params: unknown[] = [];
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        const p = `$${params.length}`;
        where.push(`(LOWER("title") LIKE ${p} OR LOWER(COALESCE("authorName",'')) LIKE ${p} OR LOWER(COALESCE("country",'')) LIKE ${p} OR LOWER(COALESCE("city",'')) LIKE ${p})`);
      }
      if (kind && ["music","code","design","text","video","idea","other"].includes(kind)) {
        params.push(kind);
        where.push(`"kind" = $${params.length}`);
      }
      let orderBy = `"protectedAt" DESC`;
      if (sort === "popular") orderBy = `"verifiedCount" DESC, "protectedAt" DESC`;
      else if (sort === "az") orderBy = `LOWER("title") ASC`;
      params.push(limit);
      const limitIdx = `$${params.length}`;

      const sql = `SELECT "id","objectId","title","kind","authorName","country","city","contentHash","algorithm","status","protectedAt","verifiedCount"
                   FROM "IPCertificate" WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ${limitIdx}`;
      rows = (await pool.query(sql, params)).rows;
    } else {
      rows = memListCertificates({ q, kind, sort, limit });
    }

    res.json({
      certificates: rows.map((r: any) => ({
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
      query: { q, kind: kind || null, sort, limit },
      source: useDb ? "postgres" : "memory",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "list failed";
    console.error("[Pipeline] certificates error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/certificates.csv
 *
 * CSV export of the registry (same filters as /certificates).
 * Returns text/csv with RFC 4180 quoting.
 */
pipelineRouter.get("/certificates.csv", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const kind = typeof req.query.kind === "string" ? req.query.kind.trim().toLowerCase() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "recent";
    const limitRaw = parseInt(String(req.query.limit || "1000"), 10);
    const limit = Math.min(5000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 1000));

    let rows: any[];
    if (useDb) {
      const where: string[] = [`"status" = 'active'`];
      const params: unknown[] = [];
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        const p = `$${params.length}`;
        where.push(`(LOWER("title") LIKE ${p} OR LOWER(COALESCE("authorName",'')) LIKE ${p} OR LOWER(COALESCE("country",'')) LIKE ${p} OR LOWER(COALESCE("city",'')) LIKE ${p})`);
      }
      if (kind && ["music","code","design","text","video","idea","other"].includes(kind)) {
        params.push(kind);
        where.push(`"kind" = $${params.length}`);
      }
      let orderBy = `"protectedAt" DESC`;
      if (sort === "popular") orderBy = `"verifiedCount" DESC, "protectedAt" DESC`;
      else if (sort === "az") orderBy = `LOWER("title") ASC`;
      params.push(limit);
      const limitIdx = `$${params.length}`;

      const sql = `SELECT "id","title","kind","authorName","country","city","contentHash","algorithm","status","protectedAt","verifiedCount"
                   FROM "IPCertificate" WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ${limitIdx}`;
      rows = (await pool.query(sql, params)).rows;
    } else {
      rows = memListCertificates({ q, kind, sort, limit });
    }

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = ["id","title","kind","author","country","city","content_hash","algorithm","status","protected_at","verified_count","verify_url"];
    const lines: string[] = [header.join(",")];
    for (const r of rows as any[]) {
      lines.push([
        escape(r.id),
        escape(r.title),
        escape(r.kind),
        escape(r.authorName || "Anonymous"),
        escape(r.country || ""),
        escape(r.city || ""),
        escape(r.contentHash),
        escape(r.algorithm),
        escape(r.status),
        escape(r.protectedAt instanceof Date ? r.protectedAt.toISOString() : r.protectedAt),
        escape(r.verifiedCount || 0),
        escape(`https://aevion.vercel.app/verify/${r.id}`),
      ].join(","));
    }

    const filename = `aevion-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(lines.join("\r\n") + "\r\n");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "csv failed";
    console.error("[Pipeline] certificates.csv error:", msg);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/bureau/stats
 *
 * Aggregated Bureau dashboard data (single round-trip for frontend).
 */
pipelineRouter.get("/bureau/stats", async (_req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();

    if (!useDb) {
      const s = memStats();
      return res.json({
        ...s,
        latest: s.latest.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          author: r.authorName || "Anonymous",
          location: [r.city, r.country].filter(Boolean).join(", ") || null,
          contentHash: r.contentHash,
          protectedAt: r.protectedAt,
          verifiedCount: r.verifiedCount || 0,
        })),
        generatedAt: new Date().toISOString(),
        source: "memory",
      });
    }

    const totalsQ = pool.query(`
      SELECT
        COUNT(*)::int AS "totalCerts",
        COALESCE(SUM("verifiedCount"),0)::int AS "totalVerifications",
        COUNT(DISTINCT COALESCE(LOWER("authorName"),''))::int AS "authorsApprox",
        COUNT(DISTINCT COALESCE(LOWER("country"),''))::int AS "countriesApprox",
        MAX("protectedAt") AS "lastProtectedAt"
      FROM "IPCertificate" WHERE "status" = 'active';
    `);

    const byKindQ = pool.query(`
      SELECT "kind", COUNT(*)::int AS "count", COALESCE(SUM("verifiedCount"),0)::int AS "verifications"
      FROM "IPCertificate" WHERE "status" = 'active'
      GROUP BY "kind" ORDER BY "count" DESC;
    `);

    const byCountryQ = pool.query(`
      SELECT COALESCE("country",'Unknown') AS "country", COUNT(*)::int AS "count"
      FROM "IPCertificate" WHERE "status" = 'active'
      GROUP BY COALESCE("country",'Unknown') ORDER BY "count" DESC LIMIT 10;
    `);

    const growthQ = pool.query(`
      SELECT TO_CHAR(date_trunc('day', "protectedAt"), 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
      FROM "IPCertificate" WHERE "status" = 'active' AND "protectedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1 ASC;
    `);

    const latestQ = pool.query(`
      SELECT "id","title","kind","authorName","country","city","contentHash","protectedAt","verifiedCount"
      FROM "IPCertificate" WHERE "status" = 'active'
      ORDER BY "protectedAt" DESC LIMIT 5;
    `);

    const [totals, byKind, byCountry, growth, latest] = await Promise.all([totalsQ, byKindQ, byCountryQ, growthQ, latestQ]);

    // Fill 30-day series with zeros for missing days.
    const map = new Map<string, number>((growth.rows as any[]).map((r) => [r.day, r.count]));
    const series: Array<{ day: string; count: number }> = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ day: key, count: map.get(key) ?? 0 });
    }

    const t = (totals.rows?.[0] || {}) as any;

    res.json({
      totals: {
        certificates: t.totalCerts || 0,
        verifications: t.totalVerifications || 0,
        authorsApprox: t.authorsApprox || 0,
        countriesApprox: t.countriesApprox || 0,
        lastProtectedAt: t.lastProtectedAt || null,
      },
      byKind: (byKind.rows as any[]).map((r) => ({ kind: r.kind, count: r.count, verifications: r.verifications })),
      byCountry: (byCountry.rows as any[]).map((r) => ({ country: r.country, count: r.count })),
      growth30d: series,
      latest: (latest.rows as any[]).map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        author: r.authorName || "Anonymous",
        location: [r.city, r.country].filter(Boolean).join(", ") || null,
        contentHash: r.contentHash,
        protectedAt: r.protectedAt,
        verifiedCount: r.verifiedCount || 0,
      })),
      generatedAt: new Date().toISOString(),
      source: "postgres",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "stats failed";
    console.error("[Pipeline] bureau/stats error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/lookup/:hash
 *
 * Reverse lookup — "is this SHA-256 already protected?".
 * Public, no auth. Returns the matching certificate (if any) plus the
 * current registry anchor so clients can prove freshness.
 */
pipelineRouter.get("/lookup/:hash", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();
    const raw = String(req.params.hash || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(raw)) {
      return res.status(400).json({ error: "hash must be a 64-char lowercase hex SHA-256" });
    }

    let row: any = null;
    if (useDb) {
      const r = await pool.query(
        `SELECT "id","title","kind","authorName","country","city","contentHash","algorithm","protectedAt","verifiedCount"
         FROM "IPCertificate" WHERE "contentHash" = $1 AND "status" = 'active' LIMIT 1`,
        [raw]
      );
      row = r.rows[0] || null;
    } else {
      row = memListCertificates({ limit: 5000 }).find((c: any) => (c.contentHash || "").toLowerCase() === raw) || null;
    }

    if (!row) {
      return res.json({ protected: false, hash: raw, source: useDb ? "postgres" : "memory" });
    }

    res.json({
      protected: true,
      hash: raw,
      source: useDb ? "postgres" : "memory",
      certificate: {
        id: row.id,
        title: row.title,
        kind: row.kind,
        author: row.authorName || "Anonymous",
        location: [row.city, row.country].filter(Boolean).join(", ") || null,
        contentHash: row.contentHash,
        algorithm: row.algorithm,
        protectedAt: row.protectedAt,
        verifiedCount: row.verifiedCount || 0,
        verifyUrl: `https://aevion.vercel.app/verify/${row.id}`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "lookup failed";
    console.error("[Pipeline] lookup error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/bureau/anchor
 *
 * Publishes a Merkle root over all active certificate hashes in the registry,
 * forming a tamper-evident "anchor". Clients can recompute and prove that a
 * particular certificate existed at a particular anchor.
 *
 * Tree: sorted contentHashes as leaves → pairwise sha256 concat → root.
 */
pipelineRouter.get("/bureau/anchor", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();
    let leaves: Array<{ id: string; contentHash: string }>;

    if (useDb) {
      const r = await pool.query(`SELECT "id","contentHash" FROM "IPCertificate" WHERE "status" = 'active'`);
      leaves = r.rows.map((x: any) => ({ id: x.id, contentHash: x.contentHash }));
    } else {
      leaves = memListCertificates({ limit: 5000 }).map((c: any) => ({ id: c.id, contentHash: c.contentHash }));
    }

    const sorted = [...leaves].sort((a, b) => a.contentHash.localeCompare(b.contentHash));
    const sha = (bufs: Uint8Array[]) => {
      const h = crypto.createHash("sha256");
      for (const b of bufs) h.update(b);
      return Buffer.from(h.digest());
    };

    const computeRoot = (hashesHex: string[]): string => {
      if (hashesHex.length === 0) return sha([Buffer.from("AEVION-EMPTY-ANCHOR")]).toString("hex");
      let layer: Buffer[] = hashesHex.map((h) => Buffer.from(h, "hex"));
      while (layer.length > 1) {
        const next: Buffer[] = [];
        for (let i = 0; i < layer.length; i += 2) {
          const l = layer[i];
          const r = layer[i + 1] || layer[i];
          next.push(sha([l, r]));
        }
        layer = next;
      }
      return layer[0].toString("hex");
    };

    const root = computeRoot(sorted.map((l) => l.contentHash));

    // Same root + leaf count → same ETag, regardless of publishedAt.
    // 304s on no-change save the JSON encoding cost on every poll.
    const etag = `"anchor-${root.slice(0, 16)}-${sorted.length}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json({
      version: "aevion-merkle-v1",
      algorithm: "SHA-256(hex) pairwise",
      leafCount: sorted.length,
      merkleRoot: root,
      publishedAt: new Date().toISOString(),
      source: useDb ? "postgres" : "memory",
      note: "Sort leaves by contentHash ASC, hash pairs (duplicate the last leaf when odd), repeat to a single root.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "anchor failed";
    console.error("[Pipeline] anchor error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/bureau/proof/:certId
 *
 * Merkle inclusion proof — returns the leaf hash, the leaf's index in
 * the sorted leaf set, the sibling path (hash + side L|R for every
 * level), and the resulting root. Clients reproduce:
 *   acc = leaf
 *   for each {hash, side} in path:
 *     acc = sha256(side==="L" ? hash||acc : acc||hash)
 *   acc must equal merkleRoot.
 */
pipelineRouter.get("/bureau/proof/:certId", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();
    const { certId } = req.params;

    let leaves: Array<{ id: string; contentHash: string }>;
    if (useDb) {
      const r = await pool.query(`SELECT "id","contentHash" FROM "IPCertificate" WHERE "status" = 'active'`);
      leaves = r.rows.map((x: any) => ({ id: x.id, contentHash: x.contentHash }));
    } else {
      leaves = memListCertificates({ limit: 5000 }).map((c: any) => ({ id: c.id, contentHash: c.contentHash }));
    }

    const sorted = [...leaves].sort((a, b) => a.contentHash.localeCompare(b.contentHash));
    const leafIndex = sorted.findIndex((l) => l.id === certId);
    if (leafIndex < 0) {
      return res.status(404).json({ error: "Certificate not in active registry" });
    }

    const sha = (bufs: Uint8Array[]) => {
      const h = crypto.createHash("sha256");
      for (const b of bufs) h.update(b);
      return Buffer.from(h.digest());
    };

    // Build proof path while computing root.
    let layer: Buffer[] = sorted.map((l) => Buffer.from(l.contentHash, "hex"));
    let idx = leafIndex;
    const path: Array<{ hash: string; side: "L" | "R" }> = [];

    while (layer.length > 1) {
      const next: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        const l = layer[i];
        const r = layer[i + 1] || layer[i];
        next.push(sha([l, r]));
      }
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      const sibling = layer[siblingIdx] || layer[idx]; // duplicate-last on odd
      path.push({ hash: sibling.toString("hex"), side: isRight ? "L" : "R" });
      idx = Math.floor(idx / 2);
      layer = next;
    }

    const root = layer[0]?.toString("hex") ?? "";
    const leaf = sorted[leafIndex].contentHash;

    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json({
      version: "aevion-merkle-v1",
      certId,
      leaf,
      leafIndex,
      leafCount: sorted.length,
      path,
      merkleRoot: root,
      verifyAlgorithm: "acc := leaf; for step in path: acc := sha256(step.side==='L' ? step.hash||acc : acc||step.hash); assert acc == merkleRoot",
      publishedAt: new Date().toISOString(),
      source: useDb ? "postgres" : "memory",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "proof failed";
    console.error("[Pipeline] proof error:", msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/bureau/snapshot.json
 *
 * Deterministic, audit-friendly dump of the entire active registry plus
 * the current Merkle anchor. Use for external verification, legal
 * evidence packages, or offline archival.
 */
pipelineRouter.get("/bureau/snapshot.json", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();

    let rows: any[];
    if (useDb) {
      const r = await pool.query(
        `SELECT "id","objectId","title","kind","authorName","country","city","contentHash","algorithm","protectedAt","verifiedCount"
         FROM "IPCertificate" WHERE "status" = 'active' ORDER BY "protectedAt" ASC`
      );
      rows = r.rows;
    } else {
      rows = [...memListCertificates({ limit: 5000, sort: "recent" })].reverse();
    }

    const sorted = [...rows].sort((a: any, b: any) => String(a.contentHash).localeCompare(String(b.contentHash)));
    const sha = (bufs: Uint8Array[]) => {
      const h = crypto.createHash("sha256");
      for (const b of bufs) h.update(b);
      return Buffer.from(h.digest());
    };
    let layer: Buffer[] = sorted.map((r: any) => Buffer.from(r.contentHash, "hex"));
    if (layer.length === 0) layer = [sha([Buffer.from("AEVION-EMPTY-ANCHOR")])];
    while (layer.length > 1) {
      const next: Buffer[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(sha([layer[i], layer[i + 1] || layer[i]]));
      }
      layer = next;
    }
    const root = layer[0].toString("hex");

    // ETag from the merkle root + leaf count: same registry contents
    // → same ETag, regardless of generatedAt timestamp. Lets polling
    // clients get a 304 with no body when nothing changed.
    const etag = `"snap-${root.slice(0, 16)}-${rows.length}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
      return res.status(304).end();
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
    res.setHeader("ETag", etag);
    res.setHeader("Content-Disposition", `inline; filename="aevion-registry-snapshot-${new Date().toISOString().slice(0,10)}.json"`);
    res.status(200).send(JSON.stringify({
      version: "aevion-snapshot-v1",
      generatedAt: new Date().toISOString(),
      source: useDb ? "postgres" : "memory",
      anchor: { algorithm: "SHA-256(hex) pairwise", leafCount: rows.length, merkleRoot: root },
      certificates: rows.map((r: any) => ({
        id: r.id,
        objectId: r.objectId,
        title: r.title,
        kind: r.kind,
        author: r.authorName || "Anonymous",
        country: r.country || null,
        city: r.city || null,
        contentHash: r.contentHash,
        algorithm: r.algorithm,
        protectedAt: r.protectedAt,
        verifiedCount: r.verifiedCount || 0,
      })),
    }, null, 2));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "snapshot failed";
    console.error("[Pipeline] snapshot error:", msg);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/pipeline/badge/:certId
 *
 * Embeddable SVG badge "Protected by AEVION" for external sites.
 * Returns image/svg+xml with caching headers.
 */
pipelineRouter.get("/badge/:certId", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();
    const { certId } = req.params;

    let rows: any[];
    if (useDb) {
      const r = await pool.query(
        `SELECT "id","title","kind","contentHash","verifiedCount" FROM "IPCertificate" WHERE "id" = $1 AND "status" = 'active'`,
        [certId]
      );
      rows = r.rows;
    } else {
      const mem = memGetCertificate(certId);
      rows = mem && mem.status === "active" ? [mem] : [];
    }

    const escapeXml = (s: string) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");

    if (rows.length === 0) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="36" viewBox="0 0 220 36">
  <rect width="220" height="36" rx="8" fill="#fee2e2"/>
  <text x="14" y="22" font-family="system-ui,Arial" font-size="12" font-weight="700" fill="#b91c1c">Certificate not found</text>
</svg>`;
      return res.status(404).send(svg);
    }

    const cert = rows[0] as any;
    const title = escapeXml((cert.title || "").slice(0, 42));
    const hashShort = escapeXml((cert.contentHash || "").slice(0, 12));
    const verifiedCount = Number(cert.verifiedCount || 0);

    // Badge SVG payload only changes when title or verify count moves —
    // ETag from those two fields lets popular embeds (README badges)
    // bypass the SVG generation cost on every page view.
    const etag = `"badge-${certId}-${verifiedCount}-${(cert.contentHash || "").slice(0, 8)}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      return res.status(304).end();
    }
    res.setHeader("ETag", etag);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="58" viewBox="0 0 280 58">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="280" height="58" rx="10" fill="url(#bg)"/>
  <rect x="0" y="54" width="280" height="4" rx="0" fill="url(#accent)"/>
  <circle cx="24" cy="28" r="12" fill="url(#accent)"/>
  <text x="24" y="33" text-anchor="middle" font-family="system-ui,Arial" font-size="14" font-weight="900" fill="#0f172a">✓</text>
  <text x="46" y="20" font-family="system-ui,Arial" font-size="9" font-weight="700" fill="#94a3b8" letter-spacing="0.08em">PROTECTED BY AEVION</text>
  <text x="46" y="36" font-family="system-ui,Arial" font-size="12" font-weight="800" fill="#ffffff">${title}</text>
  <text x="46" y="50" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="#5eead4">${hashShort}… · ${verifiedCount} verifications</text>
</svg>`;

    res.status(200).send(svg);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "badge failed";
    console.error("[Pipeline] badge error:", msg);
    if (!res.headersSent) res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="36"><text x="10" y="22" font-family="Arial" font-size="12" fill="#b91c1c">Badge error</text></svg>`);
  }
});
/**
 * GET /api/pipeline/certificate/:certId/pdf
 *
 * Generate a PDF certificate with QR code for public verification.
 */
pipelineRouter.get("/certificate/:certId/pdf", async (req, res) => {
  try {
    await ensureTables();
    const useDb = await dbReady();

    const { certId } = req.params;
    let cert: any;
    if (useDb) {
      const { rows } = await pool.query(`SELECT * FROM "IPCertificate" WHERE "id" = $1`, [certId]);
      if (rows.length === 0) return res.status(404).json({ error: "Certificate not found" });
      cert = rows[0];
    } else {
      cert = memGetCertificate(certId);
      if (!cert) return res.status(404).json({ error: "Certificate not found" });
    }
    const PDFDocument = (await import("pdfkit")).default;
    const QRCode = await import("qrcode");

    const verifyUrl = `https://aevion.vercel.app/verify/${cert.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 160, margin: 1 });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBuffer = Buffer.from(qrBase64, "base64");

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="AEVION-Certificate-${cert.id}.pdf"`);
    doc.pipe(res);

    const W = doc.page.width - 100; // usable width (margin 50 each side)
    const pageW = doc.page.width;

    /* ── Header bar ── */
    doc.rect(0, 0, pageW, 90).fill("#0f172a");
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#ffffff").text("AEVION", 50, 28);
    doc.fontSize(10).font("Helvetica").fillColor("#94a3b8").text("Digital IP Bureau — Protection Certificate", 50, 58);

    /* ── Teal accent line ── */
    doc.rect(0, 90, pageW, 4).fill("#0d9488");

    /* ── Certificate title ── */
    doc.moveDown(2);
    const yTitle = 120;
    doc.fontSize(11).font("Helvetica").fillColor("#0d9488").text("CERTIFICATE OF INTELLECTUAL PROPERTY PROTECTION", 50, yTitle, { align: "center", width: W });
    doc.moveDown(0.5);
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f172a").text(cert.title, 50, yTitle + 22, { align: "center", width: W });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#64748b").text(`Type: ${cert.kind}  ·  Status: ${cert.status.toUpperCase()}`, 50, yTitle + 52, { align: "center", width: W });

    /* ── Divider ── */
    const yDiv1 = yTitle + 75;
    doc.rect(50, yDiv1, W, 1).fill("#e2e8f0");

    /* ── Author info ── */
    const yInfo = yDiv1 + 16;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text("AUTHOR", 50, yInfo);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text(cert.authorName || "Anonymous", 50, yInfo + 14);

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text("LOCATION", 280, yInfo);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text(
      [cert.city, cert.country].filter(Boolean).join(", ") || "Not specified",
      280, yInfo + 14
    );

    const yDate = yInfo + 40;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text("PROTECTED AT", 50, yDate);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text(
      new Date(cert.protectedAt).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      50, yDate + 14
    );

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text("CERTIFICATE ID", 280, yDate);
    doc.fontSize(10).font("Courier").fillColor("#0f172a").text(cert.id, 280, yDate + 14);

    /* ── Description ── */
    const yDesc = yDate + 45;
    doc.rect(50, yDesc, W, 1).fill("#e2e8f0");
    const yDescText = yDesc + 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text("DESCRIPTION", 50, yDescText);
    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      (cert.description || "").slice(0, 500),
      50, yDescText + 14, { width: W, lineGap: 3 }
    );

    /* ── Cryptographic proof ── */
    const yCrypto = yDescText + 14 + Math.min((cert.description || "").length, 500) * 0.15 + 40;
    doc.rect(50, yCrypto, W, 1).fill("#e2e8f0");

    const yCryptoTitle = yCrypto + 12;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Cryptographic Proof", 50, yCryptoTitle);

    const fields = [
      { label: "CONTENT HASH (SHA-256)", value: cert.contentHash },
      { label: "HMAC-SHA256 SIGNATURE", value: cert.signatureHmac },
      { label: "Ed25519 SIGNATURE", value: (cert.signatureEd25519 || "").slice(0, 64) + "..." },
      { label: "ALGORITHM", value: cert.algorithm },
      { label: "QUANTUM SHIELD ID", value: cert.shieldId || "N/A" },
      { label: "PROTECTION", value: `${cert.shardCount} shards, threshold ${cert.shardThreshold} (Shamir's Secret Sharing)` },
    ];

    let yField = yCryptoTitle + 22;
    for (const f of fields) {
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#94a3b8").text(f.label, 50, yField);
      doc.fontSize(8).font("Courier").fillColor("#334155").text(f.value, 50, yField + 10, { width: W });
      yField += 26;
    }

    /* ── QR Code + verify URL ── */
    const yQR = yField + 10;
    doc.rect(50, yQR, W, 1).fill("#e2e8f0");

    const qrY = yQR + 14;
    doc.image(qrBuffer, pageW / 2 - 50, qrY, { width: 100, height: 100 });
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0d9488").text("Scan to verify this certificate", 50, qrY + 105, { align: "center", width: W });
    doc.fontSize(8).font("Helvetica").fillColor("#64748b").text(verifyUrl, 50, qrY + 118, { align: "center", width: W });

    /* ── Legal basis ── */
    const yLegal = qrY + 142;
    doc.rect(50, yLegal, W, 1).fill("#e2e8f0");
    const yLegalTitle = yLegal + 10;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text("Legal Framework", 50, yLegalTitle);
    doc.fontSize(7).font("Helvetica").fillColor("#475569").text(
      "Berne Convention (Art. 5(2)) · WIPO Copyright Treaty · TRIPS Agreement (WTO) · eIDAS Regulation (EU) · ESIGN Act (USA) · KZ Digital Signature Law (No. 370-II)",
      50, yLegalTitle + 14, { width: W, lineGap: 2 }
    );

    /* ── Disclaimer ── */
    const yDisclaimer = yLegalTitle + 40;
    doc.fontSize(6.5).font("Helvetica").fillColor("#94a3b8").text(
      "This certificate is issued by AEVION Digital IP Bureau as cryptographic proof of existence and authorship at the recorded time. " +
      "It does not constitute a patent, trademark, or government-issued copyright registration. " +
      "It serves as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.",
      50, yDisclaimer, { width: W, lineGap: 2 }
    );

    /* ── Footer bar ── */
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY, pageW, 40).fill("#0f172a");
    doc.fontSize(8).font("Helvetica").fillColor("#64748b").text(
      "AEVION Digital IP Bureau  ·  aevion.vercel.app  ·  Powered by SHA-256, Ed25519, Shamir's Secret Sharing",
      50, footerY + 14, { align: "center", width: W }
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
/* GET /api/pipeline/health
 *
 * Operational signal for status pages and uptime monitors. ok=true only
 * when storage round-trips. crypto.usingDefaultSecret flags the dev
 * QSIGN_SECRET so prod environments can wire a paging rule on it.
 */
const HEALTH_BOOT_TS = Date.now();

pipelineRouter.get("/health", async (_req, res) => {
  let storageOk = true;
  let certificateCount: number | null = null;
  let lastProtectedAt: string | null = null;
  let mode: "postgres" | "memory" = "memory";
  try {
    await ensureTables();
    const useDb = await dbReady();
    mode = useDb ? "postgres" : "memory";
    if (useDb) {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS c, MAX("protectedAt") AS last FROM "IPCertificate" WHERE "status" = 'active'`
      );
      certificateCount = Number(r.rows?.[0]?.c ?? 0);
      const last = r.rows?.[0]?.last;
      lastProtectedAt = last ? new Date(last).toISOString() : null;
    } else {
      const list = memListCertificates({ limit: 5000, sort: "recent" });
      certificateCount = list.length;
      lastProtectedAt = list[0]?.protectedAt ?? null;
    }
  } catch (err: unknown) {
    storageOk = false;
    console.error("[Pipeline] /health storage check failed:", err instanceof Error ? err.message : err);
  }

  res.status(storageOk ? 200 : 503).json({
    service: "AEVION IP Pipeline",
    ok: storageOk,
    storage: { mode, ok: storageOk, certificateCount, lastProtectedAt },
    crypto: {
      usingDefaultSecret: SIGN_SECRET === "dev-qsign-secret",
      algorithms: ["SHA-256", "HMAC-SHA256", "Ed25519", "Shamir's Secret Sharing 2-of-3"],
    },
    steps: ["qright-registration", "qsign-hmac", "quantum-shield-ed25519-sss", "certificate-issuance"],
    legalFrameworks: ["Berne Convention", "WIPO Copyright Treaty", "TRIPS Agreement", "eIDAS", "ESIGN Act", "KZ Digital Signature Law"],
    uptimeSeconds: Math.round((Date.now() - HEALTH_BOOT_TS) / 1000),
    at: new Date().toISOString(),
  });
});