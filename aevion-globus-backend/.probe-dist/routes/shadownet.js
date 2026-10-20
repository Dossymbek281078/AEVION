"use strict";
/**
 * ShadowNet — concept simulator for an alternative private internet.
 *
 * This is an educational simulator, NOT a real VPN. It exposes:
 *   - threat-model catalogue (4 models with descriptions + recommendations)
 *   - routing simulator (3-7 hops, pseudo-random per-hop latencies)
 *   - privacy-score calculator (weighted feature scoring)
 *   - encrypted post storage (E2E — server only stores ciphertext blobs;
 *     plaintext / passwords are NEVER sent)
 *
 * Persists to Postgres if available, falls back to in-memory store.
 * Rate-limited 60/min/IP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.shadownetRouter = void 0;
const express_1 = require("express");
const platform_1 = require("../lib/sentry/platform");
const dbPool_1 = require("../lib/dbPool");
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const ensureShadowNetTables_1 = require("../lib/ensureShadowNetTables");
const rateLimit_1 = require("../lib/rateLimit");
const queryNumber_1 = require("../lib/queryNumber");
const captureShadowNetError = (0, platform_1.makeServiceCapture)("shadownet");
exports.shadownetRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
(async () => {
    try {
        await (0, ensureShadowNetTables_1.ensureShadowNetTables)(pool);
    }
    catch {
        // silent — in-memory fallback active
    }
})();
exports.shadownetRouter.use((0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 60,
    keyPrefix: "shadownet",
    message: "rate_limit_exceeded: max 60 requests per minute per IP",
}));
// ── In-memory fallback ──────────────────────────────────────────────────────
let memSeq = 1;
const memPosts = new Map();
const threatModelHits = new Map();
// ── Static data: threat models ──────────────────────────────────────────────
const THREAT_MODELS = [
    {
        id: "tracking",
        label: "Ad-tracking & analytics",
        threatLevel: "low",
        description: "Защита от рекламных трекеров, аналитики сайтов, fingerprint-сервисов.",
        protectsFrom: [
            "Google Analytics / Meta Pixel",
            "Cross-site cookies",
            "Browser fingerprinting",
            "Behavioral profiling",
        ],
        recommendations: [
            "uBlock Origin + Privacy Badger",
            "Firefox with strict tracking protection",
            "Disable third-party cookies",
            "Use containers / multi-account isolation",
        ],
    },
    {
        id: "isp",
        label: "ISP & local network",
        threatLevel: "medium",
        description: "Защита от наблюдения провайдером, корпоративной сетью, публичным Wi-Fi.",
        protectsFrom: [
            "DNS query logging",
            "HTTPS SNI sniffing",
            "Deep packet inspection (basic)",
            "Wi-Fi MITM attacks",
        ],
        recommendations: [
            "Reputable no-log VPN (Mullvad, IVPN)",
            "DNS over HTTPS (Cloudflare 1.1.1.1, Quad9)",
            "Encrypted SNI / ECH where available",
            "Avoid corporate / public Wi-Fi without VPN",
        ],
    },
    {
        id: "state",
        label: "State-level censorship",
        threatLevel: "high",
        description: "Защита от государственной цензуры, DPI-блокировок, региональных файрволлов.",
        protectsFrom: [
            "DNS blocking",
            "IP blocklists",
            "DPI-based protocol fingerprinting",
            "Forced traffic interception",
        ],
        recommendations: [
            "Tor + obfs4 / meek bridges",
            "Shadowsocks / V2Ray with TLS camouflage",
            "Snowflake (P2P Tor bridges)",
            "Offline mesh fallback (LoRa, Briar)",
        ],
    },
    {
        id: "government",
        label: "Targeted government attacks",
        threatLevel: "extreme",
        description: "Защита от целевого преследования госорганами: ордера, mass-surveillance, traffic correlation.",
        protectsFrom: [
            "Mass-surveillance dragnets",
            "Subpoenas to providers (with no-log + foreign jurisdiction)",
            "Endpoint compromise (partial — needs OS hardening)",
            "Long-term traffic correlation",
        ],
        recommendations: [
            "Tails OS / Whonix (compartmentalised endpoint)",
            "Tor + multi-hop bridges",
            "Hardware security keys (YubiKey)",
            "Compartmentalised identities, no PII reuse",
            "Threat-model OPSEC training — assume endpoint can be compromised",
        ],
    },
];
// ── Helpers ─────────────────────────────────────────────────────────────────
function ok(res, data, status = 200) {
    res.status(status).json({ success: true, data });
}
function fail(res, message, status = 400) {
    res.status(status).json({ success: false, error: message });
}
const MAX_CIPHERTEXT_BYTES = 1024 * 256; // 256KB ciphertext payload cap
function isNonEmptyString(v, maxLen = 1024 * 256) {
    return typeof v === "string" && v.length > 0 && v.length <= maxLen;
}
function isValidAlias(v) {
    return (typeof v === "string" &&
        v.length >= 2 &&
        v.length <= 64 &&
        /^[a-zA-Z0-9_-]+$/.test(v));
}
// Mulberry32 — deterministic-ish pseudo-random for routing simulator.
function seededRand(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const HOP_COUNTRIES = [
    "Iceland",
    "Switzerland",
    "Sweden",
    "Netherlands",
    "Romania",
    "Panama",
    "Canada",
    "Estonia",
    "Norway",
    "Japan",
    "Singapore",
    "Finland",
];
function simulateRoute(hops, seed = Date.now()) {
    const rng = seededRand(seed);
    const usedCountries = [];
    const nodes = [];
    for (let i = 0; i < hops; i++) {
        let country;
        let attempts = 0;
        do {
            country = HOP_COUNTRIES[Math.floor(rng() * HOP_COUNTRIES.length)];
            attempts++;
        } while (usedCountries.includes(country) && attempts < 10);
        usedCountries.push(country);
        // Per-hop latency: 30-180ms.
        const latency = Math.round(30 + rng() * 150);
        nodes.push({ country, latencyMs: latency });
    }
    const totalLatencyMs = nodes.reduce((s, n) => s + n.latencyMs, 0);
    // Anonymity grows logarithmically with hops, capped at 100.
    const anonymityScore = Math.min(100, Math.round(35 + Math.log2(hops) * 25));
    return { nodes, totalLatencyMs, anonymityScore };
}
const FEATURE_WEIGHTS = {
    tor: 30,
    vpn: 15,
    dns: 10,
    browser: 20,
    e2e: 25,
};
const FEATURE_LABELS = {
    tor: "Tor routing",
    vpn: "Reputable no-log VPN",
    dns: "Encrypted DNS",
    browser: "Hardened browser",
    e2e: "End-to-end encryption",
};
const FEATURE_ADVICE = {
    tor: "Включи Tor / VeilNetX — без него все остальные слои дают слабую анонимность.",
    vpn: "Подключи проверенный no-log VPN — Mullvad, IVPN. Не используй бесплатные.",
    dns: "Переключи DNS на DoH/DoT — иначе провайдер видит все домены.",
    browser: "Используй закалённый браузер — Tor Browser, Firefox со strict tracking.",
    e2e: "Включи E2E для всех каналов — без него сервер видит plaintext.",
};
function computePrivacyScore(features) {
    let score = 0;
    const active = [];
    const inactive = [];
    for (const key of Object.keys(FEATURE_WEIGHTS)) {
        if (features[key]) {
            score += FEATURE_WEIGHTS[key];
            active.push(FEATURE_LABELS[key]);
        }
        else {
            inactive.push(key);
        }
    }
    // Pick the highest-weight missing feature as the weakest link.
    let weakest = null;
    let weakestWeight = -1;
    for (const key of inactive) {
        if (FEATURE_WEIGHTS[key] > weakestWeight) {
            weakest = key;
            weakestWeight = FEATURE_WEIGHTS[key];
        }
    }
    const advice = weakest
        ? FEATURE_ADVICE[weakest]
        : "Все ключевые слои активны. Дальше — OPSEC, threat-model training, hardware keys.";
    return {
        score,
        active,
        inactive: inactive.map((k) => FEATURE_LABELS[k]),
        weakest,
        advice,
    };
}
// ── Endpoints ───────────────────────────────────────────────────────────────
exports.shadownetRouter.get("/health", (_req, res) => {
    ok(res, {
        module: "shadownet",
        db: (0, ensureShadowNetTables_1.isShadowNetDbReady)() ? "postgres" : "in-memory",
        timestamp: new Date().toISOString(),
    });
});
exports.shadownetRouter.get("/threat-models", (req, res) => {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (id) {
        const m = THREAT_MODELS.find((t) => t.id === id);
        if (!m)
            return fail(res, "threat-model not found", 404);
        threatModelHits.set(id, (threatModelHits.get(id) ?? 0) + 1);
        return ok(res, m);
    }
    ok(res, THREAT_MODELS);
});
exports.shadownetRouter.post("/route", (req, res) => {
    const hopsRaw = (req.body || {}).hops;
    const hops = Number(hopsRaw);
    if (!Number.isFinite(hops) || hops < 3 || hops > 7) {
        return fail(res, "hops must be an integer between 3 and 7");
    }
    const seed = Number((req.body || {}).seed) || Date.now();
    const route = simulateRoute(Math.floor(hops), seed);
    ok(res, { ...route, seed });
});
exports.shadownetRouter.post("/score", (req, res) => {
    const features = (req.body || {}).features;
    if (!features || typeof features !== "object") {
        return fail(res, "features object required");
    }
    const normalized = {};
    for (const key of Object.keys(FEATURE_WEIGHTS)) {
        normalized[key] = Boolean(features[key]);
    }
    const result = computePrivacyScore(normalized);
    ok(res, result);
});
exports.shadownetRouter.post("/posts", async (req, res) => {
    const body = req.body || {};
    const { alias, ciphertext, iv, salt } = body;
    if (!isValidAlias(alias)) {
        return fail(res, "alias must be 2-64 chars [A-Za-z0-9_-]");
    }
    if (!isNonEmptyString(ciphertext)) {
        return fail(res, "ciphertext required (string, ≤256KB)");
    }
    if (!isNonEmptyString(iv, 256)) {
        return fail(res, "iv required (string, ≤256 chars)");
    }
    if (!isNonEmptyString(salt, 256)) {
        return fail(res, "salt required (string, ≤256 chars)");
    }
    // Payload size guard: cap on actual byte length (UTF-8 can be multi-byte,
    // so a char-count check alone underestimates the stored/transmitted size).
    const sizeBytes = Buffer.byteLength(ciphertext, "utf8");
    if (sizeBytes > MAX_CIPHERTEXT_BYTES) {
        return fail(res, "ciphertext too large (≤256KB)", 413);
    }
    if ((0, ensureShadowNetTables_1.isShadowNetDbReady)()) {
        try {
            const result = await pool.query(`INSERT INTO shadownet_posts (alias, ciphertext, iv, salt, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, alias, size_bytes, created_at`, [alias, ciphertext, iv, salt, sizeBytes]);
            return ok(res, result.rows[0], 201);
        }
        catch (e) {
            console.error("[ShadowNet] POST /posts db error:", e);
            // fall through to memory
        }
    }
    const id = memSeq++;
    const post = {
        id,
        alias,
        ciphertext,
        iv,
        salt,
        size_bytes: sizeBytes,
        created_at: new Date().toISOString(),
    };
    memPosts.set(id, post);
    return ok(res, { id, alias, size_bytes: sizeBytes, created_at: post.created_at }, 201);
});
// Recent posts across all aliases — metadata + ciphertext only (the payload
// is E2E-encrypted; without the passphrase the ciphertext reveals nothing).
// Gives the module a real list surface now that the generic mvpConcepts
// scaffold no longer shadows this prefix (single-store consolidation).
exports.shadownetRouter.get("/posts", async (req, res) => {
    const limit = Math.min(Math.max((0, queryNumber_1.queryNumber)(req.query.limit, 50), 1), 200);
    if ((0, ensureShadowNetTables_1.isShadowNetDbReady)()) {
        try {
            const result = await pool.query(`SELECT id, alias, ciphertext, iv, salt, size_bytes, created_at
         FROM shadownet_posts
         ORDER BY created_at DESC
         LIMIT $1`, [limit]);
            return ok(res, { items: result.rows, total: result.rows.length });
        }
        catch (e) {
            console.error("[ShadowNet] GET /posts db error:", e);
            // fall through to memory
        }
    }
    const rows = Array.from(memPosts.values())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    ok(res, { items: rows, total: rows.length });
});
exports.shadownetRouter.get("/posts/:alias", async (req, res) => {
    const alias = String(req.params.alias);
    // POST /posts answers with a numeric `id` (SERIAL / memory counter), and a
    // numeric string is also a valid alias — so fetch-by-id used to "succeed"
    // with an empty alias match. Treat an all-digit param as an id lookup.
    if (/^\d+$/.test(alias)) {
        if ((0, ensureShadowNetTables_1.isShadowNetDbReady)()) {
            try {
                const result = await pool.query(`SELECT id, alias, ciphertext, iv, salt, size_bytes, created_at
           FROM shadownet_posts WHERE id = $1`, [Number(alias)]);
                if (result.rows.length > 0)
                    return ok(res, result.rows[0]);
            }
            catch (e) {
                console.error("[ShadowNet] GET /posts/:id db error:", e);
                // Раньше управление уходило ниже, в память (в проде пустую), и запись
                // объявлялась несуществующей. «Не найдено» на отказ базы законно и
                // потому незаметно: ни тревоги, ни подозрения у читателя.
                // Не через fail(): у него в ответе только код, а человеку нужна
                // фраза — «нет записи» и «не смогли спросить» это разные новости.
                res.status(503).json({
                    success: false,
                    error: "storage_unavailable",
                    warning: "Хранилище временно недоступно. Это НЕ значит, что записи нет — повторите запрос позже.",
                });
                return;
            }
        }
        const byId = memPosts.get(Number(alias));
        if (byId)
            return ok(res, byId);
        return fail(res, "not found", 404);
    }
    if (!isValidAlias(alias)) {
        return fail(res, "invalid alias");
    }
    const limit = Math.min(Math.max((0, queryNumber_1.queryNumber)(req.query.limit, 50), 1), 200);
    if ((0, ensureShadowNetTables_1.isShadowNetDbReady)()) {
        try {
            const result = await pool.query(`SELECT id, alias, ciphertext, iv, salt, size_bytes, created_at
         FROM shadownet_posts
         WHERE alias = $1
         ORDER BY created_at DESC
         LIMIT $2`, [alias, limit]);
            return ok(res, result.rows);
        }
        catch (e) {
            console.error("[ShadowNet] GET /posts/:alias db error:", e);
            // fall through to memory
        }
    }
    const rows = Array.from(memPosts.values())
        .filter((p) => p.alias === alias)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    ok(res, rows);
});
exports.shadownetRouter.delete("/posts/:id", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(req.params.id);
    if (id === null) {
        return fail(res, "invalid id");
    }
    const alias = (req.body || {}).alias;
    if (!isValidAlias(alias)) {
        return fail(res, "alias required in body");
    }
    if ((0, ensureShadowNetTables_1.isShadowNetDbReady)()) {
        try {
            const result = await pool.query(`DELETE FROM shadownet_posts WHERE id = $1 AND alias = $2 RETURNING id`, [id, alias]);
            if (result.rowCount === 0) {
                return fail(res, "not found or alias mismatch", 404);
            }
            return ok(res, { id, deleted: true });
        }
        catch (e) {
            console.error("[ShadowNet] DELETE /posts/:id db error:", e);
            // fall through to memory
        }
    }
    const post = memPosts.get(id);
    if (!post || post.alias !== alias) {
        return fail(res, "not found or alias mismatch", 404);
    }
    memPosts.delete(id);
    ok(res, { id, deleted: true });
});
exports.shadownetRouter.get("/stats", async (_req, res) => {
    let totalPosts = 0;
    let totalSizeBytes = 0;
    let uniqueAliases = 0;
    if ((0, ensureShadowNetTables_1.isShadowNetDbReady)()) {
        try {
            const r = await pool.query(`SELECT COUNT(*)::int AS total_posts,
                COALESCE(SUM(size_bytes), 0)::int AS total_size,
                COUNT(DISTINCT alias)::int AS unique_aliases
         FROM shadownet_posts`);
            totalPosts = r.rows[0]?.total_posts ?? 0;
            totalSizeBytes = r.rows[0]?.total_size ?? 0;
            uniqueAliases = r.rows[0]?.unique_aliases ?? 0;
        }
        catch (e) {
            console.error("[ShadowNet] GET /stats db error:", e);
        }
    }
    else {
        totalPosts = memPosts.size;
        const aliases = new Set();
        for (const p of memPosts.values()) {
            totalSizeBytes += p.size_bytes;
            aliases.add(p.alias);
        }
        uniqueAliases = aliases.size;
    }
    // Determine the top threat model by view counts.
    let topThreatModel = null;
    let topHits = -1;
    for (const [id, hits] of threatModelHits) {
        if (hits > topHits) {
            topHits = hits;
            topThreatModel = id;
        }
    }
    ok(res, {
        totalPosts,
        totalSizeBytes,
        uniqueAliases,
        threatModelsCount: THREAT_MODELS.length,
        topThreatModel,
        db: (0, ensureShadowNetTables_1.isShadowNetDbReady)() ? "postgres" : "in-memory",
    });
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.shadownetRouter.get("/status", (_req, res) => {
    res.json({
        module: "shadownet",
        code: "SHADOWNET",
        status: "mvp",
        description: "Alternative private network — threat models, waitlist, principles + concept board.",
        endpoints: {
            threatModels: "/api/shadownet/threat-models",
            waitlist: "/api/shadownet/waitlist",
            stats: "/api/shadownet/stats",
            conceptMessages: "/api/shadownet/concept/messages",
            conceptStats: "/api/shadownet/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({ router: exports.shadownetRouter, moduleId: "shadownet", defaultTag: "shadownet" });
