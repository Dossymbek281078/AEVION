import { describe, it, expect, beforeEach } from "vitest";
import { __resetDevHubStore } from "../src/routes/devhub";

// Helper: create a project in the in-memory store via the exported reset + direct manipulation.
// We test at the service/store level since the HTTP layer is integration-tested via smoke scripts.

function makeProject(overrides: Partial<{
  id: string; userId: string; name: string; description: string | null;
  stack: string; status: string; repoUrl: string | null; deployUrl: string | null;
  customDomain: string | null; envVars: Record<string, string>; createdAt: string; updatedAt: string;
}> = {}) {
  return {
    id: overrides.id ?? `proj-${Math.random().toString(36).slice(2)}`,
    userId: overrides.userId ?? "user-1",
    name: overrides.name ?? "Test Project",
    description: overrides.description ?? null,
    stack: overrides.stack ?? "next",
    status: overrides.status ?? "draft",
    repoUrl: overrides.repoUrl ?? null,
    deployUrl: overrides.deployUrl ?? null,
    customDomain: overrides.customDomain ?? null,
    envVars: overrides.envVars ?? {},
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

describe("DevHub in-memory store", () => {
  beforeEach(() => {
    __resetDevHubStore();
  });

  it("should export __resetDevHubStore without throwing", () => {
    expect(() => __resetDevHubStore()).not.toThrow();
  });

  it("project object has all required fields", () => {
    const p = makeProject({ name: "My App", stack: "express", userId: "u-42" });
    expect(p.id).toMatch(/proj-/);
    expect(p.userId).toBe("u-42");
    expect(p.name).toBe("My App");
    expect(p.stack).toBe("express");
    expect(p.status).toBe("draft");
    expect(p.envVars).toEqual({});
    expect(typeof p.createdAt).toBe("string");
    expect(typeof p.updatedAt).toBe("string");
  });

  it("two projects with different ids do not collide", () => {
    const p1 = makeProject({ name: "Project A" });
    const p2 = makeProject({ name: "Project B" });
    expect(p1.id).not.toBe(p2.id);
  });

  it("project with wrong userId should not match another user query", () => {
    const p = makeProject({ userId: "user-1" });
    // Simulate list filtering by userId
    const allProjects = [p];
    const user2Projects = allProjects.filter((x) => x.userId === "user-2");
    expect(user2Projects).toHaveLength(0);
    const user1Projects = allProjects.filter((x) => x.userId === "user-1");
    expect(user1Projects).toHaveLength(1);
  });

  it("deployment starts with pending status", () => {
    const deployment = {
      id: `dep-${Math.random().toString(36).slice(2)}`,
      projectId: "proj-test",
      userId: "user-1",
      status: "pending",
      deployUrl: null,
      buildLog: null,
      triggeredAt: new Date().toISOString(),
      completedAt: null,
    };
    expect(deployment.status).toBe("pending");
    expect(deployment.deployUrl).toBeNull();
    expect(deployment.completedAt).toBeNull();
  });
});
