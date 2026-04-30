import { Router, type Response, type Request } from "express";
import { randomUUID } from "node:crypto";
import { csvFromRows } from "../lib/csv";
import { readJsonFile, writeJsonFile } from "../lib/jsonFileStore";
import { requireAuth } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { consumeDailyCap } from "../lib/dailyCap";

export const qtradeRouter = Router();

type Account = {
  id: string;
  owner: string;
  balance: number;
  createdAt: string;
};

type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: string;
};

type Operation = {
  id: string;
  kind: "topup" | "transfer";
  amount: number;
  from: string | null;
  to: string;
  createdAt: string;
};

const STORE_REL = "qtrade.json";

const accounts: Account[] = [];
const transfers: Transfer[] = [];
const operations: Operation[] = [];

function nextId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

let loaded = false;
let loading: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      const data = await readJsonFile<{
        accounts?: Account[];
        transfers?: Transfer[];
        operations?: Operation[];
      }>(
        STORE_REL,
        { accounts: [], transfers: [], operations: [] },
      );
      const acc = Array.isArray(data.accounts) ? data.accounts : [];
      const tx = Array.isArray(data.transfers) ? data.transfers : [];
      const op = Array.isArray(data.operations) ? data.operations : [];
      accounts.splice(0, accounts.length, ...acc);
      transfers.splice(0, transfers.length, ...tx);
      operations.splice(
        0,
        operations.length,
        ...(op.length
          ? op
          : tx.map((x) => ({
              id: `op_${x.id}`,
              kind: "transfer" as const,
              amount: x.amount,
              from: x.from,
              to: x.to,
              createdAt: x.createdAt,
            }))),
      );
      loaded = true;
    })();
  }
  await loading;
}

let persistChain: Promise<void> = Promise.resolve();

function schedulePersist(): void {
  const snapshot = {
    accounts: [...accounts],
    transfers: [...transfers],
    operations: [...operations],
  };
  persistChain = persistChain
    .then(() => writeJsonFile(STORE_REL, snapshot))
    .catch((err) => {
      console.error("[qtrade] persist failed", err);
    });
}

qtradeRouter.use((_req, _res, next) => {
  ensureLoaded()
    .then(() => next())
    .catch(next);
});

// JWT middleware applies to every /api/qtrade/* route. Without this any
// caller could enumerate or mutate ledger state for another user — frontend
// was filtering by owner client-side which is unsafe.
qtradeRouter.use(requireAuth);

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

function ownAccountIds(owner: string): Set<string> {
  return new Set(accounts.filter((a) => a.owner === owner).map((a) => a.id));
}

function ownsAccount(owner: string, accountId: string): boolean {
  const a = accounts.find((x) => x.id === accountId);
  return !!a && a.owner === owner;
}

// =======================
// Pagination helpers
// =======================
type PageOpts = { limit: number; cursor: string | null };

function parsePageOpts(req: Request): PageOpts {
  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : 50;
  const c = req.query.cursor;
  const cursor = typeof c === "string" && c.length > 0 ? c : null;
  return { limit, cursor };
}

function paginate<T extends { id: string }>(
  items: T[],
  { limit, cursor }: PageOpts,
): { page: T[]; nextCursor: string | null } {
  let start = 0;
  if (cursor) {
    const idx = items.findIndex((x) => x.id === cursor);
    if (idx >= 0) start = idx + 1;
  }
  const page = items.slice(start, start + limit);
  const nextCursor =
    page.length === limit && start + limit < items.length
      ? page[page.length - 1].id
      : null;
  return { page, nextCursor };
}

// =======================
// Создать счёт
// =======================
qtradeRouter.post("/accounts", (req, res) => {
  const owner = ownerEmail(req);
  const { owner: bodyOwner } = req.body || {};
  // For backwards compat the client may still send `owner` — but we always
  // bind the new account to the authenticated user's email.
  if (bodyOwner && bodyOwner !== owner) {
    return res.status(403).json({ error: "owner mismatch" });
  }

  const acc: Account = {
    id: nextId("acc"),
    owner,
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  accounts.push(acc);
  schedulePersist();
  res.status(201).json(acc);
});

// =======================
// Получить мои счета
// =======================
qtradeRouter.get("/accounts", (req, res) => {
  const owner = ownerEmail(req);
  const items = accounts.filter((a) => a.owner === owner);
  const { page, nextCursor } = paginate(items, parsePageOpts(req));
  res.json({ items: page, nextCursor });
});

// =======================
// История переводов (новые сверху)
// =======================
qtradeRouter.get("/transfers", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const all = [...transfers]
    .reverse()
    .filter((tx) => ownIds.has(tx.from) || ownIds.has(tx.to));
  const { page, nextCursor } = paginate(all, parsePageOpts(req));
  res.json({ items: page, nextCursor });
});

