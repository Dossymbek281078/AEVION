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

import { clientIp } from "../lib/rateLimit";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { readJsonFile, updateJsonFile } from "../lib/jsonFileStore";
import { rateLimit } from "../lib/rateLimit";
import { requireAuth } from "../lib/authJwt";
import { countChatTurns, listChatTurns, recordChatTurn, type ChatTurn } from "../lib/chatHistory";
import { usageToTokens } from "../lib/usageTokens";
import { costUsd } from "../services/qcoreai/pricing";
import { makeServiceCapture } from "../lib/sentry/platform";
import { csvNeutralizeFormula } from "../lib/csv";
import { buildDissentMap } from "../services/multichat/dissent";
import { buildReceipt, signReceipt, verifyReceipt } from "../services/multichat/receipt";

const captureMultichatError = makeServiceCapture("multichat");

export const multichatRouter = Router();

// All multichat surfaces are user-scoped — anonymous traffic gets 401.
multichatRouter.use(requireAuth);

// 12 fan-outs / min per user. Each fan-out triggers up to N provider calls
// (the qcoreai chatLimiter handles per-call ceilings); this protects the
// conversation/turn write path from abuse.
const dispatchLimiter = rateLimit({
  capacity: 12,
  refillPerSec: 12 / 60,
  // clientIp(), а не сырой req.ip: свой keyFn случайно отказывается от
  // нормализации, которую умолчание rateLimit() делает само. Без неё анонимный
  // посетитель с обычной домашней IPv6-выдачей получает свежее окно с каждого
  // адреса своей подсети — то есть предел на ПЛАТНЫЙ вызов ИИ не ограничивает
  // расход. Ключ по пользователю остаётся первым: он точнее адреса.
  keyFn: (req) => `mc:${req.auth?.sub || clientIp(req)}`,
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
    // updateJsonFile, а не пара read+write: список бесед общий на всех, и
    // параллельные создание/переименование/шаринг затирали друг друга —
    // беседа просто пропадала из библиотеки без единой ошибки.
    await updateJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] }, (data) => {
      const items = Array.isArray(data.items) ? data.items : [];
      items.push(c);
      return { items };
    });
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
  await updateJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] }, (data) => {
    const items = Array.isArray(data.items) ? data.items : [];
    const c = items.find((x) => x.id === id);
    if (c) c.updatedAt = new Date().toISOString();
    return { items };
  });
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

// ─── Лента веера: беседа + подветка на каждого агента ──────────────────────
//
// Ответ агента живёт в собственной подветке `${conversationId}:${agentId}`:
// так соседние агенты не перемешиваются в одну простыню и каждого можно
// доспросить отдельно. Разделитель и разбор — в одном месте, потому что три
// читателя (беседа, экспорт, публичная ссылка) разъедутся на первой же правке,
// если каждый будет резать строку сам.

const AGENT_THREAD_SEP = ":";

function agentThreadId(conversationId: string, agentId: string): string {
  return `${conversationId}${AGENT_THREAD_SEP}${agentId}`;
}

/** Маркер несостоявшегося ответа — им же держится позиционное соответствие
 *  «вопрос ↔ ответ каждого агента» в публичном просмотре. */
const NO_REPLY_PREFIX = "[no-reply]";

async function recordAgentFailure(userId: string, threadId: string, reason: string): Promise<void> {
  await recordChatTurn({
    userId,
    conversationId: threadId,
    role: "system",
    content: `${NO_REPLY_PREFIX} ${String(reason).slice(0, 200)}`,
  });
}

export type LedgerTurn = ChatTurn & { agentId: string | null };

/** Помечает каждую реплику её агентом (null — реплика самого пользователя). */
// Сколько реплик берём в ленту и сколько — в выгрузку/счётчик.
//
// Оба числа стоят рядом намеренно: раньше выгрузка просила 5000, а хранилище
// молча отдавало 500, и разойтись им было негде — потолок жил в другом файле.
const FEED_LIMIT = 200;
const FULL_READ_LIMIT = 5000;

/**
 * Лента + признак, что она неполная.
 *
 * Обрезанная выборка и полная выглядят одинаково, поэтому каждый читающий
 * эндпоинт обязан отдать `totalTurns` и `truncated` — иначе «выгрузка для
 * compliance» и счётчик расхода тихо занижают, оставаясь при 200 OK.
 */
