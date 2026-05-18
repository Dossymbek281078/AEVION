import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { getPool } from "../lib/dbPool";

/**
 * QTradeOffline — offline-first P2P payments в AEV.
 *
 * Поток:
 * 1) Клиент создаёт ECDSA P-256 keypair локально (Web Crypto), хранит в localStorage.
 * 2) Клиент регистрирует publicKey на бэкенде → получает initial airdrop 100 AEV (MVP).
 * 3) Когда два клиента не в сети — отправитель подписывает SignedTransfer
 *    (canonical JSON {from,to,amount,nonce,timestamp}) и передаёт получателю
 *    через QR/код. Получатель верифицирует локально (по pinned publicKey отправителя).
 * 4) Когда любой из них онлайн — батчит ledger в `/sync` → бэкенд верифицирует ещё раз,
 *    проверяет nonce-uniqueness и баланс, атомарно применяет transfer.
 *
 * Persistence: Postgres (3 таблицы). In-memory fallback при отсутствии DATABASE_URL.
 */
export const qtradeOfflineRouter = Router();

type WalletState = {
  id: string;
  publicKeyJwk: JsonWebKeyMin;
  balance: number;
  createdAt: string;
};

type SignedTransfer = {
  from: string;
  to: string;
  amount: number;
  nonce: string;
  timestamp: number;
  publicKeyJwk: JsonWebKeyMin;
  signature: string;
};

type SyncResultEntry = {
  nonce: string;
  status: "applied" | "rejected";
  reason?: string;
};

type JsonWebKeyMin = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

// ── In-memory fallback ────────────────────────────────────────────────────────
const memWallets = new Map<string, WalletState>();
const memNonces = new Set<string>();
const memLedger: Array<{ kind: "airdrop" | "transfer"; at: string } & SignedTransfer> = [];

// ── DB state ──────────────────────────────────────────────────────────────────
let useDb = false;
let dbInitTried = false;

