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
import {
  ensureModuleWebhookTables,
  fireModuleWebhook,
  MODULE_WEBHOOK_EVENTS,
  type ModuleWebhookEvent,
} from "../lib/modules/webhooks";

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

// 🔹 GET /:id/detail — public, full sanitized record for a single module.
//    Superset of /:id/embed (adds description, priority, base tier/hint and
//    override metadata) so the /modules/[id] page can render without
//    fan-out to /registry and stripping the rest. No PII (no actor).
modulesRouter.get("/:id/detail", modulesEmbedRateLimit, async (req, res) => {
  try {
    const id = String(req.params.id);
    const base = projects.find((p) => p.id === id);
    if (!base) {
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.status(404).json({ id, status: "not_found" });
    }
    const overrides = await loadOverrides();
    const p = applyOverride(enrichProject(base), overrides.get(id));
    res.setHeader("Cache-Control", "public, max-age=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      kind: p.kind,
      priority: p.priority,
      tags: p.tags || [],
      effectiveStatus: p.effectiveStatus,
      effectiveTier: p.effectiveTier,
      effectiveHint: p.effectiveHint,
      baseStatus: p.status,
      baseTier: p.runtime.tier,
      baseHint: p.runtime.hint,
      primaryPath: p.runtime.primaryPath,
      apiHints: p.runtime.apiHints || [],
      isOverridden: !!p.override,
      overrideUpdatedAt: p.override?.updatedAt || null,
      updatedAt: p.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "detail failed", details: err.message });
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
//    Optional ?moduleId= scopes to a single module — used by /modules/[id]
//    detail page to render that module's own history without pulling 200
//    rows of unrelated noise.
modulesRouter.get("/changelog", modulesEmbedRateLimit, async (req, res) => {
  try {
    await ensureModulesTables();
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
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
      `SELECT "id","moduleId","oldState","newState","at"
       FROM "ModuleStateChange"
       ${where}
       ORDER BY "at" DESC
       LIMIT $${params.length}`,
      params
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      total: r.rowCount,
      filter: { moduleId: moduleId || null, limit },
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

    // Fire webhook AFTER the audit row lands so subscribers can correlate
    // by `at`. Two distinct events:
    //   - `module.override.cleared` — the entire override row was dropped
    //   - `module.override.set`     — fields added or updated
    // The latter covers both "first time set" and "edit existing" — keep it
    // simple, the diff is in the payload.
    const webhookEvent: ModuleWebhookEvent = !after.hadOverride
      ? "module.override.cleared"
      : "module.override.set";
    fireModuleWebhook(pool, webhookEvent, {
      moduleId: id,
      before,
      after,
      at: new Date().toISOString(),
    });

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

// ─────────────────────────────────────────────────────────────────────────
// Tier 3 — webhooks (admin-managed) + public RSS
// ─────────────────────────────────────────────────────────────────────────

// 🔹 POST /admin/webhooks — register a subscription. Body:
//      { url: string, events?: string[] | "*", label?: string }
//    Returns the generated id + secret. SECRET IS RETURNED ONLY ONCE.
modulesRouter.post("/admin/webhooks", async (req, res) => {
  try {
    await ensureModuleWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!isModulesAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "url must be http(s)://" });
    }
    if (url.length > 2000) {
      return res.status(400).json({ error: "url too long" });
    }
    const label = typeof req.body?.label === "string" ? req.body.label.slice(0, 200) : null;

    const rawEvents = req.body?.events;
    let events: string;
    if (rawEvents === undefined || rawEvents === null || rawEvents === "*") {
      events = "*";
    } else if (Array.isArray(rawEvents)) {
      const cleaned = rawEvents
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim())
        .filter(Boolean);
      const unknown = cleaned.find(
        (e) => e !== "*" && !MODULE_WEBHOOK_EVENTS.includes(e as ModuleWebhookEvent)
      );
      if (unknown) {
        return res.status(400).json({
          error: "unknown event",
          unknown,
          allowed: ["*", ...MODULE_WEBHOOK_EVENTS],
        });
      }
      events = cleaned.length ? cleaned.join(",") : "*";
    } else {
      return res.status(400).json({ error: "events must be array or '*'" });
    }

    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO "ModuleWebhook" ("id","url","secret","events","label","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, url, secret, events, label, auth?.email || auth?.sub || null]
    );

    res.status(201).json({
      id,
      url,
      events,
      label,
      // Returned ONLY in the create response. Subsequent reads omit it.
      secret,
      active: true,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "webhook create failed", details: err.message });
  }
});

// 🔹 GET /admin/webhooks — list subscriptions (no secrets).
modulesRouter.get("/admin/webhooks", async (req, res) => {
  try {
    await ensureModuleWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!isModulesAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const r = await pool.query(
      `SELECT "id","url","events","label","active","createdAt","createdBy",
              "lastFiredAt","lastError","failureCount"
       FROM "ModuleWebhook"
       ORDER BY "createdAt" DESC`
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        id: row.id,
        url: row.url,
        events: row.events,
        label: row.label,
        active: row.active,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        createdBy: row.createdBy,
        lastFiredAt:
          row.lastFiredAt instanceof Date ? row.lastFiredAt.toISOString() : row.lastFiredAt,
        lastError: row.lastError,
        failureCount: row.failureCount,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "webhook list failed", details: err.message });
  }
});

