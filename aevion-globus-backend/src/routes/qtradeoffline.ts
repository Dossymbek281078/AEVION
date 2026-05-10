import { Router } from "express";
import crypto from "crypto";

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
 * Бэкенд хранит state в памяти (MVP без БД). При рестарте — обнуляется.
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
  signature: string; // base64 raw r||s (P-256: 64 bytes)
};

type SyncResultEntry = {
  nonce: string;
  status: "applied" | "rejected";
  reason?: string;
};

/** ECDSA-P-256 public key в JWK-формате (минимально нужные поля). */
type JsonWebKeyMin = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

const wallets = new Map<string, WalletState>();
const seenNonces = new Set<string>();
const ledger: Array<{ kind: "airdrop" | "transfer"; at: string } & SignedTransfer> = [];

const INITIAL_AIRDROP = 100;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalJson((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

function transferPayload(t: SignedTransfer): string {
  return canonicalJson({
    from: t.from,
    to: t.to,
    amount: t.amount,
    nonce: t.nonce,
    timestamp: t.timestamp,
  });
}

function verifySignature(t: SignedTransfer): boolean {
  try {
    const pubKey = crypto.createPublicKey({ key: t.publicKeyJwk, format: "jwk" });
    const sigBuf = Buffer.from(t.signature, "base64");
    const verified = crypto.verify(
      "sha256",
      Buffer.from(transferPayload(t), "utf8"),
      { key: pubKey, dsaEncoding: "ieee-p1363" },
      sigBuf,
    );
    return verified;
  } catch {
    return false;
  }
}

function jwkAddress(jwk: JsonWebKeyMin): string {
  const compact = canonicalJson({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
  const h = crypto.createHash("sha256").update(compact).digest("hex").slice(0, 16);
  return "AEV-" + h.toUpperCase();
}

function isJwkPublicKey(value: unknown): value is JsonWebKeyMin {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.kty === "EC" &&
    v.crv === "P-256" &&
    typeof v.x === "string" &&
    typeof v.y === "string"
  );
}

qtradeOfflineRouter.get("/health", (_req, res) => {
  res.json({
    service: "qtradeoffline",
    status: "ok",
    wallets: wallets.size,
    transfers: ledger.length,
    nonces: seenNonces.size,
  });
});

/** Регистрация кошелька (в первый раз — airdrop). */
qtradeOfflineRouter.post("/wallet/register", (req, res) => {
  const { publicKeyJwk } = req.body || {};
  if (!isJwkPublicKey(publicKeyJwk)) {
    return res.status(400).json({ error: "publicKeyJwk (EC P-256) required" });
  }
  const id = jwkAddress(publicKeyJwk);
  const existing = wallets.get(id);
  if (existing) {
    return res.json({ wallet: existing, airdropped: false });
  }
  const w: WalletState = {
    id,
    publicKeyJwk,
    balance: INITIAL_AIRDROP,
    createdAt: new Date().toISOString(),
  };
  wallets.set(id, w);
  return res.json({ wallet: w, airdropped: true });
});

qtradeOfflineRouter.get("/wallet/:id", (req, res) => {
  const w = wallets.get(req.params.id);
  if (!w) return res.status(404).json({ error: "wallet not found" });
  res.json({ wallet: w });
});

qtradeOfflineRouter.get("/history/:id", (req, res) => {
  const id = req.params.id;
  const items = ledger
    .filter((e) => e.from === id || e.to === id)
    .map((e) => ({
      kind: e.kind,
      from: e.from,
      to: e.to,
      amount: e.amount,
      nonce: e.nonce,
      timestamp: e.timestamp,
      at: e.at,
    }));
  res.json({ items });
});

qtradeOfflineRouter.get("/leaderboard", (_req, res) => {
  const items = Array.from(wallets.values())
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10)
    .map((w) => ({ id: w.id, balance: w.balance, createdAt: w.createdAt }));
  res.json({ items });
});

/** Батч-синхронизация offline-переводов в общий ledger. */
qtradeOfflineRouter.post("/sync", (req, res) => {
  const transfers: unknown = req.body?.transfers;
  if (!Array.isArray(transfers)) {
    return res.status(400).json({ error: "transfers[] required" });
  }
  const results: SyncResultEntry[] = [];
  for (const raw of transfers) {
    const t = raw as SignedTransfer;
    if (
      !t ||
      typeof t.from !== "string" ||
      typeof t.to !== "string" ||
      typeof t.amount !== "number" ||
      typeof t.nonce !== "string" ||
      typeof t.timestamp !== "number" ||
      typeof t.signature !== "string" ||
      !isJwkPublicKey(t.publicKeyJwk)
    ) {
      results.push({ nonce: t?.nonce ?? "", status: "rejected", reason: "malformed" });
      continue;
    }
    if (t.amount <= 0 || !Number.isFinite(t.amount)) {
      results.push({ nonce: t.nonce, status: "rejected", reason: "amount<=0" });
      continue;
    }
    if (seenNonces.has(t.nonce)) {
      results.push({ nonce: t.nonce, status: "rejected", reason: "nonce-replay" });
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
    const sender = wallets.get(t.from);
    if (!sender) {
      results.push({ nonce: t.nonce, status: "rejected", reason: "sender-unknown" });
      continue;
    }
    if (sender.balance < t.amount) {
      results.push({ nonce: t.nonce, status: "rejected", reason: "insufficient-balance" });
      continue;
    }
    let receiver = wallets.get(t.to);
    if (!receiver) {
      // Получатель ещё не зарегистрирован — заводим его «в долг» на minimal state без airdrop.
      // Полноценный wallet появится при первом register с публичным ключом.
      receiver = {
        id: t.to,
        publicKeyJwk: { kty: "EC", crv: "P-256", x: "", y: "" },
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      wallets.set(t.to, receiver);
    }
    sender.balance -= t.amount;
    receiver.balance += t.amount;
    seenNonces.add(t.nonce);
    ledger.push({
      kind: "transfer",
      at: new Date().toISOString(),
      ...t,
    });
    results.push({ nonce: t.nonce, status: "applied" });
  }
  res.json({ results });
});
