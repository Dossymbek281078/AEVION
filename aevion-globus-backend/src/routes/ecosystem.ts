import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import { getPool } from "../lib/dbPool";
import { projects } from "../data/projects";
import { enrichProjects, MODULE_RUNTIME } from "../data/moduleRuntime";
import {
  describeBackend,
  loadSnapshot,
  persistSnapshot,
} from "../lib/ecosystemStore";
import type {
  ChessPrize,
  PlanetCert,
  RoyaltyEvent,
} from "./ecosystem.types";

export type { ChessPrize, PlanetCert, RoyaltyEvent };

function sendCsv(
  res: Response,
  baseName: string,
  rows: (string | number | null | undefined)[][],
): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csvFromRows(rows));
}

export const ecosystemRouter = Router();

ecosystemRouter.use(requireAuth);

// ----------------------------------------------------------------------------
// Persisted ecosystem ledger.
//
// Three separate ledgers, all keyed by user email. The storage backend is
// chosen at runtime by src/lib/ecosystemStore.ts:
//   - Postgres (when DATABASE_URL is set) — append-only tables in
//     ecosystem_royalty_events / ecosystem_chess_prizes / ecosystem_planet_certs.
//   - JSON file (.aevion-data/ecosystem.json) — dev/test fallback.
//
// In-memory arrays keep being a write-through cache for read latency; routes
// mutate them and call scheduleEcosystemPersist() to flush asynchronously.
// ----------------------------------------------------------------------------

export const royaltyEvents: RoyaltyEvent[] = [];
export const chessPrizes: ChessPrize[] = [];
export const planetCerts: PlanetCert[] = [];

export function getEcosystemMetrics(): {
  royaltyEvents: number;
  chessPrizes: number;
  planetCerts: number;
  backend: "postgres" | "json";
} {
  return {
    royaltyEvents: royaltyEvents.length,
    chessPrizes: chessPrizes.length,
    planetCerts: planetCerts.length,
    backend: describeBackend().kind,
  };
}

let loaded = false;
let loading: Promise<void> | null = null;

export async function ensureEcosystemLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      const snap = await loadSnapshot();
      royaltyEvents.splice(0, royaltyEvents.length, ...snap.royaltyEvents);
      chessPrizes.splice(0, chessPrizes.length, ...snap.chessPrizes);
      planetCerts.splice(0, planetCerts.length, ...snap.planetCerts);
      loaded = true;
    })();
  }
  await loading;
}

let persistChain: Promise<void> = Promise.resolve();

export function scheduleEcosystemPersist(): void {
  const snapshot = {
    royaltyEvents: [...royaltyEvents],
    chessPrizes: [...chessPrizes],
    planetCerts: [...planetCerts],
  };
  persistChain = persistChain
    .then(() => persistSnapshot(snapshot))
    .catch((err) => {
      console.error("[ecosystem] persist failed", err);
    });
}

ecosystemRouter.use((_req, _res, next) => {
  ensureEcosystemLoaded()
    .then(() => next())
    .catch(next);
});

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

ecosystemRouter.get("/earnings", (req, res) => {
  const email = ownerEmail(req);
  const r = royaltyEvents.filter((x) => x.email === email);
  const c = chessPrizes.filter((x) => x.email === email);
  const p = planetCerts.filter((x) => x.email === email);

  const sumR = r.reduce((s, x) => s + x.amount, 0);
  const sumC = c.reduce((s, x) => s + x.amount, 0);
  const sumP = p.reduce((s, x) => s + x.amount, 0);

  res.json({
    totals: {
      qright: Math.round(sumR * 100) / 100,
      cyberchess: Math.round(sumC * 100) / 100,
      planet: Math.round(sumP * 100) / 100,
      all: Math.round((sumR + sumC + sumP) * 100) / 100,
    },
    perSource: [
      { source: "qright", amount: sumR, count: r.length, last: r[r.length - 1]?.paidAt ?? null },
      { source: "cyberchess", amount: sumC, count: c.length, last: c[c.length - 1]?.finalizedAt ?? null },
      { source: "planet", amount: sumP, count: p.length, last: p[p.length - 1]?.certifiedAt ?? null },
    ],
  });
});

