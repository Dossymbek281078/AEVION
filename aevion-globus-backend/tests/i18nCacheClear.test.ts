import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { i18nRouter } from "../src/routes/i18n";

/**
 * The cache-clear endpoint is a recovery tool for a cache that took in a bad
 * answer, and every cache miss it causes costs a paid translation call. It has
 * to be shut unless an admin token is configured — the codebase's usual guard
 * lets an unset token mean "open", which here would be a way to spend money.
 */
const app = express();
app.use(express.json());
app.use("/api/i18n", i18nRouter);

const ORIGINAL = process.env.ADMIN_TOKEN;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = ORIGINAL;
});

describe("clearing the translation cache", () => {
  it("refuses when no admin token is configured, rather than standing open", async () => {
    delete process.env.ADMIN_TOKEN;
    const r = await request(app).post("/api/i18n/cache/clear");
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/ADMIN_TOKEN/);
  });

  it("refuses a wrong token", async () => {
    process.env.ADMIN_TOKEN = "right";
    const r = await request(app).post("/api/i18n/cache/clear").set("X-Admin-Token", "wrong");
    expect(r.status).toBe(401);
  });

  it("clears on the right token and reports what it did", async () => {
    process.env.ADMIN_TOKEN = "right";
    const r = await request(app).post("/api/i18n/cache/clear").set("X-Admin-Token", "right");
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("cleared");
    expect(r.body.remaining).toBe(0);
    expect(r.body.target).toBe("all");
  });

  it("can clear a single language instead of everything", async () => {
    process.env.ADMIN_TOKEN = "right";
    const r = await request(app).post("/api/i18n/cache/clear?target=de").set("X-Admin-Token", "right");
    expect(r.status).toBe(200);
    expect(r.body.target).toBe("de");
  });
});
