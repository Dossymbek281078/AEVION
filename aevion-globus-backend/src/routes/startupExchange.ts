import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import {
  ensureStartupExchangeTables,
  isStartupExchangeDbReady,
} from "../lib/ensureStartupExchangeTables";
import {
  callProvider,
  pickConfiguredProvider,
  getProviders,
  type ChatMessage,
} from "../services/qcoreai/providers";

// ─── Setup ────────────────────────────────────────────────────────────────────

const pool = getPool();
(async () => {
  try { await ensureStartupExchangeTables(pool); }
  catch { /* silent — in-memory fallback active */ }
})();

const generalLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "startupx:general", message: "rate_limited" });
const postLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "startupx:post", message: "rate_limited" });
const aiScoreLimiter = rateLimit({ windowMs: 60_000, max: 3, keyPrefix: "startupx:aiscore", message: "rate_limited" });

export const startupExchangeRouter = Router();
startupExchangeRouter.use(generalLimiter);

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["idea", "prototype", "mvp", "scaling"] as const;
type Stage = (typeof STAGES)[number];

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 4000;
const MAX_EMAIL = 200;
const MAX_CONTACT = 500;
const MAX_MESSAGE = 2000;
const MEM_MAX_IDEAS = 50;
const MEM_MAX_INTERESTS = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiScore {
  problem: number;
  market: number;
  uniqueness: number;
  stage: number;
  potential: number;
  summary: string;
}

interface IdeaRow {
  id: number;
  title: string;
  description: string;
  stage: Stage;
  founder_email: string | null;
  contact_method: string | null;
  qright_object_id: string | null;
  content_hash: string | null;
  visibility: string;
  created_at: string;
  ai_score: AiScore | null;
  ai_scored_at: string | null;
}

interface InterestRow {
  id: number;
  idea_id: number;
  investor_email: string;
  message: string | null;
  created_at: string;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

const memIdeas = new Map<number, IdeaRow>();
const memInterests = new Map<number, InterestRow>();
let memIdeaSeq = 1;
let memInterestSeq = 1;

function memInsertIdea(row: Omit<IdeaRow, "id" | "created_at" | "ai_score" | "ai_scored_at">): IdeaRow {
  const id = memIdeaSeq++;
  const full: IdeaRow = { ...row, id, created_at: new Date().toISOString(), ai_score: null, ai_scored_at: null };
  memIdeas.set(id, full);
  // Cap to last MEM_MAX_IDEAS records.
  if (memIdeas.size > MEM_MAX_IDEAS) {
    const oldest = Math.min(...memIdeas.keys());
    memIdeas.delete(oldest);
  }
  return full;
}

function memInsertInterest(row: Omit<InterestRow, "id" | "created_at">): InterestRow {
  const id = memInterestSeq++;
  const full: InterestRow = { ...row, id, created_at: new Date().toISOString() };
  memInterests.set(id, full);
  if (memInterests.size > MEM_MAX_INTERESTS) {
    const oldest = Math.min(...memInterests.keys());
    memInterests.delete(oldest);
  }
  return full;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}

/**
 * Same hashing convention as QRight (see qright.ts:946). We dup the logic
 * here instead of importing the router to avoid a circular boot-time dep
 * AND to keep our hash stable even if QRight's canonicalisation evolves.
 */
function computeContentHash(input: {
  title: string;
  description: string;
  stage: Stage;
}): string {
  const raw = JSON.stringify({
    title: input.title,
    description: input.description,
    stage: input.stage,
  });
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Strip privacy-sensitive fields (founder_email) for public list/get responses. */
function publicView(row: IdeaRow, interest_count?: number) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    stage: row.stage,
    contact_method: row.contact_method,
    qright_object_id: row.qright_object_id,
    content_hash: row.content_hash,
    qright_protected: Boolean(row.qright_object_id || row.content_hash),
    visibility: row.visibility,
    created_at: row.created_at,
    ai_score: row.ai_score ?? null,
    ai_scored_at: row.ai_scored_at ?? null,
    ...(interest_count !== undefined ? { interest_count } : {}),
  };
}

function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

function fail(res: Response, error: string, status = 400): Response {
  return res.status(status).json({ success: false, error });
}

// ─── GET /api/startupx/health ────────────────────────────────────────────────
startupExchangeRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, dbReady: isStartupExchangeDbReady(), service: "startupx" });
});

