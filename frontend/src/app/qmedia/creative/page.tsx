"use client";
import { useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { useQMediaT, genErrorKey } from "../i18n";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallthrough */ }
  return false;
}

export default function QMediaCreativePage() {
  const { t, label, lang } = useQMediaT();
  // бэкенд без ИИ-провайдера отдаёт шаблон с mode: "stub" — человеку говорим об этом прямо
  const [lyricsStub, setLyricsStub] = useState(false);
  const [titlesStub, setTitlesStub] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [lyricsForm, setLyricsForm] = useState({ genre: "pop", mood: "upbeat", theme: "" });

  const [titles, setTitles] = useState<string[]>([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titlesError, setTitlesError] = useState<string | null>(null);
  const [titlesForm, setTitlesForm] = useState({ genre: "pop", mood: "upbeat" });

  const [palette, setPalette] = useState<string[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState("happy");

  const [copiedNote, setCopiedNote] = useState<string | null>(null);

  async function handleCopy(text: string, what: string) {
    const ok = await copyToClipboard(text);
    setCopiedNote(ok ? t("creative.copied", { x: what }) : t("creative.copyFail"));
    setTimeout(() => setCopiedNote(null), 1500);
  }

  const genLyrics = async () => {
    setLyricsLoading(true);
    setLyricsError(null);
    try {
      const r = await fetch(apiUrl("/api/qmedia/ai/generate-lyrics"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lyricsForm) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.lyrics) { setLyrics(d.lyrics); setLyricsStub(d.mode === "stub"); }
      else setLyricsError(t(genErrorKey(r.status)));
    } catch { setLyricsError(t("err.network")); }
    finally { setLyricsLoading(false); }
  };

  const genTitles = async () => {
    setTitlesLoading(true);
    setTitlesError(null);
    try {
      const r = await fetch(apiUrl("/api/qmedia/ai/generate-title"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(titlesForm) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.titles) { setTitles(d.titles); setTitlesStub(d.mode === "stub"); }
      else setTitlesError(t(genErrorKey(r.status)));
    } catch { setTitlesError(t("err.network")); }
    finally { setTitlesLoading(false); }
  };

  const genPalette = async () => {
    setPaletteLoading(true);
    setPaletteError(null);
    try {
      const r = await fetch(apiUrl("/api/qmedia/ai/generate-color-palette"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mood: selectedMood }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.colors) setPalette(d.colors);
      else setPaletteError(t(genErrorKey(r.status)));
    } catch { setPaletteError(t("err.network")); }
    finally { setPaletteLoading(false); }
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{t("creative.h1")}</h1>
          <Link href="/qmedia" style={{ fontSize: 12, color: "#d97706", fontWeight: 700, textDecoration: "none" }}>← QMedia</Link>
        </div>
        {lang !== "en" && <p style={{ margin: "-12px 0 16px", fontSize: 12, color: "#64748b" }}>{t("creative.enOnly")}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Lyrics */}
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(13,148,136,0.2)", background: "#fff" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0d9488", margin: "0 0 14px" }}>{t("creative.lyrics")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <select aria-label={t("common.genre")} value={lyricsForm.genre} onChange={e => setLyricsForm(p => ({ ...p, genre: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["pop", "rock", "electronic", "classical", "jazz", "hip-hop", "r&b", "country"].map(g => <option key={g} value={g}>{label("genre", g)}</option>)}
              </select>
              <select aria-label={t("common.mood")} value={lyricsForm.mood} onChange={e => setLyricsForm(p => ({ ...p, mood: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["upbeat", "melancholy", "romantic", "energetic", "calm", "dark", "hopeful"].map(m => <option key={m} value={m}>{label("mood", m)}</option>)}
              </select>
              <input aria-label={t("creative.themeA")} value={lyricsForm.theme} onChange={e => setLyricsForm(p => ({ ...p, theme: e.target.value }))} placeholder={t("creative.theme")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={genLyrics} disabled={lyricsLoading} style={{ padding: "8px 16px", borderRadius: 8, background: "#0d9488", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: lyricsLoading ? "default" : "pointer" }}>
                {lyricsLoading ? "…" : t("creative.generate")}
              </button>
            </div>
            {lyricsError && (
              <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{lyricsError}</p>
            )}
            {lyrics && lyricsStub && <p role="status" style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309", fontWeight: 600 }}>{t("creative.stub")}</p>}
            {lyrics && (
              <div style={{ position: "relative", padding: 16, borderRadius: 10, background: "#0f172a", color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {lyrics}
                <button onClick={() => handleCopy(lyrics, t("creative.lyricsWord"))} aria-label={t("creative.copyLyricsA")} style={{ position: "absolute", top: 8, right: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", padding: "3px 8px", borderRadius: 5, fontSize: 10 }}>{t("creative.copy")}</button>
              </div>
            )}
          </div>

          {/* Titles */}
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(217,119,6,0.2)", background: "#fff" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#d97706", margin: "0 0 14px" }}>{t("creative.titles")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 12 }}>
              <select aria-label={t("common.genre")} value={titlesForm.genre} onChange={e => setTitlesForm(p => ({ ...p, genre: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["pop", "rock", "electronic", "jazz", "hip-hop", "country"].map(g => <option key={g} value={g}>{label("genre", g)}</option>)}
              </select>
              <select aria-label={t("common.mood")} value={titlesForm.mood} onChange={e => setTitlesForm(p => ({ ...p, mood: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }}>
                {["upbeat", "melancholy", "romantic", "energetic", "calm"].map(m => <option key={m} value={m}>{label("mood", m)}</option>)}
              </select>
              <button onClick={genTitles} disabled={titlesLoading} style={{ padding: "8px 16px", borderRadius: 8, background: "#d97706", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: titlesLoading ? "default" : "pointer" }}>
                {titlesLoading ? "…" : t("creative.generate")}
              </button>
            </div>
            {titlesError && (
              <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{titlesError}</p>
            )}
            {titles.length > 0 && titlesStub && <p role="status" style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309", fontWeight: 600 }}>{t("creative.stub")}</p>}
            {titles.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {titles.map((name, i) => (
                  <button key={i} onClick={() => handleCopy(name, name)} aria-label={t("creative.copyTitleA", { x: name })} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.06)", color: "#92400e", fontSize: 12, fontWeight: 600, cursor: "pointer" }} title={t("creative.clickToCopy")}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Palette */}
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(124,58,237,0.2)", background: "#fff" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed", margin: "0 0 14px" }}>{t("creative.palette")}</h2>
            <p style={{ margin: "-8px 0 12px", fontSize: 12, color: "#64748b" }}>{t("creative.paletteNote")}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["happy", "sad", "energetic", "calm", "romantic", "dark"].map(m => (
                <button key={m} onClick={() => setSelectedMood(m)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(124,58,237,0.3)", background: selectedMood === m ? "#7c3aed" : "#fff", color: selectedMood === m ? "#fff" : "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label("mood", m)}</button>
              ))}
              <button onClick={genPalette} disabled={paletteLoading} style={{ marginLeft: "auto", padding: "4px 14px", borderRadius: 20, background: "#7c3aed", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: paletteLoading ? "default" : "pointer" }}>
                {paletteLoading ? "…" : t("creative.show")}
              </button>
            </div>
            {paletteError && (
              <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{paletteError}</p>
            )}
            {palette.length > 0 && (
              <div style={{ display: "flex", gap: 10 }}>
                {palette.map((color, i) => (
                  <button key={i} type="button" onClick={() => handleCopy(color, color)} aria-label={t("creative.copyColorA", { x: color })} style={{ flex: 1, cursor: "pointer", padding: 0, border: "none", background: "transparent", fontFamily: "inherit" }} title={t("creative.clickToCopyHex")}>
                    <div style={{ height: 80, borderRadius: 10, background: color, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }} />
                    <div style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 5, fontFamily: "monospace" }}>{color}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {copiedNote && (
          <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "8px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 50 }}>
            {copiedNote}
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
