/**
 * QPersona — Digital Avatar backend router.
 *
 * Endpoints:
 *   GET  /api/qpersona/health
 *   POST /api/qpersona/personas                  — create persona
 *   GET  /api/qpersona/personas                  — list public personas (paginated)
 *   GET  /api/qpersona/personas/:alias           — get one persona
 *   PATCH /api/qpersona/personas/:alias          — update persona
 *   POST /api/qpersona/personas/:alias/ai-bio    — AI-generate bio
 *   GET  /api/qpersona/stats                     — aggregate stats
 */

import { Router, type Request, type Response } from "express";
import { getPool } from "../lib/dbPool";
import { ensureQPersonaTables, isQPersonaDbReady, getQPersonaDbError } from "../lib/ensureQPersonaTables";
import { rateLimit } from "../lib/rateLimit";
import { callProvider, getProviders, resolveProvider } from "../services/qcoreai/providers";

export const qpersonaRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureQPersonaTables(pool);
  } catch {
    // in-memory fallback active
  }
})();

// ─── Rate limiters ─────────────────────────────────────────────────────────────
const readLimit  = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "qpersona-read" });
const writeLimit = rateLimit({ windowMs: 60_000, max: 20,  keyPrefix: "qpersona-write" });
const aiLimit    = rateLimit({ windowMs: 60_000, max: 5,   keyPrefix: "qpersona-ai" });

// ─── In-memory fallback store ─────────────────────────────────────────────────
interface PersonaRecord {
  id: number;
  alias: string;
  display_name: string;
  bio: string | null;
  avatar_prompt: string | null;
  skills: string[];
  links: string[];
  visibility: "public" | "private";
  created_at: string;
  updated_at: string;
}

let _memSeq = 1;
const memPersonas = new Map<string, PersonaRecord>();

function aliasValid(alias: string): boolean {
  return /^[a-z0-9_-]{3,30}$/.test(alias);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function dbCreate(fields: {
  alias: string;
  display_name: string;
  bio?: string;
  avatar_prompt?: string;
  skills: string[];
  links: string[];
}): Promise<PersonaRecord> {
  const { rows } = await pool.query<PersonaRecord>(
    `INSERT INTO qpersona_profiles
       (alias, display_name, bio, avatar_prompt, skills, links)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     RETURNING *`,
    [
      fields.alias,
      fields.display_name,
      fields.bio ?? null,
      fields.avatar_prompt ?? null,
      JSON.stringify(fields.skills),
      JSON.stringify(fields.links),
    ]
  );
  return rows[0];
}

async function dbGet(alias: string): Promise<PersonaRecord | null> {
  const { rows } = await pool.query<PersonaRecord>(
    `SELECT * FROM qpersona_profiles WHERE alias = $1`,
    [alias]
  );
  return rows[0] ?? null;
}

async function dbUpdate(
  alias: string,
  patch: Partial<Pick<PersonaRecord, "bio" | "avatar_prompt" | "skills" | "links">>
): Promise<PersonaRecord | null> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (patch.bio !== undefined)           { sets.push(`bio = $${idx++}`);            vals.push(patch.bio); }
  if (patch.avatar_prompt !== undefined) { sets.push(`avatar_prompt = $${idx++}`);  vals.push(patch.avatar_prompt); }
  if (patch.skills !== undefined)        { sets.push(`skills = $${idx++}::jsonb`);  vals.push(JSON.stringify(patch.skills)); }
  if (patch.links !== undefined)         { sets.push(`links = $${idx++}::jsonb`);   vals.push(JSON.stringify(patch.links)); }

  if (sets.length === 0) return dbGet(alias);

  sets.push(`updated_at = NOW()`);
  vals.push(alias);

  const { rows } = await pool.query<PersonaRecord>(
    `UPDATE qpersona_profiles SET ${sets.join(", ")} WHERE alias = $${idx} RETURNING *`,
    vals
  );
  return rows[0] ?? null;
}

