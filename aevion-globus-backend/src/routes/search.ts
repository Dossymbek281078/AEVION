/**
 * AEVION Universal Search — /api/search?q=<query>
 *
 * Queries QStore, QLearn, QNews, QEvents, QJobs, QRight in parallel
 * and returns unified results ranked by relevance score.
 *
 * GET /api/search?q=ai&limit=20&types=qstore,qlearn,qnews
 */
import { Router, type Request, type Response } from "express";
import { getPool } from "../lib/dbPool";
import rateLimit from "express-rate-limit";

export const searchRouter = Router();

const searchLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

interface SearchResult {
  id: string;
  type: "qstore" | "qlearn" | "qnews" | "qevents" | "qjobs" | "qright";
  title: string;
  description: string;
  url: string;
  metadata?: Record<string, unknown>;
  score: number;
}

function scoreText(query: string, title: string, description: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  const d = description.toLowerCase();
  let s = 0;
  if (t === q) s += 100;
  else if (t.startsWith(q)) s += 60;
  else if (t.includes(q)) s += 40;
  if (d.includes(q)) s += 10;
  return s;
}

async function searchQStore(pool: any, q: string, limit: number): Promise<SearchResult[]> {
  try {
    const r = await pool.query(
      `SELECT id, title, description, category, price, currency, "salesCount", tags
       FROM "QStoreProduct"
       WHERE "isPublic" = TRUE AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1
         OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE LOWER(t) LIKE $1)
       ) ORDER BY "salesCount" DESC LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      type: "qstore" as const,
      title: row.title,
      description: (row.description || "").slice(0, 200),
      url: `/qstore/${row.id}`,
      metadata: { price: row.price, currency: row.currency, category: row.category, salesCount: row.salesCount },
      score: scoreText(q, row.title, row.description || ""),
    }));
  } catch { return []; }
}

async function searchQLearn(pool: any, q: string, limit: number): Promise<SearchResult[]> {
  try {
    const r = await pool.query(
      `SELECT id, title, description, category, level, "enrollmentCount"
       FROM "QLearnCourse"
       WHERE "isPublic" = TRUE AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1
       ) ORDER BY "enrollmentCount" DESC LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      type: "qlearn" as const,
      title: row.title,
      description: (row.description || "").slice(0, 200),
      url: `/qlearn/courses/${row.id}`,
      metadata: { category: row.category, level: row.level, enrollmentCount: row.enrollmentCount },
      score: scoreText(q, row.title, row.description || "") + 5,
    }));
  } catch { return []; }
}

async function searchQNews(pool: any, q: string, limit: number): Promise<SearchResult[]> {
  try {
    const r = await pool.query(
      `SELECT id, title, summary, url, source, category
       FROM "QNewsArticle"
       WHERE LOWER(title) LIKE $1 OR LOWER(summary) LIKE $1 OR LOWER(category) LIKE $1
       ORDER BY "createdAt" DESC LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      type: "qnews" as const,
      title: row.title,
      description: (row.summary || "").slice(0, 200),
      url: row.url || `/qnews/${row.id}`,
      metadata: { source: row.source, category: row.category },
      score: scoreText(q, row.title, row.summary || ""),
    }));
  } catch { return []; }
}

async function searchQEvents(pool: any, q: string, limit: number): Promise<SearchResult[]> {
  try {
    const r = await pool.query(
      `SELECT id, title, description, category, location, "startAt", "attendeeCount"
       FROM "QEvent"
       WHERE "isPublic" = TRUE AND "startAt" > NOW() AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(category) LIKE $1 OR LOWER(location) LIKE $1
       ) ORDER BY "startAt" ASC LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      type: "qevents" as const,
      title: row.title,
      description: (row.description || "").slice(0, 200),
      url: `/qevents/${row.id}`,
      metadata: { category: row.category, location: row.location, startAt: row.startAt, attendeeCount: row.attendeeCount },
      score: scoreText(q, row.title, row.description || "") + 3,
    }));
  } catch { return []; }
}

async function searchQJobs(pool: any, q: string, limit: number): Promise<SearchResult[]> {
  try {
    const r = await pool.query(
      `SELECT id, title, description, "jobType", location, salary, "companyName"
       FROM qjobs
       WHERE status = 'open' AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1
         OR LOWER("companyName") LIKE $1 OR LOWER(location) LIKE $1
       ) ORDER BY "createdAt" DESC LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      type: "qjobs" as const,
      title: row.title,
      description: (row.description || "").slice(0, 200),
      url: `/qjobs/${row.id}`,
      metadata: { jobType: row.jobType, location: row.location, salary: row.salary, company: row.companyName },
      score: scoreText(q, row.title, row.description || ""),
    }));
  } catch { return []; }
}

async function searchQRight(pool: any, q: string, limit: number): Promise<SearchResult[]> {
  try {
    const r = await pool.query(
      `SELECT id, title, description, kind, "ownerName", "createdAt"
       FROM "QRightObject"
       WHERE "revokedAt" IS NULL AND (
         LOWER(title) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(kind) LIKE $1
       ) ORDER BY "createdAt" DESC LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      type: "qright" as const,
      title: row.title,
      description: (row.description || "").slice(0, 200),
      url: `/qright/${row.id}`,
      metadata: { kind: row.kind, ownerName: row.ownerName },
      score: scoreText(q, row.title, row.description || "") - 5,
    }));
  } catch { return []; }
}

// GET /api/search?q=...&limit=20&types=qstore,qlearn,qnews,qevents,qjobs,qright
searchRouter.get("/", searchLimit, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length < 2) {
    return res.status(400).json({ error: "q required (min 2 chars)" });
  }
  if (q.length > 100) {
    return res.status(400).json({ error: "q too long (max 100 chars)" });
  }

  const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limit ?? "5"), 10)));
  const typesParam = String(req.query.types ?? "qstore,qlearn,qnews,qevents,qjobs,qright");
  const types = new Set(typesParam.split(",").map(t => t.trim()));

  let pool: any;
  try { pool = getPool(); } catch { return res.status(503).json({ error: "db_unavailable" }); }

  const searches: Promise<SearchResult[]>[] = [];
  if (types.has("qstore"))  searches.push(searchQStore(pool, q, limit));
  if (types.has("qlearn"))  searches.push(searchQLearn(pool, q, limit));
  if (types.has("qnews"))   searches.push(searchQNews(pool, q, limit));
  if (types.has("qevents")) searches.push(searchQEvents(pool, q, limit));
  if (types.has("qjobs"))   searches.push(searchQJobs(pool, q, limit));
  if (types.has("qright"))  searches.push(searchQRight(pool, q, limit));

  const results = await Promise.all(searches);
  const all = results.flat().sort((a, b) => b.score - a.score).slice(0, limit * 3);

  const byType: Record<string, SearchResult[]> = {};
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
searchRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "aevion-search", sources: ["qstore", "qlearn", "qnews", "qevents", "qjobs", "qright"] });
});
