// /api/multichat/* — server-side dispatch for the multichat-engine UI.
//
// What multichat does: a user asks N agents the same question (or different
// questions) in parallel, sees their replies side-by-side, and drives a
// conversation that branches per agent. The frontend has had this UX for a
// while; persistence and parallel dispatch were missing — chats lived in
// localStorage, agents called provider APIs from the browser via a thin
// proxy, conversation history evaporated on cache clear.
//
// This route closes that gap:
//   - POST /api/multichat/conversations           create a conversation
//   - GET  /api/multichat/conversations           list user's conversations
//   - GET  /api/multichat/conversations/:id       fetch a conversation + its turns
//   - POST /api/multichat/conversations/:id/dispatch  fan out to N agents in parallel
//
// Each agent dispatch is internally a /api/qcoreai/chat call (same provider
// resolution + rate-limit + history persistence). Replies stream back as a
// single response with one entry per agent — fan-out is parallel via
// Promise.allSettled so a slow / failing agent doesn't block the rest.

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { readJsonFile, writeJsonFile } from "../lib/jsonFileStore";
import { rateLimit } from "../lib/rateLimit";
import { requireAuth } from "../lib/authJwt";
import { listChatTurns, recordChatTurn } from "../lib/chatHistory";

export const multichatRouter = Router();

// All multichat surfaces are user-scoped — anonymous traffic gets 401.
multichatRouter.use(requireAuth);

// 12 fan-outs / min per user. Each fan-out triggers up to N provider calls
// (the qcoreai chatLimiter handles per-call ceilings); this protects the
// conversation/turn write path from abuse.
const dispatchLimiter = rateLimit({
  capacity: 12,
  refillPerSec: 12 / 60,
  keyFn: (req) => `mc:${req.auth?.sub || req.ip || "anon"}`,
});

