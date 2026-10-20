"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aevRouter = void 0;
exports.internalMintForDevice = internalMintForDevice;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authJwt_1 = require("../lib/authJwt");
const jsonFileStore_1 = require("../lib/jsonFileStore");
// AEV wallet + append-only ledger backend. MVP storage via jsonFileStore
// (atomic JSON files in AEVION_DATA_DIR). Prisma schema готов для миграции
// на Postgres когда DATABASE_URL будет задан.
//
// Endpoints:
//  GET  /api/aev/wallet/:deviceId           — read wallet snapshot
//  POST /api/aev/wallet/:deviceId/sync      — upsert (idempotent) wallet snapshot
//  POST /api/aev/wallet/:deviceId/mint      — append mint entry, update balance
//  POST /api/aev/wallet/:deviceId/spend     — append spend entry, update balance
//  GET  /api/aev/ledger/:deviceId?limit=    — append-only ledger tail
//  GET  /api/aev/stats                      — global aggregates (lifetime, ledger size)
exports.aevRouter = (0, express_1.Router)();
// ── Rate limits ────────────────────────────────────────────────────
// Per-IP throttle on write paths; reads (snapshot/ledger/stats) stay
// open. windowMs=60s aligned with QSign limiter conventions.
const writeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded", limit: "60 writes per minute per IP" },
});
const syncLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded", limit: "30 syncs per minute per IP" },
});
// ── JWT auth binding (optional) ────────────────────────────────────
// If a Bearer token is present and valid, returns its sub (userId).
// Returns null on missing or malformed; caller decides if anonymous
// access is acceptable for the route.
function readUserIdFromBearer(req) {
    const header = req.headers?.authorization;
    if (!header?.startsWith("Bearer "))
        return null;
    const token = header.slice(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, authJwt_1.getJwtSecret)(), { algorithms: ["HS256"] });
        if (typeof decoded === "object" && decoded !== null && "sub" in decoded) {
            const sub = decoded.sub;
            return typeof sub === "string" ? sub : null;
        }
        return null;
    }
    catch {
        return null;
    }
}
// AEC↔fiat boundary R1 (docs/bank/AEC_FIAT_BOUNDARY.md): AEC is platform-
// minted only. Public anonymous mint is the legacy QTrade-style demo path.
// In production we require Bearer; non-production stays open so
// scripts/bank-prod-smoke.js can run in dev / CI without a registered user.
//
// Set AEV_PUBLIC_MINT_ENABLED=1 to bypass even on prod (escape hatch for
// urgent rollback or partner-test flows). Server-side mint authority via
// internalMintForDevice() is unaffected — it's an in-process call, not a
// route handler.
function requireAuthForMintIfProd(req, res) {
    const userId = readUserIdFromBearer(req);
    if (userId)
        return userId;
    const isProd = process.env.NODE_ENV === "production";
    const escapeHatch = process.env.AEV_PUBLIC_MINT_ENABLED === "1";
    if (isProd && !escapeHatch) {
        res.status(401).json({
            error: "auth_required_in_prod",
            reason: "AEC mint requires Bearer auth on production (AEC↔fiat boundary R1).",
        });
        return "blocked";
    }
    return null; // anonymous, but allowed (non-prod or escape hatch)
}
// Flat filename — jsonFileStore mkdirs only top-level AEVION_DATA_DIR;
// subdirectories aren't autocreated.
const WALLETS_FILE = "aev_wallets.json";
const LEDGER_FILE = "aev_ledger.json";
const DEFAULT_WALLET = (deviceId, userId) => ({
    deviceId,
    userId,
    balance: 0,
    lifetimeMined: 0,
    lifetimeSpent: 0,
    globalSupplyMined: 0,
    dividendsClaimed: 0,
    modes: { play: true, compute: false, stewardship: true },
    startTs: Date.now(),
    updatedAt: Date.now(),
    createdAt: Date.now(),
});
async function loadWallets() {
    return (0, jsonFileStore_1.readJsonFile)(WALLETS_FILE, {});
}
async function loadLedger() {
    return (0, jsonFileStore_1.readJsonFile)(LEDGER_FILE, []);
}
// ── Изменение кошелька: проверка и запись одной операцией ──────────
//
// Раньше каждый обработчик делал «прочитал файл → проверил баланс →
// записал файл» тремя отдельными await. Между проверкой и записью успевал
// вклиниться параллельный запрос, и оба видели один и тот же баланс.
//
// Замер 2026-08-10 (10 одновременных списаний по 100 при балансе 100):
// прошли ВСЕ ДЕСЯТЬ, каждому вернулось ok:true, итоговый баланс 0, а в
// реестре осталась одна запись из десяти. То есть модуль-потребитель
// выдал товар десять раз, списание засчиталось одно, и аудит этого не
// показывает. Отказа при этом не было ни одного.
//
// updateJsonFile держит замок на файл от чтения до записи, поэтому
// проверка баланса и списание больше не разъезжаются.
/** Прочитать кошельки, изменить на месте и записать — под замком на файл.
 *  `fn` возвращает ответ обработчику; кошельки правятся в переданном объекте. */
