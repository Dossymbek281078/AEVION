"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

// ─────────────────────────────────────────────────────────────────────────
// Inline UX helpers — Auth UX polish (frontend-only, no backend changes).
// ─────────────────────────────────────────────────────────────────────────

// Email validation: basic shape check (no overreach — backend is authoritative).
// Returns null when valid, or a user-facing reason string.
function checkEmail(raw: string): string | null {
  const e = raw.trim();
  if (!e) return null; // empty = neutral (not an error yet)
  // Must contain exactly one @, with non-empty local + domain, and a TLD.
  const at = e.indexOf("@");
  if (at < 1 || at !== e.lastIndexOf("@")) return "Email must contain a single @";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!local || local.length > 64) return "Local part must be 1–64 chars";
  if (!domain || !domain.includes(".")) return "Domain must contain a dot (e.g. .com)";
  const tld = domain.split(".").pop() || "";
  if (tld.length < 2) return "TLD must be at least 2 chars";
  if (/\s/.test(e)) return "Email cannot contain spaces";
  return null;
}

type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  hints: string[];
};

// Lightweight strength scorer: length + class diversity. Not a security
// claim (backend bcrypt + min-6 enforcement still applies), just user guidance.
function scorePassword(pw: string): PasswordStrength {
  const hints: string[] = [];
  if (pw.length < 6) hints.push("≥ 6 chars");
  if (pw.length < 12) hints.push("≥ 12 chars for stronger");
  if (!/[a-z]/.test(pw)) hints.push("lowercase letter");
  if (!/[A-Z]/.test(pw)) hints.push("uppercase letter");
  if (!/[0-9]/.test(pw)) hints.push("digit");
  if (!/[^A-Za-z0-9]/.test(pw)) hints.push("symbol");

  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;

  const map: Record<number, { label: string; color: string }> = {
    0: { label: "too short", color: "#94a3b8" },
    1: { label: "weak", color: "#dc2626" },
    2: { label: "fair", color: "#f59e0b" },
    3: { label: "good", color: "#0d9488" },
    4: { label: "strong", color: "#16a34a" },
  };
  return { score, label: map[score].label, color: map[score].color, hints };
}

