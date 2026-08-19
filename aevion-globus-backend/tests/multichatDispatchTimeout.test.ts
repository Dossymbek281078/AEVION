// Один зависший провайдер не должен вешать весь консилиум.
//
// Веер шлёт вопрос N агентам параллельно и ждёт через Promise.all, то есть
// ответ приходит по САМОМУ МЕДЛЕННОМУ. Тайм-аута на внутренний вызов не было
// вовсе: если провайдер принял соединение и замолчал, запрос висел, сколько
// позволит сеть, а человек всё это время смотрел на «Агенты отвечают…».
//
// Обиднее всего, что остальные агенты к этому моменту уже ответили: показать
// два ответа из трёх и честно отметить третий — ровно то, ради чего в модуле
// заведена системная реплика «агент не ответил».

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-multichat-timeout-0123456789";
const USER = "user_timeout_test";

let app: express.Express;
let dataDir: string;
let token: string;
const prev: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ["AEVION_DATA_DIR", "AUTH_JWT_SECRET", "DATABASE_URL", "MULTICHAT_AGENT_TIMEOUT_MS"]) {
    prev[k] = process.env[k];
  }
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-timeout-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  process.env.MULTICHAT_AGENT_TIMEOUT_MS = "300";

  token = jwt.sign({ sub: USER, email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });

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

describe("Веер: зависший агент", () => {
  test("консилиум возвращается с ответами остальных, а молчун помечен", async () => {
    // Внутренний вызов /api/qcoreai/chat: двое отвечают сразу, третий молчит
    // до самого разрыва — так ведёт себя провайдер, принявший соединение.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        const isSilent = String(body.conversationId ?? "").endsWith(":practic");
        if (!isSilent) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ reply: `ответ для ${body.conversationId}`, mode: "stub", model: "test-model" }),
          };
        }
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return; // без тайм-аута этот промис не разрешится никогда
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }) as unknown as typeof fetch,
    );

    const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Зависший" });
    const id: string = conv.body.id;

    const started = Date.now();
    const r = await auth(request(app).post(`/api/multichat/conversations/${id}/dispatch`)).send({
      prompt: "Стоит ли запускать платный тариф до первой продажи?",
      agents: [{ id: "analyst", role: "Аналитик" }, { id: "skeptic", role: "Скептик" }, { id: "practic", role: "Практик" }],
    });

    expect(r.status).toBe(200);
    // Вернулись, а не висим: 300 мс тайм-аут плюс накладные.
    expect(Date.now() - started).toBeLessThan(5000);

    const byId = Object.fromEntries(
      (r.body.results as Array<{ agentId: string; ok: boolean; reply?: string; error?: string }>).map((x) => [x.agentId, x]),
    );
    expect(byId.analyst.ok).toBe(true);
    expect(byId.skeptic.ok).toBe(true);
    expect(byId.practic.ok).toBe(false);
    // Причина названа, а не спрятана под общим «dispatch failed».
    expect(String(byId.practic.error)).toMatch(/no reply within/i);
  });

  test("молчун попадает в ленту — иначе в публичном просмотре его место займёт сосед", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }) as unknown as typeof fetch,
    );

    const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Все молчат" });
    const id: string = conv.body.id;

    await auth(request(app).post(`/api/multichat/conversations/${id}/dispatch`)).send({
      prompt: "Вопрос, на который никто не ответил",
      agents: [{ id: "analyst", role: "Аналитик" }],
    });

    const dump = await auth(request(app).get(`/api/multichat/conversations/${id}/export.json`));
    const roles = (dump.body.turns as Array<{ role: string; agentId: string | null }>).map((t) => `${t.agentId ?? "—"}:${t.role}`);
    expect(roles).toContain("analyst:system");
  });
});
