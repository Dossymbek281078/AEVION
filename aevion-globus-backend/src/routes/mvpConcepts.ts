/**
 * MVP concept routers — one minimal feature surface per ownerless module
 * to move it from "landing + waitlist" to "demo-able MVP" without a giant
 * per-module backend rewrite.
 *
 * Each module gets:
 *   GET  /api/<id>/<noun>          — list (limit/offset/tag filters)
 *   GET  /api/<id>/<noun>/:itemId  — fetch one
 *   POST /api/<id>/<noun>          — create (open create; rate-limited)
 *   GET  /api/<id>/concept-stats   — total + last7d + topTags
 *
 * Mounted BEFORE the generic planningStubs loop so module-specific paths
 * win and unknown paths still fall through to /health, /waitlist, etc.
 *
 * Storage: shared `module_concept_items` table via `lib/moduleMvpStore`.
 * Open-create endpoints are rate-limited per IP; production deployments
 * should layer auth or a per-module write secret if abuse surfaces.
 */

import { Router, type Express, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import {
  createItem, listItems, getItem, statsFor,
  searchByPayloadField, searchByDistance,
} from "../lib/moduleMvpStore";

type ConceptConfig = {
  id: string;
  noun: string;            // "listings", "claims", "prompts", …
  titleField: string;      // payload key shown as title
  summaryField?: string;   // optional payload key shown as summary
  requiredFields?: string[]; // payload keys required at create
  defaultTags?: string[];  // sprinkled on every create unless overridden
};

const CONCEPTS: ConceptConfig[] = [
  // startup-exchange: investor ↔ startup interest marketplace
  { id: "startup-exchange", noun: "listings", titleField: "company",
    summaryField: "pitch", requiredFields: ["company", "stage"],
    defaultTags: ["startup"] },
  // mapreality: geo-located reality claims (e.g. "tree planted at coords")
  { id: "mapreality", noun: "claims", titleField: "claim",
    summaryField: "evidence", requiredFields: ["claim", "lat", "lng"],
    defaultTags: ["geo"] },
  // kids-ai-content: parent-curated kid-safe content items
  { id: "kids-ai-content", noun: "items", titleField: "topic",
    summaryField: "summary", requiredFields: ["topic", "ageRange"],
    defaultTags: ["kids"] },
  // qlife: shared life-coaching prompts
  { id: "qlife", noun: "prompts", titleField: "prompt",
    summaryField: "rationale", requiredFields: ["prompt"],
    defaultTags: ["prompt"] },
  // psyapp-deps: dependency assessment public templates (anonymized)
  { id: "psyapp-deps", noun: "assessments", titleField: "title",
    summaryField: "category", requiredFields: ["title", "category"],
    defaultTags: ["psyapp"] },
  // qpersona: persona blueprint templates
  { id: "qpersona", noun: "personas", titleField: "name",
    summaryField: "blueprint", requiredFields: ["name", "traits"],
    defaultTags: ["persona"] },
  // voice-of-earth: environmental data observation submissions
  { id: "voice-of-earth", noun: "feeds", titleField: "location",
    summaryField: "observation", requiredFields: ["location", "metric"],
    defaultTags: ["env"] },
  // deepsan: deep sanitation operation logs
  { id: "deepsan", noun: "runs", titleField: "facility",
    summaryField: "method", requiredFields: ["facility", "method"],
    defaultTags: ["sanitation"] },
  // shadownet: anonymous post stubs
  { id: "shadownet", noun: "posts", titleField: "title",
    summaryField: "body", requiredFields: ["title", "body"],
    defaultTags: ["anon"] },
  // lifebox: family-archive capsule stubs (metadata only, no payload PII)
  { id: "lifebox", noun: "capsules", titleField: "label",
    summaryField: "occasion", requiredFields: ["label", "year"],
    defaultTags: ["archive"] },
];

const writeLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "mvp-concept-write" });
const readLimit  = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "mvp-concept-read"  });

