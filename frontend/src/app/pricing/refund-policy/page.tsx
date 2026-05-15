"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

export default function PricingRefundPolicyPage() {
  const tp = usePricingT();

  useEffect(() => {
    track({ type: "page_view", source: "pricing/refund-policy" });
  }, []);

  const sections = [
    {
      id: "money-back",
      icon: "↩",
      color: "#0d9488",
      title: tp("refund.section.moneyBack.title"),
      body: tp("refund.section.moneyBack.body"),
      bullets: [
        tp("refund.section.moneyBack.b1"),
        tp("refund.section.moneyBack.b2"),
        tp("refund.section.moneyBack.b3"),
      ],
    },
    {
      id: "downgrade",
      icon: "↓",
      color: "#0ea5e9",
      title: tp("refund.section.downgrade.title"),
      body: tp("refund.section.downgrade.body"),
      bullets: [
        tp("refund.section.downgrade.b1"),
        tp("refund.section.downgrade.b2"),
        tp("refund.section.downgrade.b3"),
      ],
    },
    {
      id: "annual",
      icon: "📅",
      color: "#7c3aed",
      title: tp("refund.section.annual.title"),
      body: tp("refund.section.annual.body"),
      bullets: [
        tp("refund.section.annual.b1"),
        tp("refund.section.annual.b2"),
        tp("refund.section.annual.b3"),
      ],
    },
    {
      id: "usage",
      icon: "⚖",
      color: "#f59e0b",
      title: tp("refund.section.usage.title"),
      body: tp("refund.section.usage.body"),
      bullets: [
        tp("refund.section.usage.b1"),
        tp("refund.section.usage.b2"),
      ],
    },
    {
      id: "enterprise",
      icon: "🏢",
      color: "#475569",
      title: tp("refund.section.enterprise.title"),
      body: tp("refund.section.enterprise.body"),
      bullets: [
        tp("refund.section.enterprise.b1"),
        tp("refund.section.enterprise.b2"),
      ],
    },
    {
      id: "data",
      icon: "💾",
      color: "#be185d",
      title: tp("refund.section.data.title"),
      body: tp("refund.section.data.body"),
      bullets: [
        tp("refund.section.data.b1"),
        tp("refund.section.data.b2"),
        tp("refund.section.data.b3"),
      ],
    },
  ];

  return (
    <ProductPageShell maxWidth={920}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("refund.badge")}
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("refund.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("refund.subtitle")}
        </p>
      </section>

      {/* TL;DR */}
      <section
        style={{
          marginBottom: 32,
          padding: 20,
          background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(14,165,233,0.06))",
          border: "1px solid rgba(13,148,136,0.15)",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "#0d9488",
            marginBottom: 10,
          }}
        >
          {tp("refund.tldr.title")}
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            tp("refund.tldr.p1"),
            tp("refund.tldr.p2"),
            tp("refund.tldr.p3"),
            tp("refund.tldr.p4"),
          ].map((t, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 14,
                color: "#0f172a",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "#0d9488", fontWeight: 800, flexShrink: 0 }}>✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sections */}
      <section style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
        {sections.map((s) => (
          <article
            key={s.id}
            id={s.id}
            style={{
              background: "#fff",
              border: BORDER,
              borderRadius: 14,
              padding: 24,
              boxShadow: CARD,
              scrollMarginTop: 80,
            }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: s.color,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                {s.icon}
              </div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  margin: 0,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                }}
              >
                {s.title}
              </h2>
            </header>
            <p
              style={{
                fontSize: 14,
                color: "#475569",
                margin: 0,
                marginBottom: 12,
                lineHeight: 1.6,
              }}
            >
              {s.body}
            </p>
            <ul style={{ margin: 0, padding: 0, paddingLeft: 22, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      {/* Process timeline */}
      <section
        style={{
          marginBottom: 32,
          padding: 24,
          background: "#0f172a",
          color: "#f8fafc",
          borderRadius: 16,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {tp("refund.process.title")}
        </h2>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 20, fontSize: 14 }}>
          {tp("refund.process.subtitle")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { day: "0", title: tp("refund.process.s1.title"), body: tp("refund.process.s1.body") },
            { day: "1", title: tp("refund.process.s2.title"), body: tp("refund.process.s2.body") },
            { day: "3-5", title: tp("refund.process.s3.title"), body: tp("refund.process.s3.body") },
            { day: "5-10", title: tp("refund.process.s4.title"), body: tp("refund.process.s4.body") },
          ].map((step, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 14,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 56,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#5eead4",
                  letterSpacing: "0.04em",
                  alignSelf: "center",
                }}
              >
                {step.day === "0" ? tp("refund.process.day0") : `${tp("refund.process.dayLabel")} ${step.day}`}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section
        style={{
          marginBottom: 56,
          padding: 28,
          background: "#fff",
          border: BORDER,
          borderRadius: 16,
          textAlign: "center",
          boxShadow: CARD,
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          {tp("refund.contact.title")}
        </h3>
        <p style={{ color: "#475569", margin: 0, marginBottom: 18, fontSize: 14, maxWidth: 560, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
          {tp("refund.contact.subtitle")}
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <a
            href="mailto:billing@aevion.io?subject=Refund%20request"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            billing@aevion.io
          </a>
          <Link
            href="/pricing/contact"
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 10,
              background: "#f1f5f9",
              color: "#0f172a",
              textDecoration: "none",
            }}
          >
            {tp("refund.contact.salesCta")}
          </Link>
        </div>
      </section>

      {/* Last updated */}
      <section
        style={{
          marginBottom: 40,
          padding: 14,
          fontSize: 12,
          color: "#94a3b8",
          textAlign: "center",
          background: "#f8fafc",
          borderRadius: 10,
          border: BORDER,
        }}
      >
        {tp("refund.lastUpdated")}: 2026-04-28 ·{" "}
        <Link href="/terms" style={{ color: "#0d9488", fontWeight: 700 }}>
          {tp("refund.linkTerms")}
        </Link>
        {" · "}
        <Link href="/privacy" style={{ color: "#0d9488", fontWeight: 700 }}>
          {tp("refund.linkPrivacy")}
        </Link>
      </section>
    </ProductPageShell>
  );
}
