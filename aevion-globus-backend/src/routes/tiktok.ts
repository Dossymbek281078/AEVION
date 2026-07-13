// /api/tiktok/* — TikTok Login Kit + Content Posting API bridge.
//
// Dependency-free (no SDK): the OAuth 2.0 + PKCE dance and the publish
// calls are short enough to wire directly with fetch, matching the style
// of routes/authOauth.ts.
//
// Why this route exists
// ---------------------
// TikTok's Content Posting API audit requires a first-party publishing UI
// that (a) authenticates the creator through TikTok's own OAuth screen and
// (b) displays the creator's real nickname + avatar and the privacy levels
// TikTok itself reports as allowed, sourced from creator_info/query — not
// hard-coded. This backend supplies exactly that surface so the frontend
// /tiktok-publisher page can be a compliant Publisher UI, and so posting no
// longer needs the local PowerShell tool.
//
// Flow
// ----
//   GET  /api/tiktok/config
//        { configured, clientKey, scopes, redirectUri, connected }
//   GET  /api/tiktok/auth/start
//        302 -> TikTok authorize URL. Sets short-lived state + PKCE
//        verifier cookies.
//   GET  /api/tiktok/auth/callback?code&state
//        verifies state, exchanges code (+ code_verifier) for tokens,
//        stores them in an httpOnly session cookie, 302 -> FRONTEND
//        /tiktok-publisher?connected=1
//   GET  /api/tiktok/creator-info
//        proxies creator_info/query -> { nickname, avatarUrl, username,
//        privacyOptions, maxDurationSec, ...toggles } (the audit-required
//        creator display data)
//   POST /api/tiktok/publish  { videoUrl, title, privacyLevel, ...toggles }
//        proxies video/init (PULL_FROM_URL) -> { publishId }
//   GET  /api/tiktok/publish/status?publishId
//        proxies publish/status/fetch -> { status, ...}
//   POST /api/tiktok/logout    clears the session cookie
//
// Configuration (env vars — route self-disables when key/secret are unset,
// so prod ships inert until creds arrive):
//   TIKTOK_CLIENT_KEY     — TikTok app client key
//   TIKTOK_CLIENT_SECRET  — matching secret
//   TIKTOK_REDIRECT_URI   — must EXACTLY match a redirect URI registered in
//                           the TikTok app, e.g.
//                           https://aevion.vercel.app/api-backend/api/tiktok/auth/callback
//   TIKTOK_SCOPES         — optional, default "user.info.basic,video.publish"
//   TIKTOK_SUCCESS_REDIRECT — optional frontend path to return to,
//                           default "/tiktok-publisher"
//
// The token cookie holds the bearer itself, so it is HttpOnly + Secure and
// scoped Path=/ (robust across the Vercel /api-backend proxy prefix).

import { Router } from "express";
import crypto from "node:crypto";
import { makeServiceCapture } from "../lib/sentry/platform";

const capture = makeServiceCapture("tiktok");

export const tiktokRouter = Router();

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const PUBLISH_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const PUBLISH_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const STATE_COOKIE = "tt_oauth_state";
const VERIFIER_COOKIE = "tt_oauth_verifier";
const SESSION_COOKIE = "tt_sess";

type TikTokConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  successRedirect: string;
  configured: boolean;
};

function getConfig(): TikTokConfig {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() || "";
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || "";
  const scopes = process.env.TIKTOK_SCOPES?.trim() || "user.info.basic,video.publish";
  const successRedirect = process.env.TIKTOK_SUCCESS_REDIRECT?.trim() || "/tiktok-publisher";
  return {
    clientKey,
    clientSecret,
    redirectUri,
    scopes,
    successRedirect,
    configured: !!(clientKey && clientSecret && redirectUri),
  };
}

const isProd = () => process.env.NODE_ENV === "production";

function setCookie(res: any, name: string, value: string, maxAgeSec: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSec}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd()) parts.push("Secure");
  appendSetCookie(res, parts.join("; "));
}

function clearCookie(res: any, name: string) {
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (isProd()) parts.push("Secure");
  appendSetCookie(res, parts.join("; "));
}

function appendSetCookie(res: any, cookie: string) {
  if (typeof res.appendHeader === "function") {
    res.appendHeader("Set-Cookie", cookie);
  } else {
    const existing = res.getHeader?.("Set-Cookie");
    if (Array.isArray(existing)) res.setHeader("Set-Cookie", [...existing, cookie]);
    else if (typeof existing === "string") res.setHeader("Set-Cookie", [existing, cookie]);
    else res.setHeader("Set-Cookie", cookie);
  }
}

