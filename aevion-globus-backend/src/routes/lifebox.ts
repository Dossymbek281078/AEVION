/**
 * LifeBox — digital safe for your future self.
 *
 * Time-locked capsules with categories. Content is hidden until unlock_at.
 *
 * Endpoints:
 *   GET    /api/lifebox/health
 *   GET    /api/lifebox/categories
 *   GET    /api/lifebox/stats
 *   POST   /api/lifebox/capsules               — create new capsule
 *   GET    /api/lifebox/capsules/:alias        — list user's capsules
 *   GET    /api/lifebox/capsules/:id/unlock    — read content if unlocked
 *   PATCH  /api/lifebox/capsules/:id           — edit (only while locked)
 *   DELETE /api/lifebox/capsules/:id           — hard delete
 */

import { Router, type Request, type Response } from "express";
import { getPool } from "../lib/dbPool";
import {
  ensureLifeBoxTables,
  isLifeBoxDbReady,
  getLifeBoxDbError,
} from "../lib/ensureLifeBoxTables";
import { rateLimit } from "../lib/rateLimit";

export const lifeboxRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureLifeBoxTables(pool);
  } catch {
    // in-memory fallback active
  }
})();

// ─── Rate limiters ─────────────────────────────────────────────────────────────
const readLimit  = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "lifebox-read" });
const writeLimit = rateLimit({ windowMs: 60_000, max: 30,  keyPrefix: "lifebox-write" });

// ─── Types ────────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  "knowledge",
  "values",
  "instructions",
  "future_self",
  "advice",
] as const;

type Category = typeof VALID_CATEGORIES[number];

const CATEGORY_META: Record<Category, { label: string; emoji: string; description: string }> = {
  knowledge:    { label: "Знания",            emoji: "📚", description: "Уроки, идеи, инсайты, которые хочется сохранить." },
  values:       { label: "Ценности",          emoji: "🧭", description: "Принципы, по которым ты живёшь сегодня." },
  instructions: { label: "Инструкции",        emoji: "📜", description: "Конкретные шаги для будущих ситуаций." },
  future_self:  { label: "Будущему себе",     emoji: "💌", description: "Личное послание тебе через годы." },
  advice:       { label: "Совет",             emoji: "🗝", description: "Совет от прошлого тебя — для будущего." },
};

interface CapsuleRecord {
  id: number;
  alias: string;
  title: string;
  content: string;
  category: Category;
  unlock_at: string;
  created_at: string;
  unlocked_at: string | null;
}

// ─── In-memory fallback ────────────────────────────────────────────────────────
let _memSeq = 1;
const memCapsules: CapsuleRecord[] = [];

function memInsert(fields: Omit<CapsuleRecord, "id" | "created_at" | "unlocked_at">): CapsuleRecord {
  const record: CapsuleRecord = {
    id: _memSeq++,
    created_at: new Date().toISOString(),
    unlocked_at: null,
    ...fields,
  };
  memCapsules.push(record);
  return record;
}

function memListByAlias(alias: string): CapsuleRecord[] {
  return memCapsules
    .filter((c) => c.alias === alias)
    .sort((a, b) => a.unlock_at.localeCompare(b.unlock_at));
}

function memFindById(id: number): CapsuleRecord | undefined {
  return memCapsules.find((c) => c.id === id);
}

function memUpdate(id: number, patch: Partial<Pick<CapsuleRecord, "title" | "content" | "unlock_at">>): CapsuleRecord | undefined {
  const idx = memCapsules.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  memCapsules[idx] = { ...memCapsules[idx], ...patch };
  return memCapsules[idx];
}

function memDelete(id: number): boolean {
  const idx = memCapsules.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  memCapsules.splice(idx, 1);
  return true;
}

function memMarkUnlocked(id: number): void {
  const c = memCapsules.find((x) => x.id === id);
  if (c && !c.unlocked_at) c.unlocked_at = new Date().toISOString();
}

function memStats(): {
  total: number;
  byCategory: Record<string, number>;
  unlockedToday: number;
} {
  const byCategory: Record<string, number> = {};
  for (const c of memCapsules) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
  }
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  const endMs = startMs + 86_400_000;
  const unlockedToday = memCapsules.filter((c) => {
    const t = new Date(c.unlock_at).getTime();
    return t >= startMs && t < endMs;
  }).length;
  return { total: memCapsules.length, byCategory, unlockedToday };
}