async function ensureDb(): Promise<void> {
  if (dbInitTried) return;
  dbInitTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[QTradeOffline] DATABASE_URL absent — in-memory mode");
    return;
  }
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qtradeoffline_wallets (
        id          TEXT PRIMARY KEY,
        pub_key_jwk JSONB        NOT NULL,
        balance     NUMERIC(18,6) NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS qtradeoffline_nonces (
        nonce      TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS qtradeoffline_ledger (
        id          SERIAL      PRIMARY KEY,
        kind        TEXT        NOT NULL,
        "from"      TEXT        NOT NULL,
        "to"        TEXT        NOT NULL,
        amount      NUMERIC(18,6) NOT NULL,
        nonce       TEXT        NOT NULL,
        ts          BIGINT      NOT NULL,
        signature   TEXT        NOT NULL,
        pub_key_jwk JSONB       NOT NULL,
        at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    useDb = true;
    console.log("[QTradeOffline] Postgres persistence enabled");
  } catch (e) {
    console.warn("[QTradeOffline] DB init failed, in-memory fallback:", e instanceof Error ? e.message : e);
  }
}
void ensureDb();

const INITIAL_AIRDROP = 100;

// ── Pure helpers ──────────────────────────────────────────────────────────────
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

function transferPayload(t: SignedTransfer): string {
  return canonicalJson({ from: t.from, to: t.to, amount: t.amount, nonce: t.nonce, timestamp: t.timestamp });
}

function verifySignature(t: SignedTransfer): boolean {
  try {
    const pubKey = crypto.createPublicKey({ key: t.publicKeyJwk, format: "jwk" });
    const sigBuf = Buffer.from(t.signature, "base64");
    return crypto.verify("sha256", Buffer.from(transferPayload(t), "utf8"), { key: pubKey, dsaEncoding: "ieee-p1363" }, sigBuf);
  } catch {
    return false;
  }
}

function jwkAddress(jwk: JsonWebKeyMin): string {
  const compact = canonicalJson({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
  return "AEV-" + crypto.createHash("sha256").update(compact).digest("hex").slice(0, 16).toUpperCase();
}

function isJwkPublicKey(value: unknown): value is JsonWebKeyMin {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kty === "EC" && v.crv === "P-256" && typeof v.x === "string" && typeof v.y === "string";
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function dbGetWallet(id: string): Promise<WalletState | null> {
  const pool = getPool();
  const r = await pool.query("SELECT id, pub_key_jwk, balance, created_at FROM qtradeoffline_wallets WHERE id=$1", [id]);
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { id: row.id, publicKeyJwk: row.pub_key_jwk, balance: Number(row.balance), createdAt: row.created_at };
}

async function dbUpsertWallet(id: string, jwk: JsonWebKeyMin, balance: number): Promise<WalletState> {
  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO qtradeoffline_wallets (id, pub_key_jwk, balance)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, pub_key_jwk, balance, created_at`,
    [id, JSON.stringify(jwk), balance],
  );
  if (r.rows.length > 0) {
    const row = r.rows[0];
    return { id: row.id, publicKeyJwk: row.pub_key_jwk, balance: Number(row.balance), createdAt: row.created_at };
  }
  return (await dbGetWallet(id))!;
}

// ── Routes ────────────────────────────────────────────────────────────────────
qtradeOfflineRouter.get("/health", async (_req, res) => {
  await ensureDb();
  if (useDb) {
    const pool = getPool();
    const [w, l, n] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM qtradeoffline_wallets"),
      pool.query("SELECT COUNT(*) FROM qtradeoffline_ledger"),
      pool.query("SELECT COUNT(*) FROM qtradeoffline_nonces"),
    ]);
    return res.json({ service: "qtradeoffline", status: "ok", db: "postgres", wallets: Number(w.rows[0].count), transfers: Number(l.rows[0].count), nonces: Number(n.rows[0].count) });
  }
  res.json({ service: "qtradeoffline", status: "ok", db: "memory", wallets: memWallets.size, transfers: memLedger.length, nonces: memNonces.size });
});

qtradeOfflineRouter.post("/wallet/register", async (req: Request, res: Response) => {
  await ensureDb();
  const { publicKeyJwk } = req.body || {};
  if (!isJwkPublicKey(publicKeyJwk)) return res.status(400).json({ error: "publicKeyJwk (EC P-256) required" });
  const id = jwkAddress(publicKeyJwk);

  if (useDb) {
    try {
      const existing = await dbGetWallet(id);
      if (existing) return res.json({ wallet: existing, airdropped: false });
      const wallet = await dbUpsertWallet(id, publicKeyJwk, INITIAL_AIRDROP);
      return res.json({ wallet, airdropped: true });
    } catch (e) {
      return res.status(500).json({ error: "db_error", detail: e instanceof Error ? e.message : "unknown" });
    }
  }

  const existing = memWallets.get(id);
  if (existing) return res.json({ wallet: existing, airdropped: false });
  const w: WalletState = { id, publicKeyJwk, balance: INITIAL_AIRDROP, createdAt: new Date().toISOString() };
  memWallets.set(id, w);
  return res.json({ wallet: w, airdropped: true });
});

qtradeOfflineRouter.get("/wallet/:id", async (req: Request, res: Response) => {
  await ensureDb();
  const id = String(req.params.id);
  if (useDb) {
    try {
      const w = await dbGetWallet(id);
      if (!w) return res.status(404).json({ error: "wallet not found" });
      return res.json({ wallet: w });
    } catch (e) {
      return res.status(500).json({ error: "db_error" });
    }
  }
  const w = memWallets.get(id);
  if (!w) return res.status(404).json({ error: "wallet not found" });
  res.json({ wallet: w });
});

qtradeOfflineRouter.get("/history/:id", async (req: Request, res: Response) => {
  await ensureDb();
  const id = String(req.params.id);
  if (useDb) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT kind, "from", "to", amount, nonce, ts AS timestamp, at FROM qtradeoffline_ledger WHERE "from"=$1 OR "to"=$1 ORDER BY at DESC LIMIT 100`,
        [id],
      );
      return res.json({ items: r.rows.map((row: any) => ({ ...row, amount: Number(row.amount), timestamp: Number(row.timestamp) })) });
    } catch {
      return res.status(500).json({ error: "db_error" });
    }
  }
  const items = memLedger.filter((e) => e.from === id || e.to === id).map(({ kind, from, to, amount, nonce, timestamp, at }) => ({ kind, from, to, amount, nonce, timestamp, at }));
  res.json({ items });
});

qtradeOfflineRouter.get("/leaderboard", async (_req, res) => {
  await ensureDb();
  if (useDb) {
    try {
      const pool = getPool();
      const r = await pool.query("SELECT id, balance, created_at FROM qtradeoffline_wallets ORDER BY balance DESC LIMIT 10");
      return res.json({ items: r.rows.map((row: any) => ({ id: row.id, balance: Number(row.balance), createdAt: row.created_at })) });
    } catch {
      return res.status(500).json({ error: "db_error" });
    }
  }
  const items = Array.from(memWallets.values()).sort((a, b) => b.balance - a.balance).slice(0, 10).map((w) => ({ id: w.id, balance: w.balance, createdAt: w.createdAt }));
  res.json({ items });
});