// Best-effort JWT exp extraction. No verification (server is authoritative);
// purely for "Session ends in Xm" UX. Returns null on any parse failure.
function readJwtExp(jwt: string): number | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function" ? atob(padded) : "";
    if (!json) return null;
    const payload = JSON.parse(json);
    return typeof payload?.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function formatRemaining(ms: number): { text: string; tone: "ok" | "warn" | "expired" } {
  if (ms <= 0) return { text: "expired", tone: "expired" };
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  let text: string;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${mins}m`;
  else if (mins > 0) text = `${mins}m ${secs}s`;
  else text = `${secs}s`;
  const tone: "ok" | "warn" | "expired" = ms < 5 * 60 * 1000 ? "warn" : "ok";
  return { text, tone };
}

// OAuth providers — fetched once on mount from /api/auth/oauth/providers
// (see aevion-globus-backend/src/routes/authOauth.ts). Buttons disable when
// the provider isn't configured server-side, with a hint pointing at the
// env vars that need to be set.
type OAuthProvider = {
  id: "google" | "github";
  name: string;
  configured: boolean;
};

// Visual metadata for each provider. Adding a new provider is a 2-step
// thing: register it server-side in authOauth.ts → add it here.
const OAUTH_META: Record<string, { brand: string; gradient: string; envHint: string }> = {
  google: {
    brand: "G",
    gradient: "linear-gradient(135deg, #4285f4, #ea4335)",
    envHint: "GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET",
  },
  github: {
    brand: "GH",
    gradient: "linear-gradient(135deg, #1f2937, #6b7280)",
    envHint: "GITHUB_OAUTH_CLIENT_ID + GITHUB_OAUTH_CLIENT_SECRET",
  },
};

export default function AuthPage() {
  const { showToast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // For live "session ends in Xm" — ticks every second once token is set.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // OAuth provider list — null = not yet loaded, [] = backend has none.
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[] | null>(null);
  const [oauthLoadErr, setOauthLoadErr] = useState<string | null>(null);

  // Inline-validation: emailError = null means "empty or valid".
  const emailError = useMemo(() => checkEmail(email), [email]);
  const pwStrength = useMemo(() => scorePassword(password), [password]);
  // Block submit when fields fail client-side validation. Backend still
  // re-validates — this is purely UX (faster feedback, fewer 400s).
  const submitDisabled =
    busy ||
    !email.trim() ||
    !password.trim() ||
    !!emailError ||
    (mode === "register" && (!name.trim() || pwStrength.score < 1)) ||
    password.length < 6;

  // Session-expiry display: decode exp from JWT (UX only, not auth check).
  const exp = useMemo(() => readJwtExp(token), [token]);
  const remaining = exp ? formatRemaining(exp * 1000 - nowMs) : null;

  useEffect(() => {
    if (!token || !exp) return;
    // Tick once per second so the countdown stays live. Cleared on logout
    // / unmount. No-op if exp couldn't be decoded.
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [token, exp]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (raw) setToken(raw);
    } catch {}
  }, []);

  // Discover available OAuth providers on mount so the buttons reflect
  // server-side configuration (don't show "Continue with Google" when
  // GOOGLE_OAUTH_CLIENT_ID isn't set — that 503's noisily).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/oauth/providers"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { providers?: OAuthProvider[] };
        if (cancelled) return;
        setOauthProviders(Array.isArray(data?.providers) ? data.providers : []);
      } catch (e: any) {
        if (cancelled) return;
        // Non-fatal — email/password path still works. Show a quiet hint.
        setOauthLoadErr(e?.message || "could not load OAuth providers");
        setOauthProviders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data) setMe(data);
      } catch {}
    })();
  }, [token]);

  const signIn = async () => {
    setErr(null); setMe(null); setBusy(true);
    try {
      if (!email.trim() || !password.trim()) throw new Error("Email and password required");
      // Run inline validators before hitting backend — saves a round-trip
      // and gives the user the same feedback as the inline hint.
      const ee = checkEmail(email);
      if (ee) throw new Error(ee);
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Sign in error");
      const nextToken = data.token as string;
      setToken(nextToken);
      try { localStorage.setItem(TOKEN_KEY, nextToken); } catch {}
      showToast("Sign in выполнен", "success");
    } catch (e: any) {
      setErr(e?.message || "Error");
      showToast(e?.message || "Sign in error", "error");
    } finally { setBusy(false); }
  };

  const register = async () => {
    setErr(null); setMe(null); setBusy(true);
    try {
      if (!name.trim() || !email.trim() || !password.trim()) throw new Error("Name, email и пароль обязательны");
      // Mirror backend min-6 + run inline email validator.
      const ee = checkEmail(email);
      if (ee) throw new Error(ee);
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Registration error");
      const nextToken = data.token as string;
      setToken(nextToken);
      try { localStorage.setItem(TOKEN_KEY, nextToken); } catch {}
      showToast("Account created! Welcome to AEVION", "success");
    } catch (e: any) {
      setErr(e?.message || "Error");
      showToast(e?.message || "Registration error", "error");
    } finally { setBusy(false); }
  };

  const logout = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setToken(""); setMe(null);
    showToast("Signed out", "info");
  };

  // Kick off the OAuth dance. Server's /start endpoint will 302 to the
  // provider's authorize URL, which then 302's to our /callback and
  // finally lands the browser on /auth/success?token=…&provider=… (see
  // backend authOauth.ts). We use top-level navigation (not fetch) so the
  // cookie-based state check works.
  const startOauth = (providerId: "google" | "github") => {
    // Build URL via apiUrl so dev (Next rewrites) and prod (proxy) both
    // resolve correctly. The `/start` endpoint redirects, so window.location
    // is the right primitive — fetch would just see the 302.
    window.location.href = apiUrl(`/api/auth/oauth/${providerId}/start`);
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.15)",
    fontSize: 15,
    outline: "none",
  };

  return (
    <main>
      <ProductPageShell maxWidth={720}>
        <Wave1Nav />
        <PipelineSteps current="auth" />
        <div style={{ borderRadius: 20, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", padding: "28px 24px 20px", color: "#fff" }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              AEVION Identity
            </h1>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
              Single account for all ecosystem modules. Register or sign in to get a JWT token.
            </p>
          </div>
          <div style={{ padding: "24px 24px 28px" }}>
            {token && me?.user ? (
              <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46" }}>{me.user.name || me.user.email}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{me.user.email} · {me.user.role || "USER"}</div>
                    {remaining ? (
                      <div
                        title={exp ? `Token exp: ${new Date(exp * 1000).toLocaleString()}` : undefined}
                        style={{
                          marginTop: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 9px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          background:
                            remaining.tone === "expired"
                              ? "rgba(220,38,38,0.1)"
                              : remaining.tone === "warn"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(16,185,129,0.1)",
                          color:
                            remaining.tone === "expired"
                              ? "#991b1b"
                              : remaining.tone === "warn"
                              ? "#92400e"
                              : "#065f46",
                          border:
                            remaining.tone === "expired"
                              ? "1px solid rgba(220,38,38,0.3)"
                              : remaining.tone === "warn"
                              ? "1px solid rgba(245,158,11,0.35)"
                              : "1px solid rgba(16,185,129,0.3)",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
                        {remaining.tone === "expired"
                          ? "Session expired — sign in again"
                          : `Session ends in ${remaining.text}`}
                      </div>
                    ) : null}
                  </div>
                  <button onClick={logout} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Sign out
                  </button>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/qright" style={{ padding: "8px 14px", borderRadius: 10, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                    Create object in QRight →
                  </Link>
                  <Link href="/planet" style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #0f766e", color: "#0f766e", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                    🌍 Planet Lab
                  </Link>
                  <Link href="/account" style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                    ⚙ Account settings
                  </Link>
                </div>
              </div>
            ) : null}

            <div style={{ display: "inline-flex", borderRadius: 12, border: "1px solid rgba(15,23,42,0.12)", overflow: "hidden", marginBottom: 20 }}>
              {(["register", "login"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} disabled={busy} style={{ padding: "10px 20px", border: "none", background: mode === m ? "#0f172a" : "#fff", color: mode === m ? "#fff" : "#64748b", fontWeight: mode === m ? 800 : 600, fontSize: 14, cursor: "pointer" }}>
                  {m === "register" ? "Register" : "Sign in"}
                </button>
              ))}
            </div>

            {/* OAuth providers — only rendered when /providers returned at least one. */}
            {!token && oauthProviders && oauthProviders.length > 0 ? (
              <div style={{ maxWidth: 440, marginBottom: 20 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  {oauthProviders.map((p) => {
                    const meta = OAUTH_META[p.id];
                    if (!meta) return null;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => p.configured && startOauth(p.id)}
                        disabled={!p.configured || busy}
                        title={
                          p.configured
                            ? `Sign in with ${p.name}`
                            : `Provider not configured. Set ${meta.envHint} on the backend.`
                        }
                        aria-disabled={!p.configured}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          padding: "11px 16px",
                          borderRadius: 12,
                          border: p.configured
                            ? "1px solid rgba(15,23,42,0.18)"
                            : "1px dashed rgba(15,23,42,0.18)",
                          background: p.configured ? "#fff" : "rgba(15,23,42,0.03)",
                          color: p.configured ? "#0f172a" : "#94a3b8",
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: p.configured && !busy ? "pointer" : "not-allowed",
                          transition: "background 0.15s ease, transform 0.05s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (p.configured && !busy) {
                            e.currentTarget.style.background = "rgba(15,23,42,0.04)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (p.configured && !busy) {
                            e.currentTarget.style.background = "#fff";
                          }
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background: meta.gradient,
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: "-0.02em",
                            opacity: p.configured ? 1 : 0.45,
                          }}
                        >
                          {meta.brand}
                        </span>
                        <span>
                          {mode === "register" ? "Sign up with" : "Continue with"} {p.name}
                        </span>
                        {!p.configured ? (
                          <span
                            style={{
                              marginLeft: "auto",
                              padding: "2px 7px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              background: "rgba(245,158,11,0.12)",
                              color: "#b45309",
                              border: "1px solid rgba(245,158,11,0.3)",
                            }}
                          >
                            Not set up
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 16,
                    color: "#94a3b8",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.08)" }} />
                  <span>or with email</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.08)" }} />
                </div>
              </div>
            ) : null}

            {/* OAuth fetch failed — quiet inline notice, doesn't block email login. */}
            {!token && oauthLoadErr ? (
              <div
                style={{
                  maxWidth: 440,
                  marginBottom: 16,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  color: "#92400e",
                  fontSize: 12,
                }}
              >
                Couldn&apos;t load OAuth providers ({oauthLoadErr}). Email sign-in still works.
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 14, maxWidth: 440 }}>
              {mode === "register" ? (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "#334155" }}>Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} disabled={busy} />
                </div>
              ) : null}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "#334155" }}>Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  type="email"
                  style={{
                    ...inputStyle,
                    border: emailError
                      ? "1px solid rgba(220,38,38,0.45)"
                      : email && !emailError
                      ? "1px solid rgba(13,148,136,0.45)"
                      : inputStyle.border,
                  }}
                  disabled={busy}
                  aria-invalid={!!emailError}
                  aria-describedby="email-hint"
                />
                {emailError ? (
                  <div id="email-hint" style={{ marginTop: 6, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                    {emailError}
                  </div>
                ) : email && !emailError ? (
                  <div id="email-hint" style={{ marginTop: 6, fontSize: 12, color: "#0d9488", fontWeight: 600 }}>
                    ✓ Email looks good
                  </div>
                ) : null}
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "#334155" }}>Password</div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Minimum 6 characters" style={inputStyle} disabled={busy} />
                {password ? (
                  <div style={{ marginTop: 8 }}>
                    {/* Strength bar — 4 segments, fills left→right by score. */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      {[1, 2, 3, 4].map((seg) => (
                        <div
                          key={seg}
                          style={{
                            height: 4,
                            flex: 1,
                            borderRadius: 2,
                            background: seg <= pwStrength.score ? pwStrength.color : "rgba(15,23,42,0.08)",
                            transition: "background 0.18s ease",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                      <span style={{ color: pwStrength.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {pwStrength.label}
                      </span>
                      {pwStrength.hints.length > 0 && mode === "register" ? (
                        <span style={{ color: "#64748b", textAlign: "right" }}>
                          Add: {pwStrength.hints.slice(0, 2).join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <button onClick={mode === "login" ? signIn : register} disabled={submitDisabled} style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: submitDisabled ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #0ea5e9)", color: "#fff", cursor: submitDisabled ? "default" : "pointer", fontWeight: 900, fontSize: 15, boxShadow: submitDisabled ? "none" : "0 4px 14px rgba(13,148,136,0.35)" }}>
                {busy ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
              </button>
            </div>

            {err ? (
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.06)", color: "#991b1b", fontSize: 13 }}>
                {err}
              </div>
            ) : null}

            {token ? (
              <details style={{ marginTop: 20 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#64748b" }}>
                  JWT token (for developers)
                </summary>
                <textarea readOnly value={token} rows={3} style={{ width: "100%", fontFamily: "monospace", fontSize: 11, padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", marginTop: 8, color: "#475569", background: "#f8fafc" }} />
              </details>
            ) : null}
          </div>
        </div>

        {/* What you get */}
        <div style={{ marginTop: 20, padding: "18px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>What your AEVION identity unlocks</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {[
              { icon: "📝", title: "IP Registration", desc: "Register and protect your digital works with SHA-256 hash" },
              { icon: "🔐", title: "Cryptographic Signing", desc: "Sign documents with military-grade HMAC-SHA256" },
              { icon: "💰", title: "Digital Wallet", desc: "Earn AEC credits, receive royalties automatically" },
              { icon: "♟️", title: "Chess & Gaming", desc: "Play CyberChess, earn ratings and compete in tournaments" },
              { icon: "🏆", title: "Awards", desc: "Submit music and film to AEVION Awards, win prizes" },
              { icon: "📊", title: "Trust Score", desc: "Build your reputation across the entire ecosystem" },
            ].map((item) => (
              <div key={item.title} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
