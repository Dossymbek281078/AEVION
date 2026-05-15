import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by mocking the DB pool with a rejecting query
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createSessionInvite,
  getSessionInvite,
  listSessionInvites,
  deleteSessionInvite,
  logAudit,
} from "../src/services/qcoreai/store";

function uid() { return "u-" + Math.random().toString(36).slice(2); }
function sid() { return "s-" + Math.random().toString(36).slice(2); }

describe("V55 — Session invites (in-memory fallback)", () => {

  test("createSessionInvite generates token with 'si_' prefix", async () => {
    const sessionId = sid();
    const userId = uid();
    const invite = await createSessionInvite(sessionId, userId);

    expect(invite.token).toBeTruthy();
    expect(invite.token.startsWith("si_")).toBe(true);
    expect(invite.sessionId).toBe(sessionId);
    expect(invite.invitedBy).toBe(userId);
    expect(invite.role).toBe("viewer");
    expect(invite.usedCount).toBe(0);
    expect(invite.id).toBeTruthy();
  });

  test("getSessionInvite returns null for unknown token", async () => {
    const result = await getSessionInvite("si_nonexistent_totally_fake_token_abc123");
    expect(result).toBeNull();
  });

  test("listSessionInvites filters by sessionId", async () => {
    const sessionA = sid();
    const sessionB = sid();
    const user = uid();

    const invA1 = await createSessionInvite(sessionA, user);
    const invA2 = await createSessionInvite(sessionA, user);
    await createSessionInvite(sessionB, user);

    const listA = await listSessionInvites(sessionA, user);
    const listB = await listSessionInvites(sessionB, user);

    const listAIds = listA.map((i) => i.id);
    expect(listAIds).toContain(invA1.id);
    expect(listAIds).toContain(invA2.id);
    // sessionB invite should NOT appear in sessionA results
    for (const inv of listA) {
      expect(inv.sessionId).toBe(sessionA);
    }
    expect(listB).toHaveLength(1);
    expect(listB[0].sessionId).toBe(sessionB);
  });

  test("deleteSessionInvite returns false for wrong user", async () => {
    const sessionId = sid();
    const owner = uid();
    const other = uid();

    const invite = await createSessionInvite(sessionId, owner);
    const result = await deleteSessionInvite(invite.id, other);
    expect(result).toBe(false);

    // Invite should still exist
    const resolved = await getSessionInvite(invite.token);
    expect(resolved).not.toBeNull();
  });

});

describe("V56 — Audit log (fire-and-forget, in-memory fallback)", () => {

  test("logAudit does not throw even when DB unavailable", async () => {
    // DB mock always rejects — logAudit must swallow errors
    await expect(
      logAudit("some-user", "test.action", { resourceId: "r1", resourceType: "session" })
    ).resolves.toBeUndefined();
  });

});
