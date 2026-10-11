import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import {
  callProvider,
  getProviders,
  resolveProvider,
  type ChatMessage,
} from "../services/qcoreai/providers";
import { makeServiceCapture } from "../lib/sentry/platform";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { rateLimit } from "../lib/rateLimit";
import { safeErrorText } from "../lib/safeError";

const capture = makeServiceCapture("qai");

export const qaiRouter = Router();

// ─── Personas ─────────────────────────────────────────────────────────────────
const PERSONAS = [
  { id: "assistant", name: "AEVION Assistant", systemPrompt: "You are AEVION's helpful AI assistant. Be concise and practical.", emoji: "AI", description: "General-purpose helper" },
  { id: "coder", name: "Code Expert", systemPrompt: "You are an expert software engineer. Focus on clean, working code with explanations. Use markdown code blocks. Be precise about types, edge cases and performance.", emoji: "{}", description: "Software engineering, debugging" },
  { id: "mentor", name: "Patient Mentor", systemPrompt: "You are a patient mentor. Explain concepts clearly with examples appropriate for the learner's level. Ask clarifying questions when needed. Encourage curiosity.", emoji: "M", description: "Teaching and explaining" },
  { id: "critic", name: "Sharp Critic", systemPrompt: "You are a sharp, constructive critic. Identify weaknesses, logical gaps, hidden assumptions. Be direct but fair. Always suggest a concrete improvement.", emoji: "!", description: "Reviewing ideas critically" },
  { id: "writer", name: "Creative Writer", systemPrompt: "You are a creative writer. Help with storytelling, copywriting, and creative content. Favor vivid imagery and rhythm.", emoji: "W", description: "Storytelling, copy" },
  { id: "analyst", name: "Data Analyst", systemPrompt: "You are a data analyst. Help with data interpretation, statistics, and insights. Always show how the conclusion was derived.", emoji: "#", description: "Numbers and insights" },
] as const;

// Approximate token count: ~4 chars per token (OpenAI rule of thumb)
function approxTokens(s: string): number {
  if (!s) return 0;
  return Math.max(1, Math.ceil(s.length / 4));
}

interface QaiSession {
  id: string;
  title: string | null;
  messages: ChatMessage[];
  personaId: string | null;
  createdAt: string;
  ip: string;
  /** Владелец: user:<sub> для вошедшего, guest:<uuid> из подписанной cookie. */
  owner: string;
}

// ── Session store: Postgres-persisted (survives restart) + in-memory fallback ──
// Sessions are loaded/saved as a whole (chat always slices the last N messages),
// so a single row with a JSONB `messages` column matches the access pattern.
// Write-through: memSessions is a per-instance cache (Railway runs 1 replica);
// on restart the cache is cold and rehydrates from Postgres. History is capped to
// the last 200 messages per session to bound row size.
const memSessions = new Map<string, QaiSession>();
const MAX_STORED_MESSAGES = 200;
let qaiTablesReady = false;
let qaiDbAvailable = false;

