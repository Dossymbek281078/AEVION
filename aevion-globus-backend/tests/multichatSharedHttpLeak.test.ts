import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import express from "express";

/**
 * Публичная ссылка на разговор — проверка ОТВЕТА, а не помощника.
 *
 * У этой утечки уже есть тест (`multichatSharedLeak.test.ts`), но он проверяет
 * чистую функцию `sanitizeSharedTurn`. Собственное правило из
 * `docs/PUBLIC-ENDPOINTS.md` требует другого: тест «чего в ответе быть не
 * должно», ходящий по HTTP. Причина в том, как утечка возникла — не в помощнике,
 * а НА ГРАНИЦЕ «что вернула база» → «что ушло в ответ»: снималось поле `usage`,
 * которого у строки истории нет вовсе, а наружу шли `userId`, `tokensIn`,
 * `tokensOut`. Тест на помощнике такой промах по построению не увидит: он
 * проверяет функцию, которую в ответ могут и не позвать.
 *
 * Postgres не нужен: без него `findByShareToken` и `listChatTurns` читают
 * JSON-хранилище из `AEVION_DATA_DIR`, и его можно наполнить прямо здесь.
 */

const TOKEN = "share-токен-для-проверки";
const OWNER = "usr-владелец-которого-нельзя-раскрывать";
const CONV = "conv-1";

let dataDir: string;
let savedDir: string | undefined;
let app: express.Express;

beforeAll(async () => {
  savedDir = process.env.AEVION_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "multichat-shared-"));
  process.env.AEVION_DATA_DIR = dataDir;

  // Разговор с ссылкой-токеном.
  writeFileSync(
    path.join(dataDir, "multichat-conversations.json"),
    JSON.stringify({
      items: [
        {
          id: CONV,
          userId: OWNER,
          title: "Разговор по ссылке",
          shareToken: TOKEN,
          createdAt: "2026-07-28T00:00:00.000Z",
          updatedAt: "2026-07-28T00:00:00.000Z",
        },
      ],
    }),
    "utf8",
  );

  // Ходы со ВСЕМИ внутренними полями, какие есть у ChatTurn.
  writeFileSync(
    path.join(dataDir, "chat-history.json"),
    JSON.stringify({
      items: [
        {
          id: "t1",
          userId: OWNER,
          conversationId: CONV,
          role: "user",
          content: "вопрос по ссылке",
          provider: null,
          model: null,
          tokensIn: 4242,
          tokensOut: 8484,
          createdAt: "2026-07-28T00:00:01.000Z",
        },
        {
          id: "t2",
          userId: OWNER,
          conversationId: CONV,
          role: "assistant",
          content: "ответ по ссылке",
          provider: "anthropic",
          model: "claude-opus-5",
          tokensIn: 1111,
          tokensOut: 2222,
          createdAt: "2026-07-28T00:00:02.000Z",
        },
      ],
    }),
    "utf8",
  );

  const { multichatPublicRouter } = await import("../src/routes/multichat");
  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatPublicRouter);
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  if (savedDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = savedDir;
});

describe("GET /api/multichat/shared/:token — что уходит наружу", () => {
  it("отдаёт сам разговор (иначе проверки ниже были бы про пустоту)", async () => {
    const res = await request(app).get(`/api/multichat/shared/${encodeURIComponent(TOKEN)}`);
    expect(res.status).toBe(200);
    expect(res.body.conversation?.id).toBe(CONV);
    expect(res.body.turns).toHaveLength(2);
    expect(JSON.stringify(res.body)).toContain("вопрос по ссылке");
  });

  it("НЕ отдаёт идентификатор владельца и расход токенов", async () => {
    const res = await request(app).get(`/api/multichat/shared/${encodeURIComponent(TOKEN)}`);
    const raw = JSON.stringify(res.body);
    // По сырому тексту: поле могло уехать вложенным, и обход верхнего уровня
    // этого не увидит.
    expect(raw, "идентификатор владельца попал в публичный ответ").not.toContain(OWNER);
    expect(raw, "расход токенов попал в публичный ответ").not.toContain("4242");
    expect(raw).not.toContain("8484");
    for (const turn of res.body.turns as Array<Record<string, unknown>>) {
      expect(turn).not.toHaveProperty("userId");
      expect(turn).not.toHaveProperty("tokensIn");
      expect(turn).not.toHaveProperty("tokensOut");
    }
  });

  it("состав полей хода — ровно белый список, ни больше ни меньше", async () => {
    const res = await request(app).get(`/api/multichat/shared/${encodeURIComponent(TOKEN)}`);
    const turn = (res.body.turns as Array<Record<string, unknown>>)[1];
    // Ход-ответ заполнен целиком, поэтому у него должны быть все шесть полей.
    expect(Object.keys(turn).sort()).toEqual(
      ["content", "createdAt", "id", "model", "provider", "role"].sort(),
    );
  });

  it("отозванная или несуществующая ссылка — 404, а не содержимое", async () => {
    const res = await request(app).get("/api/multichat/shared/чужой-токен");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("вопрос по ссылке");
  });

  it("данные разговора владельца не утекают через отсутствие токена", async () => {
    // Пустой токен раньше мог бы попасть в поиск как «найди что угодно».
    const res = await request(app).get("/api/multichat/shared/%20");
    expect([400, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain(OWNER);
  });
});
