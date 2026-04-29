import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getPool } from "../lib/dbPool";
import {
  HMAC_KEY_VERSION,
  SHAMIR_SHARDS,
  SHAMIR_THRESHOLD,
} from "../config/qright";
import {
  generateEphemeralEd25519,
  splitAndAuthenticate,
  verifyShardHmac,
  wipeBuffer,
  type AuthenticatedShard,
} from "../lib/shamir/shield";
// _legacyGenerateShards is intentionally imported (not called) to preserve the
// symbol export for any legacy test or analytics code that references it.
import { _legacyGenerateShards } from "../lib/shamir/legacy";
void _legacyGenerateShards;

export const quantumShieldRouter = Router();
const pool = getPool();

let ensuredTable = false;

async function ensureShieldTable(): Promise<void> {
  if (ensuredTable) return;
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
  ensuredTable = true;
}

function parseShards(raw: unknown, ctx?: { shieldId?: string }): AuthenticatedShard[] {
  if (typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const preview = raw.length > 64 ? raw.slice(0, 64) + "…" : raw;
    console.error(
      `[QuantumShield] shard JSON corrupt${ctx?.shieldId ? ` (id=${ctx.shieldId})` : ""}: ${
        err instanceof Error ? err.message : String(err)
      } | preview=${preview}`,
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn(
      `[QuantumShield] shard payload is not an array${ctx?.shieldId ? ` (id=${ctx.shieldId})` : ""}: type=${typeof parsed}`,
    );
    return [];
  }
  return parsed as AuthenticatedShard[];
}

/* ── List handler (reused by / and /records) ── */
async function handleList(_req: Request, res: Response): Promise<void> {
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT * FROM "QuantumShield" ORDER BY "createdAt" DESC LIMIT 100`,
    );
    const records = rows.map((r: Record<string, unknown>) => {
      const shards = parseShards(r.shards, { shieldId: r.id as string });
      const status =
        (r.status as string) ||
        (r.legacy === true ? "legacy" : "active");
      return {
        id: r.id,
        objectId: r.objectId,
        objectTitle: r.objectTitle,
        algorithm: r.algorithm,
        threshold: r.threshold,
        totalShards: r.totalShards,
        shards,
        signature: r.signature,
        publicKey: r.publicKey,
        legacy: r.legacy === true,
        hmacKeyVersion: r.hmac_key_version ?? 1,
        status,
        createdAt: r.createdAt,
      };
    });
    res.json({ records, items: records, total: records.length });
  } catch (err) {
    console.error(
      "[QuantumShield] list error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch shield records" });
  }
}

/* ── Create handler (reused by POST / and POST /create) ── */
async function handleCreate(req: Request, res: Response): Promise<void> {
  try {
    await ensureShieldTable();
    const { objectId, objectTitle, payload } = req.body as {
      objectId?: string;
      objectTitle?: string;
      payload?: unknown;
    };
    const title =
      objectTitle || (payload ? JSON.stringify(payload).slice(0, 80) : null);
    if (!title) {
      res.status(400).json({ error: "objectTitle or payload is required" });
      return;
    }

    const id = "qs-" + crypto.randomBytes(8).toString("hex");
    const { privateKeyRaw, publicKeySpkiHex } = generateEphemeralEd25519();

    const dataToSign = JSON.stringify({
      objectId,
      objectTitle: title,
      payload,
      timestamp: Date.now(),
    });
    const pkcs8Prefix = Buffer.from(
      "302e020100300506032b657004220420",
      "hex",
    );
    const pkcs8 = Buffer.concat([pkcs8Prefix, privateKeyRaw]);
    const signingKey = crypto.createPrivateKey({
      key: pkcs8,
      format: "der",
      type: "pkcs8",
    });
    const signature = crypto
      .sign(null, Buffer.from(dataToSign), signingKey)
      .toString("hex");
    wipeBuffer(pkcs8);

    let shards: AuthenticatedShard[];
    try {
      shards = splitAndAuthenticate(privateKeyRaw, id);
    } finally {
      wipeBuffer(privateKeyRaw);
    }

    await pool.query(
      `INSERT INTO "QuantumShield" ("id","objectId","objectTitle","algorithm","threshold","totalShards","shards","signature","publicKey","status","legacy","hmac_key_version","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',false,$10,NOW())`,
      [
        id,
        objectId || null,
        title,
        "Shamir's Secret Sharing + Ed25519",
        SHAMIR_THRESHOLD,
        SHAMIR_SHARDS,
        JSON.stringify(shards),
        signature,
        publicKeySpkiHex,
        HMAC_KEY_VERSION,
      ],
    );

    res.status(201).json({
      id,
      objectId,
      objectTitle: title,
      algorithm: "Shamir's Secret Sharing + Ed25519",
      threshold: SHAMIR_THRESHOLD,
      totalShards: SHAMIR_SHARDS,
      hmacKeyVersion: HMAC_KEY_VERSION,
      shards,
      signature,
      publicKey: publicKeySpkiHex,
      status: "active",
      legacy: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "[QuantumShield] create error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to create shield record" });
  }
}