/** Batch-sync: атомарная обработка офлайн-переводов с проверкой подписей. */
qtradeOfflineRouter.post("/sync", async (req: Request, res: Response) => {
  await ensureDb();
  const transfers: unknown = req.body?.transfers;
  if (!Array.isArray(transfers)) return res.status(400).json({ error: "transfers[] required" });

  const results: SyncResultEntry[] = [];

  if (useDb) {
    const pool = getPool();
    for (const raw of transfers) {
      const t = raw as SignedTransfer;
      // Shape validation
      if (!t || typeof t.from !== "string" || typeof t.to !== "string" || typeof t.amount !== "number" || typeof t.nonce !== "string" || typeof t.timestamp !== "number" || typeof t.signature !== "string" || !isJwkPublicKey(t.publicKeyJwk)) {
        results.push({ nonce: (t as any)?.nonce ?? "", status: "rejected", reason: "malformed" });
        continue;
      }
      if (t.amount <= 0 || !Number.isFinite(t.amount)) {
        results.push({ nonce: t.nonce, status: "rejected", reason: "amount<=0" });
        continue;
      }
      if (jwkAddress(t.publicKeyJwk) !== t.from) {
        results.push({ nonce: t.nonce, status: "rejected", reason: "address-pubkey-mismatch" });
        continue;
      }
      if (!verifySignature(t)) {
        results.push({ nonce: t.nonce, status: "rejected", reason: "bad-signature" });
        continue;
      }

      // Atomic DB transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Nonce uniqueness
        const nonceCheck = await client.query("SELECT 1 FROM qtradeoffline_nonces WHERE nonce=$1", [t.nonce]);
        if (nonceCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          results.push({ nonce: t.nonce, status: "rejected", reason: "nonce-replay" });
          continue;
        }
        // Sender balance
        const senderRow = await client.query("SELECT balance FROM qtradeoffline_wallets WHERE id=$1 FOR UPDATE", [t.from]);
        if (senderRow.rows.length === 0) {
          await client.query("ROLLBACK");
          results.push({ nonce: t.nonce, status: "rejected", reason: "sender-unknown" });
          continue;
        }
        const senderBalance = Number(senderRow.rows[0].balance);
        if (senderBalance < t.amount) {
          await client.query("ROLLBACK");
          results.push({ nonce: t.nonce, status: "rejected", reason: "insufficient-balance" });
          continue;
        }
        // Debit sender
        await client.query("UPDATE qtradeoffline_wallets SET balance = balance - $1 WHERE id=$2", [t.amount, t.from]);
        // Credit / create receiver
        await client.query(
          `INSERT INTO qtradeoffline_wallets (id, pub_key_jwk, balance) VALUES ($1, '{}', $2)
           ON CONFLICT (id) DO UPDATE SET balance = qtradeoffline_wallets.balance + $2`,
          [t.to, t.amount],
        );
        // Ledger entry + nonce
        await client.query(
          `INSERT INTO qtradeoffline_ledger (kind,"from","to",amount,nonce,ts,signature,pub_key_jwk) VALUES ('transfer',$1,$2,$3,$4,$5,$6,$7)`,
          [t.from, t.to, t.amount, t.nonce, t.timestamp, t.signature, JSON.stringify(t.publicKeyJwk)],
        );
        await client.query("INSERT INTO qtradeoffline_nonces (nonce) VALUES ($1)", [t.nonce]);
        await client.query("COMMIT");
        results.push({ nonce: t.nonce, status: "applied" });
      } catch (e) {
        await client.query("ROLLBACK");
        results.push({ nonce: t.nonce, status: "rejected", reason: "db_error" });
      } finally {
        client.release();
      }
    }
    return res.json({ results });
  }

  // In-memory fallback
  for (const raw of transfers) {
    const t = raw as SignedTransfer;
    if (!t || typeof t.from !== "string" || typeof t.to !== "string" || typeof t.amount !== "number" || typeof t.nonce !== "string" || typeof t.timestamp !== "number" || typeof t.signature !== "string" || !isJwkPublicKey(t.publicKeyJwk)) {
      results.push({ nonce: (t as any)?.nonce ?? "", status: "rejected", reason: "malformed" }); continue;
    }
    if (t.amount <= 0 || !Number.isFinite(t.amount)) { results.push({ nonce: t.nonce, status: "rejected", reason: "amount<=0" }); continue; }
    if (memNonces.has(t.nonce)) { results.push({ nonce: t.nonce, status: "rejected", reason: "nonce-replay" }); continue; }
    if (jwkAddress(t.publicKeyJwk) !== t.from) { results.push({ nonce: t.nonce, status: "rejected", reason: "address-pubkey-mismatch" }); continue; }
    if (!verifySignature(t)) { results.push({ nonce: t.nonce, status: "rejected", reason: "bad-signature" }); continue; }
    const sender = memWallets.get(t.from);
    if (!sender) { results.push({ nonce: t.nonce, status: "rejected", reason: "sender-unknown" }); continue; }
    if (sender.balance < t.amount) { results.push({ nonce: t.nonce, status: "rejected", reason: "insufficient-balance" }); continue; }
    let receiver = memWallets.get(t.to);
    if (!receiver) {
      receiver = { id: t.to, publicKeyJwk: { kty: "EC", crv: "P-256", x: "", y: "" }, balance: 0, createdAt: new Date().toISOString() };
      memWallets.set(t.to, receiver);
    }
    sender.balance -= t.amount;
    receiver.balance += t.amount;
    memNonces.add(t.nonce);
    memLedger.push({ kind: "transfer", at: new Date().toISOString(), ...t });
    results.push({ nonce: t.nonce, status: "applied" });
  }
  return res.json({ results });
});