type Conversation = {
  id: string;
  userId: string;
  title: string;
  shareToken?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORE_REL = "multichat-conversations.json";
const SCHEMA = `
CREATE TABLE IF NOT EXISTS multichat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  share_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_multichat_user_updated
  ON multichat_conversations (user_id, updated_at DESC);
ALTER TABLE multichat_conversations ADD COLUMN IF NOT EXISTS share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_multichat_share_token
  ON multichat_conversations (share_token) WHERE share_token IS NOT NULL;
`;

function isPg(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

let schemaApplied = false;
async function ensureSchema(): Promise<void> {
  if (!isPg() || schemaApplied) return;
  await getPool().query(SCHEMA);
  schemaApplied = true;
}

async function createConv(userId: string, title: string): Promise<Conversation> {
  const c: Conversation = {
    id: `conv_${randomUUID()}`,
    userId,
    title: title.slice(0, 200) || "New conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (isPg()) {
    await ensureSchema();
    await getPool().query(
      `INSERT INTO multichat_conversations (id, user_id, title, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [c.id, c.userId, c.title, c.createdAt, c.updatedAt],
    );
  } else {
    const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
    const items = Array.isArray(data.items) ? data.items : [];
    items.push(c);
    await writeJsonFile(STORE_REL, { items });
  }
  return c;
}

async function listConvs(userId: string): Promise<Conversation[]> {
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT id, user_id AS "userId", title,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM multichat_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 200`,
      [userId],
    );
    return r.rows.map((row: any) => ({
      ...row,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    })) as Conversation[];
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((c) => c.userId === userId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 200);
}

async function findConv(id: string, userId: string): Promise<Conversation | null> {
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT id, user_id AS "userId", title,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM multichat_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      ...row,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    } as Conversation;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  return items.find((c) => c.id === id && c.userId === userId) ?? null;
}

async function touchConv(id: string): Promise<void> {
  if (isPg()) {
    await ensureSchema();
    await getPool().query(`UPDATE multichat_conversations SET updated_at = NOW() WHERE id = $1`, [id]);
    return;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  const c = items.find((x) => x.id === id);
  if (c) {
    c.updatedAt = new Date().toISOString();
    await writeJsonFile(STORE_REL, { items });
  }
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

// ─── Phase 2 helpers (delete / rename / share / search / usage) ───────────

async function deleteConv(id: string, userId: string): Promise<boolean> {
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `DELETE FROM multichat_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (r.rowCount ?? 0) > 0;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  const before = items.length;
  const filtered = items.filter((c) => !(c.id === id && c.userId === userId));
  if (filtered.length === before) return false;
  await writeJsonFile(STORE_REL, { items: filtered });
  return true;
}

async function renameConv(id: string, userId: string, title: string): Promise<Conversation | null> {
  const safe = title.slice(0, 200) || "New conversation";
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `UPDATE multichat_conversations SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id AS "userId", title, share_token AS "shareToken",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [safe, id, userId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { ...row, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) } as Conversation;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  const c = items.find((x) => x.id === id && x.userId === userId);
  if (!c) return null;
  c.title = safe;
  c.updatedAt = new Date().toISOString();
  await writeJsonFile(STORE_REL, { items });
  return c;
}

async function setShareToken(id: string, userId: string, token: string | null): Promise<Conversation | null> {
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `UPDATE multichat_conversations SET share_token = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id AS "userId", title, share_token AS "shareToken",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [token, id, userId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { ...row, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) } as Conversation;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  const c = items.find((x) => x.id === id && x.userId === userId);
  if (!c) return null;
  c.shareToken = token;
  c.updatedAt = new Date().toISOString();
  await writeJsonFile(STORE_REL, { items });
  return c;
}

async function findByShareToken(token: string): Promise<Conversation | null> {
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT id, user_id AS "userId", title, share_token AS "shareToken",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM multichat_conversations WHERE share_token = $1`,
      [token],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { ...row, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) } as Conversation;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  return items.find((c) => c.shareToken === token) ?? null;
}

async function searchConvs(userId: string, q: string, limit: number, offset: number): Promise<Conversation[]> {
  const lim = Math.max(1, Math.min(200, limit));
  const off = Math.max(0, offset);
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT id, user_id AS "userId", title, share_token AS "shareToken",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM multichat_conversations
       WHERE user_id = $1 AND title ILIKE $2
       ORDER BY updated_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, `%${q}%`, lim, off],
    );
    return r.rows.map((row: any) => ({
      ...row,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    })) as Conversation[];
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  const needle = q.toLowerCase();
  return items
    .filter((c) => c.userId === userId && c.title.toLowerCase().includes(needle))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(off, off + lim);
}

// ────────────────────────────────────────────────────────────────────────
// Routes

// POST /api/multichat/conversations { title }
multichatRouter.post("/conversations", async (req, res) => {
  const userId = req.auth!.sub;
  const title = typeof req.body?.title === "string" ? req.body.title : "New conversation";
  try {
    const c = await createConv(userId, title);
    res.status(201).json(c);
  } catch (err: any) {
    res.status(500).json({ error: "create failed", details: err?.message });
  }
});

// GET /api/multichat/conversations
multichatRouter.get("/conversations", async (req, res) => {
  const userId = req.auth!.sub;
  try {
    const items = await listConvs(userId);
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: "list failed", details: err?.message });
  }
});

// GET /api/multichat/conversations/:id  → conversation + last 200 turns
multichatRouter.get("/conversations/:id", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation not found" });
    const turns = await listChatTurns({ userId, conversationId: id, limit: 200 });
    res.json({ conversation: conv, turns });
  } catch (err: any) {
    res.status(500).json({ error: "fetch failed", details: err?.message });
  }
});

