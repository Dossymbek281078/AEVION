// Длинная беседа — что видно в ленте, что уезжает в выгрузку и что попадает
// в счётчик расхода.
//
// Здесь два независимых дефекта, оба тихие (200 и валидный JSON, просто не всё):
//
// 1. `listChatTurns` режет выборку на 500 репликах ЖЁСТКО, что бы ни попросил
//    вызывающий. Выгрузка просит 5000 и заявлена как «полный дамп для
//    compliance», счётчик расхода просит 5000 — оба молча получают 500.
//    Консилиум из четырёх агентов пишет пять реплик за круг, то есть 500 —
//    это сотый круг, достижимая величина.
//
// 2. Две ветки хранилища расходятся В ПРОТИВОПОЛОЖНЫЕ СТОРОНЫ. Файловая берёт
//    ПОСЛЕДНИЕ N (`slice(-limit)`), постгресовая — ПЕРВЫЕ N
//    (`ORDER BY created_at ASC LIMIT n`). На проде стоит Postgres. Значит
//    после 200-й реплики консоль показывает самое старое начало и перестаёт
//    показывать новые ответы — а у разработчика на файловом хранилище всё
//    хорошо, потому что там ветка другая.
//
// Тест на постгресовую ветку идёт через поддельный пул: он эмулирует ровно те
// две вещи, от которых зависит ответ, — направление сортировки и LIMIT.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-multichat-long-0123456789";
const USER = "user_long_test";

let app: express.Express;
let dataDir: string;
let token: string;
let prevDataDir: string | undefined;
let prevSecret: string | undefined;
let prevDbUrl: string | undefined;

beforeEach(() => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  prevSecret = process.env.AUTH_JWT_SECRET;
  prevDbUrl = process.env.DATABASE_URL;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-long-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL; // файловая ветка

  token = jwt.sign({ sub: USER, email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });

  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);
});

afterEach(() => {
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  if (prevSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = prevSecret;
  if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDbUrl;
  rmSync(dataDir, { recursive: true, force: true });
});

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

/**
 * Кладём ленту в файл напрямую: 620 реплик через recordChatTurn — это 620
 * перезаписей растущего JSON под замком, минуты на ровном месте. Форма файла
 * та же, что пишет recordChatTurn.
 */
function seedTurns(conversationId: string, rounds: number): void {
  const items: unknown[] = [];
  let n = 0;
  const stamp = () => new Date(Date.UTC(2026, 7, 1, 0, 0, 0) + n * 1000).toISOString();
  for (let i = 0; i < rounds; i += 1) {
    items.push({
      id: `turn_u_${i}`,
      userId: USER,
      conversationId,
      role: "user",
      content: `вопрос ${i}`,
      provider: null,
      model: null,
      tokensIn: null,
      tokensOut: null,
      createdAt: stamp(),
    });
    n += 1;
    items.push({
      id: `turn_a_${i}`,
      userId: USER,
      conversationId: `${conversationId}:analyst`,
      role: "assistant",
      content: `ответ ${i}`,
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      tokensIn: 10,
      tokensOut: 20,
      createdAt: stamp(),
    });
    n += 1;
  }
  writeFileSync(path.join(dataDir, "chat-history.json"), JSON.stringify({ items }), "utf8");
}

async function newConversation(title: string): Promise<string> {
  const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title });
  return conv.body.id as string;
}