async function readFeed(
  userId: string,
  conversationId: string,
  limit: number,
): Promise<{ turns: LedgerTurn[]; totalTurns: number; truncated: boolean }> {
  const [turns, totalTurns] = await Promise.all([
    listChatTurns({ userId, conversationId, includeAgentThreads: true, limit }),
    countChatTurns({ userId, conversationId, includeAgentThreads: true }),
  ]);
  return {
    turns: withAgentIds(conversationId, turns),
    totalTurns,
    truncated: totalTurns > turns.length,
  };
}

function withAgentIds(rootId: string, turns: ChatTurn[]): LedgerTurn[] {
  const prefix = `${rootId}${AGENT_THREAD_SEP}`;
  return turns.map((t) => {
    const cid = t.conversationId ?? "";
    return { ...t, agentId: cid.startsWith(prefix) ? cid.slice(prefix.length) : null };
  });
}

/**
 * Расход по беседе — из фактически записанных реплик, а не из выдуманного поля.
 *
 * До этого счётчик читал `turn.usage`, которого у реплики нет и никогда не
 * было: эндпоинт всегда отдавал 0 вызовов и $0.0000, а библиотека честно эти
 * нули показывала. Считаем по tokensIn/tokensOut и прайс-листу QCoreAI.
 *
 * `unpricedCalls` — вызовы, для которых цена неизвестна (бесплатный флот,
 * локальная модель, провайдер вне таблицы). Их нельзя молча сложить с нулём:
 * «$0.00» и «не знаем» — разные утверждения.
 */
export function aggregateUsage(turns: Array<Partial<ChatTurn>>): {
  calls: number;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  unpricedCalls: number;
} {
  let calls = 0;
  let input = 0;
  let output = 0;
  let total = 0;
  let unpricedCalls = 0;

  for (const t of turns) {
    if (t.role !== "assistant") continue;
    calls += 1;
    const tin = Number(t.tokensIn ?? 0) || 0;
    const tout = Number(t.tokensOut ?? 0) || 0;
    input += tin;
    output += tout;
    const priced = t.provider && t.model ? costUsd(t.provider, t.model, tin, tout) : 0;
    if (priced > 0) total += priced;
    else unpricedCalls += 1;
  }

  return {
    calls,
    tokens: { input, output, total: input + output },
    costUsd: Number(total.toFixed(6)),
    unpricedCalls,
  };
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
  let deleted = false;
  await updateJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] }, (data) => {
    const items = Array.isArray(data.items) ? data.items : [];
    const filtered = items.filter((c) => !(c.id === id && c.userId === userId));
    deleted = filtered.length !== items.length;
    return { items: filtered };
  });
  return deleted;
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
  let renamed: Conversation | null = null;
  await updateJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] }, (data) => {
    const items = Array.isArray(data.items) ? data.items : [];
    const c = items.find((x) => x.id === id && x.userId === userId);
    if (c) {
      c.title = safe;
      c.updatedAt = new Date().toISOString();
      renamed = c;
    }
    return { items };
  });
  return renamed;
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
  let updated: Conversation | null = null;
  await updateJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] }, (data) => {
    const items = Array.isArray(data.items) ? data.items : [];
    const c = items.find((x) => x.id === id && x.userId === userId);
    if (c) {
      c.shareToken = token;
      c.updatedAt = new Date().toISOString();
      updated = c;
    }
    return { items };
  });
  return updated;
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

