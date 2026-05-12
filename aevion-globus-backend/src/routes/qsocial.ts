import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQSocialTables, isQSocialDbReady } from "../lib/ensureQSocialTables";

export const qsocialRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureQSocialTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

interface QPost {
  id: string;
  userId: string;
  content: string;
  mediaUrl: string | null;
  type: string;
  likesCount: number;
  commentsCount: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface QComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
}

interface QNotification {
  id: string;
  type: "like" | "comment" | "follow" | "mention";
  fromUserId: string;
  resourceId: string;
  read: boolean;
  createdAt: string;
}

// In-memory fallback maps
const memPosts = new Map<string, QPost>();
const memFollows = new Map<string, { followerId: string; followingId: string; createdAt: string }>();
const memLikes = new Map<string, { userId: string; postId: string; createdAt: string }>();
const memComments = new Map<string, QComment>();
// key: userId -> QNotification[]
const memNotifications = new Map<string, QNotification[]>();

function addNotification(toUserId: string, notif: Omit<QNotification, "id" | "read" | "createdAt">): void {
  const existing = memNotifications.get(toUserId) ?? [];
  existing.unshift({ ...notif, id: crypto.randomUUID(), read: false, createdAt: nowIso() });
  // keep last 100
  memNotifications.set(toUserId, existing.slice(0, 100));
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function followKey(followerId: string, followingId: string): string {
  return `${followerId}:${followingId}`;
}

function likeKey(userId: string, postId: string): string {
  return `${userId}:${postId}`;
}

// ─── GET /api/qsocial/health ─────────────────────────────────────────────────
qsocialRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "qsocial",
    db: isQSocialDbReady() ? "postgres" : "in-memory",
  });
});

