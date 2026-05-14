// AEVION CyberChess — AI Coach proxy + session/goal tracking (v37)
//
// v35:
// - Default model upgraded from Haiku 4.5 → Sonnet 4.6 for stronger chess reasoning.
//   Haiku plays chess at ~1200 ELO "guesses on the position", Sonnet at ~2000 ELO and
//   ACTUALLY understands engine eval lines when they're provided in the prompt.
// - maxTokens is now client-configurable (Live Coach needs 150, deep analysis up to 1500).
// - System prompt validation no longer truncates.
//
// v36:
// - Added coaching session lifecycle (POST /sessions/start, POST /sessions/:id/end,
//   GET /sessions, GET /sessions/:id). In-memory storage for now — graduates to Prisma
//   once Coach is promoted from CyberChess sub-feature to a first-class AEVION module.
// - Added goal tracking (POST /goals, GET /goals, POST /goals/:id/complete,
//   DELETE /goals/:id). Goals link to sessions so we can measure "what student worked on".
// - Both surfaces accept anonymous traffic (sessionId scoped to an opaque clientId in body)
//   or Bearer-attributed traffic. Bearer takes precedence when present so multi-device
//   replay works.
//
// v37:
// - SECURITY: Removed `getOwnerKey` helper which accepted ownerKey from Bearer header
//   OR `body.clientId` OR `query.clientId`. The clientId fallback let any caller spoof
//   another student's ownerKey by passing their opaque clientId — anonymous attribution
//   masquerading as authentication. Migrated every owner-scoped endpoint
//   (/sessions/*, /goals/*) to the `requireAuth` JWT middleware (aligned with
//   QSign v2, QRight royalties, planet compliance). `ownerKey` is now always
//   `req.auth.sub` from a verified JWT.
// - /chat and /health remain public — /chat is a stateless Anthropic proxy with
//   no owner-keyed state to protect, and it's consumed by CyberChess board UI
//   which has its own session lifecycle separate from Coach. Abuse mitigation
//   for /chat belongs in a rate-limiter layer (TODO), not auth gating.

import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/authJwt";

export const coachRouter = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Opus 4.7 — Anthropic's flagship, strongest chess reasoning ($15 in / $75 out per M tokens).
// Each Coach request ≈ $0.015-0.02, acceptable for premium experience. Override via env.
const DEFAULT_MODEL = process.env.COACH_MODEL || "claude-opus-4-7";

// Absolute ceiling on tokens per response — chess coaching fits comfortably in 1500.
// Client may request less (e.g. 150 for Live Coach one-liners).
const MAX_TOKENS_CEILING = 1500;
const DEFAULT_MAX_TOKENS = 800;

// Input size limits — chess context (FEN + engine PVs + move list) fits comfortably
// in a few KB per message. These limits prevent abuse / runaway costs.
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 16000;
const MAX_SYSTEM_CHARS = 8000;

// ─── In-memory stores (graduate to Prisma when Coach lands as full module) ──
// Caps prevent runaway memory growth in long-running prod instances.
const MAX_SESSIONS = 5000;
const MAX_GOALS = 5000;

type CoachSession = {
  id: string;
  ownerKey: string;        // JWT.sub — stable per user across devices
  topic: string;
  startingFen?: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  notes?: string;
  messageCount: number;
  goalsLinked: string[];
};

type CoachGoal = {
  id: string;
  ownerKey: string;
  title: string;
  description?: string;
  targetDate?: string;
  sessionId?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
};

const sessions = new Map<string, CoachSession>();
const goals = new Map<string, CoachGoal>();

function trimStore<T>(store: Map<string, T>, max: number) {
  if (store.size <= max) return;
  // Drop oldest keys (insertion order). Map preserves it.
  const toDrop = store.size - max;
  let i = 0;
  for (const k of store.keys()) {
    if (i++ >= toDrop) break;
    store.delete(k);
  }
}