// ─── GET /api/startupx/stats ─────────────────────────────────────────────────
startupExchangeRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    if (isStartupExchangeDbReady()) {
      const totalQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_ideas WHERE visibility='public'`,
      );
      const stageQ = await pool.query(
        `SELECT stage, COUNT(*)::int AS n FROM startup_ideas
         WHERE visibility='public' GROUP BY stage`,
      );
      const recentQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_ideas
         WHERE visibility='public' AND created_at > NOW() - INTERVAL '7 days'`,
      );
      const byStage: Record<string, number> = {};
      for (const s of STAGES) byStage[s] = 0;
      for (const row of stageQ.rows) {
        byStage[row.stage as string] = Number(row.n) || 0;
      }
      return ok(res, {
        total: totalQ.rows[0]?.n ?? 0,
        byStage,
        recentCount: recentQ.rows[0]?.n ?? 0,
      });
    }
  } catch (e) {
    console.error("[StartupX] /stats DB error", e);
  }
  // In-memory fallback
  const all = Array.from(memIdeas.values()).filter((r) => r.visibility === "public");
  const byStage: Record<string, number> = {};
  for (const s of STAGES) byStage[s] = 0;
  for (const r of all) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600_000;
  const recentCount = all.filter((r) => new Date(r.created_at).getTime() > sevenDaysAgo).length;
  return ok(res, { total: all.length, byStage, recentCount });
});

// ─── GET /api/startupx/ideas ─────────────────────────────────────────────────
startupExchangeRouter.get("/ideas", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const stageRaw = req.query.stage;
  const stage = typeof stageRaw === "string" && isStage(stageRaw) ? stageRaw : null;

  try {
    if (isStartupExchangeDbReady()) {
      // Build the filter once. Both the row query (with LIMIT/OFFSET) and the
      // separate COUNT query use it with the same $1 binding for `stage`.
      const filterArgs: unknown[] = [];
      let where = `WHERE visibility='public'`;
      if (stage) {
        filterArgs.push(stage);
        where += ` AND stage=$1`;
      }
      const rowsArgs = [...filterArgs, limit, offset];
      const limitIdx = filterArgs.length + 1;
      const offsetIdx = filterArgs.length + 2;
      const { rows } = await pool.query(
        `SELECT * FROM startup_ideas ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        rowsArgs,
      );
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_ideas ${where}`,
        filterArgs,
      );
      const typedRows = rows as IdeaRow[];
      const typedCnt = cnt as Array<{ n: number }>;
      return ok(res, {
        ideas: typedRows.map((r) => publicView(r)),
        total: typedCnt[0]?.n ?? typedRows.length,
        limit,
        offset,
      });
    }
  } catch (e) {
    console.error("[StartupX] GET /ideas DB error", e);
  }

  // In-memory fallback
  let all = Array.from(memIdeas.values()).filter((r) => r.visibility === "public");
  if (stage) all = all.filter((r) => r.stage === stage);
  all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = all.length;
  const page = all.slice(offset, offset + limit);
  return ok(res, {
    ideas: page.map((r) => publicView(r)),
    total,
    limit,
    offset,
  });
});

// ─── GET /api/startupx/ideas/:id ─────────────────────────────────────────────
startupExchangeRouter.get("/ideas/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

  try {
    if (isStartupExchangeDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM startup_ideas WHERE id=$1 AND visibility='public'`,
        [id],
      );
      const row = (rows as IdeaRow[])[0];
      if (!row) return fail(res, "not_found", 404);
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_interests WHERE idea_id=$1`,
        [id],
      );
      const typedCnt = cnt as Array<{ n: number }>;
      return ok(res, publicView(row, typedCnt[0]?.n ?? 0));
    }
  } catch (e) {
    console.error("[StartupX] GET /ideas/:id DB error", e);
  }

  const row = memIdeas.get(id);
  if (!row || row.visibility !== "public") return fail(res, "not_found", 404);
  const interest_count = Array.from(memInterests.values()).filter((i) => i.idea_id === id).length;
  return ok(res, publicView(row, interest_count));
});

