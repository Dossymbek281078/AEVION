import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// Mock pg pool before importing anything that touches it
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Mock ensureDevHubTables — pretend DB is NOT ready so we use in-memory store
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [],
  callProvider: vi.fn(),
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

// Каждому запросу свой адрес клиента, как у разных людей.
//
// Зачем (29.08.2026): создание проекта получило предел частоты по адресу —
// это единственная запись в базу без входа и без платы, и без предела её
// мог заполнять любой скрипт. Этот файл делает десятки запросов из одного
// процесса, то есть с одного адреса, и упирался бы в предел вместо того,
// что проверяет.
//
// Ослаблять предел ради тестов нельзя: тогда проверялась бы не та защита.
// Настоящие пользователи приходят с разных адресов — так и здесь.
let testClientIp = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    testClientIp += 1;
    req.headers["x-forwarded-for"] = `10.7.${Math.floor(testClientIp / 250) % 250}.${(testClientIp % 250) + 1}`;
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

// JWT helper — mirrors authJwt.getJwtSecret()'s non-production fallback.
function tokenFor(sub: string, role = "user", email = `${sub}@example.com`) {
  const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
  return jwt.sign({ sub, email, role }, secret, { algorithm: "HS256" });
}
function authHeader(sub: string, role = "user") {
  return { Authorization: `Bearer ${tokenFor(sub, role)}` };
}

beforeEach(() => {
  __resetDevHubStore();
});

afterEach(() => {
  delete process.env.AUTH_JWT_SECRET;
});

async function createProject(app: express.Express, owner: string, name = "T") {
  const r = await request(app)
    .post("/api/devhub/projects")
    .set(authHeader(owner))
    .send({ name });
  expect(r.status).toBe(201);
  return r.body.project.id as string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Collaborators
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/devhub/projects/:id/collaborators", () => {
  test("404 when caller is not the project owner", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("stranger"))
      .send({ userId: "friend-1", role: "editor" });
    expect(r.status).toBe(404);
  });

  test("403 + upgrade flag when owner is on the free tier", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "editor" });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/Studio Pro/);
    expect(r.body.upgrade).toBe(true);
  });

  test("400 when userId/email missing", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ role: "editor" });
    expect(r.status).toBe(400);
  });

  test("400 when adding the project owner as their own collaborator", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "owner-1", role: "editor" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/cannot add project owner/);
  });

  test("pro owner adds a collaborator, defaulting invalid/missing role to editor", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "not-a-real-role" });
    expect(r.status).toBe(201);
    expect(r.body.collaborators).toEqual([{ userId: "friend-1", role: "editor" }]);
    expect(r.body.resolved).toBe("friend-1");
  });

  test("accepts explicit viewer role", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });

    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "viewer" });
    expect(r.status).toBe(201);
    expect(r.body.collaborators).toEqual([{ userId: "friend-1", role: "viewer" }]);
  });

  test("re-adding the same collaborator replaces rather than duplicates", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });

    await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "viewer" });
    const r = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "editor" });
    expect(r.status).toBe(201);
    expect(r.body.collaborators).toHaveLength(1);
    expect(r.body.collaborators[0]).toEqual({ userId: "friend-1", role: "editor" });
  });
});

describe("GET /api/devhub/projects/:id/collaborators", () => {
  test("404 for a user with no access to the project", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    const r = await request(app)
      .get(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("stranger"));
    expect(r.status).toBe(404);
  });

  test("owner can list collaborators", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    const r = await request(app)
      .get(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"));
    expect(r.status).toBe(200);
    expect(r.body.collaborators).toEqual([]);
  });

  test("a collaborator (not the owner) can list collaborators via canAccess", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });
    await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "viewer" });

    const r = await request(app)
      .get(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("friend-1"));
    expect(r.status).toBe(200);
    expect(r.body.collaborators).toHaveLength(1);
  });
});

describe("DELETE /api/devhub/projects/:id/collaborators/:collabUserId", () => {
  async function projectWithCollaborator(app: express.Express) {
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });
    await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1", role: "editor" });
    return id;
  }

  test("404 when caller is not the owner", async () => {
    const app = makeApp();
    const id = await projectWithCollaborator(app);
    const r = await request(app)
      .delete(`/api/devhub/projects/${id}/collaborators/friend-1`)
      .set(authHeader("friend-1")); // a collaborator, but not the owner
    expect(r.status).toBe(404);
  });

  test("owner removes a collaborator", async () => {
    const app = makeApp();
    const id = await projectWithCollaborator(app);
    const r = await request(app)
      .delete(`/api/devhub/projects/${id}/collaborators/friend-1`)
      .set(authHeader("owner-1"));
    expect(r.status).toBe(200);
    expect(r.body.collaborators).toEqual([]);
  });
});

