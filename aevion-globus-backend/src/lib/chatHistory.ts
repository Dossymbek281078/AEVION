// Chat-turn ledger for /api/qcoreai/chat and /api/multichat/messages.
//
// Records (userId, role, content, provider, model, tokensIn/Out) so:
//   - Multichat can replay a conversation across page reloads.
//   - QCoreAI can compute per-user token budget metrics.
//   - Audit/compliance can answer "what did this user ask the AI on date X".
//
// Storage:
//   - Postgres (when DATABASE_URL is set) — chat_turns table.
//   - JSON file fallback in dev (chat-history.json), capped at 5000 entries
//     so it doesn't grow unboundedly on a laptop.
//
// Privacy: content is stored verbatim. Operators must communicate this in
// the privacy policy or surface a per-user "delete history" UI before
// shipping to public traffic. For now the surface is JWT-gated and only
// the user's own history is queryable.

import { randomUUID } from "node:crypto";
import { getPool } from "./dbPool";
import { readJsonFile, writeJsonFile } from "./jsonFileStore";

export type ChatTurn = {
  id: string;
  userId: string | null;
  conversationId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  provider: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
};

const STORE_REL = "chat-history.json";
const SCHEMA = `
CREATE TABLE IF NOT EXISTS chat_turns (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  conversation_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_turns_user_created
  ON chat_turns (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_turns_conv_created
  ON chat_turns (conversation_id, created_at);
`;

const JSON_CAP = 5000;

// Очередь записи для файлового хранилища.
//
// Файловая ветка — это read-modify-write целого JSON: два параллельных
// вызова читают ОДИН и тот же массив и оба пишут свою версию, второй затирает
// первого. На вееере мультичата это видно сразу: три агента отвечают
// одновременно, а в ленте оседает один ответ из трёх. Ошибки при этом нет —
// запрос успешен, файл валиден, просто разговора в нём меньше, чем было.
// Найдено живым прогоном 2026-08-10; последовательные тесты такое пропускают.
//
// Postgres-ветку это не касается: там каждый INSERT самостоятелен.
let jsonWriteQueue: Promise<unknown> = Promise.resolve();

function enqueueJsonWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = jsonWriteQueue.then(fn, fn);
  // Хвост очереди не должен умирать от чужой ошибки.
  jsonWriteQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function isPg(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

let schemaApplied = false;

async function ensureSchema(): Promise<void> {
  if (schemaApplied) return;
  await getPool().query(SCHEMA);
  schemaApplied = true;
}

export type RecordTurnInput = {
  userId?: string | null;
  conversationId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

// Best-effort persistence — never throws into the request path. If the
// underlying store fails, we log and move on; the chat reply still ships
// to the user. The trade-off: a missing turn is better than a 500 on the
// chat endpoint.
export async function recordChatTurn(input: RecordTurnInput): Promise<ChatTurn> {
  const turn: ChatTurn = {
    id: `turn_${randomUUID()}`,
    userId: input.userId ?? null,
    conversationId: input.conversationId ?? null,
    role: input.role,
    content: input.content.slice(0, 32000),
    provider: input.provider ?? null,
    model: input.model ?? null,
    tokensIn: input.tokensIn ?? null,
    tokensOut: input.tokensOut ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    if (isPg()) {
      await ensureSchema();
      await getPool().query(
        `INSERT INTO chat_turns
          (id, user_id, conversation_id, role, content, provider, model,
           tokens_in, tokens_out, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          turn.id,
          turn.userId,
          turn.conversationId,
          turn.role,
          turn.content,
          turn.provider,
          turn.model,
          turn.tokensIn,
          turn.tokensOut,
          turn.createdAt,
        ],
      );
    } else {
      await enqueueJsonWrite(async () => {
        const data = await readJsonFile<{ items: ChatTurn[] }>(STORE_REL, { items: [] });
        const items = Array.isArray(data.items) ? data.items : [];
        items.push(turn);
        // FIFO cap — drop oldest when over the dev ceiling.
        while (items.length > JSON_CAP) items.shift();
        await writeJsonFile(STORE_REL, { items });
      });
    }
  } catch (err) {
    console.error("[chatHistory] record failed", err);
  }

  return turn;
}

/** Экранирование под LIKE: `%` и `_` — метасимволы, а id вида `conv_…` содержит `_`. */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listChatTurns(opts: {
  userId?: string;
  conversationId?: string;
  /**
   * Забрать вместе с беседой её агентские подветки `${conversationId}:${agentId}`.
   *
   * Веер мультичата пишет ответ каждого агента в СВОЙ conversationId, поэтому
   * выборка строго по равенству возвращает только вопросы пользователя — без
   * единого ответа. Именно так и жили экспорт, публичная ссылка и счётчик
   * токенов: отдавали валидный JSON, в котором не было половины разговора.
   */
  includeAgentThreads?: boolean;
  limit?: number;
}): Promise<ChatTurn[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  if (isPg()) {
    await ensureSchema();
    const where: string[] = [];
    const args: unknown[] = [];
    if (opts.userId) {
      where.push(`user_id = $${args.length + 1}`);
      args.push(opts.userId);
    }
    if (opts.conversationId) {
      if (opts.includeAgentThreads) {
        where.push(
          `(conversation_id = $${args.length + 1} OR conversation_id LIKE $${args.length + 2} ESCAPE '\\')`,
        );
        args.push(opts.conversationId, `${likeEscape(opts.conversationId)}:%`);
      } else {
        where.push(`conversation_id = $${args.length + 1}`);
        args.push(opts.conversationId);
      }
    }
    args.push(limit);
    const sql = `
      SELECT id, user_id AS "userId", conversation_id AS "conversationId",
             role, content, provider, model,
             tokens_in AS "tokensIn", tokens_out AS "tokensOut",
             created_at AS "createdAt"
      FROM chat_turns
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at ASC
      LIMIT $${args.length}
    `;
    const r = await getPool().query(sql, args);
    return r.rows.map((row: any) => ({ ...row, createdAt: toIso(row.createdAt) })) as ChatTurn[];
  }

  const data = await readJsonFile<{ items: ChatTurn[] }>(STORE_REL, { items: [] });
  let items = Array.isArray(data.items) ? data.items : [];
  if (opts.userId) items = items.filter((t) => t.userId === opts.userId);
  if (opts.conversationId) {
    const root = opts.conversationId;
    items = items.filter((t) =>
      opts.includeAgentThreads
        ? t.conversationId === root || (t.conversationId ?? "").startsWith(`${root}:`)
        : t.conversationId === root,
    );
  }
  // Порядок — хронологический, как в SQL-ветке: подветки агентов пишутся
  // параллельно, и порядок вставки в файл не обязан совпадать со временем.
  items = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return items.slice(-limit);
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
