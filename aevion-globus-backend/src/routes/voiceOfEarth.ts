import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import {
  ensureVoiceOfEarthTables,
  isVoiceOfEarthDbReady,
} from "../lib/ensureVoiceOfEarthTables";
import { VOICE_OF_EARTH_SEED, VoeSeedTrack } from "../data/voiceOfEarthSeed";

const pool = getPool();
(async () => {
  try {
    await ensureVoiceOfEarthTables(pool);
  } catch {
    /* silent — in-memory fallback active */
  }
})();

export const voiceOfEarthRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────
type Mood = "hopeful" | "peaceful" | "joyful" | "reflective" | "uplifting";
const MOODS: readonly Mood[] = [
  "hopeful",
  "peaceful",
  "joyful",
  "reflective",
  "uplifting",
] as const;

interface VoeTrack {
  id: number;
  title: string;
  artist_alias: string;
  language: string;
  lyrics: string;
  mood: Mood;
  audio_url: string | null;
  votes: number;
  status: "pending" | "published" | "flagged";
  created_at: string;
  content_hash: string | null;
}

// ─── In-memory store ──────────────────────────────────────────────────────────
const memTracks: VoeTrack[] = [];
const memVotes = new Set<string>(); // `${trackId}:${voterAlias}`
let memNextId = 1;

function seedMemory() {
  if (memTracks.length > 0) return;
  for (const t of VOICE_OF_EARTH_SEED as VoeSeedTrack[]) {
    memTracks.push({
      id: memNextId++,
      title: t.title,
      artist_alias: t.artistAlias,
      language: t.language,
      lyrics: t.lyrics,
      mood: t.mood,
      audio_url: t.audioUrl,
      votes: 0,
      status: "published",
      created_at: new Date().toISOString(),
      content_hash: null,
    });
  }
}
seedMemory();

// ─── Rate limiters ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "voe:general",
  message: "rate_limited",
});
const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "voe:submit",
  message: "rate_limited",
});
const voteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "voe:vote",
  message: "rate_limited",
});

voiceOfEarthRouter.use(generalLimiter);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidMood(m: unknown): m is Mood {
  return typeof m === "string" && (MOODS as readonly string[]).includes(m);
}

function normaliseLang(s: string): string {
  return s.toLowerCase().slice(0, 8);
}

function sanitizeAlias(s: string): string {
  return s.trim().slice(0, 60);
}

// ─── GET /api/voice-of-earth/health ──────────────────────────────────────────
voiceOfEarthRouter.get("/health", async (_req: Request, res: Response) => {
  const dbReady = isVoiceOfEarthDbReady();
  let tracksCount = memTracks.length;
  if (dbReady) {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::text AS c FROM voe_tracks WHERE status = 'published'`,
      );
      tracksCount = Number(rows[0]?.c ?? "0");
    } catch {
      /* fall through with mem count */
    }
  }
  res.json({ ok: true, dbReady, tracksCount });
});

// ─── GET /api/voice-of-earth/tracks ──────────────────────────────────────────
voiceOfEarthRouter.get("/tracks", async (req: Request, res: Response) => {
  const lang = typeof req.query.lang === "string" ? req.query.lang : null;
  const mood = typeof req.query.mood === "string" ? req.query.mood : null;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  if (isVoiceOfEarthDbReady()) {
    try {
      const conditions: string[] = [`status = 'published'`];
      const args: unknown[] = [];
      let idx = 1;
      if (lang) {
        conditions.push(`language = $${idx++}`);
        args.push(normaliseLang(lang));
      }
      if (mood && isValidMood(mood)) {
        conditions.push(`mood = $${idx++}`);
        args.push(mood);
      }
      const where = `WHERE ${conditions.join(" AND ")}`;
      const { rows } = await pool.query(
        `SELECT * FROM voe_tracks ${where}
         ORDER BY votes DESC, created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...args, limit, offset],
      );
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::text AS c FROM voe_tracks ${where}`,
        args,
      );
      return res.json({
        items: rows,
        total: Number(cnt[0]?.c ?? "0"),
        backend: "postgres",
      });
    } catch (e) {
      console.error("[VoiceOfEarth] GET /tracks DB error", e);
    }
  }

  let items = memTracks.filter((t) => t.status === "published");
  if (lang) items = items.filter((t) => t.language === normaliseLang(lang));
  if (mood && isValidMood(mood)) items = items.filter((t) => t.mood === mood);
  items = items.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return b.created_at.localeCompare(a.created_at);
  });
  const total = items.length;
  items = items.slice(offset, offset + limit);
  res.json({ items, total, backend: "memory" });
});

// ─── GET /api/voice-of-earth/tracks/:id ──────────────────────────────────────
voiceOfEarthRouter.get("/tracks/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "invalid id" });
  }
  if (isVoiceOfEarthDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM voe_tracks WHERE id = $1`,
        [id],
      );
      if (rows[0]) return res.json({ track: rows[0] });
      return res.status(404).json({ error: "not_found" });
    } catch (e) {
      console.error("[VoiceOfEarth] GET /tracks/:id DB error", e);
    }
  }
  const track = memTracks.find((t) => t.id === id);
  if (!track) return res.status(404).json({ error: "not_found" });
  res.json({ track });
});

