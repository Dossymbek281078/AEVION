import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { projects } from "../data/projects";
import {
  enrichProjects,
  enrichProject,
  getModuleRuntime,
  MODULE_RUNTIME,
  type GlobusProjectWithRuntime,
  type ModuleRuntimeMeta,
} from "../data/moduleRuntime";
import type { GlobusProject } from "../types/globus";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";

export const modulesRouter = Router();

const pool = getPool();

// Public surfaces (registry / embed / badge / dependency-graph) are loaded
// by third-party sites; cap aggressively per IP but with headroom.
const modulesEmbedRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  keyPrefix: "modules:embed",
});

// ─────────────────────────────────────────────────────────────────────────
// Schema bootstrap (Tier 2)
// ─────────────────────────────────────────────────────────────────────────

let ensuredModulesTables = false;
async function ensureModulesTables(): Promise<void> {
  if (ensuredModulesTables) return;
  // Per-module override layer. Static `projects.ts` + `moduleRuntime.ts`
  // remain the source of truth; this table lets admins flip status/tier/hint
  // without a code deploy. NULL columns mean "no override".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ModuleStateOverride" (
      "moduleId" TEXT PRIMARY KEY,
      "status" TEXT,
      "tier" TEXT,
      "hint" TEXT,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedBy" TEXT
    );
  `);
  // Append-only history of override edits — surfaces "what changed when"
  // for the public changelog and the admin audit reader.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ModuleStateChange" (
      "id" TEXT PRIMARY KEY,
      "moduleId" TEXT NOT NULL,
      "actor" TEXT,
      "oldState" JSONB,
      "newState" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "ModuleStateChange_at_idx" ON "ModuleStateChange" ("at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "ModuleStateChange_module_idx" ON "ModuleStateChange" ("moduleId", "at" DESC);`
  );
  ensuredModulesTables = true;
}

// ─────────────────────────────────────────────────────────────────────────
// Admin gate
// ─────────────────────────────────────────────────────────────────────────

function getModulesAdminEmailAllowlist(): Set<string> {
  const raw = (process.env.MODULES_ADMIN_EMAILS || "").trim();
  if (!raw) return new Set<string>();
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

function verifyBearerOptional(req: any): { sub: string; email?: string; role?: string } | null {
  const header = req.headers?.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
    return jwt.verify(token, secret) as any;
  } catch {
    return null;
  }
}