// =======================
// Журнал операций (новые сверху)
// =======================
qtradeRouter.get("/operations", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const all = [...operations]
    .reverse()
    .filter((op) => ownIds.has(op.to) || (op.from && ownIds.has(op.from)));
  const { page, nextCursor } = paginate(all, parsePageOpts(req));
  res.json({ items: page, nextCursor });
});

// =======================
// Сводка по моим счетам
// =======================
qtradeRouter.get("/summary", (req, res) => {
  const owner = ownerEmail(req);
  const ownIds = ownAccountIds(owner);
  const myAccounts = accounts.filter((a) => a.owner === owner);
  const myOps = operations.filter(
    (op) => ownIds.has(op.to) || (op.from && ownIds.has(op.from)),
  );
  const totalBalance = myAccounts.reduce((s, a) => s + a.balance, 0);
  const totalTransferVolume = transfers
    .filter((tx) => ownIds.has(tx.from) || ownIds.has(tx.to))
    .reduce((s, x) => s + x.amount, 0);
  const totalTopupVolume = myOps
    .filter((x) => x.kind === "topup")
    .reduce((s, x) => s + x.amount, 0);
  res.json({
    accounts: myAccounts.length,
    transfers: transfers.filter((tx) => ownIds.has(tx.from) || ownIds.has(tx.to))
      .length,
    operations: myOps.length,
    totalBalance,
    totalTransferVolume,
    totalTopupVolume,
  });
});

// =======================
// Email → accountId lookup (for P2P transfer UX)
// =======================
qtradeRouter.get("/accounts/lookup", async (req, res) => {
  const emailRaw = req.query.email;
  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return res.status(400).json({ error: "email required" });
  }
  const email = emailRaw.trim().toLowerCase();

  // Try users table first — confirms that email actually corresponds to a
  // registered user, even if no account has been provisioned yet.
  let userExists = false;
  try {
    const pool = getPool();
    const r = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1) AS exists",
      [email],
    );
    userExists = !!(r.rows[0] as { exists?: boolean } | undefined)?.exists;
  } catch {
    // DB unavailable in pure-JSON dev mode — fall through and rely on
    // accounts.owner only.
  }

  const owned = accounts.filter((a) => a.owner.toLowerCase() === email);
  if (owned.length === 0) {
    return res.status(404).json({
      error: "no account",
      email,
      userExists,
    });
  }
  // Return primary (oldest) plus full list so callers can pick.
  const primary = owned.reduce((a, b) =>
    a.createdAt < b.createdAt ? a : b,
  );
  res.json({
    email,
    primary: { id: primary.id, balance: primary.balance },
    accounts: owned.map((a) => ({ id: a.id, balance: a.balance, createdAt: a.createdAt })),
    userExists,
  });
});

function sendCsvAttachment(
  res: Response,
  baseName: string,
  rows: (string | number | null | undefined)[][],
): void {
  const csv = csvFromRows(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csv);
}

// =======================
// Экспорт счетов в CSV
// =======================
qtradeRouter.get("/accounts.csv", (req, res) => {
  const owner = ownerEmail(req);
  const mine = accounts.filter((a) => a.owner === owner);
  const rows = [
    ["id", "owner", "balance", "createdAt"],
    ...mine.map((a) => [a.id, a.owner, a.balance, a.createdAt]),
  ];
  sendCsvAttachment(res, "qtrade-accounts", rows);
});

// =======================
// Экспорт переводов в CSV
// =======================
qtradeRouter.get("/transfers.csv", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const rows = [
    ["id", "from", "to", "amount", "createdAt"],
    ...[...transfers]
      .reverse()
      .filter((x) => ownIds.has(x.from) || ownIds.has(x.to))
      .map((x) => [x.id, x.from, x.to, x.amount, x.createdAt]),
  ];
  sendCsvAttachment(res, "qtrade-transfers", rows);
});

// =======================
// Экспорт операций в CSV
// =======================
qtradeRouter.get("/operations.csv", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const rows = [
    ["id", "kind", "amount", "from", "to", "createdAt"],
    ...[...operations]
      .reverse()
      .filter((x) => ownIds.has(x.to) || (x.from && ownIds.has(x.from)))
      .map((x) => [x.id, x.kind, x.amount, x.from, x.to, x.createdAt]),
  ];
  sendCsvAttachment(res, "qtrade-operations", rows);
});

// =======================
// Idempotency cache (in-memory, 24h TTL).
// Same key → same response, no double-billing on retry storms.
// =======================
type CachedReply = { status: number; body: unknown; storedAt: number };
const idemCache = new Map<string, CachedReply>();
const IDEM_TTL_MS = 24 * 60 * 60 * 1000;

