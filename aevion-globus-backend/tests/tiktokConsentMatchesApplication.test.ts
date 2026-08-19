import { describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import type { Router } from "express";
import express from "express";
import request from "supertest";

/**
 * The scopes we ask TikTok for at consent time MUST match the scopes the app
 * review application declares. On 19.08.2026 they did not: the application
 * listed user.info.basic, video.publish and video.upload, while the consent
 * screen asked for only the first two.
 *
 * That is worse than a missing feature. The review text stated that saving to
 * the creator's drafts is the default path — and video.upload is the scope that
 * makes drafts possible. We were describing behaviour the product could not
 * perform, to the one reader who verifies it.
 *
 * These tests read the live route rather than the constant, because the defect
 * lived in the gap between them: the constant is only a default, and a stale
 * environment variable overrides it silently.
 */

// Kept in step with the scopes listed on the app in the TikTok developer portal.
const SCOPES_DECLARED_IN_APPLICATION = [
  "user.info.basic",
  "video.publish",
  "video.upload",
];

const TOUCHED_ENV = [
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_REDIRECT_URI",
  "TIKTOK_SCOPES",
] as const;

let saved: Record<string, string | undefined> = {};

// Imported once, not per test. The first import pulls the whole backend module
// graph and took 48s on this machine — long enough to blow a single test's 30s
// budget while the identical tests after it passed in milliseconds. A red test
// that only means "the import was slow" teaches the reader to ignore red.
let tiktokRouter: Router;
beforeAll(async () => {
  ({ tiktokRouter } = await import("../src/routes/tiktok"));
}, 180_000);

// getConfig() reads process.env on every call, so one import serves every case.
function appWithRouter() {
  const app = express();
  app.use("/api/tiktok", tiktokRouter);
  return app;
}

beforeEach(() => {
  saved = {};
  for (const k of TOUCHED_ENV) saved[k] = process.env[k];
  process.env.TIKTOK_CLIENT_KEY = "test-key";
  process.env.TIKTOK_CLIENT_SECRET = "test-secret";
  process.env.TIKTOK_REDIRECT_URI = "https://aevion.app/api-backend/api/tiktok/auth/callback";
  delete process.env.TIKTOK_SCOPES;
});

afterEach(() => {
  for (const k of TOUCHED_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("TikTok consent asks for what the application declares", () => {
  test("/config reports every scope the application lists", async () => {
    const app = appWithRouter();
    const res = await request(app).get("/api/tiktok/config");
    expect(res.status).toBe(200);

    const reported = String(res.body.scopes).split(",").map((s) => s.trim());
    // Asserted per scope so a failure names the missing one instead of
    // printing two long strings and leaving the reader to diff them.
    for (const scope of SCOPES_DECLARED_IN_APPLICATION) {
      expect(reported).toContain(scope);
    }
  });

  test("the authorize redirect carries those scopes, not just the config", async () => {
    const app = appWithRouter();
    const res = await request(app).get("/api/tiktok/auth/start");
    expect(res.status).toBe(302);

    const location = String(res.headers.location);
    const asked = new URL(location).searchParams.get("scope") || "";
    const askedList = asked.split(",").map((s) => s.trim());

    for (const scope of SCOPES_DECLARED_IN_APPLICATION) {
      expect(askedList).toContain(scope);
    }
  });

  test("an explicit TIKTOK_SCOPES still wins — the default is not a guarantee", async () => {
    // Not a nicety: production reported exactly the old default string, so we
    // could not tell whether the variable was unset or set to a stale value.
    // Pinning the precedence here means a future reader knows which to check.
    process.env.TIKTOK_SCOPES = "user.info.basic";
    const app = appWithRouter();
    const res = await request(app).get("/api/tiktok/config");
    expect(res.body.scopes).toBe("user.info.basic");
  });

  test("the redirect URI is not left on a preview host", async () => {
    // The review demo video must be shot on the same domain as the site URL in
    // the application. Production pointed at aevion.vercel.app while the
    // application said aevion.app, which fails review on its own.
    const app = appWithRouter();
    const res = await request(app).get("/api/tiktok/config");
    expect(res.body.redirectUri).not.toMatch(/\.vercel\.app/);
    expect(res.body.redirectUri).not.toMatch(/\.up\.railway\.app/);
  });
});

describe("commercial content disclosure", () => {
  // The application tells the reviewer that branded content which leaves no
  // usable privacy level is refused with an explanation, rather than quietly
  // downgraded. Until 19.08.2026 the product did neither: it had no disclosure
  // at all, so the sentence described nothing.
  test("branded content plus SELF_ONLY is refused, and the reason names both sides", async () => {
    const { disclosureConflict } = await import("../src/routes/tiktok");
    const reason = disclosureConflict({
      privacyLevel: "SELF_ONLY",
      brandedContent: true,
    });
    expect(reason).toBeTruthy();
    // A refusal the creator cannot act on is only half a refusal, so the text
    // has to name the two settings that conflict.
    expect(reason).toMatch(/SELF_ONLY/);
    expect(reason).toMatch(/branded content/i);
  });

  test("branded content with a public audience is allowed", async () => {
    const { disclosureConflict } = await import("../src/routes/tiktok");
    expect(
      disclosureConflict({ privacyLevel: "PUBLIC_TO_EVERYONE", brandedContent: true }),
    ).toBeNull();
  });

  test("a private post that is NOT branded content stays allowed", async () => {
    // Guards the obvious over-correction: refusing every SELF_ONLY post would
    // break the safest path we have, which is exactly what unapproved apps are
    // restricted to.
    const { disclosureConflict } = await import("../src/routes/tiktok");
    expect(
      disclosureConflict({ privacyLevel: "SELF_ONLY", brandedContent: false }),
    ).toBeNull();
  });
});

describe("drafts are a real path, not a claim", () => {
  // The application and the product catalogue both promise "save to drafts or
  // post directly". Until 19.08.2026 only direct post existed, while
  // video.upload — the scope that exists precisely for drafts — was already
  // being requested at consent. Asking for a permission nothing uses is its own
  // review failure; TikTok asks you to remove unused scopes before submitting.
  //
  // The first version of these tests scanned the source for the endpoint URL
  // and PASSED when the routing was broken, because the strings stayed in the
  // file. Presence of text is not behaviour. These call the builder instead.
  test("a draft goes to the inbox endpoint", async () => {
    const { buildPublishRequest } = await import("../src/routes/tiktok");
    const r = buildPublishRequest({ target: "draft", videoUrl: "https://x/v.mp4" });
    expect(r.url).toContain("inbox");
  });

  test("a direct post goes to the publish endpoint, not the inbox", async () => {
    const { buildPublishRequest } = await import("../src/routes/tiktok");
    const r = buildPublishRequest({
      target: "direct",
      videoUrl: "https://x/v.mp4",
      privacyLevel: "PUBLIC_TO_EVERYONE",
    });
    expect(r.url).not.toContain("inbox");
    expect(r.url).toContain("post/publish/video/init");
  });

  test("a draft carries no post_info — TikTok rejects it there", async () => {
    const { buildPublishRequest } = await import("../src/routes/tiktok");
    const r = buildPublishRequest({ target: "draft", videoUrl: "https://x/v.mp4" });
    expect(r.body.post_info).toBeUndefined();
    expect(r.body.source_info).toBeTruthy();
  });

  test("a direct post carries the disclosure flags even when they are false", async () => {
    // Explicit false is the point: TikTok reads an absent flag as "not
    // commercial", so the field has to be present either way.
    const { buildPublishRequest } = await import("../src/routes/tiktok");
    const r = buildPublishRequest({
      target: "direct",
      videoUrl: "https://x/v.mp4",
      privacyLevel: "PUBLIC_TO_EVERYONE",
    });
    const info = r.body.post_info as Record<string, unknown>;
    expect(info.brand_organic_toggle).toBe(false);
    expect(info.brand_content_toggle).toBe(false);
    expect(info.is_aigc).toBe(false);
  });
});
