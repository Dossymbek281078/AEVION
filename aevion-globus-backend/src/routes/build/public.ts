import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { buildPool as pool, ok, fail, safeParseJson } from "../../lib/build";

export const publicRouter = Router();

// Permissive CORS for the partner-facing surface. The endpoints are read-only
// and keyed; allowing any origin lets a partner's careers page on any domain
// hit the feed directly from the browser. Preflight (OPTIONS) returns
// immediately so the rate limiter / key middleware don't fire on it.
publicRouter.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Build-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// 60 requests per minute per API key (or per IP if unauthenticated).
// Generous enough for legitimate scrapers polling on a sane interval.
const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const k = (req as Request & { partnerKeyId?: string }).partnerKeyId;
    return k ? `pk:${k}` : `ip:${req.ip ?? "anon"}`;
  },
  message: {
    success: false,
    error: "rate_limit_exceeded",
    retryAfterMs: 60 * 1000,
  },
});

// Validate the X-Build-Key header. Found and unrevoked → attach `partnerKeyId`
// and bump usage counter (fire-and-forget). Missing or invalid → 401.
async function requirePartnerKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-build-key"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || typeof raw !== "string") {
    return fail(res, 401, "missing_x_build_key");
  }
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  try {
    const r = await pool.query(
      `SELECT "id","scopesJson" FROM "BuildPartnerApiKey"
       WHERE "keyHash" = $1 AND "revokedAt" IS NULL LIMIT 1`,
      [keyHash],
    );
    if (r.rowCount === 0) return fail(res, 401, "invalid_or_revoked_key");
    (req as Request & { partnerKeyId?: string }).partnerKeyId = r.rows[0].id;
    void pool
      .query(
        `UPDATE "BuildPartnerApiKey" SET "usageCount" = "usageCount" + 1, "lastUsedAt" = NOW() WHERE "id" = $1`,
        [r.rows[0].id],
      )
      .catch(() => {});
    return next();
  } catch (err: unknown) {
    return fail(res, 500, "key_check_failed", { details: (err as Error).message });
  }
}

// GET /api/build/public/v1/vacancies?limit=20&offset=0&city=...&skill=...
// Read-only feed of OPEN vacancies. Cached briefly so a partner polling
// every 30s doesn't hit the DB on every request.
publicRouter.get("/v1/vacancies", publicRateLimiter, requirePartnerKey, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 20;
    const offsetRaw = Number(req.query.offset);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.round(offsetRaw)) : 0;
    const city = typeof req.query.city === "string" ? req.query.city.trim().slice(0, 100) : "";
    const skill = typeof req.query.skill === "string" ? req.query.skill.trim().slice(0, 60) : "";

    const where: string[] = [`v."status" = 'OPEN'`];
    const params: unknown[] = [];
    if (city) {
      params.push(city);
      where.push(`p."city" ILIKE $${params.length}`);
    }
    if (skill) {
      params.push(`%"${skill.toLowerCase()}"%`);
      where.push(`lower(v."skillsJson") LIKE $${params.length}`);
    }
    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT v."id", v."title", v."description", v."salary", v."salaryCurrency",
              v."skillsJson", v."city", v."createdAt", v."expiresAt",
              p."title" AS "projectTitle", p."city" AS "projectCity"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE ${where.join(" AND ")}
       ORDER BY v."createdAt" DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const items = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      salary: row.salary,
      salaryCurrency: row.salaryCurrency ?? "USD",
      skills: safeParseJson(row.skillsJson, [] as string[]),
      city: row.city ?? row.projectCity ?? null,
      project: row.projectTitle ?? null,
      url: `https://aevion.tech/build/vacancy/${encodeURIComponent(String(row.id))}`,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }));

    res.setHeader("Cache-Control", "private, max-age=30");
    return ok(res, { items, total: items.length, limit, offset });
  } catch (err: unknown) {
    return fail(res, 500, "public_vacancies_failed", { details: (err as Error).message });
  }
});