async function ensureQaiTables(): Promise<void> {
  if (qaiTablesReady) return;
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS qai_sessions (
        id          TEXT PRIMARY KEY,
        title       TEXT,
        persona_id  TEXT,
        ip          TEXT NOT NULL DEFAULT '',
        owner       TEXT NOT NULL DEFAULT '',
        messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at  TEXT NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qai_sessions_ip ON qai_sessions (ip, updated_at DESC);
    `);
    // CREATE TABLE IF NOT EXISTS столбец к СУЩЕСТВУЮЩЕЙ таблице не добавляет:
    // без этого ALTER правка молча работала бы только на чистой базе.
    await getPool().query(`
      ALTER TABLE qai_sessions ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '';
      CREATE INDEX IF NOT EXISTS idx_qai_sessions_owner ON qai_sessions (owner, updated_at DESC);
    `);
    qaiTablesReady = true;
    qaiDbAvailable = true;
  } catch (err) {
    qaiTablesReady = true;
    qaiDbAvailable = false;
    console.warn("[qai] session table init skipped — using in-memory store:", err instanceof Error ? err.message : err);
  }
}

function rowToSession(r: Record<string, unknown>): QaiSession {
  const rawMsgs = r.messages;
  const messages: ChatMessage[] = Array.isArray(rawMsgs)
    ? (rawMsgs as ChatMessage[])
    : typeof rawMsgs === "string"
      ? (JSON.parse(rawMsgs) as ChatMessage[])
      : [];
  return {
    id: String(r.id),
    title: r.title == null ? null : String(r.title),
    messages,
    personaId: r.persona_id == null ? null : String(r.persona_id),
    createdAt: String(r.created_at),
    ip: String(r.ip ?? ""),
    owner: String(r.owner ?? ""),
  };
}

async function loadSession(id: string): Promise<QaiSession | null> {
  if (memSessions.has(id)) return memSessions.get(id)!;
  await ensureQaiTables();
  if (qaiDbAvailable) {
    try {
      const r = await getPool().query(
        `SELECT id, title, persona_id, ip, messages, created_at FROM qai_sessions WHERE id = $1`,
        [id],
      );
      if (r.rows.length) {
        const s = rowToSession(r.rows[0] as Record<string, unknown>);
        memSessions.set(s.id, s);
        return s;
      }
    } catch (err) {
      console.warn("[qai] loadSession failed:", err instanceof Error ? err.message : err);
      // Раньше отсюда возвращался null, и вызывающий отвечал «Session not
      // found». Отказ базы подменялся отсутствием сессии: человек, у которого
      // сессия ЕСТЬ, получал 404 и уходил считать, что она пропала.
      //
      // Проверено положительным контролем 21.08.2026: с работающей базой та же
      // ручка доходит до проверки владельца и отвечает 403, с падающей — 404.
      // Значит база на пути, и её отказ читался как «нет записи».
      throw new StorageUnavailable();
    }
  }
  return null;
}

/** Хранилище не ответило. Это НЕ «сессии нет» — разные новости. */
class StorageUnavailable extends Error {
  constructor() {
    super("storage_unavailable");
    this.name = "StorageUnavailable";
  }
}

/**
 * Сессия по идентификатору — или ответ клиенту, если её нельзя было прочитать.
 *
 * Возвращает null, когда ответ уже отправлен: вызывающему остаётся выйти.
 * Сделано помощником, а не try/catch в каждом из четырёх обработчиков, чтобы
 * формулировка отказа была одна и не разошлась при следующей правке.
 */
async function loadSessionOrReply(
  sid: string,
  res: Response,
): Promise<QaiSession | null> {
  try {
    return await loadSession(sid);
  } catch (e) {
    if (e instanceof StorageUnavailable) {
      res.status(503).json({
        error: "storage_unavailable",
        warning:
          "Хранилище временно недоступно. Это НЕ значит, что сессии нет — " +
          "прочитать её не удалось. Повторите запрос позже.",
      });
      return null;
    }
    throw e;
  }
}

async function saveSession(s: QaiSession): Promise<void> {
  // Cap history to bound row size — keep the most recent messages.
  if (s.messages.length > MAX_STORED_MESSAGES) {
    s.messages = s.messages.slice(-MAX_STORED_MESSAGES);
  }
  memSessions.set(s.id, s);
  await ensureQaiTables();
  if (qaiDbAvailable) {
    try {
      await getPool().query(
        `INSERT INTO qai_sessions (id, title, persona_id, ip, owner, messages, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
         ON CONFLICT (id) DO UPDATE
           SET title = EXCLUDED.title,
               persona_id = EXCLUDED.persona_id,
               messages = EXCLUDED.messages,
               updated_at = NOW()`,
        [s.id, s.title, s.personaId, s.ip, s.owner, JSON.stringify(s.messages), s.createdAt],
      );
    } catch (err) {
      console.warn("[qai] saveSession failed (kept in memory):", err instanceof Error ? err.message : err);
    }
  }
}

async function listSessionsByOwner(owner: string): Promise<QaiSession[]> {
  // Пустой владелец — это «не установлен», а не «совпадает с пустыми»: иначе
  // старые записи (owner='') стали бы общими для всех, кто не вошёл.
  if (!owner) return [];
  await ensureQaiTables();
  if (qaiDbAvailable) {
    try {
      const r = await getPool().query(
        `SELECT id, title, persona_id, ip, owner, messages, created_at FROM qai_sessions WHERE owner = $1 ORDER BY updated_at DESC LIMIT 100`,
        [owner],
      );
      return r.rows.map((row: Record<string, unknown>) => rowToSession(row));
    } catch (err) {
      console.warn("[qai] listSessionsByOwner failed:", err instanceof Error ? err.message : err);
    }
  }
  return Array.from(memSessions.values()).filter((s) => s.owner === owner);
}

async function deleteSessionStore(id: string): Promise<void> {
  memSessions.delete(id);
  await ensureQaiTables();
  if (qaiDbAvailable) {
    try {
      await getPool().query(`DELETE FROM qai_sessions WHERE id = $1`, [id]);
    } catch (err) {
      console.warn("[qai] deleteSession failed:", err instanceof Error ? err.message : err);
    }
  }
}

async function countSessions(): Promise<number> {
  await ensureQaiTables();
  if (qaiDbAvailable) {
    try {
      const r = await getPool().query(`SELECT COUNT(*)::int AS c FROM qai_sessions`);
      return (r.rows[0] as { c: number }).c;
    } catch { /* fall through */ }
  }
  return memSessions.size;
}

// ── Владелец сессии ──────────────────────────────────────────────────────────
// 🔴 Раньше принадлежность переписки определял АДРЕС (x-forwarded-for). Адрес
// приходит в запросе от клиента, а за NAT (офис, кафе, мобильный оператор) он
// один у множества людей — то есть чужую переписку было видно без входа.
// Теперь владелец — вход, а без входа подписанная СЕРВЕРОМ метка гостя в
// httpOnly-cookie. Адрес остался только для ограничения темпа.
const GUEST_COOKIE = "qai_guest";
const GUEST_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function guestSecret(): string {
  return process.env.AUTH_JWT_SECRET ?? "";
}

function signGuest(id: string): string {
  return crypto.createHmac("sha256", guestSecret()).update(id).digest("hex").slice(0, 32);
}

function readGuestCookie(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw || !guestSecret()) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== GUEST_COOKIE) continue;
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    const dot = value.lastIndexOf(".");
    if (dot <= 0) return null;
    const id = value.slice(0, dot);
    const подпись = Buffer.from(value.slice(dot + 1));
    const ожидаемая = Buffer.from(signGuest(id));
    // timingSafeEqual падает на разной длине — сравниваем её отдельно.
    if (подпись.length !== ожидаемая.length) return null;
    return crypto.timingSafeEqual(подпись, ожидаемая) ? id : null;
  }
  return null;
}

/**
 * Владелец запроса. Пустая строка значит «установить не удалось», и ручки
 * обязаны вести себя как при чужой сессии, а не пропускать (§14: пропуск ведёт
 * к утечке наружу — значит закрываемся).
 * Cookie ставится, только пока заголовки не ушли: у SSE звать ДО flushHeaders.
 */
function getOwner(req: Request, res: Response): string {
  const auth = verifyBearerOptional(req);
  const sub = auth?.sub ?? auth?.email;
  if (sub) return `user:${sub}`;
  const прежний = readGuestCookie(req);
  if (прежний) return `guest:${прежний}`;
  if (!guestSecret()) return "";
  const id = crypto.randomUUID();
  if (!res.headersSent) {
    res.cookie(GUEST_COOKIE, `${id}.${signGuest(id)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: GUEST_TTL_MS,
      path: "/api/qai",
    });
  }
  return `guest:${id}`;
}
function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) return raw.split(",")[0].trim();
  return req.socket?.remoteAddress || "anonymous";
}

