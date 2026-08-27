/**
 * A project save that failed must not disappear.
 *
 * Seven routes park a failed `dbSaveProject` in the in-memory `memProjects`
 * map. Every route's read does `try { dbGetProject() } catch { memProjects }`,
 * so the fallback works when the READ also fails — and only then. The case it
 * misses is the common one: the write failed, the read is fine, and the row
 * simply is not there. Then `dbGetProject` returns null from a healthy query,
 * `memProjects` is never consulted, and the save is gone while the route has
 * already answered 201/200.
 *
 * What that costs, concretely:
 *   - project create → the project the user just made is not there afterwards;
 *   - project update → a rename or setting quietly reverts;
 *   - repoUrl / deployUrl → the link to the repo or the live site is forgotten;
 *   - RAILWAY_SERVICE_ID → its own comment says it is stored so a click does
 *     not create a *billable* container each time. Losing it bills again.
 *
 * The file-write version of this was fixed earlier (see
 * devhub-no-silent-save-fallback.test.ts); projects were left behind.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// The database is READY — that is the whole point of this file.
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [],
  callProvider: vi.fn(),
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

beforeEach(() => {
  __resetDevHubStore();
  mockQuery.mockReset();
});

afterEach(() => {
  mockQuery.mockReset();
});

/**
 * Writes fail, reads succeed and honestly report an empty table. This is the
 * shape the existing fallback does not survive — a failing read would take the
 * route's own `catch` branch and find the parked copy.
 */
function writesFailReadsWork() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) throw new Error("could not serialize access");
    return { rows: [] };
  });
}

