import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 4.11.2026: /runs/:id/cost-breakdown отдавал модели, токены и цену чужого прогона по id без входа. */
const src = readFileSync(join(__dirname, "..", "src", "routes", "qcoreai.ts"), "utf8");
const start = src.indexOf('qcoreaiRouter.get("/runs/:id/cost-breakdown"');
const handler = src.slice(start, src.indexOf("qcoreaiRouter.", start + 10));

describe("cost-breakdown только владельцу", () => {
  it("владелец проверяется до чтения сообщений", () => {
    expect(start).toBeGreaterThan(0);
    const owner = handler.indexOf("getSession(run.sessionId, qcoreOwner(req, auth))");
    const read = handler.indexOf("listMessages(run.id)");
    expect(owner).toBeGreaterThan(0);
    expect(owner).toBeLessThan(read);
    expect(handler).toContain('res.status(403).json({ error: "forbidden" })');
  });
});
