import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

// ── JWT helper (no external dep — avoids missing @types/jsonwebtoken) ──────
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

// ── Mock pg pool before any module that touches dbPool is imported ─────────
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line import/first
import { buildRouter } from "../src/routes/build";

// ── Helpers ───────────────────────────────────────────────────────────────
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/build", buildRouter);
  return app;
}

function bearerOf(sub: string, role = "USER") {
  return `Bearer ${signJwt({ sub, email: `${sub}@test.aev`, role })}`;
}

// Fixed IDs reused across tests.
const CLIENT = "client-uuid-aaaa";
const WORKER = "worker-uuid-bbbb";
const PROJECT = "proj-uuid-1111";
const VACANCY = "vac-uuid-2222";
const APP_ID = "app-uuid-3333";

// ── Setup ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Fire one warm-up request so ensureBuildTables() and
  // ensureUsersTable() set their module-level flags to true.
  // Subsequent tests skip the table-init overhead entirely.
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  await request(makeApp()).get("/api/build/health");
});

beforeEach(() => {
  // After beforeAll, tablesEnsured=true, ensuredUsersTable=true,
  // lastCleanupAt is recent → none of those fire again.
  // Each test gets a clean mockQuery with a safe default.
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/build/health", () => {
  test("200, service=qbuild, returns numeric counters", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ n: 12 }], rowCount: 1 }) // open vacancies
      .mockResolvedValueOnce({ rows: [{ n: 7 }], rowCount: 1 })  // profiles
      .mockResolvedValueOnce({ rows: [{ n: 3 }], rowCount: 1 }); // open projects

    const res = await request(makeApp()).get("/api/build/health");

    expect(res.status).toBe(200);
    expect(res.body.data.service).toBe("qbuild");
    expect(res.body.data.vacancies).toBe(12);
    expect(res.body.data.candidates).toBe(7);
    expect(res.body.data.projects).toBe(3);
  });

  test("200 even when DB throws (best-effort fallback to 0)", async () => {
    mockQuery.mockRejectedValue(new Error("db gone"));

    const res = await request(makeApp()).get("/api/build/health");

    expect(res.status).toBe(200);
    expect(res.body.data.vacancies).toBe(0);
    expect(res.body.data.candidates).toBe(0);
  });
});

describe("POST /api/build/profiles", () => {
  test("201, upserts profile and returns buildRole", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "prof-1", userId: CLIENT, buildRole: "CLIENT", name: "Test Client" }],
      rowCount: 1,
    });

    const res = await request(makeApp())
      .post("/api/build/profiles")
      .set("Authorization", bearerOf(CLIENT))
      .send({ name: "Test Client", city: "Almaty", buildRole: "CLIENT" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.buildRole).toBe("CLIENT");
  });

  test("401 without token", async () => {
    const res = await request(makeApp())
      .post("/api/build/profiles")
      .send({ name: "No Token" });

    expect(res.status).toBe(401);
  });

  test("400 if name too short (< 2 chars)", async () => {
    const res = await request(makeApp())
      .post("/api/build/profiles")
      .set("Authorization", bearerOf(CLIENT))
      .send({ name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  test("403 if non-admin tries to set buildRole=ADMIN", async () => {
    const res = await request(makeApp())
      .post("/api/build/profiles")
      .set("Authorization", bearerOf(CLIENT))
      .send({ name: "Hacker", buildRole: "ADMIN" });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/build/projects", () => {
  test("201, returns project with id", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: PROJECT, title: "E2E Project", clientId: CLIENT }],
      rowCount: 1,
    });

    const res = await request(makeApp())
      .post("/api/build/projects")
      .set("Authorization", bearerOf(CLIENT))
      .send({
        title: "E2E Project",
        description: "This description is long enough to pass validation.",
        budget: 50000,
        city: "Almaty",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(PROJECT);
  });

  test("400 if description shorter than 10 chars", async () => {
    const res = await request(makeApp())
      .post("/api/build/projects")
      .set("Authorization", bearerOf(CLIENT))
      .send({ title: "Valid Title", description: "Short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description/);
  });
});

describe("POST /api/build/vacancies", () => {
  test("201, creates vacancy under owned project", async () => {
    // Queries fired by the handler:
    //  1. SELECT project → owned by CLIENT
    //  2. SELECT subscription (getUserPlan) → no row → planKey='FREE'
    //  3. SELECT BuildPlan WHERE key='FREE' → no row → synthesises FREE (1 slot)
    //  4. SELECT COUNT open vacancies → 0 (under limit)
    //  5. INSERT vacancy RETURNING *
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PROJECT, clientId: CLIENT }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ c: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: VACANCY, projectId: PROJECT, title: "Dev", skillsJson: "[]", questionsJson: "[]" }],
        rowCount: 1,
      });

    const res = await request(makeApp())
      .post("/api/build/vacancies")
      .set("Authorization", bearerOf(CLIENT))
      .send({
        projectId: PROJECT,
        title: "Dev",
        description: "Need a developer for the project on-site.",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(VACANCY);
  });

  test("404 if project not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(makeApp())
      .post("/api/build/vacancies")
      .set("Authorization", bearerOf(CLIENT))
      .send({
        projectId: "ghost",
        title: "Dev",
        description: "Long enough description for validation.",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("project_not_found");
  });

  test("403 if plan vacancy slot limit reached", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: PROJECT, clientId: CLIENT }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // no sub → FREE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // FREE plan → synthesise (1 slot)
      .mockResolvedValueOnce({ rows: [{ c: 1 }], rowCount: 1 }); // 1 open = at limit

    const res = await request(makeApp())
      .post("/api/build/vacancies")
      .set("Authorization", bearerOf(CLIENT))
      .send({
        projectId: PROJECT,
        title: "Dev",
        description: "Long enough description for validation.",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("plan_vacancy_limit_reached");
  });
});

describe("POST /api/build/applications", () => {
  const vacancyRow = {
    id: VACANCY,
    vacancyStatus: "OPEN",
    title: "Dev",
    description: "Desc",
    skillsJson: "[]",
    questionsJson: "[]",
    clientId: CLIENT, // owned by CLIENT, not WORKER
  };

  test("201, worker applies → status=PENDING", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [vacancyRow], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: APP_ID, vacancyId: VACANCY, userId: WORKER, status: "PENDING" }],
        rowCount: 1,
      });

    const res = await request(makeApp())
      .post("/api/build/applications")
      .set("Authorization", bearerOf(WORKER))
      .send({ vacancyId: VACANCY, message: "I'm interested." });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
  });

  test("400 if applicant is the vacancy owner", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [vacancyRow], rowCount: 1 });

    const res = await request(makeApp())
      .post("/api/build/applications")
      .set("Authorization", bearerOf(CLIENT)) // same as clientId
      .send({ vacancyId: VACANCY, message: "Own vacancy." });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("cannot_apply_to_own_vacancy");
  });

  test("404 if vacancy not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(makeApp())
      .post("/api/build/applications")
      .set("Authorization", bearerOf(WORKER))
      .send({ vacancyId: "ghost", message: "Hello." });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("vacancy_not_found");
  });
});

