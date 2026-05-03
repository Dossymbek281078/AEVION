// /api/auth/oauth/* — OAuth bridge for Google + GitHub.
//
// Implementation is dependency-free (no passport.js): the OAuth 2.0 dance
// is short enough that wiring it directly with fetch is simpler than a
// strategy plugin and avoids dragging in the express-session middleware
// that passport assumes.
//
// Flow per provider:
//   GET  /api/auth/oauth/:provider/start
//        302 → provider authorize URL with state cookie
//   GET  /api/auth/oauth/:provider/callback?code=...&state=...
//        verifies state, exchanges code for access token, fetches user
//        profile, upserts the row in AEVIONUser, issues the same JWT as
//        password login. 302 → ${OAUTH_SUCCESS_REDIRECT || /auth/success}
//        with ?token=<jwt> appended.
//
// Configuration (env vars, all optional — providers self-disable when
// client_id/secret are unset so prod can ship JWT-only until creds arrive):
//   GOOGLE_OAUTH_CLIENT_ID     — Google Cloud OAuth client id
//   GOOGLE_OAUTH_CLIENT_SECRET — matching secret
//   GITHUB_OAUTH_CLIENT_ID     — GitHub OAuth app client id
//   GITHUB_OAUTH_CLIENT_SECRET — matching secret
//   OAUTH_REDIRECT_BASE        — public origin where the callback lives,
//                                e.g. https://api.aevion.app. Falls back
//                                to req.protocol://req.get('host').
//   OAUTH_SUCCESS_REDIRECT     — frontend URL to send the user to with
//                                ?token=<jwt> on successful login. Falls
//                                back to /auth/success on the same host.
//
// The callback URL each provider needs to know is:
//   ${OAUTH_REDIRECT_BASE}/api/auth/oauth/:provider/callback
//
// Once creds + redirect URL are registered with Google / GitHub the
// surface is live. Frontends call /api/auth/oauth/google/start (or
// /github/start) to start the flow; on success the redirect lands the
// user on /auth/success?token=… which is the same JWT the email login
// path returns, so the frontend session model is unchanged.

import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { getJwtSecret } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";

export const authOauthRouter = Router();

const pool = getPool();

type Provider = {
  id: "google" | "github";
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  configured: boolean;
};

function getProviders(): Record<"google" | "github", Provider> {
  const googleId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || "";
  const googleSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "";
  const githubId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || "";
  const githubSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() || "";
  return {
    google: {
      id: "google",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
      clientId: googleId,
      clientSecret: googleSecret,
      configured: !!(googleId && googleSecret),
    },
    github: {
      id: "github",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scope: "read:user user:email",
      clientId: githubId,
      clientSecret: githubSecret,
      configured: !!(githubId && githubSecret),
    },
  };
}

function callbackUrl(req: { protocol: string; get: (h: string) => string | undefined }, providerId: string): string {
  const base = process.env.OAUTH_REDIRECT_BASE?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/api/auth/oauth/${providerId}/callback`;
  const host = req.get("host") || "localhost";
  return `${req.protocol}://${host}/api/auth/oauth/${providerId}/callback`;
}

function successRedirect(): string {
  return process.env.OAUTH_SUCCESS_REDIRECT?.trim() || "/auth/success";
}

const STATE_COOKIE = "aevion_oauth_state";