/** Неотрицательное целое из query-параметра. `null` — значение задано и негодно. */
function parseCount(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Сколько бесед совпало с запросом — без пагинации. */
async function countConvs(userId: string, q: string): Promise<number> {
  if (isPg()) {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT COUNT(*)::int AS n FROM multichat_conversations WHERE user_id = $1 AND title ILIKE $2`,
      [userId, `%${q}%`],
    );
    return Number(r.rows[0]?.n ?? 0) || 0;
  }
  const data = await readJsonFile<{ items: Conversation[] }>(STORE_REL, { items: [] });
  const items = Array.isArray(data.items) ? data.items : [];
  const needle = q.toLowerCase();
  return items.filter((c) => c.userId === userId && c.title.toLowerCase().includes(needle)).length;
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

// GET /api/multichat/health — лёгкая проверка доступа к модулю.
//
// Её зовёт страница `multichat-engine/page.tsx` через `fetchOrPaywall`, чтобы
// отличить «модуль не куплен» от всего остального: роутер смонтирован за
// requireModule("multichat-engine"), поэтому без доступа сюда прилетит 402 с
// payload'ом пейволла, и страница покажет предложение купить.
//
// Ручки не существовало, а `fetchOrPaywall` по устройству трактует всё, кроме
// 402, как «не заблокировано» — то есть 404 молча означал «пускать всех».
// Пока PAYWALL_MODULES пуст, это ничего не ломало; в день включения пейволла
// человек без модуля увидел бы страницу вместо предложения купить. Найдено
// прогоном scripts/build-contract-check.mjs 2026-08-10.
//
// Никаких данных не отдаёт намеренно: весь смысл в коде ответа.
multichatRouter.get("/health", (_req, res) => {
  res.json({ ok: true, module: "multichat-engine" });
});

// POST /api/multichat/conversations { title }
multichatRouter.post("/conversations", async (req, res) => {
  const userId = req.auth!.sub;
  const title = typeof req.body?.title === "string" ? req.body.title : "New conversation";
  try {
    const c = await createConv(userId, title);
    res.status(201).json(c);
  } catch (err: any) {
    captureMultichatError(err, { route: "create-conversation" });
    res.status(500).json({ error: "create failed", });
  }
});

// GET /api/multichat/conversations
multichatRouter.get("/conversations", async (req, res) => {
  const userId = req.auth!.sub;
  try {
    const items = await listConvs(userId);
    res.json({ items, total: items.length });
  } catch (err: any) {
    captureMultichatError(err, { route: "list-conversations" });
    res.status(500).json({ error: "list failed", });
  }
});

// GET /api/multichat/conversations/:id  → conversation + last 200 turns
multichatRouter.get("/conversations/:id", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation not found" });
    const feed = await readFeed(userId, id, FEED_LIMIT);
    res.json({ conversation: conv, ...feed });
  } catch (err: any) {
    captureMultichatError(err, { route: "get-conversation", entityId: id });
    res.status(500).json({ error: "fetch failed", });
  }
});

// POST /api/multichat/conversations/:id/dispatch
//   { prompt, agents: [{ id, role, provider?, model?, temperature? }, ...] }
//
// Fans out one prompt across N agents in parallel. Returns an array aligned
// with the input agents.
//
// Лента: вопрос пишется один раз на беседу, ответ каждого агента — в свою
// подветку `${conversationId}:${agentId}`, запись делает ЭТОТ обработчик.
// Не отдавать её /api/qcoreai/chat: он принимает conversationId в теле и
// молча его игнорирует — на этом обещании три эндпоинта (экспорт, публичная
// ссылка, расход) месяцами возвращали разговор без единого ответа.
// Не ответивший агент тоже попадает в ленту (role: system) — иначе в
// публичном просмотре ответы соседей молча сдвигаются на его место.
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

  // Одинаковые id — отказ, а не тихая потеря ответа.
  //
  // Ответ каждого агента пишется в подветку `${conversationId}:${agentId}`.
  // Два агента с одним id пишут в одну: вызовы оплачены, реплики сохранены, а
  // всё, что раскладывает ленту ПО АГЕНТУ (публичная страница, карта
  // разногласий), видит одного — второй ответ пропадает с экрана без следа.
  const ids = (agents as Array<{ id?: unknown }>).map((a, i) => (typeof a.id === "string" ? a.id : `agent_${i}`));
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) {
    return res.status(400).json({ error: `duplicate agent id: ${duplicate}` });
  }

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

  // Тайм-аут на агента.
  //
  // Веер ждёт всех через Promise.all, то есть консилиум возвращается по САМОМУ
  // МЕДЛЕННОМУ. Без тайм-аута провайдер, который принял соединение и замолчал,
  // держал весь запрос столько, сколько позволит сеть, — а человек всё это
  // время смотрел на «Агенты отвечают…», хотя двое из трёх уже ответили.
  //
  // 60 секунд: длинный ответ модели укладывается с запасом, но зависание
  // становится отличимым от работы. Переопределяется на прогонах.
  const agentTimeoutMs = Number(process.env.MULTICHAT_AGENT_TIMEOUT_MS) || 60_000;

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

    const threadId = agentThreadId(conversationId, agentId);

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
          conversationId: threadId,
        }),
        signal: AbortSignal.timeout(agentTimeoutMs),
      });
      const data = (await r.json().catch(() => null)) as {
        reply?: string;
        mode?: string;
        provider?: string;
        model?: string;
        usage?: unknown;
        error?: string;
      } | null;
      if (!r.ok) {
        const error = data?.error || `upstream ${r.status}`;
        await recordAgentFailure(userId, threadId, error);
        return {
          agentId,
          role,
          ok: false,
          error,
        };
      }
      if (!data?.reply?.trim()) {
        // /api/qcoreai/chat returned 200 with no (or blank) reply — a real
        // failure the caller shouldn't render as a successful, silently-empty
        // chat bubble.
        await recordAgentFailure(userId, threadId, "empty reply from provider");
        return {
          agentId,
          role,
          ok: false,
          error: "empty reply from provider",
        };
      }
      // Ответ агента кладём в ленту САМИ. Раньше комментарий выше обещал, что
      // это делает /api/qcoreai/chat по переданному conversationId — тот его
      // просто игнорирует, и в базе оставались одни вопросы: экспорт, публичная
      // ссылка и счётчик токенов отдавали половину разговора как целый.
      const { tokensIn, tokensOut } = usageToTokens(data.usage);
      await recordChatTurn({
        userId,
        conversationId: threadId,
        role: "assistant",
        content: data.reply,
        // Ключ прайс-листа — идентификатор провайдера (`mode`), а не его
        // человекочитаемое имя из поля `provider`.
        provider: data.mode ?? null,
        model: data.model ?? model ?? null,
        tokensIn,
        tokensOut,
      });
      return {
        agentId,
        role,
        ok: true,
        reply: data.reply,
        provider: data?.provider ?? null,
        model: data?.model ?? null,
        usage: data?.usage ?? null,
      };
    } catch (err: any) {
      // Молчание провайдера — не поломка нашего кода, и в Sentry ему не место:
      // иначе шумная минута у апстрима хоронит настоящие ошибки веера. Но на
      // экран причина уходит своя, а не общее «dispatch failed» — «не ответил
      // за 60 с» и «упал» человек чинит по-разному.
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      const error = timedOut
        ? `no reply within ${Math.round(agentTimeoutMs / 1000)}s`
        : err?.message || "dispatch failed";
      if (!timedOut) captureMultichatError(err, { route: "dispatch-agent", entityId: agentId });
      await recordAgentFailure(userId, threadId, error);
      return {
        agentId,
        role,
        ok: false,
        error,
      };
    }
  });

  const results = await Promise.all(calls);

  // Карта разногласий считается ЗДЕСЬ же, из уже полученных ответов: ни одного
  // дополнительного вызова модели, поэтому она бесплатна и воспроизводима.
  // Разногласие — то, что все остальные продукты выбрасывают при синтезе, а оно
  // и есть указание, где смотреть человеку.
  const dissent = buildDissentMap(results as never);

  // Чек: канонический артефакт с составом панели, хешами ответов, картой
  // разногласий и стоимостью. Ответ без происхождения — это мнение; ответ с
  // чеком можно предъявить. Подпись берётся из реестра QSign v2, а если ключей
  // нет — чек честно уходит неподписанным, но с проверяемым хешем.
  const signedReceipt = await signReceipt(
    buildReceipt({
      conversationId,
      prompt,
      answers: results as never,
      dissent,
      askedAt: new Date().toISOString(),
    })
  );
  await touchConv(conversationId);

  res.json({
    conversationId,
    prompt,
    results,
    dissent,
    receipt: signedReceipt,
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
    captureMultichatError(err, { route: "delete-conversation", entityId: id });
    res.status(500).json({ error: "delete_failed", });
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
    captureMultichatError(err, { route: "rename-conversation", entityId: id });
    res.status(500).json({ error: "rename_failed", });
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
    const feed = await readFeed(userId, id, FULL_READ_LIMIT);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="multichat-${id}.json"`);
    res.json({ conversation: conv, ...feed, exportedAt: new Date().toISOString() });
  } catch (err: any) {
    captureMultichatError(err, { route: "export-json", entityId: id });
    res.status(500).json({ error: "export_failed", });
  }
});