describe("PATCH /api/build/applications/:id", () => {
  test("200, project owner accepts application", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: APP_ID, userId: WORKER, clientId: CLIENT }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: APP_ID, userId: WORKER, status: "ACCEPTED" }],
        rowCount: 1,
      });

    const res = await request(makeApp())
      .patch(`/api/build/applications/${APP_ID}`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACCEPTED");
  });

  test("403 if non-owner (worker) tries to accept", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: APP_ID, userId: WORKER, clientId: CLIENT }],
      rowCount: 1,
    });

    const res = await request(makeApp())
      .patch(`/api/build/applications/${APP_ID}`)
      .set("Authorization", bearerOf(WORKER)) // worker ≠ clientId
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("only_vacancy_owner_can_update");
  });

  test("404 if application not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(makeApp())
      .patch("/api/build/applications/ghost")
      .set("Authorization", bearerOf(CLIENT))
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("application_not_found");
  });

  test("400 if status value is invalid", async () => {
    const res = await request(makeApp())
      .patch(`/api/build/applications/${APP_ID}`)
      .set("Authorization", bearerOf(CLIENT))
      .send({ status: "HACKED" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });
});

// ── Notifications ─────────────────────────────────────────────────────────

describe("GET /api/build/notifications/summary", () => {
  test("200, returns numeric totals", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ c: 2 }], rowCount: 1 })   // unread messages
      .mockResolvedValueOnce({ rows: [{ c: 1 }], rowCount: 1 })   // pending apps
      .mockResolvedValueOnce({ rows: [{ c: 0 }], rowCount: 1 });  // app updates
    const res = await request(makeApp())
      .get("/api/build/notifications/summary")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.unreadMessages).toBe(2);
    expect(res.body.data.pendingApplications).toBe(1);
    expect(res.body.data.total).toBe(3);
  });

  test("401 without token", async () => {
    const res = await request(makeApp()).get("/api/build/notifications/summary");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/build/notifications", () => {
  test("200, returns items array", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // messages
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // app updates
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // pending apps
    const res = await request(makeApp())
      .get("/api/build/notifications")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.total).toBe("number");
  });
});

describe("POST /api/build/notifications/mark-read", () => {
  test("200, returns marked=true", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .post("/api/build/notifications/mark-read")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.marked).toBe(true);
  });
});

// ── Password change ───────────────────────────────────────────────────────

