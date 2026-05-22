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

import { Router, type Request, type Response } from "express";
import { randomUUID, createHash } from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";

type Vote = -1 | 1;
type CommentRow = {
  id: string;
  artifactId: string;
  voterKey: string;
  userId: string | null;
  authorName: string | null;
  text: string;
  createdAt: string;
};

const ANON_SALT = process.env.CONSTITUTION_ANON_SALT || "aevion-constitution-v1";

function fingerprint(req: Request): string {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const ua = String(req.headers["user-agent"] || "unknown").slice(0, 200);
  return createHash("sha256").update(`${ip}|${ua}|${ANON_SALT}`).digest("hex").slice(0, 32);
}

function voterKey(req: Request): { key: string; userId: string | null; isAuth: boolean } {
  const payload = verifyBearerOptional(req);
  const userId =
    payload && typeof (payload as Record<string, unknown>).userId === "string"
      ? String((payload as Record<string, unknown>).userId)
      : payload && typeof (payload as Record<string, unknown>).sub === "string"
        ? String((payload as Record<string, unknown>).sub)
        : null;
  if (userId) return { key: `u:${userId}`, userId, isAuth: true };
  return { key: `f:${fingerprint(req)}`, userId: null, isAuth: false };
}

let tablesReady = false;
let dbAvailable = false;

async function ensureSocialTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
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
  } catch {
    dbAvailable = false;
  }
  tablesReady = true;
}

// In-memory fallback
const memVotes = new Map<string, Map<string, Vote>>(); // artifactId → (voterKey → vote)
const memComments = new Map<string, CommentRow[]>(); // artifactId → comments

const writeLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "constitution-social-write" });
const readLimit = rateLimit({ windowMs: 60_000, max: 240, keyPrefix: "constitution-social-read" });

export const planetConstitutionSocialRouter = Router({ mergeParams: true });

planetConstitutionSocialRouter.post(
  "/:id/vote",
  writeLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const v = body.vote === 1 || body.vote === -1 ? (body.vote as Vote) : null;
      if (!v) return res.status(400).json({ error: "vote_must_be_1_or_-1" });
      const { key, isAuth } = voterKey(req);

      await ensureSocialTables();
      if (dbAvailable) {
        try {
          const pool = getPool();
          await pool.query(
            `INSERT INTO planet_constitution_votes ("artifactId","voterKey","vote")
             VALUES ($1,$2,$3)
             ON CONFLICT ("artifactId","voterKey")
             DO UPDATE SET "vote" = EXCLUDED."vote", "createdAt" = NOW()`,
            [id, key, v],
          );
          return res.json({ ok: true, vote: v, isAuth, storage: "postgres" });
        } catch {
          /* fall through */
        }
      }
      const map = memVotes.get(id) ?? new Map();
      map.set(key, v);
      memVotes.set(id, map);
      res.json({ ok: true, vote: v, isAuth, storage: "memory" });
    } catch (err) {
      res.status(500).json({
        error: "vote_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionSocialRouter.delete(
  "/:id/vote",
  writeLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { key } = voterKey(req);
      await ensureSocialTables();
      if (dbAvailable) {
        try {
          const pool = getPool();
          await pool.query(
            `DELETE FROM planet_constitution_votes WHERE "artifactId" = $1 AND "voterKey" = $2`,
            [id, key],
          );
          return res.json({ ok: true, storage: "postgres" });
        } catch {
          /* fall through */
        }
      }
      memVotes.get(id)?.delete(key);
      res.json({ ok: true, storage: "memory" });
    } catch (err) {
      res.status(500).json({
        error: "unvote_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionSocialRouter.post(
  "/:id/comment",
  writeLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const authorNameRaw =
        typeof body.authorName === "string" ? body.authorName.trim() : "";
      if (!text) return res.status(400).json({ error: "missing_text" });
      if (text.length > 800) return res.status(400).json({ error: "text_too_long_max_800" });
      const { key, userId } = voterKey(req);
      const authorName = authorNameRaw
        ? authorNameRaw.slice(0, 60)
        : userId
          ? null
          : "anon";
      const row: CommentRow = {
        id: randomUUID(),
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
          const pool = getPool();
          await pool.query(
            `INSERT INTO planet_constitution_comments
               ("id","artifactId","voterKey","userId","authorName","text","createdAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [row.id, row.artifactId, row.voterKey, row.userId, row.authorName, row.text, row.createdAt],
          );
          return res.status(201).json({ comment: row, storage: "postgres" });
        } catch {
          /* fall through */
        }
      }
      const list = memComments.get(id) ?? [];
      list.unshift(row);
      memComments.set(id, list.slice(0, 200));
      res.status(201).json({ comment: row, storage: "memory" });
    } catch (err) {
      res.status(500).json({
        error: "comment_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionSocialRouter.get(
  "/:id/social",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { key } = voterKey(req);
      await ensureSocialTables();
      if (dbAvailable) {
        try {
          const pool = getPool();
          const votesQ = await pool.query(
            `SELECT
               COALESCE(SUM(CASE WHEN "vote" = 1 THEN 1 ELSE 0 END), 0)::int AS up,
               COALESCE(SUM(CASE WHEN "vote" = -1 THEN 1 ELSE 0 END), 0)::int AS down
             FROM planet_constitution_votes WHERE "artifactId" = $1`,
            [id],
          );
          const myVoteQ = await pool.query(
            `SELECT "vote" FROM planet_constitution_votes
             WHERE "artifactId" = $1 AND "voterKey" = $2`,
            [id, key],
          );
          const commentsQ = await pool.query(
            `SELECT "id","userId","authorName","text","createdAt"
             FROM planet_constitution_comments
             WHERE "artifactId" = $1
             ORDER BY "createdAt" DESC
             LIMIT 100`,
            [id],
          );
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
        } catch {
          /* fall through */
        }
      }
      const map = memVotes.get(id) ?? new Map<string, Vote>();
      let up = 0, down = 0, my: Vote | 0 = 0;
      for (const [k, v] of map.entries()) {
        if (v === 1) up += 1;
        else if (v === -1) down += 1;
        if (k === key) my = v;
      }
      const comments = memComments.get(id) ?? [];
      res.json({
        artifactId: id,
        votes: { up, down, total: up - down, my },
        comments: comments.slice(0, 100),
        storage: "memory",
      });
    } catch (err) {
      res.status(500).json({
        error: "social_get_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);
