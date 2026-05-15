import { Router } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { ensureQMediaTables } from "../lib/ensureQMediaTables";
import { getPool } from "../lib/dbPool";
import { callProvider, getProviders } from "../services/qcoreai/providers";

const pool = getPool();
export const qmediaRouter = Router();

type TrackRow = { id: string; userId: string; title: string; artist: string; genre: string; duration: number; url: string | null; coverUrl: string | null; lyrics: string | null; playCount: number; isPublic: boolean; tags: string[]; createdAt: string; updatedAt: string };
type PlaylistCollaborator = { userId: string; canEdit: boolean };
type PlaylistRow = { id: string; userId: string; name: string; description: string | null; isPublic: boolean; trackIds: string[]; collaborators?: PlaylistCollaborator[]; createdAt: string; updatedAt: string };
type VideoRow = { id: string; userId: string; title: string; description: string | null; url: string | null; thumbnailUrl: string | null; duration: number; viewCount: number; isPublic: boolean; category: string; tags: string[]; createdAt: string; updatedAt: string };

const memTracks = new Map<string, TrackRow>();
const memPlaylists = new Map<string, PlaylistRow>();
const memVideos = new Map<string, VideoRow>();
const memLikes = new Map<string, boolean>();

function nowIso() { return new Date().toISOString(); }
function uid() { return crypto.randomUUID(); }

qmediaRouter.use(async (_req, _res, next) => {
  await ensureQMediaTables(pool).catch(() => {});
  next();
});

/* ── Tracks ── */

qmediaRouter.get("/tracks", async (req, res) => {
  try {
    const genre = typeof req.query.genre === "string" ? req.query.genre : null;
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : null;
    const limit = Math.min(50, Number(req.query.limit) || 20);
    let tracks = Array.from(memTracks.values()).filter(t => t.isPublic);
    if (genre) tracks = tracks.filter(t => t.genre === genre);
    if (q) tracks = tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    res.json({ items: tracks.sort((a, b) => b.playCount - a.playCount).slice(0, limit) });
  } catch { res.status(500).json({ error: "list tracks failed" }); }
});

qmediaRouter.get("/me/tracks", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    res.json({ items: Array.from(memTracks.values()).filter(t => t.userId === auth.sub).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch { res.status(500).json({ error: "list my tracks failed" }); }
});

qmediaRouter.post("/me/tracks", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { title, artist, genre, duration, url, coverUrl, lyrics, isPublic, tags } = req.body || {};
    if (!title || typeof title !== "string") return res.status(400).json({ error: "title required" });
    const track: TrackRow = { id: uid(), userId: auth.sub, title: String(title).slice(0, 200), artist: typeof artist === "string" ? artist.slice(0, 200) : "", genre: typeof genre === "string" ? genre : "other", duration: typeof duration === "number" ? duration : 0, url: typeof url === "string" ? url : null, coverUrl: typeof coverUrl === "string" ? coverUrl : null, lyrics: typeof lyrics === "string" ? lyrics.slice(0, 10000) : null, playCount: 0, isPublic: Boolean(isPublic), tags: Array.isArray(tags) ? tags.slice(0, 10).map(String) : [], createdAt: nowIso(), updatedAt: nowIso() };
    memTracks.set(track.id, track);
    res.status(201).json(track);
  } catch { res.status(500).json({ error: "create track failed" }); }
});

qmediaRouter.patch("/me/tracks/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const track = memTracks.get(req.params.id);
    if (!track || track.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    const { title, artist, genre, url, coverUrl, lyrics, isPublic, tags } = req.body || {};
    if (title) track.title = String(title).slice(0, 200);
    if (artist !== undefined) track.artist = String(artist).slice(0, 200);
    if (genre) track.genre = String(genre);
    if (url !== undefined) track.url = url ? String(url) : null;
    if (coverUrl !== undefined) track.coverUrl = coverUrl ? String(coverUrl) : null;
    if (lyrics !== undefined) track.lyrics = lyrics ? String(lyrics).slice(0, 10000) : null;
    if (isPublic !== undefined) track.isPublic = Boolean(isPublic);
    if (Array.isArray(tags)) track.tags = tags.slice(0, 10).map(String);
    track.updatedAt = nowIso();
    res.json(track);
  } catch { res.status(500).json({ error: "update track failed" }); }
});

