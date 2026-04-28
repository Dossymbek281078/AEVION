"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { useI18n } from "@/lib/i18n";

type FAQ = { q: string; a: string };
type FaqCategory = "users" | "investors";

const investorFaqs: FAQ[] = [
  {
    q: "How is AEVION worth $1B+?",
    a: "Five independent axes: (1) first-mover monopoly on a unified IP+signature+bureau+compliance+wallet pipeline; (2) Trust Graph data moat that compounds with every action; (3) cross-vertical revenue across $340B TAM (IP, creator economy, payments) from a single codebase; (4) quantum-resistant crypto stack as institutional-grade trust signal; (5) 27 modules with near-zero marginal cost per node. The full breakdown lives at /pitch.",
  },
  {
    q: "What is the round size and use of proceeds?",
    a: "Raising for an 18-month sprint: harden the 12 launched MVPs, ship 4 of the 15 emerging nodes, lock 2 enterprise compliance pilots, and open 3 international IP-bureau partnerships. Capital allocation: ~50% engineering, ~30% GTM in three creator verticals, ~20% regulatory and partnerships.",
  },
  {
    q: "What is the revenue model?",
    a: "Three independent revenue streams composing on the same codebase: (1) per-certificate and per-verification SaaS for IP Bureau and Planet; (2) take-rate on AEVION Bank flows (royalties, advances, payouts); (3) seat licensing for QCoreAI / Multichat enterprise agents. We sell the same Trust Graph three times to three different buyers.",
  },
  {
    q: "Who are your competitors?",
    a: "Notarize and DocuSign for signatures, OpenTimestamps for blockchain proof, Stripe Atlas for creator payments, USPTO/EPO/WIPO for traditional IP filing, generic AI assistants for the QCoreAI surface. None of them offer the bundled pipeline. The detailed breakdown — with our advantage per competitor — is the 'Competition' section on /pitch.",
  },
  {
    q: "What is your moat?",
    a: "Four compounding network effects: data (Trust Graph edges accumulate), economic (creators ↔ fans through Bank), switching cost (the average user has 6+ scheduled flows after 90 days), and scope (every new module makes the existing modules more valuable at zero marginal cost). The graph is non-replicable after ~10K active users.",
  },
  {
    q: "What about regulation?",
    a: "Bureau cites six standing international frameworks (Berne, WIPO, TRIPS, eIDAS, ESIGN, KZ Digital Sig) — we ride the standards bodies, not predict them. Planet's voting layer adapts the validator quorum if frameworks shift. We partner with national IP bureaus rather than competing with them.",
  },
  {
    q: "What is the team and burn?",
    a: "Lean technical team, capital-efficient: 12 working MVPs already shipped at minimal cash burn — proof of execution velocity. Specific team and burn details available under NDA via the investor demo (mailto link in the ask section of /pitch).",
  },
  {
    q: "What is the exit strategy?",
    a: "Two natural paths. (A) Strategic acquisition by a major IP/legal/finance incumbent who needs the modern stack (Thomson Reuters, RELX, Stripe, Adobe). (B) IPO route via the compliance/Trust-OS positioning — comparable public market multiples favour platform plays over single-vertical SaaS.",
  },
  {
    q: "Why now?",
    a: "Three converging timing signals: (1) AI-generated content is exploding without an IP attribution layer; (2) post-quantum cryptography is becoming a board-level concern, and we're already shipping it; (3) creator-economy payouts are fragmented across 5+ vendors per creator — the bundling opportunity is at its peak.",
  },
  {
    q: "What are the biggest risks?",
    a: "Honestly listed at /pitch in the Risks section: regulatory drift, cold-start on Trust Graph density, LLM cost compression, single-vertical competitors, execution focus across 27 nodes, and post-quantum cliff. Each risk has a mitigation tied to a shipped product feature, not just a slide bullet.",
  },
  {
    q: "Can I see live product, not just slides?",
    a: "Yes — every module on /pitch is a working MVP. /qright registers IP in seconds. /bureau issues court-grade certificates. /bank is a 5-tab multilingual dashboard with 18 features. /pitch itself shows live API metrics in the hero (green pill = backend up). To book a guided walkthrough: yahiin1978@gmail.com.",
  },
  {
    q: "How do I follow up?",
    a: "Email yahiin1978@gmail.com with subject 'AEVION investor demo'. We'll set up a 30-minute live walk-through (screen share, real backend, real data) and follow with a tailored deep-dive deck under NDA.",
  },
];

