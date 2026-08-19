// Выгрузка беседы и публичная ссылка — что в них реально попадает.
//
// Эти три ручки вчера отдавали разговор БЕЗ единого ответа ИИ: веер писал
// ответы агентов в подветки `${convId}:${agentId}`, а читатели выбирали
// реплики строгим равенством conversationId. Отказа не было — 200 и валидный
// JSON, просто без половины содержимого. Выгрузка при этом заявлена как
// «полный дамп для compliance».
//
// Форма ответа с тех пор изменилась (в JSON появился agentId, в CSV — колонка
// agent), но тестов на сами эндпоинты не было. Здесь они.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter, multichatPublicRouter } from "../src/routes/multichat";
import { recordChatTurn } from "../src/lib/chatHistory";

const SECRET = "test-secret-multichat-export-0123456789";
const USER = "user_export_test";

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
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-export-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL; // файловая ветка

  token = jwt.sign({ sub: USER, email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });

  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatPublicRouter);
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

/** Беседа с вопросом, двумя ответами и одним не ответившим агентом. */
async function seedConversation(): Promise<string> {
  const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Выгрузка" });
  const id: string = conv.body.id;

  await recordChatTurn({ userId: USER, conversationId: id, role: "user", content: "вопрос про тариф" });
  await recordChatTurn({
    userId: USER, conversationId: `${id}:analyst`, role: "assistant",
    content: "ответ аналитика", provider: "anthropic", model: "claude-sonnet-4-6",
    tokensIn: 100, tokensOut: 200,
  });
  await recordChatTurn({
    userId: USER, conversationId: `${id}:skeptic`, role: "assistant",
    content: "ответ скептика", provider: "openai", model: "gpt-4o-mini",
    tokensIn: 50, tokensOut: 60,
  });
  await recordChatTurn({
    userId: USER, conversationId: `${id}:practic`, role: "system",
    content: "[no-reply] provider_timeout",
  });
  return id;
}

describe("Выгрузка беседы", () => {
  test("JSON содержит ответы агентов, а не один вопрос", async () => {
    const id = await seedConversation();
    const r = await auth(request(app).get(`/api/multichat/conversations/${id}/export.json`));

    expect(r.status).toBe(200);
    const contents = r.body.turns.map((t: { content: string }) => t.content);
    expect(contents).toContain("ответ аналитика");
    expect(contents).toContain("ответ скептика");
    // Каждая реплика подписана агентом; вопрос пользователя — без агента.
    const byAgent = Object.fromEntries(
      r.body.turns.map((t: { agentId: string | null; role: string }) => [t.agentId ?? "—", t.role]),
    );
    expect(byAgent.analyst).toBe("assistant");
    expect(byAgent.skeptic).toBe("assistant");
    expect(byAgent["—"]).toBe("user");
  });

  test("CSV имеет колонку agent и содержит ответы", async () => {
    const id = await seedConversation();
    const r = await auth(request(app).get(`/api/multichat/conversations/${id}/export.csv`));

    expect(r.status).toBe(200);
    const lines = r.text.trim().split("\n");
    expect(lines[0]).toBe("created_at,agent,role,content");
    expect(r.text).toContain("analyst");
    expect(r.text).toContain("ответ скептика");
    // Вопрос, два ответа, одна отметка о неответе — плюс заголовок.
    expect(lines).toHaveLength(5);
  });

  test("CSV гасит формулу: значение с ведущим = Excel исполняет при открытии", async () => {
    const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Формула" });
    const id: string = conv.body.id;
    await recordChatTurn({ userId: USER, conversationId: id, role: "user", content: "=1+1" });

    const r = await auth(request(app).get(`/api/multichat/conversations/${id}/export.csv`));
    expect(r.text).not.toMatch(/,=1\+1/);
  });
});

describe("Публичная ссылка", () => {
  test("отдаёт ответы агентов, но не расход и не владельца", async () => {
    const id = await seedConversation();
    const share = await auth(request(app).post(`/api/multichat/conversations/${id}/share`)).send({});
    const shareToken: string = share.body.shareToken;
    expect(shareToken).toBeTruthy();

    // Публично — БЕЗ заголовка авторизации: её и предъявляют тому, у кого
    // нет аккаунта.
    const r = await request(app).get(`/api/multichat/shared/${shareToken}`);
    expect(r.status).toBe(200);

    const contents = r.body.turns.map((t: { content: string }) => t.content);
    expect(contents).toContain("ответ аналитика");

    for (const t of r.body.turns) {
      expect(t, "токены — расход владельца, наружу не отдаём").not.toHaveProperty("tokensIn");
      expect(t, "владелец беседы наружу не отдаётся").not.toHaveProperty("userId");
    }

    // Причина отказа провайдера может нести внутренний адрес — наружу уходит
    // нейтральная формулировка.
    const failed = r.body.turns.find((t: { role: string }) => t.role === "system");
    expect(failed.content).toBe("[no-reply] агент не ответил");
    expect(failed.content).not.toContain("provider_timeout");
  });

  test("отозванная ссылка перестаёт работать", async () => {
    const id = await seedConversation();
    const share = await auth(request(app).post(`/api/multichat/conversations/${id}/share`)).send({});
    const shareToken: string = share.body.shareToken;

    await auth(request(app).delete(`/api/multichat/conversations/${id}/share`));

    const r = await request(app).get(`/api/multichat/shared/${shareToken}`);
    expect(r.status).toBe(404);
  });
});