ecosystemRouter.get("/earnings.csv", (req, res) => {
  const email = ownerEmail(req);
  const r = royaltyEvents.filter((x) => x.email === email);
  const c = chessPrizes.filter((x) => x.email === email);
  const p = planetCerts.filter((x) => x.email === email);
  const round = (n: number) => Math.round(n * 100) / 100;
  const rows: (string | number | null | undefined)[][] = [
    ["source", "amount_aec", "event_count", "last_at"],
    ["qright", round(r.reduce((s, x) => s + x.amount, 0)), r.length, r[r.length - 1]?.paidAt ?? null],
    ["cyberchess", round(c.reduce((s, x) => s + x.amount, 0)), c.length, c[c.length - 1]?.finalizedAt ?? null],
    ["planet", round(p.reduce((s, x) => s + x.amount, 0)), p.length, p[p.length - 1]?.certifiedAt ?? null],
  ];
  sendCsv(res, "ecosystem-earnings", rows);
});

// ───────────────────────────────────────────────────────────────────────────
// FEATURE 1 — Cross-module activity feed
//
// Single GET that fans out across qsocial / qmedia / qnews / qright / planet
// and the ecosystem ledger, normalises each row into a uniform shape, sorts
// merged result by timestamp DESC, and slices to `limit`. The endpoint is
// resilient to any of the source tables being absent (fresh DB / in-memory
// fallbacks elsewhere) — each fan-out branch traps its own errors so one
// missing table doesn't kill the whole feed.
//
// GET /api/ecosystem/activity
//   ?sources=qsocial,qmedia,qnews,qright,planet,earnings   (default: all)
//   ?mine=1                                                (own rows only)
//   ?limit=1..200                                          (default 40)
// ───────────────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  module: "qsocial" | "qmedia-track" | "qmedia-video" | "qnews" | "qright" | "planet" | "earnings";
  kind: string;
  title: string;
  summary: string | null;
  href: string | null;
  actorId: string | null;
  at: string;
  meta: Record<string, unknown>;
};