// ─── DB helpers (NO pool.query<T>() — TS2347) ─────────────────────────────────
function rowToCapsule(row: any): CapsuleRecord {
  return {
    id:          Number(row.id),
    alias:       String(row.alias),
    title:       String(row.title),
    content:     String(row.content),
    category:    row.category as Category,
    unlock_at:   row.unlock_at instanceof Date
      ? row.unlock_at.toISOString()
      : String(row.unlock_at),
    created_at:  row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    unlocked_at: row.unlocked_at
      ? (row.unlocked_at instanceof Date
        ? row.unlocked_at.toISOString()
        : String(row.unlocked_at))
      : null,
  };
}

async function dbInsert(fields: Omit<CapsuleRecord, "id" | "created_at" | "unlocked_at">): Promise<CapsuleRecord> {
  const { rows } = await pool.query(
    `INSERT INTO lifebox_capsules (alias, title, content, category, unlock_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fields.alias, fields.title, fields.content, fields.category, fields.unlock_at]
  );
  return rowToCapsule(rows[0]);
}

async function dbListByAlias(alias: string): Promise<CapsuleRecord[]> {
  const { rows } = await pool.query(
    `SELECT * FROM lifebox_capsules WHERE alias = $1 ORDER BY unlock_at ASC LIMIT 500`,
    [alias]
  );
  return rows.map(rowToCapsule);
}

async function dbFindById(id: number): Promise<CapsuleRecord | undefined> {
  const { rows } = await pool.query(
    `SELECT * FROM lifebox_capsules WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToCapsule(rows[0]) : undefined;
}

async function dbUpdate(
  id: number,
  patch: Partial<Pick<CapsuleRecord, "title" | "content" | "unlock_at">>
): Promise<CapsuleRecord | undefined> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (patch.title !== undefined) { sets.push(`title = $${idx++}`);     vals.push(patch.title); }
  if (patch.content !== undefined) { sets.push(`content = $${idx++}`); vals.push(patch.content); }
  if (patch.unlock_at !== undefined) { sets.push(`unlock_at = $${idx++}`); vals.push(patch.unlock_at); }
  if (sets.length === 0) return dbFindById(id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE lifebox_capsules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCapsule(rows[0]) : undefined;
}

async function dbDelete(id: number): Promise<boolean> {
  const result: any = await pool.query(
    `DELETE FROM lifebox_capsules WHERE id = $1`,
    [id]
  );
  return (result?.rowCount ?? 0) > 0;
}

async function dbMarkUnlocked(id: number): Promise<void> {
  await pool.query(
    `UPDATE lifebox_capsules
       SET unlocked_at = NOW()
     WHERE id = $1 AND unlocked_at IS NULL`,
    [id]
  );
}

async function dbStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  unlockedToday: number;
}> {
  const { rows: totRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM lifebox_capsules`
  );
  const { rows: catRows } = await pool.query(
    `SELECT category, COUNT(*)::int AS cnt
       FROM lifebox_capsules
      GROUP BY category`
  );
  const { rows: todayRows } = await pool.query(
    `SELECT COUNT(*)::int AS today
       FROM lifebox_capsules
      WHERE unlock_at >= date_trunc('day', NOW())
        AND unlock_at <  date_trunc('day', NOW()) + INTERVAL '1 day'`
  );
  const byCategory: Record<string, number> = {};
  for (const r of catRows) byCategory[String(r.category)] = Number(r.cnt);
  return {
    total:         Number(totRows[0]?.total ?? 0),
    byCategory,
    unlockedToday: Number(todayRows[0]?.today ?? 0),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeAlias(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 64);
  if (!trimmed) return null;
  // alphanumeric + dash + underscore + dot only
  if (!/^[a-zA-Z0-9_.\-]+$/.test(trimmed)) return null;
  return trimmed;
}

function daysUntil(target: string | Date): number {
  const t = target instanceof Date ? target.getTime() : new Date(target).getTime();
  const diffMs = t - Date.now();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

function isUnlocked(c: CapsuleRecord): boolean {
  return new Date(c.unlock_at).getTime() <= Date.now();
}

/** Public view for a capsule. If still locked, strips content. */
function publicView(c: CapsuleRecord) {
  const unlocked = isUnlocked(c);
  return {
    id:           c.id,
    title:        c.title,
    category:     c.category,
    unlock_at:    c.unlock_at,
    created_at:   c.created_at,
    unlocked_at:  c.unlocked_at,
    locked:       !unlocked,
    daysUntilUnlock: unlocked ? 0 : daysUntil(c.unlock_at),
    content:      unlocked ? c.content : null,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/lifebox/health */
lifeboxRouter.get("/health", readLimit, (_req: Request, res: Response) => {
  res.json({
    ok:      true,
    module:  "lifebox",
    db:      isLifeBoxDbReady() ? "postgres" : "memory",
    dbError: getLifeBoxDbError(),
  });
});

/** GET /api/lifebox/categories — static list of 5 categories */
lifeboxRouter.get("/categories", readLimit, (_req: Request, res: Response) => {
  const categories = VALID_CATEGORIES.map((id) => ({
    id,
    ...CATEGORY_META[id],
  }));
  res.json({ ok: true, categories });
});

/** GET /api/lifebox/stats */
lifeboxRouter.get("/stats", readLimit, async (_req: Request, res: Response) => {
  try {
    const stats = isLifeBoxDbReady() ? await dbStats() : memStats();
    res.json({ ok: true, ...stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/lifebox/capsules */
lifeboxRouter.post("/capsules", writeLimit, async (req: Request, res: Response) => {
  try {
    const { alias, title, content, category, unlock_at } = req.body ?? {};

    const cleanAlias = sanitizeAlias(alias);
    if (!cleanAlias) {
      res.status(400).json({
        ok: false,
        error: "alias is required (alphanumeric, _, -, ., max 64 chars)",
      });
      return;
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ ok: false, error: "title is required" });
      return;
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ ok: false, error: "content is required" });
      return;
    }
    if (!category || !VALID_CATEGORIES.includes(category as Category)) {
      res.status(400).json({
        ok: false,
        error: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
      return;
    }
    if (!unlock_at) {
      res.status(400).json({ ok: false, error: "unlock_at is required" });
      return;
    }
    const unlockDate = new Date(unlock_at);
    if (isNaN(unlockDate.getTime())) {
      res.status(400).json({ ok: false, error: "unlock_at is not a valid date" });
      return;
    }
    if (unlockDate.getTime() <= Date.now()) {
      res.status(400).json({ ok: false, error: "unlock_at must be in the future" });
      return;
    }

    const fields: Omit<CapsuleRecord, "id" | "created_at" | "unlocked_at"> = {
      alias:     cleanAlias,
      title:     String(title).trim().slice(0, 200),
      content:   String(content).slice(0, 20_000),
      category:  category as Category,
      unlock_at: unlockDate.toISOString(),
    };

    const capsule = isLifeBoxDbReady() ? await dbInsert(fields) : memInsert(fields);

    // For the create response we deliberately mask content (capsule is locked).
    res.status(201).json({
      ok:      true,
      capsule: publicView(capsule),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/**
 * GET /api/lifebox/capsules/:alias
 * NB: declared BEFORE /capsules/:id/unlock so /:alias does not match numeric IDs.
 * We disambiguate by checking if param is numeric — if so, treat as not found
 * (callers should use /capsules/:id/unlock for numeric IDs).
 */
lifeboxRouter.get("/capsules/:alias", readLimit, async (req: Request, res: Response) => {
  try {
    const raw = String(req.params.alias ?? "");

    // If purely numeric, redirect to unlock-style call — but here just refuse
    // with a hint, since unlock requires `?alias=`.
    if (/^\d+$/.test(raw)) {
      res.status(400).json({
        ok: false,
        error: "use /capsules/:id/unlock?alias=... to fetch a single capsule by id",
      });
      return;
    }

    const cleanAlias = sanitizeAlias(raw);
    if (!cleanAlias) {
      res.status(400).json({ ok: false, error: "invalid alias" });
      return;
    }

    const capsules = isLifeBoxDbReady()
      ? await dbListByAlias(cleanAlias)
      : memListByAlias(cleanAlias);

    res.json({
      ok:       true,
      alias:    cleanAlias,
      count:    capsules.length,
      capsules: capsules.map((c) => publicView(c)),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/lifebox/capsules/:id/unlock?alias=... */
lifeboxRouter.get("/capsules/:id/unlock", readLimit, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "invalid id" });
      return;
    }
    const cleanAlias = sanitizeAlias(req.query.alias);
    if (!cleanAlias) {
      res.status(400).json({ ok: false, error: "alias query param is required" });
      return;
    }

    const capsule = isLifeBoxDbReady() ? await dbFindById(id) : memFindById(id);
    if (!capsule) {
      res.status(404).json({ ok: false, error: "capsule not found" });
      return;
    }
    if (capsule.alias !== cleanAlias) {
      res.status(403).json({ ok: false, error: "alias does not match" });
      return;
    }

    if (!isUnlocked(capsule)) {
      res.status(403).json({
        ok:    false,
        error: "capsule is still locked",
        capsule: publicView(capsule),
        daysUntilUnlock: daysUntil(capsule.unlock_at),
      });
      return;
    }

    // Mark unlocked on first read.
    if (!capsule.unlocked_at) {
      if (isLifeBoxDbReady()) {
        try { await dbMarkUnlocked(id); } catch { /* non-fatal */ }
      } else {
        memMarkUnlocked(id);
      }
    }

    res.json({
      ok: true,
      capsule: {
        id:          capsule.id,
        title:       capsule.title,
        content:     capsule.content,
        category:    capsule.category,
        unlock_at:   capsule.unlock_at,
        created_at:  capsule.created_at,
        unlocked_at: capsule.unlocked_at ?? new Date().toISOString(),
        locked:      false,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** PATCH /api/lifebox/capsules/:id — only allowed while still locked */
lifeboxRouter.patch("/capsules/:id", writeLimit, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "invalid id" });
      return;
    }
    const { alias, title, content, unlock_at } = req.body ?? {};
    const cleanAlias = sanitizeAlias(alias);
    if (!cleanAlias) {
      res.status(400).json({ ok: false, error: "alias is required in body" });
      return;
    }

    const capsule = isLifeBoxDbReady() ? await dbFindById(id) : memFindById(id);
    if (!capsule) {
      res.status(404).json({ ok: false, error: "capsule not found" });
      return;
    }
    if (capsule.alias !== cleanAlias) {
      res.status(403).json({ ok: false, error: "alias does not match" });
      return;
    }
    if (isUnlocked(capsule)) {
      res.status(403).json({
        ok: false,
        error: "capsule already unlocked — cannot edit",
      });
      return;
    }

    const patch: Partial<Pick<CapsuleRecord, "title" | "content" | "unlock_at">> = {};
    if (typeof title === "string" && title.trim()) {
      patch.title = title.trim().slice(0, 200);
    }
    if (typeof content === "string" && content.trim()) {
      patch.content = content.slice(0, 20_000);
    }
    if (unlock_at !== undefined) {
      const d = new Date(unlock_at);
      if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        res.status(400).json({ ok: false, error: "unlock_at must be a future date" });
        return;
      }
      patch.unlock_at = d.toISOString();
    }

    const updated = isLifeBoxDbReady()
      ? await dbUpdate(id, patch)
      : memUpdate(id, patch);

    if (!updated) {
      res.status(404).json({ ok: false, error: "capsule not found after update" });
      return;
    }

    res.json({ ok: true, capsule: publicView(updated) });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** DELETE /api/lifebox/capsules/:id — hard delete; alias must match */
lifeboxRouter.delete("/capsules/:id", writeLimit, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "invalid id" });
      return;
    }
    const cleanAlias = sanitizeAlias(req.query.alias ?? req.body?.alias);
    if (!cleanAlias) {
      res.status(400).json({ ok: false, error: "alias is required (query or body)" });
      return;
    }

    const capsule = isLifeBoxDbReady() ? await dbFindById(id) : memFindById(id);
    if (!capsule) {
      res.status(404).json({ ok: false, error: "capsule not found" });
      return;
    }
    if (capsule.alias !== cleanAlias) {
      res.status(403).json({ ok: false, error: "alias does not match" });
      return;
    }

    const ok = isLifeBoxDbReady() ? await dbDelete(id) : memDelete(id);
    res.json({ ok, deletedId: id });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});
