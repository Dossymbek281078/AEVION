"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

const GENRES = ["All", "Pop", "Rock", "Electronic", "Classical", "Jazz", "Hip-hop", "Other"];

function bearerHeader(): HeadersInit {
  const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function QMediaMusicPage() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [genre, setGenre] = useState("All");
  const [current, setCurrent] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", url: "", genre: "pop" });
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const g = genre === "All" ? "" : genre.toLowerCase();
    fetch(apiUrl(`/api/qmedia/tracks?limit=50${g ? `&genre=${g}` : ""}`)).then(r => r.json()).then(d => { if (d.items) setTracks(d.items); }).catch((err) => { console.warn("[qmedia/music] tracks list failed", err instanceof Error ? err.message : err); });
  }, [genre]);

  const play = (track: any) => {
    setCurrent(track);
    setIsPlaying(true);
    fetch(apiUrl(`/api/qmedia/tracks/${track.id}/play`), { method: "POST" }).catch((err) => { console.warn("[qmedia/music] play count failed", err instanceof Error ? err.message : err); });
  };
  const next = () => { if (!current) return; const i = tracks.findIndex(t => t.id === current.id); play(tracks[(i + 1) % tracks.length]); };
  const prev = () => { if (!current) return; const i = tracks.findIndex(t => t.id === current.id); play(tracks[(i - 1 + tracks.length) % tracks.length]); };

  useEffect(() => {
    if (audioRef.current) { audioRef.current.volume = volume; if (isPlaying) audioRef.current.play().catch(() => {}); else audioRef.current.pause(); }
  }, [isPlaying, current, volume]);

  const addTrack = async () => {
    if (!form.title) return;
    const r = await fetch(apiUrl("/api/qmedia/me/tracks"), { method: "POST", headers: { "Content-Type": "application/json", ...bearerHeader() }, body: JSON.stringify({ ...form, isPublic: true }) });
    if (r.ok) { const d = await r.json(); setTracks(prev => [d, ...prev]); setAddOpen(false); setForm({ title: "", artist: "", url: "", genre: "pop" }); }
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🎵 Music</h1>
          <Link href="/qmedia" style={{ fontSize: 12, color: "#0d9488", fontWeight: 700, textDecoration: "none" }}>← QMedia</Link>
          <button onClick={() => setAddOpen(v => !v)} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add track</button>
        </div>

        {addOpen && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: "1px solid rgba(13,148,136,0.3)", background: "rgba(13,148,136,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={200} aria-label="Название трека" placeholder="Title *" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
              <input value={form.artist} onChange={e => setForm(p => ({ ...p, artist: e.target.value }))} maxLength={200} aria-label="Исполнитель" placeholder="Artist" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
            </div>
            <input type="url" inputMode="url" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} maxLength={2048} aria-label="URL аудио-файла" placeholder="Audio URL (mp3, ogg…)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["pop", "rock", "electronic", "classical", "jazz", "hip-hop", "other"].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={addTrack} style={{ padding: "8px 16px", borderRadius: 8, background: "#0d9488", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        )}

        {current && (
          <div style={{ marginBottom: 20, padding: 20, borderRadius: 14, background: "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(124,58,237,0.08))", border: "1px solid rgba(13,148,136,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>{current.title}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>{current.artist}</div>
            {current.url && <audio ref={audioRef} src={current.url} onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)} onEnded={next} />}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={prev} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>⏮</button>
              <button onClick={() => setIsPlaying(v => !v)} style={{ width: 44, height: 44, borderRadius: "50%", background: "#0d9488", color: "#fff", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{isPlaying ? "⏸" : "▶"}</button>
              <button onClick={next} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>⏭</button>
              <input type="range" min={0} max={100} value={progress} onChange={e => { if (audioRef.current) audioRef.current.currentTime = (Number(e.target.value) / 100) * audioRef.current.duration; setProgress(Number(e.target.value)); }} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "#64748b" }}>🔊</span>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ width: 70 }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {GENRES.map(g => (
            <button key={g} onClick={() => setGenre(g)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(15,23,42,0.15)", background: genre === g ? "#0d9488" : "#fff", color: genre === g ? "#fff" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{g}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tracks.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13 }}>No tracks yet. Be the first to add one!</p>}
          {tracks.map((t, i) => (
            <div key={t.id} onClick={() => play(t)} style={{ padding: "10px 14px", borderRadius: 10, background: current?.id === t.id ? "rgba(13,148,136,0.08)" : "#f8fafc", border: `1px solid ${current?.id === t.id ? "rgba(13,148,136,0.3)" : "rgba(15,23,42,0.08)"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 24, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>{current?.id === t.id && isPlaying ? "▶" : i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{t.artist}</div>
              </div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(13,148,136,0.08)", color: "#0d9488", fontWeight: 600 }}>{t.genre}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>▶ {t.playCount}</span>
            </div>
          ))}
        </div>
      </ProductPageShell>
    </main>
  );
}