// 🔹 DELETE /admin/webhooks/:id — hard-delete subscription + its delivery log.
modulesRouter.delete("/admin/webhooks/:id", async (req, res) => {
  try {
    await ensureModuleWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!isModulesAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const id = String(req.params.id);
    const del = await pool.query(`DELETE FROM "ModuleWebhook" WHERE "id" = $1`, [id]);
    if (del.rowCount === 0) {
      return res.status(404).json({ error: "webhook not found" });
    }
    await pool.query(`DELETE FROM "ModuleWebhookDelivery" WHERE "webhookId" = $1`, [id]);
    res.json({ id, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "webhook delete failed", details: err.message });
  }
});

// 🔹 GET /admin/webhooks/:id/deliveries — recent deliveries for one
//    subscription. Useful for "did the receiver ack last week's flip?"
modulesRouter.get("/admin/webhooks/:id/deliveries", async (req, res) => {
  try {
    await ensureModuleWebhookTables(pool);
    const auth = verifyBearerOptional(req);
    if (!isModulesAdmin(auth)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const id = String(req.params.id);
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;
    const r = await pool.query(
      `SELECT "id","event","moduleId","succeeded","statusCode","errorMessage","durationMs","createdAt"
       FROM "ModuleWebhookDelivery"
       WHERE "webhookId" = $1
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [id, limit]
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        id: row.id,
        event: row.event,
        moduleId: row.moduleId,
        succeeded: row.succeeded,
        statusCode: row.statusCode,
        errorMessage: row.errorMessage,
        durationMs: row.durationMs,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "deliveries failed", details: err.message });
  }
});

// 🔹 GET /changelog.rss — public RSS 2.0 feed of override flips.
//    Aimed at journalists / investors / partners who'd rather follow
//    launches in their reader than poll JSON. No actor (PII), same content
//    as /changelog.
modulesRouter.get("/changelog.rss", modulesEmbedRateLimit, async (req, res) => {
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

    const proto = (req.headers["x-forwarded-proto"] as string) || (req.protocol as string) || "https";
    const host = (req.headers.host as string) || "aevion.tech";
    const selfUrl = `${proto}://${host}/api/modules/changelog.rss`;
    const siteUrl = `${proto}://${host}/modules`;

    function esc(s: string): string {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    function describe(row: any): string {
      const before = row.oldState || {};
      const after = row.newState || {};
      const parts: string[] = [];
      if (before.status !== after.status) parts.push(`status: ${before.status} → ${after.status}`);
      if (before.tier !== after.tier) parts.push(`tier: ${before.tier} → ${after.tier}`);
      if (before.hint !== after.hint) parts.push(`hint changed`);
      if (parts.length === 0 && !before.hadOverride && after.hadOverride) {
        return "Admin override applied.";
      }
      if (parts.length === 0 && before.hadOverride && !after.hadOverride) {
        return "Admin override cleared.";
      }
      return parts.join("; ") || "Override changed.";
    }

    const items = r.rows
      .map((row: any) => {
        const at = row.at instanceof Date ? row.at : new Date(row.at);
        const pubDate = at.toUTCString();
        const title = `${row.moduleId} — ${describe(row)}`;
        const guid = `aevion-modules-${row.id}`;
        const link = `${proto}://${host}/modules/${encodeURIComponent(row.moduleId)}`;
        return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(describe(row))}</description>
    </item>`;
      })
      .join("\n");

    const lastBuild = r.rows[0]
      ? (r.rows[0].at instanceof Date ? r.rows[0].at : new Date(r.rows[0].at)).toUTCString()
      : new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AEVION modules — changelog</title>
    <link>${esc(siteUrl)}</link>
    <atom:link href="${esc(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Live tier and status changes across the AEVION module ecosystem.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: "rss failed", details: err.message });
  }
});