qmediaRouter.delete("/me/tracks/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const track = memTracks.get(req.params.id);
    if (!track || track.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    memTracks.delete(req.params.id);
    res.json({ deleted: true });
  } catch { res.status(500).json({ error: "delete track failed" }); }
});

qmediaRouter.post("/tracks/:id/play", async (req, res) => {
  try {
    const track = memTracks.get(req.params.id);
    if (!track) return res.status(404).json({ error: "not found" });
    track.playCount++;
    res.json({ playCount: track.playCount });
  } catch { res.status(500).json({ error: "play failed" }); }
});

/* ── Playlists ── */

qmediaRouter.get("/playlists", async (_req, res) => {
  try {
    res.json({ items: Array.from(memPlaylists.values()).filter(p => p.isPublic).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20) });
  } catch { res.status(500).json({ error: "list playlists failed" }); }
});

qmediaRouter.get("/me/playlists", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    res.json({ items: Array.from(memPlaylists.values()).filter(p => p.userId === auth.sub).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch { res.status(500).json({ error: "list my playlists failed" }); }
});

qmediaRouter.post("/me/playlists", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { name, description, isPublic } = req.body || {};
    if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
    const playlist: PlaylistRow = { id: uid(), userId: auth.sub, name: name.slice(0, 100), description: description ? String(description).slice(0, 500) : null, isPublic: Boolean(isPublic), trackIds: [], createdAt: nowIso(), updatedAt: nowIso() };
    memPlaylists.set(playlist.id, playlist);
    res.status(201).json(playlist);
  } catch { res.status(500).json({ error: "create playlist failed" }); }
});

qmediaRouter.post("/me/playlists/:id/tracks", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const playlist = memPlaylists.get(req.params.id);
    if (!playlist) return res.status(404).json({ error: "not found" });
    // Allow owner OR collaborator with canEdit=true
    const isOwner = playlist.userId === auth.sub;
    const isEditor = (playlist.collaborators ?? []).some((c) => c.userId === auth.sub && c.canEdit);
    if (!isOwner && !isEditor) return res.status(403).json({ error: "forbidden" });
    const { trackId } = req.body || {};
    if (!trackId) return res.status(400).json({ error: "trackId required" });
    if (!playlist.trackIds.includes(String(trackId))) playlist.trackIds.push(String(trackId));
    playlist.updatedAt = nowIso();
    res.json(playlist);
  } catch { res.status(500).json({ error: "add track failed" }); }
});

qmediaRouter.delete("/me/playlists/:id/tracks/:trackId", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const playlist = memPlaylists.get(req.params.id);
    if (!playlist || playlist.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    playlist.trackIds = playlist.trackIds.filter(id => id !== req.params.trackId);
    playlist.updatedAt = nowIso();
    res.json(playlist);
  } catch { res.status(500).json({ error: "remove track failed" }); }
});

qmediaRouter.delete("/me/playlists/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const playlist = memPlaylists.get(req.params.id);
    if (!playlist || playlist.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    memPlaylists.delete(req.params.id);
    res.json({ deleted: true });
  } catch { res.status(500).json({ error: "delete playlist failed" }); }
});

/* ── Videos ── */

qmediaRouter.get("/videos", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : null;
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : null;
    const limit = Math.min(50, Number(req.query.limit) || 20);
    let videos = Array.from(memVideos.values()).filter(v => v.isPublic);
    if (category) videos = videos.filter(v => v.category === category);
    if (q) videos = videos.filter(v => v.title.toLowerCase().includes(q));
    res.json({ items: videos.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit) });
  } catch { res.status(500).json({ error: "list videos failed" }); }
});

qmediaRouter.get("/me/videos", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    res.json({ items: Array.from(memVideos.values()).filter(v => v.userId === auth.sub).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch { res.status(500).json({ error: "list my videos failed" }); }
});

qmediaRouter.post("/me/videos", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { title, description, url, thumbnailUrl, duration, category, isPublic, tags } = req.body || {};
    if (!title || typeof title !== "string") return res.status(400).json({ error: "title required" });
    const video: VideoRow = { id: uid(), userId: auth.sub, title: title.slice(0, 200), description: description ? String(description).slice(0, 1000) : null, url: url ? String(url) : null, thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null, duration: typeof duration === "number" ? duration : 0, viewCount: 0, isPublic: Boolean(isPublic), category: typeof category === "string" ? category : "other", tags: Array.isArray(tags) ? tags.slice(0, 10).map(String) : [], createdAt: nowIso(), updatedAt: nowIso() };
    memVideos.set(video.id, video);
    res.status(201).json(video);
  } catch { res.status(500).json({ error: "create video failed" }); }
});

