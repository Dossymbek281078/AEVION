"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    id: "editor",
    label: "01 / Core editor",
    title: "8 sliders → 10 historical regimes",
    description:
      "Drag any of the 8 governance sliders and watch the regime classification change in real time. Each slider maps to a research-backed pillar: floor below, rule of law, rotation/sortition, elite transparency, multiple status axes, skin in the game, polycentricity, and positive sum. 10 classified regimes from Open Access Order to Totalitarian Dictatorship.",
    img: "/demo/editor.jpeg",
    live: "/constitution?country=no",
    liveLabel: "Open editor →",
  },
  {
    id: "academy",
    label: "02 / Academy",
    title: "8-lesson interactive course — free",
    description:
      "Each lesson covers one slider: theory (200+ words, backed by North/Wallis/Weingast, Acemoglu/Robinson, Ostrom, Taleb), a historical example (Magna Carta, NHS 1948, Irish Citizens' Assembly, Estonia e-gov, Swiss cantons), and a hands-on task. Progress in localStorage. Certificate as PDF on completion.",
    img: "/demo/academy.jpeg",
    live: "/constitution/learn",
    liveLabel: "Open Academy →",
  },
  {
    id: "pricing",
    label: "03 / Pricing",
    title: "Free / Pro $9 / Team $49 — instant digital delivery",
    description:
      "Free tier: 5 cloud saves, 10 AI requests/day, watermarked PDF. Pro ($9/mo): unlimited saves, unlimited AI, clean PDF, embed widget, custom themes. Team ($49/mo): 5 seats, shared scenarios, admin dashboard, CSV export, Slack support. All features are software-only — no physical goods, no manual work. Access activates within seconds of Lemon Squeezy webhook.",
    img: "/demo/pricing.jpeg",
    live: "/constitution/pricing",
    liveLabel: "See pricing →",
  },
  {
    id: "leaderboard",
    label: "04 / Planet Leaderboard",
    title: "Community — save, publish, compare scenarios",
    description:
      "Users sign scenarios with QSign HMAC-SHA256 and publish to the Planet leaderboard. Each artifact is verifiable: POST { payload, signature } to /api/qsign/verify. Side-by-side scenario comparison, cosine similarity search ('find scenarios like mine'), voting 👍👎, comments. All social features work on the Free tier.",
    img: "/demo/leaderboard.jpeg",
    live: "/constitution/leaderboard",
    liveLabel: "Open Leaderboard →",
  },
  {
    id: "api",
    label: "05 / Developer API",
    title: "Public REST API — 22 endpoints, 1-hour cache",
    description:
      "Live curl/TypeScript/Python code generation as you drag the sliders. 22 endpoints: public read-only (regimes, presets, countries, sliders-spec, all 1h cached), scenario CRUD, Planet artifacts, AI advisor (SSE stream), PDF export, social (vote/comment). Open-source — anyone can host, but the hosted SaaS includes community, auto-updates, and the shared Planet leaderboard.",
    img: "/demo/api.jpeg",
    live: "/constitution/api",
    liveLabel: "Open API Playground →",
  },
  {
    id: "stats",
    label: "06 / Analytics",
    title: "Real-time analytics — regime distribution + trends",
    description:
      "Which regimes are users building most? Constitution Stats shows regime distribution (bar chart), 8-slider histograms (mean + 5-bucket distribution), and 30-day publishing trend sparkline. All data is from the live Postgres database. No third-party analytics — own infrastructure.",
    img: "/demo/stats.jpeg",
    live: "/constitution/stats",
    liveLabel: "Open Analytics →",
  },
];

