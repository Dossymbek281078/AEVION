"use client";

/**
 * FintechModuleCard — reusable card for displaying a single fintech module.
 * Shows name, tagline, key stat, and CTA link.
 *
 * Used by:
 * - /fintech (landing page) — main module grid
 * - /developers/fintech (API docs) — module overview
 * - Custom dashboards (Hub, admin panels)
 *
 * Zone: aevion-core/main owns frontend/src/components/fintech/**
 */

import Link from "next/link";

type Props = {
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  stat?: { label: string; value: string };
  cta: { href: string; label: string };
  size?: "sm" | "md" | "lg";
};

export default function FintechModuleCard({
  emoji, name, tagline, description, accent, stat, cta, size = "md",
}: Props) {
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  return (
    <article
      style={{
        background: "#1e293b",
        border: `1px solid ${accent}33`,
        borderRadius: 14,
        padding: isSmall ? "16px 18px" : isLarge ? "28px 32px" : "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: isSmall ? 10 : 14,
        transition: "border-color 0.2s, transform 0.2s",
        boxShadow: `0 2px 8px ${accent}10`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}80`;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 6px 18px ${accent}25`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${accent}33`;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = `0 2px 8px ${accent}10`;
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: isSmall ? 24 : isLarge ? 38 : 30 }}>{emoji}</span>
        <div>
          <div style={{
            fontSize: isSmall ? 14 : isLarge ? 20 : 16,
            fontWeight: 900,
            color: "#f1f5f9",
            letterSpacing: "-0.02em",
          }}>
            {name}
          </div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginTop: 2,
          }}>
            {tagline}
          </div>
        </div>
      </div>

      {/* Description */}
      {!isSmall && (
        <p style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.6,
          color: "#94a3b8",
        }}>
          {description}
        </p>
      )}

      {/* Stat */}
      {stat && (
        <div style={{
          padding: "8px 12px",
          background: `${accent}10`,
          border: `1px solid ${accent}25`,
          borderRadius: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}>
          <span style={{
            fontSize: 10,
            color: "#64748b",
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}>
            {stat.label}
          </span>
          <span style={{
            fontSize: isSmall ? 14 : 16,
            fontWeight: 900,
            color: accent,
            marginLeft: "auto",
            fontFamily: "ui-monospace, monospace",
          }}>
            {stat.value}
          </span>
        </div>
      )}

      {/* CTA */}
      <Link
        href={cta.href}
        style={{
          marginTop: "auto",
          padding: "8px 12px",
          background: `${accent}1a`,
          border: `1px solid ${accent}40`,
          borderRadius: 8,
          color: accent,
          fontSize: 12,
          fontWeight: 800,
          textDecoration: "none",
          textAlign: "center",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${accent}25`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = `${accent}1a`; }}
      >
        {cta.label}
      </Link>
    </article>
  );
}
