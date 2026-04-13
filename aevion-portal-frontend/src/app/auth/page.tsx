
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type Me = { id: string; email: string; createdAt: string };

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadMe = async (t: string) => {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Не удалось загрузить пользователя");
    return data as Me;
  };

  useEffect(() => {
    try {
      const t = localStorage.getItem("aevion_token") || "";
      if (!t) return;
      setToken(t);
      loadMe(t).then((u) => setMe(u)).catch(() => { localStorage.removeItem("aevion_token"); setToken(""); setMe(null); });
    } catch {}
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (!email.trim() || !password) { setErr("Email и пароль обязательны"); return; }
      if (mode === "register") {
        const regRes = await fetch(`${API_BASE}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const regData = await regRes.json().catch(() => null);
        if (!regRes.ok) throw new Error(regData?.error || "Ошибка регистрации");
        setSuccess("Аккаунт создан! Выполняется вход...");
      }
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const loginData = await loginRes.json().catch(() => null);
      if (!loginRes.ok) throw new Error(loginData?.error || "Ошибка входа");
      const t = loginData.token as string;
      localStorage.setItem("aevion_token", t);
      setToken(t);
      const u = await loadMe(t);
      setMe(u);
      setSuccess("Добро пожаловать в AEVION!");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    try { localStorage.removeItem("aevion_token"); } catch {}
    setToken("");
    setMe(null);
    setSuccess(null);
  };

  if (me) {
    return (
      <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0f4ff 0%, #e8ecf8 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "40px 48px", maxWidth: 440, width: "100%", boxShadow: "0 4px 24px rgba(79,70,229,0.08)", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32, color: "#fff" }}>
            {me.email[0].toUpperCase()}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{me.email}</h2>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
            Участник с {new Date(me.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
            <Link href="/qcore" style={{ padding: "12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#4f46e5", fontWeight: 600, fontSize: 13 }}>
              🧠 QCoreAI
            </Link>
            <Link href="/qright" style={{ padding: "12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#16a34a", fontWeight: 600, fontSize: 13 }}>
              📜 QRight
            </Link>
            <Link href="/qtrade" style={{ padding: "12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#0d9488", fontWeight: 600, fontSize: 13 }}>
              💱 QTrade
            </Link>
            <Link href="/" style={{ padding: "12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#7c3aed", fontWeight: 600, fontSize: 13 }}>
              🌍 Globus
            </Link>
          </div>

          <button onClick={logout} style={{
            width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0",
            background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>
            Выйти из аккаунта
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0f4ff 0%, #e8ecf8 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 48px", maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(79,70,229,0.08)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24, color: "#fff" }}>
            🔐
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
            {mode === "login" ? "Вход в AEVION" : "Регистрация"}
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>
            {mode === "login" ? "Войдите чтобы получить доступ к платформе" : "Создайте аккаунт для начала работы"}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
          <button onClick={() => { setMode("login"); setErr(null); }} style={{
            flex: 1, padding: "10px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: mode === "login" ? "#fff" : "transparent",
            color: mode === "login" ? "#4f46e5" : "#94a3b8",
            boxShadow: mode === "login" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
          }}>
            Вход
          </button>
          <button onClick={() => { setMode("register"); setErr(null); }} style={{
            flex: 1, padding: "10px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: mode === "register" ? "#fff" : "transparent",
            color: mode === "register" ? "#4f46e5" : "#94a3b8",
            boxShadow: mode === "register" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
          }}>
            Регистрация
          </button>
        </div>

        {err && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
            {err}
          </div>
        )}
        {success && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 13, marginBottom: 16 }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" type="email"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
              onFocus={(e) => e.target.style.borderColor = "#4f46e5"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
              onFocus={(e) => e.target.style.borderColor = "#4f46e5"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            padding: "13px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer",
            background: loading ? "#a5b4fc" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
            color: "#fff", transition: "all 0.2s", marginTop: 4,
          }}>
            {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#94a3b8", marginTop: 20 }}>
          {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
          <span onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(null); }}
            style={{ color: "#4f46e5", cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Зарегистрироваться" : "Войти"}
          </span>
        </p>
      </div>
    </div>
  );
}