qmediaRouter.patch("/me/videos/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const video = memVideos.get(req.params.id);
    if (!video || video.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    const { title, description, url, thumbnailUrl, isPublic, category } = req.body || {};
    if (title) video.title = String(title).slice(0, 200);
    if (description !== undefined) video.description = description ? String(description).slice(0, 1000) : null;
    if (url !== undefined) video.url = url ? String(url) : null;
    if (thumbnailUrl !== undefined) video.thumbnailUrl = thumbnailUrl ? String(thumbnailUrl) : null;
    if (isPublic !== undefined) video.isPublic = Boolean(isPublic);
    if (category) video.category = String(category);
    video.updatedAt = nowIso();
    res.json(video);
  } catch { res.status(500).json({ error: "update video failed" }); }
});

qmediaRouter.post("/videos/:id/view", async (req, res) => {
  try {
    const video = memVideos.get(req.params.id);
    if (!video) return res.status(404).json({ error: "not found" });
    video.viewCount++;
    res.json({ viewCount: video.viewCount });
  } catch { res.status(500).json({ error: "view failed" }); }
});

qmediaRouter.delete("/me/videos/:id", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const video = memVideos.get(req.params.id);
    if (!video || video.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    memVideos.delete(req.params.id);
    res.json({ deleted: true });
  } catch { res.status(500).json({ error: "delete video failed" }); }
});

/* ── Likes ── */

qmediaRouter.post("/:type/:id/like", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const { type, id } = req.params;
    if (!["track", "video", "playlist"].includes(type)) return res.status(400).json({ error: "invalid type" });
    const key = `${auth.sub}:${type}:${id}`;
    const liked = !memLikes.get(key);
    if (liked) memLikes.set(key, true); else memLikes.delete(key);
    res.json({ liked });
  } catch { res.status(500).json({ error: "like failed" }); }
});

qmediaRouter.get("/me/likes", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const prefix = `${auth.sub}:`;
    const likes = Array.from(memLikes.keys()).filter(k => k.startsWith(prefix)).map(k => { const parts = k.split(":"); return { type: parts[1], resourceId: parts[2] }; });
    res.json({ items: likes });
  } catch { res.status(500).json({ error: "list likes failed" }); }
});

/* ── AI Tools ── */

qmediaRouter.post("/ai/generate-lyrics", async (req, res) => {
  try {
    const { genre, mood, theme, lines } = req.body || {};
    const provider = getProviders().find(p => p.configured);
    if (!provider) {
      return res.json({ lyrics: `[Verse 1]\nIn the ${mood || "bright"} ${genre || "music"} night\nEvery beat feels just right\n${theme || "We dance"} under stars above\n\n[Chorus]\nOh ${theme || "music"}, carry me away\nThrough the ${mood || "beautiful"} day`, mode: "stub" });
    }
    const numLines = typeof lines === "number" ? lines : 8;
    const result = await callProvider(provider.id, [{ role: "user" as const, content: `Write ${numLines} lines of ${genre || "pop"} song lyrics with a ${mood || "upbeat"} mood about: ${theme || "life"}. Format with [Verse] and [Chorus] labels. Just the lyrics, no explanation.` }], provider.defaultModel, 0.9);
    res.json({ lyrics: result.reply });
  } catch { res.status(500).json({ error: "generate lyrics failed" }); }
});

qmediaRouter.post("/ai/generate-title", async (req, res) => {
  try {
    const { genre, mood } = req.body || {};
    const provider = getProviders().find(p => p.configured);
    if (!provider) {
      return res.json({ titles: [`${mood || "Beautiful"} ${genre || "Song"}`, `The ${mood || "Magic"} Beat`, `${genre || "Music"} Dreams`, `${mood || "Pure"} Harmony`, `Sound of Life`], mode: "stub" });
    }
    const result = await callProvider(provider.id, [{ role: "user" as const, content: `Suggest 5 creative song titles for a ${genre || "pop"} song with a ${mood || "upbeat"} mood. Return ONLY a JSON array of strings.` }], provider.defaultModel, 0.8);
    try {
      const raw = result.reply.trim();
      const jsonStr = raw.startsWith("[") ? raw : raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
      res.json({ titles: JSON.parse(jsonStr) });
    } catch {
      res.json({ titles: result.reply.split("\n").filter((l: string) => l.trim()).slice(0, 5) });
    }
  } catch { res.status(500).json({ error: "generate title failed" }); }
});