// GET /api/multichat/conversations/:id/export.csv — CSV (one row per turn)
multichatRouter.get("/conversations/:id/export.csv", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });
    const { turns, totalTurns, truncated } = await readFeed(userId, id, FULL_READ_LIMIT);
    // Выгружается content — текст сообщений, который пишет пользователь. Гашение
    // формул берём из общего lib/csv: значение с ведущим = + - @ Excel исполняет
    // при открытии файла.
    const esc = (v: unknown): string => {
      if (v == null) return "";
      const s = csvNeutralizeFormula(String(v));
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    // Колонка agent появилась вместе с записью ответов: без неё выгрузка веера
    // из трёх агентов читается как один сплошной монолог непонятно чей.
    const lines = ["created_at,agent,role,content"];
    for (const t of turns) {
      lines.push([esc(t.createdAt), esc(t.agentId ?? ""), esc(t.role), esc(t.content)].join(","));
    }
    // Неполная выгрузка говорит о себе строкой в самом файле, а не только
    // заголовком ответа: человек открывает CSV в Excel и заголовков не видит,
    // а недостающие реплики отличить не от чего.
    if (truncated) {
      lines.push(
        [
          esc(new Date().toISOString()),
          "",
          "system",
          esc(`выгружены последние ${turns.length} реплик из ${totalTurns}`),
        ].join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="multichat-${id}.csv"`);
    res.setHeader("X-Aevion-Total-Turns", String(totalTurns));
    res.setHeader("X-Aevion-Truncated", truncated ? "true" : "false");
    res.send(lines.join("\n") + "\n");
  } catch (err: any) {
    captureMultichatError(err, { route: "export-csv", entityId: id });
    res.status(500).json({ error: "export_failed", });
  }
});

// GET /api/multichat/conversations/:id/usage — расход по беседе: вызовы,
// токены, цена. Считается по репликам агентов из ленты (их пишет dispatch) и
// прайс-листу QCoreAI. Для вызовов без цены отдельный счётчик unpricedCalls —
// «бесплатно» и «цена неизвестна» не одно и то же.
multichatRouter.get("/conversations/:id/usage", async (req, res) => {
  const userId = req.auth!.sub;
  const id = String(req.params.id);
  try {
    const conv = await findConv(id, userId);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });
    const { turns, totalTurns, truncated } = await readFeed(userId, id, FULL_READ_LIMIT);
    // truncated здесь — не косметика: расход при обрыве ЗАНИЖЕН, а число без
    // признака неполноты выглядит как окончательное.
    res.json({ conversationId: id, ...aggregateUsage(turns), totalTurns, truncated });
  } catch (err: any) {
    captureMultichatError(err, { route: "usage", entityId: id });
    res.status(500).json({ error: "usage_failed", });
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
    captureMultichatError(err, { route: "share-conversation", entityId: id });
    res.status(500).json({ error: "share_failed", });
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
    captureMultichatError(err, { route: "revoke-share", entityId: id });
    res.status(500).json({ error: "revoke_failed", });
  }
});

// GET /api/multichat/search?q=...&limit=&offset= — title-substring search
multichatRouter.get("/search", async (req, res) => {
  const userId = req.auth!.sub;
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  // Нечисловой параметр — отказ с причиной. Раньше Number("abc") давал NaN,
  // выборка молча возвращала пустой список, и это читалось как «ничего не
  // найдено»: человек уходит искать в другое место вместо того, чтобы
  // исправить запрос.
  const limit = parseCount(req.query.limit, 50);
  if (limit === null) return res.status(400).json({ error: "limit must be a non-negative number" });
  const offset = parseCount(req.query.offset, 0);
  if (offset === null) return res.status(400).json({ error: "offset must be a non-negative number" });
  if (!q) return res.json({ items: [], total: 0 });
  try {
    // total — сколько СОВПАЛО, а не сколько уместилось на странице. Длина
    // страницы в поле с именем total превращает «показано 2 из 3» в «найдено 2».
    const [items, total] = await Promise.all([
      searchConvs(userId, q, limit, offset),
      countConvs(userId, q),
    ]);
    res.json({ items, total, q });
  } catch (err: any) {
    captureMultichatError(err, { route: "search" });
    res.status(500).json({ error: "search_failed", });
  }
});

// ─── Phase 3: provider health + system-prompt presets ────────────────────
//
// Two small additions that make the Multichat hub useful without opening a
// chat first:
//   1. /api/multichat/provider-status — per-provider live ping with latency.
//      The /multichat-engine landing renders these as colored badges so a
//      user sees at a glance whether Anthropic / OpenAI / Gemini / DeepSeek
//      / Grok are reachable from THIS backend right now.
//   2. /api/multichat/presets — curated "mission" presets (Code review /
//      Translate / Summarize / Brainstorm / Debug). Each preset bundles a
//      system prompt + recommended agent roles + a default provider, so a
//      one-click "launch this mission" creates a conversation pre-wired for
//      the task. Keeps preset definitions server-side so all clients see
//      the same list (the in-page hardcoded PRESETS array is a UI bundle —
//      this is the canonical mission catalogue for any client).
//
// Both endpoints are auth-required (mounted under multichatRouter, which
// applies requireAuth at the top of the file) — they leak no business
// secrets but reading them implies an active session.

type ProviderStatus = {
  id: string;
  name: string;
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
  defaultModel: string | null;
  error?: string;
};

// Cache provider-status for 20s to avoid hammering the upstream qcoreai
// /providers endpoint when the UI auto-refreshes every 30s across many tabs.
let providerStatusCache: { at: number; data: ProviderStatus[]; catalogLatencyMs: number } | null = null;
const PROVIDER_STATUS_TTL_MS = 20_000;

// GET /api/multichat/provider-status — live health per LLM provider.
multichatRouter.get("/provider-status", async (req, res) => {
  const now = Date.now();
  if (providerStatusCache && now - providerStatusCache.at < PROVIDER_STATUS_TTL_MS) {
    return res.json({
      providers: providerStatusCache.data,
      cachedAt: new Date(providerStatusCache.at).toISOString(),
      fresh: false,
      probed: false,
      catalogLatencyMs: providerStatusCache.catalogLatencyMs,
      note: "configured = задан ключ. Доступность самих поставщиков здесь не проверяется.",
    });
  }

  const port = Number(process.env.PORT) || 4001;
  const internalBase = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${port}`;
  const authHeader = req.headers.authorization || "";

  const started = Date.now();
  try {
    const r = await fetch(`${internalBase}/api/qcoreai/providers`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const totalLatency = Date.now() - started;
    const data = (await r.json().catch(() => null)) as { providers?: Array<Record<string, unknown>> } | null;
    const list = Array.isArray(data?.providers) ? data!.providers! : [];

    // Что здесь на самом деле известно, а что утверждалось.
    //
    // Источник — /api/qcoreai/providers, и он СИНХРОННЫЙ: читает переменные
    // окружения и перечисляет провайдеров с заданным ключом. Ни одного
    // обращения к Anthropic, OpenAI или Gemini там нет.
    //
    // Стояло `reachable: configured && r.ok`, где r.ok — «наш собственный
    // внутренний маршрут ответил 200». Поле с именем «достижим» означало
    // «ключ задан и наш бэкенд жив», а страница рисовала по нему зелёный
    // огонёк и слово «online». При лежащем OpenAI ответ говорил бы то же
    // самое. Туда же ехала latencyMs — время round-trip до нашего localhost,
    // поданное как задержка провайдера (на странице ещё и с порогами ⚠/🐢).
    //
    // Теперь: reachable ровно повторяет configured (поле оставлено ради
    // совместимости с packages/aevion-catalog-client и помечено там как
    // устаревшее), latencyMs больше не выдумывается, а честная величина —
    // catalogLatencyMs — названа своим именем. `probed: false` говорит прямо,
    // что апстримы не опрашивались.
    const providers: ProviderStatus[] = list.map((p) => {
      const configured = Boolean(p.configured);
      return {
        id: String(p.id ?? ""),
        name: String(p.name ?? p.id ?? ""),
        configured,
        reachable: configured,
        latencyMs: null,
        defaultModel: typeof p.defaultModel === "string" ? p.defaultModel : null,
      };
    });

    providerStatusCache = { at: now, data: providers, catalogLatencyMs: totalLatency };
    res.json({
      providers,
      cachedAt: new Date(now).toISOString(),
      fresh: true,
      probed: false,
      catalogLatencyMs: totalLatency,
      note: "configured = задан ключ. Доступность самих поставщиков здесь не проверяется.",
    });
  } catch (err: any) {
    captureMultichatError(err, { route: "provider-status" });
    res.status(502).json({
      error: "provider_status_failed",
      message: err?.message || "upstream unreachable",
    });
  }
});

type MultichatPreset = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  systemPrompt: string;
  recommendedAgents: Array<{ role: string; provider?: string; temperature?: number }>;
  defaultProvider: string;
};

// Canonical preset catalogue. Order matters — UI renders top→down.
const MULTICHAT_PRESETS: MultichatPreset[] = [
  {
    id: "code-review",
    name: "Code review",
    emoji: "💻",
    description: "Three engineers grade your diff: clarity, correctness, security.",
    systemPrompt:
      "You are a senior software engineer doing code review. Focus on correctness bugs, " +
      "security issues, and readability. Quote line numbers when possible. Be direct — no " +
      "praise without a concrete reason. End with a one-line verdict: SHIP / FIX / REJECT.",
    recommendedAgents: [
      { role: "Code", provider: "anthropic", temperature: 0.2 },
      { role: "Code", provider: "openai", temperature: 0.3 },
      { role: "Compliance", provider: "anthropic", temperature: 0.2 },
    ],
    defaultProvider: "anthropic",
  },
  {
    id: "translate",
    name: "Translate",
    emoji: "🌐",
    description: "Faithful translation with tone preserved — two providers vote on phrasing.",
    systemPrompt:
      "You are a professional translator. Detect the source language; translate into the " +
      "target language the user specifies (default: English). Preserve register, idioms, " +
      "and proper nouns. After the translation, list any phrasing choices that have a " +
      "meaningful alternative — one bullet each.",
    recommendedAgents: [
      { role: "Translator", provider: "anthropic", temperature: 0.4 },
      { role: "Translator", provider: "openai", temperature: 0.4 },
    ],
    defaultProvider: "anthropic",
  },
  {
    id: "summarize",
    name: "Summarize",
    emoji: "📋",
    description: "Long doc → 5 bullets + a one-liner. Parallel runs on 2 models for cross-check.",
    systemPrompt:
      "You are a precise document summarizer. Produce EXACTLY two artifacts: (1) a one-sentence " +
      "TL;DR, then (2) 5 bullet points covering the most important facts. Do not editorialize. " +
      "If the source contradicts itself, surface the contradiction in a final bullet prefixed " +
      "with ⚠.",
    recommendedAgents: [
      { role: "General", provider: "anthropic", temperature: 0.3 },
      { role: "General", provider: "openai", temperature: 0.3 },
    ],
    defaultProvider: "anthropic",
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    emoji: "💡",
    description: "Diverge fast: three different agents pitch ideas at different temperatures.",
    systemPrompt:
      "You are in divergent-thinking mode. Generate 5 distinct ideas in response to the user's " +
      "prompt. Each idea: 1-line title + 2 sentences of rationale. Be willing to be weird; " +
      "save the safest idea for last. Do NOT critique your own ideas — that's a different " +
      "agent's job.",
    recommendedAgents: [
      { role: "General", provider: "anthropic", temperature: 0.9 },
      { role: "General", provider: "openai", temperature: 1.0 },
      { role: "General", provider: "deepseek", temperature: 0.85 },
    ],
    defaultProvider: "anthropic",
  },
  {
    id: "debug",
    name: "Debug",
    emoji: "🐞",
    description: "Stack trace + repro → root cause hypothesis. Two engineers race to the bug.",
    systemPrompt:
      "You are a senior debugger. Given an error, stack trace, or symptom: " +
      "(1) state your top-1 root-cause hypothesis in one sentence, " +
      "(2) list 2-3 next diagnostic steps the user should run, " +
      "(3) propose a minimal patch if you're confident enough. " +
      "Refuse to guess — if context is missing, say what you need.",
    recommendedAgents: [
      { role: "Code", provider: "anthropic", temperature: 0.2 },
      { role: "Code", provider: "openai", temperature: 0.2 },
    ],
    defaultProvider: "anthropic",
  },
];

// GET /api/multichat/presets — read-only mission catalogue.
multichatRouter.get("/presets", async (_req, res) => {
  res.json({
    presets: MULTICHAT_PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      description: p.description,
      // Full systemPrompt is included so the UI can preview it before launching.
      systemPrompt: p.systemPrompt,
      recommendedAgents: p.recommendedAgents,
      defaultProvider: p.defaultProvider,
    })),
    total: MULTICHAT_PRESETS.length,
  });
});

