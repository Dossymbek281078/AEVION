"use client";

import Link from "next/link";
import { launchedModules, type PitchModule } from "@/data/pitchModel";

type Props = {
  /** module id matching pitchModel.ts (e.g. "qright", "bank", "aevion-ip-bureau") */
  moduleId: string;
  /** optional override of the module's role inside the trust pipeline */
  roleOverride?: string;
  /** "dark" works on light pages, "light" works on dark pages */
  variant?: "dark" | "light";
  /** layout mode: full bordered card (default) or inline strip */
  compact?: boolean;
};

export function PitchValueCallout({ moduleId, roleOverride, variant = "dark", compact = false }: Props) {
  const m: PitchModule | undefined = launchedModules.find((x) => x.id === moduleId);
  if (!m) return null;

  const dark = variant === "dark";
  const palette = {
    bg: dark
      ? "linear-gradient(165deg, rgba(15,23,42,0.92), rgba(15,118,110,0.18))"
      : "linear-gradient(165deg, #f0fdfa, #ecfeff)",
    border: dark ? "rgba(94,234,212,0.3)" : "#5eead4",
    eyebrow: dark ? "#5eead4" : "#0d9488",
    title: dark ? "#fff" : "#0f172a",
    body: dark ? "#cbd5e1" : "#334155",
    valueBg: dark ? "rgba(251,191,36,0.1)" : "#fef3c7",
    valueBorder: dark ? "rgba(251,191,36,0.3)" : "#fbbf24",
    value: dark ? "#fde68a" : "#92400e",
    valueLabel: dark ? "#fbbf24" : "#b45309",
    cta: dark ? "#7dd3fc" : "#0284c7",
  };

  if (compact) {
    return (
      <aside
        style={{
          margin: "16px 0",
          padding: "12px 16px",
          borderRadius: 10,
          background: palette.valueBg,
          border: `1px solid ${palette.valueBorder}`,
          fontSize: 13,
          color: palette.value,
          lineHeight: 1.55,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <strong style={{ color: palette.valueLabel, letterSpacing: "0.05em", fontSize: 11, textTransform: "uppercase", fontWeight: 800 }}>
          Why this module matters
        </strong>
        <span style={{ flex: 1, minWidth: 200 }}>{m.valueLine}</span>
        <Link
          href="/pitch"
          style={{
            color: palette.cta,
            fontWeight: 700,
            textDecoration: "none",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          See full pitch →
        </Link>
      </aside>
    );
  }

  const role = roleOverride ?? m.networkRole;

  return (
    <section
      aria-label={`Why ${m.name} matters in AEVION`}
      style={{
        margin: "32px 0",
        padding: 24,
        borderRadius: 16,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.2em",
          color: palette.eyebrow,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Why {m.name} matters
      </div>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 850,
          color: palette.title,
          margin: "0 0 12px",
          letterSpacing: "-0.02em",
          lineHeight: 1.3,
        }}
      >
        {m.tagline}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: palette.body, margin: "0 0 16px" }}>
        <strong style={{ color: palette.eyebrow }}>Network role: </strong>
        {role}
      </p>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: palette.valueBg,
          border: `1px solid ${palette.valueBorder}`,
          fontSize: 13,
          color: palette.value,
          lineHeight: 1.55,
          marginBottom: 16,
        }}
      >
        <strong style={{ color: palette.valueLabel }}>$$$ contribution: </strong>
        {m.valueLine}
      </div>
      <Link
        href="/pitch"
        style={{
          display: "inline-block",
          fontSize: 13,
          fontWeight: 700,
          color: palette.cta,
          textDecoration: "none",
        }}
      >
        See where this fits in the $1B+ pitch →
      </Link>
    </section>
  );
}
