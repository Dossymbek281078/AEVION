"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type OauthProvider = { id: string; name: string; configured: boolean };

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
  const [oauthProviders, setOauthProviders] = useState<OauthProvider[]>([]);

  // OAuth callback redirect lands here with ?token=…&provider=…
  // Persist + clean up URL so refresh doesn't re-process.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("token");
    const provider = sp.get("provider");
    if (t) {
      try {
        localStorage.setItem(TOKEN_KEY, t);
      } catch {}
      setToken(t);
      sp.delete("token");
      sp.delete("provider");
      const next = window.location.pathname + (sp.toString() ? `?${sp}` : "");
      window.history.replaceState(null, "", next);
      showToast(`Signed in via ${provider || "provider"}`, "success");
    }
  }, [showToast]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (raw) setToken(raw);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/auth/oauth/providers"), { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { providers?: OauthProvider[] };
        if (cancelled) return;
        const list = Array.isArray(data?.providers) ? data.providers.filter((p) => p.configured) : [];
        setOauthProviders(list);
      } catch {
        // backend offline — silently hide oauth buttons, password login still works
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

            {!token && oauthProviders.length > 0 ? (
              <div style={{ display: "grid", gap: 8, maxWidth: 440, marginBottom: 18 }}>
                {oauthProviders.map((p) => (
                  <a
                    key={p.id}
                    href={apiUrl(`/api/auth/oauth/${p.id}/start`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: "11px 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#fff",
                      color: "#0f172a",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{p.id === "google" ? "🔵" : p.id === "github" ? "⬛" : "🔑"}</span>
                    Continue with {p.name}
                  </a>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 -2px" }}>
                  <span style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.10)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8" }}>OR</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.10)" }} />
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

            <div style={{ display: "grid", gap: 14, maxWidth: 440 }}>
              {mode === "register" ? (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "#334155" }}>Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} disabled={busy} />
                </div>
              ) : null}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "#334155" }}>Email</div>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" type="email" style={inputStyle} disabled={busy} />
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "#334155" }}>Password</div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Minimum 6 characters" style={inputStyle} disabled={busy} />
              </div>
              <button onClick={mode === "login" ? signIn : register} disabled={busy} style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: busy ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #0ea5e9)", color: "#fff", cursor: busy ? "default" : "pointer", fontWeight: 900, fontSize: 15, boxShadow: busy ? "none" : "0 4px 14px rgba(13,148,136,0.35)" }}>
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

        <PitchValueCallout moduleId="auth" variant="dark" />

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
