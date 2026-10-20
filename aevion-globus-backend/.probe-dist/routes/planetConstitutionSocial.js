"use strict";
/**
 * Planet Constitution — social layer (votes + comments).
 *
 *   POST   /api/planet/constitution-artifacts/:id/vote     { vote: 1|-1 }
 *   DELETE /api/planet/constitution-artifacts/:id/vote
 *   POST   /api/planet/constitution-artifacts/:id/comment  { text }
 *   GET    /api/planet/constitution-artifacts/:id/social   → { votes, comments }
 *
 * Auth: optional JWT (verifyBearerOptional). Anonymous users get a
 * fingerprint = sha256(IP + UA + ANON_SALT). One vote per (artifact_id,
 * voter_key). Comments require either JWT or fingerprint with a soft
 * rate-limit.
 *
 * Tables:
 *   planet_constitution_votes (artifact_id, voter_key, vote, created_at)
 *   planet_constitution_comments (id, artifact_id, voter_key, user_id,
 *                                 author_name, text, created_at)
 *
 * Falls back to in-memory Map if Postgres unavailable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetConstitutionSocialRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const rateLimit_1 = require("../lib/rateLimit");
const dbPool_1 = require("../lib/dbPool");
const authJwt_1 = require("../lib/authJwt");
const constitutionSchemas_1 = require("../lib/constitutionSchemas");
const platform_1 = require("../lib/sentry/platform");
const capture = (0, platform_1.makeServiceCapture)("planetConstitutionSocial");
const ANON_SALT = process.env.CONSTITUTION_ANON_SALT || "aevion-constitution-v1";
function fingerprint(req) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";
    const ua = String(req.headers["user-agent"] || "unknown").slice(0, 200);
    return (0, node_crypto_1.createHash)("sha256").update(`${ip}|${ua}|${ANON_SALT}`).digest("hex").slice(0, 32);
}
function voterKey(req) {
    const payload = (0, authJwt_1.verifyBearerOptional)(req);
    const userId = payload && typeof payload.userId === "string"
        ? String(payload.userId)
        : payload && typeof payload.sub === "string"
            ? String(payload.sub)
            : null;
    if (userId)
        return { key: `u:${userId}`, userId, isAuth: true };
    return { key: `f:${fingerprint(req)}`, userId: null, isAuth: false };
}
let tablesReady = false;
let dbAvailable = false;
async function ensureSocialTables() {
    if (tablesReady)
        return;
    try {
        const pool = (0, dbPool_1.getPool)();
        await pool.query(`
      CREATE TABLE IF NOT EXISTS planet_constitution_votes (
        "artifactId" UUID NOT NULL,
        "voterKey"   TEXT NOT NULL,
        "vote"       SMALLINT NOT NULL CHECK ("vote" IN (-1, 1)),
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("artifactId", "voterKey")
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_votes_artifact
        ON planet_constitution_votes ("artifactId");

      CREATE TABLE IF NOT EXISTS planet_constitution_comments (
        "id"         UUID PRIMARY KEY,
        "artifactId" UUID NOT NULL,
        "voterKey"   TEXT NOT NULL,
        "userId"     TEXT,
        "authorName" TEXT,
        "text"       TEXT NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_comments_artifact
        ON planet_constitution_comments ("artifactId", "createdAt" DESC);
    `);
        dbAvailable = true;
    }
    catch {
        dbAvailable = false;
    }
    tablesReady = true;
}
// In-memory fallback
const memVotes = new Map(); // artifactId → (voterKey → vote)
const memComments = new Map(); // artifactId → comments
const writeLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 30, keyPrefix: "constitution-social-write" });
const readLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 240, keyPrefix: "constitution-social-read" });
exports.planetConstitutionSocialRouter = (0, express_1.Router)({ mergeParams: true });
exports.planetConstitutionSocialRouter.post("/:id/vote", writeLimit, (0, constitutionSchemas_1.validate)(constitutionSchemas_1.VoteSchema), async (req, res) => {
    try {
        const id = String(req.params.id);
        const v = req.body.vote;
        const { key, isAuth } = voterKey(req);
        await ensureSocialTables();
        if (dbAvailable) {
            try {
                const pool = (0, dbPool_1.getPool)();
                await pool.query(`INSERT INTO planet_constitution_votes ("artifactId","voterKey","vote")
             VALUES ($1,$2,$3)
             ON CONFLICT ("artifactId","voterKey")
             DO UPDATE SET "vote" = EXCLUDED."vote", "createdAt" = NOW()`, [id, key, v]);
                return res.json({ ok: true, vote: v, isAuth, storage: "postgres" });
            }
            catch {
                /* fall through */
            }
        }
        const map = memVotes.get(id) ?? new Map();
        map.set(key, v);
        memVotes.set(id, map);
        res.json({ ok: true, vote: v, isAuth, storage: "memory" });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: "vote_failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }
});
exports.planetConstitutionSocialRouter.delete("/:id/vote", writeLimit, async (req, res) => {
    try {
        const id = String(req.params.id);
        const { key } = voterKey(req);
        await ensureSocialTables();
        if (dbAvailable) {
            try {
                const pool = (0, dbPool_1.getPool)();
                await pool.query(`DELETE FROM planet_constitution_votes WHERE "artifactId" = $1 AND "voterKey" = $2`, [id, key]);
                return res.json({ ok: true, storage: "postgres" });
            }
            catch {
                /* fall through */
            }
        }
        memVotes.get(id)?.delete(key);
        res.json({ ok: true, storage: "memory" });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: "unvote_failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }
});
exports.planetConstitutionSocialRouter.post("/:id/comment", writeLimit, (0, constitutionSchemas_1.validate)(constitutionSchemas_1.CommentCreateSchema), async (req, res) => {
    try {
        const id = String(req.params.id);
        const { text, authorName: authorNameRaw } = req.body;
        const { key, userId } = voterKey(req);
        const authorName = authorNameRaw
            ? authorNameRaw.slice(0, 60)
            : userId
                ? null
                : "anon";
        const row = {
            id: (0, node_crypto_1.randomUUID)(),
            artifactId: id,
            voterKey: key,
            userId,
            authorName,
            text,
            createdAt: new Date().toISOString(),
        };
        await ensureSocialTables();
        if (dbAvailable) {
            try {
                const pool = (0, dbPool_1.getPool)();
                await pool.query(`INSERT INTO planet_constitution_comments
               ("id","artifactId","voterKey","userId","authorName","text","createdAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7)`, [row.id, row.artifactId, row.voterKey, row.userId, row.authorName, row.text, row.createdAt]);
                return res.status(201).json({ comment: row, storage: "postgres" });
            }
            catch {
                /* fall through */
            }
        }
        const list = memComments.get(id) ?? [];
        list.unshift(row);
        memComments.set(id, list.slice(0, 200));
        res.status(201).json({ comment: row, storage: "memory" });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: "comment_failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }
});
exports.planetConstitutionSocialRouter.get("/:id/social", readLimit, async (req, res) => {
    try {
        const id = String(req.params.id);
        const { key } = voterKey(req);
        await ensureSocialTables();
        if (dbAvailable) {
            try {
                const pool = (0, dbPool_1.getPool)();
                const votesQ = await pool.query(`SELECT
               COALESCE(SUM(CASE WHEN "vote" = 1 THEN 1 ELSE 0 END), 0)::int AS up,
               COALESCE(SUM(CASE WHEN "vote" = -1 THEN 1 ELSE 0 END), 0)::int AS down
             FROM planet_constitution_votes WHERE "artifactId" = $1`, [id]);
                const myVoteQ = await pool.query(`SELECT "vote" FROM planet_constitution_votes
             WHERE "artifactId" = $1 AND "voterKey" = $2`, [id, key]);
                const commentsQ = await pool.query(`SELECT "id","userId","authorName","text","createdAt"
             FROM planet_constitution_comments
             WHERE "artifactId" = $1
             ORDER BY "createdAt" DESC
             LIMIT 100`, [id]);
                return res.json({
                    artifactId: id,
                    votes: {
                        up: votesQ.rows[0]?.up ?? 0,
                        down: votesQ.rows[0]?.down ?? 0,
                        total: (votesQ.rows[0]?.up ?? 0) - (votesQ.rows[0]?.down ?? 0),
                        my: myVoteQ.rows[0]?.vote ?? 0,
                    },
                    comments: commentsQ.rows,
                    storage: "postgres",
                });
            }
            catch {
                /* fall through */
            }
        }
        const map = memVotes.get(id) ?? new Map();
        let up = 0, down = 0, my = 0;
        for (const [k, v] of map.entries()) {
            if (v === 1)
                up += 1;
            else if (v === -1)
                down += 1;
            if (k === key)
                my = v;
        }
        const comments = memComments.get(id) ?? [];
        res.json({
            artifactId: id,
            votes: { up, down, total: up - down, my },
            comments: comments.slice(0, 100),
            storage: "memory",
        });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: "social_get_failed",
            detail: err instanceof Error ? err.message : "unknown",
        });
    }
});
