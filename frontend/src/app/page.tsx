"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import Globus3D from "./components/Globus3D";
import Globus3DPlaceholder from "./components/Globus3DPlaceholder";

type GlobusProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
  tags: string[];
  runtime?: { tier: string; primaryPath: string | null; apiHints: string[]; hint: string };
};

export default function HomePage() {
  const [globeClient, setGlobeClient] = useState(false);
  useEffect(() => { setGlobeClient(true); }, []);

  const [projects, setProjects] = useState<GlobusProject[]>([]);
  const [qrightObjects, setQRightObjects] = useState<Array<{ id: string; title: string; country?: string; city?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ certificates: 0, shields: 0, verifications: 0, accounts: 0 });

  const [selectedGeo, setSelectedGeo] = useState<{ country?: string; city?: string }>({});
  const navigate = useCallback((href: string) => { window.location.href = href; }, []);
  const onSelectLocation = useCallback((geo: { country?: string; city?: string }) => { setSelectedGeo(geo); }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [pr, qr, cert, shield] = await Promise.all([
          fetch(apiUrl("/api/globus/projects")).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
          fetch(apiUrl("/api/qright/objects")).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
          fetch(apiUrl("/api/pipeline/certificates")).then(r => r.ok ? r.json() : { certificates: [] }).catch(() => ({ certificates: [] })),
          fetch(apiUrl("/api/quantum-shield/stats")).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        ]);
        setProjects(pr.items || []);
        setQRightObjects(qr.items || []);
        const certs = cert.certificates || [];
        const totalVerifications = certs.reduce((s: number, c: any) => s + (c.verifiedCount || 0), 0);
        setStats({
          certificates: certs.length,
          shields: shield.totalRecords || 0,
          verifications: totalVerifications,
          accounts: 3,
        });
      } catch {
        setProjects([]);
        setQRightObjects([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => (a.priority || 0) - (b.priority || 0)), [projects]);
  const focusIds = useMemo(() => sortedProjects.slice(0, 3).map(p => p.id), [sortedProjects]);

  return (
    <main style={{ padding: 0 }}>
      {/* ══════════════════════════════════════════════════
          HERO SECTION
         ══════════════════════════════════════════════════ */}
      <section style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)", color: "#fff", padding: "48px 24px 56px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 999, background: "rgba(13,148,136,0.2)", border: "1px solid rgba(13,148,136,0.4)", color: "#5eead4", marginBottom: 20 }}>
            The World's First Digital Patent Bureau
          </div>

          <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, lineHeight: 1.08, margin: "0 0 16px", maxWidth: 800, letterSpacing: "-0.03em" }}>
            Protect your ideas.<br />Prove your authorship.<br />Earn from your work.
          </h1>

          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", opacity: 0.85, maxWidth: 640, lineHeight: 1.65, margin: "0 0 32px" }}>
            AEVION gives creators military-grade cryptographic protection for intellectual property — with one click. Backed by international copyright law. No lawyers needed.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
            <Link href="/qright" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 14, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 900, fontSize: 16, textDecoration: "none", boxShadow: "0 4px 20px rgba(13,148,136,0.4)" }}>
              🛡️ Protect Your Work — Free
            </Link>
            <Link href="/bureau" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "14px 24px", borderRadius: 14, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              View IP Bureau
            </Link>
            <Link href="/qcoreai" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "14px 24px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              🤖 Ask AI Assistant
            </Link>
          </div>

          {/* Live stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { label: "Protected Works", value: loading ? "..." : String(qrightObjects.length), color: "#0d9488" },
              { label: "IP Certificates", value: loading ? "..." : String(stats.certificates), color: "#3b82f6" },
              { label: "Quantum Shields", value: loading ? "..." : String(stats.shields), color: "#8b5cf6" },
              { label: "Verifications", value: loading ? "..." : String(stats.verifications), color: "#f59e0b" },
              { label: "Ecosystem Modules", value: loading ? "..." : String(projects.length || 29), color: "#10b981" },
              { label: "AI Providers", value: "5", color: "#06b6d4" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 60px" }}>

        {/* ══════════════════════════════════════════════════
            HOW IT WORKS — Pipeline
           ══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 40, padding: "32px 28px", borderRadius: 20, background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5eead4", marginBottom: 8 }}>ONE-CLICK IP PROTECTION</div>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 24px", letterSpacing: "-0.02em" }}>From idea to legal protection in 5 seconds</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { n: "1", title: "Describe", desc: "Tell us about your work — music, code, design, text, or any creative content", icon: "📋", color: "#0d9488" },
              { n: "2", title: "Register & Sign", desc: "SHA-256 hash + HMAC-SHA256 signature created instantly. Your content is now fingerprinted.", icon: "🔏", color: "#3b82f6" },
              { n: "3", title: "Quantum Shield", desc: "Ed25519 digital signature + Shamir's Secret Sharing splits the key into 3 shards. Military-grade.", icon: "🛡️", color: "#8b5cf6" },
              { n: "4", title: "Certificate", desc: "IP Certificate with QR code, legal basis (Berne Convention, WIPO), and public verification link.", icon: "📜", color: "#f59e0b" },
            ].map((s) => (
              <div key={s.n} style={{ padding: "20px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: s.color, marginBottom: 4 }}>STEP {s.n}</div>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <Link href="/qright" style={{ padding: "12px 24px", borderRadius: 12, background: "#0d9488", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              Try it now — protect your first work →
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            PRODUCT CARDS
           ══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 16 }}>Platform Products</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {[
              { icon: "🛡️", title: "QRight — IP Protection", desc: "One-click registration with SHA-256 hash, HMAC signature, and Quantum Shield. Get a PDF certificate with QR code.", href: "/qright", color: "#0d9488", tag: "CORE" },
              { icon: "⚖️", title: "IP Bureau", desc: "Digital Patent Bureau with certificate registry, public verification, and legal basis under Berne Convention.", href: "/bureau", color: "#3b82f6", tag: "LEGAL" },
              { icon: "🔏", title: "QSign — Verification", desc: "Verify any certificate's authenticity. Check content integrity, Quantum Shield status, and signature validity.", href: "/qsign", color: "#8b5cf6", tag: "CRYPTO" },
              { icon: "🛡️", title: "Quantum Shield", desc: "Ed25519 + Shamir's Secret Sharing. Your key split into 3 shards — 2 needed to reconstruct. Military-grade.", href: "/quantum-shield", color: "#6366f1", tag: "SECURITY" },
              { icon: "🏦", title: "AEVION Bank", desc: "Digital wallets, P2P transfers, automatic royalties. Real transactions, CSV export, Trust Graph linked.", href: "/bank", color: "#f59e0b", tag: "FINANCE" },
              { icon: "🤖", title: "QCoreAI", desc: "Multi-model AI assistant — Claude, GPT-4, Gemini, DeepSeek, Grok. Switch providers with one click.", href: "/qcoreai", color: "#06b6d4", tag: "AI" },
              { icon: "♟️", title: "CyberChess", desc: "Next-gen chess platform — play AI at 6 difficulty levels, solve puzzles, earn ratings.", href: "/cyberchess", color: "#10b981", tag: "GAMING" },
              { icon: "🏆", title: "Awards", desc: "Music and Film Awards — submit work via Planet, earn community votes and recognition.", href: "/awards", color: "#ef4444", tag: "AWARDS" },
            ].map((p) => (
              <Link key={p.title} href={p.href} style={{ textDecoration: "none", color: "inherit", padding: 20, borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", display: "block", transition: "box-shadow 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, background: `${p.color}15`, color: p.color }}>{p.tag}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{p.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            3D GLOBE + Ecosystem
           ══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 16 }}>Interactive Ecosystem Globe</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 400px", minWidth: 280 }}>
              {globeClient ? (
                <Globus3D projects={sortedProjects} qrightObjects={qrightObjects} focusProjectIds={focusIds} onNavigate={navigate} onSelectLocation={onSelectLocation} />
              ) : (
                <Globus3DPlaceholder />
              )}
              <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
                Location: <b style={{ color: "#0f172a" }}>{(selectedGeo.city || "—") + (selectedGeo.country ? `, ${selectedGeo.country}` : "")}</b>
              </div>
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 260 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 12 }}>29 Modules in 6 Verticals</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { v: "IP & Trust", modules: "QRight · QSign · Quantum Shield · IP Bureau · Trust Graph", color: "#0d9488" },
                  { v: "Finance", modules: "AEVION Bank · QTrade · Royalty Engine · Payments", color: "#f59e0b" },
                  { v: "AI & Intelligence", modules: "QCoreAI (5 providers) · Smart Routing · Analytics", color: "#06b6d4" },
                  { v: "Entertainment", modules: "CyberChess · Music Awards · Film Awards · AI Cinema", color: "#8b5cf6" },
                  { v: "Identity & Compliance", modules: "Auth · Planet Compliance · Certification", color: "#3b82f6" },
                  { v: "Infrastructure", modules: "3D Globe · API Gateway · WebSocket · Multilingual", color: "#64748b" },
                ].map((item) => (
                  <div key={item.v} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                      <span style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>{item.v}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{item.modules}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            INVESTOR SECTION
           ══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 40, padding: "28px", borderRadius: 20, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7c3aed", marginBottom: 8 }}>FOR INVESTORS</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 20px", color: "#0f172a" }}>Why AEVION is a $1B+ Opportunity</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {[
              { title: "First Digital Patent Bureau", metric: "Only 1", sub: "in the world", desc: "No one else offers one-click IP protection with cryptographic proof, Quantum Shield, and legal backing under Berne Convention." },
              { title: "$340B Addressable Market", metric: "$340B", sub: "TAM", desc: "IP licensing ($180B) + Creator economy ($104B) + Digital payments ($56B). AEVION sits at the intersection." },
              { title: "Working Product, Not Slides", metric: "29", sub: "live modules", desc: "Full pipeline deployed: protect → sign → shield → certify → earn. Try it yourself at aevion.vercel.app" },
              { title: "3-Layer Crypto Shield", metric: "3-layer", sub: "protection", desc: "SHA-256 + HMAC-SHA256 + Ed25519 with Shamir's Secret Sharing. No other IP platform has this." },
              { title: "5 AI Providers in One", metric: "5", sub: "AI models", desc: "Claude, GPT-4, Gemini, DeepSeek, Grok — best model per task. Multi-agent intelligence built-in." },
              { title: "Built for Global Scale", metric: "200M+", sub: "target creators", desc: "From Astana to the world. Multilingual, multi-currency, compliant with international IP frameworks." },
            ].map((card) => (
              <div key={card.title} style={{ padding: "18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.06)", background: "rgba(15,23,42,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", flex: 1 }}>{card.title}</div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 20, color: "#7c3aed" }}>{card.metric}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{card.sub}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{card.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/demo" style={{ padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
              Full Investor Demo →
            </Link>
            <Link href="/qright" style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.2)", color: "#0f172a", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Try the Pipeline →
            </Link>
            <Link href="/bureau" style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.2)", color: "#0f172a", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              View IP Bureau →
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            LEGAL FRAMEWORK
           ══════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>Legal Framework</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {[
              { name: "Berne Convention", scope: "181 countries", color: "#0d9488" },
              { name: "WIPO Copyright Treaty", scope: "International", color: "#3b82f6" },
              { name: "TRIPS Agreement (WTO)", scope: "164 countries", color: "#8b5cf6" },
              { name: "eIDAS Regulation", scope: "European Union", color: "#0ea5e9" },
              { name: "ESIGN Act", scope: "United States", color: "#6366f1" },
              { name: "KZ Digital Signature Law", scope: "Kazakhstan", color: "#f59e0b" },
            ].map((l) => (
              <div key={l.name} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                  <span style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>{l.name}</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: l.color }}>{l.scope}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            FOOTER CTA
           ══════════════════════════════════════════════════ */}
        <section style={{ textAlign: "center", padding: "40px 20px", borderRadius: 20, background: "linear-gradient(135deg, #0f172a, #1e1b4b)", color: "#fff", marginBottom: 20 }}>
          <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, letterSpacing: "-0.02em" }}>Ready to protect your work?</div>
          <div style={{ fontSize: 15, opacity: 0.8, marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
            One click. Military-grade cryptography. Legal backing in 181 countries. Free to start.
          </div>
          <Link href="/qright" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", borderRadius: 14, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 900, fontSize: 18, textDecoration: "none", boxShadow: "0 4px 24px rgba(13,148,136,0.4)" }}>
            🛡️ Protect My Work — Free
          </Link>
        </section>

        {/* Footer */}
        <footer style={{ padding: "20px 0", borderTop: "1px solid rgba(15,23,42,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            <b style={{ color: "#0f172a" }}>AEVION</b> · Trust Infrastructure for the Digital World · Astana, Kazakhstan
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
            <Link href="/bureau" style={{ color: "#64748b", textDecoration: "none" }}>IP Bureau</Link>
            <Link href="/qright" style={{ color: "#64748b", textDecoration: "none" }}>QRight</Link>
            <Link href="/bank" style={{ color: "#64748b", textDecoration: "none" }}>Bank</Link>
            <Link href="/qcoreai" style={{ color: "#64748b", textDecoration: "none" }}>AI</Link>
            <a href="mailto:yahiin1978@gmail.com" style={{ color: "#64748b", textDecoration: "none" }}>Contact</a>
          </div>
        </footer>
      </div>
    </main>
  );
}