function readCookie(req: any, name: string): string | null {
  const raw = req.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;
  for (const pair of raw.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return null;
}

type Session = {
  access_token: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_at: number; // epoch seconds
};

function readSession(req: any): Session | null {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s?.access_token) return null;
    return s;
  } catch {
    return null;
  }
}

function writeSession(res: any, s: Session) {
  // Refresh token lives 365d; keep the cookie 30d and re-issue on refresh.
  setCookie(res, SESSION_COOKIE, JSON.stringify(s), 30 * 24 * 3600);
}

function pkce() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function exchangeCode(
  cfg: TikTokConfig,
  code: string,
  verifier: string,
): Promise<Session> {
  const body = new URLSearchParams({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    throw new Error(`token exchange failed: ${j.error || r.status} ${j.error_description || ""}`.trim());
  }
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    open_id: j.open_id,
    scope: j.scope,
    expires_at: Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 86400) - 60,
  };
}

async function refreshToken(cfg: TikTokConfig, s: Session): Promise<Session> {
  if (!s.refresh_token) throw new Error("no refresh token");
  const body = new URLSearchParams({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
    refresh_token: s.refresh_token,
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`refresh failed: ${j.error || r.status}`);
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token || s.refresh_token,
    open_id: j.open_id || s.open_id,
    scope: j.scope || s.scope,
    expires_at: Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 86400) - 60,
  };
}

// Returns a valid access token, refreshing + re-issuing the cookie if needed.
async function ensureToken(cfg: TikTokConfig, req: any, res: any): Promise<Session | null> {
  let s = readSession(req);
  if (!s) return null;
  if (s.expires_at > Math.floor(Date.now() / 1000)) return s;
  try {
    s = await refreshToken(cfg, s);
    writeSession(res, s);
    return s;
  } catch (e) {
    capture(e, { where: "ensureToken.refresh" });
    return null;
  }
}

// GET /api/tiktok/config — public, tells the frontend whether it can start.
tiktokRouter.get("/config", (req, res) => {
  const cfg = getConfig();
  res.json({
    configured: cfg.configured,
    clientKey: cfg.configured ? cfg.clientKey : "",
    scopes: cfg.scopes,
    redirectUri: cfg.redirectUri,
    connected: !!readSession(req),
  });
});

// GET /api/tiktok/auth/start — 302 to TikTok authorize with PKCE.
tiktokRouter.get("/auth/start", (req, res) => {
  const cfg = getConfig();
  if (!cfg.configured) {
    return res
      .status(503)
      .json({ error: "tiktok_not_configured", message: "TIKTOK_CLIENT_KEY / SECRET / REDIRECT_URI not set" });
  }
  const state = crypto.randomBytes(16).toString("hex");
  const { verifier, challenge } = pkce();
  setCookie(res, STATE_COOKIE, state, 600);
  setCookie(res, VERIFIER_COOKIE, verifier, 600);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", cfg.clientKey);
  url.searchParams.set("scope", cfg.scopes);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  res.redirect(url.toString());
});

// GET /api/tiktok/auth/callback — exchange code, store session, back to UI.
tiktokRouter.get("/auth/callback", async (req, res) => {
  const cfg = getConfig();
  const backTo = (p: string) => {
    // successRedirect is a frontend path; send the browser there.
    const base = process.env.TIKTOK_FRONTEND_ORIGIN?.trim() || "";
    return `${base}${cfg.successRedirect}${p}`;
  };
  try {
    if (!cfg.configured) return res.status(503).send("TikTok not configured");
    const { code, state, error, error_description } = req.query as Record<string, string>;
    if (error) return res.redirect(backTo(`?error=${encodeURIComponent(error_description || error)}`));
    const expected = readCookie(req, STATE_COOKIE);
    const verifier = readCookie(req, VERIFIER_COOKIE);
    if (!code || !state || !expected || state !== expected || !verifier) {
      return res.redirect(backTo(`?error=${encodeURIComponent("state_or_code_invalid")}`));
    }
    const session = await exchangeCode(cfg, code, verifier);
    writeSession(res, session);
    clearCookie(res, STATE_COOKIE);
    clearCookie(res, VERIFIER_COOKIE);
    res.redirect(backTo("?connected=1"));
  } catch (e: any) {
    capture(e, { where: "auth/callback" });
    res.redirect(backTo(`?error=${encodeURIComponent(e?.message || "callback_failed")}`));
  }
});