// ─── GET /api/qsocial/feed — public timeline, last 50 public posts ─────────
qsocialRouter.get("/feed", async (_req: Request, res: Response) => {
  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM "QSocialPost" WHERE "isPublic"=TRUE ORDER BY "createdAt" DESC LIMIT 50`,
      );
      return res.json({ posts: rows });
    }
    const posts = Array.from(memPosts.values())
      .filter((p) => p.isPublic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    return res.json({ posts });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/posts/:id ──────────────────────────────────────────────
qsocialRouter.get("/posts/:id", async (req: Request, res: Response) => {
  const id = param(req, "id");
  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QSocialPost" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      return res.json({ post: rows[0] });
    }
    const post = memPosts.get(id);
    if (!post) return res.status(404).json({ error: "not_found" });
    return res.json({ post });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qsocial/posts ─────────────────────────────────────────────────
qsocialRouter.post("/posts", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const { content, mediaUrl, type = "text", isPublic = true, tags = [] } = req.body as {
    content?: string;
    mediaUrl?: string;
    type?: string;
    isPublic?: boolean;
    tags?: string[];
  };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ error: "content required" });
  }
  if (content.length > 2000) {
    return res.status(400).json({ error: "content exceeds 2000 chars" });
  }

  const post: QPost = {
    id: newId(),
    userId: auth.sub,
    content: content.trim(),
    mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
    type: typeof type === "string" ? type : "text",
    likesCount: 0,
    commentsCount: 0,
    isPublic: isPublic !== false,
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    if (isQSocialDbReady()) {
      await pool.query(
        `INSERT INTO "QSocialPost" ("id","userId","content","mediaUrl","type","likesCount","commentsCount","isPublic","tags","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,NOW(),NOW())`,
        [post.id, post.userId, post.content, post.mediaUrl, post.type, post.isPublic, post.tags],
      );
    } else {
      memPosts.set(post.id, post);
    }
    return res.status(201).json({ post });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── PATCH /api/qsocial/posts/:id ────────────────────────────────────────────
qsocialRouter.patch("/posts/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const id = param(req, "id");
  const { content, isPublic } = req.body as { content?: string; isPublic?: boolean };

  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QSocialPost" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].userId !== auth.sub) return res.status(403).json({ error: "forbidden" });

      const newContent = typeof content === "string" ? content.trim() : rows[0].content;
      if (newContent.length > 2000) return res.status(400).json({ error: "content too long" });
      const newPublic = typeof isPublic === "boolean" ? isPublic : rows[0].isPublic;

      const { rows: updated } = await pool.query(
        `UPDATE "QSocialPost" SET "content"=$1,"isPublic"=$2,"updatedAt"=NOW() WHERE "id"=$3 RETURNING *`,
        [newContent, newPublic, id],
      );
      return res.json({ post: updated[0] });
    }

    const post = memPosts.get(id);
    if (!post) return res.status(404).json({ error: "not_found" });
    if (post.userId !== auth.sub) return res.status(403).json({ error: "forbidden" });

    if (typeof content === "string") {
      if (content.length > 2000) return res.status(400).json({ error: "content too long" });
      post.content = content.trim();
    }
    if (typeof isPublic === "boolean") post.isPublic = isPublic;
    post.updatedAt = nowIso();
    return res.json({ post });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── DELETE /api/qsocial/posts/:id ───────────────────────────────────────────
qsocialRouter.delete("/posts/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const id = param(req, "id");

  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(`SELECT "userId" FROM "QSocialPost" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].userId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      await pool.query(`DELETE FROM "QSocialPost" WHERE "id"=$1`, [id]);
    } else {
      const post = memPosts.get(id);
      if (!post) return res.status(404).json({ error: "not_found" });
      if (post.userId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      memPosts.delete(id);
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qsocial/posts/:id/like — toggle ───────────────────────────────
qsocialRouter.post("/posts/:id/like", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const postId = param(req, "id");

  try {
    if (isQSocialDbReady()) {
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM "QSocialLike" WHERE "userId"=$1 AND "postId"=$2`,
        [auth.sub, postId],
      );
      let liked: boolean;
      if (existing.length > 0) {
        await pool.query(`DELETE FROM "QSocialLike" WHERE "userId"=$1 AND "postId"=$2`, [auth.sub, postId]);
        await pool.query(`UPDATE "QSocialPost" SET "likesCount"=GREATEST(0,"likesCount"-1) WHERE "id"=$1`, [postId]);
        liked = false;
      } else {
        await pool.query(`INSERT INTO "QSocialLike" ("userId","postId","createdAt") VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING`, [auth.sub, postId]);
        await pool.query(`UPDATE "QSocialPost" SET "likesCount"="likesCount"+1 WHERE "id"=$1`, [postId]);
        liked = true;
      }
      const { rows: postRows } = await pool.query(`SELECT "likesCount" FROM "QSocialPost" WHERE "id"=$1`, [postId]);
      return res.json({ liked, likesCount: postRows[0]?.likesCount ?? 0 });
    }

    const key = likeKey(auth.sub, postId);
    const post = memPosts.get(postId);
    if (!post) return res.status(404).json({ error: "not_found" });

    let liked: boolean;
    if (memLikes.has(key)) {
      memLikes.delete(key);
      post.likesCount = Math.max(0, post.likesCount - 1);
      liked = false;
    } else {
      memLikes.set(key, { userId: auth.sub, postId, createdAt: nowIso() });
      post.likesCount += 1;
      liked = true;
      // Notify post owner (not self)
      if (post.userId !== auth.sub) {
        addNotification(post.userId, { type: "like", fromUserId: auth.sub, resourceId: postId });
      }
    }
    return res.json({ liked, likesCount: post.likesCount });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/posts/:id/comments ────────────────────────────────────
qsocialRouter.get("/posts/:id/comments", async (req: Request, res: Response) => {
  const postId = param(req, "id");
  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM "QSocialComment" WHERE "postId"=$1 ORDER BY "createdAt" ASC`,
        [postId],
      );
      return res.json({ comments: rows });
    }
    const comments = Array.from(memComments.values())
      .filter((c) => c.postId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return res.json({ comments });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qsocial/posts/:id/comments ────────────────────────────────────
qsocialRouter.post("/posts/:id/comments", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const postId = param(req, "id");
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ error: "content required" });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: "content exceeds 500 chars" });
  }

  const comment: QComment = {
    id: newId(),
    postId,
    userId: auth.sub,
    content: content.trim(),
    createdAt: nowIso(),
  };

  try {
    if (isQSocialDbReady()) {
      await pool.query(
        `INSERT INTO "QSocialComment" ("id","postId","userId","content","createdAt") VALUES ($1,$2,$3,$4,NOW())`,
        [comment.id, comment.postId, comment.userId, comment.content],
      );
      await pool.query(`UPDATE "QSocialPost" SET "commentsCount"="commentsCount"+1 WHERE "id"=$1`, [postId]);
    } else {
      if (!memPosts.has(postId)) return res.status(404).json({ error: "post not found" });
      memComments.set(comment.id, comment);
      const post = memPosts.get(postId);
      if (post) {
        post.commentsCount += 1;
        // Notify post owner (not self)
        if (post.userId !== auth.sub) {
          addNotification(post.userId, { type: "comment", fromUserId: auth.sub, resourceId: postId });
        }
      }
    }
    return res.status(201).json({ comment });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/users/:userId/posts ────────────────────────────────────
qsocialRouter.get("/users/:userId/posts", async (req: Request, res: Response) => {
  const userId = param(req, "userId");
  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM "QSocialPost" WHERE "userId"=$1 AND "isPublic"=TRUE ORDER BY "createdAt" DESC LIMIT 50`,
        [userId],
      );
      return res.json({ posts: rows });
    }
    const posts = Array.from(memPosts.values())
      .filter((p) => p.userId === userId && p.isPublic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    return res.json({ posts });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qsocial/follow/:userId — toggle ────────────────────────────────
qsocialRouter.post("/follow/:userId", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const followingId = param(req, "userId");
  if (followingId === auth.sub) return res.status(400).json({ error: "cannot follow yourself" });

  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT 1 FROM "QSocialFollow" WHERE "followerId"=$1 AND "followingId"=$2`,
        [auth.sub, followingId],
      );
      let following: boolean;
      if (rows.length > 0) {
        await pool.query(`DELETE FROM "QSocialFollow" WHERE "followerId"=$1 AND "followingId"=$2`, [auth.sub, followingId]);
        following = false;
      } else {
        await pool.query(
          `INSERT INTO "QSocialFollow" ("followerId","followingId","createdAt") VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING`,
          [auth.sub, followingId],
        );
        following = true;
      }
      return res.json({ following });
    }

    const key = followKey(auth.sub, followingId);
    let following: boolean;
    if (memFollows.has(key)) {
      memFollows.delete(key);
      following = false;
    } else {
      memFollows.set(key, { followerId: auth.sub, followingId, createdAt: nowIso() });
      following = true;
      // Notify followee
      addNotification(followingId, { type: "follow", fromUserId: auth.sub, resourceId: auth.sub });
    }
    return res.json({ following });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/me/feed — posts from people I follow ───────────────────
qsocialRouter.get("/me/feed", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT p.* FROM "QSocialPost" p
         JOIN "QSocialFollow" f ON f."followingId"=p."userId"
         WHERE f."followerId"=$1 AND p."isPublic"=TRUE
         ORDER BY p."createdAt" DESC LIMIT 50`,
        [auth.sub],
      );
      return res.json({ posts: rows });
    }

    const myFollowingIds = Array.from(memFollows.values())
      .filter((f) => f.followerId === auth.sub)
      .map((f) => f.followingId);

    const posts = Array.from(memPosts.values())
      .filter((p) => myFollowingIds.includes(p.userId) && p.isPublic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    return res.json({ posts });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/me/followers ───────────────────────────────────────────
qsocialRouter.get("/me/followers", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT "followerId", "createdAt" FROM "QSocialFollow" WHERE "followingId"=$1`,
        [auth.sub],
      );
      return res.json({ followers: rows });
    }
    const followers = Array.from(memFollows.values())
      .filter((f) => f.followingId === auth.sub)
      .map((f) => ({ followerId: f.followerId, createdAt: f.createdAt }));
    return res.json({ followers });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/me/following ───────────────────────────────────────────
qsocialRouter.get("/me/following", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  try {
    if (isQSocialDbReady()) {
      const { rows } = await pool.query(
        `SELECT "followingId", "createdAt" FROM "QSocialFollow" WHERE "followerId"=$1`,
        [auth.sub],
      );
      return res.json({ following: rows });
    }
    const following = Array.from(memFollows.values())
      .filter((f) => f.followerId === auth.sub)
      .map((f) => ({ followingId: f.followingId, createdAt: f.createdAt }));
    return res.json({ following });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qsocial/me/notifications ───────────────────────────────────────
qsocialRouter.get("/me/notifications", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const all = memNotifications.get(auth.sub) ?? [];
  const sorted = [...all.filter((n) => !n.read), ...all.filter((n) => n.read)].slice(0, 50);
  return res.json({ notifications: sorted, total: sorted.length, unread: all.filter((n) => !n.read).length });
});

// ─── PATCH /api/qsocial/me/notifications/:id/read ────────────────────────────
qsocialRouter.patch("/me/notifications/:id/read", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const notifId = String(req.params.id);
  const all = memNotifications.get(auth.sub) ?? [];
  const notif = all.find((n) => n.id === notifId);
  if (!notif) return res.status(404).json({ error: "not_found" });
  notif.read = true;
  return res.json({ ok: true });
});

// ─── DELETE /api/qsocial/me/notifications — mark all read ────────────────────
qsocialRouter.delete("/me/notifications", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const all = memNotifications.get(auth.sub) ?? [];
  all.forEach((n) => { n.read = true; });
  return res.json({ ok: true });
});

// ─── GET /api/qsocial/search — search posts by content + tags ────────────────
qsocialRouter.get("/search", (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").toLowerCase().trim();
  if (!q) return res.status(400).json({ error: "q is required" });

  const posts = Array.from(memPosts.values())
    .filter((p) => p.isPublic && (
      p.content.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  return res.json({ posts });
});

// ─── GET /api/qsocial/hashtag/:tag — posts with this tag ─────────────────────
qsocialRouter.get("/hashtag/:tag", (req: Request, res: Response) => {
  const tag = String(req.params.tag ?? "").toLowerCase();
  const posts = Array.from(memPosts.values())
    .filter((p) => p.isPublic && p.tags.some((t) => t.toLowerCase() === tag))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  return res.json({ tag, posts });
});

// ─── GET /api/qsocial/trending-tags — top 10 tags by frequency ───────────────
qsocialRouter.get("/trending-tags", (_req: Request, res: Response) => {
  const tagCounts = new Map<string, number>();
  for (const post of memPosts.values()) {
    if (!post.isPublic) continue;
    for (const tag of post.tags) {
      const t = tag.toLowerCase();
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const tags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  return res.json({ tags });
});
