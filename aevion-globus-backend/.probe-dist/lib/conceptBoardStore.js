"use strict";
/**
 * Shared concept-board store for the MVP-board pattern used by AEVION modules.
 * Single Postgres table aevion_concept_messages with module_id discriminator,
 * keyed by uuid. Falls back to per-module in-memory store (cap 200) when the
 * DB is unavailable or insert/select fails, so the surface keeps working in
 * dev or during a Railway DB blip.
 *
 * fieldMap on mountConceptBoard lets module-specific routes (qchaingov,
 * veilnetx) keep their custom payload field names while sharing storage:
 * canonical (idea, rationale) is the storage contract, the helper remaps to
 * the module's preferred field names on both POST and GET.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isConceptBoardDbReady = isConceptBoardDbReady;
exports.getConceptBoardDbError = getConceptBoardDbError;
exports.ensureConceptBoardTable = ensureConceptBoardTable;
exports.addMessage = addMessage;
exports.getMessages = getMessages;
exports.getStats = getStats;
exports.mountConceptBoard = mountConceptBoard;
const node_crypto_1 = __importDefault(require("node:crypto"));
const dbPool_1 = require("./dbPool");
let ensured = false;
let _dbReady = false;
let _dbError = null;
function isConceptBoardDbReady() { return _dbReady; }
function getConceptBoardDbError() { return _dbError; }
async function ensureConceptBoardTable(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "database unavailable";
        console.warn(`[ConceptBoard] DB unavailable, in-memory fallback: ${_dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS aevion_concept_messages (
        id          UUID PRIMARY KEY,
        module_id   TEXT NOT NULL,
        idea        TEXT NOT NULL,
        rationale   TEXT NOT NULL DEFAULT '',
        author      TEXT NOT NULL DEFAULT '',
        tags        TEXT[] NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      ALTER TABLE aevion_concept_messages
        ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_aevion_concept_module_created
        ON aevion_concept_messages (module_id, created_at DESC);
    `);
        _dbReady = true;
        ensured = true;
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "table init failed";
        console.warn(`[ConceptBoard] table init failed: ${_dbError}`);
    }
}
const MEM_MAX = 200;
const memStore = new Map();
function memList(moduleId) {
    return memStore.get(moduleId) ?? [];
}
async function addMessage(moduleId, payload, tags, extra = {}) {
    const id = node_crypto_1.default.randomUUID();
    const createdAt = new Date().toISOString();
    // Признак ставится там, где исход ИЗВЕСТЕН, а не здесь: заготовка ещё
    // нигде не сохранена, и «db» по умолчанию был бы враньём по умолчанию.
    const msg = { id, payload, extra, tags, createdAt };
    const pool = (0, dbPool_1.getPool)();
    try {
        await ensureConceptBoardTable(pool);
        if (_dbReady) {
            await pool.query(`INSERT INTO aevion_concept_messages (id, module_id, idea, rationale, author, tags, extra, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, moduleId, payload.idea, payload.rationale, payload.author, tags, JSON.stringify(extra), createdAt]);
            return { ...msg, storage: "db" };
        }
    }
    catch (e) {
        console.warn(`[ConceptBoard] insert failed for ${moduleId}, falling back to memory: ${e?.message}`);
    }
    const fallback = { ...msg, storage: "memory" };
    const list = memStore.get(moduleId) ?? [];
    list.unshift(fallback);
    if (list.length > MEM_MAX)
        list.length = MEM_MAX;
    memStore.set(moduleId, list);
    return fallback;
}
async function getMessages(moduleId, limit) {
    const pool = (0, dbPool_1.getPool)();
    try {
        await ensureConceptBoardTable(pool);
        if (_dbReady) {
            const { rows } = await pool.query(`SELECT id, idea, rationale, author, tags, extra, created_at
         FROM aevion_concept_messages
         WHERE module_id = $1
         ORDER BY created_at DESC
         LIMIT $2`, [moduleId, limit]);
            return rows.map((r) => ({
                id: r.id,
                payload: { idea: r.idea, rationale: r.rationale, author: r.author },
                extra: (r.extra && typeof r.extra === "object") ? r.extra : {},
                tags: Array.isArray(r.tags) ? r.tags : [],
                createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
                storage: "db",
            }));
        }
    }
    catch (e) {
        console.warn(`[ConceptBoard] select failed for ${moduleId}: ${e?.message}`);
    }
    return memList(moduleId).slice(0, limit);
}
async function getStats(moduleId) {
    const pool = (0, dbPool_1.getPool)();
    try {
        await ensureConceptBoardTable(pool);
        if (_dbReady) {
            const [totalRes, last7dRes, tagsRes] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS c FROM aevion_concept_messages WHERE module_id = $1`, [moduleId]),
                pool.query(`SELECT COUNT(*)::int AS c FROM aevion_concept_messages WHERE module_id = $1 AND created_at > NOW() - INTERVAL '7 days'`, [moduleId]),
                pool.query(`
          SELECT tag, COUNT(*)::int AS count
          FROM aevion_concept_messages, unnest(tags) AS tag
          WHERE module_id = $1
          GROUP BY tag
          ORDER BY count DESC
          LIMIT 5
        `, [moduleId]),
            ]);
            return {
                total: totalRes.rows[0]?.c ?? 0,
                last7d: last7dRes.rows[0]?.c ?? 0,
                topTags: tagsRes.rows.map((r) => ({ tag: String(r.tag), count: r.count })),
            };
        }
    }
    catch (e) {
        console.warn(`[ConceptBoard] stats failed for ${moduleId}: ${e?.message}`);
    }
    const items = memList(moduleId);
    const now = Date.now();
    const sevenDays = 7 * 86400000;
    const last7d = items.filter((m) => now - new Date(m.createdAt).getTime() <= sevenDays).length;
    const tagCounts = new Map();
    for (const m of items)
        for (const t of m.tags)
            tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    const topTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));
    return { total: items.length, last7d, topTags };
}
function buildResponsePayload(msg, fieldMap) {
    if (!fieldMap) {
        return { ...msg.payload, ...msg.extra };
    }
    const out = {
        [fieldMap.idea ?? "idea"]: msg.payload.idea,
        [fieldMap.rationale ?? "rationale"]: msg.payload.rationale,
    };
    for (const k of fieldMap.extraFields ?? []) {
        if (k in msg.extra)
            out[k] = msg.extra[k];
    }
    return out;
}
function projectMessage(msg, fieldMap) {
    return {
        id: msg.id,
        payload: buildResponsePayload(msg, fieldMap),
        tags: msg.tags,
        createdAt: msg.createdAt,
        // Наружу тоже: клиент, показавший «сохранено», должен иметь возможность
        // сказать правду, если сохранено оно только до перезапуска.
        storage: msg.storage,
    };
}
/**
 * Mounts /concept/messages GET+POST + /concept-stats on the given router.
 * The module's own /status endpoint stays in its route file (module-specific
 * description, endpoints map, etc).
 */