describe("Беседа длиннее потолка выборки", () => {
  test("выгрузка отдаёт весь разговор, а не первые 500 реплик", async () => {
    const id = await newConversation("Длинная");
    seedTurns(id, 310); // 620 реплик

    const r = await auth(request(app).get(`/api/multichat/conversations/${id}/export.json`));
    expect(r.status).toBe(200);
    expect(r.body.turns).toHaveLength(620);

    const contents = r.body.turns.map((t: { content: string }) => t.content);
    expect(contents).toContain("вопрос 0");
    expect(contents).toContain("ответ 309");
  });

  test("выгрузка признаётся, когда разговор в неё не поместился", async () => {
    const id = await newConversation("Очень длинная");
    seedTurns(id, 3000); // 6000 реплик — больше любого потолка

    const r = await auth(request(app).get(`/api/multichat/conversations/${id}/export.json`));
    expect(r.status).toBe(200);
    // Неполная выгрузка обязана назвать себя неполной: молчащий обрыв читается
    // как «весь разговор» и в compliance, и в глазах владельца.
    expect(r.body.truncated).toBe(true);
    expect(r.body.totalTurns).toBe(6000);
    expect(r.body.turns.length).toBeLessThan(6000);
  });

  test("счётчик расхода считает все вызовы, а не первые 250", async () => {
    const id = await newConversation("Расход");
    seedTurns(id, 310); // 310 ответов ассистента по 10/20 токенов

    const r = await auth(request(app).get(`/api/multichat/conversations/${id}/usage`));
    expect(r.status).toBe(200);
    expect(r.body.calls).toBe(310);
    expect(r.body.tokens.total).toBe(310 * 30);
  });

  test("лента показывает СВЕЖИЕ реплики и говорит, сколько скрыто", async () => {
    const id = await newConversation("Лента");
    seedTurns(id, 310); // 620 реплик, в ленту помещается 200

    const r = await auth(request(app).get(`/api/multichat/conversations/${id}`));
    expect(r.status).toBe(200);

    const contents = r.body.turns.map((t: { content: string }) => t.content);
    expect(contents).toContain("ответ 309"); // последнее, что сказал агент
    expect(r.body.totalTurns).toBe(620);
    expect(r.body.turns.length).toBeLessThan(620);
  });
});

// ── Постгресовая ветка: та, что стоит на проде ───────────────────────────
//
// Поддельный пул отвечает на два запроса, которые делает chatHistory: создание
// схемы и выборку реплик. Из SQL он читает направление сортировки и LIMIT —
// ровно то, от чего зависит, увидит ли человек свежие ответы.

const pgRows: Array<Record<string, unknown>> = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, args?: unknown[]) => {
      if (/CREATE TABLE/i.test(sql)) return { rows: [] };
      if (!/FROM chat_turns/i.test(sql)) return { rows: [] };
      const desc = /ORDER BY\s+created_at\s+DESC/i.test(sql);
      const limit = Number(args?.[args.length - 1] ?? pgRows.length);
      const sorted = [...pgRows].sort((a, b) =>
        String(a.created_at) < String(b.created_at) ? (desc ? 1 : -1) : desc ? -1 : 1,
      );
      const rows = sorted.slice(0, limit).map((r) => ({
        id: r.id,
        userId: r.user_id,
        conversationId: r.conversation_id,
        role: r.role,
        content: r.content,
        provider: null,
        model: null,
        tokensIn: null,
        tokensOut: null,
        createdAt: r.created_at,
      }));
      return { rows };
    },
  }),
}));

describe("Postgres-ветка выборки (прод)", () => {
  test("отдаёт ПОСЛЕДНИЕ N реплик в хронологическом порядке", async () => {
    process.env.DATABASE_URL = "postgres://fake/aevion";
    pgRows.length = 0;
    for (let i = 0; i < 250; i += 1) {
      pgRows.push({
        id: `t${i}`,
        user_id: USER,
        conversation_id: "conv_x",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `реплика ${i}`,
        created_at: new Date(Date.UTC(2026, 7, 1, 0, 0, 0) + i * 1000).toISOString(),
      });
    }

    const { listChatTurns } = await import("../src/lib/chatHistory");
    const turns = await listChatTurns({
      userId: USER,
      conversationId: "conv_x",
      includeAgentThreads: true,
      limit: 200,
    });

    expect(turns).toHaveLength(200);
    // Свежая реплика обязана быть в выборке: иначе после 200-го сообщения
    // консоль замирает на старом начале разговора.
    expect(turns[turns.length - 1].content).toBe("реплика 249");
    expect(turns[0].content).toBe("реплика 50");
    // Порядок — хронологический, как и в файловой ветке.
    expect(turns[0].createdAt < turns[turns.length - 1].createdAt).toBe(true);
  });
});
