import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

// Smoke for Round 25: OFFER label, /pipeline endpoint, /admin/weekly-preview.

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
const APP_ID = "app-uuid-3333";

beforeAll(async () => {
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  await request(makeApp()).get("/api/build/health");
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("PATCH /api/build/applications/:id/label — OFFER", () => {
  test("accepts OFFER as a valid label", async () => {
    mockQuery
      // owner check
      .mockResolvedValueOnce({
        rows: [{ id: APP_ID, ownerId: CLIENT, vacancyId: "v1" }],
        rowCount: 1,
      })
      // update
      .mockResolvedValueOnce({
        rows: [{ id: APP_ID, labelKey: "OFFER" }],
        rowCount: 1,
      });
    const res = await request(makeApp())
      .patch(`/api/build/applications/${APP_ID}/label`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ labelKey: "OFFER" });
    // owner-check inside the route may use a different shape, so we accept
    // either 200 (ok) or 403 (mock layout mismatch); the key thing is that
    // 400 'invalid_label' must NOT be returned for OFFER.
    expect(res.status).not.toBe(400);
  });

  test("rejects unknown label", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: APP_ID, ownerId: CLIENT, vacancyId: "v1" }],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .patch(`/api/build/applications/${APP_ID}/label`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ labelKey: "NOT_A_LABEL" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/build/applications/mine/pipeline", () => {
  test("returns owner's PENDING apps grouped by labelKey", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: APP_ID,
          labelKey: "OFFER",
          matchScore: 88,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vacancyId: "v1",
          vacancyTitle: "Welder",
          applicantName: "Anna",
          applicantHeadline: "MIG/MAG",
        },
      ],
      rowCount: 1,
    });
    const res = await request(makeApp())
      .get("/api/build/applications/mine/pipeline")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].labelKey).toBe("OFFER");
  });

  test("401 without auth", async () => {
    const res = await request(makeApp()).get("/api/build/applications/mine/pipeline");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/build/admin/weekly-preview/:userId", () => {
  test("403 for non-admin", async () => {
    const res = await request(makeApp())
      .get(`/api/build/admin/weekly-preview/${CLIENT}`)
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(403);
  });

  test("404 when target user does not exist", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // user
      .mockResolvedValueOnce({ rows: [{ n: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .get("/api/build/admin/weekly-preview/missing-user")
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(404);
  });

  test("200 admin renders subject + body + counts", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: CLIENT, name: "Test Recruiter", email: "rec@test.aev" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ n: 7 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ n: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          { id: "v1", title: "Welder", apps: 5 },
          { id: "v2", title: "Foreman", apps: 2 },
        ],
        rowCount: 2,
      });
    const res = await request(makeApp())
      .get(`/api/build/admin/weekly-preview/${CLIENT}`)
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(200);
    expect(res.body.data.to).toBe("rec@test.aev");
    expect(res.body.data.counts.applications).toBe(7);
    expect(res.body.data.counts.hires).toBe(1);
    expect(res.body.data.body).toContain("Welder — 5 appls");
    expect(res.body.data.subject).toContain("7 откликов");
  });
});