async function getOrCreateSession(sessionId: string | undefined, ip: string, owner: string): Promise<QaiSession | null> {
  if (!owner) return null;
  if (sessionId) {
    const existing = await loadSession(sessionId);
    // Продолжать можно только СВОЮ переписку: иначе чужая история попала бы в
    // контекст ответа — та же утечка, только через чат, а не через чтение.
    if (existing) return existing.owner === owner ? existing : null;
  }
  const s: QaiSession = { id: crypto.randomUUID(), title: null, messages: [], personaId: null, createdAt: new Date().toISOString(), ip, owner };
  memSessions.set(s.id, s);
  return s;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/qai/chat
// Ограничитель на платный ИИ. Свип 06.09.2026: ручка звала модель
// АНОНИМНО и БЕЗ какого-либо предела темпа — потолком расхода была
// пропускная способность сети. Учёт расхода — отдельный долг платформы;
// предел темпа обязателен уже сейчас.
const qaiAiLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "qai-ai" });

qaiRouter.post("/chat", qaiAiLimit, async (req: Request, res: Response) => {
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
  const owner = getOwner(req, res);
  const session = await getOrCreateSession(sessionId, ip, owner);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

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
    const result = await callProvider(resolvedProviderId, contextMessages, model, 0.7, undefined, undefined, { module: "qai-chat" });

    const assistantMsg: ChatMessage = { role: "assistant", content: result.reply };
    session.messages.push(assistantMsg);
    await saveSession(session);

    const promptChars = contextMessages.reduce((acc, m) => acc + (m.content?.length ?? 0), 0);
    const completionChars = result.reply.length;
    res.json({
      reply: result.reply,
      sessionId: session.id,
      model: result.model ?? model,
      personaId: effectivePersonaId ?? undefined,
      usage: {
        promptChars,
        completionChars,
        totalChars: promptChars + completionChars,
        approxPromptTokens: approxTokens(contextMessages.map((m) => m.content).join("\n")),
        approxCompletionTokens: approxTokens(result.reply),
        approxTotalTokens: approxTokens(contextMessages.map((m) => m.content).join("\n")) + approxTokens(result.reply),
      },
    });
  } catch (err) {
    capture(err);
    // Remove the user message we appended if the call failed
    session.messages.pop();
    const msg = err instanceof Error ? err.message : "AI provider unavailable"; // только для журнала
    const msgPublic = safeErrorText(err, "AI provider unavailable", "qai");
    res.status(500).json({ error: msgPublic });
  }
});

