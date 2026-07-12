"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

interface Capability {
  id: string;
  name: string;
  description: string;
  status: "live" | "needs_token";
  token?: string;
  tokens?: string[];
}

interface CapabilitiesData {
  capabilities: Capability[];
  summary: { total: number; live: number; needsToken: number };
}

const CAP_ICONS: Record<string, string> = {
  code: "⌨️",
  github: "🐙",
  railway: "🚂",
  vercel: "▲",
  domain: "🌐",
  video: "🎬",
  image: "🖼️",
  audio_tts: "🎙️",
  audio_music: "🎵",
  email: "📧",
  sms: "💬",
  whatsapp: "📱",
};

const FEATURE_CATEGORIES = [
  {
    id: "create",
    label: "Create",
    icon: "✨",
    color: "#7c3aed",
    items: [
      { icon: "⌨️", name: "Code Editor", desc: "Monaco IDE (VS Code engine) — TypeScript, Python, HTML, CSS, JSON, Markdown", href: "/devhub", badge: "LIVE" },
      { icon: "🤖", name: "AI Code Generation", desc: "Ask AI to generate full files, components, APIs, migrations", href: "/devhub", badge: "LIVE" },
      { icon: "📄", name: "Templates", desc: "Next.js, Express, React SPA, Python FastAPI — one-click project scaffold", href: "/devhub", badge: "LIVE" },
    ],
  },
  {
    id: "media",
    label: "Media",
    icon: "🎬",
    color: "#0d9488",
    items: [
      { icon: "🎬", name: "Video AI", desc: "Text-to-video via Replicate — MiniMax, HunyuanVideo, AnimateDiff", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🖼️", name: "Image DALL-E", desc: "DALL-E 3 image generation — 1024×1024, HD quality, vivid/natural styles", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🎵", name: "Music & SFX", desc: "ElevenLabs AI music and sound effects generation", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🎙️", name: "Voice TTS", desc: "ElevenLabs text-to-speech — 9 voices, high-quality audio", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🔊", name: "Voice Cloning", desc: "Clone any voice from audio sample — create your own AI voice", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "📝", name: "Speech-to-Text", desc: "Transcribe audio to text with language detection", href: "/devhub", badge: "NEEDS TOKEN" },
    ],
  },
  {
    id: "deploy",
    label: "Deploy",
    icon: "🚀",
    color: "#0369a1",
    items: [
      { icon: "🚂", name: "Railway Deploy", desc: "One-click backend deployment — Node.js, Python, Postgres, Redis", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "▲", name: "Vercel Deploy", desc: "Frontend deployment — Next.js, React SPA, static sites", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🐙", name: "GitHub Auto-Push", desc: "Code syncs to GitHub repo in aevion-io org automatically", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🌐", name: "Domain (aevion.build)", desc: "Provision <slug>.aevion.build subdomain via Cloudflare", href: "/devhub", badge: "NEEDS TOKEN" },
    ],
  },
  {
    id: "reach",
    label: "Reach",
    icon: "📡",
    color: "#b45309",
    items: [
      { icon: "📧", name: "Email (Brevo)", desc: "Transactional email, HTML templates, bulk campaigns", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "💬", name: "SMS", desc: "Brevo SMS — send messages to any phone number globally", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "📱", name: "WhatsApp", desc: "WhatsApp Business API — template messages", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "💳", name: "Payments", desc: "Gumroad checkout links — sell products without registration", href: "/devhub", badge: "LIVE" },
    ],
  },
];

