
"use client";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type MediaItem = { id: string; type: string; title: string; description: string; fileUrl: string; mimeType: string; createdAt: string; votesCount: number; avgRating: number };

export default function AiMusicPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [fileMimeType, setFileMimeType] = useState("");
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const canUpload = useMemo(() => Boolean(token && title.trim() && description.trim() && fileDataUrl), [token, title, description, fileDataUrl]);

  const getAuth = () => token ? { Authorization: `Bearer ${token}` } : {};

  const load = async () => {
    try { setLoading(true);
      const res = await fetch(`${API_BASE}/api/media/submissions?type=music`, { headers: getAuth() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      setItems((data?.items || []) as MediaItem[]);
    } catch (e: any) { setErr(e?.message); } finally { setLoading(false); }
  };

  useEffect(() => { try { setToken(localStorage.getItem("aevion_token") || ""); } catch {} }, []);
  useEffect(() => { load(); }, [token]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name); setFileMimeType(f.type);
    const reader = new FileReader();
    reader.onload = () => setFileDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!canUpload) return;
    setSubmitting(true); setErr(null); setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/media/submissions`, {
        method: "POST", headers: { "Content-Type": "application/json", ...getAuth() },
        body: JSON.stringify({ type: "music", title, description, fileDataUrl, mimeType: fileMimeType }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Ошибка загрузки");
      setTitle(""); setDescription(""); setFileDataUrl(""); setFileName(""); setShowUpload(false);
      setSuccess("Композиция загружена!");
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (e: any) { setErr(e?.message); } finally { setSubmitting(false); }
  };

  const vote = async (id: string, rating: number) => {
    setVotingId(id);
    try {
      await fetch(`${API_BASE}/api/media/submissions/${id}/vote`, {
        method: "POST", headers: { "Content-Type": "application/json", ...getAuth() },
        body: JSON.stringify({ rating }),
      });
      await load();
    } catch {} finally { setVotingId(null); }
  };

  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" as const };

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #fff7ed 0%, #fef3e2 100%)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ea580c", marginBottom: 4 }}>🎵 AI Music</h1>
            <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Загрузка AI-музыки и всемирное голосование</p>
          </div>
          <button onClick={() => setShowUpload(!showUpload)} style={{
            padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: showUpload ? "#e2e8f0" : "linear-gradient(135deg, #ea580c, #dc2626)", color: showUpload ? "#475569" : "#fff",
          }}>
            {showUpload ? "Отмена" : "+ Загрузить"}
          </button>
        </div>

        {!token && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 14, marginBottom: 20 }}>
            <Link href="/auth" style={{ color: "#ea580c", fontWeight: 600 }}>Войдите</Link> чтобы загружать музыку и голосовать
          </div>
        )}

        {err && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>{err}</div>}
        {success && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 14, marginBottom: 20 }}>{success}</div>}

        {showUpload && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Загрузить композицию</h2>
            <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Название</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название композиции" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Описание</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание / идея / стиль" rows={4} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Аудиофайл</label>
                <input type="file" accept="audio/*" onChange={onFile} style={{ fontSize: 14 }} />
                {fileName && <span style={{ marginLeft: 10, fontSize: 13, color: "#64748b" }}>{fileName}</span>}
              </div>
              <button type="submit" disabled={!canUpload || submitting} style={{
                padding: "13px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600, width: 220, cursor: canUpload ? "pointer" : "default",
                background: canUpload ? "linear-gradient(135deg, #ea580c, #dc2626)" : "#e2e8f0", color: canUpload ? "#fff" : "#94a3b8",
              }}>
                {submitting ? "Загрузка..." : "Загрузить"}
              </button>
            </form>
          </div>
        )}

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#475569", marginBottom: 16 }}>Лучшие работы ({items.length})</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎶</div>
            <p style={{ color: "#94a3b8" }}>Пока нет загруженных работ. Будьте первым!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <div key={it.id} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>{it.title}</h3>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(it.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>{it.description}</p>
                {it.fileUrl && (
                  <audio controls src={`${API_BASE}${it.fileUrl}`} style={{ width: "100%", marginTop: 12, borderRadius: 8 }} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "#f59e0b" }}>{"★".repeat(Math.round(it.avgRating))}{"☆".repeat(5 - Math.round(it.avgRating))}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>({it.votesCount} голосов)</span>
                  </div>
                  {token && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button key={r} onClick={() => vote(it.id, r)} disabled={votingId === it.id} style={{
                          width: 32, height: 32, borderRadius: 8, border: "1px solid #fde68a", background: "#fffbeb", cursor: "pointer", fontSize: 14,
                        }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}