qmediaRouter.post("/ai/generate-color-palette", async (req, res) => {
  try {
    const { mood } = req.body || {};
    const palettes: Record<string, string[]> = {
      happy: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"],
      sad: ["#2C3E50", "#34495E", "#7F8C8D", "#95A5A6", "#BDC3C7"],
      energetic: ["#FF4500", "#FF6347", "#FF7F50", "#FFA500", "#FFD700"],
      calm: ["#E8F4F8", "#B8D4E8", "#88B4D8", "#5894C8", "#2874B8"],
      romantic: ["#FF69B4", "#FFB6C1", "#FF1493", "#C71585", "#FF6EB4"],
      dark: ["#1A1A2E", "#16213E", "#0F3460", "#533483", "#E94560"],
    };
    const colors = palettes[mood as string] || palettes.happy;
    res.json({ colors, mood: mood || "happy" });
  } catch { res.status(500).json({ error: "generate palette failed" }); }
});

qmediaRouter.post("/ai/describe-video", async (req, res) => {
  try {
    const { title, category } = req.body || {};
    const provider = getProviders().find(p => p.configured);
    if (!provider) return res.json({ description: `A compelling ${category || "video"} titled "${title || "Untitled"}". Watch as the story unfolds in this captivating piece.`, mode: "stub" });
    const result = await callProvider(provider.id, [{ role: "user" as const, content: `Write a 2-sentence video description for a ${category || "video"} titled "${title}". Make it engaging and concise.` }], provider.defaultModel, 0.7);
    res.json({ description: result.reply.trim() });
  } catch { res.status(500).json({ error: "describe video failed" }); }
});

/* ── Smart Playlists ── */

qmediaRouter.post("/me/playlists/:id/smart", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const playlist = memPlaylists.get(req.params.id);
    if (!playlist || playlist.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    const { rules } = req.body || {};
    const { genre, mood, minDuration, maxDuration } = (rules as { genre?: string; mood?: string; minDuration?: number; maxDuration?: number }) ?? {};
    let matched = Array.from(memTracks.values()).filter((t) => t.isPublic);
    if (genre) matched = matched.filter((t) => t.genre === genre);
    if (minDuration !== undefined) matched = matched.filter((t) => t.duration >= minDuration);
    if (maxDuration !== undefined) matched = matched.filter((t) => t.duration <= maxDuration);
    if (mood) matched = matched.filter((t) => t.tags.some((tag) => tag.toLowerCase().includes(mood.toLowerCase())));
    const ids = matched.slice(0, 50).map((t) => t.id);
    playlist.trackIds = ids;
    playlist.updatedAt = nowIso();
    res.json({ playlist, tracksAdded: ids.length });
  } catch { res.status(500).json({ error: "smart playlist failed" }); }
});

qmediaRouter.post("/me/playlists/:id/collaborators", async (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const playlist = memPlaylists.get(req.params.id);
    if (!playlist || playlist.userId !== auth.sub) return res.status(404).json({ error: "not found" });
    const { userId, canEdit } = (req.body || {}) as { userId?: string; canEdit?: boolean };
    if (!userId) return res.status(400).json({ error: "userId required" });
    if (!playlist.collaborators) playlist.collaborators = [];
    const existing = playlist.collaborators.find((c) => c.userId === userId);
    if (existing) { existing.canEdit = Boolean(canEdit); }
    else { playlist.collaborators.push({ userId, canEdit: Boolean(canEdit) }); }
    playlist.updatedAt = nowIso();
    res.json({ playlist });
  } catch { res.status(500).json({ error: "add collaborator failed" }); }
});

/* ── Recommendations + Trending ── */

/**
 * Personalised recommendations:
 *  - Build a "taste profile" from the caller's likes + tracks they've authored (genre + tag affinity).
 *  - Score every public track they have NOT liked: genre match (3) + tag overlap (1 each) + popularity log boost.
 *  - If unauthenticated OR profile is empty → fall back to most-played public tracks.
 *
 * Query: ?limit=20 (max 50)
 * Response: { mode: "personal" | "popular", items: TrackRow[], profile?: { genres, tags } }
 */
