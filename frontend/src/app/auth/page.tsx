"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";

import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadToken = () => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (raw) setToken(raw);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadToken();
  }, []);

  const signIn = async () => {
    setErr(null);
    setMe(null);
    setBusy(true);
    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("email и password обязательны");
      }

      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Ошибка login");
      }

      const nextToken = data.token as string;
      setToken(nextToken);
      try {
        localStorage.setItem(TOKEN_KEY, nextToken);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка login");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setErr(null);
    setMe(null);
    setBusy(true);
    try {
      if (!name.trim() || !email.trim() || !password.trim()) {
        throw new Error("name, email и password обязательны");
      }

      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Ошибка register");
      }

      const nextToken = data.token as string;
      setToken(nextToken);
      try {
        localStorage.setItem(TOKEN_KEY, nextToken);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка register");
    } finally {
      setBusy(false);
    }
  };

  const fetchMe = async () => {
    setErr(null);
    setBusy(true);
    try {
      const t = token || localStorage.getItem(TOKEN_KEY) || "";
      if (!t) throw new Error("Сначала выполните login/register");

      const res = await fetch(apiUrl("/api/auth/me"), {
        method: "GET",
        headers: { Authorization: `Bearer ${t}` },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Ошибка /me");
      }

      setMe(data);
    } catch (e: any) {
      setErr(e?.message || "Ошибка /me");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <ProductPageShell maxWidth={980}>
      <Wave1Nav />
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Auth</h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        MVP: регистрация, логин, JWT, роли `USER/ADMIN`.
      </div>

      {token ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(10,160,80,0.35)",
            background: "rgba(10,160,80,0.06)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <b>Сессия активна.</b> Дальше по конвейеру:{" "}
          <Link href="/qright" style={{ fontWeight: 700, color: "#064" }}>
            QRight
          </Link>
          {" → "}
          <Link href="/qsign" style={{ fontWeight: 700, color: "#064" }}>
            QSign
          </Link>
          {" → "}
          <Link href="/bureau" style={{ fontWeight: 700, color: "#064" }}>
            Bureau
          </Link>
          {" · "}
          <Link href="/planet" style={{ fontWeight: 700, color: "#064" }}>
            Planet
          </Link>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => setMode("login")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: mode === "login" ? "#111" : "#fff",
            color: mode === "login" ? "#fff" : "#111",
            cursor: "pointer",
            fontWeight: 700,
          }}
          disabled={busy}
        >
          Login
        </button>
        <button
          onClick={() => setMode("register")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: mode === "register" ? "#111" : "#fff",
            color: mode === "register" ? "#fff" : "#111",
            cursor: "pointer",
            fontWeight: 700,
          }}
          disabled={busy}
        >
          Register
        </button>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        {mode === "register" ? (
          <div style={{ gridColumn: "1 / span 2" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
              disabled={busy}
            />
          </div>
        ) : null}

        <div style={{ gridColumn: "1 / span 2" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
            disabled={busy}
          />
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="min 6 chars"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
            disabled={busy}
          />
        </div>

        <div style={{ gridColumn: "1 / span 2", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {mode === "login" ? (
            <button
              onClick={signIn}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: busy ? "default" : "pointer",
                fontWeight: 800,
              }}
            >
              Login
            </button>
          ) : (
            <button
              onClick={register}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: busy ? "default" : "pointer",
                fontWeight: 800,
              }}
            >
              Register
            </button>
          )}

          <button
            onClick={fetchMe}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #0a5",
              background: "#0a5",
              color: "#fff",
              cursor: busy ? "default" : "pointer",
              fontWeight: 800,
            }}
          >
            Check token (/me)
          </button>
        </div>
      </div>

      {err ? <div style={{ marginTop: 12, color: "crimson" }}>{err}</div> : null}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>JWT token</div>
        <textarea
          readOnly
          value={token}
          rows={4}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
          }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>/me result</div>
        <pre
          style={{
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 12,
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {me ? JSON.stringify(me, null, 2) : "—"}
        </pre>
      </div>
      </ProductPageShell>
    </main>
  );
}