// POST /api/multichat/presets/:id/launch — create a conversation pre-wired
// for the chosen preset. Returns the new conversation id + the agent
// specs the client should spawn locally. Idempotent only in the sense
// that each call creates a NEW conversation (presets are templates, not
// singletons).
multichatRouter.post("/presets/:id/launch", async (req, res) => {
  const userId = req.auth!.sub;
  const presetId = String(req.params.id);
  const preset = MULTICHAT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return res.status(404).json({ error: "preset_not_found" });

  try {
    const title = typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : `${preset.emoji} ${preset.name}`;
    const conv = await createConv(userId, title);
    res.status(201).json({
      conversation: conv,
      preset: {
        id: preset.id,
        name: preset.name,
        systemPrompt: preset.systemPrompt,
        recommendedAgents: preset.recommendedAgents,
        defaultProvider: preset.defaultProvider,
      },
    });
  } catch (err: any) {
    captureMultichatError(err, { route: "launch-preset", entityId: presetId });
    res.status(500).json({ error: "launch_failed" });
  }
});

// GET /api/multichat/shared/:token — PUBLIC view of a shared conversation.
// No auth required. Returns conversation metadata + last 200 turns (no usage
// to keep cost data private). Mounted as a separate sub-route to bypass the
// router-wide requireAuth.
export const multichatPublicRouter = Router();
// POST /api/multichat/dissent/preview — ПУБЛИЧНЫЙ разбор готовых ответов.
//
// Карта разногласий считается из уже полученных ответов и не делает ни одного
// вызова модели — значит её можно отдать бесплатно и без аккаунта. Это снимает
// главное трение витрины: гость упирался в sign-in и не понимал, в чём суть
// модуля. Теперь демо работает на НАСТОЯЩЕМ коде карты, а не на нарисованных
// числах, которые разошлись бы с алгоритмом при первой же правке.
//
// Побочно это самостоятельная польза: чужие ответы можно принести свои и
// получить разбор, ничего у нас не запуская.
const dissentPreviewLimiter = rateLimit({
  capacity: 30,
  refillPerSec: 0.5,
  keyFn: (req) => `mc-dissent:${clientIp(req)}`,
});