qmediaRouter.get("/recommendations", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const auth = verifyBearerOptional(req);
    const allPublic = Array.from(memTracks.values()).filter((t) => t.isPublic);

    // Anonymous → popular fallback
    if (!auth?.sub) {
      const items = [...allPublic].sort((a, b) => b.playCount - a.playCount).slice(0, limit);
      return res.json({ mode: "popular", items, profile: null });
    }

    const userId = auth.sub;

    // Liked track ids of this user
    const likedTrackIds = new Set<string>();
    for (const key of memLikes.keys()) {
      if (!key.startsWith(`${userId}:track:`)) continue;
      const parts = key.split(":");
      if (parts.length === 3) likedTrackIds.add(parts[2]);
    }

    // Build taste profile from liked tracks + tracks user authored
    const genreScore = new Map<string, number>();
    const tagScore = new Map<string, number>();
    const seedTracks: TrackRow[] = [];
    for (const id of likedTrackIds) {
      const t = memTracks.get(id);
      if (t) seedTracks.push(t);
    }
    for (const t of memTracks.values()) {
      if (t.userId === userId) seedTracks.push(t);
    }
    for (const t of seedTracks) {
      genreScore.set(t.genre, (genreScore.get(t.genre) ?? 0) + 1);
      for (const tag of t.tags) tagScore.set(tag.toLowerCase(), (tagScore.get(tag.toLowerCase()) ?? 0) + 1);
    }

    // No profile data → popular fallback (still report as such)
    if (genreScore.size === 0 && tagScore.size === 0) {
      const items = [...allPublic].sort((a, b) => b.playCount - a.playCount).slice(0, limit);
      return res.json({ mode: "popular", items, profile: { genres: [], tags: [] } });
    }

    // Score every candidate the user hasn't already liked or authored
    const seen = new Set<string>([...likedTrackIds]);
    for (const t of memTracks.values()) if (t.userId === userId) seen.add(t.id);

    const scored = allPublic
      .filter((t) => !seen.has(t.id))
      .map((t) => {
        let score = 0;
        score += (genreScore.get(t.genre) ?? 0) * 3;
        for (const tag of t.tags) score += (tagScore.get(tag.toLowerCase()) ?? 0);
        score += Math.log1p(t.playCount) * 0.5;
        return { track: t, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.track);

    // If personalised pool is too thin, top up with popularity-ranked tracks
    if (scored.length < limit) {
      const have = new Set(scored.map((t) => t.id));
      const filler = [...allPublic]
        .filter((t) => !seen.has(t.id) && !have.has(t.id))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, limit - scored.length);
      scored.push(...filler);
    }

    const topGenres = [...genreScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
    const topTags = [...tagScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);

    res.json({ mode: "personal", items: scored, profile: { genres: topGenres, tags: topTags } });
  } catch { res.status(500).json({ error: "recommendations failed" }); }
});

/**
 * Trending — overall tastemaker view, no auth needed.
 * Returns top tracks by playCount + top genres by aggregate plays.
 */
qmediaRouter.get("/trending", async (_req, res) => {
  try {
    const allPublic = Array.from(memTracks.values()).filter((t) => t.isPublic);
    const items = [...allPublic].sort((a, b) => b.playCount - a.playCount).slice(0, 10);
    const genreAgg = new Map<string, number>();
    for (const t of allPublic) genreAgg.set(t.genre, (genreAgg.get(t.genre) ?? 0) + t.playCount);
    const genres = [...genreAgg.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([genre, plays]) => ({ genre, plays }));
    res.json({ items, genres });
  } catch { res.status(500).json({ error: "trending failed" }); }
});

/* ── Radio + Similar Tracks ── */

qmediaRouter.get("/radio/:genre", async (req, res) => {
  try {
    const genre = String(req.params.genre);
    let tracks = Array.from(memTracks.values()).filter((t) => t.isPublic && t.genre === genre);
    // shuffle
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    res.json({ tracks: tracks.slice(0, 10), genre });
  } catch { res.status(500).json({ error: "radio failed" }); }
});

qmediaRouter.get("/tracks/:id/similar", async (req, res) => {
  try {
    const track = memTracks.get(req.params.id);
    if (!track) return res.status(404).json({ error: "not found" });
    const similar = Array.from(memTracks.values())
      .filter((t) => t.isPublic && t.genre === track.genre && t.id !== track.id)
      .slice(0, 5);
    res.json({ tracks: similar });
  } catch { res.status(500).json({ error: "similar failed" }); }
});

/* ── Health ── */

qmediaRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "qmedia", tables: ["QMediaTrack", "QMediaPlaylist", "QMediaVideo", "QMediaLike"] });
});
