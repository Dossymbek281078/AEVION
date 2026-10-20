"use strict";
/**
 * Constitution funnel — lightweight event tracking.
 *
 *   POST /api/constitution/funnel/track  { event, props? }
 *   GET  /api/admin/constitution/funnel  (admin only)
 *
 * Events live in `constitution_events` (Postgres, with in-memory ring
 * fallback). Session correlation is fingerprint(IP+UA) — good enough
 * for funnel analysis without cookies/identity friction.
 *
 * Aggregation is computed on-the-fly per GET: count per event +
 * pairwise conversion rate within same session (A → B if same fp_hash
 * sees A then B within 30 minutes).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.constitutionFunnelAdminRouter = exports.constitutionFunnelTrackRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const rateLimit_1 = require("../lib/rateLimit");
const dbPool_1 = require("../lib/dbPool");
const authJwt_1 = require("../lib/authJwt");
const adminAuth_1 = require("../lib/adminAuth");
const platform_1 = require("../lib/sentry/platform");
const queryNumber_1 = require("../lib/queryNumber");
const capture = (0, platform_1.makeServiceCapture)("constitutionFunnel");
const TRACKED_EVENTS = new Set([
    "page_view",
    "slider_change",
    "save_clicked",
    "save_success",
    "qsign_clicked",
    "planet_publish",
    "pdf_download",
    "ai_suggest",
    "upgrade_click",
    "upgrade_complete",
    "tour_started",
    "tour_completed",
    "academy_lesson_done",
    "academy_cert",
    "blog_view",
    "embed_view",
    "comment_posted",
    "vote_cast",
]);
const ANON_SALT = process.env.CONSTITUTION_ANON_SALT || "aevion-constitution-v1";
function fingerprint(req) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";
    const ua = String(req.headers["user-agent"] || "unknown").slice(0, 200);
    return (0, node_crypto_1.createHash)("sha256").update(`${ip}|${ua}|${ANON_SALT}`).digest("hex").slice(0, 16);
}
function clientIp(req) {
    return (req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown");
}
// Проверка вынесена в lib/adminAuth: понадобилась вторая (сводка расхода
// QReal), а копировать решение об авторизации нельзя — копии расходятся
// молча. Правило допуска и умолчание перенесены дословно.
function isAdmin(req) {
    return (0, adminAuth_1.isAdminRequest)(req);
}
const MEM_MAX = 5000;
const memRing = [];
let tableReady = false;
let dbAvailable = false;
async function ensureEventsTable() {
    if (tableReady)
        return;
    try {
        const pool = (0, dbPool_1.getPool)();
        await pool.query(`
      CREATE TABLE IF NOT EXISTS constitution_events (
        "id"        UUID PRIMARY KEY,
        "event"     TEXT NOT NULL,
        "fpHash"    TEXT NOT NULL,
        "userId"    TEXT,
        "props"     JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_events_event
        ON constitution_events ("event", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_constitution_events_fp
        ON constitution_events ("fpHash", "createdAt" DESC);
    `);
        dbAvailable = true;
    }
    catch {
        dbAvailable = false;
    }
    tableReady = true;
}
function pushMem(row) {
    memRing.unshift(row);
    if (memRing.length > MEM_MAX)
        memRing.length = MEM_MAX;
}
exports.constitutionFunnelTrackRouter = (0, express_1.Router)();
exports.constitutionFunnelAdminRouter = (0, express_1.Router)();
const writeLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 300, keyPrefix: "constitution-funnel-track" });
const readLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 60, keyPrefix: "constitution-funnel-read" });
exports.constitutionFunnelTrackRouter.post("/track", writeLimit, async (req, res) => {
    try {
        const body = (req.body && typeof req.body === "object")
            ? req.body
            : {};
        const event = typeof body.event === "string" ? body.event : "";
        if (!TRACKED_EVENTS.has(event)) {
            return res.status(400).json({ error: "unknown_event", hint: Array.from(TRACKED_EVENTS) });
        }
        const props = (body.props && typeof body.props === "object")
            ? body.props
            : {};
        // Strip any keys > 64 chars or values > 200 chars to avoid abuse
        const cleanProps = {};
        for (const [k, v] of Object.entries(props)) {
            if (k.length > 64)
                continue;
            if (typeof v === "string" && v.length > 200) {
                cleanProps[k] = v.slice(0, 200);
            }
            else if (typeof v === "number" || typeof v === "boolean") {
                cleanProps[k] = v;
            }
            else if (typeof v === "string") {
                cleanProps[k] = v;
            }
        }
        const payload = (0, authJwt_1.verifyBearerOptional)(req);
        const userId = payload && typeof payload.userId === "string"
            ? String(payload.userId)
            : null;
        const row = {
            id: (0, node_crypto_1.randomUUID)(),
            event,
            fpHash: fingerprint(req),
            userId,
            props: cleanProps,
            createdAt: new Date().toISOString(),
        };
        await ensureEventsTable();
        if (dbAvailable) {
            try {
                const pool = (0, dbPool_1.getPool)();
                await pool.query(`INSERT INTO constitution_events ("id","event","fpHash","userId","props","createdAt")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6)`, [row.id, row.event, row.fpHash, row.userId, JSON.stringify(row.props), row.createdAt]);
            }
            catch { /* fall through to memory */ }
        }
        pushMem(row);
        res.json({ ok: true });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: "track_failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }
});
exports.constitutionFunnelAdminRouter.get("/", readLimit, async (req, res) => {
    if (!isAdmin(req))
        return res.status(403).json({ error: "admin_required" });
    try {
        const hours = Math.max(1, Math.min(168, (0, queryNumber_1.queryNumber)(req.query.hours, 24)));
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        let rows = [];
        await ensureEventsTable();
        if (dbAvailable) {
            try {
                const pool = (0, dbPool_1.getPool)();
                const r = await pool.query(`SELECT "id","event","fpHash","userId","props","createdAt"
             FROM constitution_events
             WHERE "createdAt" > $1
             ORDER BY "createdAt" ASC
             LIMIT 20000`, [since]);
                rows = r.rows.map((x) => ({
                    id: String(x.id),
                    event: String(x.event),
                    fpHash: String(x.fpHash),
                    userId: x.userId ?? null,
                    props: x.props ?? {},
                    createdAt: x.createdAt instanceof Date ? x.createdAt.toISOString() : String(x.createdAt),
                }));
            }
            catch { /* fall through */ }
        }
        if (rows.length === 0) {
            rows = memRing.filter((r) => r.createdAt > since).reverse();
        }
        // Count per event
        const counts = new Map();
        for (const r of rows)
            counts.set(r.event, (counts.get(r.event) ?? 0) + 1);
        // Pairwise conversion within session (30-min window)
        const SESSION_WINDOW_MS = 30 * 60 * 1000;
        const PAIRS = [
            ["page_view", "slider_change"],
            ["slider_change", "save_clicked"],
            ["save_clicked", "save_success"],
            ["save_success", "qsign_clicked"],
            ["qsign_clicked", "planet_publish"],
            ["qsign_clicked", "pdf_download"],
            ["page_view", "ai_suggest"],
            ["page_view", "upgrade_click"],
            ["upgrade_click", "upgrade_complete"],
            ["tour_started", "tour_completed"],
            ["page_view", "academy_lesson_done"],
            ["academy_lesson_done", "academy_cert"],
        ];
        // Group rows by fpHash
        const byFp = new Map();
        for (const r of rows) {
            const arr = byFp.get(r.fpHash) ?? [];
            arr.push(r);
            byFp.set(r.fpHash, arr);
        }
        const pairResults = PAIRS.map(([from, to]) => {
            let fromCount = 0;
            let convertedCount = 0;
            for (const arr of byFp.values()) {
                // Sorted ascending already
                for (let i = 0; i < arr.length; i++) {
                    if (arr[i].event !== from)
                        continue;
                    fromCount += 1;
                    const t = new Date(arr[i].createdAt).getTime();
                    let found = false;
                    for (let j = i + 1; j < arr.length; j++) {
                        const dt = new Date(arr[j].createdAt).getTime() - t;
                        if (dt > SESSION_WINDOW_MS)
                            break;
                        if (arr[j].event === to) {
                            found = true;
                            break;
                        }
                    }
                    if (found)
                        convertedCount += 1;
                }
            }
            return {
                from,
                to,
                fromCount,
                convertedCount,
                ratePct: fromCount > 0 ? Math.round((convertedCount / fromCount) * 1000) / 10 : 0,
            };
        });
        res.json({
            windowHours: hours,
            totalEvents: rows.length,
            uniqueSessions: byFp.size,
            eventCounts: Array.from(counts.entries())
                .map(([event, count]) => ({ event, count }))
                .sort((a, b) => b.count - a.count),
            conversions: pairResults,
        });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: "funnel_failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }
});
