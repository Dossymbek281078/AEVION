import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// Force in-memory mode for the QCore store.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn().mockRejectedValue(new Error("no db")) }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import { qcoreaiRouter } from "../src/routes/qcoreai";

function makeApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/qcoreai", qcoreaiRouter);
  return app;
}

describe("QCoreAI routes — meta endpoints", () => {
  test("GET /health returns service metadata", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("qcoreai");
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.activeProvider).toBe("string");
    expect(["postgres", "in-memory"]).toContain(res.body.storage);
    expect("webhookConfigured" in res.body).toBe(true);
    expect("costCapDefaultUsd" in res.body).toBe(true);
  });

  test("GET /providers lists configured providers", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/providers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.providers)).toBe(true);
    expect(res.body.providers.length).toBeGreaterThanOrEqual(5);
    for (const p of res.body.providers) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.configured).toBe("boolean");
    }
  });

  test("GET /pricing has per-model rate table", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/pricing");
    expect(res.status).toBe(200);
    expect(res.body.currency).toBe("USD");
    expect(Array.isArray(res.body.table)).toBe(true);
  });

  test("GET /agents returns 3 strategies + 4 roles", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/agents");
    expect(res.status).toBe(200);
    const ids = res.body.strategies.map((s: any) => s.id).sort();
    expect(ids).toEqual(["debate", "parallel", "sequential"]);
    const roleIds = res.body.roles.map((r: any) => r.id).sort();
    expect(roleIds).toEqual(["analyst", "critic", "writer", "writerB"]);
  });

  test("GET /sessions returns empty array for fresh anonymous caller", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.scope).toBe("anonymous");
  });
});

describe("QCoreAI routes — input validation", () => {
  test("POST /chat without messages → 400", async () => {
    const res = await request(makeApp())
      .post("/api/qcoreai/chat")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messages/);
  });

  test("POST /multi-agent without input → 400", async () => {
    const res = await request(makeApp())
      .post("/api/qcoreai/multi-agent")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/input/);
  });

  test("POST /multi-agent with whitespace-only input → 400", async () => {
    const res = await request(makeApp())
      .post("/api/qcoreai/multi-agent")
      .send({ input: "   \n  " });
    expect(res.status).toBe(400);
  });

  test("POST /runs/:id/refine on missing run → 404", async () => {
    const res = await request(makeApp())
      .post("/api/qcoreai/runs/does-not-exist/refine")
      .send({ instruction: "shorten" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/run not found/i);
  });

  test("GET /runs/:id on missing run → 404", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/runs/does-not-exist");
    expect(res.status).toBe(404);
  });

  test("POST /runs/:id/share on missing run → 404", async () => {
    const res = await request(makeApp())
      .post("/api/qcoreai/runs/does-not-exist/share")
      .send({});
    expect(res.status).toBe(404);
  });

  test("GET /shared/:token unknown token → 404", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/shared/totally-bogus-token");
    expect(res.status).toBe(404);
  });
});

describe("QCoreAI routes — me/webhook (auth gate)", () => {
  test("GET /me/webhook without bearer → 401", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/me/webhook");
    expect(res.status).toBe(401);
  });

  test("PUT /me/webhook without bearer → 401", async () => {
    const res = await request(makeApp())
      .put("/api/qcoreai/me/webhook")
      .send({ url: "https://hooks.example.com/x" });
    expect(res.status).toBe(401);
  });

  test("DELETE /me/webhook without bearer → 401", async () => {
    const res = await request(makeApp()).delete("/api/qcoreai/me/webhook");
    expect(res.status).toBe(401);
  });
});

describe("QCoreAI routes — tags", () => {
  test("PATCH /runs/:id/tags non-array body → 400", async () => {
    const res = await request(makeApp())
      .patch("/api/qcoreai/runs/whatever/tags")
      .send({ tags: "not-an-array" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/);
  });

  test("PATCH /runs/:id/tags missing tags → 400", async () => {
    const res = await request(makeApp())
      .patch("/api/qcoreai/runs/whatever/tags")
      .send({});
    expect(res.status).toBe(400);
  });

  test("PATCH /runs/:id/tags on bogus run → 404", async () => {
    const res = await request(makeApp())
      .patch("/api/qcoreai/runs/does-not-exist/tags")
      .send({ tags: ["x"] });
    expect(res.status).toBe(404);
  });
});

describe("QCoreAI routes — search", () => {
  test("GET /search empty query → empty items", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/search?q=");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.query).toBe("");
  });

  test("GET /search non-matching → empty items", async () => {
    const res = await request(makeApp())
      .get("/api/qcoreai/search?q=" + encodeURIComponent("zxcvbnm-no-match-token"));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.query).toBe("zxcvbnm-no-match-token");
  });

  test("GET /search caps limit between 1 and 100", async () => {
    const res = await request(makeApp()).get("/api/qcoreai/search?q=foo&limit=999");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
