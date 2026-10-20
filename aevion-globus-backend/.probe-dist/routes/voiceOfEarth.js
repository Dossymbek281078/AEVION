"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceOfEarthRouter = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = require("express");
const platform_1 = require("../lib/sentry/platform");
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const rateLimit_1 = require("../lib/rateLimit");
const dbPool_1 = require("../lib/dbPool");
const captureVoEError = (0, platform_1.makeServiceCapture)("voice-of-earth");
const ensureVoiceOfEarthTables_1 = require("../lib/ensureVoiceOfEarthTables");
const voiceOfEarthSeed_1 = require("../data/voiceOfEarthSeed");
/** Пометка example для витрины — «Пример · без записи». */
const сПометкой = (t) => ({ ...t, example: (0, voiceOfEarthSeed_1.трекПример)(t) });
/** SQL: трек не пример. Ключи — константы из data/voiceOfEarthSeed, параметром $N. */
const НЕ_ПРИМЕР_SQL = (n) => `(title || chr(1) || artist_alias) <> ALL($${n}::text[])`;
const КЛЮЧИ = [...voiceOfEarthSeed_1.КЛЮЧИ_ПРИМЕРОВ];
const queryNumber_1 = require("../lib/queryNumber");
const WARN = "Хранилище временно недоступно. Это НЕ значит, что записи нет — повторите запрос позже.";
const pool = (0, dbPool_1.getPool)();
(async () => {
    try {
        await (0, ensureVoiceOfEarthTables_1.ensureVoiceOfEarthTables)(pool);
    }
    catch {
        /* silent — in-memory fallback active */
    }
})();
exports.voiceOfEarthRouter = (0, express_1.Router)();
const MOODS = [
    "hopeful",
    "peaceful",
    "joyful",
    "reflective",
    "uplifting",
];
// ─── In-memory store ──────────────────────────────────────────────────────────
const memTracks = [];
const memVotes = new Set(); // `${trackId}:${voterAlias}`
let memNextId = 1;
function seedMemory() {
    if (memTracks.length > 0)
        return;
    for (const t of voiceOfEarthSeed_1.VOICE_OF_EARTH_SEED) {
        memTracks.push({
            id: memNextId++,
            title: t.title,
            artist_alias: t.artistAlias,
            language: t.language,
            lyrics: t.lyrics,
            mood: t.mood,
            audio_url: t.audioUrl,
            votes: 0,
            status: "published",
            created_at: new Date().toISOString(),
            content_hash: null,
        });
    }
}
seedMemory();
// ─── Rate limiters ────────────────────────────────────────────────────────────
const generalLimiter = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 60,
    keyPrefix: "voe:general",
    message: "rate_limited",
});
const submitLimiter = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 5,
    keyPrefix: "voe:submit",
    message: "rate_limited",
});
const voteLimiter = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 30,
    keyPrefix: "voe:vote",
    message: "rate_limited",
});
exports.voiceOfEarthRouter.use(generalLimiter);
// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidMood(m) {
    return typeof m === "string" && MOODS.includes(m);
}
function normaliseLang(s) {
    return s.toLowerCase().slice(0, 8);
}
function sanitizeAlias(s) {
    return s.trim().slice(0, 60);
}
// ─── GET /api/voice-of-earth/health ──────────────────────────────────────────
exports.voiceOfEarthRouter.get("/health", async (_req, res) => {
    const dbReady = (0, ensureVoiceOfEarthTables_1.isVoiceOfEarthDbReady)();
    let tracksCount = memTracks.length;
    if (dbReady) {
        try {
            const { rows } = await pool.query(`SELECT COUNT(*)::text AS c FROM voe_tracks WHERE status = 'published'`);
            tracksCount = Number(rows[0]?.c ?? "0");
        }
        catch {
            /* fall through with mem count */
        }
    }
    res.json({ ok: true, dbReady, tracksCount });
});
// ─── GET /api/voice-of-earth/tracks ──────────────────────────────────────────
exports.voiceOfEarthRouter.get("/tracks", async (req, res) => {
    const lang = typeof req.query.lang === "string" ? req.query.lang : null;
    const mood = typeof req.query.mood === "string" ? req.query.mood : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    if ((0, ensureVoiceOfEarthTables_1.isVoiceOfEarthDbReady)()) {
        try {
            const conditions = [`status = 'published'`];
            const args = [];
            let idx = 1;
            if (lang) {
                conditions.push(`language = $${idx++}`);
                args.push(normaliseLang(lang));
            }
            if (mood && isValidMood(mood)) {
                conditions.push(`mood = $${idx++}`);
                args.push(mood);
            }
            const where = `WHERE ${conditions.join(" AND ")}`;
            const { rows } = await pool.query(`SELECT * FROM voe_tracks ${where}
         ORDER BY votes DESC, created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`, [...args, limit, offset]);
            const { rows: cnt } = await pool.query(`SELECT COUNT(*)::text AS c FROM voe_tracks ${where}`, args);
            return res.json({
                items: rows.map(сПометкой),
                total: Number(cnt[0]?.c ?? "0"),
                backend: "postgres",
            });
        }
        catch (e) {
            console.error("[VoiceOfEarth] GET /tracks DB error", e);
        }
    }
    let items = memTracks.filter((t) => t.status === "published");
    if (lang)
        items = items.filter((t) => t.language === normaliseLang(lang));
    if (mood && isValidMood(mood))
        items = items.filter((t) => t.mood === mood);
    items = items.sort((a, b) => {
        if (b.votes !== a.votes)
            return b.votes - a.votes;
        return b.created_at.localeCompare(a.created_at);
    });
    const total = items.length;
    items = items.slice(offset, offset + limit);
    res.json({ items: items.map(сПометкой), total, backend: "memory" });
});
// ─── GET /api/voice-of-earth/tracks/:id ──────────────────────────────────────
exports.voiceOfEarthRouter.get("/tracks/:id", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(req.params.id);
    if (id === null) {
        return res.status(400).json({ error: "invalid id" });
    }
    if ((0, ensureVoiceOfEarthTables_1.isVoiceOfEarthDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT * FROM voe_tracks WHERE id = $1`, [id]);
            if (rows[0])
                return res.json({ track: сПометкой(rows[0]) });
            return res.status(404).json({ error: "not_found" });
        }
        catch (e) {
            console.error("[VoiceOfEarth] GET /tracks/:id DB error", e);
            // База объявлена готовой и упала — ниже лежит пустая в проде память,
            // и оттуда ушёл бы 404 на существующий трек.
            return res.status(503).json({ error: "storage_unavailable", warning: WARN });
        }
    }
    const track = memTracks.find((t) => t.id === id);
    if (!track)
        return res.status(404).json({ error: "not_found" });
    res.json({ track: сПометкой(track) });
});
// ─── POST /api/voice-of-earth/tracks ─────────────────────────────────────────
exports.voiceOfEarthRouter.post("/tracks", submitLimiter, async (req, res) => {
    const body = (req.body || {});
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const artistAlias = typeof body.artistAlias === "string"
        ? sanitizeAlias(body.artistAlias)
        : "";
    const language = typeof body.language === "string" ? normaliseLang(body.language) : "";
    const lyrics = typeof body.lyrics === "string" ? body.lyrics.trim() : "";
    const mood = body.mood;
    const audioUrl = typeof body.audioUrl === "string" && body.audioUrl.trim()
        ? body.audioUrl.trim().slice(0, 500)
        : null;
    if (!title || title.length > 200) {
        return res.status(400).json({ error: "title required (1..200 chars)" });
    }
    if (!artistAlias) {
        return res.status(400).json({ error: "artistAlias required" });
    }
    if (!language || language.length < 2) {
        return res.status(400).json({ error: "language required" });
    }
    if (!lyrics || lyrics.length > 10000) {
        return res.status(400).json({ error: "lyrics required (1..10000 chars)" });
    }
    if (!isValidMood(mood)) {
        return res
            .status(400)
            .json({ error: `mood must be one of ${MOODS.join(", ")}` });
    }
    const titleStored = title.slice(0, 200);
    const contentHash = node_crypto_1.default
        .createHash("sha256")
        .update(titleStored + "|" + artistAlias + "|" + lyrics)
        .digest("hex");
    if ((0, ensureVoiceOfEarthTables_1.isVoiceOfEarthDbReady)()) {
        try {
            const { rows } = await pool.query(`INSERT INTO voe_tracks (title, artist_alias, language, lyrics, mood, audio_url, status, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, 'published', $7)
           RETURNING *`, [titleStored, artistAlias, language, lyrics, mood, audioUrl, contentHash]);
            return res.status(201).json({ track: rows[0], contentHash, storage: "db" });
        }
        catch (e) {
            console.error("[VoiceOfEarth] POST /tracks DB error", e);
        }
    }
    const track = {
        id: memNextId++,
        title: titleStored,
        artist_alias: artistAlias,
        language,
        lyrics,
        mood,
        audio_url: audioUrl,
        votes: 0,
        status: "published",
        created_at: new Date().toISOString(),
        content_hash: contentHash,
    };
    memTracks.push(track);
    // keep last 100 in memory
    if (memTracks.length > 100)
        memTracks.splice(0, memTracks.length - 100);
    res.status(201).json({ track, contentHash, storage: "memory" });
});
// ─── POST /api/voice-of-earth/tracks/:id/vote ────────────────────────────────
exports.voiceOfEarthRouter.post("/tracks/:id/vote", voteLimiter, async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(req.params.id);
    if (id === null) {
        return res.status(400).json({ error: "invalid id" });
    }
    const body = (req.body || {});
    const voterAlias = typeof body.voterAlias === "string" ? sanitizeAlias(body.voterAlias) : "";
    if (!voterAlias) {
        return res.status(400).json({ error: "voterAlias required" });
    }
    if ((0, ensureVoiceOfEarthTables_1.isVoiceOfEarthDbReady)()) {
        try {
            // Check track exists
            const { rowCount: trackRows } = await pool.query(`SELECT 1 FROM voe_tracks WHERE id = $1`, [id]);
            if (!trackRows)
                return res.status(404).json({ error: "not_found" });
            const insert = await pool.query(`INSERT INTO voe_votes (track_id, voter_alias)
           VALUES ($1, $2)
           ON CONFLICT (track_id, voter_alias) DO NOTHING
           RETURNING id`, [id, voterAlias]);
            if ((insert.rowCount ?? 0) === 0) {
                const { rows } = await pool.query(`SELECT votes FROM voe_tracks WHERE id = $1`, [id]);
                return res
                    .status(409)
                    .json({ error: "already_voted", votes: rows[0]?.votes ?? 0 });
            }
            const { rows } = await pool.query(`UPDATE voe_tracks SET votes = votes + 1 WHERE id = $1 RETURNING votes`, [id]);
            return res.json({ ok: true, votes: rows[0]?.votes ?? 0 });
        }
        catch (e) {
            console.error("[VoiceOfEarth] POST /tracks/:id/vote DB error", e);
            captureVoEError(e, { route: "voice-of-earth/POST/tracks/:id/vote" });
            return res.status(500).json({ error: "vote_failed" });
        }
    }
    const track = memTracks.find((t) => t.id === id);
    if (!track)
        return res.status(404).json({ error: "not_found" });
    const key = `${id}:${voterAlias}`;
    if (memVotes.has(key)) {
        return res.status(409).json({ error: "already_voted", votes: track.votes });
    }
    memVotes.add(key);
    track.votes += 1;
    res.json({ ok: true, votes: track.votes });
});
// ─── GET /api/voice-of-earth/stats ───────────────────────────────────────────
exports.voiceOfEarthRouter.get("/stats", async (_req, res) => {
    if ((0, ensureVoiceOfEarthTables_1.isVoiceOfEarthDbReady)()) {
        try {
            // Счёт — только поданные людьми; примеры отдельным числом (20.10.2026).
            const [tot, byLang, byMood, top, ex] = await Promise.all([
                pool.query(`SELECT COUNT(*)::text AS c FROM voe_tracks WHERE status='published' AND ${НЕ_ПРИМЕР_SQL(1)}`, [КЛЮЧИ]),
                pool.query(`SELECT language, COUNT(*)::text AS c FROM voe_tracks
           WHERE status='published' AND ${НЕ_ПРИМЕР_SQL(1)} GROUP BY language`, [КЛЮЧИ]),
                pool.query(`SELECT mood, COUNT(*)::text AS c FROM voe_tracks
           WHERE status='published' AND ${НЕ_ПРИМЕР_SQL(1)} GROUP BY mood`, [КЛЮЧИ]),
                pool.query(`SELECT id, title, artist_alias, language, mood, votes
           FROM voe_tracks WHERE status='published' AND ${НЕ_ПРИМЕР_SQL(1)}
           ORDER BY votes DESC, created_at DESC LIMIT 5`, [КЛЮЧИ]),
                pool.query(`SELECT COUNT(*)::text AS c FROM voe_tracks WHERE status='published' AND NOT ${НЕ_ПРИМЕР_SQL(1)}`, [КЛЮЧИ]),
            ]);
            const byLanguage = {};
            for (const r of byLang.rows)
                byLanguage[r.language] = Number(r.c);
            const byMoodObj = {};
            for (const r of byMood.rows)
                byMoodObj[r.mood] = Number(r.c);
            return res.json({
                total: Number(tot.rows[0]?.c ?? "0"),
                byLanguage,
                byMood: byMoodObj,
                topTracks: top.rows,
                examples: Number(ex.rows[0]?.c ?? "0"),
            });
        }
        catch (e) {
            console.error("[VoiceOfEarth] /stats DB error", e);
        }
    }
    const tracks = memTracks.filter((t) => t.status === "published" && !(0, voiceOfEarthSeed_1.трекПример)(t));
    const examples = memTracks.filter((t) => t.status === "published" && (0, voiceOfEarthSeed_1.трекПример)(t)).length;
    const byLanguage = {};
    const byMood = {};
    for (const t of tracks) {
        byLanguage[t.language] = (byLanguage[t.language] ?? 0) + 1;
        byMood[t.mood] = (byMood[t.mood] ?? 0) + 1;
    }
    const topTracks = [...tracks]
        .sort((a, b) => {
        if (b.votes !== a.votes)
            return b.votes - a.votes;
        return b.created_at.localeCompare(a.created_at);
    })
        .slice(0, 5)
        .map((t) => ({
        id: t.id,
        title: t.title,
        artist_alias: t.artist_alias,
        language: t.language,
        mood: t.mood,
        votes: t.votes,
    }));
    res.json({ total: tracks.length, byLanguage, byMood, topTracks, examples });
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.voiceOfEarthRouter.get("/status", (_req, res) => {
    res.json({
        module: "voice-of-earth",
        code: "VOE",
        status: "mvp",
        description: "Voice of Earth: indigenous-language tracks library with verifiable provenance + concept board.",
        endpoints: {
            tracks: "/api/voe/tracks",
            stats: "/api/voe/stats",
            conceptMessages: "/api/voe/concept/messages",
            conceptStats: "/api/voe/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({ router: exports.voiceOfEarthRouter, moduleId: "voe", defaultTag: "voe", writeLimit: submitLimiter });