async function dbList(limit: number, offset: number): Promise<PersonaRecord[]> {
  const { rows } = await pool.query<PersonaRecord>(
    `SELECT * FROM qpersona_profiles WHERE visibility = 'public'
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function dbStats(): Promise<{ total: number; latest: string[] }> {
  const { rows: totRow } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM qpersona_profiles`
  );
  const { rows: latRow } = await pool.query<{ alias: string }>(
    `SELECT alias FROM qpersona_profiles ORDER BY created_at DESC LIMIT 5`
  );
  return {
    total: parseInt(totRow[0]?.count ?? "0", 10),
    latest: latRow.map((r) => r.alias),
  };
}

// ─── In-memory helpers ────────────────────────────────────────────────────────
function memCreate(fields: {
  alias: string;
  display_name: string;
  bio?: string;
  avatar_prompt?: string;
  skills: string[];
  links: string[];
}): PersonaRecord {
  const now = new Date().toISOString();
  const record: PersonaRecord = {
    id: _memSeq++,
    alias: fields.alias,
    display_name: fields.display_name,
    bio: fields.bio ?? null,
    avatar_prompt: fields.avatar_prompt ?? null,
    skills: fields.skills,
    links: fields.links,
    visibility: "public",
    created_at: now,
    updated_at: now,
  };
  memPersonas.set(fields.alias, record);
  return record;
}

function memGet(alias: string): PersonaRecord | null {
  return memPersonas.get(alias) ?? null;
}

function memUpdate(
  alias: string,
  patch: Partial<Pick<PersonaRecord, "bio" | "avatar_prompt" | "skills" | "links">>
): PersonaRecord | null {
  const rec = memPersonas.get(alias);
  if (!rec) return null;
  const updated = { ...rec, ...patch, updated_at: new Date().toISOString() };
  memPersonas.set(alias, updated);
  return updated;
}

function memList(limit: number, offset: number): PersonaRecord[] {
  return Array.from(memPersonas.values())
    .filter((p) => p.visibility === "public")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(offset, offset + limit);
}