// POST /api/multichat/conversations/:id/dispatch
//   { prompt, agents: [{ id, role, provider?, model?, temperature? }, ...] }
//
// Fans out one prompt across N agents in parallel. Each agent's reply is
// independently persisted (own conversationId in chatHistory keyed by
// `${conversationId}:${agentId}` so multichat UI can re-query per-agent
// turns later). Returns an array aligned with the input agents.
multichatRouter.post("/conversations/:id/dispatch", dispatchLimiter, async (req, res) => {
  const userId = req.auth!.sub;
  const conversationId = String(req.params.id);

  const conv = await findConv(conversationId, userId);
  if (!conv) return res.status(404).json({ error: "conversation not found" });

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  const agents = Array.isArray(req.body?.agents) ? req.body.agents : [];
  if (agents.length === 0) return res.status(400).json({ error: "agents required" });
  if (agents.length > 8) return res.status(400).json({ error: "max 8 agents per dispatch" });

  // Persist the user prompt once at the conversation level.
  await recordChatTurn({
    userId,
    conversationId,
    role: "user",
    content: prompt,
  });

  // Resolve absolute origin for the internal /api/qcoreai/chat call.
  const port = Number(process.env.PORT) || 4001;
  const internalBase = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${port}`;
  const authHeader = req.headers.authorization || "";

  type AgentSpec = {
    id?: unknown;
    role?: unknown;
    provider?: unknown;
    model?: unknown;
    temperature?: unknown;
  };

  const calls = (agents as AgentSpec[]).map(async (a, idx) => {
    const agentId = typeof a.id === "string" ? a.id : `agent_${idx}`;
    const role = typeof a.role === "string" ? a.role : "Agent";
    const provider = typeof a.provider === "string" ? a.provider : undefined;
    const model = typeof a.model === "string" ? a.model : undefined;
    const temperature = typeof a.temperature === "number" ? a.temperature : 0.6;

    const messages = [
      { role: "system", content: `You are ${role}. Respond concisely (under 200 words).` },
      { role: "user", content: prompt },
    ];

    try {
      const r = await fetch(`${internalBase}/api/qcoreai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          messages,
          provider,
          model,
          temperature,
          conversationId: `${conversationId}:${agentId}`,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        reply?: string;
        provider?: string;
        model?: string;
        usage?: unknown;
        error?: string;
      } | null;
      if (!r.ok) {
        return {
          agentId,
          role,
          ok: false,
          error: data?.error || `upstream ${r.status}`,
        };
      }
      return {
        agentId,
        role,
        ok: true,
        reply: data?.reply ?? "",
        provider: data?.provider ?? null,
        model: data?.model ?? null,
        usage: data?.usage ?? null,
      };
    } catch (err: any) {
      return {
        agentId,
        role,
        ok: false,
        error: err?.message || "dispatch failed",
      };
    }
  });

  const results = await Promise.all(calls);
  await touchConv(conversationId);

  res.json({
    conversationId,
    prompt,
    results,
    completedAt: new Date().toISOString(),
  });
});

// ─── Phase 2: lifecycle + sharing + export + search ────────────────────────

// DELETE /api/multichat/conversations/:id — soft "delete" (real DELETE).
// Drops the conversation row + leaves chat_history turns (those have their own
// conversationId keyed by `${id}:${agentId}`; orphaned turns are handled by
// existing chatHistory GC). Idempotent: 404 if not found.
multichatRouter.delete("/conversations/:id", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const ok = await deleteConv(id, userId);
    if (!ok) return res.status(404).json({ error: "conversation_not_found" });
    res.json({ ok: true, deletedId: id });
  } catch (err: any) {
    res.status(500).json({ error: "delete_failed", details: err?.message });
  }
});

// PATCH /api/multichat/conversations/:id { title }
multichatRouter.patch("/conversations/:id", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title_required" });
  try {
    const c = await renameConv(id, userId, title);
    if (!c) return res.status(404).json({ error: "conversation_not_found" });
    res.json(c);
  } catch (err: any) {
    res.status(500).json({ error: "rename_failed", details: err?.message });
  }
});

// GET /api/multichat/conversations/:id/export.json — full conversation dump
// (turns + agents) for compliance / personal-data export.
multichatRouter.get("/conversations/:id/export.json", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });
    const turns = await listChatTurns({ userId, conversationId: id, limit: 5000 });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="multichat-${id}.json"`);
    res.json({ conversation: conv, turns, exportedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: "export_failed", details: err?.message });
  }
});

// GET /api/multichat/conversations/:id/export.csv — CSV (one row per turn)
multichatRouter.get("/conversations/:id/export.csv", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });
    const turns = await listChatTurns({ userId, conversationId: id, limit: 5000 });
    const esc = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = ["created_at,role,content"];
    for (const t of turns as Array<Record<string, unknown>>) {
      lines.push([esc(t.createdAt ?? t.created_at), esc(t.role), esc(t.content)].join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="multichat-${id}.csv"`);
    res.send(lines.join("\n") + "\n");
  } catch (err: any) {
    res.status(500).json({ error: "export_failed", details: err?.message });
  }
});

