import { describe, test, expect, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import { fetchQRightContext } from "../src/services/qcoreai/qrightContext";

describe("fetchQRightContext (tool use lite)", () => {
  test("returns empty string when neither userId nor email are provided", async () => {
    const ctx = await fetchQRightContext(null, null);
    expect(ctx).toBe("");
  });

  test("returns empty string when DB query throws (best-effort, never crashes)", async () => {
    mockQuery.mockReset();
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));
    const ctx = await fetchQRightContext("u-123", "u@example.com");
    expect(ctx).toBe("");
  });

  test("returns 'no objects yet' block when query returns empty rows", async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const ctx = await fetchQRightContext("u-123", "u@example.com");
    expect(ctx).toContain("Tool: QRight objects");
    expect(ctx).toMatch(/no QRight objects yet/i);
  });

  test("formats objects with name/kind/status/id/created", async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "qr-001",
          kind: "document",
          name: "Patent draft",
          status: "active",
          createdAt: new Date("2026-04-01T12:00:00Z"),
        },
        {
          id: "qr-002",
          kind: "image",
          name: "Logo v3",
          status: "draft",
          createdAt: new Date("2026-03-30T08:00:00Z"),
        },
      ],
      rowCount: 2,
    });
    const ctx = await fetchQRightContext("u-123", "u@example.com");
    expect(ctx).toContain("Patent draft");
    expect(ctx).toContain("kind=document");
    expect(ctx).toContain("status=active");
    expect(ctx).toContain("id=qr-001");
    expect(ctx).toContain("created=2026-04-01");
    expect(ctx).toContain("Logo v3");
    expect(ctx).toContain("id=qr-002");
  });

  test("uses both predicates when userId AND email are provided", async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await fetchQRightContext("u-123", "u@example.com");
    const call = mockQuery.mock.calls[0];
    const sql = call[0] as string;
    const params = call[1] as any[];
    expect(sql).toMatch(/"ownerUserId" = \$1/);
    expect(sql).toMatch(/"ownerEmail" = \$2/);
    expect(params).toEqual(["u-123", "u@example.com"]);
  });
});