// ─── /chat — Anthropic proxy (public; stateless) ─────────────────────────────
// Not auth-gated: stateless proxy with no owner-keyed state to protect.
// CyberChess board UI consumes this without a JWT (separate auth surface).
// Abuse / cost mitigation belongs in a rate-limiter, not here.
coachRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server misconfigured: ANTHROPIC_API_KEY not set",
      });
    }

    const { system, messages, maxTokens } = (req.body || {}) as {
      system?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
    };

    // ─── Input validation ────────────────────────────────────────────────
    if (!system || typeof system !== "string") {
      return res.status(400).json({ error: "Missing or invalid `system`" });
    }
    if (system.length > MAX_SYSTEM_CHARS) {
      return res.status(400).json({
        error: `System prompt too long (max ${MAX_SYSTEM_CHARS} chars)`,
      });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing or invalid `messages`" });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({
        error: `Too many messages (max ${MAX_MESSAGES})`,
      });
    }
    for (const m of messages) {
      if (!m || typeof m !== "object") {
        return res.status(400).json({ error: "Malformed message" });
      }
      if (m.role !== "user" && m.role !== "assistant") {
        return res.status(400).json({ error: `Invalid role: ${m.role}` });
      }
      if (typeof m.content !== "string" || m.content.length === 0) {
        return res.status(400).json({ error: "Message content must be non-empty string" });
      }
      if (m.content.length > MAX_CONTENT_CHARS) {
        return res.status(400).json({
          error: `Message too long (max ${MAX_CONTENT_CHARS} chars)`,
        });
      }
    }
    if (messages[0].role !== "user") {
      return res.status(400).json({ error: "First message must have role=user" });
    }

    // Resolve max_tokens with sensible clamping.
    let resolvedMaxTokens = DEFAULT_MAX_TOKENS;
    if (typeof maxTokens === "number" && maxTokens > 0) {
      resolvedMaxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CEILING);
    }

    // ─── Forward to Anthropic ────────────────────────────────────────────
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: resolvedMaxTokens,
        system,
        messages,
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const errMsg =
        (data && (data.error?.message || data.message)) ||
        `Upstream error (HTTP ${upstream.status})`;
      console.error("[coach] Anthropic API error:", upstream.status, errMsg);
      return res.status(upstream.status).json({ error: errMsg });
    }

    return res.json(data);
  } catch (err: any) {
    console.error("[coach] Unexpected error:", err);
    return res.status(500).json({
      error: err?.message || "Internal server error",
    });
  }
});

// ─── /sessions — coaching session lifecycle ───────────────────────────────────

/** POST /sessions/start
 *  Auth: Bearer required.
 *  Body: { topic: string, startingFen?: string }
 *  Returns: { session } */
coachRouter.post("/sessions/start", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const { topic, startingFen } = (req.body || {}) as {
    topic?: string;
    startingFen?: string;
  };

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return res.status(400).json({ error: "Missing `topic`" });
  }
  if (topic.length > 200) {
    return res.status(400).json({ error: "topic too long (max 200 chars)" });
  }
  if (startingFen != null && (typeof startingFen !== "string" || startingFen.length > 120)) {
    return res.status(400).json({ error: "startingFen must be a string ≤ 120 chars" });
  }

  const session: CoachSession = {
    id: randomUUID(),
    ownerKey,
    topic: topic.trim(),
    startingFen: startingFen?.trim() || undefined,
    startedAt: new Date().toISOString(),
    messageCount: 0,
    goalsLinked: [],
  };
  sessions.set(session.id, session);
  trimStore(sessions, MAX_SESSIONS);

  return res.status(201).json({ session });
});

/** POST /sessions/:id/end
 *  Auth: Bearer required.
 *  Body: { notes?: string, messageCount?: number }
 *  Returns: { session } */
coachRouter.post("/sessions/:id/end", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const session = sessions.get(String(req.params.id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  if (session.endedAt) return res.status(409).json({ error: "Session already ended" });

  const { notes, messageCount } = (req.body || {}) as {
    notes?: string;
    messageCount?: number;
  };
  if (notes != null) {
    if (typeof notes !== "string") return res.status(400).json({ error: "notes must be a string" });
    if (notes.length > 2000) return res.status(400).json({ error: "notes too long (max 2000)" });
    session.notes = notes;
  }
  if (typeof messageCount === "number" && messageCount >= 0 && Number.isFinite(messageCount)) {
    session.messageCount = Math.floor(messageCount);
  }

  const endedAt = new Date();
  session.endedAt = endedAt.toISOString();
  session.durationSec = Math.max(
    0,
    Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000),
  );

  return res.json({ session });
});

