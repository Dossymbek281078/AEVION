import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createPrompt,
  getPrompt,
  listPrompts,
  listPublicPrompts,
  updatePrompt,
  deletePrompt,
  forkPrompt,
  getPromptVersionChain,
} from "../src/services/qcoreai/store";

describe("QCorePrompt (in-memory)", () => {
  test("createPrompt requires name + content; defaults role + version=1", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    await expect(createPrompt({ ownerUserId: u, name: "  ", content: "x" })).rejects.toThrow(/name required/);
    await expect(createPrompt({ ownerUserId: u, name: "ok", content: "  " })).rejects.toThrow(/content required/);
    const p = await createPrompt({
      ownerUserId: u,
      name: "  Onboarding writer  ",
      content: "You are a friendly senior PM.",
      role: "weird-role",
    });
    expect(p.name).toBe("Onboarding writer");
    expect(p.role).toBe("writer"); // unknown role falls back
    expect(p.version).toBe(1);
    expect(p.parentPromptId).toBeNull();
    expect(p.isPublic).toBe(false);
  });

  test("listPrompts is owner-scoped, sorted by updatedAt desc", async () => {
    const a = "user-" + Math.random().toString(36).slice(2);
    const b = "user-" + Math.random().toString(36).slice(2);
    const a1 = await createPrompt({ ownerUserId: a, name: "A1", content: "x" });
    await new Promise((r) => setTimeout(r, 5));
    const a2 = await createPrompt({ ownerUserId: a, name: "A2", content: "y" });
    await createPrompt({ ownerUserId: b, name: "B1", content: "z" });
    const list = await listPrompts(a);
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(a2.id);
    expect(list[1].id).toBe(a1.id);
  });

  test("updatePrompt is owner-only, patches fields", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const stranger = "user-" + Math.random().toString(36).slice(2);
    const p = await createPrompt({ ownerUserId: u, name: "orig", content: "abc" });
    expect(await updatePrompt(p.id, stranger, { name: "hijack" })).toBeNull();
    const updated = await updatePrompt(p.id, u, { name: "renamed", isPublic: true, role: "critic" });
    expect(updated?.name).toBe("renamed");
    expect(updated?.isPublic).toBe(true);
    expect(updated?.role).toBe("critic");
  });

  test("deletePrompt is owner-only", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const stranger = "user-" + Math.random().toString(36).slice(2);
    const p = await createPrompt({ ownerUserId: u, name: "to-del", content: "x" });
    expect(await deletePrompt(p.id, stranger)).toBe(false);
    expect(await deletePrompt(p.id, u)).toBe(true);
    expect(await getPrompt(p.id)).toBeNull();
  });

  test("listPublicPrompts only returns isPublic=true, supports q filter", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const open = await createPrompt({ ownerUserId: u, name: "Open writer", content: "Be friendly", isPublic: true });
    const closed = await createPrompt({ ownerUserId: u, name: "Private", content: "Secret", isPublic: false });
    const all = await listPublicPrompts();
    expect(all.find((p) => p.id === open.id)).toBeTruthy();
    expect(all.find((p) => p.id === closed.id)).toBeUndefined();
    const filtered = await listPublicPrompts("writer");
    expect(filtered.find((p) => p.id === open.id)).toBeTruthy();
  });

  test("forkPrompt on own prompt creates child version", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const v1 = await createPrompt({ ownerUserId: u, name: "Writer", content: "v1 content" });
    const v2 = await forkPrompt(v1.id, u, { content: "v2 content" });
    expect(v2).not.toBeNull();
    expect(v2!.version).toBe(2);
    expect(v2!.parentPromptId).toBe(v1.id);
    expect(v2!.content).toBe("v2 content");
  });

  test("forkPrompt on someone else's public prompt creates root + bumps importCount", async () => {
    const owner = "user-" + Math.random().toString(36).slice(2);
    const forker = "user-" + Math.random().toString(36).slice(2);
    const orig = await createPrompt({ ownerUserId: owner, name: "Public", content: "x", isPublic: true });
    const forked = await forkPrompt(orig.id, forker, {});
    expect(forked).not.toBeNull();
    expect(forked!.ownerUserId).toBe(forker);
    expect(forked!.parentPromptId).toBeNull(); // it's a fresh root for the forker
    expect(forked!.version).toBe(1);
    const orig2 = await getPrompt(orig.id);
    expect(orig2?.importCount).toBe(1);
  });

  test("forkPrompt on private prompt by stranger returns null", async () => {
    const owner = "user-" + Math.random().toString(36).slice(2);
    const stranger = "user-" + Math.random().toString(36).slice(2);
    const priv = await createPrompt({ ownerUserId: owner, name: "Mine", content: "x", isPublic: false });
    expect(await forkPrompt(priv.id, stranger, {})).toBeNull();
  });

  test("getPromptVersionChain walks ancestors + descendants", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const v1 = await createPrompt({ ownerUserId: u, name: "Root", content: "v1" });
    const v2 = await forkPrompt(v1.id, u, { content: "v2" });
    const v3 = await forkPrompt(v2!.id, u, { content: "v3" });
    const chainFromV2 = await getPromptVersionChain(v2!.id);
    const ids = chainFromV2.map((p) => p.id);
    expect(ids).toContain(v1.id);
    expect(ids).toContain(v2!.id);
    expect(ids).toContain(v3!.id);
    expect(chainFromV2[0].version).toBe(1);
    expect(chainFromV2[chainFromV2.length - 1].version).toBe(3);
  });
});
