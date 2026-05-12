import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import {
  callProvider,
  getProviders,
  resolveProvider,
  type ChatMessage,
} from "../services/qcoreai/providers";

export const qaiRouter = Router();

// ─── Personas ─────────────────────────────────────────────────────────────────
const PERSONAS = [
  { id: "assistant", name: "AEVION Assistant", systemPrompt: "You are AEVION's helpful AI assistant. Be concise and practical.", emoji: "🤖" },
  { id: "coder", name: "Code Expert", systemPrompt: "You are an expert software engineer. Focus on clean, working code with explanations.", emoji: "💻" },
  { id: "writer", name: "Creative Writer", systemPrompt: "You are a creative writer. Help with storytelling, copywriting, and creative content.", emoji: "✍️" },
  { id: "analyst", name: "Data Analyst", systemPrompt: "You are a data analyst. Help with data interpretation, statistics, and insights.", emoji: "📊" },
  { id: "tutor", name: "Learning Tutor", systemPrompt: "You are a patient tutor. Explain concepts clearly with examples appropriate for the learner's level.", emoji: "📚" },
] as const;

interface QaiSession {
  id: string;
  title: string | null;
  messages: ChatMessage[];
  personaId: string | null;
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
    sessions.set(id, { id, title: null, messages: [], personaId: null, createdAt: new Date().toISOString(), ip });
  }
  return sessions.get(id)!;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/qai/chat
qaiRouter.post("/chat", async (req: Request, res: Response) => {
  const { message, sessionId, personaId, model: reqModel, provider: reqProvider } = req.body as {
    message?: string;
    sessionId?: string;
    personaId?: string;
    model?: string;
    provider?: string;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const ip = getIp(req);
  const session = getOrCreateSession(sessionId, ip);

  // Store personaId in session if provided
  if (personaId) session.personaId = personaId;

  const userMsg: ChatMessage = { role: "user", content: message.trim() };
  session.messages.push(userMsg);

  // Build context messages — prepend system prompt if persona is set
  let contextMessages: ChatMessage[] = session.messages.slice(-20);
  const effectivePersonaId = personaId ?? session.personaId;
  if (effectivePersonaId) {
    const persona = PERSONAS.find((p) => p.id === effectivePersonaId);
    if (persona) {
      contextMessages = [
        { role: "system", content: persona.systemPrompt },
        ...contextMessages,
      ];
    }
  }

  // Per-message provider/model override
  const providers = getProviders();
  const resolvedProviderId = (reqProvider && providers.find((p) => p.id === reqProvider))
    ? reqProvider
    : resolveProvider();
  const provider = providers.find((p) => p.id === resolvedProviderId) ?? providers[0];
  const model = reqModel ?? provider?.defaultModel ?? "gpt-4o-mini";

  try {
    const result = await callProvider(resolvedProviderId, contextMessages, model, 0.7);

    const assistantMsg: ChatMessage = { role: "assistant", content: result.reply };
    session.messages.push(assistantMsg);

    res.json({
      reply: result.reply,
      sessionId: session.id,
      model: result.model ?? model,
      personaId: effectivePersonaId ?? undefined,
    });
  } catch (err) {
    // Remove the user message we appended if the call failed
    session.messages.pop();
    const msg = err instanceof Error ? err.message : "AI provider unavailable";
    res.status(500).json({ error: msg });
  }
});

// POST /api/qai/chat/stream — SSE streaming chat
qaiRouter.post("/chat/stream", async (req: Request, res: Response) => {
  const { message, sessionId } = req.body as { message?: string; sessionId?: string };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const ip = getIp(req);
  const session = getOrCreateSession(sessionId, ip);

  const userMsg: ChatMessage = { role: "user", content: message.trim() };
  session.messages.push(userMsg);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  req.on("close", () => { closed = true; });

  try {
    res.write(`data: ${JSON.stringify({ type: "start" })}\n\n`);

    const contextMessages: ChatMessage[] = session.messages.slice(-20);
    const providerId = resolveProvider();
    const providers = getProviders();
    const provider = providers.find((p) => p.id === providerId) ?? providers[0];
    const model = provider?.defaultModel ?? "gpt-4o-mini";

    const result = await callProvider(providerId, contextMessages, model, 0.7);
    const reply = result.reply;

    // Split into ~20-char chunks and stream with 30ms delay
    const chunkSize = 20;
    for (let i = 0; i < reply.length; i += chunkSize) {
      if (closed) break;
      const chunk = reply.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      await delay(30);
    }

    if (!closed) {
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };
      session.messages.push(assistantMsg);
      res.write(`data: ${JSON.stringify({ type: "done", sessionId: session.id, reply })}\n\n`);
    }
  } catch (err) {
    session.messages.pop(); // remove user message on error
    if (!closed) {
      const msg = err instanceof Error ? err.message : "AI provider unavailable";
      res.write(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
    }
  } finally {
    res.end();
  }
});

// GET /api/qai/sessions — list sessions for this IP
qaiRouter.get("/sessions", (req: Request, res: Response) => {
  const ip = getIp(req);
  const result = Array.from(sessions.values())
    .filter((s) => s.ip === ip)
    .map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      messageCount: s.messages.length,
      preview:
        s.messages.find((m) => m.role === "user")?.content.slice(0, 80) || "",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ sessions: result, total: result.length });
});

// GET /api/qai/sessions/:id/export — export session as markdown
qaiRouter.get("/sessions/:id/export", (req: Request, res: Response) => {
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

  const lines: string[] = [
    `# QAI Session Export`,
    ``,
    `**Session ID:** ${session.id}`,
    `**Created:** ${session.createdAt}`,
    `**Title:** ${session.title ?? "(untitled)"}`,
    ``,
  ];
  for (const msg of session.messages) {
    const role = msg.role === "user" ? "**You**" : "**Assistant**";
    lines.push(`${role}:`, ``, msg.content, ``);
  }

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(lines.join("\n"));
});

// POST /api/qai/sessions/:id/title — rename session
qaiRouter.post("/sessions/:id/title", (req: Request, res: Response) => {
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
  const { title } = req.body as { title?: string };
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  session.title = title.trim();
  res.json({ ok: true, sessionId: session.id, title: session.title });
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

// GET /api/qai/personas — list built-in personas
qaiRouter.get("/personas", (_req: Request, res: Response) => {
  res.json({ personas: PERSONAS });
});

// GET /api/qai/sessions/:id — session info
qaiRouter.get("/sessions/:id", (req: Request, res: Response) => {
  const ip = getIp(req);
  const sid = String(req.params.id);
  const session = sessions.get(sid);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (session.ip !== ip) { res.status(403).json({ error: "Forbidden" }); return; }
  const lastMsg = session.messages[session.messages.length - 1];
  res.json({
    id: session.id,
    messageCount: session.messages.length,
    personaId: session.personaId,
    createdAt: session.createdAt,
    lastAt: lastMsg ? session.createdAt : session.createdAt,
  });
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