function isModulesAdmin(auth: { role?: string; email?: string } | null): boolean {
  if (!auth) return false;
  if (auth.role === "admin" || auth.role === "ADMIN") return true;
  if (!auth.email) return false;
  return getModulesAdminEmailAllowlist().has(auth.email.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────
// Override-aware enrichment
// ─────────────────────────────────────────────────────────────────────────

type Override = {
  status: string | null;
  tier: string | null;
  hint: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

async function loadOverrides(): Promise<Map<string, Override>> {
  await ensureModulesTables();
  const r = await pool.query(
    `SELECT "moduleId", "status", "tier", "hint", "updatedAt", "updatedBy"
     FROM "ModuleStateOverride"`
  );
  const map = new Map<string, Override>();
  for (const row of r.rows as any[]) {
    map.set(row.moduleId, {
      status: row.status,
      tier: row.tier,
      hint: row.hint,
      updatedAt:
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      updatedBy: row.updatedBy,
    });
  }
  return map;
}

type EnrichedWithOverride = GlobusProjectWithRuntime & {
  override: Override | null;
  effectiveStatus: string;
  effectiveTier: string;
  effectiveHint: string;
};

function applyOverride(
  p: GlobusProjectWithRuntime,
  o: Override | undefined
): EnrichedWithOverride {
  return {
    ...p,
    override: o || null,
    effectiveStatus: o?.status || p.status,
    effectiveTier: (o?.tier as ModuleRuntimeMeta["tier"]) || p.runtime.tier,
    effectiveHint: o?.hint || p.runtime.hint,
  };
}

async function loadAllEnriched(): Promise<EnrichedWithOverride[]> {
  const overrides = await loadOverrides();
  return enrichProjects(projects).map((p) => applyOverride(p, overrides.get(p.id)));
}

// ─────────────────────────────────────────────────────────────────────────
// Existing endpoints — kept as-is (additive Tier 2 around them)
// ─────────────────────────────────────────────────────────────────────────

modulesRouter.get("/status", async (_req, res) => {
  try {
    const enriched = await loadAllEnriched();
    const byTier = {
      mvp_live: enriched.filter((x) => x.effectiveTier === "mvp_live").length,
      platform_api: enriched.filter((x) => x.effectiveTier === "platform_api").length,
      portal_only: enriched.filter((x) => x.effectiveTier === "portal_only").length,
    };
    res.json({
      generatedAt: new Date().toISOString(),
      total: enriched.length,
      byTier,
      items: enriched,
    });
  } catch (err: any) {
    res.status(500).json({ error: "status failed", details: err.message });
  }
});

// Per-module health probe — still synchronous / stateless. Used by the
// dashboard to render a green dot per module without DB round-trips.
modulesRouter.get("/:id/health", (req, res) => {
  const id = req.params.id;
  const known = MODULE_RUNTIME[id];
  if (!known) {
    return res.status(404).json({ ok: false, error: "unknown module id", id });
  }
  const openai = !!process.env.OPENAI_API_KEY?.trim();
  let message = "Registry entry healthy";
  if (id === "qcoreai") {
    message = openai ? "QCoreAI ready (OpenAI)" : "QCoreAI stub mode (no OPENAI_API_KEY)";
  } else if (id === "multichat-engine") {
    message = "UI bridge; chat via POST /api/qcoreai/chat";
  }
  res.json({
    ok: true,
    id,
    tier: known.tier,
    primaryPath: known.primaryPath,
    stub: false,
    openaiConfigured: id === "qcoreai" || id === "multichat-engine" ? openai : undefined,
    message,
    checkedAt: new Date().toISOString(),
  });
});

modulesRouter.get("/:id/meta", (req, res) => {
  const id = req.params.id;
  if (!MODULE_RUNTIME[id]) {
    return res.status(404).json({ error: "unknown module", id });
  }
  res.json({ id, ...getModuleRuntime(id) });
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — public registry surfaces
// ─────────────────────────────────────────────────────────────────────────

// 🔹 GET /registry — filtered + searchable registry. Public.
//    Filters: tier, status, kind, q (matches name/code/id/description/tags).
//    `tier` and `status` filter against the EFFECTIVE values (post-override).
modulesRouter.get("/registry", modulesEmbedRateLimit, async (req, res) => {
  try {
    const enriched = await loadAllEnriched();
    const tier = String(req.query.tier || "").trim();
    const status = String(req.query.status || "").trim();
    const kind = String(req.query.kind || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const filtered = enriched.filter((p) => {
      if (tier && p.effectiveTier !== tier) return false;
      if (status && p.effectiveStatus !== status) return false;
      if (kind && p.kind !== kind) return false;
      if (q.length >= 2) {
        const hay = [
          p.id,
          p.code,
          p.name,
          p.description,
          ...(p.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      generatedAt: new Date().toISOString(),
      total: enriched.length,
      matched: filtered.length,
      filter: {
        tier: tier || null,
        status: status || null,
        kind: kind || null,
        q: q || null,
        limit,
      },
      items: filtered.slice(0, limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: "registry failed", details: err.message });
  }
});

// 🔹 GET /registry.csv — public RFC 4180 CSV export, mirrors filter.
modulesRouter.get("/registry.csv", modulesEmbedRateLimit, async (req, res) => {
  try {
    const enriched = await loadAllEnriched();
    const tier = String(req.query.tier || "").trim();
    const status = String(req.query.status || "").trim();
    const kind = String(req.query.kind || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const filtered = enriched.filter((p) => {
      if (tier && p.effectiveTier !== tier) return false;
      if (status && p.effectiveStatus !== status) return false;
      if (kind && p.kind !== kind) return false;
      if (q.length >= 2) {
        const hay = [p.id, p.code, p.name, p.description, ...(p.tags || [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    function csvCell(v: unknown): string {
      if (v === null || v === undefined) return "";
      const s = Array.isArray(v) ? v.join("|") : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }
    const header = [
      "id",
      "code",
      "name",
      "kind",
      "effectiveStatus",
      "effectiveTier",
      "primaryPath",
      "apiHints",
      "tags",
      "priority",
      "description",
    ].join(",");
    const lines = filtered.map((p) =>
      [
        p.id,
        p.code,
        p.name,
        p.kind,
        p.effectiveStatus,
        p.effectiveTier,
        p.runtime.primaryPath,
        (p.runtime.apiHints || []).join("|"),
        (p.tags || []).join("|"),
        p.priority,
        p.description,
      ]
        .map(csvCell)
        .join(",")
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="aevion-modules-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send([header, ...lines].join("\r\n"));
  } catch (err: any) {
    res.status(500).json({ error: "csv failed", details: err.message });
  }
});

// 🔹 GET /stats — aggregate roll-up. Public, 5-min cached.
modulesRouter.get("/stats", modulesEmbedRateLimit, async (_req, res) => {
  try {
    const enriched = await loadAllEnriched();
    const byTier: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    let withApi = 0;
    let withPath = 0;
    let overridden = 0;
    for (const p of enriched) {
      byTier[p.effectiveTier] = (byTier[p.effectiveTier] || 0) + 1;
      byStatus[p.effectiveStatus] = (byStatus[p.effectiveStatus] || 0) + 1;
      byKind[p.kind] = (byKind[p.kind] || 0) + 1;
      if ((p.runtime.apiHints || []).length > 0) withApi++;
      if (p.runtime.primaryPath) withPath++;
      if (p.override) overridden++;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      generatedAt: new Date().toISOString(),
      total: enriched.length,
      withApi,
      withPath,
      overridden,
      byTier,
      byStatus,
      byKind,
    });
  } catch (err: any) {
    res.status(500).json({ error: "stats failed", details: err.message });
  }
});

// 🔹 GET /:id/embed — sanitized JSON for third-party embeds. Public.
//    Drops private metadata; surfaces what's safe to render externally.
modulesRouter.get("/:id/embed", modulesEmbedRateLimit, async (req, res) => {
  try {
    const id = String(req.params.id);
    const base = projects.find((p) => p.id === id);
    if (!base) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.status(404).json({ id, status: "not_found" });
    }
    const overrides = await loadOverrides();
    const p = applyOverride(enrichProject(base), overrides.get(id));
    const etag = `W/"modules-embed-${id}-${p.override?.updatedAt || p.updatedAt}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(304).end();
    }
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: p.id,
      code: p.code,
      name: p.name,
      kind: p.kind,
      status: p.effectiveStatus,
      tier: p.effectiveTier,
      tags: p.tags,
      hint: p.effectiveHint,
      primaryPath: p.runtime.primaryPath,
      apiHints: p.runtime.apiHints,
      verifyUrl: p.runtime.primaryPath || `/${id}`,
      updatedAt: p.override?.updatedAt || p.updatedAt,
      isOverridden: !!p.override,
    });
  } catch (err: any) {
    res.status(500).json({ error: "embed failed", details: err.message });
  }
});

// 🔹 GET /:id/badge.svg — shields.io-style two-segment badge.
//    Color is keyed off effective tier:
//      mvp_live    → green   #0d9488
//      platform_api → blue   #2563eb
//      portal_only → gray    #94a3b8
modulesRouter.get("/:id/badge.svg", modulesEmbedRateLimit, async (req, res) => {
  try {
    const id = String(req.params.id);
    const theme = String(req.query.theme || "dark").toLowerCase() === "light" ? "light" : "dark";
    const base = projects.find((p) => p.id === id);

    function svgShell(left: string, right: string, rightFill: string): string {
      const padX = 8;
      const charW = 6.6;
      const lW = Math.max(70, Math.round(left.length * charW + padX * 2));
      const rW = Math.max(80, Math.round(right.length * charW + padX * 2));
      const total = lW + rW;
      const leftFill = theme === "light" ? "#e2e8f0" : "#1e293b";
      const leftText = theme === "light" ? "#0f172a" : "#e2e8f0";
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${esc(
        left
      )}: ${esc(right)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".08"/>
  </linearGradient>
  <rect width="${total}" height="22" rx="4" fill="${leftFill}"/>
  <rect x="${lW}" width="${rW}" height="22" rx="4" fill="${rightFill}"/>
  <rect x="${lW - 4}" width="8" height="22" fill="${rightFill}"/>
  <rect width="${total}" height="22" rx="4" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700">
    <text x="${lW / 2}" y="15" fill="${leftText}">${esc(left)}</text>
    <text x="${lW + rW / 2}" y="15">${esc(right)}</text>
  </g>
</svg>`;
    }
    function esc(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!base) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.send(svgShell("AEVION MODULE", "not found", "#94a3b8"));
    }
    const overrides = await loadOverrides();
    const p = applyOverride(enrichProject(base), overrides.get(id));
    const etag = `W/"modules-badge-${id}-${p.effectiveTier}-${p.effectiveStatus}-${theme}"`;
    if (req.headers["if-none-match"] === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(304).end();
    }
    const tierColor: Record<string, string> = {
      mvp_live: "#0d9488",
      platform_api: "#2563eb",
      portal_only: "#94a3b8",
    };
    const right = `${p.code} · ${p.effectiveTier.replace(/_/g, " ")}`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(svgShell("AEVION MODULE", right, tierColor[p.effectiveTier] || "#94a3b8"));
  } catch (err: any) {
    res.status(500).json({ error: "badge failed", details: err.message });
  }
});

// 🔹 GET /dependency-graph — JSON graph of declared API dependencies.
//    Edge: module → API prefix (from apiHints). Useful for the dashboard
//    "what breaks if I take down X" view.
modulesRouter.get("/dependency-graph", modulesEmbedRateLimit, async (_req, res) => {
  try {
    const enriched = await loadAllEnriched();
    const nodes: { id: string; type: "module" | "api"; label: string }[] = [];
    const edges: { from: string; to: string }[] = [];
    const seenApis = new Set<string>();
    for (const p of enriched) {
      nodes.push({ id: p.id, type: "module", label: p.code });
      for (const api of p.runtime.apiHints || []) {
        const apiId = `api:${api}`;
        if (!seenApis.has(apiId)) {
          seenApis.add(apiId);
          nodes.push({ id: apiId, type: "api", label: api });
        }
        edges.push({ from: p.id, to: apiId });
      }
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
    });
  } catch (err: any) {
    res.status(500).json({ error: "graph failed", details: err.message });
  }
});

// 🔹 GET /changelog — public changelog of admin overrides (recent first).
modulesRouter.get("/changelog", modulesEmbedRateLimit, async (req, res) => {
  try {
    await ensureModulesTables();
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
    const r = await pool.query(
      `SELECT "id","moduleId","oldState","newState","at"
       FROM "ModuleStateChange"
       ORDER BY "at" DESC
       LIMIT $1`,
      [limit]
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      total: r.rowCount,
      // Public changelog deliberately omits actor (PII).
      items: r.rows.map((row: any) => ({
        id: row.id,
        moduleId: row.moduleId,
        oldState: row.oldState,
        newState: row.newState,
        at: row.at instanceof Date ? row.at.toISOString() : row.at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "changelog failed", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — admin override
// ─────────────────────────────────────────────────────────────────────────

const VALID_STATUS = new Set(["idea", "planning", "in_progress", "mvp", "launched"]);
const VALID_TIER = new Set(["mvp_live", "platform_api", "portal_only"]);

// 🔹 GET /admin/whoami — admin role probe.
modulesRouter.get("/admin/whoami", (req, res) => {
  const auth = verifyBearerOptional(req);
  res.json({
    isAdmin: isModulesAdmin(auth),
    email: auth?.email || null,
    role: auth?.role || null,
  });
});

// 🔹 PATCH /admin/:id — set/clear override fields. Pass null to clear.
//    Body: { status?: string|null, tier?: string|null, hint?: string|null }
modulesRouter.patch("/admin/:id", async (req, res) => {
  try {
    await ensureModulesTables();
    const auth = verifyBearerOptional(req);
    if (!isModulesAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const id = String(req.params.id);
    if (!MODULE_RUNTIME[id]) {
      return res.status(404).json({ error: "unknown module id" });
    }

    // Validate non-null inputs.
    const status = req.body?.status;
    const tier = req.body?.tier;
    const hint = req.body?.hint;
    if (status !== undefined && status !== null && !VALID_STATUS.has(String(status))) {
      return res.status(400).json({
        error: "invalid status",
        allowed: Array.from(VALID_STATUS),
      });
    }
    if (tier !== undefined && tier !== null && !VALID_TIER.has(String(tier))) {
      return res.status(400).json({
        error: "invalid tier",
        allowed: Array.from(VALID_TIER),
      });
    }
    if (hint !== undefined && hint !== null && (typeof hint !== "string" || hint.length > 500)) {
      return res.status(400).json({ error: "hint must be string ≤ 500 chars" });
    }

    // Snapshot the current state (post-override) so the audit row captures
    // a meaningful before/after diff.
    const overridesBefore = await loadOverrides();
    const beforeOv = overridesBefore.get(id);
    const baseEnriched = enrichProject(projects.find((p) => p.id === id)!);
    const before = {
      status: beforeOv?.status ?? baseEnriched.status,
      tier: beforeOv?.tier ?? baseEnriched.runtime.tier,
      hint: beforeOv?.hint ?? baseEnriched.runtime.hint,
      hadOverride: !!beforeOv,
    };

    // Build the new override row. undefined = leave column unchanged;
    // null = explicitly clear; string = set.
    const next = {
      status: status === undefined ? beforeOv?.status ?? null : status,
      tier: tier === undefined ? beforeOv?.tier ?? null : tier,
      hint: hint === undefined ? beforeOv?.hint ?? null : hint,
    };

    // If everything is null, drop the row entirely so /stats.overridden
    // is accurate.
    if (next.status === null && next.tier === null && next.hint === null) {
      await pool.query(`DELETE FROM "ModuleStateOverride" WHERE "moduleId" = $1`, [id]);
    } else {
      await pool.query(
        `INSERT INTO "ModuleStateOverride" ("moduleId","status","tier","hint","updatedAt","updatedBy")
         VALUES ($1,$2,$3,$4,NOW(),$5)
         ON CONFLICT ("moduleId") DO UPDATE
           SET "status" = EXCLUDED."status",
               "tier" = EXCLUDED."tier",
               "hint" = EXCLUDED."hint",
               "updatedAt" = NOW(),
               "updatedBy" = EXCLUDED."updatedBy"`,
        [id, next.status, next.tier, next.hint, auth?.email || auth?.sub || null]
      );
    }

    const after = {
      status: next.status ?? baseEnriched.status,
      tier: next.tier ?? baseEnriched.runtime.tier,
      hint: next.hint ?? baseEnriched.runtime.hint,
      hadOverride:
        next.status !== null || next.tier !== null || next.hint !== null,
    };

    await pool.query(
      `INSERT INTO "ModuleStateChange" ("id","moduleId","actor","oldState","newState")
       VALUES ($1,$2,$3,$4,$5)`,
      [
        crypto.randomUUID(),
        id,
        auth?.email || auth?.sub || null,
        JSON.stringify(before),
        JSON.stringify(after),
      ]
    );

    res.json({
      moduleId: id,
      before,
      after,
      cleared: !after.hadOverride,
    });
  } catch (err: any) {
    res.status(500).json({ error: "admin patch failed", details: err.message });
  }
});

// 🔹 GET /admin/audit — privileged audit reader (includes actor).
modulesRouter.get("/admin/audit", async (req, res) => {
  try {
    await ensureModulesTables();
    const auth = verifyBearerOptional(req);
    if (!isModulesAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const limitRaw = parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
    const moduleId = String(req.query.moduleId || "").trim();

    const conds: string[] = [];
    const params: unknown[] = [];
    if (moduleId) {
      params.push(moduleId);
      conds.push(`"moduleId" = $${params.length}`);
    }
    params.push(limit);
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const r = await pool.query(
      `SELECT "id","moduleId","actor","oldState","newState","at"
       FROM "ModuleStateChange"
       ${where}
       ORDER BY "at" DESC
       LIMIT $${params.length}`,
      params
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      filter: { moduleId: moduleId || null, limit },
      items: r.rows.map((row: any) => ({
        id: row.id,
        moduleId: row.moduleId,
        actor: row.actor,
        oldState: row.oldState,
        newState: row.newState,
        at: row.at instanceof Date ? row.at.toISOString() : row.at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "audit failed", details: err.message });
  }
});