// ─── POST /api/voice-of-earth/tracks ─────────────────────────────────────────
voiceOfEarthRouter.post(
  "/tracks",
  submitLimiter,
  async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      title?: unknown;
      artistAlias?: unknown;
      language?: unknown;
      lyrics?: unknown;
      mood?: unknown;
      audioUrl?: unknown;
    };

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const artistAlias =
      typeof body.artistAlias === "string"
        ? sanitizeAlias(body.artistAlias)
        : "";
    const language =
      typeof body.language === "string" ? normaliseLang(body.language) : "";
    const lyrics = typeof body.lyrics === "string" ? body.lyrics.trim() : "";
    const mood = body.mood;
    const audioUrl =
      typeof body.audioUrl === "string" && body.audioUrl.trim()
        ? body.audioUrl.trim().slice(0, 500)
        : null;

    if (!title || title.length > 200) {
      return res.status(400).json({ error: "title required (1..200 chars)" });
    }
    if (!artistAlias) {
      return res.status(400).json({ error: "artistAlias required" });
    }
    if (!language || language.length < 2) {
      return res.status(400).json({ error: "language required" });
    }
    if (!lyrics || lyrics.length > 10000) {
      return res.status(400).json({ error: "lyrics required (1..10000 chars)" });
    }
    if (!isValidMood(mood)) {
      return res
        .status(400)
        .json({ error: `mood must be one of ${MOODS.join(", ")}` });
    }

    const titleStored = title.slice(0, 200);

    const contentHash = crypto
      .createHash("sha256")
      .update(titleStored + "|" + artistAlias + "|" + lyrics)
      .digest("hex");

    if (isVoiceOfEarthDbReady()) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO voe_tracks (title, artist_alias, language, lyrics, mood, audio_url, status, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, 'published', $7)
           RETURNING *`,
          [titleStored, artistAlias, language, lyrics, mood, audioUrl, contentHash],
        );
        return res.status(201).json({ track: rows[0], contentHash });
      } catch (e) {
        console.error("[VoiceOfEarth] POST /tracks DB error", e);
      }
    }

    const track: VoeTrack = {
      id: memNextId++,
      title: titleStored,
      artist_alias: artistAlias,
      language,
      lyrics,
      mood,
      audio_url: audioUrl,
      votes: 0,
      status: "published",
      created_at: new Date().toISOString(),
      content_hash: contentHash,
    };
    memTracks.push(track);
    // keep last 100 in memory
    if (memTracks.length > 100) memTracks.splice(0, memTracks.length - 100);
    res.status(201).json({ track, contentHash });
  },
);

// ─── POST /api/voice-of-earth/tracks/:id/vote ────────────────────────────────
voiceOfEarthRouter.post(
  "/tracks/:id/vote",
  voteLimiter,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "invalid id" });
    }
    const body = (req.body || {}) as { voterAlias?: unknown };
    const voterAlias =
      typeof body.voterAlias === "string" ? sanitizeAlias(body.voterAlias) : "";
    if (!voterAlias) {
      return res.status(400).json({ error: "voterAlias required" });
    }

    if (isVoiceOfEarthDbReady()) {
      try {
        // Check track exists
        const { rowCount: trackRows } = await pool.query(
          `SELECT 1 FROM voe_tracks WHERE id = $1`,
          [id],
        );
        if (!trackRows) return res.status(404).json({ error: "not_found" });

        const insert = await pool.query(
          `INSERT INTO voe_votes (track_id, voter_alias)
           VALUES ($1, $2)
           ON CONFLICT (track_id, voter_alias) DO NOTHING
           RETURNING id`,
          [id, voterAlias],
        );
        if ((insert.rowCount ?? 0) === 0) {
          const { rows } = await pool.query(
            `SELECT votes FROM voe_tracks WHERE id = $1`,
            [id],
          );
          return res
            .status(409)
            .json({ error: "already_voted", votes: rows[0]?.votes ?? 0 });
        }
        const { rows } = await pool.query(
          `UPDATE voe_tracks SET votes = votes + 1 WHERE id = $1 RETURNING votes`,
          [id],
        );
        return res.json({ ok: true, votes: rows[0]?.votes ?? 0 });
      } catch (e) {
        console.error("[VoiceOfEarth] POST /tracks/:id/vote DB error", e);
      }
    }

    const track = memTracks.find((t) => t.id === id);
    if (!track) return res.status(404).json({ error: "not_found" });
    const key = `${id}:${voterAlias}`;
    if (memVotes.has(key)) {
      return res.status(409).json({ error: "already_voted", votes: track.votes });
    }
    memVotes.add(key);
    track.votes += 1;
    res.json({ ok: true, votes: track.votes });
  },
);

// ─── GET /api/voice-of-earth/stats ───────────────────────────────────────────
voiceOfEarthRouter.get("/stats", async (_req: Request, res: Response) => {
  if (isVoiceOfEarthDbReady()) {
    try {
      const [tot, byLang, byMood, top] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::text AS c FROM voe_tracks WHERE status='published'`,
        ),
        pool.query(
          `SELECT language, COUNT(*)::text AS c FROM voe_tracks
           WHERE status='published' GROUP BY language`,
        ),
        pool.query(
          `SELECT mood, COUNT(*)::text AS c FROM voe_tracks
           WHERE status='published' GROUP BY mood`,
        ),
        pool.query(
          `SELECT id, title, artist_alias, language, mood, votes
           FROM voe_tracks WHERE status='published'
           ORDER BY votes DESC, created_at DESC LIMIT 5`,
        ),
      ]);
      const byLanguage: Record<string, number> = {};
      for (const r of byLang.rows as Array<{ language: string; c: string }>) byLanguage[r.language] = Number(r.c);
      const byMoodObj: Record<string, number> = {};
      for (const r of byMood.rows as Array<{ mood: string; c: string }>) byMoodObj[r.mood] = Number(r.c);
      return res.json({
        total: Number(tot.rows[0]?.c ?? "0"),
        byLanguage,
        byMood: byMoodObj,
        topTracks: top.rows,
      });
    } catch (e) {
      console.error("[VoiceOfEarth] /stats DB error", e);
    }
  }
  const tracks = memTracks.filter((t) => t.status === "published");
  const byLanguage: Record<string, number> = {};
  const byMood: Record<string, number> = {};
  for (const t of tracks) {
    byLanguage[t.language] = (byLanguage[t.language] ?? 0) + 1;
    byMood[t.mood] = (byMood[t.mood] ?? 0) + 1;
  }
  const topTracks = [...tracks]
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist_alias: t.artist_alias,
      language: t.language,
      mood: t.mood,
      votes: t.votes,
    }));
  res.json({ total: tracks.length, byLanguage, byMood, topTracks });
});

