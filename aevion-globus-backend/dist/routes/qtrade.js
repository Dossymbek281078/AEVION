"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qtradeRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const csv_1 = require("../lib/csv");
const jsonFileStore_1 = require("../lib/jsonFileStore");
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
/** Последовательная запись на диск, чтобы не порвать файл при параллельных запросах. */
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
// =======================
// Создать счёт
// =======================
exports.qtradeRouter.post("/accounts", (req, res) => {
    const { owner } = req.body || {};
    if (!owner)
        return res.status(400).json({ error: "owner required" });
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
// Получить все счета
// =======================
exports.qtradeRouter.get("/accounts", (_req, res) => {
    res.json({ items: accounts });
});
// =======================
// История переводов (новые сверху)
// =======================
exports.qtradeRouter.get("/transfers", (_req, res) => {
    const items = [...transfers].reverse();
    res.json({ items });
});
// =======================
// Журнал операций (новые сверху)
// =======================
exports.qtradeRouter.get("/operations", (_req, res) => {
    const items = [...operations].reverse();
    res.json({ items });
});
// =======================
// Сводка по торговому контуру
// =======================
exports.qtradeRouter.get("/summary", (_req, res) => {
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalTransferVolume = transfers.reduce((s, x) => s + x.amount, 0);
    const totalTopupVolume = operations
        .filter((x) => x.kind === "topup")
        .reduce((s, x) => s + x.amount, 0);
    res.json({
        accounts: accounts.length,
        transfers: transfers.length,
        operations: operations.length,
        totalBalance,
        totalTransferVolume,
        totalTopupVolume,
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
exports.qtradeRouter.get("/accounts.csv", (_req, res) => {
    const rows = [
        ["id", "owner", "balance", "createdAt"],
        ...accounts.map((a) => [a.id, a.owner, a.balance, a.createdAt]),
    ];
    sendCsvAttachment(res, "qtrade-accounts", rows);
});
// =======================
// Экспорт переводов в CSV
// =======================
exports.qtradeRouter.get("/transfers.csv", (_req, res) => {
    const rows = [
        ["id", "from", "to", "amount", "createdAt"],
        ...[...transfers].reverse().map((x) => [
            x.id,
            x.from,
            x.to,
            x.amount,
            x.createdAt,
        ]),
    ];
    sendCsvAttachment(res, "qtrade-transfers", rows);
});
// =======================
// Экспорт операций в CSV
// =======================
exports.qtradeRouter.get("/operations.csv", (_req, res) => {
    const rows = [
        ["id", "kind", "amount", "from", "to", "createdAt"],
        ...[...operations].reverse().map((x) => [
            x.id,
            x.kind,
            x.amount,
            x.from,
            x.to,
            x.createdAt,
        ]),
    ];
    sendCsvAttachment(res, "qtrade-operations", rows);
});
// =======================
// Пополнение счёта (MVP)
// =======================
exports.qtradeRouter.post("/topup", (req, res) => {
    const { accountId, amount } = req.body || {};
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc)
        return res.status(400).json({ error: "account not found" });
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0)
        return res.status(400).json({ error: "invalid amount" });
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
    res.json({
        id: acc.id,
        balance: acc.balance,
        updatedAt: new Date().toISOString(),
    });
});
// =======================
// Перевод средств
// =======================
exports.qtradeRouter.post("/transfer", (req, res) => {
    const { from, to, amount } = req.body || {};
    const fromAcc = accounts.find((a) => a.id === from);
    const toAcc = accounts.find((a) => a.id === to);
    if (!fromAcc || !toAcc)
        return res.status(400).json({ error: "invalid accounts" });
    if (from === to)
        return res.status(400).json({ error: "cannot transfer to same account" });
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0 || fromAcc.balance < a)
        return res.status(400).json({ error: "invalid amount" });
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
    res.json(tx);
});