describe("a project whose save failed is still there afterwards", () => {
  test("a created project can be read back", async () => {
    writesFailReadsWork();
    const app = makeApp();

    const created = await request(app).post("/api/devhub/projects").send({ name: "Rescued" });
    expect(created.status).toBe(201);
    const id = created.body.project.id as string;

    const read = await request(app).get(`/api/devhub/projects/${id}`);

    expect(read.status).toBe(200);
    expect(read.body.project.name).toBe("Rescued");
  });

  test("it also appears in the list, not only by direct id", async () => {
    writesFailReadsWork();
    const app = makeApp();

    await request(app).post("/api/devhub/projects").send({ name: "Listed" });

    const list = await request(app).get("/api/devhub/projects");

    expect(list.status).toBe(200);
    expect((list.body.projects ?? []).map((p: any) => p.name)).toContain("Listed");
  });

  test("an update that failed to persist is what the next read returns", async () => {
    writesFailReadsWork();
    const app = makeApp();
    const created = await request(app).post("/api/devhub/projects").send({ name: "Before" });
    const id = created.body.project.id as string;

    await request(app).patch(`/api/devhub/projects/${id}`).send({ name: "After" });
    const read = await request(app).get(`/api/devhub/projects/${id}`);

    expect(read.body.project.name).toBe("After");
  });

  test("once the database accepts the write, the parked copy stops shadowing it", async () => {
    // Otherwise the rescue becomes its own bug: a stale in-memory copy would
    // outrank every later database row for the life of the process.
    const app = makeApp();
    writesFailReadsWork();
    const created = await request(app).post("/api/devhub/projects").send({ name: "Stale" });
    const id = created.body.project.id as string;

    // Database recovers; a later save lands, and the row now says something else.
    mockQuery.mockImplementation(async (sql: string) => {
      if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) return { rows: [] };
      return {
        rows: [{
          id, userId: "anonymous", name: "Fresh from db", description: "", stack: "static",
          status: "active", repoUrl: null, deployUrl: null, customDomain: null,
          envVars: {}, collaborators: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
      };
    });
    await request(app).patch(`/api/devhub/projects/${id}`).send({ description: "persisted now" });

    const read = await request(app).get(`/api/devhub/projects/${id}`);

    expect(read.body.project.name).toBe("Fresh from db");
  });
});

describe("the rescue does not resurrect what was deleted", () => {
  test("deleting a project whose save had failed actually removes it", async () => {
    // The overlay in dbGetProject opens this hole itself: without clearing the
    // parked copy, a delete would remove the row and leave the project visible.
    writesFailReadsWork();
    const app = makeApp();
    const created = await request(app).post("/api/devhub/projects").send({ name: "Doomed" });
    const id = created.body.project.id as string;
    expect((await request(app).get(`/api/devhub/projects/${id}`)).status).toBe(200);

    // Deletes are allowed to land even while other writes fail.
    mockQuery.mockImplementation(async (sql: string) => {
      if (/^\s*DELETE/i.test(sql)) return { rows: [] };
      if (/^\s*(INSERT|UPDATE)/i.test(sql)) throw new Error("could not serialize access");
      return { rows: [] };
    });
    const del = await request(app).delete(`/api/devhub/projects/${id}`);
    expect(del.status).toBe(200);

    const after = await request(app).get(`/api/devhub/projects/${id}`);
    expect(after.status).toBe(404);
  });
});

describe("an undo point whose save failed must not be invisible", () => {
  /**
   * Worse than the project case. A checkpoint is the safety net taken BEFORE
   * files are overwritten — the Pull-from-repo button's own tooltip promises
   * "undo restores the pre-sync state". If its save fails and the parked copy
   * is unreadable, the operation still overwrites the files, and a later undo
   * restores an OLDER checkpoint on top of the user's work. Silently, and in
   * the wrong direction: the safety net makes the damage.
   */
  test("the newest checkpoint is the one undo sees, even if its save failed", async () => {
    writesFailReadsWork();
    const originalFetch = globalThis.fetch;
    // A plain file write takes no checkpoint — only AI generation, agent steps
    // and the GitHub pull do. The pull is the one whose button promises undo.
    const b64 = (x: string) => Buffer.from(x, "utf8").toString("base64");
    globalThis.fetch = (async (url: string) => {
      const u = String(url);
      const body =
        u.endsWith("/repos/o/r") ? { default_branch: "main" }
        : u.includes("/git/trees/") ? { tree: [{ path: "a.ts", type: "blob", sha: "s1", size: 10 }] }
        : u.includes("/git/blobs/s1") ? { content: b64("from repo"), encoding: "base64" }
        : {};
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    }) as unknown as typeof fetch;
    process.env.GITHUB_TOKEN = "gh-fake";

    try {
      const app = makeApp();
      const created = await request(app).post("/api/devhub/projects").send({ name: "CP" });
      const id = created.body.project.id as string;
      await request(app).put(`/api/devhub/projects/${id}/file?path=a.ts`).send({ content: "mine" });
      await request(app).patch(`/api/devhub/projects/${id}`).send({ repoUrl: "https://github.com/o/r" });

      // The pull overwrites a.ts and takes a checkpoint first — whose save fails.
      const sync = await request(app).post(`/api/devhub/projects/${id}/github/sync`);
      expect(sync.body.ok).toBe(true);

      const list = await request(app).get(`/api/devhub/projects/${id}/checkpoints`);

      expect(list.status).toBe(200);
      // Without the overlay this list is empty, and undo has nothing — or worse,
      // an older entry — to restore over the user's file.
      expect((list.body.checkpoints ?? []).length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.GITHUB_TOKEN;
    }
  });
});

describe("a deployment record whose save failed is still listed", () => {
  // The deployments list is the only place the IDE learns a deploy happened.
  // A missing row does not read as "we lost the record" — it reads as
  // "nothing was deployed", which is a different and wrong answer.
  test("the deploy appears in the project's list", async () => {
    writesFailReadsWork();
    const app = makeApp();
    const created = await request(app).post("/api/devhub/projects").send({ name: "D" });
    const id = created.body.project.id as string;
    await request(app).put(`/api/devhub/projects/${id}/file?path=index.html`).send({ content: "<h1>x</h1>" });

    const dep = await request(app).post(`/api/devhub/projects/${id}/deploy`).send({});
    // 501 is the expected answer here and not an accident: backend deploys are
    // deliberately refused until per-project Railway services exist. That path
    // still writes a deployment record (status "failed", with the reason), and
    // it is exactly the record that used to be lost — a refusal nobody can
    // find afterwards reads as "the button did nothing".
    expect(dep.status).toBe(501);
    expect(dep.body.deploymentId).toBeTruthy();

    const list = await request(app).get(`/api/devhub/projects/${id}/deployments`);
    expect(list.status).toBe(200);
    expect((list.body.deployments ?? []).length).toBeGreaterThan(0);
  });
});
