"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

export default function QMediaPage() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/qmedia/tracks?limit=5")).then(r => r.json()).then(d => { if (d.items) setTracks(d.items); }).catch(() => {});
    fetch(apiUrl("/api/qmedia/videos?limit=5")).then(r => r.json()).then(d => { if (d.items) setVideos(d.items); }).catch(() => {});
  }, []);

  const features = [
    { icon: "🎵", title: "Music", desc: "Stream and create music with AI", href: "/qmedia/music", color: "#0d9488" },
    { icon: "🎬", title: "Videos", desc: "Watch and share videos", href: "/qmedia/videos", color: "#7c3aed" },
    { icon: "🎨", title: "Creative", desc: "AI lyrics, titles, color palettes", href: "/qmedia/creative", color: "#d97706" },
    { icon: "📻", title: "Live", desc: "Coming soon", href: "#", color: "#94a3b8", disabled: true },
  ];

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: "0 0 6px" }}>🎵 QMedia</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>Music, video and creative tools — all in one place.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          {features.map(f => (
            <Link key={f.title} href={f.href} style={{ textDecoration: "none", pointerEvents: f.disabled ? "none" : "auto" }}>
              <div style={{ padding: 20, borderRadius: 14, border: `1px solid ${f.color}33`, background: "#fff", opacity: f.disabled ? 0.5 : 1, cursor: f.disabled ? "default" : "pointer" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: f.color, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{f.desc}</div>
                {!f.disabled && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: f.color }}>Open →</div>}
              </div>
            </Link>
          ))}
        </div>

        {tracks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>🎵 Popular tracks</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tracks.map(t => (
                <div key={t.id} style={{ padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🎵</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{t.artist} · {t.genre}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>▶ {t.playCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>🎬 Popular videos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {videos.map(v => (
                <div key={v.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ height: 100, background: "linear-gradient(135deg, #0d9488, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎬</div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{v.title}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{v.viewCount} views</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