describe("PATCH /api/build/users/me/password", () => {
  test("401 without token", async () => {
    const res = await request(makeApp())
      .patch("/api/build/users/me/password")
      .send({ current: "old123", next: "newpass123" });
    expect(res.status).toBe(401);
  });

  test("400 if next password too short", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ passwordHash: "$2b$10$xxx" }], rowCount: 1 });
    const res = await request(makeApp())
      .patch("/api/build/users/me/password")
      .set("Authorization", bearerOf(CLIENT))
      .send({ current: "old123", next: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/next/);
  });

  test("404 if user not found in DB", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .patch("/api/build/users/me/password")
      .set("Authorization", bearerOf(CLIENT))
      .send({ current: "old123456", next: "newpass456" });
    expect(res.status).toBe(404);
  });
});

// ── Admin users ───────────────────────────────────────────────────────────

describe("GET /api/build/admin/users", () => {
  test("403 for non-admin user", async () => {
    const res = await request(makeApp())
      .get("/api/build/admin/users")
      .set("Authorization", bearerOf(CLIENT, "USER"));
    expect(res.status).toBe(403);
  });

  test("200, returns items + total for admin", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ n: 5 }], rowCount: 1 })  // count
      .mockResolvedValueOnce({ rows: [{ id: "u1", email: "a@b.com", name: "A", role: "USER", createdAt: new Date().toISOString(), buildRole: null, city: null, openToWork: false, verifiedAt: null }], rowCount: 1 }); // rows
    const res = await request(makeApp())
      .get("/api/build/admin/users")
      .set("Authorization", bearerOf("admin-id", "ADMIN"));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(5);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});

// ── Reviews ───────────────────────────────────────────────────────────────

describe("GET /api/build/reviews/by-user/:userId", () => {
  test("200, public — no auth needed", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // count
      .mockResolvedValueOnce({ rows: [{ n: "4.5" }], rowCount: 1 }) // avg
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // items
    const res = await request(makeApp()).get(`/api/build/reviews/by-user/${CLIENT}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});

describe("GET /api/build/reviews/eligible", () => {
  test("401 without token", async () => {
    const res = await request(makeApp()).get("/api/build/reviews/eligible");
    expect(res.status).toBe(401);
  });

  test("200, returns eligible pairs", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .get("/api/build/reviews/eligible")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});

// ── Job Alerts ────────────────────────────────────────────────────────────

describe("GET /api/build/alerts/me", () => {
  test("401 without token", async () => {
    const res = await request(makeApp()).get("/api/build/alerts/me");
    expect(res.status).toBe(401);
  });

  test("200, returns null alert when none set", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .get("/api/build/alerts/me")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.alert).toBeNull();
  });
});

describe("POST /api/build/alerts", () => {
  test("401 without token", async () => {
    const res = await request(makeApp()).post("/api/build/alerts").send({ keywords: "welder" });
    expect(res.status).toBe(401);
  });

  test("201, upserts alert and returns it", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ email: "c@t.com" }], rowCount: 1 })  // user lookup
      .mockResolvedValueOnce({ rows: [{ id: "a1", userId: CLIENT, keywords: "welder", skills: "", city: null, active: true }], rowCount: 1 }); // upsert
    const res = await request(makeApp())
      .post("/api/build/alerts")
      .set("Authorization", bearerOf(CLIENT))
      .send({ keywords: "welder", skills: "AutoCAD" });
    expect(res.status).toBe(201);
    expect(res.body.data.alert.keywords).toBe("welder");
  });
});

// ── Verification ──────────────────────────────────────────────────────────

describe("GET /api/build/verification/my", () => {
  test("401 without token", async () => {
    const res = await request(makeApp()).get("/api/build/verification/my");
    expect(res.status).toBe(401);
  });

  test("200, returns null when no request", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(makeApp())
      .get("/api/build/verification/my")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(200);
    expect(res.body.data.request).toBeNull();
  });
});

describe("POST /api/build/verification/request", () => {
  test("401 without token", async () => {
    const res = await request(makeApp()).post("/api/build/verification/request");
    expect(res.status).toBe(401);
  });

  test("201, creates verification request", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ verifiedAt: null }], rowCount: 1 }) // profile check
      .mockResolvedValueOnce({ rows: [{ id: "vr1", userId: CLIENT, status: "PENDING", note: null }], rowCount: 1 }); // insert
    const res = await request(makeApp())
      .post("/api/build/verification/request")
      .set("Authorization", bearerOf(CLIENT))
      .send({ note: "My LinkedIn: ..." });
    expect(res.status).toBe(201);
    expect(res.body.data.request.status).toBe("PENDING");
  });

  test("409 if already verified", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ verifiedAt: new Date().toISOString() }], rowCount: 1 });
    const res = await request(makeApp())
      .post("/api/build/verification/request")
      .set("Authorization", bearerOf(CLIENT));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("already_verified");
  });
});

// ── Stats leaderboard ─────────────────────────────────────────────────────

describe("GET /api/build/stats/leaderboard", () => {
  test("200, returns employers and workers arrays", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // employers
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // workers
    const res = await request(makeApp()).get("/api/build/stats/leaderboard");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.employers)).toBe(true);
    expect(Array.isArray(res.body.data.workers)).toBe(true);
  });
});
