/**
 * Planet — Constitution artifacts (Postgres + in-memory cache).
 *
 * Storage: `planet_constitution_artifacts` table (created lazily via
 * ensureConstitutionTable). In-memory ring buffer (200) acts as a read
 * cache so list-latest is hot without hitting Postgres on every request.
 *
 *   POST /api/planet/constitution-artifacts  — publish a signed snapshot
 *   GET  /api/planet/constitution-artifacts  — list, supports
 *                                                 ?limit, ?regime, ?sort
 *   GET  /api/planet/constitution-artifacts/:id — fetch one
 *   GET  /api/planet/constitution-artifacts/stats — aggregates
 *
 * Falls back to in-memory ring if Postgres unavailable. Marked with
 * { storage: "postgres" | "memory" } in response so consumers can tell.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { resolvePlan, checkSaveLimit, FREE_SAVE_LIMIT } from "../lib/constitutionGate";
import { makeServiceCapture } from "../lib/sentry/platform";
import { queryNumber } from "../lib/queryNumber";

const capture = makeServiceCapture("planetConstitution");

const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");

// Free-tier publish counter for the in-memory fallback (DB-down) path. The
// DB COUNT is the source of truth when Postgres is up; this keeps the gate
// roughly working in degraded mode. Keyed by lowercased owner email.
const memOwnerCounts = new Map<string, number>();

type ArtifactPayload = {
  title?: string;
  regime?: { id?: string; name?: string; era?: string };
  sliders?: Record<string, number>;
  metrics?: Record<string, number>;
  issuedAt?: string;
};

type Artifact = {
  id: string;
  title: string;
  regimeId: string;
  regimeName: string;
  algo: string;
  signature: string;
  signedAt: string;
  publishedAt: string;
  payload: ArtifactPayload;
};

const MAX_CACHE = 200;
const ring: Artifact[] = [];
let tableReady = false;
let dbAvailable = false;

async function ensureConstitutionTable(): Promise<void> {
  if (tableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planet_constitution_artifacts (
        "id"           UUID PRIMARY KEY,
        "title"        TEXT NOT NULL,
        "regimeId"     TEXT NOT NULL,
        "regimeName"   TEXT NOT NULL,
        "algo"         TEXT NOT NULL DEFAULT 'HMAC-SHA256',
        "signature"    TEXT NOT NULL,
        "signedAt"     TIMESTAMPTZ NOT NULL,
        "publishedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "payload"      JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_published
        ON planet_constitution_artifacts ("publishedAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_constitution_regime
        ON planet_constitution_artifacts ("regimeId", "publishedAt" DESC);
      ALTER TABLE planet_constitution_artifacts
        ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT;
      CREATE INDEX IF NOT EXISTS idx_constitution_owner
        ON planet_constitution_artifacts ("ownerEmail");
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tableReady = true;
}

function rowToArtifact(row: Record<string, unknown>): Artifact {
  return {
    id: String(row.id),
    title: String(row.title),
    regimeId: String(row.regimeId),
    regimeName: String(row.regimeName),
    algo: String(row.algo),
    signature: String(row.signature),
    signedAt:
      row.signedAt instanceof Date
        ? row.signedAt.toISOString()
        : String(row.signedAt),
    publishedAt:
      row.publishedAt instanceof Date
        ? row.publishedAt.toISOString()
        : String(row.publishedAt),
    payload: (row.payload as ArtifactPayload) ?? {},
  };
}

function cachePush(a: Artifact): void {
  ring.unshift(a);
  if (ring.length > MAX_CACHE) ring.length = MAX_CACHE;
}

/**
 * How many artifacts this owner email has already published. DB COUNT is
 * authoritative; falls back to the in-memory counter when Postgres is down.
 * Never reads into a public response — owner email stays server-side.
 */
