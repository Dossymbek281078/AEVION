/**
 * Generic item store for landing-to-MVP module concept routers.
 *
 * Most ownerless AEVION modules (kids-ai-content, startup-exchange, qlife,
 * mapreality, voice-of-earth, shadownet, lifebox, deepsan, qpersona,
 * psyapp-deps) are at the "landing + waitlist" stage. To move them to a
 * minimum-viable concept demo they each need a tiny CRUD surface that
 * stores module-specific items (a startup listing, a geo claim, a prompt,
 * an anonymous post, etc.).
 *
 * Rather than ship 10 nearly-identical routers, this helper provides a
 * single shared table `module_concept_items` and primitives:
 *   - createItem            store one item with a JSONB payload
 *   - listItems             paginated with optional owner/tag filter
 *   - getItem               single fetch by id
 *   - statsFor              count + 7-day rolling + topTags
 *   - searchByPayloadField  exact match on a JSONB field
 *   - searchByDistance      geo radius (lat/lng in payload)
 *
 * Per-module routers add concept-specific validation + transformations on
 * top of these primitives. They MUST NOT bypass them.
 */

import { randomUUID } from "node:crypto";
import { getPool } from "./dbPool";

let tablesReady = false;
let dbAvailable = false;

export async function ensureMvpTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS module_concept_items (
        "id"          TEXT PRIMARY KEY,
        "moduleId"    TEXT NOT NULL,
        "ownerId"     TEXT,
        "title"       TEXT NOT NULL,
        "summary"     TEXT,
        "payload"     JSONB NOT NULL DEFAULT '{}'::jsonb,
        "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_module_concept_items_module_created
        ON module_concept_items ("moduleId", "createdAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_module_concept_items_tags
        ON module_concept_items USING GIN ("tags");
      CREATE INDEX IF NOT EXISTS idx_module_concept_items_owner
        ON module_concept_items ("moduleId", "ownerId", "createdAt" DESC)
        WHERE "ownerId" IS NOT NULL;
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tablesReady = true;
}

export type MvpItem = {
  id: string;
  moduleId: string;
  ownerId: string | null;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
};

const memoryStore: Map<string, MvpItem[]> = new Map();

function pushMem(item: MvpItem): void {
  const arr = memoryStore.get(item.moduleId) ?? [];
  arr.unshift(item);
  memoryStore.set(item.moduleId, arr);
}

export type CreateItemInput = {
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown>;
  tags?: string[];
  ownerId?: string | null;
};

export async function createItem(moduleId: string, input: CreateItemInput): Promise<MvpItem> {
  await ensureMvpTables();
  const item: MvpItem = {
    id: randomUUID(),
    moduleId,
    ownerId: input.ownerId ?? null,
    title: String(input.title).slice(0, 200),
    summary: input.summary ? String(input.summary).slice(0, 800) : null,
    payload: (input.payload && typeof input.payload === "object") ? input.payload : {},
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 10).map((t) => String(t).slice(0, 40)) : [],
    createdAt: new Date().toISOString(),
  };
  if (dbAvailable) {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO module_concept_items
           ("id","moduleId","ownerId","title","summary","payload","tags","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
        [item.id, item.moduleId, item.ownerId, item.title, item.summary,
         JSON.stringify(item.payload), item.tags, item.createdAt],
      );
      return item;
    } catch {
      // fall through to memory store
    }
  }
  pushMem(item);
  return item;
}

export type ListItemsOpts = {
  limit?: number;
  offset?: number;
  ownerId?: string | null;
  tag?: string | null;
};

export async function listItems(moduleId: string, opts: ListItemsOpts = {}): Promise<{ items: MvpItem[]; total: number }> {
  await ensureMvpTables();
  const limit = Math.max(1, Math.min(100, Number(opts.limit ?? 20)));
  const offset = Math.max(0, Number(opts.offset ?? 0));
  if (dbAvailable) {
    try {
      const pool = getPool();
      const filters: string[] = [`"moduleId" = $1`];
      const params: unknown[] = [moduleId];
      if (opts.ownerId) { filters.push(`"ownerId" = $${params.length + 1}`); params.push(opts.ownerId); }
      if (opts.tag)     { filters.push(`$${params.length + 1} = ANY("tags")`); params.push(opts.tag); }
      const where = `WHERE ${filters.join(" AND ")}`;
      const tot = await pool.query(`SELECT COUNT(*)::int AS n FROM module_concept_items ${where}`, params);
      params.push(limit); params.push(offset);
      const rows = await pool.query(
        `SELECT * FROM module_concept_items ${where}
         ORDER BY "createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      return {
        items: rows.rows.map((r: Record<string, unknown>) => ({
          ...(r as unknown as MvpItem),
          payload: typeof r.payload === "string" ? JSON.parse(r.payload as string) : ((r.payload as Record<string, unknown>) ?? {}),
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        })),
        total: tot.rows[0]?.n ?? 0,
      };
    } catch {
      // fall through to memory store
    }
  }
  let arr = memoryStore.get(moduleId) ?? [];
  if (opts.ownerId) arr = arr.filter((i) => i.ownerId === opts.ownerId);
  if (opts.tag) arr = arr.filter((i) => i.tags.includes(opts.tag as string));
  return { items: arr.slice(offset, offset + limit), total: arr.length };
}

export async function searchByPayloadField(
  moduleId: string, field: string, value: string, limit = 20,
): Promise<MvpItem[]> {
  await ensureMvpTables();
  const safeField = String(field).replace(/[^a-zA-Z0-9_]/g, "");
  if (!safeField) return [];
  const cap = Math.max(1, Math.min(100, Number(limit)));
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT * FROM module_concept_items
          WHERE "moduleId" = $1 AND payload->>'${safeField}' = $2
          ORDER BY "createdAt" DESC LIMIT $3`,
        [moduleId, String(value), cap],
      );
      return r.rows.map((row: Record<string, unknown>) => ({
        ...(row as unknown as MvpItem),
        payload: typeof row.payload === "string" ? JSON.parse(row.payload as string) : ((row.payload as Record<string, unknown>) ?? {}),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      }));
    } catch {
      // fall through to memory store
    }
  }
  const arr = memoryStore.get(moduleId) ?? [];
  return arr.filter((i) => String(i.payload[safeField] ?? "") === String(value)).slice(0, cap);
}

