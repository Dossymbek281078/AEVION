"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type UserData = { id: string; email: string; name: string; role: string; createdAt?: string };
type Certificate = { id: string; title: string; kind: string; protectedAt: string; verifyUrl: string };

export default function AuthPage() {
  const { showToast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<UserData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Post-login stats */
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [shieldCount, setShieldCount] = useState(0);

  /* ── Load token on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (raw) setToken(raw);
    } catch {}
  }, []);

  /* ── Fetch user info when token changes ── */
  useEffect(() => {
    if (!token) { setUser(null); return; }
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.user) setUser(data.user);
        else { setToken(""); try { localStorage.removeItem(TOKEN_KEY); } catch {} }
      } catch {}
    })();
  }, [token]);

  /* ── Load user's data after login ── */
  const loadUserData = useCallback(async () => {
    try {
      const [certRes, shieldRes] = await Promise.all([
        fetch(apiUrl("/api/pipeline/certificates")).then(r => r.ok ? r.json() : { certificates: [] }).catch(() => ({ certificates: [] })),
        fetch(apiUrl("/api/quantum-shield/stats")).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      ]);
      setCertificates(certRes.certificates || []);
      setShieldCount((shieldRes as any).totalRecords || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) loadUserData();
  }, [user, loadUserData]);

  /* ── Auth actions ── */
  const handleAuth = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "register" && !name.trim()) throw new Error("Name is required");
      if (!email.trim()) throw new Error("Email is required");
      if (!password.trim() || password.length < 6) throw new Error("Password must be at least 6 characters");

      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register"
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `${mode} failed`);

      const nextToken = data.token as string;
      setToken(nextToken);
      try { localStorage.setItem(TOKEN_KEY, nextToken); } catch {}
      setUser(data.user);
      setPassword("");
      showToast(mode === "register" ? "Account created! Welcome to AEVION" : "Signed in successfully", "success");
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setToken("");
    setUser(null);
    setCertificates([]);
    setShieldCount(0);
    showToast("Signed out", "success");
  };

  const inp = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", fontSize: 15, outline: "none", boxSizing: "border-box" as const };

  const KIND_ICONS: Record<string, string> = { music: "🎵", code: "💻", design: "🎨", text: "📝", video: "🎬", idea: "💡", other: "📦" };

  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <Wave1Nav />

        {/* ── Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)", padding: "28px 28px 22px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                  {user ? `Welcome, ${user.name}` : "AEVION Identity"}
                </h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                  {user ? "Your account dashboard" : "One account for the entire ecosystem"}
                </p>
              </div>
            </div>
            {!user && (
              <p style={{ margin: 0, fontSize: 14, opacity: 0.75, lineHeight: 1.6, maxWidth: 560 }}>
                Create an account to protect your intellectual property, manage certificates, use AEVION Bank, and access all 29 ecosystem modules.
              </p>
            )}
          </div>
        </div>

        {/* ══ LOGGED IN — Dashboard ══ */}
        {user && (
          <div>
            {/* User card */}
            <div style={{ padding: "20px 24px", borderRadius: 16, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.04)", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>{user.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{user.email} · {user.role}</div>
                  {user.createdAt && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Member since {new Date(user.createdAt).toLocaleDateString()}</div>}
                </div>
                <button onClick={logout} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Sign out
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div style={{ padding: "16px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0d9488" }}>{certificates.length}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 4 }}>IP Certificates</div>
              </div>
              <div style={{ padding: "16px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#8b5cf6" }}>{shieldCount}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 4 }}>Quantum Shields</div>
              </div>
              <div style={{ padding: "16px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#3b82f6" }}>{user.role}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 4 }}>Account Role</div>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
              {[
                { icon: "🛡️", title: "Protect New Work", desc: "One-click IP protection", href: "/qright", color: "#0d9488" },
                { icon: "⚖️", title: "IP Bureau", desc: "View certificates & registry", href: "/bureau", color: "#3b82f6" },
                { icon: "🏦", title: "AEVION Bank", desc: "Wallets & transfers", href: "/bank", color: "#8b5cf6" },
                { icon: "🤖", title: "QCoreAI", desc: "AI assistant (5 models)", href: "/qcoreai", color: "#06b6d4" },
                { icon: "🔏", title: "QSign", desc: "Verify signatures", href: "/qsign", color: "#6366f1" },
                { icon: "🛡️", title: "Quantum Shield", desc: "Shield dashboard", href: "/quantum-shield", color: "#f59e0b" },
              ].map((a) => (
                <Link key={a.title} href={a.href} style={{ textDecoration: "none", color: "inherit", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", display: "block", transition: "box-shadow 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{a.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{a.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{a.desc}</div>
                </Link>
              ))}
            </div>

            {/* Recent certificates */}
            {certificates.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>Your Certificates ({certificates.length})</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {certificates.slice(0, 5).map((cert) => (
                    <div key={cert.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                      <span style={{ fontSize: 18 }}>{KIND_ICONS[cert.kind] || "📦"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{cert.title}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(cert.protectedAt).toLocaleDateString()}</div>
                      </div>
                      <Link href={`/verify/${cert.id}`} style={{ padding: "5px 12px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 11 }}>View</Link>
                      <a href={apiUrl(`/api/pipeline/certificate/${cert.id}/pdf`)} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 11 }}>PDF</a>
                    </div>
                  ))}
                </div>
                {certificates.length > 5 && (
                  <Link href="/bureau" style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>View all in Bureau →</Link>
                )}
              </div>
            )}

            {/* JWT token (dev) */}
            <details style={{ marginBottom: 24 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#94a3b8" }}>Developer: JWT Token</summary>
              <textarea readOnly value={token} rows={3} style={{ width: "100%", fontFamily: "monospace", fontSize: 10, padding: 10, borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", marginTop: 8, color: "#475569", background: "#f8fafc", boxSizing: "border-box" }} />
            </details>
          </div>
        )}

        {/* ══ NOT LOGGED IN — Auth Form ══ */}
        {!user && (
          <div style={{ padding: "28px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", marginBottom: 24 }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden", marginBottom: 24 }}>
              {(["register", "login"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setErr(null); }} disabled={busy} style={{
                  flex: 1, padding: "12px", border: "none",
                  background: mode === m ? "#0f172a" : "#fff",
                  color: mode === m ? "#fff" : "#64748b",
                  fontWeight: mode === m ? 800 : 600, fontSize: 14, cursor: "pointer",
                }}>
                  {m === "register" ? "Create Account" : "Sign In"}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gap: 16, maxWidth: 480 }}>
              {mode === "register" && (
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Full Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inp} disabled={busy} onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
                </div>
              )}
              <div>
                <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Email *</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" type="email" style={inp} disabled={busy} onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Password *</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Minimum 6 characters" style={inp} disabled={busy} onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
              </div>

              {err && (
                <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 13 }}>
                  {err}
                </div>
              )}

              <button onClick={handleAuth} disabled={busy} style={{
                padding: "14px 24px", borderRadius: 14, border: "none",
                background: busy ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #06b6d4)",
                color: "#fff", fontWeight: 900, fontSize: 16, cursor: busy ? "default" : "pointer",
                boxShadow: busy ? "none" : "0 4px 20px rgba(13,148,136,0.35)",
              }}>
                {busy ? "Please wait..." : mode === "register" ? "🚀 Create Account" : "🔑 Sign In"}
              </button>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
              {mode === "register" ? "Already have an account? " : "Don't have an account? "}
              <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setErr(null); }} style={{ background: "none", border: "none", color: "#0d9488", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                {mode === "register" ? "Sign in" : "Create one"}
              </button>
            </div>
          </div>
        )}

        {/* ── What you get ── */}
        <div style={{ padding: "20px 22px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 12 }}>What your AEVION account unlocks</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { icon: "🛡️", title: "IP Protection", desc: "One-click protection with SHA-256, Ed25519, and Shamir's Secret Sharing" },
              { icon: "📜", title: "PDF Certificates", desc: "Legal certificates with QR codes backed by Berne Convention" },
              { icon: "🏦", title: "Digital Banking", desc: "AEC wallets, P2P transfers, automatic royalty payments" },
              { icon: "🤖", title: "AI Assistant", desc: "5 AI providers — Claude, GPT-4, Gemini, DeepSeek, Grok" },
              { icon: "🔏", title: "Signature Verification", desc: "Verify any certificate's authenticity and integrity" },
              { icon: "🌍", title: "Global Legal Backing", desc: "Protected under 6 international copyright frameworks" },
            ].map((item) => (
              <div key={item.title} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.06)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>{item.title}</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}