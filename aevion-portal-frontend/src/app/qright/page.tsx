"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type QRightObject = { id: string; title: string; description: string; kind: string; contentHash: string; ownerName: string | null; ownerEmail: string | null; signature: string | null; createdAt: string };

function shortHash(hash: string) { if (!hash || hash.length <= 16) return hash || ""; return `${hash.slice(0, 10)}...${hash.slice(-6)}`; }

export default function QRightPage() {
  const [items, setItems] = useState<QRightObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "signed">("all");
  const [hasToken, setHasToken] = useState(false);
  const [copyBusyId, setCopyBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("idea");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(title.trim() && description.trim()), [title, description]);

  const getAuth = () => { try { const t = localStorage.getItem("aevion_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; } };

  const load = async (m: "all" | "signed") => {
    try { setLoading(true); setErr(null);
      const endpoint = m === "signed" ? `${API_BASE}/api/qright/objects/signed` : `${API_BASE}/api/qright/objects`;
      const res = await fetch(endpoint, { headers: getAuth() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Ошибка загрузки");
      setItems((data?.items || []) as QRightObject[]);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };

  useEffect(() => { try { const t = localStorage.getItem("aevion_token") || ""; setHasToken(Boolean(t)); } catch { setHasToken(false); } }, []);
  useEffect(() => { load(mode); }, [mode]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null); setSuccess(null);
    const res = await fetch(`${API_BASE}/api/qright/objects`, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuth() },
      body: JSON.stringify({ title, kind, description, ownerName: ownerName.trim() || null, ownerEmail: ownerEmail.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setErr(data?.error || data?.message || "Ошибка"); return; }
    setTitle(""); setDescription(""); setKind("idea"); setShowForm(false);
    setSuccess("Объект успешно зарегистрирован!");
    setTimeout(() => setSuccess(null), 3000);
    await load(mode);
  };

  const signObject = async (id: string) => {
    setErr(null); setSigningId(id);
    try {
      const token = localStorage.getItem("aevion_token") || "";
      if (!token) { setErr("Нужно войти (Auth) чтобы подписать"); return; }
      const res = await fetch(`${API_BASE}/api/qright/objects/${id}/sign`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setErr(data?.error || "Ошибка подписания"); return; }
      await load(mode);
    } catch (e: any) { setErr(e?.message || "Ошибка"); } finally { setSigningId(null); }
  };

  const copyText = async (key: string, text: string) => {
    if (!text) return;
    setCopyBusyId(key);
    try { await navigator.clipboard.writeText(text); } catch {} finally { setCopyBusyId(null); }
  };

  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" as const, transition: "border 0.2s" };

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0f4ff 0%, #e8ecf8 100%)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#16a34a", marginBottom: 4 }}>📜 QRight</h1>
            <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Электронная регистрация и реестр авторских прав</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: showForm ? "#e2e8f0" : "linear-gradient(135deg, #16a34a, #15803d)", color: showForm ? "#475569" : "#fff",
          }}>
            {showForm ? "Отмена" : "+ Новый объект"}
          </button>
        </div>

        {!hasToken && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 14, marginBottom: 20 }}>
            Чтобы подписывать объекты — <Link href="/auth" style={{ color: "#16a34a", fontWeight: 600 }}>войдите в Auth</Link>
          </div>
        )}

        {err && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>{err}</div>}
        {success && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 14, marginBottom: 20 }}>{success}</div>}

        {/* Form */}
        {showForm && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: 24, border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Создать объект</h2>
            <form onSubmit={create} style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Название *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название объекта" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Тип</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, background: "#fff" }}>
                    <option value="idea">Идея</option>
                    <option value="invention">Изобретение</option>
                    <option value="music">Музыка</option>
                    <option value="film">Фильм</option>
                    <option value="code">Код</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Описание *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Подробное описание объекта" rows={5} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Автор (опционально)</label>
                  <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Имя автора" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Email автора (опционально)</label>
                  <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="email@example.com" style={inputStyle} />
                </div>
              </div>
              <button type="submit" disabled={!canSubmit} style={{
                padding: "13px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600, cursor: canSubmit ? "pointer" : "default", width: 240,
                background: canSubmit ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0", color: canSubmit ? "#fff" : "#94a3b8",
              }}>
                Зарегистрировать
              </button>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "#fff", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0", width: "fit-content" }}>
          <button onClick={() => setMode("all")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: mode === "all" ? "#16a34a" : "transparent", color: mode === "all" ? "#fff" : "#64748b" }}>
            Все ({items.length})
          </button>
          <button onClick={() => setMode("signed")} style={{ padding: "8px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: mode === "signed" ? "#16a34a" : "transparent", color: mode === "signed" ? "#fff" : "#64748b" }}>
            Подписанные
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p>Пока нет зарегистрированных объектов</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <div key={it.id} style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>{it.title}</h3>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, background: "#f0fdf4", color: "#16a34a", fontSize: 12, fontWeight: 600 }}>{it.kind}</span>
                      {it.signature && <span style={{ padding: "3px 10px", borderRadius: 20, background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600 }}>✓ Подписан</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(it.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>

                <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "10px 0", whiteSpace: "pre-wrap" }}>{it.description}</p>

                {(it.ownerName || it.ownerEmail) && (
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                    {it.ownerName && <span>Автор: <b>{it.ownerName}</b></span>}
                    {it.ownerName && it.ownerEmail && <span> · </span>}
                    {it.ownerEmail && <span>{it.ownerEmail}</span>}
                  </div>
                )}

                <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f8fafc", fontSize: 12, color: "#64748b", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span>Hash: <code style={{ color: "#1e293b" }}>{shortHash(it.contentHash)}</code></span>
                  <button onClick={() => copyText(`${it.id}:hash`, it.contentHash)} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, cursor: "pointer", color: "#64748b" }}>
                    {copyBusyId === `${it.id}:hash` ? "✓" : "Copy"}
                  </button>
                  {it.signature && (
                    <>
                      <span style={{ marginLeft: 8 }}>Sig: <code style={{ color: "#2563eb" }}>{shortHash(it.signature)}</code></span>
                      <button onClick={() => copyText(`${it.id}:sig`, it.signature || "")} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, cursor: "pointer", color: "#64748b" }}>
                        {copyBusyId === `${it.id}:sig` ? "✓" : "Copy"}
                      </button>
                    </>
                  )}
                </div>

                {!it.signature && (
                  <button onClick={() => signObject(it.id)} disabled={signingId === it.id} style={{
                    marginTop: 12, padding: "10px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff",
                  }}>
                    {signingId === it.id ? "Подписываем..." : "Подписать"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

