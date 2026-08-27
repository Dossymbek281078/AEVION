import { describe, test, expect, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * The storage paths in routes/pricing.ts used to be resolved once, at import.
 *
 * That is the defect that made the paywall suite write its fixtures into the
 * developer's real data/subscriptions.jsonl: whichever test imported the module
 * first decided the path for every test after it, so setting the env var in a
 * test body came too late and the writes landed in working data. Same shape
 * here, five files deep — leads, newsletter, affiliate, partners, edu.
 *
 * This test sets the env var AFTER the router has already been imported and
 * used, which is exactly the case an import-time constant cannot serve.
 */
const envKeys = ["LEADS_FILE", "NEWSLETTER_FILE", "AFFILIATE_FILE", "PARTNERS_FILE", "EDU_FILE"];
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of envKeys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function appWithPricing() {
  const { pricingRouter } = await import("../src/routes/pricing");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing", pricingRouter);
  return app;
}

describe("pricing.ts writes where the env says at call time, not at import time", () => {
  test("a lead lands in the file named after the module was imported", async () => {
    const app = await appWithPricing(); // import happens here...
    for (const k of envKeys) saved[k] = process.env[k];
    const dir = mkdtempSync(join(tmpdir(), "pricing-lazy-"));
    const target = join(dir, "leads.jsonl");
    process.env.LEADS_FILE = target; // ...and the env is set only now

    const r = await request(app)
      .post("/api/pricing/lead")
      .send({ email: "lazy@test.aevion.dev", name: "Lazy", tier: "lite" });

    expect([200, 201]).toContain(r.status);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toContain("lazy@test.aevion.dev");
  });

  test("a newsletter signup does the same", async () => {
    const app = await appWithPricing();
    for (const k of envKeys) saved[k] = process.env[k];
    const dir = mkdtempSync(join(tmpdir(), "pricing-lazy-"));
    const target = join(dir, "newsletter.jsonl");
    process.env.NEWSLETTER_FILE = target;

    const r = await request(app)
      .post("/api/pricing/newsletter")
      .send({ email: "news@test.aevion.dev" });

    expect([200, 201]).toContain(r.status);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toContain("news@test.aevion.dev");
  });
});
