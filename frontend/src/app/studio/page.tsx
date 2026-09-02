"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { productById } from "@/lib/products";
import { track } from "@/lib/track";
import { PageTracking } from "@/components/PageTracking";
import { CAP_META, порядокПоказа } from "./usageOrder";

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

// `usedKnown: false` means the server could not read the meter. It still sends
// a 0 so this panel renders, but 0 is also what a fresh month looks like — so
// the bar has to say which it is rather than drawing a confident empty gauge.
import type { CapUsage } from "./usageTypes";
interface CreditsData {
  tier: "free" | "pro" | "enterprise";
  month: string;
  // Было перечисление пяти ключей. Возможности заводятся в таблице тарифов
  // бэкенда, и второй их список здесь расходился бы молча — 02.09.2026 так и
  // вышло: речь и перевод начали списываться, а полос на экране не было.
  usage: Record<string, CapUsage>;
  degraded?: boolean;
  degradedReason?: string;
}

function UsageBar({ label, icon, used, limit, color, known = true }: { label: string; icon: string; used: number; limit: number; color: string; known?: boolean }) {
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);
  const warn = pct >= 80 && limit !== -1;
  const limitLabel = limit === -1 ? "∞" : String(limit);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{icon} {label}</span>
        <span
          data-testid={`usage-${label}`}
          data-known={known ? "yes" : "no"}
          style={{ fontSize: 11, color: !known ? "#92400e" : warn ? "#b45309" : "#64748b", fontWeight: warn || !known ? 700 : 400 }}
        >
          {!known ? `— / ${limitLabel}` : limit === -1 ? `${used} used (∞)` : `${used} / ${limitLabel}`}
        </span>
      </div>
      {limit !== -1 && (
        <div style={{ height: 5, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
          {/* An unread meter draws nothing rather than an empty bar, which
              would read as "you have used none of it". */}
          {known && (
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: warn ? "#f59e0b" : color, transition: "width 0.4s" }} />
          )}
        </div>
      )}
    </div>
  );
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
      { icon: "🖼️", name: "Image Generation", desc: "AI images with a fallback fleet — OpenAI → Workers AI (flux) → Together, permanent CDN URLs", href: "/devhub", badge: "LIVE" },
      { icon: "📎", name: "Screenshot → Code", desc: "Attach a design screenshot in the AI chat — a vision model recreates it as working code", href: "/devhub", badge: "LIVE" },
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
      { icon: "☁️", name: "Cloudflare Pages", desc: "Static-site deploy via wrangler, marked live only after the page really answers", href: "/devhub", badge: "LIVE" },
      { icon: "🐙", name: "GitHub Auto-Push", desc: "Code syncs to GitHub repo in aevion-io org automatically", href: "/devhub", badge: "NEEDS TOKEN" },
      { icon: "🌐", name: "Domain (aevion.build)", desc: "Waiting on domain delegation — the zone is not pointed at Cloudflare yet, so these subdomains do not resolve", href: "/devhub", badge: "PENDING" },
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

type SmartSavings = {
  runs: number;
  totalCostUsd: number;
  estAlwaysCouncilUsd: number;
  savedUsd: number;
  savedPct: number;
};

// Studio Pro sells through its own Lemon Squeezy variant, so its price and
// checkout URL live in the product catalogue (verified against the live
// dashboards on 2026-07-26), not in this page. Typing them here is how the
// All-Access banner ended up advertising a price nothing charged.
const STUDIO_PRO = productById("devhub");