function trimSummary(s: string | null | undefined, max = 160): string | null {
  if (!s || typeof s !== "string") return null;
  const clean = s.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

ecosystemRouter.get("/activity", async (req: Request, res: Response) => {
  const pool = getPool();
  const email = ownerEmail(req);
  const userId = req.auth?.sub || "";

  const sourcesRaw = String(req.query.sources || "").trim().toLowerCase();
  const allowed = new Set([
    "qsocial",
    "qmedia",
    "qnews",
    "qright",
    "planet",
    "earnings",
  ]);
  const sources = sourcesRaw
    ? new Set(
        sourcesRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => allowed.has(s))
      )
    : new Set(allowed);
  if (sources.size === 0) {
    for (const s of allowed) sources.add(s);
  }
  const mineRaw = String(req.query.mine || "").trim();
  const mine = mineRaw === "1" || mineRaw === "true" || mineRaw === "yes";

  const limitRaw = parseInt(String(req.query.limit || "40"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 40;
  const perSourceCap = Math.min(80, Math.max(limit, 20));

  const items: ActivityItem[] = [];

  // 1. qsocial — posts (public; if mine — only userId match)
  if (sources.has("qsocial")) {
    try {
      const where = mine ? `"userId"=$1 AND ` : "";
      const params: unknown[] = mine ? [userId] : [];
      params.push(perSourceCap);
      const idxLimit = mine ? 2 : 1;
      const sql = `SELECT "id","userId","content","createdAt","tags"
                   FROM "QSocialPost"
                   WHERE ${where}"isPublic"=TRUE
                   ORDER BY "createdAt" DESC LIMIT $${idxLimit}`;
      const { rows } = await pool.query(sql, params);
      for (const r of rows) {
        items.push({
          id: `qsocial:${r.id}`,
          module: "qsocial",
          kind: "post",
          title: trimSummary(r.content, 80) || "(empty post)",
          summary: trimSummary(r.content, 220),
          href: `/qsocial/post/${r.id}`,
          actorId: r.userId || null,
          at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          meta: { tags: Array.isArray(r.tags) ? r.tags : [] },
        });
      }
    } catch {
      /* table absent — silently skip */
    }
  }

  // 2. qnews — articles
  if (sources.has("qnews")) {
    try {
      const where = mine ? `"submittedBy"=$1 ` : "";
      const params: unknown[] = mine ? [email] : [];
      params.push(perSourceCap);
      const idxLimit = mine ? 2 : 1;
      const sql = `SELECT "id","title","summary","category","publishedAt","submittedBy"
                   FROM "QNewsArticle"
                   ${where ? `WHERE ${where}` : ""}
                   ORDER BY "publishedAt" DESC LIMIT $${idxLimit}`;
      const { rows } = await pool.query(sql, params);
      for (const r of rows) {
        items.push({
          id: `qnews:${r.id}`,
          module: "qnews",
          kind: r.category || "article",
          title: r.title || "(untitled)",
          summary: trimSummary(r.summary, 220),
          href: `/qnews/${r.id}`,
          actorId: r.submittedBy || null,
          at:
            r.publishedAt instanceof Date
              ? r.publishedAt.toISOString()
              : String(r.publishedAt),
          meta: { category: r.category || null },
        });
      }
    } catch {
      /* skip */
    }
  }

  // 3. qright — newly registered objects (PG table; always present in prod)
  if (sources.has("qright")) {
    try {
      const where = mine ? `WHERE "ownerUserId"=$1 OR ("ownerUserId" IS NULL AND "ownerEmail"=$2)` : "";
      const params: unknown[] = mine ? [userId, email] : [];
      params.push(perSourceCap);
      const idxLimit = mine ? 3 : 1;
      const sql = `SELECT "id","title","kind","ownerName","ownerEmail","ownerUserId","createdAt"
                   FROM "QRightObject"
                   ${where}
                   ORDER BY "createdAt" DESC LIMIT $${idxLimit}`;
      const { rows } = await pool.query(sql, params);
      for (const r of rows) {
        items.push({
          id: `qright:${r.id}`,
          module: "qright",
          kind: r.kind || "object",
          title: r.title || "(untitled work)",
          summary: r.ownerName ? `Registered by ${r.ownerName}` : null,
          href: `/qright/object/${r.id}`,
          actorId: r.ownerUserId || r.ownerEmail || null,
          at:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
          meta: { kind: r.kind || null },
        });
      }
    } catch {
      /* skip */
    }
  }

  // 4. planet — submission + certificate stream (read from PlanetSubmission +
  //    PlanetArtifactVersion). Public surface; "mine" filters by ownerId/email.
  if (sources.has("planet")) {
    try {
      const where = mine ? `WHERE "ownerEmail"=$1` : "";
      const params: unknown[] = mine ? [email] : [];
      params.push(perSourceCap);
      const idxLimit = mine ? 2 : 1;
      const sql = `SELECT "id","title","productKey","createdAt","ownerEmail"
                   FROM "PlanetSubmission"
                   ${where}
                   ORDER BY "createdAt" DESC LIMIT $${idxLimit}`;
      const { rows } = await pool.query(sql, params);
      for (const r of rows) {
        items.push({
          id: `planet:${r.id}`,
          module: "planet",
          kind: "submission",
          title: r.title || "(untitled)",
          summary: r.productKey ? `Product: ${r.productKey}` : null,
          href: `/planet/submissions/${r.id}`,
          actorId: r.ownerEmail || null,
          at:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
          meta: { productKey: r.productKey || null },
        });
      }
    } catch {
      /* skip */
    }
  }

  // 5. earnings — own ledger rows (always scoped to the current user; the
  //    `mine` switch is ignored here — these are inherently personal). They
  //    blend into the feed so the user sees "you got paid X" inline with
  //    "you posted Y".
  if (sources.has("earnings")) {
    for (const r of royaltyEvents) {
      if (r.email !== email) continue;
      items.push({
        id: `earn:r:${r.id}`,
        module: "earnings",
        kind: "qright-royalty",
        title: `Royalty: ${r.productKey}`,
        summary: `+${r.amount.toFixed(2)} AEC · period ${r.period}`,
        href: `/qright/object/${r.productKey}`,
        actorId: r.email,
        at: r.paidAt,
        meta: { amount: r.amount, period: r.period, source: r.source },
      });
    }
    for (const c of chessPrizes) {
      if (c.email !== email) continue;
      items.push({
        id: `earn:c:${c.id}`,
        module: "earnings",
        kind: "cyberchess-prize",
        title: `Tournament #${c.tournamentId} — place ${c.place}`,
        summary: `+${c.amount.toFixed(2)} AEC`,
        href: `/cyberchess`,
        actorId: c.email,
        at: c.finalizedAt,
        meta: { amount: c.amount, place: c.place, source: c.source },
      });
    }
    for (const p of planetCerts) {
      if (p.email !== email) continue;
      items.push({
        id: `earn:p:${p.id}`,
        module: "earnings",
        kind: "planet-cert",
        title: `Planet certificate ${p.artifactVersionId}`,
        summary: `+${p.amount.toFixed(2)} AEC`,
        href: `/planet`,
        actorId: p.email,
        at: p.certifiedAt,
        meta: { amount: p.amount, source: p.source },
      });
    }
  }

  // 6. qmedia — in-memory store inside qmedia.ts can't be queried here without
  //    introducing a cycle. The qmedia routes write to memTracks/memVideos that
  //    aren't exported. We approximate via QMediaTrack table (created lazily by
  //    ensureQMediaTables) when it exists in Postgres.
  if (sources.has("qmedia")) {
    try {
      const where = mine ? `WHERE "userId"=$1 ` : "WHERE \"isPublic\"=TRUE ";
      const params: unknown[] = mine ? [userId] : [];
      params.push(perSourceCap);
      const idxLimit = mine ? 2 : 1;
      const sql = `SELECT "id","userId","title","artist","genre","createdAt"
                   FROM "QMediaTrack"
                   ${where}
                   ORDER BY "createdAt" DESC LIMIT $${idxLimit}`;
      const { rows } = await pool.query(sql, params);
      for (const r of rows) {
        items.push({
          id: `qmedia-track:${r.id}`,
          module: "qmedia-track",
          kind: "track",
          title: r.title || "(untitled track)",
          summary: r.artist ? `by ${r.artist}${r.genre ? ` · ${r.genre}` : ""}` : null,
          href: `/qmedia/track/${r.id}`,
          actorId: r.userId || null,
          at:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
          meta: { genre: r.genre || null },
        });
      }
    } catch {
      /* skip */
    }
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const sliced = items.slice(0, limit);

  // Per-source counts for the UI's filter chips — based on the full merged
  // set, not the sliced one, so chip counters don't lie at small limit.
  const bySource: Record<string, number> = {};
  for (const it of items) bySource[it.module] = (bySource[it.module] || 0) + 1;

  res.json({
    generatedAt: new Date().toISOString(),
    total: items.length,
    returned: sliced.length,
    bySource,
    filter: { sources: Array.from(sources), mine, limit },
    items: sliced,
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FEATURE 2 — Module dependency graph + health matrix
//
// Combines three things the dashboard needs in one place:
//   1. The 27 modules from the project registry (id, code, name, tier, status)
//   2. Each module's declared API surface (`apiHints`) as graph edges
//   3. Live health hints — does the module's primary path resolve? Does it
//      have any rows in the ecosystem ledger? (i.e. "is anyone using it").
//
// Returns a graph suitable for force-directed layout AND a flat health matrix
// for tabular rendering. Public route (no PII; no auth needed beyond the
// ecosystemRouter's blanket `requireAuth` — kept under it for symmetry with
// /earnings).
//
// GET /api/ecosystem/graph
// ───────────────────────────────────────────────────────────────────────────

ecosystemRouter.get("/graph", async (_req: Request, res: Response) => {
  try {
    const email = ownerEmail(_req);

    // Per-module touch by the current user — drives "you have activity here"
    // dots on the graph. Cheap because the ledger is already in memory.
    const royaltyByProduct = new Map<string, number>();
    for (const r of royaltyEvents) {
      if (r.email !== email) continue;
      royaltyByProduct.set("qright", (royaltyByProduct.get("qright") || 0) + 1);
    }
    const userChess = chessPrizes.filter((x) => x.email === email).length;
    const userPlanet = planetCerts.filter((x) => x.email === email).length;
    const userTouch: Record<string, number> = {
      qright: royaltyByProduct.get("qright") || 0,
      cyberchess: userChess,
      // The planet certificates ledger lives outside the projects.ts registry
      // (Planet is a cross-cutting layer, not a module id), so we surface it
      // under the closest project — globus — for graph display purposes.
      globus: userPlanet,
    };

    const enriched = enrichProjects(projects);

    type Node = {
      id: string;
      type: "module" | "api";
      code?: string;
      name?: string;
      tier?: string;
      status?: string;
      kind?: string;
      health: "live" | "api" | "portal" | "unknown";
      userTouch?: number;
    };
    type Edge = { from: string; to: string; kind: "exposes" };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const apiSeen = new Set<string>();

    const healthFromTier = (tier: string): Node["health"] => {
      if (tier === "mvp_live") return "live";
      if (tier === "platform_api") return "api";
      if (tier === "portal_only") return "portal";
      return "unknown";
    };

    for (const p of enriched) {
      nodes.push({
        id: p.id,
        type: "module",
        code: p.code,
        name: p.name,
        tier: p.runtime.tier,
        status: p.status,
        kind: p.kind,
        health: healthFromTier(p.runtime.tier),
        userTouch: userTouch[p.id] || 0,
      });
      for (const api of p.runtime.apiHints || []) {
        const apiId = `api:${api}`;
        if (!apiSeen.has(apiId)) {
          apiSeen.add(apiId);
          nodes.push({
            id: apiId,
            type: "api",
            name: api,
            health: "api",
          });
        }
        edges.push({ from: p.id, to: apiId, kind: "exposes" });
      }
    }

    // Health-matrix: flat per-module rows the UI can render as a table without
    // re-walking the graph.
    const matrix = enriched.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      tier: p.runtime.tier,
      status: p.status,
      apiCount: (p.runtime.apiHints || []).length,
      primaryPath: p.runtime.primaryPath || null,
      health: healthFromTier(p.runtime.tier),
      userTouch: userTouch[p.id] || 0,
    }));

    // Top-level rollups so the UI can drop a one-line summary above the graph.
    const byHealth = matrix.reduce<Record<string, number>>((acc, m) => {
      acc[m.health] = (acc[m.health] || 0) + 1;
      return acc;
    }, {});
    const userTouchedCount = matrix.filter((m) => m.userTouch > 0).length;

    res.json({
      generatedAt: new Date().toISOString(),
      moduleCount: matrix.length,
      apiCount: apiSeen.size,
      edgeCount: edges.length,
      byHealth,
      userTouchedCount,
      nodes,
      edges,
      matrix,
    });
  } catch (err) {
    console.error("[ecosystem] /graph failed", err);
    res.status(500).json({ error: "graph failed" });
  }
});

// Health-only flat view — same data as /graph.matrix but without nodes/edges.
// Useful for embeds and CSV export.
ecosystemRouter.get("/health-matrix", (_req: Request, res: Response) => {
  try {
    const enriched = enrichProjects(projects);
    const matrix = enriched.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      tier: p.runtime.tier,
      status: p.status,
      apiCount: (p.runtime.apiHints || []).length,
      primaryPath: p.runtime.primaryPath || null,
      hasRuntime: !!MODULE_RUNTIME[p.id],
    }));
    res.json({
      generatedAt: new Date().toISOString(),
      total: matrix.length,
      items: matrix,
    });
  } catch (err) {
    console.error("[ecosystem] /health-matrix failed", err);
    res.status(500).json({ error: "matrix failed" });
  }
});