export async function searchByDistance(
  moduleId: string, lat: number, lng: number, radiusKm: number, limit = 20,
): Promise<(MvpItem & { distanceKm: number })[]> {
  await ensureMvpTables();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(radiusKm > 0)) return [];
  const cap = Math.max(1, Math.min(100, Number(limit)));
  const degLat = radiusKm / 111.0;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const degLng = radiusKm / (111.0 * Math.abs(cosLat));
  const haversine = (lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat) * Math.PI) / 180;
    const dLng = ((lng2 - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  };
  let candidates: MvpItem[] = [];
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT * FROM module_concept_items
          WHERE "moduleId" = $1
            AND payload ? 'lat' AND payload ? 'lng'
            AND (payload->>'lat')::float BETWEEN $2 AND $3
            AND (payload->>'lng')::float BETWEEN $4 AND $5
          ORDER BY "createdAt" DESC LIMIT 500`,
        [moduleId, lat - degLat, lat + degLat, lng - degLng, lng + degLng],
      );
      candidates = r.rows.map((row: Record<string, unknown>) => ({
        ...(row as unknown as MvpItem),
        payload: typeof row.payload === "string" ? JSON.parse(row.payload as string) : ((row.payload as Record<string, unknown>) ?? {}),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      }));
    } catch {
      // fall through to memory store
    }
  }
  if (candidates.length === 0) {
    candidates = (memoryStore.get(moduleId) ?? []).filter((i) =>
      typeof i.payload.lat === "number" && typeof i.payload.lng === "number");
  }
  return candidates
    .map((i) => {
      const pLat = Number(i.payload.lat);
      const pLng = Number(i.payload.lng);
      return Number.isFinite(pLat) && Number.isFinite(pLng)
        ? { ...i, distanceKm: haversine(pLat, pLng) } : null;
    })
    .filter((x): x is MvpItem & { distanceKm: number } => x !== null && x.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, cap);
}

export async function getItem(moduleId: string, id: string): Promise<MvpItem | null> {
  await ensureMvpTables();
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT * FROM module_concept_items WHERE "moduleId" = $1 AND "id" = $2`,
        [moduleId, id],
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      return {
        ...row,
        payload: typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload ?? {}),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      };
    } catch {
      // fall through
    }
  }
  const arr = memoryStore.get(moduleId) ?? [];
  return arr.find((i) => i.id === id) ?? null;
}

export type ModuleStats = {
  total: number;
  last7days: number;
  topTags: { tag: string; count: number }[];
};

export async function statsFor(moduleId: string): Promise<ModuleStats> {
  await ensureMvpTables();
  if (dbAvailable) {
    try {
      const pool = getPool();
      const t = await pool.query(
        `SELECT COUNT(*)::int AS n FROM module_concept_items WHERE "moduleId" = $1`,
        [moduleId],
      );
      const w = await pool.query(
        `SELECT COUNT(*)::int AS n FROM module_concept_items
          WHERE "moduleId" = $1 AND "createdAt" >= NOW() - INTERVAL '7 days'`,
        [moduleId],
      );
      const tg = await pool.query(
        `SELECT tag, COUNT(*)::int AS c
           FROM module_concept_items, UNNEST(tags) AS tag
          WHERE "moduleId" = $1
          GROUP BY tag ORDER BY c DESC LIMIT 5`,
        [moduleId],
      );
      return {
        total: t.rows[0]?.n ?? 0,
        last7days: w.rows[0]?.n ?? 0,
        topTags: tg.rows.map((r: Record<string, unknown>) => ({ tag: String(r.tag), count: Number(r.c) })),
      };
    } catch {
      // fall through
    }
  }
  const arr = memoryStore.get(moduleId) ?? [];
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const last7 = arr.filter((i) => new Date(i.createdAt).getTime() >= cutoff).length;
  const tagCounts = new Map<string, number>();
  for (const i of arr) for (const t of i.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  return { total: arr.length, last7days: last7, topTags };
}