function memStats(): { total: number; latest: string[] } {
  const all = Array.from(memPersonas.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return {
    total: all.length,
    latest: all.slice(0, 5).map((p) => p.alias),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/qpersona/health */
qpersonaRouter.get("/health", readLimit, (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "qpersona",
    db: isQPersonaDbReady() ? "postgres" : "memory",
    dbError: getQPersonaDbError(),
  });
});

/** GET /api/qpersona/stats */
qpersonaRouter.get("/stats", readLimit, async (_req: Request, res: Response) => {
  try {
    const stats = isQPersonaDbReady() ? await dbStats() : memStats();
    res.json({ ok: true, ...stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/qpersona/personas — list public personas */
qpersonaRouter.get("/personas", readLimit, async (req: Request, res: Response) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0,  0);
    const personas = isQPersonaDbReady()
      ? await dbList(limit, offset)
      : memList(limit, offset);
    res.json({ ok: true, personas, limit, offset });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/qpersona/personas — create persona */
qpersonaRouter.post("/personas", writeLimit, async (req: Request, res: Response) => {
  try {
    const { alias, displayName, bio, avatarPrompt, skills, links } = req.body ?? {};

    if (!alias || typeof alias !== "string") {
      res.status(400).json({ ok: false, error: "alias is required" });
      return;
    }
    if (!aliasValid(alias)) {
      res.status(400).json({ ok: false, error: "alias must be 3-30 chars, lowercase letters/digits/hyphens/underscores" });
      return;
    }
    if (!displayName || typeof displayName !== "string") {
      res.status(400).json({ ok: false, error: "displayName is required" });
      return;
    }

    const fields = {
      alias: alias.toLowerCase(),
      display_name: String(displayName).slice(0, 120),
      bio: bio ? String(bio).slice(0, 2000) : undefined,
      avatar_prompt: avatarPrompt ? String(avatarPrompt).slice(0, 500) : undefined,
      skills: Array.isArray(skills) ? skills.map(String).slice(0, 30) : [],
      links:  Array.isArray(links)  ? links.map(String).slice(0, 20)  : [],
    };

    let persona: PersonaRecord;
    if (isQPersonaDbReady()) {
      // Check uniqueness gracefully
      const existing = await dbGet(fields.alias);
      if (existing) {
        res.status(409).json({ ok: false, error: "alias already taken" });
        return;
      }
      persona = await dbCreate(fields);
    } else {
      if (memPersonas.has(fields.alias)) {
        res.status(409).json({ ok: false, error: "alias already taken" });
        return;
      }
      persona = memCreate(fields);
    }

    res.status(201).json({ ok: true, persona });
  } catch (e: any) {
    const msg = e?.message || "internal error";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ ok: false, error: "alias already taken" });
      return;
    }
    res.status(500).json({ ok: false, error: msg });
  }
});

/** GET /api/qpersona/personas/:alias — public profile */
qpersonaRouter.get("/personas/:alias", readLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias ?? "").toLowerCase();
    const persona = isQPersonaDbReady() ? await dbGet(alias) : memGet(alias);
    if (!persona) {
      res.status(404).json({ ok: false, error: "persona not found" });
      return;
    }
    res.json({ ok: true, persona });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** PATCH /api/qpersona/personas/:alias — update bio/skills/links/avatarPrompt */
qpersonaRouter.patch("/personas/:alias", writeLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias ?? "").toLowerCase();
    const { bio, avatarPrompt, skills, links } = req.body ?? {};

    const patch: Partial<PersonaRecord> = {};
    if (bio !== undefined)          patch.bio           = bio ? String(bio).slice(0, 2000) : null;
    if (avatarPrompt !== undefined)  patch.avatar_prompt = avatarPrompt ? String(avatarPrompt).slice(0, 500) : null;
    if (skills !== undefined)        patch.skills        = Array.isArray(skills) ? skills.map(String).slice(0, 30) : [];
    if (links !== undefined)         patch.links         = Array.isArray(links)  ? links.map(String).slice(0, 20)  : [];

    const persona = isQPersonaDbReady()
      ? await dbUpdate(alias, patch)
      : memUpdate(alias, patch);

    if (!persona) {
      res.status(404).json({ ok: false, error: "persona not found" });
      return;
    }
    res.json({ ok: true, persona });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/qpersona/personas/:alias/ai-bio — AI-generate bio */
qpersonaRouter.post("/personas/:alias/ai-bio", aiLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias ?? "").toLowerCase();
    const persona = isQPersonaDbReady() ? await dbGet(alias) : memGet(alias);
    if (!persona) {
      res.status(404).json({ ok: false, error: "persona not found" });
      return;
    }

    const providerId = resolveProvider();
    const providerDef = getProviders().find((p) => p.id === providerId);
    const modelName = providerDef?.defaultModel ?? "";

    const skillsText = (persona.skills ?? []).join(", ") || "no skills listed";
    const existingBio = persona.bio ? `Existing bio: "${persona.bio}"` : "No existing bio.";

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a professional bio writer for digital personas. " +
          "Write a concise, engaging professional bio (2-4 sentences, max 300 chars) " +
          "for the given persona based on their name, skills, and existing bio if any. " +
          "Return ONLY the bio text — no quotes, no explanation.",
      },
      {
        role: "user" as const,
        content: `Name: ${persona.display_name}\nSkills: ${skillsText}\n${existingBio}`,
      },
    ];

    const result = await callProvider(providerId, messages, modelName, 0.7);
    const generatedBio = result.reply.trim().slice(0, 500);

    // Update the persona with the generated bio
    const updated = isQPersonaDbReady()
      ? await dbUpdate(alias, { bio: generatedBio })
      : memUpdate(alias, { bio: generatedBio });

    res.json({
      ok: true,
      bio: generatedBio,
      persona: updated,
      provider: providerId,
      model: result.model,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "AI bio generation failed" });
  }
});
