/**
 * Kids AI Content — backend MVP.
 *
 * Routes:
 *   GET  /api/kids-ai/health
 *   GET  /api/kids-ai/stats
 *   GET  /api/kids-ai/lessons                — list (filter by lang/age/category)
 *   GET  /api/kids-ai/lessons/:id            — full lesson with content_md
 *   POST /api/kids-ai/ask                    — child question to AI (LLM-backed)
 *   POST /api/kids-ai/progress               — record completion
 *   GET  /api/kids-ai/progress/:childAlias   — list child's completed lessons
 *
 * Storage: Postgres when available, falls back to in-memory (seed-backed).
 * The in-memory map is materialised from `KIDS_AI_SEED_LESSONS` at import
 * time so list/detail endpoints work even if Postgres is offline.
 *
 * Privacy: `childAlias` is a self-chosen pseudonym (e.g. "tiger42"). The
 * API never stores e-mail, parent identity or any other PII. We also
 * clamp every alias to 64 chars and strip control characters.
 */

import { Router, Request, Response } from "express";

import { getPool } from "../lib/dbPool";
import {
  ensureKidsAiTables,
  isKidsAiDbReady,
} from "../lib/ensureKidsAiTables";
import { rateLimit } from "../lib/rateLimit";
import {
  callProvider,
  getProviders,
  type ChatMessage,
} from "../services/qcoreai/providers";
import {
  KIDS_AI_SEED_LESSONS,
  type KidsAiLanguage,
  type KidsAiSeedLesson,
} from "../data/kidsAiSeed";

export const kidsAiContentRouter = Router();

const pool = getPool();

// Bootstrap tables (and seed) — fire-and-forget, errors flip dbReady=false.
(async () => {
  try {
    await ensureKidsAiTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

// ─── Types ──────────────────────────────────────────────────────────────

interface KidsLesson {
  id: number;
  title: string;
  description: string;
  age_min: number;
  age_max: number;
  language: KidsAiLanguage;
  category: string;
  content_md: string;
  ai_prompt: string | null;
  created_at: string;
}

interface KidsProgress {
  id: number;
  child_alias: string;
  lesson_id: number;
  completed_at: string;
  score: number | null;
}

// ─── In-memory store (materialise seed once) ────────────────────────────

function seedToLesson(s: KidsAiSeedLesson, idx: number): KidsLesson {
  return {
    id: idx + 1,
    title: s.title,
    description: s.description,
    age_min: s.ageMin,
    age_max: s.ageMax,
    language: s.language,
    category: s.category,
    content_md: s.contentMd,
    ai_prompt: s.aiPrompt,
    created_at: new Date().toISOString(),
  };
}

const memLessons: KidsLesson[] = KIDS_AI_SEED_LESSONS.map(seedToLesson);
const memProgress: KidsProgress[] = [];
let memProgressSeq = 1;

// ─── Helpers ────────────────────────────────────────────────────────────

function sanitizeAlias(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Strip ASCII control chars (low 32 + DEL). Keep letters, digits,
  // punctuation, spaces, unicode and emoji a kid might pick.
  let cleaned = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code !== 127) cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, 64);
  if (!cleaned) return null;
  return cleaned;
}

function sanitizeLang(raw: unknown): KidsAiLanguage | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase();
  if (v === "ru" || v === "en" || v === "kz") return v;
  return null;
}

function clampNum(raw: unknown, min: number, max: number, def: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function paramStr(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

function fallbackAnswer(lang: KidsAiLanguage): string {
  if (lang === "en") return "I'm thinking — try again in a moment!";
  if (lang === "kz") return "Мен ойланып жатырмын, аздан кейін қайта сұра!";
  return "Я пока думаю, попробуй позже";
}

// Apply a moderate global rate limit. POST /ask gets an extra, stricter
// window because LLM calls cost real money.
const globalLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "kidsai",
  message: "Too many requests to kids-ai",
});
const askLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "kidsai-ask",
  message: "Too many AI questions — wait a moment",
});

kidsAiContentRouter.use(globalLimit);

// ─── GET /health ────────────────────────────────────────────────────────

