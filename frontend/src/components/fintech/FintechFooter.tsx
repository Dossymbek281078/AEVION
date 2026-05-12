"use client";

/**
 * FintechFooter — shared footer for fintech pages with module links,
 * developer resources, and observability links.
 *
 * Zone: aevion-core/main owns frontend/src/components/fintech/**
 */

import Link from "next/link";
import FintechHealthBadge from "./FintechHealthBadge";

type Props = {
  /** Hide health badge (e.g., when already shown in header). Default: false */
  hideHealthBadge?: boolean;
};

const MODULES = [
  { href: "/qgood",          label: "QGood" },
  { href: "/qmaskcard",      label: "QMaskCard" },
  { href: "/veilnetx",       label: "VeilNetX" },
  { href: "/z-tide",         label: "Z-Tide" },
  { href: "/qchaingov",      label: "QChainGov" },
];

const RESOURCES = [
  { href: "/fintech",                            label: "Overview" },
  { href: "/fintech/dashboard",                  label: "Dashboard" },
  { href: "/fintech/status",                     label: "Status" },
  { href: "/fintech/whitepaper",                 label: "Whitepaper" },
  { href: "/fintech/integrations",               label: "Integrations" },
  { href: "/fintech/changelog",                  label: "Changelog" },
  { href: "/developers/fintech",                 label: "API Docs" },
  { href: "/developers/fintech/quickstart",      label: "Quickstart" },
  { href: "/developers/fintech/troubleshooting", label: "Troubleshooting" },
];

export default function FintechFooter({ hideHealthBadge = false }: Props) {
  return (
    <footer style={{
      marginTop: 60,
      padding: "28px 24px 36px",
      borderTop: "1px solid #334155",
      background: "#1e293b",
      borderRadius: 12,
      color: "#94a3b8",
      fontSize: 13,
      lineHeight: 1.7,
    }}>
      {/* Top: 2-column grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 24,
        marginBottom: 20,
      }}>
        {/* Modules */}
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#a78bfa",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 8,
          }}>Modules</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {MODULES.map((m) => (
              <li key={m.href}>
                <Link href={m.href} style={{ color: "#cbd5e1", textDecoration: "none", fontSize: 13 }}>
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Resources */}
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#a78bfa",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 8,
          }}>Resources</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {RESOURCES.map((r) => (
              <li key={r.href}>
                <Link href={r.href} style={{ color: "#cbd5e1", textDecoration: "none", fontSize: 13 }}>
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Status / contact */}
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#a78bfa",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 8,
          }}>Health</div>
          {!hideHealthBadge && (
            <div style={{ marginBottom: 8 }}>
              <FintechHealthBadge compact />
            </div>
          )}
          <Link href="https://github.com/Dossymbek281078/AEVION/issues" style={{ display: "block", color: "#cbd5e1", textDecoration: "none", fontSize: 12 }}>
            Report an issue →
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        paddingTop: 16,
        borderTop: "1px solid #334155",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        fontSize: 11,
        color: "#64748b",
      }}>
        <span>AEVION Fintech · 5 modules · MIT</span>
        <span>Base: <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 3, fontFamily: "ui-monospace, monospace" }}>https://api.aevion.app</code></span>
      </div>
    </footer>
  );
}