function buildRouter(cfg: ConceptConfig): Router {
  const r = Router();

  // GET /<noun>?limit&offset&tag
  r.get(`/${cfg.noun}`, readLimit, async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const offset = Number(req.query.offset ?? 0);
      const tag = typeof req.query.tag === "string" ? req.query.tag : null;
      const { items, total } = await listItems(cfg.id, { limit, offset, tag });
      res.json({ items, total, moduleId: cfg.id, noun: cfg.noun });
    } catch (err) {
      res.status(500).json({ error: "list_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });

  // GET /<noun>/:itemId
  r.get(`/${cfg.noun}/:itemId`, readLimit, async (req: Request, res: Response) => {
    try {
      const item = await getItem(cfg.id, String(req.params.itemId));
      if (!item) return res.status(404).json({ error: "not_found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: "get_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });

  // POST /<noun>
  r.post(`/${cfg.noun}`, writeLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
      const required = cfg.requiredFields ?? [cfg.titleField];
      for (const f of required) {
        if (body[f] == null || body[f] === "") {
          return res.status(400).json({ error: "missing_field", field: f });
        }
      }
      const title = String(body[cfg.titleField] ?? "").slice(0, 200);
      if (!title) return res.status(400).json({ error: "missing_title", field: cfg.titleField });
      const summary = cfg.summaryField && body[cfg.summaryField]
        ? String(body[cfg.summaryField]).slice(0, 800) : null;
      const tags = Array.isArray(body.tags)
        ? (body.tags as unknown[]).map((t) => String(t)).filter(Boolean)
        : (cfg.defaultTags ?? []);
      const ownerId = typeof body.ownerId === "string" ? body.ownerId : null;
      const item = await createItem(cfg.id, { title, summary, payload: body, tags, ownerId });
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: "create_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });

  // GET /concept-stats
  r.get("/concept-stats", readLimit, async (_req: Request, res: Response) => {
    try {
      const s = await statsFor(cfg.id);
      res.json({ moduleId: cfg.id, noun: cfg.noun, ...s });
    } catch (err) {
      res.status(500).json({ error: "stats_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });

  return r;
}

/**
 * Module-specific extensions. The generic CRUD covers 80%; these add the
 * high-utility queries that make each module actually useful — geo radius
 * for mapreality, stage filter for startup-exchange, location filter for
 * voice-of-earth. Mounted on the app at full paths so they share the
 * `/api/<id>` namespace without colliding with the per-module router.
 */
function attachModuleExtensions(app: Express): void {
  app.get("/api/mapreality/claims/nearby", readLimit, async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radiusKm = Number(req.query.radiusKm ?? req.query.radius ?? 25);
      const limit = Number(req.query.limit ?? 20);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "missing_coords", hint: "pass ?lat=...&lng=...&radiusKm=..." });
      }
      if (!(radiusKm > 0) || radiusKm > 5000) {
        return res.status(400).json({ error: "bad_radius", hint: "0 < radiusKm <= 5000" });
      }
      const items = await searchByDistance("mapreality", lat, lng, radiusKm, limit);
      res.json({ items, total: items.length, moduleId: "mapreality", noun: "claims", query: { lat, lng, radiusKm } });
    } catch (err) {
      res.status(500).json({ error: "nearby_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });

  app.get("/api/startup-exchange/listings/by-stage/:stage", readLimit, async (req: Request, res: Response) => {
    try {
      const stage = String(req.params.stage || "").slice(0, 40);
      if (!stage) return res.status(400).json({ error: "missing_stage" });
      const limit = Number(req.query.limit ?? 20);
      const items = await searchByPayloadField("startup-exchange", "stage", stage, limit);
      res.json({ items, total: items.length, moduleId: "startup-exchange", noun: "listings", query: { stage } });
    } catch (err) {
      res.status(500).json({ error: "by_stage_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });

  app.get("/api/voice-of-earth/feeds/by-location", readLimit, async (req: Request, res: Response) => {
    try {
      const location = String(req.query.location || "").slice(0, 80);
      if (!location) return res.status(400).json({ error: "missing_location", hint: "pass ?location=..." });
      const limit = Number(req.query.limit ?? 20);
      const items = await searchByPayloadField("voice-of-earth", "location", location, limit);
      res.json({ items, total: items.length, moduleId: "voice-of-earth", noun: "feeds", query: { location } });
    } catch (err) {
      res.status(500).json({ error: "by_location_failed", detail: err instanceof Error ? err.message : "unknown" });
    }
  });
}

/**
 * Mount all MVP concept routers on the Express app. MUST be called BEFORE
 * the generic planningStubs loop so `/api/<id>/<noun>` paths take
 * precedence over the catch-all stub.
 */
export function mountMvpConcepts(app: Express): void {
  // Module-specific extension endpoints MUST mount BEFORE the generic
  // per-module routers — paths like `/api/mapreality/claims/nearby` would
  // otherwise be swallowed by the per-module `/:itemId` handler matching
  // `nearby` as an item id (and returning 404 from getItem). Specific
  // before generic.
  attachModuleExtensions(app);
  for (const cfg of CONCEPTS) {
    app.use(`/api/${cfg.id}`, buildRouter(cfg));
  }
}

export const MVP_CONCEPT_IDS = CONCEPTS.map((c) => c.id);
export const MVP_CONCEPTS = CONCEPTS;
