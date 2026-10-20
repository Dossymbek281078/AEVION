"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordChatTurn = recordChatTurn;
exports.maxChatTurnsPerRead = maxChatTurnsPerRead;
exports.countChatTurns = countChatTurns;
exports.listChatTurns = listChatTurns;
const node_crypto_1 = require("node:crypto");
const dbPool_1 = require("./dbPool");
const jsonFileStore_1 = require("./jsonFileStore");
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
function isPg() {
    return !!process.env.DATABASE_URL?.trim();
}
let schemaApplied = false;
async function ensureSchema() {
    if (schemaApplied)
        return;
    await (0, dbPool_1.getPool)().query(SCHEMA);
    schemaApplied = true;
}
// Best-effort persistence — never throws into the request path. If the
// underlying store fails, we log and move on; the chat reply still ships
// to the user. The trade-off: a missing turn is better than a 500 on the
// chat endpoint.
async function recordChatTurn(input) {
    const turn = {
        id: `turn_${(0, node_crypto_1.randomUUID)()}`,
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
            await (0, dbPool_1.getPool)().query(`INSERT INTO chat_turns
          (id, user_id, conversation_id, role, content, provider, model,
           tokens_in, tokens_out, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
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
            ]);
        }
        else {
            // updateJsonFile, а не пара read+write: веер мультичата пишет ответы
            // агентов параллельно, и без замка на файл они затирают друг друга —
            // в ленте оседал 1 ответ из 3 (найдено живым прогоном 2026-08-10).
            await (0, jsonFileStore_1.updateJsonFile)(STORE_REL, { items: [] }, (data) => {
                const items = Array.isArray(data.items) ? data.items : [];
                items.push(turn);
                // FIFO cap — drop oldest when over the dev ceiling.
                while (items.length > JSON_CAP)
                    items.shift();
                return { items };
            });
        }
    }
    catch (err) {
        console.error("[chatHistory] record failed", err);
    }
    return turn;
}
/** Экранирование под LIKE: `%` и `_` — метасимволы, а id вида `conv_…` содержит `_`. */
function likeEscape(s) {
    return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
/**
 * Потолок выборки.
 *
 * Был 500 и стоял ЖЁСТКО: сколько бы вызывающий ни попросил, приезжало 500.
 * Выгрузка беседы просит 5000 и заявлена как «полный дамп для compliance»,
 * счётчик расхода просит 5000 — оба молча получали пятую часть. Консилиум из
 * четырёх агентов пишет пять реплик за круг, то есть 500 — это сотый круг.
 *
 * Потолок нужен (лента целиком в память ради одного ответа — плохая идея), но
 * он обязан совпадать с тем, что просят честные вызывающие, а превышение —
 * называться вслух: для этого есть countChatTurns и поле truncated в ответах.
 */
const MAX_LIST_LIMIT = 5000;
function clampLimit(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return 100;
    return Math.max(1, Math.min(Math.floor(n), MAX_LIST_LIMIT));
}
function maxChatTurnsPerRead() {
    return MAX_LIST_LIMIT;
}
/**
 * Сколько всего реплик в беседе — чтобы ответ мог сказать, что показывает не
 * всё. Без этого числа обрезанная лента и обрезанная выгрузка выглядят точно
 * так же, как полные.
 */
async function countChatTurns(opts) {
    if (isPg()) {
        await ensureSchema();
        const where = [];
        const args = [];
        if (opts.userId) {
            where.push(`user_id = $${args.length + 1}`);
            args.push(opts.userId);
        }
        if (opts.conversationId) {
            if (opts.includeAgentThreads) {
                where.push(`(conversation_id = $${args.length + 1} OR conversation_id LIKE $${args.length + 2} ESCAPE '\\')`);
                args.push(opts.conversationId, `${likeEscape(opts.conversationId)}:%`);
            }
            else {
                where.push(`conversation_id = $${args.length + 1}`);
                args.push(opts.conversationId);
            }
        }
        const r = await (0, dbPool_1.getPool)().query(`SELECT COUNT(*)::int AS n FROM chat_turns ${where.length ? "WHERE " + where.join(" AND ") : ""}`, args);
        return Number(r.rows[0]?.n ?? 0) || 0;
    }
    const data = await (0, jsonFileStore_1.readJsonFile)(STORE_REL, { items: [] });
    let items = Array.isArray(data.items) ? data.items : [];
    if (opts.userId)
        items = items.filter((t) => t.userId === opts.userId);
    if (opts.conversationId) {
        const root = opts.conversationId;
        items = items.filter((t) => opts.includeAgentThreads
            ? t.conversationId === root || (t.conversationId ?? "").startsWith(`${root}:`)
            : t.conversationId === root);
    }
    return items.length;
}
async function listChatTurns(opts) {
    const limit = clampLimit(opts.limit);
    if (isPg()) {
        await ensureSchema();
        const where = [];
        const args = [];
        if (opts.userId) {
            where.push(`user_id = $${args.length + 1}`);
            args.push(opts.userId);
        }
        if (opts.conversationId) {
            if (opts.includeAgentThreads) {
                where.push(`(conversation_id = $${args.length + 1} OR conversation_id LIKE $${args.length + 2} ESCAPE '\\')`);
                args.push(opts.conversationId, `${likeEscape(opts.conversationId)}:%`);
            }
            else {
                where.push(`conversation_id = $${args.length + 1}`);
                args.push(opts.conversationId);
            }
        }
        args.push(limit);
        // DESC + разворот, а не ASC.
        //
        // Было `ORDER BY created_at ASC LIMIT n` — то есть при упоре в потолок
        // приезжали САМЫЕ СТАРЫЕ n реплик. Файловая ветка ниже берёт последние
        // (`slice(-limit)`), и ветки расходились в противоположные стороны. На
        // проде стоит Postgres: после 200-й реплики консоль замирала на начале
        // разговора и переставала показывать новые ответы, а у разработчика на
        // файловом хранилище всё выглядело исправно.
        //
        // Индекс idx_chat_turns_conv_created годится и для обратного обхода.
        const sql = `
      SELECT id, user_id AS "userId", conversation_id AS "conversationId",
             role, content, provider, model,
             tokens_in AS "tokensIn", tokens_out AS "tokensOut",
             created_at AS "createdAt"
      FROM chat_turns
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC
      LIMIT $${args.length}
    `;
        const r = await (0, dbPool_1.getPool)().query(sql, args);
        const rows = r.rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) }));
        return rows.reverse(); // наружу — хронологический порядок, как и раньше
    }
    const data = await (0, jsonFileStore_1.readJsonFile)(STORE_REL, { items: [] });
    let items = Array.isArray(data.items) ? data.items : [];
    if (opts.userId)
        items = items.filter((t) => t.userId === opts.userId);
    if (opts.conversationId) {
        const root = opts.conversationId;
        items = items.filter((t) => opts.includeAgentThreads
            ? t.conversationId === root || (t.conversationId ?? "").startsWith(`${root}:`)
            : t.conversationId === root);
    }
    // Порядок — хронологический, как в SQL-ветке: подветки агентов пишутся
    // параллельно, и порядок вставки в файл не обязан совпадать со временем.
    items = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    return items.slice(-limit);
}
function toIso(v) {
    if (v instanceof Date)
        return v.toISOString();
    if (typeof v === "string")
        return v;
    return new Date().toISOString();
}