const faqs: FAQ[] = [
  {
    q: "What is AEVION?",
    a: "AEVION is a global trust infrastructure platform for digital content and intellectual property. It includes IP registration (QRight), cryptographic signatures (QSign), a patent bureau, compliance certification (Planet), creator awards, a digital bank, and more — all connected through a single identity and trust system.",
  },
  {
    q: "How do I register my intellectual property?",
    a: "Go to Auth → create an account → go to QRight → fill in the title and description of your work → click 'Register'. Your content gets a cryptographic hash and timestamp that proves you had the content at this moment.",
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
    a: "Yes. We use Quantum Shield cryptography (Ed25519 + Shamir Secret Sharing), encrypted storage, and Merkle-tree audit trails. Your passwords are hashed. Your private data is never exposed through the public Trust Graph.",
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
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const [category, setCategory] = useState<FaqCategory>("users");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = new URLSearchParams(window.location.search).get("q") || "";
    if (initial) {
      setQuery(initial);
      const lower = initial.toLowerCase();
      const inUsers = faqs.some((f) => (f.q + " " + f.a).toLowerCase().includes(lower));
      const inInvestors = investorFaqs.some((f) => (f.q + " " + f.a).toLowerCase().includes(lower));
      if (!inUsers && inInvestors) setCategory("investors");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, [query]);

  const baseFaqs = category === "investors" ? investorFaqs : faqs;
  const activeFaqs = useMemo(() => {
    if (!query.trim()) return baseFaqs;
    const lower = query.trim().toLowerCase();
    return baseFaqs.filter((f) => (f.q + " " + f.a).toLowerCase().includes(lower));
  }, [baseFaqs, query]);

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
              {t("helpRoot.h1")}
            </h1>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
              {t("helpRoot.subtitle")}
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
            { label: t("helpRoot.qlink.start.label"),  href: "/auth",       desc: t("helpRoot.qlink.start.desc") },
            { label: t("helpRoot.qlink.qright.label"), href: "/qright",     desc: t("helpRoot.qlink.qright.desc") },
            { label: t("helpRoot.qlink.planet.label"), href: "/planet",     desc: t("helpRoot.qlink.planet.desc") },
            { label: t("helpRoot.qlink.awards.label"), href: "/awards",     desc: t("helpRoot.qlink.awards.desc") },
            { label: t("helpRoot.qlink.bank.label"),   href: "/bank",       desc: t("helpRoot.qlink.bank.desc") },
            { label: t("helpRoot.qlink.chess.label"),  href: "/cyberchess", desc: t("helpRoot.qlink.chess.desc") },
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

        {/* FAQ search */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <label htmlFor="help-search" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            {t("helpRoot.search.label")}
          </label>
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(null); }}
            placeholder={t("helpRoot.search.placeholder")}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 14,
              fontWeight: 600,
              outline: "none",
              background: "#fff",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* FAQ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("helpRoot.faq.title")}</h2>
          <div
            role="tablist"
            aria-label="FAQ audience"
            style={{
              display: "inline-flex",
              gap: 0,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {(["users", "investors"] as const).map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setCategory(c); setOpen(null); }}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 800,
                    border: "none",
                    background: active
                      ? (c === "investors" ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : "linear-gradient(135deg, #0d9488, #0ea5e9)")
                      : "transparent",
                    color: active ? "#fff" : "#334155",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {c === "investors" ? t("helpRoot.faq.tab.investors") : t("helpRoot.faq.tab.users")}
                </button>
              );
            })}
          </div>
        </div>
        {category === "investors" ? (
          <p
            style={{
              fontSize: 13,
              color: "#475569",
              lineHeight: 1.55,
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            {t("helpRoot.faq.investorBanner")}{" "}
            <Link href="/pitch" style={{ color: "#b45309", fontWeight: 800 }}>
              /pitch
            </Link>
            .
          </p>
        ) : null}
        {activeFaqs.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              border: "1px dashed rgba(15,23,42,0.2)",
              borderRadius: 12,
              fontSize: 14,
              color: "#475569",
              textAlign: "center",
            }}
          >
            {t(category === "investors" ? "helpRoot.faq.empty.investors" : "helpRoot.faq.empty.users", { q: query })}{" "}
            <a href="mailto:yahiin1978@gmail.com" style={{ color: "#0d9488", fontWeight: 700 }}>
              yahiin1978@gmail.com
            </a>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 8 }}>
          {activeFaqs.map((faq, i) => (
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
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{t("helpRoot.contact.title")}</div>
          <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            {t("helpRoot.contact.body")}{" "}
            <Link href="/demo" style={{ color: "#0d9488", fontWeight: 700 }}>{t("helpRoot.contact.demoLink")}</Link>{" "}
            {t("helpRoot.contact.bodyTail")}
          </p>
        </div>
      </ProductPageShell>
    </main>
  );
}