function gcIdem(): void {
  const cutoff = Date.now() - IDEM_TTL_MS;
  for (const [k, v] of idemCache) {
    if (v.storedAt < cutoff) idemCache.delete(k);
  }
}

function readIdemKey(req: Request): string | null {
  const raw = req.headers["idempotency-key"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || typeof v !== "string") return null;
  const k = v.trim();
  if (!k || k.length > 128) return null;
  return k;
}

function idemNamespace(req: Request, route: string): string {
  return `${ownerEmail(req)}::${route}::${readIdemKey(req)}`;
}

// =======================
// Пополнение счёта
// =======================
qtradeRouter.post("/topup", (req, res) => {
  const owner = ownerEmail(req);
  const { accountId, amount } = req.body || {};

  if (!ownsAccount(owner, accountId)) {
    return res.status(403).json({ error: "not owner of account" });
  }
  const acc = accounts.find((a) => a.id === accountId)!;

  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0)
    return res.status(400).json({ error: "invalid amount" });

  const idemKey = readIdemKey(req);
  if (idemKey) {
    gcIdem();
    const ns = idemNamespace(req, "topup");
    const hit = idemCache.get(ns);
    if (hit) {
      res.setHeader("Idempotency-Replayed", "true");
      return res.status(hit.status).json(hit.body);
    }
  } else {
    res.setHeader("Idempotency-Warning", "missing-key");
  }

  // Daily cap is checked after idempotency replay so a retry of an already-
  // accepted top-up doesn't get rejected for "exceeded today" — the cap was
  // already consumed by the original request.
  const cap = consumeDailyCap(owner, "topup", a);
  if (!cap.ok) {
    res.setHeader("Retry-After", String(cap.retryInSec));
    return res.status(429).json({
      error: "daily topup cap exceeded",
      cap: cap.cap,
      used: cap.used,
      requested: a,
      retryInSec: cap.retryInSec,
    });
  }

  acc.balance += a;
  operations.push({
    id: nextId("op"),
    kind: "topup",
    amount: a,
    from: null,
    to: acc.id,
    createdAt: new Date().toISOString(),
  });
  schedulePersist();

  const body = {
    id: acc.id,
    balance: acc.balance,
    updatedAt: new Date().toISOString(),
  };

  if (idemKey) {
    idemCache.set(idemNamespace(req, "topup"), {
      status: 200,
      body,
      storedAt: Date.now(),
    });
  }

  res.json(body);
});

// =======================
// Перевод средств
// =======================
qtradeRouter.post("/transfer", (req, res) => {
  const owner = ownerEmail(req);
  const { from, to, amount } = req.body || {};

  if (!ownsAccount(owner, from)) {
    return res.status(403).json({ error: "not owner of source account" });
  }

  const fromAcc = accounts.find((a) => a.id === from);
  const toAcc = accounts.find((a) => a.id === to);

  if (!fromAcc || !toAcc)
    return res.status(400).json({ error: "invalid accounts" });
  if (from === to)
    return res.status(400).json({ error: "cannot transfer to same account" });

  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0 || fromAcc.balance < a)
    return res.status(400).json({ error: "invalid amount" });

  const idemKey = readIdemKey(req);
  if (idemKey) {
    gcIdem();
    const ns = idemNamespace(req, "transfer");
    const hit = idemCache.get(ns);
    if (hit) {
      res.setHeader("Idempotency-Replayed", "true");
      return res.status(hit.status).json(hit.body);
    }
  } else {
    res.setHeader("Idempotency-Warning", "missing-key");
  }

  const cap = consumeDailyCap(owner, "transfer", a);
  if (!cap.ok) {
    res.setHeader("Retry-After", String(cap.retryInSec));
    return res.status(429).json({
      error: "daily transfer cap exceeded",
      cap: cap.cap,
      used: cap.used,
      requested: a,
      retryInSec: cap.retryInSec,
    });
  }

  fromAcc.balance -= a;
  toAcc.balance += a;

  const tx: Transfer = {
    id: nextId("tx"),
    from,
    to,
    amount: a,
    createdAt: new Date().toISOString(),
  };

  transfers.push(tx);
  operations.push({
    id: nextId("op"),
    kind: "transfer",
    amount: a,
    from,
    to,
    createdAt: tx.createdAt,
  });
  schedulePersist();

  if (idemKey) {
    idemCache.set(idemNamespace(req, "transfer"), {
      status: 200,
      body: tx,
      storedAt: Date.now(),
    });
  }

  res.json(tx);
});