// POST /api/qai/chat/stream — SSE streaming chat (word-by-word, 40ms cadence)
qaiRouter.post("/chat/stream", qaiAiLimit, async (req: Request, res: Response) => {
  const { message, sessionId, personaId } = req.body as {
    message?: string;
    sessionId?: string;
    personaId?: string;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.setHeader("Content-Type", "text/event-stream");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "error", message: "message required" })}\n\n`);
    res.end();
    return;
  }

  // Владельца берём ДО flushHeaders: после отправки заголовков cookie гостя
  // уже не поставить, и он потерял бы доступ к своей же переписке.
  const owner = getOwner(req, res);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const ip = getIp(req);
  const session = await getOrCreateSession(sessionId, ip, owner);
  if (!session) {
    // Заголовки уже ушли — отказ сообщаем тем же событием, что и прочие ошибки.
    res.write(`data: ${JSON.stringify({ type: "error", message: "Session not found" })}\n\n`);
    res.end();
    return;
  }

  // Apply persona to session if provided
  if (personaId) session.personaId = personaId;
  const effectivePersonaId = personaId ?? session.personaId;

  const userMsg: ChatMessage = { role: "user", content: message.trim() };
  session.messages.push(userMsg);

  let closed = false;
  // 🔴 30.09.2026: слушаем закрытие ОТВЕТА, а не запроса.
  // `close` у запроса срабатывает и при обычном, полном его прочтении.
  // Держалось это на случайности: между разбором тела и навешиванием
  // слушателя здесь есть await, и событие успевало пройти раньше — то
  // есть слушатель просто не срабатывал. Уберите этот await, и маршрут
  // молча начнёт отдавать пустой поток: код 200, корректный конец, ноль
  // текста. Ровно так сломался тренер (см. routes/coach.ts). Разбор и
  // замеры — коммит 33778ce35.
  res.on("close", () => { closed = true; });

  res.write(`data: ${JSON.stringify({ type: "start", sessionId: session.id })}\n\n`);

  try {
    // Build context with optional system persona prompt
    let contextMessages: ChatMessage[] = session.messages.slice(-10);
    if (effectivePersonaId) {
      const persona = PERSONAS.find((p) => p.id === effectivePersonaId);
      if (persona) {
        contextMessages = [
          { role: "system", content: persona.systemPrompt },
          ...contextMessages,
        ];
      }
    }

    const providers = getProviders();
    const providerId = resolveProvider();
    const provider = providers.find((p) => p.id === providerId) ?? providers[0];
    const model = provider?.defaultModel ?? "gpt-4o-mini";

    let fullReply = "";
    if (!provider || !provider.configured) {
      fullReply = `[AEVION QAI — stub mode] You asked: "${message.trim().slice(0, 100)}"`;
    } else {
      const result = await callProvider(providerId, contextMessages, model, 0.7, undefined, undefined, { module: "qai-chat-stream" });
      fullReply = result.reply;
    }

    // Stream word-by-word with 40ms delay
    const words = fullReply.split(/(\s+)/);
    for (const word of words) {
      if (closed) break;
      res.write(`data: ${JSON.stringify({ type: "chunk", text: word })}\n\n`);
      await delay(40);
    }

    if (!closed) {
      const assistantMsg: ChatMessage = { role: "assistant", content: fullReply };
      session.messages.push(assistantMsg);
      await saveSession(session);
      const promptChars = contextMessages.reduce((acc, m) => acc + (m.content?.length ?? 0), 0);
      const completionChars = fullReply.length;
      const usage = {
        promptChars,
        completionChars,
        totalChars: promptChars + completionChars,
        approxPromptTokens: approxTokens(contextMessages.map((m) => m.content).join("\n")),
        approxCompletionTokens: approxTokens(fullReply),
        approxTotalTokens: approxTokens(contextMessages.map((m) => m.content).join("\n")) + approxTokens(fullReply),
      };
      res.write(`data: ${JSON.stringify({ type: "done", sessionId: session.id, reply: fullReply, model, personaId: effectivePersonaId ?? null, usage })}\n\n`);
    }
  } catch (err) {
    capture(err);
    session.messages.pop(); // remove user message on error
    if (!closed) {
      const msg = err instanceof Error ? err.message : "stream failed"; // только для журнала
      const msgPublic = safeErrorText(err, "stream failed", "qai");
      res.write(`data: ${JSON.stringify({ type: "error", message: msgPublic })}\n\n`);
    }
  } finally {
    res.end();
  }
});

// GET /api/qai/sessions — list sessions for this IP
qaiRouter.get("/sessions", async (req: Request, res: Response) => {
  const owner = getOwner(req, res);
  const result = (await listSessionsByOwner(owner))
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
qaiRouter.get("/sessions/:id/export", async (req: Request, res: Response) => {
  const owner = getOwner(req, res);
  const sid = String(req.params.id);
  const session = await loadSessionOrReply(sid, res);
  if (!session) {
    // Помощник мог уже ответить 503: «не смогли прочитать» — не то же самое,
    // что «сессии нет», и второй ответ уронил бы обработчик.
    if (!res.headersSent) res.status(404).json({ error: "Session not found" });
    return;
  }
  // 404, а не 403: «нет доступа» подтверждало бы, что такая переписка есть.
  if (session.owner !== owner) {
    res.status(404).json({ error: "Session not found" });
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
qaiRouter.post("/sessions/:id/title", async (req: Request, res: Response) => {
  const owner = getOwner(req, res);
  const sid = String(req.params.id);
  const session = await loadSessionOrReply(sid, res);
  if (!session) {
    // Помощник мог уже ответить 503: «не смогли прочитать» — не то же самое,
    // что «сессии нет», и второй ответ уронил бы обработчик.
    if (!res.headersSent) res.status(404).json({ error: "Session not found" });
    return;
  }
  // 404, а не 403: «нет доступа» подтверждало бы, что такая переписка есть.
  if (session.owner !== owner) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const { title } = req.body as { title?: string };
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  session.title = title.trim();
  await saveSession(session);
  res.json({ ok: true, sessionId: session.id, title: session.title });
});

// DELETE /api/qai/sessions/:id — clear history
qaiRouter.delete("/sessions/:id", async (req: Request, res: Response) => {
  const owner = getOwner(req, res);
  const sid = String(req.params.id);
  const session = await loadSessionOrReply(sid, res);
  if (!session) {
    // Помощник мог уже ответить 503: «не смогли прочитать» — не то же самое,
    // что «сессии нет», и второй ответ уронил бы обработчик.
    if (!res.headersSent) res.status(404).json({ error: "Session not found" });
    return;
  }
  // 404, а не 403: «нет доступа» подтверждало бы, что такая переписка есть.
  if (session.owner !== owner) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await deleteSessionStore(sid);
  res.json({ ok: true });
});

// GET /api/qai/personas — list built-in personas
qaiRouter.get("/personas", (_req: Request, res: Response) => {
  res.json({ personas: PERSONAS });
});

// GET /api/qai/sessions/:id — session info
qaiRouter.get("/sessions/:id", async (req: Request, res: Response) => {
  const owner = getOwner(req, res);
  const sid = String(req.params.id);
  const session = await loadSessionOrReply(sid, res);
  // Помощник мог уже ответить 503 — второй ответ уронил бы обработчик.
  if (!session) { if (!res.headersSent) res.status(404).json({ error: "Session not found" }); return; }
  if (session.owner !== owner) { res.status(404).json({ error: "Session not found" }); return; }
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
qaiRouter.get("/health", async (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "qai",
    store: qaiDbAvailable ? "postgres" : "memory",
    sessions: await countSessions(),
    timestamp: new Date().toISOString(),
  });
});