// GET /api/multichat/conversations/:id/usage — aggregate token usage + cost
// across all turns. Pulls usage from chatHistory rows (qcoreai persists usage
// per call). Useful for per-conversation billing display.
multichatRouter.get("/conversations/:id/usage", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });
    const turns = await listChatTurns({ userId, conversationId: id, limit: 5000 });
    let inputTokens = 0;
    let outputTokens = 0;
    let totalUsd = 0;
    let calls = 0;
    for (const t of turns as Array<Record<string, unknown>>) {
      const usage = t.usage as { inputTokens?: number; outputTokens?: number; costUsd?: number } | undefined;
      if (!usage) continue;
      calls += 1;
      inputTokens += Number(usage.inputTokens ?? 0);
      outputTokens += Number(usage.outputTokens ?? 0);
      totalUsd += Number(usage.costUsd ?? 0);
    }
    res.json({
      conversationId: id,
      calls,
      tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
      costUsd: Number(totalUsd.toFixed(6)),
    });
  } catch (err: any) {
    res.status(500).json({ error: "usage_failed", details: err?.message });
  }
});

// POST /api/multichat/conversations/:id/share — issue a public share token.
// Returns existing token if already shared (idempotent).
multichatRouter.post("/conversations/:id/share", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });
    let token = conv.shareToken;
    if (!token) {
      token = `mcs_${randomUUID().replace(/-/g, "")}`;
      await setShareToken(id, userId, token);
    }
    res.json({ shareToken: token, shareUrl: `/multichat-engine/shared/${token}` });
  } catch (err: any) {
    res.status(500).json({ error: "share_failed", details: err?.message });
  }
});

// DELETE /api/multichat/conversations/:id/share — revoke share link.
multichatRouter.delete("/conversations/:id/share", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const c = await setShareToken(id, userId, null);
    if (!c) return res.status(404).json({ error: "conversation_not_found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "revoke_failed", details: err?.message });
  }
});

// GET /api/multichat/search?q=...&limit=&offset= — title-substring search
multichatRouter.get("/search", async (req, res) => {
  const userId = req.auth!.sub;
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  if (!q) return res.json({ items: [], total: 0 });
  try {
    const items = await searchConvs(userId, q, limit, offset);
    res.json({ items, total: items.length, q });
  } catch (err: any) {
    res.status(500).json({ error: "search_failed", details: err?.message });
  }
});

// GET /api/multichat/shared/:token — PUBLIC view of a shared conversation.
// No auth required. Returns conversation metadata + last 200 turns (no usage
// to keep cost data private). Mounted as a separate sub-route to bypass the
// router-wide requireAuth.
export const multichatPublicRouter = Router();
multichatPublicRouter.get("/shared/:token", async (req, res) => {
  const token = String(req.params.token).trim();
  if (!token) return res.status(400).json({ error: "token_required" });
  try {
    const conv = await findByShareToken(token);
    if (!conv) return res.status(404).json({ error: "not_found_or_revoked" });
    const turns = await listChatTurns({ userId: conv.userId, conversationId: conv.id, limit: 200 });
    // Strip per-turn usage to avoid leaking cost/billing info publicly.
    const safeTurns = (turns as Array<Record<string, unknown>>).map((t) => {
      const { usage, ...rest } = t;
      void usage;
      return rest;
    });
    res.json({
      conversation: { id: conv.id, title: conv.title, createdAt: conv.createdAt },
      turns: safeTurns,
    });
  } catch (err: any) {
    res.status(500).json({ error: "fetch_failed", details: err?.message });
  }
});
