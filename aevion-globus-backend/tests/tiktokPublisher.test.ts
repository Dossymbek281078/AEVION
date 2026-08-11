import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { tiktokRouter } from "../src/routes/tiktok";

// TikTok publisher hardening — 2026-08-10.
//
// The route shipped with a class of defect that never throws: it kept
// reporting a connected TikTok account after the token behind it had died.
//
//   1. /config answered `connected: true` for any cookie holding an
//      access_token, without looking at expires_at. A day after connecting,
//      the UI showed a connected account whose every call 401'd.
//   2. ensureToken returned null on an unusable session but left the cookie
//      in place, so the state was sticky — reload after reload.
//   3. /publish forwarded any string as video_url and reported success on an
//      "ok" body with no publish_id ("publish_id: undefined" to the creator,
//      while nothing had been queued).
//
// These tests pin the honest behaviour: a dead session reads as
// disconnected and its cookie is cleared, bad input is rejected with a
// reason, and only a real publish_id counts as a queued post.

const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const PUBLISH_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";

const ENV_KEYS = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"];

let fetchMock: ReturnType<typeof vi.fn>;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/tiktok", tiktokRouter);
  return app;
}

/** Serialise a session the way the route's own cookie writer does. */
function sessionCookie(session: Record<string, unknown>): string {
  return `tt_sess=${encodeURIComponent(JSON.stringify(session))}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// creator_info is cached per access_token for 60s, so each test gets its own
// token — otherwise one test's cached response would answer the next one.
let tokenSeq = 0;
const freshLiveSession = () => ({
  access_token: `at-live-${++tokenSeq}`,
  refresh_token: "rt",
  expires_at: nowSec() + 3600,
});
const expiredNoRefresh = { access_token: "at-dead", expires_at: nowSec() - 10 };
const expiredWithRefresh = { access_token: "at-old", refresh_token: "rt", expires_at: nowSec() - 10 };

/** Did the response tell the browser to drop the session cookie? */
function clearsSessionCookie(res: request.Response): boolean {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.some((c) => c.startsWith("tt_sess=") && /Max-Age=0/.test(c));
}

function tiktokOk(data: unknown) {
  return { ok: true, json: async () => ({ data, error: { code: "ok" } }) };
}

beforeEach(() => {
  process.env.TIKTOK_CLIENT_KEY = "test-key";
  process.env.TIKTOK_CLIENT_SECRET = "test-secret";
  process.env.TIKTOK_REDIRECT_URI = "https://aevion.example/api/tiktok/auth/callback";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/config reports the real session state", () => {
  test("live token reads as connected", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/tiktok/config").set("Cookie", sessionCookie(freshLiveSession()));
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(clearsSessionCookie(res)).toBe(false);
  });

  test("expired token with a refresh token still reads as connected", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/tiktok/config").set("Cookie", sessionCookie(expiredWithRefresh));
    expect(res.body.connected).toBe(true);
    expect(clearsSessionCookie(res)).toBe(false);
  });

  test("expired token with no refresh reads as disconnected and the cookie is dropped", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/tiktok/config").set("Cookie", sessionCookie(expiredNoRefresh));
    // Was: `connected: true` — the UI showed an account that could not post.
    expect(res.body.connected).toBe(false);
    expect(clearsSessionCookie(res)).toBe(true);
  });

  test("no cookie at all reads as disconnected", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/tiktok/config");
    expect(res.body.connected).toBe(false);
  });

  test("never leaks the client secret", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/tiktok/config");
    expect(JSON.stringify(res.body)).not.toContain("test-secret");
  });
});

describe("/publish rejects input TikTok could only bounce", () => {
  test("non-https URL is refused with a reason, before any TikTok call", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "http://cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("video_url_must_be_https");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("unparseable URL is refused with a reason", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("video_url_malformed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("privacy level the creator is not allowed to use is refused", async () => {
    fetchMock.mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "PUBLIC_TO_EVERYONE" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("privacy_level_not_allowed");
    expect(res.body.allowed).toEqual(["SELF_ONLY"]);
    // creator_info was consulted; video/init was never reached.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(CREATOR_INFO_URL);
  });

  test("a dead session returns 401 and drops the cookie instead of sticking", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(expiredNoRefresh))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    expect(res.status).toBe(401);
    expect(clearsSessionCookie(res)).toBe(true);
  });
});

describe("creator_info is not fetched twice inside the rate-limit window", () => {
  test("a publish reuses the creator_info the page load already fetched", async () => {
    // TikTok allows 6 requests/min per token; page load + publish used to
    // spend two on creator_info alone, on top of video/init and the poll.
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"], creator_nickname: "n" }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-cached" }));
    const app = makeApp();
    const cookie = sessionCookie(freshLiveSession());

    const info = await request(app).get("/api/tiktok/creator-info").set("Cookie", cookie);
    expect(info.status).toBe(200);

    const pub = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", cookie)
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    expect(pub.status).toBe(200);

    // Exactly two upstream calls: one creator_info, one video/init.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter((c) => c[0] === CREATOR_INFO_URL)).toHaveLength(1);
  });

  test("a different account does not read the cached creator_info", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"], creator_nickname: "first" }))
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["PUBLIC_TO_EVERYONE"], creator_nickname: "second" }));
    const app = makeApp();

    const a = await request(app).get("/api/tiktok/creator-info").set("Cookie", sessionCookie(freshLiveSession()));
    const b = await request(app).get("/api/tiktok/creator-info").set("Cookie", sessionCookie(freshLiveSession()));

    expect(a.body.nickname).toBe("first");
    expect(b.body.nickname).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("commercial-content disclosure travels with the post", () => {
  test("branded content cannot be published privately", async () => {
    fetchMock.mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({
        videoUrl: "https://cdn.example/v.mp4",
        privacyLevel: "SELF_ONLY",
        brandContentToggle: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("branded_content_cannot_be_private");
    // Rejected before video/init — nothing was posted.
    expect(fetchMock.mock.calls.some((c) => c[0] === PUBLISH_INIT_URL)).toBe(false);
  });

  test("both disclosure flags reach TikTok as post_info toggles", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["PUBLIC_TO_EVERYONE"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-789" }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({
        videoUrl: "https://cdn.example/v.mp4",
        privacyLevel: "PUBLIC_TO_EVERYONE",
        brandOrganicToggle: true,
        brandContentToggle: true,
      });
    expect(res.status).toBe(200);
    const initCall = fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL);
    const body = JSON.parse(initCall![1].body);
    expect(body.post_info.brand_organic_toggle).toBe(true);
    expect(body.post_info.brand_content_toggle).toBe(true);
  });

  test("an undisclosed post sends both toggles as false, not undefined", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-000" }));
    const app = makeApp();
    await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    const initCall = fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL);
    const body = JSON.parse(initCall![1].body);
    expect(body.post_info.brand_organic_toggle).toBe(false);
    expect(body.post_info.brand_content_toggle).toBe(false);
    expect(body.post_info.is_aigc).toBe(false);
  });

  test("a chosen cover frame reaches TikTok; no choice omits the field", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-cover" }));
    const app = makeApp();
    await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY", coverTimestampMs: 3200 });
    let body = JSON.parse(fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL)![1].body);
    expect(body.post_info.video_cover_timestamp_ms).toBe(3200);

    fetchMock.mockClear();
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-nocover" }));
    await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    body = JSON.parse(fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL)![1].body);
    // Absent, not 0 — frame 0 is a legitimate choice and must stay distinct.
    expect("video_cover_timestamp_ms" in body.post_info).toBe(false);
  });

  test("frame 0 is a real choice and survives as 0", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-zero" }));
    const app = makeApp();
    await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY", coverTimestampMs: 0 });
    const body = JSON.parse(fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL)![1].body);
    expect(body.post_info.video_cover_timestamp_ms).toBe(0);
  });

  test("a nonsense cover timestamp is refused instead of silently dropped", async () => {
    const app = makeApp();
    for (const bad of [-1, 1.5, "abc", 2_147_483_648]) {
      const res = await request(app)
        .post("/api/tiktok/publish")
        .set("Cookie", sessionCookie(freshLiveSession()))
        .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY", coverTimestampMs: bad });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("cover_timestamp_invalid");
    }
  });

  test("AI-generated footage is labelled as such for TikTok", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-ai" }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY", isAigc: true });
    expect(res.status).toBe(200);
    const initCall = fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL);
    expect(JSON.parse(initCall![1].body).post_info.is_aigc).toBe(true);
  });

  test("branded content with a public level is allowed through", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["PUBLIC_TO_EVERYONE"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-ok" }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({
        videoUrl: "https://cdn.example/v.mp4",
        privacyLevel: "PUBLIC_TO_EVERYONE",
        brandContentToggle: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.publishId).toBe("pub-ok");
  });
});

describe("/publish only claims success when a post was really queued", () => {
  test("forwards the validated URL and returns the publish id", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] }))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-123" }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "  https://cdn.example/v.mp4  ", title: "hi", privacyLevel: "SELF_ONLY" });

    expect(res.status).toBe(200);
    expect(res.body.publishId).toBe("pub-123");

    const initCall = fetchMock.mock.calls.find((c) => c[0] === PUBLISH_INIT_URL);
    expect(initCall).toBeTruthy();
    const body = JSON.parse(initCall![1].body);
    expect(body.source_info).toEqual({ source: "PULL_FROM_URL", video_url: "https://cdn.example/v.mp4" });
    expect(body.post_info.privacy_level).toBe("SELF_ONLY");
  });

  test("an ok body with no publish_id is an error, not a success", async () => {
    fetchMock
      .mockResolvedValueOnce(tiktokOk({ privacy_level_options: ["SELF_ONLY"] }))
      .mockResolvedValueOnce(tiktokOk({}));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "SELF_ONLY" });
    // Was: 200 with publishId undefined — the UI printed "publish_id: undefined".
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("publish_no_id");
  });

  test("publishing still works when creator_info is unreachable (TikTok arbitrates)", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("creator_info down"))
      .mockResolvedValueOnce(tiktokOk({ publish_id: "pub-456" }));
    const app = makeApp();
    const res = await request(app)
      .post("/api/tiktok/publish")
      .set("Cookie", sessionCookie(freshLiveSession()))
      .send({ videoUrl: "https://cdn.example/v.mp4", privacyLevel: "PUBLIC_TO_EVERYONE" });
    expect(res.status).toBe(200);
    expect(res.body.publishId).toBe("pub-456");
  });
});
