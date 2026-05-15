"use client";
import { useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

export default function QMediaCreativePage() {
  const [lyrics, setLyrics] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsForm, setLyricsForm] = useState({ genre: "pop", mood: "upbeat", theme: "" });

  const [titles, setTitles] = useState<string[]>([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titlesForm, setTitlesForm] = useState({ genre: "pop", mood: "upbeat" });

  const [palette, setPalette] = useState<string[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState("happy");

  const genLyrics = async () => {
    setLyricsLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qmedia/ai/generate-lyrics"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lyricsForm) });
      const d = await r.json().catch(() => ({}));
      if (d.lyrics) setLyrics(d.lyrics);
    } catch { } finally { setLyricsLoading(false); }
  };

  const genTitles = async () => {
    setTitlesLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qmedia/ai/generate-title"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(titlesForm) });
      const d = await r.json().catch(() => ({}));
      if (d.titles) setTitles(d.titles);
    } catch { } finally { setTitlesLoading(false); }
  };

  const genPalette = async () => {
    setPaletteLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qmedia/ai/generate-color-palette"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mood: selectedMood }) });
      const d = await r.json().catch(() => ({}));
      if (d.colors) setPalette(d.colors);
    } catch { } finally { setPaletteLoading(false); }
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🎨 Creative AI Tools</h1>
          <Link href="/qmedia" style={{ fontSize: 12, color: "#d97706", fontWeight: 700, textDecoration: "none" }}>← QMedia</Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Lyrics */}
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(13,148,136,0.2)", background: "#fff" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0d9488", margin: "0 0 14px" }}>🎵 Generate Lyrics</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <select value={lyricsForm.genre} onChange={e => setLyricsForm(p => ({ ...p, genre: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["pop", "rock", "electronic", "classical", "jazz", "hip-hop", "r&b", "country"].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={lyricsForm.mood} onChange={e => setLyricsForm(p => ({ ...p, mood: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["upbeat", "melancholy", "romantic", "energetic", "calm", "dark", "hopeful"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={lyricsForm.theme} onChange={e => setLyricsForm(p => ({ ...p, theme: e.target.value }))} placeholder="Theme (love, city, dreams…)" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={genLyrics} disabled={lyricsLoading} style={{ padding: "8px 16px", borderRadius: 8, background: "#0d9488", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: lyricsLoading ? "default" : "pointer" }}>
                {lyricsLoading ? "…" : "Generate"}
              </button>
            </div>
            {lyrics && (
              <div style={{ position: "relative", padding: 16, borderRadius: 10, background: "#0f172a", color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {lyrics}
                <button onClick={() => navigator.clipboard.writeText(lyrics)} style={{ position: "absolute", top: 8, right: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", padding: "3px 8px", borderRadius: 5, fontSize: 10 }}>Copy</button>
              </div>
            )}
          </div>

          {/* Titles */}
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(217,119,6,0.2)", background: "#fff" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#d97706", margin: "0 0 14px" }}>✏️ Song Title Ideas</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 12 }}>
              <select value={titlesForm.genre} onChange={e => setTitlesForm(p => ({ ...p, genre: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["pop", "rock", "electronic", "jazz", "hip-hop", "country"].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={titlesForm.mood} onChange={e => setTitlesForm(p => ({ ...p, mood: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["upbeat", "melancholy", "romantic", "energetic", "calm"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={genTitles} disabled={titlesLoading} style={{ padding: "8px 16px", borderRadius: 8, background: "#d97706", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: titlesLoading ? "default" : "pointer" }}>
                {titlesLoading ? "…" : "Generate"}
              </button>
            </div>
            {titles.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {titles.map((t, i) => (
                  <button key={i} onClick={() => navigator.clipboard.writeText(t)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.06)", color: "#92400e", fontSize: 12, fontWeight: 600, cursor: "pointer" }} title="Click to copy">
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Palette */}
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(124,58,237,0.2)", background: "#fff" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed", margin: "0 0 14px" }}>🎨 Color Palette</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["happy", "sad", "energetic", "calm", "romantic", "dark"].map(m => (
                <button key={m} onClick={() => setSelectedMood(m)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(124,58,237,0.3)", background: selectedMood === m ? "#7c3aed" : "#fff", color: selectedMood === m ? "#fff" : "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{m}</button>
              ))}
              <button onClick={genPalette} disabled={paletteLoading} style={{ marginLeft: "auto", padding: "4px 14px", borderRadius: 20, background: "#7c3aed", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: paletteLoading ? "default" : "pointer" }}>
                {paletteLoading ? "…" : "Generate"}
              </button>
            </div>
            {palette.length > 0 && (
              <div style={{ display: "flex", gap: 10 }}>
                {palette.map((color, i) => (
                  <div key={i} onClick={() => navigator.clipboard.writeText(color)} style={{ flex: 1, cursor: "pointer" }} title="Click to copy hex">
                    <div style={{ height: 80, borderRadius: 10, background: color, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }} />
                    <div style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 5, fontFamily: "monospace" }}>{color}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
