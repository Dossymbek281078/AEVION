import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by failing the SELECT 1 probe.
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createTemplate,
  listTemplates,
  listPublicTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  useTemplate,
} from "../src/services/qcoreai/store";

function uid() {
  return "u-" + Math.random().toString(36).slice(2);
}

describe("QCoreTemplate (in-memory)", () => {
  test("createTemplate stores all fields with defaults", async () => {
    const owner = uid();
    const t = await createTemplate({
      ownerUserId: owner,
      name: "Investor pitch",
      description: "Sequential with Sonnet",
      input: "Write an investor pitch for a B2B SaaS startup",
      strategy: "sequential",
      isPublic: false,
    });
    expect(t.id).toBeTruthy();
    expect(t.ownerUserId).toBe(owner);
    expect(t.name).toBe("Investor pitch");
    expect(t.input).toBe("Write an investor pitch for a B2B SaaS startup");
    expect(t.strategy).toBe("sequential");
    expect(t.isPublic).toBe(false);
    expect(t.useCount).toBe(0);
  });

  test("listTemplates returns only the owner's templates", async () => {
    const owner = uid();
    const other = uid();
    await createTemplate({ ownerUserId: owner, name: "Mine 1", input: "q1" });
    await createTemplate({ ownerUserId: owner, name: "Mine 2", input: "q2" });
    await createTemplate({ ownerUserId: other, name: "Not mine", input: "q3" });

    const list = await listTemplates(owner);
    expect(list.every((t) => t.ownerUserId === owner)).toBe(true);
    expect(list.some((t) => t.name === "Mine 1")).toBe(true);
    expect(list.some((t) => t.name === "Mine 2")).toBe(true);
    expect(list.some((t) => t.name === "Not mine")).toBe(false);
  });

  test("listPublicTemplates only shows isPublic=true, sorted by useCount desc", async () => {
    const owner = uid();
    const pub1 = await createTemplate({ ownerUserId: owner, name: "Public A", input: "a", isPublic: true });
    const pub2 = await createTemplate({ ownerUserId: owner, name: "Public B", input: "b", isPublic: true });
    await createTemplate({ ownerUserId: owner, name: "Private C", input: "c", isPublic: false });

    await useTemplate(pub1.id);
    await useTemplate(pub1.id);
    await useTemplate(pub2.id);

    const list = await listPublicTemplates();
    const pub1Row = list.find((t) => t.id === pub1.id);
    const pub2Row = list.find((t) => t.id === pub2.id);
    expect(pub1Row?.useCount).toBe(2);
    expect(pub2Row?.useCount).toBe(1);
    // private should not appear
    expect(list.some((t) => t.name === "Private C")).toBe(false);
    // pub1 (2 uses) before pub2 (1 use)
    const i1 = list.findIndex((t) => t.id === pub1.id);
    const i2 = list.findIndex((t) => t.id === pub2.id);
    expect(i1).toBeLessThan(i2);
  });

  test("listPublicTemplates filters by query", async () => {
    const owner = uid();
    await createTemplate({ ownerUserId: owner, name: "Code review workflow", input: "review", isPublic: true });
    await createTemplate({ ownerUserId: owner, name: "Bug triage", input: "triage", isPublic: true });

    const filtered = await listPublicTemplates("code review");
    expect(filtered.some((t) => t.name === "Code review workflow")).toBe(true);
    expect(filtered.some((t) => t.name === "Bug triage")).toBe(false);
  });

  test("getTemplate returns the row for both owner and public", async () => {
    const owner = uid();
    const priv = await createTemplate({ ownerUserId: owner, name: "Private", input: "p", isPublic: false });
    const pub = await createTemplate({ ownerUserId: owner, name: "Public", input: "q", isPublic: true });

    expect((await getTemplate(priv.id))?.id).toBe(priv.id);
    expect((await getTemplate(pub.id))?.id).toBe(pub.id);
    expect(await getTemplate("missing-id")).toBeNull();
  });

  test("updateTemplate only allows the owner to patch fields", async () => {
    const owner = uid();
    const other = uid();
    const t = await createTemplate({ ownerUserId: owner, name: "Original", input: "q", isPublic: false });

    // Owner can patch.
    const updated = await updateTemplate(t.id, owner, { name: "Updated", isPublic: true });
    expect(updated?.name).toBe("Updated");
    expect(updated?.isPublic).toBe(true);

    // Stranger gets null.
    const denied = await updateTemplate(t.id, other, { name: "Hacked" });
    expect(denied).toBeNull();
    // Original name should still be "Updated" (stranger didn't change it).
    const re = await getTemplate(t.id);
    expect(re?.name).toBe("Updated");
  });

  test("deleteTemplate is owner-only and idempotent", async () => {
    const owner = uid();
    const stranger = uid();
    const t = await createTemplate({ ownerUserId: owner, name: "To delete", input: "q" });

    expect(await deleteTemplate(t.id, stranger)).toBe(false);
    expect(await getTemplate(t.id)).not.toBeNull();

    expect(await deleteTemplate(t.id, owner)).toBe(true);
    expect(await getTemplate(t.id)).toBeNull();

    // Second delete returns false.
    expect(await deleteTemplate(t.id, owner)).toBe(false);
  });

  test("useTemplate increments useCount each time", async () => {
    const owner = uid();
    const t = await createTemplate({ ownerUserId: owner, name: "Popular", input: "q", isPublic: true });
    expect(t.useCount).toBe(0);

    const r1 = await useTemplate(t.id);
    expect(r1?.useCount).toBe(1);
    const r2 = await useTemplate(t.id);
    expect(r2?.useCount).toBe(2);
  });

  test("useTemplate returns null for missing id", async () => {
    expect(await useTemplate("non-existent-id")).toBeNull();
  });
});