function setStateCookie(res: { setHeader: (k: string, v: string) => void }, value: string): void {
  // Lax keeps the cookie on the redirect back from the provider; Strict
  // would drop it because the callback navigation is initiated by an
  // external origin. HttpOnly + Secure (when behind HTTPS) prevent JS
  // and HTTP exfiltration.
  const parts = [
    `${STATE_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/api/auth/oauth",
    "Max-Age=600", // 10 min — flow should complete well within this
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function readStateCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const raw of cookieHeader.split(";")) {
    const [k, v] = raw.split("=").map((s) => s.trim());
    if (k === STATE_COOKIE && v) return decodeURIComponent(v);
  }
  return null;
}

// GET /api/auth/oauth/providers — surface which providers are configured
// so the frontend can show only working buttons.
authOauthRouter.get("/providers", (_req, res) => {
  const p = getProviders();
  res.json({
    providers: [
      { id: "google", name: "Google", configured: p.google.configured },
      { id: "github", name: "GitHub", configured: p.github.configured },
    ],
  });
});

// GET /api/auth/oauth/:provider/start
authOauthRouter.get("/:provider/start", (req, res) => {
  const id = req.params.provider as "google" | "github";
  const provider = getProviders()[id];
  if (!provider) {
    return res.status(404).json({ error: "unknown provider" });
  }
  if (!provider.configured) {
    return res.status(503).json({
      error: "provider not configured",
      hint:
        id === "google"
          ? "set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET"
          : "set GITHUB_OAUTH_CLIENT_ID + GITHUB_OAUTH_CLIENT_SECRET",
    });
  }
  const state = crypto.randomBytes(16).toString("hex");
  setStateCookie(res, state);
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: callbackUrl(req, id),
    response_type: "code",
    scope: provider.scope,
    state,
  });
  if (id === "google") {
    params.set("prompt", "select_account");
    params.set("access_type", "online");
  }
  return res.redirect(`${provider.authorizeUrl}?${params.toString()}`);
});

// GET /api/auth/oauth/:provider/callback?code=…&state=…
authOauthRouter.get("/:provider/callback", async (req, res) => {
  const id = req.params.provider as "google" | "github";
  const provider = getProviders()[id];
  if (!provider) return res.status(404).json({ error: "unknown provider" });
  if (!provider.configured) return res.status(503).json({ error: "provider not configured" });

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const cookieState = readStateCookie(req.headers.cookie);

  if (!code) return res.status(400).json({ error: "code missing" });
  if (!state || !cookieState || state !== cookieState) {
    return res.status(400).json({ error: "state mismatch — possible CSRF" });
  }

  try {
    // 1. Exchange code → access_token.
    const tokenBody = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: callbackUrl(req, id),
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody.toString(),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(502).json({
        error: "token exchange failed",
        details: tokenData.error_description || tokenData.error || `${tokenRes.status}`,
      });
    }

    // 2. Fetch user profile.
    const profileRes = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "aevion-oauth-bridge",
        Accept: "application/json",
      },
    });
    const profile = (await profileRes.json()) as Record<string, unknown>;
    if (!profileRes.ok) {
      return res.status(502).json({ error: "profile fetch failed", details: profile });
    }

    // GitHub may not return email in /user when the user keeps it private —
    // fall back to /user/emails which always includes the primary verified one.
    let email: string | null =
      typeof profile.email === "string" && profile.email ? (profile.email as string) : null;
    if (id === "github" && !email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "aevion-oauth-bridge",
          Accept: "application/json",
        },
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primary = emails.find((e) => e.primary && e.verified) || emails[0];
        if (primary?.email) email = primary.email;
      }
    }

    if (!email) {
      return res.status(400).json({
        error: "provider did not return an email — cannot link account",
      });
    }

    const name =
      (typeof profile.name === "string" && (profile.name as string)) ||
      (typeof profile.login === "string" && (profile.login as string)) ||
      email.split("@")[0];

    // 3. Upsert user, issue JWT.
    await ensureUsersTable(pool);

    const existing = await pool.query(
      `SELECT "id", "email", "name", "role" FROM "AEVIONUser" WHERE "email" = $1`,
      [email],
    );
    let user = existing.rows?.[0] as { id: string; email: string; name: string; role: string } | undefined;
    if (!user) {
      const adminAllowlist = (process.env.AEVION_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role = adminAllowlist.includes(email.toLowerCase()) ? "ADMIN" : "USER";
      const userId = crypto.randomUUID();
      // Store a bcrypt-hashed random secret so any future code path that
      // string-compares passwordHash can't be tricked. OAuth users sign in
      // via the provider; "forgot password" still works to enable email login.
      const placeholderHash = await bcrypt.hash(
        crypto.randomBytes(48).toString("base64"),
        10,
      );
      await pool.query(
        `INSERT INTO "AEVIONUser" ("id","email","passwordHash","name","role")
         VALUES ($1,$2,$3,$4,$5)`,
        [userId, email, placeholderHash, name, role],
      );
      user = { id: userId, email, name, role };
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: process.env.AUTH_JWT_EXPIRES_IN || "7d" },
    );

    const redirect = successRedirect();
    const sep = redirect.includes("?") ? "&" : "?";
    return res.redirect(`${redirect}${sep}token=${encodeURIComponent(token)}&provider=${id}`);
  } catch (err: any) {
    return res.status(500).json({
      error: "oauth callback failed",
      details: err?.message || String(err),
    });
  }
});