export default function StudioPage() {
  const [caps, setCaps] = useState<CapabilitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [savings, setSavings] = useState<SmartSavings | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCaps(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(apiUrl("/api/devhub/studio/credits"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d: CreditsData) => setCredits(d))
      .catch(() => {});
    fetch(apiUrl("/api/qcoreai/smart/savings"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d: SmartSavings) => { if (d && typeof d.runs === "number") setSavings(d); })
      .catch(() => {});
  }, []);

  const liveCount = caps?.summary.live ?? 0;
  const totalCount = caps?.summary.total ?? 12;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Замер посещения и ухода к оплате — см. components/PageTracking.
          До 14.08.2026 страница не считала НИЧЕГО, хотя ведёт к покупке. */}
      <PageTracking page="studio" />
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

      {/* Credits widget */}
      {credits && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "20px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>This month's usage</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, letterSpacing: 0.5,
                  background: credits.tier === "pro" ? "#dbeafe" : credits.tier === "enterprise" ? "#d1fae5" : "#f1f5f9",
                  color: credits.tier === "pro" ? "#1e40af" : credits.tier === "enterprise" ? "#065f46" : "#475569",
                }}>
                  {credits.tier.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{credits.month}</span>
              </div>
              {credits.tier === "free" && (
                <a
                  href="#upgrade"
                  onClick={() => track({ type: "cta_click", tier: "studio-pro", source: "studio/credits-badge" })}
                  style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none", padding: "4px 12px", border: "1px solid #0d9488", borderRadius: 6 }}
                >
                  Upgrade to Pro {`$${STUDIO_PRO?.priceUsd ?? 149}`} →
                </a>
              )}
            </div>
            {credits.degraded && (
              <div
                data-testid="credits-unreadable"
                style={{
                  marginBottom: 14, padding: "9px 12px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.45,
                  background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
                }}
              >
                <strong style={{ fontWeight: 700 }}>Расход за месяц сейчас не читается. </strong>
                Цифры ниже — не измерение, а лимиты на этот запрос не проверялись.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
              {порядокПоказа(credits.usage).map((k) => {
                  const v = credits.usage[k];
                  const m = CAP_META[k];
                  return (
                    <UsageBar
                      key={k}
                      label={m ? m.label : k}
                      icon={m ? m.icon : "•"}
                      color={m ? m.color : "#64748b"}
                      used={v.used}
                      limit={v.limit}
                      known={v.usedKnown !== false}
                    />
                  );
                })}
              </div>
          </div>
        </div>
      )}

      {/* AI cost rationality — the free-fleet argument, with live numbers */}
      {savings && savings.runs > 0 && (
        <div style={{ background: "#f0fdfa", borderBottom: "1px solid #99f6e4", padding: "20px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                ⚡ Smart AI routing has saved {savings.savedUsd >= 0.005 ? `$${savings.savedUsd.toFixed(2)}` : "<$0.01"} across {savings.runs} call{savings.runs === 1 ? "" : "s"}
              </div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                Every Studio AI call is routed to the cheapest model tier that can actually do the job —{" "}
                {Math.round(savings.savedPct)}% less than always running the full council. Comparable AI builders
                start at $20/mo before you generate anything; here the fleet itself is free.
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0d9488" }}>${savings.totalCostUsd.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>ACTUAL SPEND</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#94a3b8", textDecoration: "line-through" }}>${savings.estAlwaysCouncilUsd.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>WITHOUT ROUTING</div>
              </div>
            </div>
          </div>
        </div>
      )}

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

        {/* Upgrade section */}
        <div id="upgrade" style={{ marginTop: 64, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {[
            {
              tier: "Free", price: "$0", color: "#64748b",
              features: ["3 videos / month", "10 images / month", "100k TTS chars", "5 music tracks", "10 deploys", "Monaco IDE", "GitHub push"],
              cta: "Current plan", ctaHref: "#", disabled: true,
            },
            {
              tier: "Pro", price: `$${STUDIO_PRO?.priceUsd ?? 149}`, color: "#0d9488",
              features: ["50 videos / month", "200 images / month", "30k TTS chars", "100 music tracks", "Unlimited deploys", "Public *.pages.dev URL for every project", "Everything in Free", "Priority support"],
              cta: "Upgrade to Pro", ctaHref: STUDIO_PRO?.href ?? "#", disabled: false,
              onCta: () =>
                track({
                  type: "checkout_start",
                  tier: "studio-pro",
                  source: "studio/plans",
                  value: STUDIO_PRO?.priceUsd,
                  meta: { processor: "lemonsqueezy" },
                }),
            },
            {
              tier: "Enterprise", price: "Custom", color: "#7c3aed",
              features: ["Unlimited everything", "Dedicated compute", "Custom domains pool", "Team collaboration", "SLA + support", "White-label option", "API access"],
              cta: "Contact us", ctaHref: "mailto:yahiin1978@gmail.com?subject=AEVION+Studio+Enterprise", disabled: false,
            },
          ].map((plan) => (
            <div key={plan.tier} style={{ border: `2px solid ${plan.color}`, borderRadius: 16, padding: "28px 24px", background: "#fff", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: plan.color, letterSpacing: 1, marginBottom: 8 }}>{plan.tier.toUpperCase()}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>{plan.price}<span style={{ fontSize: 14, color: "#64748b", fontWeight: 400 }}>{plan.price.startsWith("$") && plan.price !== "$0" ? "/mo" : ""}</span></div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "#334155", padding: "4px 0", display: "flex", gap: 8 }}>
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.ctaHref}
                onClick={() => plan.onCta?.()}
                style={{
                  display: "block", textAlign: "center", padding: "10px", borderRadius: 8,
                  background: plan.disabled ? "#f1f5f9" : plan.color,
                  color: plan.disabled ? "#94a3b8" : "#fff",
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                  pointerEvents: plan.disabled ? "none" : "auto",
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Token setup guide */}
        <div style={{ marginTop: 48, background: "#0f172a", borderRadius: 16, padding: "32px 36px", color: "#e2e8f0" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", color: "#fff" }}>Activate all capabilities</h2>
          <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 24px" }}>Add these env vars to Railway → AEVION backend service → Variables:</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 12 }}>
            {[
              { token: "GITHUB_TOKEN", where: "github.com/settings/tokens", desc: "GitHub PAT — scope: repo, workflow" },
              { token: "RAILWAY_API_TOKEN", where: "railway.app → Account → API Tokens", desc: "Deploy backends to Railway" },
              { token: "VERCEL_API_TOKEN", where: "vercel.com/account/tokens", desc: "Deploy frontends to Vercel" },
              { token: "CLOUDFLARE_ACCOUNT_ID", where: "dash.cloudflare.com → right sidebar", desc: "Account ID for Cloudflare Pages deploy" },
              { token: "CLOUDFLARE_API_TOKEN", where: "dash.cloudflare.com → Profile → API Tokens", desc: "Deploy to Pages + provision aevion.build" },
              { token: "CLOUDFLARE_ZONE_ID", where: "Cloudflare → aevion.build domain → Overview", desc: "Zone ID for aevion.build DNS records" },
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
