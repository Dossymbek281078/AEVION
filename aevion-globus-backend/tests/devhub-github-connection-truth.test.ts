/**
 * DevHub GitHub connection state must not claim a link it does not have.
 *
 * Before this file, `/github/branches` answered `connected: true` for EVERY
 * non-ok GitHub response, and `/github/status` answered `exists: false` for the
 * same set. A revoked token, a repo the token cannot see, and a GitHub outage
 * were one indistinguishable "connected, no branches" screen.
 *
 * That is not hypothetical here: the org's GitHub account has been suspended
 * since 2026-07-27, so every token in this deployment answers 401 right now.
 *
 * Own harness, per the note in devhub-github.test.ts: vi.mock is hoisted per
 * file, and appending to that file's tail is what kept colliding across PRs.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: vi.fn(() => []),
  callProvider: vi.fn(),
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __clearDeferredDevHubWork } from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { classifyGithubResponse, githubUnreachable } from "../src/lib/githubFailure";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetDevHubStore();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  __clearDeferredDevHubWork();
  globalThis.fetch = originalFetch;
  delete process.env.GITHUB_TOKEN;
});

/** Minimal Response stand-in; `headers` mirrors the real `Headers#get`. */
function ghResp(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** A project with a linked repo, which is the only state these routes act on. */
async function linkedProject(app: express.Express) {
  const cr = await request(app).post("/api/devhub/projects").send({ name: "GH" });
  const id = cr.body.project.id as string;
  await request(app).patch(`/api/devhub/projects/${id}`).send({ repoUrl: "https://github.com/o/r" });
  return id;
}

describe("classifyGithubResponse — one boolean cannot carry three answers", () => {
  test("a revoked token is never reported as connected", () => {
    const f = classifyGithubResponse(401);
    expect(f.connected).toBe(false);
    expect(f.errorKind).toBe("auth");
    expect(f.error).toMatch(/token/i);
  });

  test("403 with the rate-limit header is the link working, not access lost", () => {
    const f = classifyGithubResponse(403, { get: (n) => (n === "x-ratelimit-remaining" ? "0" : null) });
    expect(f.errorKind).toBe("rate_limit");
    // The distinction that matters to the reader: nothing for them to fix.
    expect(f.error).toMatch(/try again/i);
  });

  test("403 without that header is lost access, and says so differently", () => {
    const f = classifyGithubResponse(403, { get: () => null });
    expect(f.errorKind).toBe("auth");
    expect(f.error).not.toMatch(/rate limit/i);
  });

  test("404 does not assert the repo is gone — a private repo looks identical", () => {
    const f = classifyGithubResponse(404);
    expect(f.errorKind).toBe("not_found");
    expect(f.error).toMatch(/cannot see it/i);
  });

  test("a 5xx blames GitHub, not the token", () => {
    const f = classifyGithubResponse(503);
    expect(f.errorKind).toBe("unavailable");
    expect(f.error).toMatch(/GitHub's side/i);
  });

  test("an unreachable GitHub is unavailable, not an auth failure", () => {
    expect(githubUnreachable("ETIMEDOUT").errorKind).toBe("unavailable");
    expect(githubUnreachable().connected).toBe(false);
  });
});

describe("GET /api/devhub/projects/:id/github/branches — the reason reaches the screen", () => {
  test("a revoked token reports disconnected with the reason, not connected with no branches", async () => {
    process.env.GITHUB_TOKEN = "gh-revoked";
    const app = makeApp();
    const id = await linkedProject(app);
    fetchMock.mockResolvedValue(ghResp(401, { message: "Bad credentials" }));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/branches`);

    expect(r.body.connected).toBe(false);
    expect(r.body.errorKind).toBe("auth");
    expect(r.body.branches).toEqual([]);
  });

  test("a deleted or invisible repo is not the same answer as a bad token", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const id = await linkedProject(app);
    fetchMock.mockResolvedValue(ghResp(404, { message: "Not Found" }));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/branches`);

    expect(r.body.connected).toBe(false);
    expect(r.body.errorKind).toBe("not_found");
  });

  test("a GitHub outage is told apart from a broken link", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const id = await linkedProject(app);
    fetchMock.mockResolvedValue(ghResp(502, { message: "Bad gateway" }));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/branches`);

    expect(r.body.errorKind).toBe("unavailable");
  });

  test("a network failure no longer looks like a missing token", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const id = await linkedProject(app);
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/branches`);

    expect(r.body.connected).toBe(false);
    expect(r.body.errorKind).toBe("unavailable");
  });

  test("no repo linked stays a plain not-connected with no invented failure", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Bare" });

    const r = await request(app).get(`/api/devhub/projects/${cr.body.project.id}/github/branches`);

    expect(r.body.connected).toBe(false);
    expect(r.body.errorKind).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a working repo still answers connected with its branches", async () => {
    process.env.GITHUB_TOKEN = "gh-fake";
    const app = makeApp();
    const id = await linkedProject(app);
    fetchMock.mockResolvedValue(ghResp(200, [{ name: "main", commit: { sha: "abcdef1234" } }]));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/branches`);

    expect(r.body.connected).toBe(true);
    expect(r.body.branches).toEqual([{ name: "main", sha: "abcdef1" }]);
    expect(r.body.error).toBeUndefined();
  });
});

describe("GET /api/devhub/projects/:id/github/status — absent and unverifiable are different", () => {
  test("a revoked token does not claim the repository does not exist", async () => {
    process.env.GITHUB_TOKEN = "gh-revoked";
    const app = makeApp();
    const id = await linkedProject(app);
    fetchMock.mockResolvedValue(ghResp(401, { message: "Bad credentials" }));

    const r = await request(app).get(`/api/devhub/projects/${id}/github/status`);

    expect(r.body.exists).toBe(false);
    expect(r.body.errorKind).toBe("auth");
    expect(r.body.error).toMatch(/token/i);
  });

  test("with no repo linked there is nothing to explain", async () => {
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "Bare" });

    const r = await request(app).get(`/api/devhub/projects/${cr.body.project.id}/github/status`);

    expect(r.body.exists).toBe(false);
    expect(r.body.error).toBeUndefined();
  });
});

describe("no route is declared twice — the second copy can never run", () => {
  // Found while fixing the above: two POST handlers were registered on
  // /projects/:id/github/sync. Express answers with the first, so the second
  // was dead from the day it was written, and reading the file suggested
  // behaviour that никогда не выполнялась. A duplicate is silent by nature —
  // no error, no warning, just a handler that is never reached.
  test("every method+path pair in devhubRouter appears exactly once", () => {
    const seen = new Map<string, number>();
    for (const layer of (devhubRouter as any).stack) {
      const route = layer?.route;
      if (!route) continue;
      for (const method of Object.keys(route.methods)) {
        const key = `${method.toUpperCase()} ${route.path}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`);
    expect(duplicates).toEqual([]);
  });
});