export default function ConstitutionDemoPage() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 8000);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[idx];

  return (
    <div style={{ minHeight: "100vh", background: "#050a1a", color: "#e7ecf8", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0b1736", borderBottom: "1px solid rgba(212,175,55,0.25)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#d4af37", fontWeight: 900, fontSize: 20 }}>AEVION</span>
          <span style={{ color: "#9aa3c0", fontSize: 13 }}>Constitution — Product Demo</span>
          <span style={{ background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)", color: "#d4af37", fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>KYB REVIEW</span>
        </div>
        <Link href="/constitution" style={{ color: "#d4af37", fontSize: 13, textDecoration: "none" }}>
          Open live product →
        </Link>
      </div>

      {/* Hero tagline */}
      <div style={{ textAlign: "center", padding: "32px 24px 16px" }}>
        <h1 style={{ color: "#d4af37", fontSize: 28, fontWeight: 900, margin: 0 }}>
          Political-Economy Simulator · SaaS · Instant Digital Delivery
        </h1>
        <p style={{ color: "#9aa3c0", marginTop: 8, fontSize: 14, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          Users drag 8 governance sliders and see which historical regime their society slides into.
          Based on North/Wallis/Weingast, Acemoglu/Robinson, Elinor Ostrom, Nassim Taleb.
        </p>
      </div>

      {/* Slide tabs */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", padding: "0 24px 16px" }}>
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setIdx(i); setPaused(true); }}
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              border: i === idx ? "1px solid #d4af37" : "1px solid rgba(212,175,55,0.25)",
              background: i === idx ? "rgba(212,175,55,0.15)" : "transparent",
              color: i === idx ? "#d4af37" : "#9aa3c0",
              fontSize: 12,
              fontWeight: i === idx ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main slide */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        {/* Screenshot */}
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(212,175,55,0.2)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
          <Image
            key={slide.id}
            src={slide.img}
            alt={slide.title}
            width={900}
            height={562}
            style={{ width: "100%", height: "auto", display: "block" }}
            priority
          />
          <div style={{ position: "absolute", bottom: 12, right: 12 }}>
            <Link
              href={slide.live}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: "#d4af37",
                color: "#0b1736",
                fontWeight: 700,
                fontSize: 13,
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              {slide.liveLabel}
            </Link>
          </div>
        </div>

        {/* Description */}
        <div style={{ paddingTop: 8 }}>
          <div style={{ color: "#9aa3c0", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            {slide.label}
          </div>
          <h2 style={{ color: "#f5d27a", fontSize: 24, fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
            {slide.title}
          </h2>
          <p style={{ color: "#e7ecf8", lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>
            {slide.description}
          </p>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {SLIDES.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: i === idx ? "#d4af37" : "rgba(212,175,55,0.2)",
                  flex: i === idx ? 3 : 1,
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => { setIdx((idx - 1 + SLIDES.length) % SLIDES.length); setPaused(true); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(212,175,55,0.35)", background: "transparent", color: "#d4af37", cursor: "pointer", fontSize: 13 }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => { setIdx((idx + 1) % SLIDES.length); setPaused(false); }}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#d4af37", color: "#0b1736", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              Next →
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9aa3c0", cursor: "pointer", fontSize: 12 }}
            >
              {paused ? "▶ Auto-play" : "⏸ Pause"}
            </button>
          </div>
        </div>
      </div>

      {/* Fulfillment + product facts for KYB */}
      <div style={{ background: "#0b1736", borderTop: "1px solid rgba(212,175,55,0.15)", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          <Fact title="⚡ Instant Digital Delivery" text="Lemon Squeezy webhook fires subscription_created → server provisions Pro tier within seconds → watermarks removed, AI limits lifted. Zero manual steps." />
          <Fact title="🏗️ SaaS Platform" text="Constitution is 1 of 30+ modules on AEVION (aevion.app). Other modules: Bank, Chess, QRight IP registry, AI playground, Smeta trainer. Full open-source on GitHub." />
          <Fact title="🔒 No Physical Goods" text="Purely digital: sliders + data + AI requests + PDFs. No downloads, no shipping, no custom services. All computation on Railway (Node.js + Postgres)." />
        </div>
      </div>

      {/* Footer with all links */}
      <div style={{ padding: "20px 24px", textAlign: "center", borderTop: "1px solid rgba(212,175,55,0.1)" }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", fontSize: 13, color: "#9aa3c0" }}>
          <Link href="/constitution" style={{ color: "#d4af37" }}>Live product</Link>
          <Link href="/constitution/pricing" style={{ color: "#9aa3c0" }}>Pricing</Link>
          <Link href="/constitution/learn" style={{ color: "#9aa3c0" }}>Academy</Link>
          <Link href="/constitution/api" style={{ color: "#9aa3c0" }}>API docs</Link>
          <Link href="/constitution/leaderboard" style={{ color: "#9aa3c0" }}>Leaderboard</Link>
          <a href="https://github.com/Dossymbek281078/AEVION" style={{ color: "#9aa3c0" }} target="_blank" rel="noreferrer">GitHub (open source)</a>
        </div>
        <p style={{ marginTop: 12, color: "#475569", fontSize: 11 }}>
          aevion.app · Constitution module · SaaS subscription · Instant digital delivery · No physical goods
        </p>
      </div>
    </div>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: 16 }}>
      <div style={{ fontWeight: 700, color: "#f5d27a", marginBottom: 8, fontSize: 14 }}>{title}</div>
      <div style={{ color: "#9aa3c0", fontSize: 13, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}
