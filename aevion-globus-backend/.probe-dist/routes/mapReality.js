"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRealityRouter = void 0;
const express_1 = require("express");
const rateLimit_1 = require("../lib/rateLimit");
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const dbPool_1 = require("../lib/dbPool");
const ensureMapRealityTables_1 = require("../lib/ensureMapRealityTables");
const platform_1 = require("../lib/sentry/platform");
const queryNumber_1 = require("../lib/queryNumber");
const WARN = "Хранилище временно недоступно. Это НЕ значит, что записи нет — повторите запрос позже.";
const capture = (0, platform_1.makeServiceCapture)("mapReality");
const pool = (0, dbPool_1.getPool)();
(async () => {
    try {
        await (0, ensureMapRealityTables_1.ensureMapRealityTables)(pool);
    }
    catch { /* silent — in-memory fallback active */ }
})();
const generalLimiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 60, keyPrefix: "mapreality:general", message: "rate_limited" });
const submitLimiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 10, keyPrefix: "mapreality:submit", message: "rate_limited" });
const supportLimiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 30, keyPrefix: "mapreality:support", message: "rate_limited" });
exports.mapRealityRouter = (0, express_1.Router)();
// Apply general rate limit to all routes; submit/support add their own on top.
exports.mapRealityRouter.use(generalLimiter);
const CATEGORIES = ["need", "event", "request"];
const STATUSES = ["active", "resolved", "flagged"];
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_ALIAS = 64;
const MAX_COUNTRY = 64;
const MAX_CITY = 80;
const MAX_MEM_SIGNALS = 200;
// ─── In-memory fallback ───────────────────────────────────────────────────────
const memSignals = [];
const memSupports = [];
let memNextId = 1;
function nowIso() {
    return new Date().toISOString();
}
function trimMemStore() {
    if (memSignals.length > MAX_MEM_SIGNALS) {
        // Keep newest by id desc (id grows with time).
        memSignals.sort((a, b) => b.id - a.id);
        const removed = memSignals.splice(MAX_MEM_SIGNALS);
        const removedIds = new Set(removed.map((s) => s.id));
        for (let i = memSupports.length - 1; i >= 0; i--) {
            if (removedIds.has(memSupports[i].signal_id))
                memSupports.splice(i, 1);
        }
    }
}
function param(req, key) {
    const v = req.params[key];
    return Array.isArray(v) ? v[0] : String(v ?? "");
}
function clampString(value, max) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    return trimmed.slice(0, max);
}
function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        if (Number.isFinite(n))
            return n;
    }
    return null;
}
// ─── GET /api/mapreality/health ───────────────────────────────────────────────
exports.mapRealityRouter.get("/health", async (_req, res) => {
    let totalSignals = 0;
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM mapreality_signals`);
            totalSignals = rows[0]?.total ?? 0;
        }
        else {
            totalSignals = memSignals.length;
        }
    }
    catch {
        totalSignals = memSignals.length;
    }
    res.json({
        ok: true,
        service: "mapreality",
        dbReady: (0, ensureMapRealityTables_1.isMapRealityDbReady)(),
        totalSignals,
    });
});
// ─── POST /api/mapreality/signals ─────────────────────────────────────────────
exports.mapRealityRouter.post("/signals", submitLimiter, async (req, res) => {
    const body = req.body;
    const title = clampString(body.title, MAX_TITLE);
    const description = clampString(body.description, MAX_DESCRIPTION);
    const country = clampString(body.country, MAX_COUNTRY);
    const authorAlias = clampString(body.authorAlias, MAX_ALIAS);
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const city = clampString(body.city, MAX_CITY);
    const lat = parseNumber(body.lat);
    const lng = parseNumber(body.lng);
    if (!title)
        return res.status(400).json({ error: "title required (1..200 chars)" });
    if (!description)
        return res.status(400).json({ error: "description required (1..2000 chars)" });
    if (!country)
        return res.status(400).json({ error: "country required" });
    if (!authorAlias)
        return res.status(400).json({ error: "authorAlias required" });
    if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
    }
    if (lat !== null && (lat < -90 || lat > 90))
        return res.status(400).json({ error: "lat out of range" });
    if (lng !== null && (lng < -180 || lng > 180))
        return res.status(400).json({ error: "lng out of range" });
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const { rows } = await pool.query(`INSERT INTO mapreality_signals
           (title, description, category, country, city, lat, lng, author_alias)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, support_count`, [title, description, category, country, city, lat, lng, authorAlias]);
            const row = rows[0];
            return res.status(201).json({ id: row.id, supportCount: row.support_count, storage: "db" });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] POST /signals DB error", e);
    }
    const signal = {
        id: memNextId++,
        title,
        description,
        category: category,
        country,
        city,
        lat,
        lng,
        author_alias: authorAlias,
        support_count: 0,
        status: "active",
        created_at: nowIso(),
    };
    memSignals.push(signal);
    trimMemStore();
    return res.status(201).json({ id: signal.id, supportCount: 0, storage: "memory" });
});
// ─── GET /api/mapreality/signals ──────────────────────────────────────────────
exports.mapRealityRouter.get("/signals", async (req, res) => {
    const { category, country, city, status, limit, offset } = req.query;
    const limitN = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const offsetN = Math.max(Number(offset) || 0, 0);
    const statusFilter = status && STATUSES.includes(status) ? status : "active";
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const conditions = [`status = $1`];
            const args = [statusFilter];
            let idx = 2;
            if (category && CATEGORIES.includes(category)) {
                conditions.push(`category = $${idx++}`);
                args.push(category);
            }
            if (country) {
                conditions.push(`country = $${idx++}`);
                args.push(country);
            }
            if (city) {
                conditions.push(`city = $${idx++}`);
                args.push(city);
            }
            const where = `WHERE ${conditions.join(" AND ")}`;
            const [{ rows }, { rows: cnt }] = await Promise.all([
                pool.query(`SELECT * FROM mapreality_signals ${where}
           ORDER BY support_count DESC, created_at DESC
           LIMIT $${idx++} OFFSET $${idx}`, [...args, limitN, offsetN]),
                pool.query(`SELECT COUNT(*)::int AS total FROM mapreality_signals ${where}`, args),
            ]);
            return res.json({ signals: rows, total: cnt[0]?.total ?? rows.length });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] GET /signals DB error", e);
        // Ниже лежит запасная память, в проде пустая: список ушёл бы как
        // { signals: [], total: 0 } — то есть «сигналов нет» вместо «не смогли
        // спросить». Пустой список читается как факт о мире, а не как отказ.
        return res.status(503).json({ error: "storage_unavailable", warning: WARN });
    }
    let signals = memSignals.filter((s) => s.status === statusFilter);
    if (category && CATEGORIES.includes(category)) {
        signals = signals.filter((s) => s.category === category);
    }
    if (country)
        signals = signals.filter((s) => s.country === country);
    if (city)
        signals = signals.filter((s) => s.city === city);
    signals = signals.slice().sort((a, b) => {
        if (b.support_count !== a.support_count)
            return b.support_count - a.support_count;
        return b.created_at.localeCompare(a.created_at);
    });
    const total = signals.length;
    return res.json({ signals: signals.slice(offsetN, offsetN + limitN), total });
});
// ─── GET /api/mapreality/signals/nearby ───────────────────────────────────────
// Query: lat, lng (required), radius (km, default 50, max 500), limit (max 50, default 20)
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
exports.mapRealityRouter.get("/signals/nearby", async (req, res) => {
    const { lat: latQ, lng: lngQ, radius: radiusQ, limit: limitQ } = req.query;
    const lat = parseNumber(latQ);
    const lng = parseNumber(lngQ);
    if (lat === null || lng === null) {
        return res.status(400).json({ error: "lat and lng are required numeric query params" });
    }
    if (lat < -90 || lat > 90)
        return res.status(400).json({ error: "lat must be in [-90, 90]" });
    if (lng < -180 || lng > 180)
        return res.status(400).json({ error: "lng must be in [-180, 180]" });
    const radius = Math.min(Math.max(parseNumber(radiusQ) ?? 50, 0), 500);
    const limit = Math.min(Math.max(Math.floor(parseNumber(limitQ) ?? 20), 1), 50);
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const _qResult = await pool.query(`SELECT *,
           (6371 * acos(
             cos(radians($1)) * cos(radians(lat)) *
             cos(radians(lng) - radians($2)) +
             sin(radians($1)) * sin(radians(lat))
           )) AS distance_km
         FROM mapreality_signals
         WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = 'active'
           AND (6371 * acos(
             cos(radians($1)) * cos(radians(lat)) *
             cos(radians(lng) - radians($2)) +
             sin(radians($1)) * sin(radians(lat))
           )) < $3
         ORDER BY distance_km ASC
         LIMIT $4`, [lat, lng, radius, limit]);
            const rows = _qResult.rows;
            return res.json({
                success: true,
                data: { signals: rows, center: { lat, lng }, radius, count: rows.length },
            });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] GET /signals/nearby DB error", e);
    }
    // In-memory fallback: Haversine filter
    const nearby = memSignals
        .filter((s) => s.status === "active" && s.lat !== null && s.lng !== null)
        .map((s) => ({ ...s, distance_km: haversineKm(lat, lng, s.lat, s.lng) }))
        .filter((s) => s.distance_km < radius)
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(0, limit);
    return res.json({
        success: true,
        data: { signals: nearby, center: { lat, lng }, radius, count: nearby.length },
    });
});
// ─── GET /api/mapreality/signals/:id ──────────────────────────────────────────
exports.mapRealityRouter.get("/signals/:id", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(param(req, "id"));
    if (id === null)
        return res.status(400).json({ error: "invalid id" });
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const { rows } = await pool.query(`SELECT * FROM mapreality_signals WHERE id = $1`, [id]);
            if (!rows[0])
                return res.status(404).json({ error: "not_found" });
            return res.json({ signal: rows[0] });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] GET /signals/:id DB error", e);
        // Сюда попадаем ТОЛЬКО когда база объявлена готовой и всё равно упала.
        // Раньше управление уходило ниже, в память (в проде она пуста), и человек
        // получал 404 на существующий сигнал. 404 — законный ответ, он не тревожит
        // никого: отказ хранилища выглядел как «такой записи нет».
        return res.status(503).json({ error: "storage_unavailable", warning: WARN });
    }
    const signal = memSignals.find((s) => s.id === id);
    if (!signal)
        return res.status(404).json({ error: "not_found" });
    return res.json({ signal });
});
// ─── POST /api/mapreality/signals/:id/support ─────────────────────────────────
exports.mapRealityRouter.post("/signals/:id/support", supportLimiter, async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(param(req, "id"));
    if (id === null)
        return res.status(400).json({ error: "invalid id" });
    const supporterAlias = clampString(req.body?.supporterAlias, MAX_ALIAS);
    if (!supporterAlias)
        return res.status(400).json({ error: "supporterAlias required" });
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const { rows: existing } = await pool.query(`SELECT id FROM mapreality_signals WHERE id = $1`, [id]);
            if (!existing[0])
                return res.status(404).json({ error: "not_found" });
            const insert = await pool.query(`INSERT INTO mapreality_supports (signal_id, supporter_alias)
         VALUES ($1, $2)
         ON CONFLICT (signal_id, supporter_alias) DO NOTHING
         RETURNING id`, [id, supporterAlias]);
            if ((insert.rowCount ?? 0) === 0) {
                const { rows: cur } = await pool.query(`SELECT support_count FROM mapreality_signals WHERE id = $1`, [id]);
                return res.status(409).json({
                    error: "already_supported",
                    supportCount: cur[0]?.support_count ?? 0,
                });
            }
            const { rows: updated } = await pool.query(`UPDATE mapreality_signals
         SET support_count = support_count + 1
         WHERE id = $1
         RETURNING support_count`, [id]);
            return res.json({ supportCount: updated[0]?.support_count ?? 0, storage: "db" });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] POST /signals/:id/support DB error", e);
        // Ниже сигнал ищется в памяти (в проде пустой), и его отсутствие уходило
        // как «not_found» про существующий сигнал. Отметка storage: "memory" в
        // соседней ветке правду про ХРАНИЛИЩЕ говорила, но не про сам факт отказа.
        return res.status(503).json({ error: "storage_unavailable", warning: WARN });
    }
    const signal = memSignals.find((s) => s.id === id);
    if (!signal)
        return res.status(404).json({ error: "not_found" });
    const dup = memSupports.find((sp) => sp.signal_id === id && sp.supporter_alias === supporterAlias);
    if (dup)
        return res.status(409).json({ error: "already_supported", supportCount: signal.support_count });
    memSupports.push({ signal_id: id, supporter_alias: supporterAlias, created_at: nowIso() });
    signal.support_count += 1;
    return res.json({ supportCount: signal.support_count, storage: "memory" });
});
// ─── PATCH /api/mapreality/signals/:id/status ─────────────────────────────────
// Body: { authorAlias, status }. For MVP, only the author can set status to 'resolved'.
exports.mapRealityRouter.patch("/signals/:id/status", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(param(req, "id"));
    if (id === null)
        return res.status(400).json({ error: "invalid id" });
    const body = req.body;
    const authorAlias = clampString(body.authorAlias, MAX_ALIAS);
    const desiredStatus = typeof body.status === "string" ? body.status.trim() : "resolved";
    if (!authorAlias)
        return res.status(400).json({ error: "authorAlias required" });
    if (desiredStatus !== "resolved") {
        return res.status(400).json({ error: "MVP only supports status='resolved'" });
    }
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const { rows } = await pool.query(`SELECT id, author_alias FROM mapreality_signals WHERE id = $1`, [id]);
            if (!rows[0])
                return res.status(404).json({ error: "not_found" });
            if (rows[0].author_alias !== authorAlias) {
                return res.status(403).json({ error: "forbidden" });
            }
            const { rows: updated } = await pool.query(`UPDATE mapreality_signals SET status = 'resolved' WHERE id = $1 RETURNING *`, [id]);
            return res.json({ signal: updated[0] });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] PATCH /signals/:id/status DB error", e);
        return res.status(503).json({ error: "storage_unavailable", warning: WARN });
    }
    const signal = memSignals.find((s) => s.id === id);
    if (!signal)
        return res.status(404).json({ error: "not_found" });
    if (signal.author_alias !== authorAlias)
        return res.status(403).json({ error: "forbidden" });
    signal.status = "resolved";
    return res.json({ signal });
});
// ─── GET /api/mapreality/stats ────────────────────────────────────────────────
exports.mapRealityRouter.get("/stats", async (_req, res) => {
    try {
        if ((0, ensureMapRealityTables_1.isMapRealityDbReady)()) {
            const [totalQ, catQ, countryQ, topQ] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS total FROM mapreality_signals WHERE status = 'active'`),
                pool.query(`SELECT category, COUNT(*)::int AS count
           FROM mapreality_signals WHERE status = 'active'
           GROUP BY category`),
                pool.query(`SELECT country, COUNT(*)::int AS count
           FROM mapreality_signals WHERE status = 'active'
           GROUP BY country
           ORDER BY count DESC
           LIMIT 10`),
                pool.query(`SELECT * FROM mapreality_signals
           WHERE status = 'active'
           ORDER BY support_count DESC, created_at DESC
           LIMIT 5`),
            ]);
            const byCategory = { need: 0, event: 0, request: 0 };
            for (const row of catQ.rows) {
                byCategory[row.category] = row.count;
            }
            return res.json({
                total: totalQ.rows[0]?.total ?? 0,
                byCategory,
                byCountry: countryQ.rows,
                topSignals: topQ.rows,
                backend: "postgres",
            });
        }
    }
    catch (e) {
        capture(e);
        console.error("[MapReality] GET /stats DB error", e);
    }
    const active = memSignals.filter((s) => s.status === "active");
    const byCategory = { need: 0, event: 0, request: 0 };
    const countryCount = new Map();
    for (const s of active) {
        byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
        countryCount.set(s.country, (countryCount.get(s.country) ?? 0) + 1);
    }
    const byCountry = Array.from(countryCount.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const topSignals = active
        .slice()
        .sort((a, b) => {
        if (b.support_count !== a.support_count)
            return b.support_count - a.support_count;
        return b.created_at.localeCompare(a.created_at);
    })
        .slice(0, 5);
    return res.json({
        total: active.length,
        byCategory,
        byCountry,
        topSignals,
        backend: "memory",
    });
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.mapRealityRouter.get("/status", (_req, res) => {
    res.json({
        module: "mapreality",
        code: "MAPREALITY",
        status: "mvp",
        description: "AR-cartography: places overlaid with verified meta-signals (events, alerts, marks).",
        endpoints: {
            health: "/api/mapreality/health",
            signals: "/api/mapreality/signals",
            stats: "/api/mapreality/stats",
            conceptMessages: "/api/mapreality/concept/messages",
            conceptStats: "/api/mapreality/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({ router: exports.mapRealityRouter, moduleId: "mapreality", defaultTag: "mapreality", writeLimit: submitLimiter });
