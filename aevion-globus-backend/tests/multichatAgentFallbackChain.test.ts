// Агент консилиума переходит на запасного поставщика, как цепочка картинок в DevHub.
//
// ПОВОД (20.10.2026, прод): без поставщика сервер отдавал всех троих одной модели —
// «CLAUDE (ANTHROPIC)» трижды, и «разногласия» были согласованной ошибкой одной
// семьи. Теперь у агентов разные семьи (anthropic / gemini / openrouter) и поле
// fallback. Отказ основного не должен стоить человеку ответа агента.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-multichat-fallback-0123456789";
let app: express.Express;
let dataDir: string;
let token: string;
const prev: Record<string, string | undefined> = {};
let вызовы: Array<{ agent: string; provider: string | undefined; model: string | undefined }> = [];

beforeEach(() => {
  for (const k of ["AEVION_DATA_DIR", "AUTH_JWT_SECRET", "DATABASE_URL", "MULTICHAT_AGENT_TIMEOUT_MS", "MULTICHAT_FANOUT_BUDGET_MS"]) prev[k] = process.env[k];
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-fallback-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  process.env.MULTICHAT_AGENT_TIMEOUT_MS = "300";
  token = jwt.sign({ sub: "user_fallback", email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });
  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);
  вызовы = [];
});

afterEach(() => {
  for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.unstubAllGlobals();
  rmSync(dataDir, { recursive: true, force: true });
});

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

/** Внутренний /api/qcoreai/chat: поставщики из `мёртвые` отвечают 502, `молчуны` — висят до тайм-аута. */
function поставщики(мёртвые: string[], молчуны: string[] = []) {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const agent = String(body.conversationId ?? "").split(":").pop()!;
    вызовы.push({ agent, provider: body.provider, model: body.model });
    if (молчуны.includes(body.provider)) {
      return new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }));
    }
    if (мёртвые.includes(body.provider)) return { ok: false, status: 502, json: async () => ({ error: `${body.provider} down` }) };
    return { ok: true, status: 200, json: async () => ({ reply: `ответ ${agent} от ${body.provider}`, provider: body.provider, mode: body.provider, model: "m" }) };
  }) as unknown as typeof fetch);
}

const PANEL = [
  { id: "analyst", role: "Аналитик", provider: "anthropic", fallback: ["gemini", "openrouter"], model: "claude-x" },
  { id: "skeptic", role: "Скептик", provider: "gemini", fallback: ["openrouter", "anthropic"] },
  { id: "practic", role: "Практик", provider: "openrouter", fallback: ["gemini", "anthropic"] },
];

async function веер() {
  const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Цепочка" });
  const r = await auth(request(app).post(`/api/multichat/conversations/${conv.body.id}/dispatch`)).send({ prompt: "Вопрос?", agents: PANEL });
  expect(r.status).toBe(200);
  return Object.fromEntries((r.body.results as any[]).map((x) => [x.agentId, x]));
}

describe("консилиум: разные семьи и запасной поставщик", () => {
  test("все живы — каждый агент у своего поставщика, запасные не зовутся", async () => {
    поставщики([]);
    const r = await веер();
    expect([r.analyst.provider, r.skeptic.provider, r.practic.provider]).toEqual(["anthropic", "gemini", "openrouter"]);
    expect(вызовы).toHaveLength(3);
  });

  test("основной отвечает 502 — агент отвечает от запасного; модель запасному не навязывается", async () => {
    поставщики(["anthropic"]);
    const r = await веер();
    expect(r.analyst.ok).toBe(true);
    expect(r.analyst.provider).toBe("gemini");
    const второй = вызовы.find((v) => v.agent === "analyst" && v.provider === "gemini")!;
    expect(второй.model).toBeUndefined();
  });

  test("основной молчит до тайм-аута — переход на запасного, ответ есть", async () => {
    поставщики([], ["openrouter"]);
    const r = await веер();
    expect(r.practic.ok).toBe(true);
    expect(r.practic.provider).toBe("gemini");
  });

  test("КОНТРОЛЬ: вся цепочка мертва — агент честно не ответил, причина названа", async () => {
    поставщики(["anthropic", "gemini", "openrouter"]);
    const r = await веер();
    expect(r.analyst.ok).toBe(false);
    expect(String(r.analyst.error)).toMatch(/down|upstream/);
  });

  test("без fallback поведение прежнее: один вызов на агента", async () => {
    поставщики(["anthropic"]);
    const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Без цепочки" });
    const res = await auth(request(app).post(`/api/multichat/conversations/${conv.body.id}/dispatch`)).send({ prompt: "?", agents: [{ id: "solo", role: "R", provider: "anthropic" }] });
    expect(res.body.results[0].ok).toBe(false);
    expect(вызовы.filter((v) => v.agent === "solo")).toHaveLength(1);
  });
});
