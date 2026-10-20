"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
/**
 * AEVION Universal Search — /api/search?q=<query>
 *
 * Queries QStore, QLearn, QNews, QEvents, QJobs, QRight in parallel
 * and returns unified results ranked by relevance score.
 *
 * GET /api/search?q=ai&limit=20&types=qstore,qlearn,qnews
 */
const express_1 = require("express");
const queryNumber_1 = require("../lib/queryNumber");
const dbPool_1 = require("../lib/dbPool");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const platform_1 = require("../lib/sentry/platform");
const capture = (0, platform_1.makeServiceCapture)("search");
exports.searchRouter = (0, express_1.Router)();
const searchLimit = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false });
function scoreText(query, title, description) {
    const q = query.toLowerCase();
    const t = title.toLowerCase();
    const d = description.toLowerCase();
    let s = 0;
    if (t === q)
        s += 100;
    else if (t.startsWith(q))
        s += 60;
    else if (t.includes(q))
        s += 40;
    if (d.includes(q))
        s += 10;
    return s;
}
async function searchQStore(pool, q, limit) {
    try {
        const r = await pool.query(`SELECT DISTINCT ON (LOWER(title)) id, title, description, category, price, currency, "salesCount", tags
       FROM "QStoreProduct"
       WHERE "isPublic" = TRUE AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1
         OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE LOWER(t) LIKE $1)
       ) ORDER BY LOWER(title), "salesCount" DESC LIMIT $2`, [`%${q.toLowerCase()}%`, limit]);
        return r.rows.map((row) => ({
            id: row.id,
            type: "qstore",
            title: row.title,
            description: (row.description || "").slice(0, 200),
            url: `/qstore/${row.id}`,
            metadata: { price: row.price, currency: row.currency, category: row.category, salesCount: row.salesCount },
            score: scoreText(q, row.title, row.description || ""),
        }));
    }
    catch {
        return [];
    }
}
async function searchQLearn(pool, q, limit) {
    try {
        const r = await pool.query(`SELECT id, title, description, category, level, "enrollmentCount"
       FROM "QLearnCourse"
       WHERE "isPublic" = TRUE AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1
       ) ORDER BY "enrollmentCount" DESC LIMIT $2`, [`%${q.toLowerCase()}%`, limit]);
        return r.rows.map((row) => ({
            id: row.id,
            type: "qlearn",
            title: row.title,
            description: (row.description || "").slice(0, 200),
            url: `/qlearn/courses/${row.id}`,
            metadata: { category: row.category, level: row.level, enrollmentCount: row.enrollmentCount },
            score: scoreText(q, row.title, row.description || "") + 5,
        }));
    }
    catch {
        return [];
    }
}
async function searchQNews(pool, q, limit) {
    try {
        const r = await pool.query(`SELECT id, title, summary, url, source, category
       FROM "QNewsArticle"
       WHERE LOWER(title) LIKE $1 OR LOWER(summary) LIKE $1 OR LOWER(category) LIKE $1
       ORDER BY "createdAt" DESC LIMIT $2`, [`%${q.toLowerCase()}%`, limit]);
        return r.rows.map((row) => ({
            id: row.id,
            type: "qnews",
            title: row.title,
            description: (row.summary || "").slice(0, 200),
            url: row.url || `/qnews/${row.id}`,
            metadata: { source: row.source, category: row.category },
            score: scoreText(q, row.title, row.summary || ""),
        }));
    }
    catch {
        return [];
    }
}
async function searchQEvents(pool, q, limit) {
    try {
        const r = await pool.query(`SELECT DISTINCT ON (LOWER(title)) id, title, description, category, location, "startAt", "attendeeCount"
       FROM "QEvent"
       WHERE "isPublic" = TRUE AND "startAt" > NOW() AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1 OR LOWER(location) LIKE $1
       ) ORDER BY LOWER(title), "startAt" ASC LIMIT $2`, [`%${q.toLowerCase()}%`, limit]);
        return r.rows.map((row) => ({
            id: row.id,
            type: "qevents",
            title: row.title,
            description: (row.description || "").slice(0, 200),
            url: `/qevents/${row.id}`,
            metadata: { category: row.category, location: row.location, startAt: row.startAt, attendeeCount: row.attendeeCount },
            score: scoreText(q, row.title, row.description || "") + 3,
        }));
    }
    catch {
        return [];
    }
}
async function searchQJobs(pool, q, limit) {
    try {
        const r = await pool.query(
        // Таблица называется "QJobsPosting", а не `qjobs`; колонки — "type",
        // "company" и "isActive", а не "jobType"/"companyName"/status='open'.
        // Ни одно из шести имён не существовало: глобальный поиск НИКОГДА не
        // находил вакансий, и молчал об этом (запрос в мягком catch).
        // Найдено 19.08.2026 сверкой запрашиваемых таблиц против CREATE TABLE.
        `SELECT id, title, description, "type" AS "jobType", location, salary,
              "company" AS "companyName"
       FROM "QJobsPosting"
       WHERE "isActive" = TRUE AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1
         OR LOWER("company") LIKE $1 OR LOWER(location) LIKE $1
       ) ORDER BY "createdAt" DESC LIMIT $2`, [`%${q.toLowerCase()}%`, limit]);
        return r.rows.map((row) => ({
            id: row.id,
            type: "qjobs",
            title: row.title,
            description: (row.description || "").slice(0, 200),
            url: `/qjobs/${row.id}`,
            metadata: { jobType: row.jobType, location: row.location, salary: row.salary, company: row.companyName },
            score: scoreText(q, row.title, row.description || ""),
        }));
    }
    catch {
        return [];
    }
}
async function searchQRight(pool, q, limit) {
    try {
        const r = await pool.query(`SELECT id, title, description, kind, "ownerName", "createdAt"
       FROM "QRightObject"
       WHERE "revokedAt" IS NULL AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(kind) LIKE $1
       ) ORDER BY "createdAt" DESC LIMIT $2`, [`%${q.toLowerCase()}%`, limit]);
        return r.rows.map((row) => ({
            id: row.id,
            type: "qright",
            title: row.title,
            description: (row.description || "").slice(0, 200),
            url: `/qright/${row.id}`,
            metadata: { kind: row.kind, ownerName: row.ownerName },
            score: scoreText(q, row.title, row.description || "") - 5,
        }));
    }
    catch {
        return [];
    }
}
// GET /api/search?q=...&limit=20&types=qstore,qlearn,qnews,qevents,qjobs,qright
exports.searchRouter.get("/", searchLimit, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q || q.length < 2) {
        return res.status(400).json({ error: "q required (min 2 chars)" });
    }
    if (q.length > 100) {
        return res.status(400).json({ error: "q too long (max 100 chars)" });
    }
    const limit = Math.min(10, Math.max(1, (0, queryNumber_1.queryNumber)(req.query.limit, 5)));
    const typesParam = String(req.query.types ?? "qstore,qlearn,qnews,qevents,qjobs,qright");
    const types = new Set(typesParam.split(",").map(t => t.trim()));
    let pool;
    try {
        pool = (0, dbPool_1.getPool)();
    }
    catch (err) {
        capture(err);
        return res.status(503).json({ error: "db_unavailable" });
    }
    const searches = [];
    if (types.has("qstore"))
        searches.push(searchQStore(pool, q, limit));
    if (types.has("qlearn"))
        searches.push(searchQLearn(pool, q, limit));
    if (types.has("qnews"))
        searches.push(searchQNews(pool, q, limit));
    if (types.has("qevents"))
        searches.push(searchQEvents(pool, q, limit));
    if (types.has("qjobs"))
        searches.push(searchQJobs(pool, q, limit));
    if (types.has("qright"))
        searches.push(searchQRight(pool, q, limit));
    const results = await Promise.all(searches);
    // Deduplicate by (type, id) — same item can't appear twice
    const seen = new Set();
    const all = results.flat()
        .filter(r => { const k = `${r.type}:${r.id}`; if (seen.has(k))
        return false; seen.add(k); return true; })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 3);
    const byType = {};
    for (const r of all) {
        byType[r.type] = byType[r.type] ?? [];
        byType[r.type].push(r);
    }
    res.json({
        q,
        total: all.length,
        results: all,
        byType,
    });
});
// GET /api/search/health
exports.searchRouter.get("/health", (_req, res) => {
    res.json({ ok: true, service: "aevion-search", sources: ["qstore", "qlearn", "qnews", "qevents", "qjobs", "qright"] });
});