kidsAiContentRouter.get("/health", async (_req: Request, res: Response) => {
  let lessonsCount = memLessons.length;
  if (isKidsAiDbReady()) {
    try {
      const r = await pool.query(
        "SELECT COUNT(*)::text AS count FROM kids_lessons",
      );
      const row = r.rows[0] as { count?: string } | undefined;
      lessonsCount = Number(row?.count ?? lessonsCount);
    } catch {
      // fall through
    }
  }
  res.json({
    ok: true,
    module: "kids-ai-content",
    dbReady: isKidsAiDbReady(),
    lessonsCount,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /stats ─────────────────────────────────────────────────────────

kidsAiContentRouter.get("/stats", async (_req: Request, res: Response) => {
  if (isKidsAiDbReady()) {
    try {
      const total = await pool.query(
        "SELECT COUNT(*)::text AS count FROM kids_lessons",
      );
      const langs = await pool.query(
        "SELECT COUNT(DISTINCT language)::text AS count FROM kids_lessons",
      );
      const cats = await pool.query(
        "SELECT COUNT(DISTINCT category)::text AS count FROM kids_lessons",
      );
      const totalRow = total.rows[0] as { count?: string } | undefined;
      const langsRow = langs.rows[0] as { count?: string } | undefined;
      const catsRow = cats.rows[0] as { count?: string } | undefined;
      res.json({
        totalLessons: Number(totalRow?.count ?? 0),
        languages: Number(langsRow?.count ?? 0),
        categories: Number(catsRow?.count ?? 0),
        source: "postgres",
      });
      return;
    } catch {
      // fall through
    }
  }
  const langs = new Set(memLessons.map((l) => l.language)).size;
  const cats = new Set(memLessons.map((l) => l.category)).size;
  res.json({
    totalLessons: memLessons.length,
    languages: langs,
    categories: cats,
    source: "memory",
  });
});

// ─── GET /lessons ───────────────────────────────────────────────────────

kidsAiContentRouter.get("/lessons", async (req: Request, res: Response) => {
  const lang = sanitizeLang(req.query.lang);
  const ageMin = req.query.ageMin !== undefined
    ? clampNum(req.query.ageMin, 0, 99, 0)
    : null;
  const ageMax = req.query.ageMax !== undefined
    ? clampNum(req.query.ageMax, 0, 99, 99)
    : null;
  const category =
    typeof req.query.category === "string" && req.query.category.trim()
      ? req.query.category.trim().slice(0, 40)
      : null;
  const limit = clampNum(req.query.limit, 1, 100, 20);

  if (isKidsAiDbReady()) {
    try {
      const conds: string[] = [];
      const params: unknown[] = [];
      if (lang) {
        params.push(lang);
        conds.push(`language = $${params.length}`);
      }
      if (category) {
        params.push(category);
        conds.push(`category = $${params.length}`);
      }
      if (ageMin !== null) {
        params.push(ageMin);
        conds.push(`age_max >= $${params.length}`);
      }
      if (ageMax !== null) {
        params.push(ageMax);
        conds.push(`age_min <= $${params.length}`);
      }
      params.push(limit);
      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const rows = await pool.query(
        `SELECT id, title, description, age_min, age_max, language, category, ai_prompt, created_at
         FROM kids_lessons
         ${where}
         ORDER BY id ASC
         LIMIT $${params.length}`,
        params,
      );
      // Withhold content_md from list view (keep payloads small).
      res.json({
        lessons: rows.rows as KidsLesson[],
        total: rows.rowCount ?? rows.rows.length,
        source: "postgres",
      });
      return;
    } catch {
      // fall through
    }
  }

  let list = memLessons.slice();
  if (lang) list = list.filter((l) => l.language === lang);
  if (category) list = list.filter((l) => l.category === category);
  if (ageMin !== null) list = list.filter((l) => l.age_max >= ageMin);
  if (ageMax !== null) list = list.filter((l) => l.age_min <= ageMax);
  list = list.slice(0, limit);
  res.json({
    lessons: list.map(({ content_md: _drop, ...rest }) => {
      void _drop;
      return rest;
    }),
    total: list.length,
    source: "memory",
  });
});

// ─── GET /lessons/:id ───────────────────────────────────────────────────

kidsAiContentRouter.get("/lessons/:id", async (req: Request, res: Response) => {
  const id = Number(paramStr(req, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "id must be a positive integer" });
    return;
  }

  if (isKidsAiDbReady()) {
    try {
      const row = await pool.query(
        `SELECT * FROM kids_lessons WHERE id = $1`,
        [id],
      );
      if (row.rows.length === 0) {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }
      res.json({ lesson: row.rows[0] as KidsLesson });
      return;
    } catch {
      // fall through
    }
  }

  const lesson = memLessons.find((l) => l.id === id);
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  res.json({ lesson });
});

// ─── POST /ask ──────────────────────────────────────────────────────────

kidsAiContentRouter.post(
  "/ask",
  askLimit,
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      lessonId?: unknown;
      question?: unknown;
      lang?: unknown;
    };

    const lessonId = Number(body.lessonId);
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    const lang = sanitizeLang(body.lang) ?? "ru";

    if (!question) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    if (question.length > 500) {
      res.status(400).json({ error: "question must be <= 500 chars" });
      return;
    }

    // Pull lesson context (best-effort — answer is still useful without it).
    let lessonContext: KidsLesson | null = null;
    if (Number.isFinite(lessonId) && lessonId > 0) {
      if (isKidsAiDbReady()) {
        try {
          const r = await pool.query(
            "SELECT * FROM kids_lessons WHERE id = $1",
            [lessonId],
          );
          lessonContext = (r.rows[0] as KidsLesson | undefined) ?? null;
        } catch {
          // fall through
        }
      }
      if (!lessonContext) {
        lessonContext = memLessons.find((l) => l.id === lessonId) ?? null;
      }
    }

    const langName =
      lang === "en" ? "English" : lang === "kz" ? "Kazakh (қазақша)" : "Russian";

    const baseSystem =
      `Ты — добрый детский учитель. Отвечай ПРОСТО, безопасно, на языке: ${langName}. ` +
      `Никогда не пиши про насилие, оружие, политику, взрослые темы, наркотики, алкоголь. ` +
      `Если вопрос неуместен — мягко предложи спросить у мамы или папы. ` +
      `Используй короткие предложения и эмодзи. Длина ответа — до 150 слов.`;
    const lessonSystem = lessonContext?.ai_prompt
      ? `${baseSystem}\n\nКонтекст урока «${lessonContext.title}»:\n${lessonContext.ai_prompt}`
      : baseSystem;

    const messages: ChatMessage[] = [
      { role: "system", content: lessonSystem },
      { role: "user", content: question },
    ];

    const providers = getProviders().filter((p) => p.configured);
    if (providers.length === 0) {
      res.json({
        answer: fallbackAnswer(lang),
        provider: "fallback",
        model: null,
      });
      return;
    }

    try {
      const provider = providers[0];
      const result = await callProvider(
        provider.id,
        messages,
        provider.defaultModel,
        0.7,
      );
      res.json({
        answer: result.reply || fallbackAnswer(lang),
        provider: provider.id,
        model: result.model,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "provider failure";
      console.warn("[KidsAI] callProvider failed:", msg);
      res.json({
        answer: fallbackAnswer(lang),
        provider: "fallback",
        model: null,
        note: "Provider unavailable — using fallback.",
      });
    }
  },
);

// ─── POST /progress ─────────────────────────────────────────────────────

kidsAiContentRouter.post("/progress", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    childAlias?: unknown;
    lessonId?: unknown;
    score?: unknown;
  };

  const alias = sanitizeAlias(body.childAlias);
  const lessonId = Number(body.lessonId);
  const score =
    body.score === undefined || body.score === null
      ? null
      : clampNum(body.score, 0, 100, 0);

  if (!alias) {
    res.status(400).json({ error: "childAlias is required (1-64 chars)" });
    return;
  }
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    res.status(400).json({ error: "lessonId must be a positive integer" });
    return;
  }

  if (isKidsAiDbReady()) {
    try {
      // Validate lesson exists before insert (FK would catch it, but
      // a 404 is friendlier than a 500).
      const exists = await pool.query(
        "SELECT 1 FROM kids_lessons WHERE id = $1",
        [lessonId],
      );
      if (exists.rows.length === 0) {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }
      const inserted = await pool.query(
        `INSERT INTO kids_progress (child_alias, lesson_id, score)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [alias, lessonId, score],
      );
      res.status(201).json({ progress: inserted.rows[0] as KidsProgress });
      return;
    } catch {
      // fall through
    }
  }

  if (!memLessons.some((l) => l.id === lessonId)) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  const rec: KidsProgress = {
    id: memProgressSeq++,
    child_alias: alias,
    lesson_id: lessonId,
    completed_at: new Date().toISOString(),
    score,
  };
  memProgress.push(rec);
  res.status(201).json({ progress: rec });
});

// ─── GET /progress/:childAlias ──────────────────────────────────────────

kidsAiContentRouter.get(
  "/progress/:childAlias",
  async (req: Request, res: Response) => {
    const alias = sanitizeAlias(paramStr(req, "childAlias"));
    if (!alias) {
      res.status(400).json({ error: "invalid childAlias" });
      return;
    }

    if (isKidsAiDbReady()) {
      try {
        const rows = await pool.query(
          `SELECT p.id, p.child_alias, p.lesson_id, p.completed_at, p.score,
                  l.title
             FROM kids_progress p
             JOIN kids_lessons l ON l.id = p.lesson_id
            WHERE p.child_alias = $1
            ORDER BY p.completed_at DESC
            LIMIT 100`,
          [alias],
        );
        res.json({
          childAlias: alias,
          progress: rows.rows as (KidsProgress & { title: string })[],
          total: rows.rowCount ?? rows.rows.length,
        });
        return;
      } catch {
        // fall through
      }
    }

    const list = memProgress
      .filter((p) => p.child_alias === alias)
      .map((p) => ({
        ...p,
        title: memLessons.find((l) => l.id === p.lesson_id)?.title ?? "",
      }));
    res.json({
      childAlias: alias,
      progress: list,
      total: list.length,
    });
  },
);