qtradeOfflineRouter.get("/stats", async (_req, res) => {
  await ensureDb();
  if (useDb) {
    try {
      const pool = getPool();
      const [w, l] = await Promise.all([
        pool.query("SELECT COUNT(*) AS wallets, COALESCE(SUM(balance),0) AS total_supply FROM qtradeoffline_wallets"),
        pool.query("SELECT COUNT(*) AS transfers, COALESCE(SUM(amount),0) AS total_volume FROM qtradeoffline_ledger WHERE kind='transfer'"),
      ]);
      return res.json({ wallets: Number(w.rows[0].wallets), totalSupply: Number(w.rows[0].total_supply), transfers: Number(l.rows[0].transfers), totalVolume: Number(l.rows[0].total_volume) });
    } catch {
      return res.status(500).json({ error: "db_error" });
    }
  }
  const totalVolume = memLedger.filter((e) => e.kind === "transfer").reduce((s, e) => s + e.amount, 0);
  res.json({ wallets: memWallets.size, totalSupply: Array.from(memWallets.values()).reduce((s, w) => s + w.balance, 0), transfers: memLedger.filter((e) => e.kind === "transfer").length, totalVolume });
});

// OpenAPI spec (unchanged)
qtradeOfflineRouter.options("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});
qtradeOfflineRouter.get("/openapi.json", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  const base = (process.env.PUBLIC_BACKEND_URL ?? "https://api.aevion.app").replace(/\/$/, "");
  res.json({
    openapi: "3.1.0",
    info: { title: "AEVION QTradeOffline", version: "2.0.0", description: "Offline-first P2P AEV transfers with Postgres persistence. Wallets sign transfers with ECDSA P-256 while offline; batch-sync when online." },
    servers: [{ url: `${base}/api/qtradeoffline`, description: "Production" }],
    tags: [{ name: "Wallet" }, { name: "Sync" }, { name: "Public" }],
    components: {
      schemas: {
        SignedTransfer: {
          type: "object",
          required: ["from", "to", "amount", "nonce", "timestamp", "signature", "publicKeyJwk"],
          properties: {
            from: { type: "string" }, to: { type: "string" },
            amount: { type: "number", minimum: 0.000001 },
            nonce: { type: "string" }, timestamp: { type: "integer" },
            signature: { type: "string", description: "ECDSA P-256 raw r||s base64" },
            publicKeyJwk: { type: "object" },
          },
        },
      },
    },
    paths: {
      "/health": { get: { tags: ["Public"], summary: "Service health + counts", responses: { "200": { description: "OK" } } } },
      "/wallet/register": {
        post: { tags: ["Wallet"], summary: "Register wallet (ECDSA P-256 JWK) — airdrop 100 AEV on first call",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["publicKeyJwk"], properties: { publicKeyJwk: { type: "object" } } } } } },
          responses: { "200": { description: "wallet + airdropped flag" }, "400": { description: "invalid key" } } } },
      "/wallet/{id}": { parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], get: { tags: ["Wallet"], summary: "Wallet balance", responses: { "200": { description: "OK" }, "404": { description: "not found" } } } },
      "/history/{id}": { parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], get: { tags: ["Wallet"], summary: "Wallet ledger history", responses: { "200": { description: "OK" } } } },
      "/leaderboard": { get: { tags: ["Public"], summary: "Top 10 wallets by balance", responses: { "200": { description: "OK" } } } },
      "/stats": { get: { tags: ["Public"], summary: "Global stats (wallets, supply, volume)", responses: { "200": { description: "OK" } } } },
      "/sync": { post: { tags: ["Sync"], summary: "Batch-apply offline-signed transfers (atomic, idempotent via nonce)",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["transfers"], properties: { transfers: { type: "array", items: { $ref: "#/components/schemas/SignedTransfer" } } } } } } },
          responses: { "200": { description: "Per-transfer result: applied / rejected + reason" } } } },
    },
  });
});