async function mutateWallets(fn) {
    let out;
    await (0, jsonFileStore_1.updateJsonFile)(WALLETS_FILE, {}, async (wallets) => {
        out = await fn(wallets);
        return wallets;
    });
    return out;
}
/** Дозапись в реестр. Тоже read-modify-write: без замка параллельные
 *  записи затирали друг друга — из десяти операций сохранялась одна. */
async function appendLedger(entry) {
    await (0, jsonFileStore_1.updateJsonFile)(LEDGER_FILE, [], (ledger) => {
        const list = Array.isArray(ledger) ? ledger : [];
        list.push(entry);
        // Trim oldest if we're over cap (append-only — but bounded for MVP)
        return list.length > LEDGER_MAX ? list.slice(-LEDGER_MAX) : list;
    });
}
/**
 * Device ids that are also property names of every JS object. The format
 * check below happily accepts them — "__proto__" is nine characters of
 * letters and underscores — and the wallet store is a plain object parsed
 * from JSON, so `wallets["__proto__"]` answers with Object.prototype instead
 * of undefined. Measured before this guard existed:
 *
 *   GET  /api/aev/wallet/__proto__        → 200 with an empty wallet
 *                                           (the `if (!w) 404` never fires)
 *   POST /api/aev/wallet/__proto__/sync   → 200; `existing.userId` is
 *                                           undefined, so the ownership
 *                                           check that blocks takeover is
 *                                           skipped, and the assignment
 *                                           rewrites the store's prototype
 *
 * The 27.07 hardening pass closed this shape in pricing, skill badges,
 * qmelanin, qskyway, smeta-trainer and the payment webhooks — seven
 * branches, none of which touch this file, the one holding balances.
 */
const RESERVED_DEVICE_IDS = new Set([
    "__proto__",
    "constructor",
    "prototype",
    "hasOwnProperty",
    "toString",
    "valueOf",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
]);
function sanitizeDeviceId(raw) {
    if (typeof raw !== "string")
        return null;
    const t = raw.trim();
    if (!/^[a-zA-Z0-9._-]{6,128}$/.test(t))
        return null;
    // Rejected by name, not by tightening the format: dots, dashes and
    // underscores stay legal because real device ids use them.
    if (RESERVED_DEVICE_IDS.has(t))
        return null;
    return t;
}
/**
 * Read a wallet without walking the prototype chain. Belt to the braces
 * above: if a reserved id ever slips through another entry point, this still
 * answers "no such wallet" rather than handing back Object.prototype.
 */