multichatPublicRouter.post("/dissent/preview", dissentPreviewLimiter, (req, res) => {
  try {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : null;
    if (!answers || answers.length === 0) {
      return res.status(400).json({ error: "answers_required", message: "Ожидается { answers: [{ agentId, ok, reply }] }." });
    }
    if (answers.length > 8) {
      return res.status(400).json({ error: "too_many", message: "Не больше 8 ответов за раз." });
    }
    // Обрезаем вход: разбор бесплатный, но не должен превращаться в способ
    // заставить сервер жевать мегабайты.
    const trimmed = answers.slice(0, 8).map((a: any, i: number) => ({
      agentId: typeof a?.agentId === "string" ? a.agentId.slice(0, 60) : `agent_${i + 1}`,
      ok: a?.ok !== false,
      reply: typeof a?.reply === "string" ? a.reply.slice(0, 20_000) : undefined,
      error: typeof a?.error === "string" ? a.error.slice(0, 200) : undefined,
    }));
    res.json({ dissent: buildDissentMap(trimmed as never) });
  } catch (err) {
    captureMultichatError(err, { route: "dissent-preview" });
    res.status(500).json({ error: "preview failed" });
  }
});

// POST /api/multichat/receipt/verify — ПУБЛИЧНАЯ проверка чека.
//
// Живёт именно здесь, а не в основном роутере: тот монтируется через
// requireModule("multichat-engine"), то есть за платной стеной. Проверка чека
// за стеной бессмысленна — предъявляют его тому, у кого нет ни аккаунта, ни
// подписки. (Первая версия по ошибке стояла в приватном роутере и на проде
// упёрлась бы в 402.)
//
// Состояние не меняется, работы ровно на канонизацию и хеш.
const receiptVerifyLimiter = rateLimit({
  capacity: 60,
  refillPerSec: 1,
  keyFn: (req) => `mc-verify:${clientIp(req)}`,
});