// GET /api/tiktok/userinfo — basic profile chip (open_id, name, avatar).
tiktokRouter.get("/userinfo", async (req, res) => {
  const cfg = getConfig();
  const s = await ensureToken(cfg, req, res);
  if (!s) return res.status(401).json({ error: "not_connected" });
  try {
    const url = new URL(USERINFO_URL);
    url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${s.access_token}` } });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error?.code !== "ok") {
      return res.status(502).json({ error: "userinfo_failed", detail: j.error || r.status });
    }
    const u = j.data?.user || {};
    res.json({ openId: u.open_id, displayName: u.display_name, avatarUrl: u.avatar_url });
  } catch (e: any) {
    capture(e, { where: "userinfo" });
    res.status(502).json({ error: "userinfo_error", message: e?.message });
  }
});

// GET /api/tiktok/creator-info — audit-required creator display data.
tiktokRouter.get("/creator-info", async (req, res) => {
  const cfg = getConfig();
  const s = await ensureToken(cfg, req, res);
  if (!s) return res.status(401).json({ error: "not_connected" });
  try {
    const r = await fetch(CREATOR_INFO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error?.code !== "ok") {
      return res.status(502).json({ error: "creator_info_failed", detail: j.error || r.status });
    }
    const d = j.data || {};
    res.json({
      nickname: d.creator_nickname,
      username: d.creator_username,
      avatarUrl: d.creator_avatar_url,
      privacyOptions: d.privacy_level_options || [],
      commentDisabled: !!d.comment_disabled,
      duetDisabled: !!d.duet_disabled,
      stitchDisabled: !!d.stitch_disabled,
      maxDurationSec: d.max_video_post_duration_sec,
    });
  } catch (e: any) {
    capture(e, { where: "creator-info" });
    res.status(502).json({ error: "creator_info_error", message: e?.message });
  }
});

// POST /api/tiktok/publish — direct post from a public video URL.
tiktokRouter.post("/publish", async (req, res) => {
  const cfg = getConfig();
  const s = await ensureToken(cfg, req, res);
  if (!s) return res.status(401).json({ error: "not_connected" });
  const {
    videoUrl,
    title = "",
    privacyLevel,
    disableComment = false,
    disableDuet = false,
    disableStitch = false,
  } = (req.body || {}) as Record<string, any>;
  if (!videoUrl || typeof videoUrl !== "string") {
    return res.status(400).json({ error: "video_url_required" });
  }
  if (!privacyLevel || typeof privacyLevel !== "string") {
    return res.status(400).json({ error: "privacy_level_required" });
  }
  try {
    const r = await fetch(PUBLISH_INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: String(title).slice(0, 2200),
          privacy_level: privacyLevel,
          disable_comment: !!disableComment,
          disable_duet: !!disableDuet,
          disable_stitch: !!disableStitch,
        },
        source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error?.code !== "ok") {
      // Surface TikTok's own message so the UI can explain (e.g. url
      // ownership unverified, or SELF_ONLY-only until the app is audited).
      return res.status(502).json({ error: "publish_failed", detail: j.error || { code: r.status } });
    }
    res.json({ publishId: j.data?.publish_id });
  } catch (e: any) {
    capture(e, { where: "publish" });
    res.status(502).json({ error: "publish_error", message: e?.message });
  }
});

// GET /api/tiktok/publish/status?publishId=... — poll post processing.
tiktokRouter.get("/publish/status", async (req, res) => {
  const cfg = getConfig();
  const s = await ensureToken(cfg, req, res);
  if (!s) return res.status(401).json({ error: "not_connected" });
  const publishId = (req.query.publishId as string) || "";
  if (!publishId) return res.status(400).json({ error: "publish_id_required" });
  try {
    const r = await fetch(PUBLISH_STATUS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error?.code !== "ok") {
      return res.status(502).json({ error: "status_failed", detail: j.error || r.status });
    }
    res.json({ status: j.data?.status, failReason: j.data?.fail_reason, publiclyAvailablePostId: j.data?.publicaly_available_post_id });
  } catch (e: any) {
    capture(e, { where: "publish/status" });
    res.status(502).json({ error: "status_error", message: e?.message });
  }
});

// POST /api/tiktok/logout — drop the session cookie.
tiktokRouter.post("/logout", (_req, res) => {
  clearCookie(res, SESSION_COOKIE);
  res.json({ ok: true });
});
