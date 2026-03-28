"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrightRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const authJwt_1 = require("../lib/authJwt");
const ensureUsersTable_1 = require("../lib/ensureUsersTable");
const dbPool_1 = require("../lib/dbPool");
exports.qrightRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
let ensuredTable = false;
async function ensureQRightTable() {
    if (ensuredTable)
        return;
    // Minimal table bootstrap for fresh DBs.
    // Backend uses raw SQL via `pg`, so we ensure the table exists here.
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
    // If the table already existed (older bootstraps), ensure columns exist.
    await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "country" TEXT;`);
    await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "city" TEXT;`);
    await pool.query(`ALTER TABLE "QRightObject" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;`);
    ensuredTable = true;
}
// 🔹 Получить все объекты (или ?mine=1 при Bearer — по ownerUserId, с fallback на старые строки по email)
exports.qrightRouter.get("/objects", async (req, res) => {
    try {
        await ensureQRightTable();
        const mineRaw = req.query.mine;
        const mine = mineRaw === "1" ||
            mineRaw === "true" ||
            String(mineRaw || "").toLowerCase() === "yes";
        if (mine) {
            const auth = (0, authJwt_1.verifyBearerOptional)(req);
            if (!auth) {
                return res.status(401).json({ error: "Bearer token required for mine=1" });
            }
            const result = await pool.query(`
        SELECT * FROM "QRightObject"
        WHERE ("ownerUserId" = $1)
           OR ("ownerUserId" IS NULL AND "ownerEmail" = $2)
        ORDER BY "createdAt" DESC
        `, [auth.sub, auth.email]);
            return res.json({
                items: result.rows,
                total: result.rowCount,
                scope: "mine",
            });
        }
        const result = await pool.query('SELECT * FROM "QRightObject" ORDER BY "createdAt" DESC');
        res.json({
            items: result.rows,
            total: result.rowCount,
            scope: "all",
        });
    }
    catch (err) {
        res.status(500).json({
            error: "DB error",
            code: err.code,
            name: err.name,
            details: err.message,
        });
    }
});
// 🔹 Создать объект
exports.qrightRouter.post("/objects", async (req, res) => {
    try {
        const { title, description, kind, ownerName, ownerEmail, country, city } = req.body;
        if (!title || !description || !kind) {
            return res.status(400).json({
                error: "title, description and kind required",
            });
        }
        const raw = JSON.stringify({ title, description, kind, country, city });
        const contentHash = crypto_1.default
            .createHash("sha256")
            .update(raw)
            .digest("hex");
        await ensureQRightTable();
        const auth = (0, authJwt_1.verifyBearerOptional)(req);
        let resolvedOwnerName = ownerName ?? null;
        let resolvedOwnerEmail = ownerEmail ?? null;
        let resolvedOwnerUserId = null;
        if (auth) {
            await (0, ensureUsersTable_1.ensureUsersTable)(pool);
            const u = await pool.query(`SELECT "id","name","email" FROM "AEVIONUser" WHERE "id"=$1`, [auth.sub]);
            const row = u.rows?.[0];
            if (row) {
                resolvedOwnerUserId = row.id;
                if (!resolvedOwnerName)
                    resolvedOwnerName = row.name;
                if (!resolvedOwnerEmail)
                    resolvedOwnerEmail = row.email;
            }
        }
        const result = await pool.query(`
      INSERT INTO "QRightObject"
      ("id","title","description","kind","contentHash","ownerName","ownerEmail","ownerUserId","country","city","createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *
      `, [
            crypto_1.default.randomUUID(),
            title,
            description,
            kind,
            contentHash,
            resolvedOwnerName,
            resolvedOwnerEmail,
            resolvedOwnerUserId,
            country || null,
            city || null,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({
            error: "DB error",
            code: err.code,
            name: err.name,
            details: err.message,
        });
    }
});