multichatPublicRouter.post("/receipt/verify", receiptVerifyLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    // Принимаем и целиком скачанный файл {receipt, hash, signature}, и голый чек.
    const receipt = body.receipt ?? body;
    if (!receipt || typeof receipt !== "object" || !("panel" in receipt)) {
      return res.status(400).json({ error: "not_a_receipt", message: "Ожидается чек мультичата (JSON со списком panel)." });
    }
    const out = await verifyReceipt({
      receipt: receipt as never,
      hash: typeof body.hash === "string" ? body.hash : undefined,
      signature: body.signature ?? null,
    });
    res.json(out);
  } catch (err) {
    captureMultichatError(err, { route: "receipt-verify" });
    res.status(500).json({ error: "verify failed" });
  }
});

multichatPublicRouter.get("/shared/:token", async (req, res) => {
  const token = String(req.params.token).trim();
  if (!token) return res.status(400).json({ error: "token_required" });
  try {
    const conv = await findByShareToken(token);
    if (!conv) return res.status(404).json({ error: "not_found_or_revoked" });
    const { turns, totalTurns, truncated } = await readFeed(conv.userId, conv.id, FEED_LIMIT);
    // Публично отдаём разговор, но не счётчик: токены — это расход владельца.
    // Текст несостоявшегося ответа тоже подменяем: причина отказа провайдера
    // может нести внутренний адрес или код, а получателю ссылки важен сам факт.
    const safeTurns = turns.map((t) => {
      const { tokensIn, tokensOut, userId, ...rest } = t;
      void tokensIn;
      void tokensOut;
      void userId;
      return rest.role === "system" && rest.content.startsWith(NO_REPLY_PREFIX)
        ? { ...rest, content: `${NO_REPLY_PREFIX} агент не ответил` }
        : rest;
    });
    res.json({
      conversation: { id: conv.id, title: conv.title, createdAt: conv.createdAt },
      turns: safeTurns,
      totalTurns,
      truncated,
    });
  } catch (err: any) {
    captureMultichatError(err, { route: "shared-view" });
    res.status(500).json({ error: "fetch_failed", });
  }
});