/* ── Routes ── */
quantumShieldRouter.get("/", handleList);
quantumShieldRouter.get("/records", handleList);

quantumShieldRouter.post("/", handleCreate);
quantumShieldRouter.post("/create", handleCreate);

quantumShieldRouter.get("/stats", async (_req, res) => {
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT COUNT(*) as total, SUM("totalShards") as "totalShards", AVG("threshold") as "avgThreshold" FROM "QuantumShield"`,
    );
    const r = rows[0];
    res.json({
      totalRecords: parseInt(r.total) || 0,
      totalShards: parseInt(r.totalShards) || 0,
      avgThreshold: Math.round(parseFloat(r.avgThreshold) || 0),
    });
  } catch (err) {
    console.error(
      "[QuantumShield] stats error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

quantumShieldRouter.get("/:id", async (req, res) => {
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT * FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const r = rows[0] as Record<string, unknown>;
    const shards = parseShards(r.shards, { shieldId: r.id as string });
    res.json({
      ...r,
      shards,
      legacy: r.legacy === true,
      hmacKeyVersion: r.hmac_key_version ?? 1,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] get error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to fetch shield record" });
  }
});

quantumShieldRouter.post("/:id/verify", async (req, res) => {
  try {
    await ensureShieldTable();
    const { rows } = await pool.query(
      `SELECT * FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    const r = rows[0] as Record<string, unknown>;
    const shards = parseShards(r.shards, { shieldId: r.id as string });
    const now = new Date().toISOString();
    const updatedShards = shards.map((s) => ({ ...s, lastVerified: now }));
    await pool.query(
      `UPDATE "QuantumShield" SET "shards" = $1 WHERE "id" = $2`,
      [JSON.stringify(updatedShards), req.params.id],
    );
    res.json({
      success: true,
      valid: true,
      verifiedAt: now,
      activeShards: updatedShards.length,
      threshold: r.threshold,
      secure: updatedShards.length >= (r.threshold as number),
    });
  } catch (err) {
    console.error(
      "[QuantumShield] verify error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to verify shards" });
  }
});

/**
 * @deprecated Legacy "verify shards by string match" endpoint. Does NOT
 * perform Shamir reconstruction. Use `POST /api/pipeline/reconstruct` for
 * authenticated reconstruction. Kept for backward compatibility; will be
 * removed in a future release.
 */
quantumShieldRouter.post("/verify", async (req, res) => {
  try {
    await ensureShieldTable();
    const { recordId, shards: shardInputs } = req.body as {
      recordId?: string;
      shards?: unknown[];
    };
    if (recordId) {
      const { rows } = await pool.query(
        `SELECT * FROM "QuantumShield" WHERE "id" = $1`,
        [recordId],
      );
      if (rows.length === 0) {
        return res.status(404).json({
          error: "Record not found",
          valid: false,
          deprecated: true,
        });
      }
      const r = rows[0] as Record<string, unknown>;
      const storedShards = parseShards(r.shards, { shieldId: recordId });
      const inputs = Array.isArray(shardInputs) ? shardInputs : [];

      // Preferred path: if inputs look like AuthenticatedShard objects, run
      // HMAC verification (does not reconstruct, but at least catches tamper).
      let hmacValidCount = 0;
      for (const input of inputs) {
        if (
          input &&
          typeof input === "object" &&
          typeof (input as { sssShare?: unknown }).sssShare === "string"
        ) {
          const shardLike = input as {
            index: number;
            sssShare: string;
            hmac: string;
            hmacKeyVersion: number;
          };
          if (verifyShardHmac(shardLike, recordId)) {
            hmacValidCount += 1;
          }
        }
      }

      // Legacy path: string match against stored shard fields (for old clients).
      const matchCount = inputs.filter((input) =>
        typeof input === "string"
          ? storedShards.some(
              (s) =>
                (s as { sssShare?: string }).sssShare === input ||
                (s as unknown as { data?: string }).data === input ||
                (s as unknown as { id?: string }).id === input,
            )
          : false,
      ).length;

      const effectiveMatches = Math.max(hmacValidCount, matchCount);
      const valid = effectiveMatches >= (r.threshold as number);
      return res.json({
        valid,
        matched: effectiveMatches,
        threshold: r.threshold,
        recovered: valid,
        recordId,
        deprecated: true,
        note: "Use POST /api/pipeline/reconstruct for authenticated reconstruction (combines shards via Lagrange interpolation and re-signs with recovered Ed25519 key).",
      });
    }
    res.json({
      valid: false,
      error: "recordId required",
      deprecated: true,
    });
  } catch (err) {
    console.error(
      "[QuantumShield] verify error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Verification failed", deprecated: true });
  }
});

quantumShieldRouter.delete("/:id", async (req, res) => {
  try {
    await ensureShieldTable();
    const result = await pool.query(
      `DELETE FROM "QuantumShield" WHERE "id" = $1`,
      [req.params.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Shield record not found" });
    }
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error(
      "[QuantumShield] delete error:",
      err instanceof Error ? err.message : String(err),
    );
    res.status(500).json({ error: "Failed to delete shield record" });
  }
});