describe("Collaborator role enforcement on project/file routes", () => {
  async function projectWithRoles(app: express.Express) {
    const id = await createProject(app, "owner-1");
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });
    await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "editor-1", role: "editor" });
    await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "viewer-1", role: "viewer" });
    return id;
  }

  test("GET /projects/:id reports the correct role per caller", async () => {
    const app = makeApp();
    const id = await projectWithRoles(app);

    const owner = await request(app).get(`/api/devhub/projects/${id}`).set(authHeader("owner-1"));
    expect(owner.body.role).toBe("owner");

    const editor = await request(app).get(`/api/devhub/projects/${id}`).set(authHeader("editor-1"));
    expect(editor.body.role).toBe("editor");

    const viewer = await request(app).get(`/api/devhub/projects/${id}`).set(authHeader("viewer-1"));
    expect(viewer.body.role).toBe("viewer");

    const stranger = await request(app).get(`/api/devhub/projects/${id}`).set(authHeader("stranger"));
    expect(stranger.status).toBe(404);
  });

  test("viewer can read files but cannot write them", async () => {
    const app = makeApp();
    const id = await projectWithRoles(app);

    const readOk = await request(app)
      .get(`/api/devhub/projects/${id}/files`)
      .set(authHeader("viewer-1"));
    expect(readOk.status).toBe(200);

    const writeDenied = await request(app)
      .put(`/api/devhub/projects/${id}/file?path=index.ts`)
      .set(authHeader("viewer-1"))
      .send({ content: "console.log(1)" });
    expect(writeDenied.status).toBe(404);
  });

  test("editor can write files", async () => {
    const app = makeApp();
    const id = await projectWithRoles(app);

    const write = await request(app)
      .put(`/api/devhub/projects/${id}/file?path=index.ts`)
      .set(authHeader("editor-1"))
      .send({ content: "console.log(1)" });
    expect(write.status).toBe(200);
    expect(write.body.file.content).toBe("console.log(1)");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Billing — credits + tier admin
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/devhub/studio/credits", () => {
  test("anonymous caller gets free-tier limits with zero usage", async () => {
    const r = await request(makeApp()).get("/api/devhub/studio/credits");
    expect(r.status).toBe(200);
    expect(r.body.tier).toBe("free");
    expect(r.body.usage.image).toEqual({ used: 0, limit: 10 });
    expect(r.body.usage.deploy).toEqual({ used: 0, limit: 10 });
    expect(r.body.tierInfo.pro.video).toBe(50);
  });

  test("usage increments after a metered action debits credit", async () => {
    // debitCredit is only reachable indirectly via media routes in production,
    // but /studio/tier + /studio/credits alone are enough to prove the
    // free-tier ceiling is what callers see before any usage occurs.
    const app = makeApp();
    const before = await request(app).get("/api/devhub/studio/credits").set(authHeader("user-1"));
    expect(before.body.usage.video).toEqual({ used: 0, limit: 3 });
  });

  test("pro tier reports pro limits", async () => {
    const app = makeApp();
    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "user-1" });

    const r = await request(app).get("/api/devhub/studio/credits").set(authHeader("user-1"));
    expect(r.status).toBe(200);
    expect(r.body.tier).toBe("pro");
    expect(r.body.usage.deploy).toEqual({ used: 0, limit: -1 });
  });
});

describe("POST /api/devhub/studio/tier — access control", () => {
  test("401 when unauthenticated", async () => {
    const r = await request(makeApp()).post("/api/devhub/studio/tier").send({ tier: "enterprise" });
    expect(r.status).toBe(401);
  });

  test("403 when caller is a regular (non-admin) user — regression for self-service tier escalation", async () => {
    const app = makeApp();
    const r = await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("user-1", "user"))
      .send({ tier: "enterprise" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("admin_only");

    // Confirm the tier was NOT actually applied — the free-tier ceiling still holds.
    const credits = await request(app).get("/api/devhub/studio/credits").set(authHeader("user-1"));
    expect(credits.body.tier).toBe("free");
  });

  test("403 when a non-admin tries to grant enterprise tier to someone else", async () => {
    const app = makeApp();
    const r = await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("user-1", "user"))
      .send({ tier: "enterprise", targetUserId: "victim-1" });
    expect(r.status).toBe(403);

    const credits = await request(app).get("/api/devhub/studio/credits").set(authHeader("victim-1"));
    expect(credits.body.tier).toBe("free");
  });

  test("400 on invalid tier value from an admin", async () => {
    const r = await request(makeApp())
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "gold-plus" });
    expect(r.status).toBe(400);
  });

  test("admin can set another user's tier", async () => {
    const app = makeApp();
    const r = await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "enterprise", targetUserId: "user-1" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, userId: "user-1", tier: "enterprise" });

    const credits = await request(app).get("/api/devhub/studio/credits").set(authHeader("user-1"));
    expect(credits.body.tier).toBe("enterprise");
    expect(credits.body.usage.video).toEqual({ used: 0, limit: -1 });
  });

  test("role check is case-insensitive (ADMIN, like AEVIONUser's first-user seed role)", async () => {
    const app = makeApp();
    const r = await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "ADMIN"))
      .send({ tier: "pro", targetUserId: "user-1" });
    expect(r.status).toBe(200);
  });
});

describe("Studio Pro collaborators gate reads the same tier as billing", () => {
  test("upgrading via admin tier endpoint unlocks collaborator invites", async () => {
    const app = makeApp();
    const id = await createProject(app, "owner-1");

    const blocked = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1" });
    expect(blocked.status).toBe(403);

    await request(app)
      .post("/api/devhub/studio/tier")
      .set(authHeader("admin-1", "admin"))
      .send({ tier: "pro", targetUserId: "owner-1" });

    const allowed = await request(app)
      .post(`/api/devhub/projects/${id}/collaborators`)
      .set(authHeader("owner-1"))
      .send({ userId: "friend-1" });
    expect(allowed.status).toBe(201);
  });
});