// ── MVP concept board surface ───────────────────────────────────────────────
interface VoeConceptMessage {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

const VOE_CONCEPT_MAX = 200;
const voeConceptMessages: VoeConceptMessage[] = [];

voiceOfEarthRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    module: "voice-of-earth",
    code: "VOE",
    status: "mvp",
    description: "Voice of Earth: indigenous-language tracks library with verifiable provenance + concept board.",
    endpoints: {
      tracks: "/api/voe/tracks",
      stats: "/api/voe/stats",
      conceptMessages: "/api/voe/concept/messages",
      conceptStats: "/api/voe/concept-stats",
    },
    conceptMessagesCount: voeConceptMessages.length,
    timestamp: new Date().toISOString(),
  });
});

voiceOfEarthRouter.get("/concept/messages", (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
  const items = voeConceptMessages.slice(0, limit);
  res.json({ items, total: voeConceptMessages.length, moduleId: "voe", noun: "concept/messages" });
});

voiceOfEarthRouter.post("/concept/messages", submitLimiter, (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
    const payload = (body.payload && typeof body.payload === "object")
      ? body.payload as Record<string, unknown>
      : body;
    const idea = String(payload.idea ?? payload.title ?? "").trim().slice(0, 200);
    if (!idea) return res.status(400).json({ error: "missing_field", field: "idea" });
    const rationale = String(payload.rationale ?? payload.summary ?? "").trim().slice(0, 800);
    const author = String(payload.author ?? "").trim().slice(0, 80);
    const tagsRaw = Array.isArray(payload.tags) ? payload.tags : ["voe"];
    const tags = tagsRaw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6);
    const msg: VoeConceptMessage = {
      id: crypto.randomUUID(),
      payload: { idea, rationale, author },
      tags: tags.length ? tags : ["voe"],
      createdAt: new Date().toISOString(),
    };
    voeConceptMessages.unshift(msg);
    if (voeConceptMessages.length > VOE_CONCEPT_MAX) {
      voeConceptMessages.length = VOE_CONCEPT_MAX;
    }
    return res.status(201).json(msg);
  } catch (err: unknown) {
    console.error("[voe] concept_post_failed", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "concept_post_failed" });
  }
});

voiceOfEarthRouter.get("/concept-stats", (_req: Request, res: Response) => {
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  const last7d = voeConceptMessages.filter(
    (m) => now - new Date(m.createdAt).getTime() <= sevenDays,
  ).length;
  const tagCounts = new Map<string, number>();
  for (const m of voeConceptMessages) {
    for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  res.json({
    moduleId: "voe",
    noun: "concept/messages",
    total: voeConceptMessages.length,
    last7d,
    topTags,
  });
});