export default function StudioPage() {
  const [caps, setCaps] = useState<CapabilitiesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCaps(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const liveCount = caps?.summary.live ?? 0;
  const totalCount = caps?.summary.total ?? 12;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Wave1Nav />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", color: "#fff", padding: "64px 24px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(13,148,136,0.2)", border: "1px solid rgba(13,148,136,0.4)", color: "#5eead4", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 20, letterSpacing: 1 }}>
            AEVION STUDIO
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15 }}>
            One window. Everything.
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 600, margin: "0 auto 32px", lineHeight: 1.6 }}>
            Code · Deploy · Video · Audio · Voice · Websites · Domains — all without leaving AEVION.
            No separate accounts. No extra payments.
          </p>

          {/* Live status bar */}
          {!loading && caps && (
            <div style={{ display: "inline-flex", gap: 24, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 24px", margin: "0 0 32px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#5eead4" }}>{liveCount}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>LIVE</div>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{totalCount - liveCount}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>NEEDS TOKEN</div>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{totalCount}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>TOTAL</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/devhub" style={{ padding: "12px 28px", background: "#0d9488", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Open Studio IDE →
            </Link>
            <Link href="/devhub" style={{ padding: "12px 28px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#e2e8f0", borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              New Project
            </Link>
          </div>
        </div>
      </div>

      {/* Setup banner if tokens missing */}
      {!loading && caps && caps.summary.needsToken > 0 && (
        <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "12px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>⚙️ {caps.summary.needsToken} capabilities need Railway env vars:</span>
            {caps.capabilities.filter((c) => c.status === "needs_token").map((c) => (
              <code key={c.id} style={{ fontSize: 11, background: "#fde68a", padding: "2px 6px", borderRadius: 4, color: "#78350f", fontFamily: "monospace" }}>
                {c.token || (c.tokens || []).join(", ")}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Feature categories */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {FEATURE_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>{cat.label}</h2>
                <div style={{ height: 1, flex: 1, background: "#e2e8f0" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {cat.items.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    style={{
                      display: "block", padding: "18px 20px",
                      background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 12, textDecoration: "none",
                      transition: "box-shadow 0.15s, border-color 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>{item.icon}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 20,
                        background: item.badge === "LIVE" ? "#d1fae5" : "#fef3c7",
                        color: item.badge === "LIVE" ? "#065f46" : "#92400e",
                        letterSpacing: 0.5,
                      }}>
                        {item.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{item.desc}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Token setup guide */}
        <div style={{ marginTop: 64, background: "#0f172a", borderRadius: 16, padding: "32px 36px", color: "#e2e8f0" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", color: "#fff" }}>Activate all capabilities</h2>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 24px" }}>Add these env vars to Railway → AEVION backend service → Variables:</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {[
              { token: "GITHUB_TOKEN", where: "github.com/settings/tokens", desc: "GitHub PAT — scope: repo, workflow" },
              { token: "RAILWAY_API_TOKEN", where: "railway.app → Account → API Tokens", desc: "Deploy backends to Railway" },
              { token: "VERCEL_API_TOKEN", where: "vercel.com/account/tokens", desc: "Deploy frontends to Vercel" },
              { token: "CLOUDFLARE_API_TOKEN", where: "dash.cloudflare.com → Profile → API Tokens", desc: "Provision aevion.build subdomains" },
              { token: "CLOUDFLARE_ZONE_ID", where: "Cloudflare dashboard → aevion.build domain", desc: "Zone ID for aevion.build" },
              { token: "REPLICATE_API_TOKEN", where: "replicate.com/account/api-tokens", desc: "AI video generation" },
              { token: "OPENAI_API_KEY", where: "platform.openai.com/api-keys", desc: "DALL-E 3 image generation" },
              { token: "ELEVENLABS_API_KEY", where: "elevenlabs.io/app/settings/api-keys", desc: "TTS, music, SFX, voice cloning" },
              { token: "BREVO_API_KEY", where: "app.brevo.com/settings/keys/api", desc: "Email, SMS, WhatsApp" },
            ].map((t) => (
              <div key={t.token} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" }}>
                <code style={{ fontSize: 12, fontFamily: "monospace", color: "#5eead4", fontWeight: 700 }}>{t.token}</code>
                <div style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0" }}>{t.desc}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>→ {t.where}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