function mountConceptBoard(opts) {
    const { router, moduleId, defaultTag, fieldMap } = opts;
    const reads = opts.readLimit ? [opts.readLimit] : [];
    const writes = opts.writeLimit ? [opts.writeLimit] : [];
    const ideaKey = fieldMap?.idea ?? "idea";
    const rationaleKey = fieldMap?.rationale ?? "rationale";
    const extraKeys = fieldMap?.extraFields ?? [];
    router.get("/concept/messages", ...reads, async (req, res) => {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
        const [items, stats] = await Promise.all([getMessages(moduleId, limit), getStats(moduleId)]);
        res.json({
            items: items.map((m) => projectMessage(m, fieldMap)),
            total: stats.total,
            moduleId,
            noun: "concept/messages",
        });
    });
    router.post("/concept/messages", ...writes, async (req, res) => {
        try {
            const body = (req.body && typeof req.body === "object") ? req.body : {};
            const payload = (body.payload && typeof body.payload === "object")
                ? body.payload
                : body;
            const idea = String(payload[ideaKey] ?? payload.title ?? "").trim().slice(0, 200);
            if (!idea) {
                res.status(400).json({ error: "missing_field", field: ideaKey });
                return;
            }
            const rationale = String(payload[rationaleKey] ?? payload.summary ?? "").trim().slice(0, 800);
            const author = String(payload.author ?? "").trim().slice(0, 80);
            const tagsRaw = Array.isArray(payload.tags) ? payload.tags : [defaultTag];
            const tags = tagsRaw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6);
            const extra = {};
            for (const k of extraKeys) {
                if (k in payload) {
                    const v = payload[k];
                    extra[k] = (typeof v === "string") ? v.slice(0, 200) : v;
                }
            }
            const msg = await addMessage(moduleId, { idea, rationale, author }, tags.length ? tags : [defaultTag], extra);
            res.status(201).json(projectMessage(msg, fieldMap));
        }
        catch (err) {
            console.error(`[${moduleId}] concept_post_failed`, err instanceof Error ? err.message : err);
            res.status(500).json({ error: "concept_post_failed" });
        }
    });
    router.get("/concept-stats", ...reads, async (_req, res) => {
        const stats = await getStats(moduleId);
        res.json({ moduleId, noun: "concept/messages", ...stats });
    });
}
