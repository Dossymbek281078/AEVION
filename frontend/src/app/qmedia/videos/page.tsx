"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { catalog } from "@/lib/aevionCatalog";

const CATEGORIES = ["All", "Tutorial", "Music Video", "Short Film", "Documentary", "Other"];

function bearerHeader(): HeadersInit {
  const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function isHttpUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch { return false; }
}

export default function QMediaVideosPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [playing, setPlaying] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", url: "", thumbnailUrl: "", category: "other" });
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // v0.8: load videos via @aevion-io/catalog-client SDK (cat.qmedia.videos).
  useEffect(() => {
    const c = category === "All" ? undefined : category.toLowerCase().replace(/ /g, "-");
    setLoading(true);
    catalog.qmedia
      .videos({ limit: 50, category: c })
      .then((d) => {
        if (d.items) setVideos(d.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  const addVideo = async () => {
    if (!form.title.trim()) { setAddError("Название обязательно"); return; }
    if (!isHttpUrl(form.url.trim())) { setAddError("URL видео должен начинаться с https://"); return; }
    if (form.thumbnailUrl.trim() && !isHttpUrl(form.thumbnailUrl.trim())) { setAddError("URL обложки должен быть валидной ссылкой"); return; }
    setAddError(null);
    setSaving(true);
    try {
      const r = await fetch(apiUrl("/api/qmedia/me/videos"), { method: "POST", headers: { "Content-Type": "application/json", ...bearerHeader() }, body: JSON.stringify({ ...form, isPublic: true }) });
      if (r.ok) { const d = await r.json(); setVideos(prev => [d, ...prev]); setAddOpen(false); setForm({ title: "", description: "", url: "", thumbnailUrl: "", category: "other" }); }
      else { setAddError(`Не удалось сохранить (HTTP ${r.status})`); }
    } catch { setAddError("Сеть недоступна"); }
    finally { setSaving(false); }
  };

  const isYoutube = (url: string) => url?.includes("youtube.com") || url?.includes("youtu.be");
  const embedUrl = (url: string) => {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🎬 Videos</h1>
          <Link href="/qmedia" style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>← QMedia</Link>
          <button onClick={() => setAddOpen(v => !v)} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, background: "#7c3aed", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add video</button>
        </div>

        {addOpen && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title *" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["tutorial", "music-video", "short-film", "documentary", "other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input
              type="url"
              inputMode="url"
              value={form.url}
              onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="Video URL (YouTube, mp4…)"
              aria-label="URL видео"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" maxLength={500} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={addVideo} disabled={saving} aria-busy={saving} style={{ padding: "8px 16px", borderRadius: 8, background: "#7c3aed", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "…" : "Save"}
              </button>
            </div>
            {addError && (
              <p role="alert" style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                {addError}
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {CATEGORIES.map(c => <button key={c} onClick={() => setCategory(c)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(15,23,42,0.15)", background: category === c ? "#7c3aed" : "#fff", color: category === c ? "#fff" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>)}
        </div>

        {playing && (
          <div style={{ marginBottom: 20, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(124,58,237,0.2)" }}>
            <div style={{ background: "#0f172a", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{playing.title}</span>
              <button onClick={() => setPlaying(null)} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
            {playing.url && isYoutube(playing.url)
              ? <iframe src={embedUrl(playing.url)} style={{ width: "100%", height: 360, border: "none" }} allowFullScreen />
              : <video src={playing.url} controls style={{ width: "100%", maxHeight: 360 }} />
            }
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {loading && videos.length === 0 && (
            <>
              {[0, 1, 2, 3].map(i => (
                <div key={i} aria-busy="true" style={{ borderRadius: 12, height: 180, background: "#f1f5f9", border: "1px solid rgba(15,23,42,0.08)", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </>
          )}
          {!loading && videos.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13, gridColumn: "1/-1" }}>No videos yet. Be the first to add one!</p>}
          {videos.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => { setPlaying(v); fetch(apiUrl(`/api/qmedia/videos/${v.id}/view`), { method: "POST" }).catch(() => {}); }}
              aria-label={`Play video: ${v.title}`}
              style={{ display: "block", textAlign: "left", padding: 0, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(15,23,42,0.08)", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}
            >
              <div style={{ height: 120, background: v.thumbnailUrl ? `url("${encodeURI(v.thumbnailUrl).replace(/"/g, "%22")}") center/cover` : "linear-gradient(135deg, #7c3aed, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
                {!v.thumbnailUrl && "▶"}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{v.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "rgba(124,58,237,0.08)", color: "#7c3aed", fontWeight: 600 }}>{v.category}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>👁 {v.viewCount}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ProductPageShell>
    </main>
  );
}
