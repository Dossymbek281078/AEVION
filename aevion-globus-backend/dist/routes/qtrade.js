"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qtradeRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const csv_1 = require("../lib/csv");
const jsonFileStore_1 = require("../lib/jsonFileStore");
const authJwt_1 = require("../lib/authJwt");
const dbPool_1 = require("../lib/dbPool");
exports.qtradeRouter = (0, express_1.Router)();
const STORE_REL = "qtrade.json";
const accounts = [];
const transfers = [];
const operations = [];
function nextId(prefix) {
    return `${prefix}_${(0, node_crypto_1.randomUUID)()}`;
}
let loaded = false;
let loading = null;
async function ensureLoaded() {
    if (loaded)
        return;
    if (!loading) {
        loading = (async () => {
            const data = await (0, jsonFileStore_1.readJsonFile)(STORE_REL, { accounts: [], transfers: [], operations: [] });
            const acc = Array.isArray(data.accounts) ? data.accounts : [];
            const tx = Array.isArray(data.transfers) ? data.transfers : [];
            const op = Array.isArray(data.operations) ? data.operations : [];
            accounts.splice(0, accounts.length, ...acc);
            transfers.splice(0, transfers.length, ...tx);
            operations.splice(0, operations.length, ...(op.length
                ? op
                : tx.map((x) => ({
                    id: `op_${x.id}`,
                    kind: "transfer",
                    amount: x.amount,
                    from: x.from,
                    to: x.to,
                    createdAt: x.createdAt,
                }))));
            loaded = true;
        })();
    }
    await loading;
}
let persistChain = Promise.resolve();
function schedulePersist() {
    const snapshot = {
        accounts: [...accounts],
        transfers: [...transfers],
        operations: [...operations],
    };
    persistChain = persistChain
        .then(() => (0, jsonFileStore_1.writeJsonFile)(STORE_REL, snapshot))
        .catch((err) => {
        console.error("[qtrade] persist failed", err);
    });
}
exports.qtradeRouter.use((_req, _res, next) => {
    ensureLoaded()
        .then(() => next())
        .catch(next);
});
// JWT middleware applies to every /api/qtrade/* route. Without this any
// caller could enumerate or mutate ledger state for another user — frontend
// was filtering by owner client-side which is unsafe.
exports.qtradeRouter.use(authJwt_1.requireAuth);
function ownerEmail(req) {
    return req.auth?.email ?? "";
}
function ownAccountIds(owner) {
    return new Set(accounts.filter((a) => a.owner === owner).map((a) => a.id));
}
function ownsAccount(owner, accountId) {
    const a = accounts.find((x) => x.id === accountId);
    return !!a && a.owner === owner;
}
function parsePageOpts(req) {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 200)
        : 50;
    const c = req.query.cursor;
    const cursor = typeof c === "string" && c.length > 0 ? c : null;
    return { limit, cursor };
}
function paginate(items, { limit, cursor }) {
    let start = 0;
    if (cursor) {
        const idx = items.findIndex((x) => x.id === cursor);
        if (idx >= 0)
            start = idx + 1;
    }
    const page = items.slice(start, start + limit);
    const nextCursor = page.length === limit && start + limit < items.length
        ? page[page.length - 1].id
        : null;
    return { page, nextCursor };
}
// =======================
// Создать счёт
// =======================
exports.qtradeRouter.post("/accounts", (req, res) => {
    const owner = ownerEmail(req);
    const { owner: bodyOwner } = req.body || {};
    // For backwards compat the client may still send `owner` — but we always
    // bind the new account to the authenticated user's email.
    if (bodyOwner && bodyOwner !== owner) {
        return res.status(403).json({ error: "owner mismatch" });
    }
    const acc = {
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
exports.qtradeRouter.get("/accounts", (req, res) => {
    const owner = ownerEmail(req);
    const items = accounts.filter((a) => a.owner === owner);
    const { page, nextCursor } = paginate(items, parsePageOpts(req));
    res.json({ items: page, nextCursor });
});
// =======================
// История переводов (новые сверху)
// =======================
exports.qtradeRouter.get("/transfers", (req, res) => {
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
exports.qtradeRouter.get("/operations", (req, res) => {
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
exports.qtradeRouter.get("/summary", (req, res) => {
    const owner = ownerEmail(req);
    const ownIds = ownAccountIds(owner);
    const myAccounts = accounts.filter((a) => a.owner === owner);
    const myOps = operations.filter((op) => ownIds.has(op.to) || (op.from && ownIds.has(op.from)));
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
exports.qtradeRouter.get("/accounts/lookup", async (req, res) => {
    const emailRaw = req.query.email;
    if (typeof emailRaw !== "string" || !emailRaw.trim()) {
        return res.status(400).json({ error: "email required" });
    }
    const email = emailRaw.trim().toLowerCase();
    // Try users table first — confirms that email actually corresponds to a
    // registered user, even if no account has been provisioned yet.
    let userExists = false;
    try {
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query("SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1) AS exists", [email]);
        userExists = !!r.rows[0]?.exists;
    }
    catch {
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
    const primary = owned.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
    res.json({
        email,
        primary: { id: primary.id, balance: primary.balance },
        accounts: owned.map((a) => ({ id: a.id, balance: a.balance, createdAt: a.createdAt })),
        userExists,
    });
});
function sendCsvAttachment(res, baseName, rows) {
    const csv = (0, csv_1.csvFromRows)(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
}
// =======================
// Экспорт счетов в CSV
// =======================
exports.qtradeRouter.get("/accounts.csv", (req, res) => {
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
exports.qtradeRouter.get("/transfers.csv", (req, res) => {
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
exports.qtradeRouter.get("/operations.csv", (req, res) => {
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
const idemCache = new Map();
const IDEM_TTL_MS = 24 * 60 * 60 * 1000;
function gcIdem() {
    const cutoff = Date.now() - IDEM_TTL_MS;
    for (const [k, v] of idemCache) {
        if (v.storedAt < cutoff)
            idemCache.delete(k);
    }
}
function readIdemKey(req) {
    const raw = req.headers["idempotency-key"];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!v || typeof v !== "string")
        return null;
    const k = v.trim();
    if (!k || k.length > 128)
        return null;
    return k;
}
function idemNamespace(req, route) {
    return `${ownerEmail(req)}::${route}::${readIdemKey(req)}`;
}
// =======================
// Пополнение счёта
// =======================
exports.qtradeRouter.post("/topup", (req, res) => {
    const owner = ownerEmail(req);
    const { accountId, amount } = req.body || {};
    if (!ownsAccount(owner, accountId)) {
        return res.status(403).json({ error: "not owner of account" });
    }
    const acc = accounts.find((a) => a.id === accountId);
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
    }
    else {
        res.setHeader("Idempotency-Warning", "missing-key");
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
exports.qtradeRouter.post("/transfer", (req, res) => {
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
    }
    else {
        res.setHeader("Idempotency-Warning", "missing-key");
    }
    fromAcc.balance -= a;
    toAcc.balance += a;
    const tx = {
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
