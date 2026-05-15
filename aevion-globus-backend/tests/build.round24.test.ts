import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

// Smoke tests for endpoints added in QBuild rounds 20–24.
// Mirrors the mock-pg setup of build.integration.test.ts.

function signJwt(
  payload: Record<string, unknown>,
  secret = "dev-auth-secret",
): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line import/first
import { buildRouter } from "../src/routes/build";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/build", buildRouter);
  return app;
}

function bearerOf(sub: string, role = "USER") {
  return `Bearer ${signJwt({ sub, email: `${sub}@test.aev`, role })}`;
}

const CLIENT = "client-uuid-aaaa";
const VACANCY = "vac-uuid-2222";
const APP_ID = "app-uuid-3333";

beforeAll(async () => {
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  await request(makeApp()).get("/api/build/health");
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("POST /api/build/vacancies/:id/extend", () => {
  test("403 when caller is not the owner", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: VACANCY, status: "OPEN", expiresAt: new Date(), clientId: CLIENT }],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .post(`/api/build/vacancies/${VACANCY}/extend`)
      .set("Authorization", bearerOf("someone-else"))
      .send({ days: 30 });
    expect(res.status).toBe(403);
  });

  test("200 returns newExpiresAt and clamps days at upper bound 180", async () => {
    const future = new Date(Date.now() + 5 * 86400_000);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: VACANCY, status: "OPEN", expiresAt: future, clientId: CLIENT }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: VACANCY, expiresAt: future }], rowCount: 1 });
    const res = await request(makeApp())
      .post(`/api/build/vacancies/${VACANCY}/extend`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ days: 999 });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.newExpiresAt).toBe("string");
    expect(res.body.data.extendedDays).toBe(180);
  });

  test("409 when vacancy archived", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: VACANCY, status: "ARCHIVED", expiresAt: null, clientId: CLIENT }],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .post(`/api/build/vacancies/${VACANCY}/extend`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ days: 30 });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/build/vacancies/:id/boost-roi", () => {
  test("returns hasBoost=false when no boost row exists", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ clientId: CLIENT }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .get(`/api/build/vacancies/${VACANCY}/boost-roi`)
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.hasBoost).toBe(false);
  });
});

describe("GET /api/build/stats/weekly", () => {
  test("returns delta-shaped payload", async () => {
    mockQuery.mockResolvedValue({ rows: [{ n: 4 }], rowCount: 1 });
    const res = await request(makeApp())
      .get("/api/build/stats/weekly")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("applications");
    expect(res.body.data.applications).toHaveProperty("change");
    expect(res.body.data).toHaveProperty("vacanciesPosted");
    expect(res.body.data).toHaveProperty("hires");
  });
});

describe("GET /api/build/admin/insights", () => {
  test("403 for non-admin", async () => {
    const res = await request(makeApp())
      .get("/api/build/admin/insights")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(403);
  });

  test("200 for admin, returns top arrays", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ n: 5 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 8 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 6 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .get("/api/build/admin/insights")
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.topEmployers)).toBe(true);
    expect(Array.isArray(res.body.data.topVacancies)).toBe(true);
  });
});

describe("Vacancy team notes", () => {
  test("POST /vacancies/:id/notes 403 for non-owner", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: VACANCY, clientId: CLIENT }],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .post(`/api/build/vacancies/${VACANCY}/notes`)
      .set("Authorization", bearerOf("not-owner"))
      .send({ body: "hello" });
    expect(res.status).toBe(403);
  });

  test("POST /vacancies/:id/notes 200 for owner", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: VACANCY, clientId: CLIENT }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "vnote_1",
            vacancyId: VACANCY,
            authorUserId: CLIENT,
            body: "approved up to 5M",
            createdAt: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      });
    const res = await request(makeApp())
      .post(`/api/build/vacancies/${VACANCY}/notes`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ body: "approved up to 5M" });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("vnote_1");
  });

  test("POST /vacancies/:id/notes 400 on empty body", async () => {
    const res = await request(makeApp())
      .post(`/api/build/vacancies/${VACANCY}/notes`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ body: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/build/admin/partner-keys/usage", () => {
  test("403 for non-admin", async () => {
    const res = await request(makeApp())
      .get("/api/build/admin/partner-keys/usage")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(403);
  });

  test("200 admin returns 14d window + per-key day buckets", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { keyId: "k1", label: "Acme", day: "2026-05-04", hits: 12 },
        { keyId: "k1", label: "Acme", day: "2026-05-05", hits: 8 },
      ],
      rowCount: 2,
    });
    const res = await request(makeApp())
      .get("/api/build/admin/partner-keys/usage")
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(200);
    expect(res.body.data.windowDays).toBe(14);
    expect(res.body.data.items[0].keyId).toBe("k1");
    expect(res.body.data.items[0].days).toHaveLength(2);
  });
});

describe("POST /api/build/admin/partner-keys/:id/rotate", () => {
  test("403 for non-admin", async () => {
    const res = await request(makeApp())
      .post("/api/build/admin/partner-keys/k1/rotate")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(403);
  });

  test("404 when key does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .post("/api/build/admin/partner-keys/missing/rotate")
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(404);
  });

  test("409 when key is already revoked", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "k1", label: "Acme", revokedAt: new Date() }],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .post("/api/build/admin/partner-keys/k1/rotate")
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(409);
  });
});

describe("GET /api/build/applications/mine/interviews", () => {
  test("returns INTERVIEW-labeled apps", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: APP_ID,
          status: "PENDING",
          labelKey: "INTERVIEW",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          message: null,
          matchScore: 78,
          vacancyId: VACANCY,
          vacancyTitle: "Welder, day shift",
          applicantName: "John",
          applicantHeadline: "MIG/MAG specialist",
        },
      ],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .get("/api/build/applications/mine/interviews")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].labelKey).toBe("INTERVIEW");
  });
});
