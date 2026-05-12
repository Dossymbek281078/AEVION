import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import {
  callProvider,
  getProviders,
  resolveProvider,
  type ChatMessage,
} from "../services/qcoreai/providers";

export const qaiRouter = Router();

interface QaiSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  ip: string;
}

// In-memory session store — Map<sessionId, QaiSession>
const sessions = new Map<string, QaiSession>();

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) return raw.split(",")[0].trim();
  return req.socket?.remoteAddress || "anonymous";
}

function getOrCreateSession(sessionId: string | undefined, ip: string): QaiSession {
  const id = sessionId && sessions.has(sessionId) ? sessionId : crypto.randomUUID();
  if (!sessions.has(id)) {
    sessions.set(id, { id, messages: [], createdAt: new Date().toISOString(), ip });
  }
  return sessions.get(id)!;
}

// POST /api/qai/chat
qaiRouter.post("/chat", async (req: Request, res: Response) => {
  const { message, sessionId } = req.body as { message?: string; sessionId?: string };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const ip = getIp(req);
  const session = getOrCreateSession(sessionId, ip);

  const userMsg: ChatMessage = { role: "user", content: message.trim() };
  session.messages.push(userMsg);

  // Keep last 20 messages for context
  const contextMessages: ChatMessage[] = session.messages.slice(-20);

  // Pick first configured provider
  const providerId = resolveProvider();
  const providers = getProviders();
  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const model = provider?.defaultModel ?? "gpt-4o-mini";

  try {
    const result = await callProvider(providerId, contextMessages, model, 0.7);

    const assistantMsg: ChatMessage = { role: "assistant", content: result.reply };
    session.messages.push(assistantMsg);

    res.json({
      reply: result.reply,
      sessionId: session.id,
      model: result.model ?? model,
    });
  } catch (err) {
    // Remove the user message we appended if the call failed
    session.messages.pop();
    const msg = err instanceof Error ? err.message : "AI provider unavailable";
    res.status(500).json({ error: msg });
  }
});

// GET /api/qai/sessions — list sessions for this IP
qaiRouter.get("/sessions", (req: Request, res: Response) => {
  const ip = getIp(req);
  const result = Array.from(sessions.values())
    .filter((s) => s.ip === ip)
    .map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      messageCount: s.messages.length,
      preview:
        s.messages.find((m) => m.role === "user")?.content.slice(0, 80) || "",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ sessions: result, total: result.length });
});

// DELETE /api/qai/sessions/:id — clear history
qaiRouter.delete("/sessions/:id", (req: Request, res: Response) => {
  const ip = getIp(req);
  const sid = String(req.params.id);
  const session = sessions.get(sid);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.ip !== ip) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  sessions.delete(sid);
  res.json({ ok: true });
});

// GET /api/qai/models — list configured providers
qaiRouter.get("/models", (_req: Request, res: Response) => {
  const configured = getProviders().filter((p) => p.configured);
  res.json({ models: configured, total: configured.length });
});

// GET /api/qai/health
qaiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "qai",
    sessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
});
