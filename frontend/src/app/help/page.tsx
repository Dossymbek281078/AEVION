"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";

type FAQ = { q: string; a: string };

const faqs: FAQ[] = [
  {
    q: "What is AEVION?",
    a: "AEVION is a global trust infrastructure for digital content and IP. The flagship is QRight — register a work and walk away with a self-contained cryptographic proof of authorship that holds up offline, anchored to Bitcoin, even if AEVION shuts down. Around it: QSign (signatures), IP Bureau (Verified-tier KYC), Planet (compliance certification), creator Awards, a digital bank, and CyberChess — all stitched together by one identity and one trust graph.",
  },
  {
    q: "How do I register my intellectual property?",
    a: "Auth → create an account → QRight → fill title + description → click Protect. You walk away with: a SHA-256 content fingerprint, AEVION + your-browser Ed25519 co-signatures, a Shamir-split private key (any 2 of 3 shards reconstruct it; AEVION holds at most 1), an OpenTimestamps proof anchored in a Bitcoin block, and a Verification Bundle .json anyone can verify offline forever — even if AEVION shuts down.",
  },
  {
    q: "What is Planet Compliance?",
    a: "Planet is a verification layer. When you submit an artifact (code, music, film), Planet runs validators to check originality and compliance. If passed, you receive a certificate. Other users can vote on your work by category.",
  },
  {
    q: "How does AEVION Bank work?",
    a: "AEVION Bank is a digital wallet inside the ecosystem. You earn AEVION Credits (AEC) from royalties, awards, and direct transfers. You can send AEC to other creators, receive automatic royalties when your content is used, and withdraw to external accounts.",
  },
  {
    q: "What are AEVION Awards?",
    a: "AEVION runs two award tracks: Music Awards (for AI and digital music) and Film Awards (for AI and digital cinema). Submit work through Planet, get certified, and the community votes. Top works win awards and AEC prizes.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Quantum Shield combines Ed25519 with Shamir 2-of-3 Secret Sharing — the signing key is split across independent locations, AEVION holds at most one shard. QRight certificates also carry a co-signature held only in your browser, so even a full platform breach cannot forge new claims under your identity. Storage is encrypted, audit trails are Merkle-rooted, passwords are hashed, and private data never reaches the public Trust Graph.",
  },
  {
    q: "How does CyberChess work?",
    a: "CyberChess is a chess platform within AEVION. Play against AI in your browser. Coming soon: rated games, tournaments with AEC prize pools, anti-cheat powered by Trust Graph, and live streaming.",
  },
  {
    q: "Can I use AEVION for free?",
    a: "Core features (registration, signing, bureau, planet submission) are free. Premium features (advanced analytics, priority compliance, tournament entry) will have paid tiers. During MVP, everything is free.",
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <Wave1Nav />

        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              padding: "28px 24px 20px",
              color: "#fff",
            }}
          >
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
              Help Center
            </h1>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
              Everything you need to know about using AEVION. Can&apos;t find an answer? Email us at yahiin1978@gmail.com
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Getting started", href: "/auth", desc: "Create your account" },
            { label: "Register IP", href: "/qright", desc: "Protect your work" },
            { label: "Planet", href: "/planet", desc: "Get certified" },
            { label: "Awards", href: "/awards", desc: "Win recognition" },
            { label: "Bank", href: "/bank", desc: "Manage earnings" },
            { label: "CyberChess", href: "/cyberchess", desc: "Play chess" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.1)",
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
            </Link>
          ))}
        </div>

        {/* FAQ */}
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>Frequently asked questions</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                border: "1px solid rgba(15,23,42,0.1)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "none",
                  background: open === i ? "rgba(15,23,42,0.03)" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {faq.q}
                <span style={{ fontSize: 18, color: "#94a3b8", flexShrink: 0, marginLeft: 12 }}>
                  {open === i ? "−" : "+"}
                </span>
              </button>
              {open === i ? (
                <div
                  style={{
                    padding: "0 16px 14px",
                    fontSize: 14,
                    color: "#475569",
                    lineHeight: 1.65,
                  }}
                >
                  {faq.a}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Contact */}
        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Still need help?</div>
          <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            Email us at <a href="mailto:yahiin1978@gmail.com" style={{ color: "#0d9488", fontWeight: 700 }}>yahiin1978@gmail.com</a> and 
            we will get back to you within 24 hours. You can also check our{" "}
            <Link href="/demo" style={{ color: "#0d9488", fontWeight: 700 }}>full demo</Link> for a walkthrough of all features.
          </p>
        </div>
      </ProductPageShell>
    </main>
  );
}
