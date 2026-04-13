"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

type Stats = { works: number; certificates: number; shields: number; verifications: number; modules: number };

export default function DemoPage() {
  const [stats, setStats] = useState<Stats>({ works: 0, certificates: 0, shields: 0, verifications: 0, modules: 29 });

  useEffect(() => {
    (async () => {
      try {
        const [qr, cert, shield] = await Promise.all([
          fetch(apiUrl("/api/qright/objects")).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
          fetch(apiUrl("/api/pipeline/certificates")).then(r => r.ok ? r.json() : { certificates: [] }).catch(() => ({ certificates: [] })),
          fetch(apiUrl("/api/quantum-shield/stats")).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        ]);
        const certs = cert.certificates || [];
        setStats({
          works: (qr.items || []).length,
          certificates: certs.length,
          shields: (shield as any).totalRecords || 0,
          verifications: certs.reduce((s: number, c: any) => s + (c.verifiedCount || 0), 0),
          modules: 29,
        });
      } catch {}
    })();
  }, []);

  const steps = [
    {
      n: "1",
      title: "Create an Account",
      desc: "Register with name, email, and password. You get a JWT token that works across all 29 modules.",
      action: "Create Account →",
      href: "/auth",
      color: "#0f172a",
      icon: "👤",
      time: "10 seconds",
    },
    {
      n: "2",
      title: "Protect Your Work",
      desc: "Describe your creative work — music, code, design, or any content. One click gives you SHA-256 hash, HMAC-SHA256 signature, Ed25519 digital signature, and Shamir's Secret Sharing protection.",
      action: "Protect a Work →",
      href: "/qright",
      color: "#0d9488",
      icon: "🛡️",
      time: "5 seconds",
    },
    {
      n: "3",
      title: "Get Your Certificate",
      desc: "Instantly receive an IP Protection Certificate with QR code, legal basis under Berne Convention, WIPO, and TRIPS. Download as PDF or share the public verification link.",
      action: "View IP Bureau →",
      href: "/bureau",
      color: "#3b82f6",
      icon: "📜",
      time: "Instant",
    },
    {
      n: "4",
      title: "Verify Publicly",
      desc: "Anyone can verify your certificate — a court, an investor, or another creator. Just scan the QR code or open the verification link. All integrity checks displayed.",
      action: "Try Verification →",
      href: "/qsign",
      color: "#8b5cf6",
      icon: "🔍",
      time: "2 seconds",
    },
    {
      n: "5",
      title: "Manage Your Wallet",
      desc: "AEVION Bank gives you digital wallets with AEC credits. Transfer between accounts, track operations, export CSV. Royalties from content usage are paid automatically.",
      action: "Open Bank →",
      href: "/bank",
      color: "#f59e0b",
      icon: "🏦",
      time: "Ready",
    },
    {
      n: "6",
      title: "Ask AI Assistant",
      desc: "QCoreAI gives you access to 5 AI providers — Claude, GPT-4, Gemini, DeepSeek, Grok. Switch models with one click. Get help with anything.",
      action: "Chat with AI →",
      href: "/qcoreai",
      color: "#06b6d4",
      icon: "🤖",
      time: "Ready",
    },
  ];

  return (
    <main style={{ padding: 0 }}>
      {/* ── Dark Hero ── */}
      <section style={{ background: "linear-gradient(145deg, #020617, #0f172a 40%, #1e1b4b 100%)", color: "#fff", padding: "48px 24px 56px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Wave1Nav variant="dark" />
          <div style={{ marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#5eead4" }}>INTERACTIVE DEMO · INVESTOR WALKTHROUGH</div>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 900, lineHeight: 1.08, margin: "0 0 16px", letterSpacing: "-0.03em" }}>
            See AEVION in Action
          </h1>
          <p style={{ fontSize: 17, opacity: 0.85, maxWidth: 640, lineHeight: 1.6, margin: "0 0 32px" }}>
            Follow 6 steps to experience the full platform — from account creation to IP protection, PDF certificates, digital banking, and AI. Every step uses real APIs with real data.
          </p>

          {/* Live stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            {[
              { label: "Protected Works", value: stats.works, color: "#0d9488" },
              { label: "IP Certificates", value: stats.certificates, color: "#3b82f6" },
              { label: "Quantum Shields", value: stats.shields, color: "#8b5cf6" },
              { label: "Verifications", value: stats.verifications, color: "#f59e0b" },
              { label: "Modules", value: stats.modules, color: "#10b981" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 60px" }}>
        {/* ── Step-by-step Guide ── */}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0d9488", marginBottom: 8 }}>GUIDED TOUR</div>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: "0 0 28px" }}>6 Steps to Full IP Protection</h2>

        <div style={{ display: "grid", gap: 16, marginBottom: 40 }}>
          {steps.map((step) => (
            <div key={step.n} style={{ display: "flex", gap: 20, padding: "24px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
              {/* Step number */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: step.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900 }}>
                  {step.icon}
                </div>
                <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#94a3b8", marginTop: 6 }}>STEP {step.n}</div>
              </div>
              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{step.title}</h3>
                  <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: `${step.color}12`, color: step.color }}>{step.time}</span>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{step.desc}</p>
                <Link href={step.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: step.color, color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
                  {step.action}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── Technology Stack ── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>Technology & Security</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { title: "3-Layer Cryptography", items: ["SHA-256 content hashing (NIST)", "HMAC-SHA256 integrity signatures", "Ed25519 digital signatures (RFC 8032)"], color: "#0d9488" },
              { title: "Quantum Shield", items: ["Shamir's Secret Sharing", "Threshold 2-of-3 recovery", "Distributed shard storage"], color: "#8b5cf6" },
              { title: "Legal Framework", items: ["Berne Convention (181 countries)", "WIPO Copyright Treaty", "TRIPS, eIDAS, ESIGN, KZ Law"], color: "#3b82f6" },
              { title: "Platform Stack", items: ["Next.js 16 + Express + PostgreSQL", "Railway (backend) + Vercel (frontend)", "Real-time WebSocket + REST API"], color: "#f59e0b" },
            ].map((section) => (
              <div key={section.title} style={{ padding: "18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: section.color }} />
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{section.title}</span>
                </div>
                {section.items.map((item) => (
                  <div key={item} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: section.color }}>•</span>
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Investment Opportunity ── */}
        <div style={{ padding: "28px", borderRadius: 20, background: "linear-gradient(135deg, #0f172a, #1e1b4b)", color: "#fff", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 8 }}>INVESTMENT</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 20px" }}>Two Options for Investors</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: "20px", borderRadius: 14, border: "1px solid rgba(13,148,136,0.3)", background: "rgba(13,148,136,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#5eead4", marginBottom: 4 }}>OPTION A</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>$10M Co-Development</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                Investor: 49% equity. Founder: 51%. Joint development of the platform. Investor gets board seat, revenue share, and exit rights.
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)" }}>Board seat</span>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)" }}>Revenue share</span>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)" }}>Co-development</span>
              </div>
            </div>
            <div style={{ padding: "20px", borderRadius: 14, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", marginBottom: 4 }}>OPTION B</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>$100M Full Acquisition</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                Investor: 90% equity. Founder: 10% + Chief Product Advisor role at $1.2M/year. Full control of the platform and IP.
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)" }}>Full control</span>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)" }}>All IP rights</span>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.08)" }}>Founder retained</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div style={{ textAlign: "center", padding: "40px 20px", borderRadius: 20, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff" }}>
          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Ready to try AEVION?</div>
          <div style={{ fontSize: 15, opacity: 0.9, marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
            Start with Step 1 — create an account and protect your first work. The entire pipeline takes under a minute.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth" style={{ padding: "14px 28px", borderRadius: 14, background: "#fff", color: "#0f172a", fontWeight: 900, fontSize: 16, textDecoration: "none" }}>
              Start Demo — Create Account
            </Link>
            <Link href="/" style={{ padding: "14px 28px", borderRadius: 14, border: "2px solid rgba(255,255,255,0.5)", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
              Back to Homepage
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}