// GET /api/build/public/v1/vacancies/:id — single vacancy, same shape.
publicRouter.get("/v1/vacancies/:id", publicRateLimiter, requirePartnerKey, async (req, res) => {
  try {
    const id = String(req.params.id);
    const r = await pool.query(
      `SELECT v."id", v."title", v."description", v."salary", v."salaryCurrency",
              v."skillsJson", v."city", v."status", v."createdAt", v."expiresAt",
              p."title" AS "projectTitle", p."city" AS "projectCity"
       FROM "BuildVacancy" v
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE v."id" = $1 LIMIT 1`,
      [id],
    );
    if (r.rowCount === 0) return fail(res, 404, "vacancy_not_found");
    const row = r.rows[0];
    const item = {
      id: row.id,
      title: row.title,
      description: row.description,
      salary: row.salary,
      salaryCurrency: row.salaryCurrency ?? "USD",
      status: row.status,
      skills: safeParseJson(row.skillsJson, [] as string[]),
      city: row.city ?? row.projectCity ?? null,
      project: row.projectTitle ?? null,
      url: `https://aevion.tech/build/vacancy/${encodeURIComponent(String(row.id))}`,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
    res.setHeader("Cache-Control", "private, max-age=30");
    return ok(res, item);
  } catch (err: unknown) {
    return fail(res, 500, "public_vacancy_fetch_failed", { details: (err as Error).message });
  }
});

// GET /api/build/public/v1/health — sanity check for partners.
publicRouter.get("/v1/health", publicRateLimiter, requirePartnerKey, async (_req, res) => {
  return ok(res, { status: "ok", apiVersion: "v1" });
});

// GET /api/build/public/widget.js — drop-in <script> for partner sites.
//
// The partner adds:
//   <div data-aevion-build data-key="qb_pk_..." data-limit="6"></div>
//   <script src="https://aevion.tech/api/build/public/widget.js" defer></script>
//
// The script auto-finds every `[data-aevion-build]` div, calls our public
// vacancies feed using the data-key, and renders a styled list of open
// roles linking back to /build/vacancy/:id. No framework dep, vanilla DOM.
//
// CORS is permissive (Access-Control-Allow-Origin: *) since the public API
// is read-only and key-scoped — a stolen key is no worse than scraping.
publicRouter.get("/widget.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Minified-ish JS literal. Kept self-contained on purpose so the partner
  // site never has to think about bundlers / module systems.
  res.send(`(function(){
  var API = (function(){
    try { var s = document.currentScript; if (s && s.src) { return new URL(s.src).origin; } } catch (e) {}
    return "https://aevion.tech";
  })();
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>\"']/g, function(c){ return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function fmtSalary(v){ if(!v||v.salary<=0) return ""; var n=v.salary.toLocaleString("en-US"); return "$"+n+" "+(v.salaryCurrency||"USD"); }
  function render(host, items){
    var limit = parseInt(host.getAttribute("data-limit") || "6", 10);
    items = items.slice(0, isFinite(limit) && limit > 0 ? limit : 6);
    if (items.length === 0) {
      host.innerHTML = '<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;color:#475569;font:14px system-ui">No open vacancies right now.</div>';
      return;
    }
    var list = items.map(function(v){
      var skills = (v.skills||[]).slice(0,4).map(function(s){ return '<span style="display:inline-block;background:#ecfdf5;color:#047857;padding:2px 8px;border-radius:9999px;font:11px system-ui;margin-right:4px;margin-top:4px">'+esc(s)+'</span>'; }).join("");
      return '<a href="' + esc(v.url) + '" target="_blank" rel="noopener" style="display:block;padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;color:inherit;text-decoration:none;background:#fff;margin-bottom:8px;transition:border-color .15s">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:start">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font:600 15px system-ui;color:#0f172a">' + esc(v.title) + '</div>' +
            (v.city ? '<div style="font:12px system-ui;color:#64748b;margin-top:2px">📍 ' + esc(v.city) + (v.project ? " · " + esc(v.project) : "") + '</div>' : "") +
          '</div>' +
          (fmtSalary(v) ? '<div style="font:600 14px system-ui;color:#059669;white-space:nowrap">' + esc(fmtSalary(v)) + '</div>' : "") +
        '</div>' +
        (skills ? '<div style="margin-top:6px">' + skills + '</div>' : "") +
      '</a>';
    }).join("");
    host.innerHTML = list +
      '<div style="text-align:right;font:11px system-ui;color:#94a3b8;margin-top:6px">Powered by <a href="' + esc(API) + '/build" target="_blank" rel="noopener" style="color:#10b981;text-decoration:none">AEVION QBuild</a></div>';
  }
  function load(host){
    var key = host.getAttribute("data-key");
    if (!key){ host.innerHTML = '<div style="padding:12px;color:#dc2626;font:14px system-ui">[AEVION QBuild widget] missing data-key</div>'; return; }
    // Single-vacancy mode: data-vacancy-id="..." -> render exactly one role.
    var vid = host.getAttribute("data-vacancy-id");
    if (vid) {
      fetch(API + "/api/build/public/v1/vacancies/" + encodeURIComponent(vid), { headers: { "X-Build-Key": key } })
        .then(function(r){ return r.json(); })
        .then(function(j){
          if (!j || !j.success) { host.innerHTML = '<div style="padding:12px;color:#dc2626;font:14px system-ui">[AEVION] '+esc(j && j.error || "vacancy unavailable")+'</div>'; return; }
          render(host, j.data ? [j.data] : []);
        })
        .catch(function(e){ host.innerHTML = '<div style="padding:12px;color:#dc2626;font:14px system-ui">[AEVION] '+esc(e.message||"network error")+'</div>'; });
      return;
    }
    var qs = new URLSearchParams();
    var limit = host.getAttribute("data-limit"); if (limit) qs.set("limit", limit);
    var city = host.getAttribute("data-city"); if (city) qs.set("city", city);
    var skill = host.getAttribute("data-skill"); if (skill) qs.set("skill", skill);
    fetch(API + "/api/build/public/v1/vacancies?" + qs.toString(), { headers: { "X-Build-Key": key } })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j || !j.success) { host.innerHTML = '<div style="padding:12px;color:#dc2626;font:14px system-ui">[AEVION] '+esc(j && j.error || "feed unavailable")+'</div>'; return; }
        render(host, (j.data && j.data.items) || []);
      })
      .catch(function(e){ host.innerHTML = '<div style="padding:12px;color:#dc2626;font:14px system-ui">[AEVION] '+esc(e.message||"network error")+'</div>'; });
  }
  function boot(){
    var hosts = document.querySelectorAll("[data-aevion-build]");
    for (var i=0;i<hosts.length;i++) load(hosts[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();`);
});