function walletOf(wallets, deviceId) {
    return Object.prototype.hasOwnProperty.call(wallets, deviceId)
        ? wallets[deviceId]
        : undefined;
}
function clampAmount(raw, maxPerCall = 1000) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    if (n > maxPerCall)
        return null;
    return Math.round(n * 1000000) / 1000000;
}
const LEDGER_MAX = 50000;
// ── GET /api/aev/wallet/:deviceId ──────────────────────────────────
exports.aevRouter.get("/wallet/:deviceId", async (req, res) => {
    const deviceId = sanitizeDeviceId(req.params.deviceId);
    if (!deviceId)
        return res.status(400).json({ error: "invalid_device_id" });
    const wallets = await loadWallets();
    const w = walletOf(wallets, deviceId);
    if (!w)
        return res.status(404).json({ error: "not_found", deviceId });
    res.json({ ok: true, wallet: w });
});
// ── POST /api/aev/wallet/:deviceId/sync ────────────────────────────
// Idempotent upsert. Frontend periodically pushes its localStorage
// snapshot — server takes max() of monotonic counters to converge
// with offline mints (last-writer-wins на balance/modes).
//
// Auth-binding: если wallet ранее был привязан к userId (через
// authed sync/mint/spend), последующие writes с НЕсовпадающим userId
// или anonymous Bearer-less попыткой → 403 ownership_mismatch. Это
// блокирует takeover чужого deviceId через подделку.
exports.aevRouter.post("/wallet/:deviceId/sync", syncLimiter, async (req, res) => {
    const deviceId = sanitizeDeviceId(req.params.deviceId);
    if (!deviceId)
        return res.status(400).json({ error: "invalid_device_id" });
    const body = req.body ?? {};
    // Production gate (R1 boundary). Same logic as /mint — sync can inflate
    // lifetimeMined via Math.max(existing, body), so it's a mint surface too.
    const gate = requireAuthForMintIfProd(req, res);
    if (gate === "blocked")
        return;
    const bearerUserId = readUserIdFromBearer(req);
    const outcome = await mutateWallets((wallets) => {
        const existing = walletOf(wallets, deviceId) ?? DEFAULT_WALLET(deviceId, null);
        // Anti-takeover: bound wallet → must present matching Bearer
        if (existing.userId && existing.userId !== bearerUserId) {
            return { ok: false, error: "ownership_mismatch" };
        }
        const merged = {
            ...existing,
            userId: bearerUserId ?? existing.userId,
            balance: Number.isFinite(body.balance) ? Number(body.balance) : existing.balance,
            lifetimeMined: Math.max(existing.lifetimeMined, Number(body.lifetimeMined) || 0),
            lifetimeSpent: Math.max(existing.lifetimeSpent, Number(body.lifetimeSpent) || 0),
            globalSupplyMined: Math.max(existing.globalSupplyMined, Number(body.globalSupplyMined) || 0),
            dividendsClaimed: Math.max(existing.dividendsClaimed, Number(body.dividendsClaimed) || 0),
            modes: {
                play: !!(body.modes?.play ?? existing.modes.play),
                compute: !!(body.modes?.compute ?? existing.modes.compute),
                stewardship: !!(body.modes?.stewardship ?? existing.modes.stewardship),
            },
            startTs: Math.min(existing.startTs, Number(body.startTs) || existing.startTs),
            updatedAt: Date.now(),
        };
        wallets[deviceId] = merged;
        return { ok: true, wallet: merged };
    });
    if (!outcome.ok)
        return res.status(403).json({ error: outcome.error });
    res.json({ ok: true, wallet: outcome.wallet });
});
// ── POST /api/aev/wallet/:deviceId/mint ────────────────────────────
exports.aevRouter.post("/wallet/:deviceId/mint", writeLimiter, async (req, res) => {
    const deviceId = sanitizeDeviceId(req.params.deviceId);
    if (!deviceId)
        return res.status(400).json({ error: "invalid_device_id" });
    const amount = clampAmount(req.body?.amount);
    if (amount === null)
        return res.status(400).json({ error: "invalid_amount" });
    // Production gate (R1 boundary — see docs/bank/AEV_PUBLIC_MINT_FINDING_2026-05-09.md).
    // Anonymous mint is allowed in dev/test for the smoke flow; prod requires
    // a real bearer so client-supplied amounts are tied to a user identity
    // and per-user limits/audits can be applied later.
    const gate = requireAuthForMintIfProd(req, res);
    if (gate === "blocked")
        return;
    const bearerUserId = readUserIdFromBearer(req);
    const outcome = await mutateWallets(async (wallets) => {
        const w = walletOf(wallets, deviceId) ?? DEFAULT_WALLET(deviceId, null);
        if (w.userId && w.userId !== bearerUserId) {
            return { ok: false, error: "ownership_mismatch" };
        }
        if (!w.userId && bearerUserId)
            w.userId = bearerUserId;
        w.balance = Math.round((w.balance + amount) * 1000000) / 1000000;
        w.lifetimeMined = Math.round((w.lifetimeMined + amount) * 1000000) / 1000000;
        w.globalSupplyMined = Math.round((w.globalSupplyMined + amount) * 1000000) / 1000000;
        w.updatedAt = Date.now();
        wallets[deviceId] = w;
        const entry = {
            id: (0, node_crypto_1.randomUUID)(),
            deviceId,
            kind: "mint",
            amount,
            sourceKind: typeof req.body?.sourceKind === "string" ? req.body.sourceKind : undefined,
            sourceModule: typeof req.body?.sourceModule === "string" ? req.body.sourceModule : undefined,
            sourceAction: typeof req.body?.sourceAction === "string" ? req.body.sourceAction : undefined,
            reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 256) : undefined,
            balanceAfter: w.balance,
            ts: Date.now(),
        };
        await appendLedger(entry);
        return { ok: true, wallet: w, entry };
    });
    if (!outcome.ok)
        return res.status(403).json({ error: outcome.error });
    res.json({ ok: true, wallet: outcome.wallet, entry: outcome.entry });
});
// ── POST /api/aev/wallet/:deviceId/spend ───────────────────────────
exports.aevRouter.post("/wallet/:deviceId/spend", writeLimiter, async (req, res) => {
    const deviceId = sanitizeDeviceId(req.params.deviceId);
    if (!deviceId)
        return res.status(400).json({ error: "invalid_device_id" });
    const amount = clampAmount(req.body?.amount);
    if (amount === null)
        return res.status(400).json({ error: "invalid_amount" });
    const bearerUserId = readUserIdFromBearer(req);
    // Проверка баланса и списание — внутри одной операции над файлом.
    // Порознь они разъезжались: десять одновременных списаний по 100 при
    // балансе 100 проходили все десять.
    const outcome = await mutateWallets(async (wallets) => {
        const w = walletOf(wallets, deviceId);
        if (!w)
            return { ok: false, status: 404, body: { error: "not_found", deviceId } };
        if (w.userId && w.userId !== bearerUserId) {
            return { ok: false, status: 403, body: { error: "ownership_mismatch" } };
        }
        if (!w.userId && bearerUserId)
            w.userId = bearerUserId;
        if (w.balance < amount) {
            return {
                ok: false,
                status: 409,
                body: { error: "insufficient_funds", balance: w.balance, requested: amount },
            };
        }
        w.balance = Math.round((w.balance - amount) * 1000000) / 1000000;
        w.lifetimeSpent = Math.round((w.lifetimeSpent + amount) * 1000000) / 1000000;
        w.updatedAt = Date.now();
        wallets[deviceId] = w;
        const entry = {
            id: (0, node_crypto_1.randomUUID)(),
            deviceId,
            kind: "spend",
            amount,
            sourceKind: typeof req.body?.sourceKind === "string" ? req.body.sourceKind : undefined,
            sourceModule: typeof req.body?.sourceModule === "string" ? req.body.sourceModule : undefined,
            sourceAction: typeof req.body?.sourceAction === "string" ? req.body.sourceAction : undefined,
            reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 256) : undefined,
            balanceAfter: w.balance,
            ts: Date.now(),
        };
        await appendLedger(entry);
        return { ok: true, wallet: w, entry };
    });
    if (!outcome.ok)
        return res.status(outcome.status).json(outcome.body);
    res.json({ ok: true, wallet: outcome.wallet, entry: outcome.entry });
});
// ── GET /api/aev/ledger/:deviceId ──────────────────────────────────
exports.aevRouter.get("/ledger/:deviceId", async (req, res) => {
    const deviceId = sanitizeDeviceId(req.params.deviceId);
    if (!deviceId)
        return res.status(400).json({ error: "invalid_device_id" });
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 1000 ? limitRaw : 100;
    const ledger = await loadLedger();
    const filtered = ledger.filter((e) => e.deviceId === deviceId);
    const tail = filtered.slice(-limit).reverse(); // newest first
    res.json({ ok: true, deviceId, count: filtered.length, entries: tail });
});
// Cross-module mint helper. Used by other backend routes (e.g. bureau
// cert reward claim) that need to credit AEC to a device wallet without
// going through the public HTTP mint endpoint. Same balance/ledger
// semantics as POST /wallet/:deviceId/mint, plus an optional ownership
// check (expectedUserId) so callers can refuse to mint into a wallet
// that's bound to a different user. Returns { ok: false, error } on
// validation failure rather than throwing — callers handle gracefully.
async function internalMintForDevice(opts) {
    const deviceId = sanitizeDeviceId(opts.deviceId);
    if (!deviceId)
        return { ok: false, error: "invalid_device_id" };
    const amount = clampAmount(opts.amount);
    if (amount === null)
        return { ok: false, error: "invalid_amount" };
    return mutateWallets(async (wallets) => {
        const w = walletOf(wallets, deviceId) ?? DEFAULT_WALLET(deviceId, opts.expectedUserId ?? null);
        if (opts.expectedUserId && w.userId && w.userId !== opts.expectedUserId) {
            return { ok: false, error: "ownership_mismatch", balance: w.balance };
        }
        if (!w.userId && opts.expectedUserId)
            w.userId = opts.expectedUserId;
        w.balance = Math.round((w.balance + amount) * 1000000) / 1000000;
        w.lifetimeMined = Math.round((w.lifetimeMined + amount) * 1000000) / 1000000;
        w.globalSupplyMined = Math.round((w.globalSupplyMined + amount) * 1000000) / 1000000;
        w.updatedAt = Date.now();
        wallets[deviceId] = w;
        const entry = {
            id: (0, node_crypto_1.randomUUID)(),
            deviceId,
            kind: "mint",
            amount,
            sourceKind: opts.sourceKind,
            sourceModule: opts.sourceModule,
            sourceAction: opts.sourceAction,
            reason: opts.reason?.slice(0, 256),
            balanceAfter: w.balance,
            ts: Date.now(),
        };
        await appendLedger(entry);
        return { ok: true, wallet: w, entry };
    });
}
// ── GET /api/aev/stats ─────────────────────────────────────────────
exports.aevRouter.get("/stats", async (_req, res) => {
    const [wallets, ledger] = await Promise.all([loadWallets(), loadLedger()]);
    const walletList = Object.values(wallets);
    const totalMined = walletList.reduce((s, w) => s + w.lifetimeMined, 0);
    const totalSpent = walletList.reduce((s, w) => s + w.lifetimeSpent, 0);
    const totalBalance = walletList.reduce((s, w) => s + w.balance, 0);
    res.json({
        ok: true,
        wallets: walletList.length,
        ledgerEntries: ledger.length,
        aggregate: {
            totalMined: Math.round(totalMined * 100) / 100,
            totalSpent: Math.round(totalSpent * 100) / 100,
            totalBalance: Math.round(totalBalance * 100) / 100,
        },
        capRemaining: Math.max(0, 21000000 - totalMined),
    });
});