async function countOwnerArtifacts(email: string): Promise<number> {
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT COUNT(*)::int AS n FROM planet_constitution_artifacts WHERE "ownerEmail" = $1`,
        [email],
      );
      return Number(r.rows[0]?.n ?? 0);
    } catch (e) {
      // Поведение прежнее — падаем на счётчик в памяти, иначе сбой базы
      // закрыл бы публикацию всем. Но молчать нельзя: память после выкатки
      // пуста, а значит предел бесплатного тарифа тихо СНИМАЕТСЯ — снаружи
      // это неотличимо от человека, который ещё ничего не публиковал.
      console.warn(
        `[planet/constitution] счёт публикаций не прочитан из базы, считаем в ` +
        `памяти (предел бесплатного тарифа мог сняться): ${(e as Error)?.message ?? e}`,
      );
    }
  }
  return memOwnerCounts.get(email) ?? 0;
}

export const planetConstitutionRouter = Router();

const writeLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "planet-constitution-write",
});
const readLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "planet-constitution-read",
});

planetConstitutionRouter.post(
  "/",
  writeLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const envelope = body.envelope ?? body;
      const e = envelope as Record<string, unknown>;
      const signature = typeof e.signature === "string" ? e.signature : null;
      const algo = typeof e.algo === "string" ? e.algo : "HMAC-SHA256";
      const signedAt = typeof e.signedAt === "string"
        ? e.signedAt
        : new Date().toISOString();
      const payload = (e.payload && typeof e.payload === "object")
        ? (e.payload as ArtifactPayload)
        : null;
      if (!signature) return res.status(400).json({ error: "missing_signature" });
      if (!payload) return res.status(400).json({ error: "missing_payload" });

      // Free-tier publish cap (Pro = unlimited). Enforced per owner email;
      // anonymous publishes (no JWT) keep the prior open behaviour since they
      // can't be attributed across sessions.
      const { plan, email } = resolvePlan(req);
      if (plan === "free" && email) {
        const used = await countOwnerArtifacts(email);
        if (!checkSaveLimit(plan, used).allowed) {
          return res.status(402).json({
            error: "free_save_limit",
            plan: "free",
            limit: FREE_SAVE_LIMIT,
            used,
            upgradeUrl: `${PUBLIC_BASE}/constitution/pricing`,
            message: `Free-тариф: до ${FREE_SAVE_LIMIT} опубликованных конституций. Upgrade → Pro для безлимита.`,
          });
        }
      }

      const title = typeof payload.title === "string" && payload.title
        ? payload.title.slice(0, 160)
        : "untitled-constitution";
      const regimeName = payload.regime?.name ?? "Unknown";
      const regimeId = payload.regime?.id ?? "unknown";
      const artifact: Artifact = {
        id: randomUUID(),
        title,
        regimeId,
        regimeName,
        algo,
        signature,
        signedAt,
        publishedAt: new Date().toISOString(),
        payload,
      };

      await ensureConstitutionTable();
      let storage: "postgres" | "memory" = "memory";
      if (dbAvailable) {
        try {
          const pool = getPool();
          await pool.query(
            `INSERT INTO planet_constitution_artifacts
               ("id","title","regimeId","regimeName","algo","signature","signedAt","publishedAt","payload","ownerEmail")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
            [
              artifact.id,
              artifact.title,
              artifact.regimeId,
              artifact.regimeName,
              artifact.algo,
              artifact.signature,
              artifact.signedAt,
              artifact.publishedAt,
              JSON.stringify(artifact.payload),
              email ?? null,
            ],
          );
          storage = "postgres";
        } catch {
          storage = "memory";
        }
      }
      cachePush(artifact);
      if (email) memOwnerCounts.set(email, (memOwnerCounts.get(email) ?? 0) + 1);

      res.status(201).json({
        artifact,
        publicUrl: `/constitution?artifact=${artifact.id}`,
        storage,
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "publish_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionRouter.get(
  "/",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(100, queryNumber(req.query.limit, 20)));
      const regime = typeof req.query.regime === "string" ? req.query.regime : null;
      const sort = req.query.sort === "popular" ? "popular" : "recent";

      await ensureConstitutionTable();
      if (dbAvailable) {
        try {
          const pool = getPool();
          const filters: string[] = [];
          const params: unknown[] = [];
          if (regime) {
            params.push(regime);
            filters.push(`"regimeId" = $${params.length}`);
          }
          const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
          const order =
            sort === "popular"
              ? `ORDER BY "regimeId", "publishedAt" DESC`
              : `ORDER BY "publishedAt" DESC`;
          params.push(limit);
          const r = await pool.query(
            `SELECT "id","title","regimeId","regimeName","signedAt","publishedAt"
             FROM planet_constitution_artifacts
             ${where} ${order} LIMIT $${params.length}`,
            params,
          );
          const tot = await pool.query(
            `SELECT COUNT(*)::int AS n FROM planet_constitution_artifacts ${where}`,
            regime ? [regime] : [],
          );
          return res.json({
            items: r.rows,
            total: tot.rows[0]?.n ?? r.rowCount,
            storage: "postgres",
            sort,
            regime,
          });
        } catch {
          /* fall through to memory */
        }
      }
      const filtered = regime
        ? ring.filter((a) => a.regimeId === regime)
        : ring;
      const items = filtered.slice(0, limit).map((a) => ({
        id: a.id,
        title: a.title,
        regimeId: a.regimeId,
        regimeName: a.regimeName,
        signedAt: a.signedAt,
        publishedAt: a.publishedAt,
      }));
      res.json({
        items,
        total: filtered.length,
        storage: "memory",
        sort,
        regime,
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "list_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionRouter.get(
  "/stats",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (_req: Request, res: Response) => {
    try {
      await ensureConstitutionTable();
      if (dbAvailable) {
        try {
          const pool = getPool();
          const totalQ = await pool.query(
            `SELECT COUNT(*)::int AS n FROM planet_constitution_artifacts`,
          );
          const byRegimeQ = await pool.query(
            `SELECT "regimeId" AS id, "regimeName" AS name, COUNT(*)::int AS n
             FROM planet_constitution_artifacts
             GROUP BY "regimeId","regimeName"
             ORDER BY n DESC`,
          );
          const dailyQ = await pool.query(
            `SELECT
               to_char(date_trunc('day', "publishedAt"), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS n
             FROM planet_constitution_artifacts
             WHERE "publishedAt" > NOW() - INTERVAL '30 days'
             GROUP BY day
             ORDER BY day ASC`,
          );
          // Slider means and histograms: pull payloads and aggregate in JS
          // (would be heavy as SQL for 8 fields × 5 buckets; <2K rows OK)
          const payloadsQ = await pool.query(
            `SELECT "payload"->>'sliders' AS s
             FROM planet_constitution_artifacts
             WHERE "payload" ? 'sliders'
             ORDER BY "publishedAt" DESC
             LIMIT 2000`,
          );
          return res.json({
            total: totalQ.rows[0]?.n ?? 0,
            byRegime: byRegimeQ.rows,
            daily: dailyQ.rows,
            sliders: aggregateSliders(payloadsQ.rows),
            storage: "postgres",
          });
        } catch {
          /* fall through */
        }
      }
      const total = ring.length;
      const counts = new Map<string, { name: string; n: number }>();
      for (const a of ring) {
        const k = a.regimeId;
        const cur = counts.get(k);
        if (cur) cur.n += 1;
        else counts.set(k, { name: a.regimeName, n: 1 });
      }
      const byRegime = Array.from(counts.entries()).map(([id, v]) => ({
        id,
        name: v.name,
        n: v.n,
      }));
      byRegime.sort((a, b) => b.n - a.n);
      return res.json({
        total,
        byRegime,
        daily: [],
        sliders: aggregateSliders(
          ring.map((a) => ({ s: JSON.stringify(a.payload?.sliders ?? {}) })),
        ),
        storage: "memory",
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "stats_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionRouter.get(
  "/:id/similar",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const limit = Math.max(1, Math.min(20, queryNumber(req.query.limit, 6)));

      // Get the source artifact's sliders
      let source: Artifact | null = ring.find((x) => x.id === id) ?? null;
      await ensureConstitutionTable();
      if (!source && dbAvailable) {
        try {
          const pool = getPool();
          const r = await pool.query(
            `SELECT * FROM planet_constitution_artifacts WHERE "id" = $1`,
            [id],
          );
          if (r.rowCount > 0) source = rowToArtifact(r.rows[0]);
        } catch {
          /* fall through */
        }
      }
      if (!source) return res.status(404).json({ error: "not_found" });
      const srcSliders = source.payload?.sliders;
      if (!srcSliders || typeof srcSliders !== "object") {
        return res.status(400).json({ error: "source_missing_sliders" });
      }

      // Candidate pool: latest 200 from DB (or ring fallback)
      let pool_: Artifact[] = [];
      if (dbAvailable) {
        try {
          const pool = getPool();
          const r = await pool.query(
            `SELECT * FROM planet_constitution_artifacts
             WHERE "id" != $1
             ORDER BY "publishedAt" DESC
             LIMIT 200`,
            [id],
          );
          pool_ = r.rows.map(rowToArtifact);
        } catch {
          pool_ = ring.filter((a) => a.id !== id);
        }
      } else {
        pool_ = ring.filter((a) => a.id !== id);
      }

      const SLIDER_KEYS = [
        "floor", "ruleOfLaw", "rotation", "transparency",
        "multiStatus", "skinInGame", "polycentricity", "positiveSum",
      ] as const;
      const srcVec = SLIDER_KEYS.map((k) => Number(srcSliders[k]) || 0);
      const srcMag = Math.sqrt(srcVec.reduce((s, v) => s + v * v, 0));

      const scored = [];
      for (const a of pool_) {
        const s = a.payload?.sliders;
        if (!s) continue;
        const vec = SLIDER_KEYS.map((k) => Number(s[k]) || 0);
        const mag = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
        if (mag === 0 || srcMag === 0) continue;
        const dot = vec.reduce((acc, v, i) => acc + v * srcVec[i], 0);
        const sim = dot / (mag * srcMag); // 0..1
        // Also compute euclidean distance for intuition ("how far")
        const dist = Math.sqrt(
          vec.reduce((acc, v, i) => acc + (v - srcVec[i]) ** 2, 0),
        );
        scored.push({ artifact: a, sim, dist });
      }
      scored.sort((a, b) => b.sim - a.sim);
      const top = scored.slice(0, limit).map((s) => ({
        id: s.artifact.id,
        title: s.artifact.title,
        regimeId: s.artifact.regimeId,
        regimeName: s.artifact.regimeName,
        publishedAt: s.artifact.publishedAt,
        similarity: Math.round(s.sim * 1000) / 1000,
        euclideanDistance: Math.round(s.dist),
        sliders: s.artifact.payload?.sliders ?? null,
      }));
      res.json({
        source: { id, title: source.title },
        total: scored.length,
        items: top,
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "similar_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionRouter.get(
  "/:id",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const hit = ring.find((x) => x.id === id);
      if (hit) return res.json(hit);

      await ensureConstitutionTable();
      if (dbAvailable) {
        try {
          const pool = getPool();
          const r = await pool.query(
            `SELECT * FROM planet_constitution_artifacts WHERE "id" = $1`,
            [id],
          );
          if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
          const artifact = rowToArtifact(r.rows[0]);
          cachePush(artifact);
          return res.json(artifact);
        } catch {
          /* fall through */
        }
      }
      return res.status(404).json({ error: "not_found" });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "get_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

const SLIDER_KEYS = [
  "floor",
  "ruleOfLaw",
  "rotation",
  "transparency",
  "multiStatus",
  "skinInGame",
  "polycentricity",
  "positiveSum",
] as const;

type SliderAgg = {
  key: string;
  mean: number;
  histogram: number[]; // 5 buckets: 0-19, 20-39, 40-59, 60-79, 80-100
};

function aggregateSliders(rows: Array<{ s: string | null }>): SliderAgg[] {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const hist: Record<string, number[]> = {};
  for (const k of SLIDER_KEYS) {
    sums[k] = 0;
    counts[k] = 0;
    hist[k] = [0, 0, 0, 0, 0];
  }
  for (const row of rows) {
    if (!row.s) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(row.s) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const k of SLIDER_KEYS) {
      const v = obj[k];
      if (typeof v === "number" && v >= 0 && v <= 100) {
        sums[k] += v;
        counts[k] += 1;
        const bucket = Math.min(4, Math.floor(v / 20));
        hist[k][bucket] += 1;
      }
    }
  }
  return SLIDER_KEYS.map((k) => ({
    key: k,
    mean: counts[k] > 0 ? Math.round(sums[k] / counts[k]) : 0,
    histogram: hist[k],
  }));
}