// ─── POST /api/startupx/ideas ────────────────────────────────────────────────
startupExchangeRouter.post("/ideas", postLimiter, async (req: Request, res: Response) => {
  const title = clampStr(req.body?.title, MAX_TITLE);
  const description = clampStr(req.body?.description, MAX_DESCRIPTION);
  const stageRaw = req.body?.stage;
  const founderEmail = clampStr(req.body?.founderEmail, MAX_EMAIL);
  const contactMethod = clampStr(req.body?.contactMethod, MAX_CONTACT);

  if (!title) return fail(res, "title_required");
  if (!description) return fail(res, "description_required");
  if (!isStage(stageRaw)) return fail(res, `stage_invalid (one of ${STAGES.join(", ")})`);

  const stage = stageRaw;
  const contentHash = computeContentHash({ title, description, stage });
  // qright_object_id is reserved for a future direct integration; for MVP we
  // stamp the contentHash here and flag qright_protected=true on response.
  const qrightObjectId: string | null = null;
  const qrightProtected = true; // we always produce a deterministic contentHash

  try {
    if (isStartupExchangeDbReady()) {
      const { rows } = await pool.query(
        `INSERT INTO startup_ideas
         (title, description, stage, founder_email, contact_method, qright_object_id, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [title, description, stage, founderEmail, contactMethod, qrightObjectId, contentHash],
      );
      const row = (rows as IdeaRow[])[0];
      return ok(res, {
        id: row.id,
        qrightProtected,
        contentHash: row.content_hash,
        idea: publicView(row),
      }, 201);
    }
  } catch (e) {
    console.error("[StartupX] POST /ideas DB error", e);
  }

  const row = memInsertIdea({
    title,
    description,
    stage,
    founder_email: founderEmail,
    contact_method: contactMethod,
    qright_object_id: qrightObjectId,
    content_hash: contentHash,
    visibility: "public",
  });
  return ok(res, {
    id: row.id,
    qrightProtected,
    contentHash: row.content_hash,
    idea: publicView(row),
  }, 201);
});

// ─── POST /api/startupx/ideas/:id/ai-score ───────────────────────────────────
// Rate: 3/min (LLM is expensive). Gracefully degrades if AI unavailable.
// Lazy-bootstraps ai_score column on first call (ADD COLUMN IF NOT EXISTS).

let aiScoreColEnsured = false;

async function ensureAiScoreColumn(): Promise<void> {
  if (aiScoreColEnsured) return;
  try {
    await pool.query(
      `ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS ai_score JSONB`,
    );
    await pool.query(
      `ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ`,
    );
    aiScoreColEnsured = true;
  } catch {
    // Non-fatal — column may already exist or pool may be unavailable.
    aiScoreColEnsured = true;
  }
}

function parseAiScore(text: string): AiScore | null {
  try {
    // Extract JSON object from the reply (model may wrap it in markdown fences).
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const num = (k: string): number => {
      const v = Number(parsed[k]);
      return Number.isFinite(v) ? Math.min(10, Math.max(0, v)) : 0;
    };
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "";
    return {
      problem: num("problem"),
      market: num("market"),
      uniqueness: num("uniqueness"),
      stage: num("stage"),
      potential: num("potential"),
      summary,
    };
  } catch {
    return null;
  }
}

startupExchangeRouter.post(
  "/ideas/:id/ai-score",
  aiScoreLimiter,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

    // ── Fetch the idea ────────────────────────────────────────────────────────
    let idea: IdeaRow | undefined;

    if (isStartupExchangeDbReady()) {
      try {
        await ensureAiScoreColumn();
        const { rows } = await pool.query(
          `SELECT * FROM startup_ideas WHERE id=$1 AND visibility='public'`,
          [id],
        );
        idea = (rows as IdeaRow[])[0];
      } catch (e) {
        console.error("[StartupX] POST /ideas/:id/ai-score DB fetch error", e);
      }
    } else {
      idea = memIdeas.get(id);
      if (idea?.visibility !== "public") idea = undefined;
    }

    if (!idea) return fail(res, "not_found", 404);

    // ── Call QCoreAI ─────────────────────────────────────────────────────────
    const providerId = pickConfiguredProvider();
    const configured = getProviders().find((p) => p.id === providerId)?.configured ?? false;

    if (!configured || providerId === "stub") {
      return res.status(200).json({
        success: true,
        data: { id, aiScore: null, error: "ai_unavailable" },
      });
    }

    const provider = getProviders().find((p) => p.id === providerId)!;
    const model = provider.defaultModel;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Ты — эксперт по стартапам и венчурным инвестициям. Оцени стартап-идею по 5 критериям.",
      },
      {
        role: "user",
        content:
          `Название: ${idea.title}\nОписание: ${idea.description}\nСтадия: ${idea.stage}\n\n` +
          `Оцени по шкале 0-10: 1) Проблема 2) Рынок 3) Уникальность 4) Стадия 5) Потенциал. ` +
          `Ответь ТОЛЬКО JSON: {"problem":N,"market":N,"uniqueness":N,"stage":N,"potential":N,"summary":"1-2 предложения"}`,
      },
    ];

    let aiScore: AiScore | null = null;
    const scoredAt = new Date().toISOString();

    try {
      const result = await callProvider(providerId, messages, model, 0.3);
      aiScore = parseAiScore(result.reply);
    } catch (e) {
      console.error("[StartupX] QCoreAI call failed", e);
      return res.status(200).json({
        success: true,
        data: { id, aiScore: null, error: "ai_unavailable" },
      });
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    if (isStartupExchangeDbReady()) {
      try {
        await pool.query(
          `UPDATE startup_ideas SET ai_score=$1, ai_scored_at=$2 WHERE id=$3`,
          [aiScore ? JSON.stringify(aiScore) : null, scoredAt, id],
        );
      } catch (e) {
        console.error("[StartupX] POST /ideas/:id/ai-score DB save error", e);
      }
    } else {
      const existing = memIdeas.get(id);
      if (existing) {
        existing.ai_score = aiScore;
        existing.ai_scored_at = scoredAt;
      }
    }

    return ok(res, { id, aiScore, scoredAt });
  },
);

// ─── POST /api/startupx/ideas/:id/interest ──────────────────────────────────
startupExchangeRouter.post("/ideas/:id/interest", postLimiter, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "invalid_id", 400);

  const investorEmail = clampStr(req.body?.investorEmail, MAX_EMAIL);
  const message = clampStr(req.body?.message, MAX_MESSAGE);
  if (!investorEmail) return fail(res, "investorEmail_required");

  try {
    if (isStartupExchangeDbReady()) {
      const { rows: exists } = await pool.query(
        `SELECT id FROM startup_ideas WHERE id=$1 AND visibility='public'`,
        [id],
      );
      if (!(exists as Array<{ id: number }>)[0]) return fail(res, "idea_not_found", 404);

      const { rows } = await pool.query(
        `INSERT INTO startup_interests (idea_id, investor_email, message)
         VALUES ($1,$2,$3) RETURNING *`,
        [id, investorEmail, message],
      );
      const row = (rows as InterestRow[])[0];
      return ok(res, {
        id: row.id,
        ideaId: row.idea_id,
        createdAt: row.created_at,
      }, 201);
    }
  } catch (e) {
    console.error("[StartupX] POST /ideas/:id/interest DB error", e);
  }

  const idea = memIdeas.get(id);
  if (!idea || idea.visibility !== "public") return fail(res, "idea_not_found", 404);
  const row = memInsertInterest({
    idea_id: id,
    investor_email: investorEmail,
    message,
  });
  return ok(res, {
    id: row.id,
    ideaId: row.idea_id,
    createdAt: row.created_at,
  }, 201);
});

// ── MVP concept board surface ───────────────────────────────────────────────
interface StartupXConceptMessage {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

const STARTUPX_CONCEPT_MAX = 200;
const startupxConceptMessages: StartupXConceptMessage[] = [];

startupExchangeRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    module: "startupx",
    code: "STARTUPX",
    status: "mvp",
    description: "Startup ideas marketplace with investor-interest signals.",
    endpoints: {
      ideas: "/api/startupx/ideas",
      stats: "/api/startupx/stats",
      conceptMessages: "/api/startupx/concept/messages",
      conceptStats: "/api/startupx/concept-stats",
    },
    conceptMessagesCount: startupxConceptMessages.length,
    timestamp: new Date().toISOString(),
  });
});

startupExchangeRouter.get("/concept/messages", (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
  const items = startupxConceptMessages.slice(0, limit);
  res.json({ items, total: startupxConceptMessages.length, moduleId: "startupx", noun: "concept/messages" });
});

startupExchangeRouter.post("/concept/messages", postLimiter, (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
    const payload = (body.payload && typeof body.payload === "object")
      ? body.payload as Record<string, unknown>
      : body;
    const idea = String(payload.idea ?? payload.title ?? "").trim().slice(0, 200);
    if (!idea) return res.status(400).json({ error: "missing_field", field: "idea" });
    const rationale = String(payload.rationale ?? payload.summary ?? "").trim().slice(0, 800);
    const author = String(payload.author ?? "").trim().slice(0, 80);
    const tagsRaw = Array.isArray(payload.tags) ? payload.tags : ["startupx"];
    const tags = tagsRaw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6);
    const msg: StartupXConceptMessage = {
      id: crypto.randomUUID(),
      payload: { idea, rationale, author },
      tags: tags.length ? tags : ["startupx"],
      createdAt: new Date().toISOString(),
    };
    startupxConceptMessages.unshift(msg);
    if (startupxConceptMessages.length > STARTUPX_CONCEPT_MAX) {
      startupxConceptMessages.length = STARTUPX_CONCEPT_MAX;
    }
    return res.status(201).json(msg);
  } catch (err: unknown) {
    console.error("[startupx] concept_post_failed", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "concept_post_failed" });
  }
});

startupExchangeRouter.get("/concept-stats", (_req: Request, res: Response) => {
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  const last7d = startupxConceptMessages.filter(
    (m) => now - new Date(m.createdAt).getTime() <= sevenDays,
  ).length;
  const tagCounts = new Map<string, number>();
  for (const m of startupxConceptMessages) {
    for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  res.json({
    moduleId: "startupx",
    noun: "concept/messages",
    total: startupxConceptMessages.length,
    last7d,
    topTags,
  });
});