/** GET /sessions — list current user's sessions (newest first, max 50). */
coachRouter.get("/sessions", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const mine = [...sessions.values()]
    .filter((s) => s.ownerKey === ownerKey)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 50);
  return res.json({ items: mine, total: mine.length });
});

/** GET /sessions/:id — single session detail. */
coachRouter.get("/sessions/:id", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const session = sessions.get(String(req.params.id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  return res.json({ session });
});

// ─── /goals — coaching goal tracking ─────────────────────────────────────────

/** POST /goals
 *  Auth: Bearer required.
 *  Body: { title, description?, targetDate?, sessionId? }
 *  Returns: { goal } */
coachRouter.post("/goals", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const { title, description, targetDate, sessionId } = (req.body || {}) as {
    title?: string;
    description?: string;
    targetDate?: string;
    sessionId?: string;
  };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "Missing `title`" });
  }
  if (title.length > 200) return res.status(400).json({ error: "title too long (max 200)" });
  if (description != null) {
    if (typeof description !== "string" || description.length > 2000) {
      return res.status(400).json({ error: "description too long (max 2000)" });
    }
  }
  if (targetDate != null) {
    if (typeof targetDate !== "string" || Number.isNaN(Date.parse(targetDate))) {
      return res.status(400).json({ error: "targetDate must be ISO 8601" });
    }
  }
  // Verify sessionId belongs to caller if provided.
  if (sessionId != null) {
    if (typeof sessionId !== "string") return res.status(400).json({ error: "sessionId must be a string" });
    const s = sessions.get(sessionId);
    if (!s || s.ownerKey !== ownerKey) {
      return res.status(400).json({ error: "sessionId does not reference an accessible session" });
    }
  }

  const goal: CoachGoal = {
    id: randomUUID(),
    ownerKey,
    title: title.trim(),
    description: description?.trim() || undefined,
    targetDate: targetDate || undefined,
    sessionId: sessionId || undefined,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  goals.set(goal.id, goal);
  trimStore(goals, MAX_GOALS);

  // Link goal to session if applicable.
  if (sessionId) {
    const s = sessions.get(sessionId);
    if (s && !s.goalsLinked.includes(goal.id)) s.goalsLinked.push(goal.id);
  }

  return res.status(201).json({ goal });
});

/** GET /goals?completed=true|false — filter mine. */
coachRouter.get("/goals", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const completedFilter =
    typeof req.query.completed === "string"
      ? req.query.completed === "true"
      : null;
  const mine = [...goals.values()]
    .filter((g) => g.ownerKey === ownerKey)
    .filter((g) => completedFilter === null ? true : g.completed === completedFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  return res.json({ items: mine, total: mine.length });
});

/** POST /goals/:id/complete — flip to done. Idempotent. */
coachRouter.post("/goals/:id/complete", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const goal = goals.get(String(req.params.id));
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  if (goal.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  if (!goal.completed) {
    goal.completed = true;
    goal.completedAt = new Date().toISOString();
  }
  return res.json({ goal });
});

/** DELETE /goals/:id — remove. */
coachRouter.delete("/goals/:id", requireAuth, (req: Request, res: Response) => {
  const ownerKey = req.auth!.sub;
  const goal = goals.get(String(req.params.id));
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  if (goal.ownerKey !== ownerKey) return res.status(403).json({ error: "Forbidden" });
  goals.delete(String(req.params.id));
  return res.status(204).end();
});

// ─── Health check (public) ────────────────────────────────────────────────
coachRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL,
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    defaultMaxTokens: DEFAULT_MAX_TOKENS,
    maxTokensCeiling: MAX_TOKENS_CEILING,
    sessions: sessions.size,
    goals: goals.size,
  });
});
