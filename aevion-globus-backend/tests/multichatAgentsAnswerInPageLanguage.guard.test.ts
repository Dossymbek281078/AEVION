/**
 * Агенты консилиума отвечают на языке страницы — язык назван в системной подсказке, а не оставлен модели.
 *
 * ПОВОД (замер на проде 30.10.2026, сайт 4f71ad70f, бэк 04f65bbb7, /en, ?c=probe-multichat): на английский
 * вопрос Skeptic и Practitioner ответили по-английски, Analyst — по-русски («Данные по вопросу:
 * Распределение практики…»). Системная подсказка говорила только роль (`You are ${role}`), а роль со
 * страницы русская («Аналитик…»). Страница шлёт lang в dispatch с 30.10; сервер по нему уже строит карту
 * разногласий — теперь тем же lang он называет агенту язык ответа.
 *
 * КОНТРОЛЬ 30.10.2026: на 35e6609ff все три случая dispatch красные (в подсказке нет ни одной из фраз).
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter } from "../src/routes/multichat";
import { answerLang, answerLanguageInstruction } from "../src/services/multichat/answerLang";

const SECRET = "test-secret-multichat-answer-lang-0123456789";
const USER = "user_answer_lang_test";

let app: express.Express;
let dataDir: string;
let token: string;
const prev: Record<string, string | undefined> = {};
/** Системные подсказки, ушедшие во внутренний /api/qcoreai/chat, по agentId. */
const подсказки = new Map<string, string>();

beforeEach(() => {
  for (const k of ["AEVION_DATA_DIR", "AUTH_JWT_SECRET", "DATABASE_URL"]) prev[k] = process.env[k];
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-answer-lang-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  token = jwt.sign({ sub: USER, email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });
  подсказки.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const system = (body.messages as Array<{ role: string; content: string }>).find((m) => m.role === "system");
      подсказки.set(String(body.conversationId).split(":").pop() ?? "", system?.content ?? "");
      return { ok: true, status: 200, json: async () => ({ reply: `reply for ${body.conversationId}`, mode: "stub", model: "test-model" }) };
    }) as unknown as typeof fetch,
  );
  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);
});

afterEach(() => {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
  rmSync(dataDir, { recursive: true, force: true });
});

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);
const АГЕНТЫ = [{ id: "analyst", role: "Аналитик" }, { id: "skeptic", role: "Скептик" }, { id: "practic", role: "Практик" }];

async function dispatch(body: Record<string, unknown>) {
  const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "язык ответа" });
  const r = await auth(request(app).post(`/api/multichat/conversations/${conv.body.id}/dispatch`)).send({ prompt: "Should we hire a sales rep before the first paying customer?", agents: АГЕНТЫ, ...body });
  expect(r.status).toBe(200);
  expect(подсказки.size, "внутренний вызов должен уйти всем трём агентам").toBe(3);
  return [...подсказки.values()];
}

describe("язык ответа агентов консилиума", () => {
  test("lang=en: каждому агенту сказано «Answer in English.», роль при этом остаётся прежней русской", async () => {
    for (const s of await dispatch({ lang: "en" })) {
      expect(s).toMatch(/Answer in English\./);
      expect(s).toMatch(/^You are (Аналитик|Скептик|Практик)\./);
      expect(s).not.toMatch(/Отвечай по-русски/);
    }
  });

  test("без lang — «Отвечай по-русски.»: русский остаётся умолчанием, как было фактически", async () => {
    for (const s of await dispatch({})) {
      expect(s).toMatch(/Отвечай по-русски\./);
      expect(s).not.toMatch(/Answer in English/);
    }
  });

  test("lang=kk — казахский назван отдельно, а не сведён к русскому", async () => {
    for (const s of await dispatch({ lang: "kk" })) expect(s).toMatch(/Answer in Kazakh/);
  });

  test("answerLang: en/en-US/EN → en; kk/kz → kk; ru, мусор, не строка → ru; фраза без кириллицы на en", () => {
    for (const v of ["en", "en-US", " EN "]) expect(answerLang(v), v).toBe("en");
    for (const v of ["kk", "kz", "kk-KZ"]) expect(answerLang(v), v).toBe("kk");
    for (const v of ["ru", "", "xx", undefined, null, 5, {}]) expect(answerLang(v), String(v)).toBe("ru");
    expect(answerLanguageInstruction("en")).not.toMatch(/[А-Яа-яЁё]/);
    expect(answerLanguageInstruction(undefined)).toBe("Отвечай по-русски.");
  });
});
