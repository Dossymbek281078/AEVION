/**
 * Shared concept-board store for the MVP-board pattern used by 17 modules.
 * Single Postgres table aevion_concept_messages with module_id discriminator,
 * keyed by uuid. Falls back to per-module in-memory store (cap 200) when the
 * DB is unavailable or insert/select fails, so the surface keeps working in
 * dev or during a Railway DB blip.
 */

import crypto from "node:crypto";
import type { Request, Response, Router, RequestHandler } from "express";
import type pg from "pg";
import { getPool } from "./dbPool";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let _dbReady = false;
let _dbError: string | null = null;

export function isConceptBoardDbReady(): boolean { return _dbReady; }
export function getConceptBoardDbError(): string | null { return _dbError; }

export async function ensureConceptBoardTable(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
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
      CREATE INDEX IF NOT EXISTS idx_aevion_concept_module_created
        ON aevion_concept_messages (module_id, created_at DESC);
    `);
    _dbReady = true;
    ensured = true;
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "table init failed";
    console.warn(`[ConceptBoard] table init failed: ${_dbError}`);
  }
}

export interface ConceptMessage {
  id: string;
  payload: { idea: string; rationale: string; author: string };
  tags: string[];
  createdAt: string;
}

const MEM_MAX = 200;
const memStore = new Map<string, ConceptMessage[]>();

function memList(moduleId: string): ConceptMessage[] {
  return memStore.get(moduleId) ?? [];
}

export async function addMessage(
  moduleId: string,
  payload: { idea: string; rationale: string; author: string },
  tags: string[],
): Promise<ConceptMessage> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const msg: ConceptMessage = { id, payload, tags, createdAt };

  const pool = getPool();
  try {
    await ensureConceptBoardTable(pool);
    if (_dbReady) {
      await pool.query(
        `INSERT INTO aevion_concept_messages (id, module_id, idea, rationale, author, tags, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, moduleId, payload.idea, payload.rationale, payload.author, tags, createdAt],
      );
      return msg;
    }
  } catch (e: any) {
    console.warn(`[ConceptBoard] insert failed for ${moduleId}, falling back to memory: ${e?.message}`);
  }

  const list = memStore.get(moduleId) ?? [];
  list.unshift(msg);
  if (list.length > MEM_MAX) list.length = MEM_MAX;
  memStore.set(moduleId, list);
  return msg;
}

export async function getMessages(moduleId: string, limit: number): Promise<ConceptMessage[]> {
  const pool = getPool();
  try {
    await ensureConceptBoardTable(pool);
    if (_dbReady) {
      const { rows } = await pool.query(
        `SELECT id, idea, rationale, author, tags, created_at
         FROM aevion_concept_messages
         WHERE module_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [moduleId, limit],
      );
      return rows.map((r: any) => ({
        id: r.id,
        payload: { idea: r.idea, rationale: r.rationale, author: r.author },
        tags: Array.isArray(r.tags) ? r.tags : [],
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }));
    }
  } catch (e: any) {
    console.warn(`[ConceptBoard] select failed for ${moduleId}: ${e?.message}`);
  }
  return memList(moduleId).slice(0, limit);
}

export interface ConceptBoardStats {
  total: number;
  last7d: number;
  topTags: Array<{ tag: string; count: number }>;
}

export async function getStats(moduleId: string): Promise<ConceptBoardStats> {
  const pool = getPool();
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
        topTags: tagsRes.rows.map((r: any) => ({ tag: String(r.tag), count: r.count })),
      };
    }
  } catch (e: any) {
    console.warn(`[ConceptBoard] stats failed for ${moduleId}: ${e?.message}`);
  }
  const items = memList(moduleId);
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  const last7d = items.filter((m) => now - new Date(m.createdAt).getTime() <= sevenDays).length;
  const tagCounts = new Map<string, number>();
  for (const m of items) for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  return { total: items.length, last7d, topTags };
}

/**
 * Mounts /concept/messages GET+POST + /concept-stats on the given router.
 * The module's own /status endpoint stays in its route file (module-specific
 * description, endpoints map, etc).
 */
export function mountConceptBoard(opts: {
  router: Router;
  moduleId: string;
  defaultTag: string;
  readLimit?: RequestHandler;
  writeLimit?: RequestHandler;
}): void {
  const { router, moduleId, defaultTag } = opts;
  const reads: RequestHandler[] = opts.readLimit ? [opts.readLimit] : [];
  const writes: RequestHandler[] = opts.writeLimit ? [opts.writeLimit] : [];

  router.get("/concept/messages", ...reads, async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const [items, stats] = await Promise.all([getMessages(moduleId, limit), getStats(moduleId)]);
    res.json({ items, total: stats.total, moduleId, noun: "concept/messages" });
  });

  router.post("/concept/messages", ...writes, async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
      const payload = (body.payload && typeof body.payload === "object")
        ? body.payload as Record<string, unknown>
        : body;
      const idea = String(payload.idea ?? payload.title ?? "").trim().slice(0, 200);
      if (!idea) {
        res.status(400).json({ error: "missing_field", field: "idea" });
        return;
      }
      const rationale = String(payload.rationale ?? payload.summary ?? "").trim().slice(0, 800);
      const author = String(payload.author ?? "").trim().slice(0, 80);
      const tagsRaw = Array.isArray(payload.tags) ? payload.tags : [defaultTag];
      const tags = tagsRaw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6);
      const msg = await addMessage(moduleId, { idea, rationale, author }, tags.length ? tags : [defaultTag]);
      res.status(201).json(msg);
    } catch (err: unknown) {
      console.error(`[${moduleId}] concept_post_failed`, err instanceof Error ? err.message : err);
      res.status(500).json({ error: "concept_post_failed" });
    }
  });

  router.get("/concept-stats", ...reads, async (_req: Request, res: Response) => {
    const stats = await getStats(moduleId);
    res.json({ moduleId, noun: "concept/messages", ...stats });
  });
}
