import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import request from "supertest";

import { anonChatCeiling } from "../src/routes/qcoreai.js";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "qcoreai.ts"),
  "utf8",
);

function app() {
  const a = express();
  a.get("/x", anonChatCeiling, (_req, res) => res.json({ ok: true }));
  return a;
}

describe("общий потолок анонимного расхода", () => {
  test("аноним упирается в потолок, и отказ объясняет, что делать", async () => {
    const a = app();
    let last = 200;
    let body: Record<string, unknown> = {};
    for (let i = 0; i < 130; i++) {
      const r = await request(a).get("/x");
      last = r.status;
      body = r.body;
      if (last === 429) break;
    }
    expect(last, "потолок не сработал за 130 обращений").toBe(429);
    expect(JSON.stringify(body)).toContain("sign in");
  });

  test("потолок стоит ПЕРЕД обеими платными ручками", () => {
    // Проверяем точную форму монтирования, а не упоминание имени: имя
    // встречается и в комментарии выше, и на этом ловился прежний сторож.
    expect(SRC).toContain('post("/chat", anonChatCeiling, chatLimiter');
    expect(SRC).toContain('post("/chat-stream", anonChatCeiling, chatLimiter');
  });

  test("авторизованный считается по своему id, а не общей корзиной", () => {
    const at = SRC.indexOf("export const anonChatCeiling");
    const block = SRC.slice(at, at + 700);
    expect(block).toContain("auth?.sub ? `u:${auth.sub}` : \"anon\"");
  });
});

describe("тот же потолок у тренера ИИ", () => {
  const COACH = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "coach.ts"),
    "utf8",
  );

  test("потолок стоит ПЕРЕД обеими платными ручками тренера", () => {
    expect(COACH).toContain('post("/chat", anonCoachCeiling, generationLimit("coach_chat")');
    expect(COACH).toContain('post("/chat/stream", anonCoachCeiling, generationLimit("coach_chat_stream")');
  });

  test("аноним и авторизованный разведены по разным корзинам", () => {
    const at = COACH.indexOf("const anonCoachCeiling");
    const block = COACH.slice(at, at + 600);
    expect(block).toContain("isAnonymousRequest(req)");
    expect(block).toContain('"anon"');
    expect(block).toContain("u:$");
  });
});
