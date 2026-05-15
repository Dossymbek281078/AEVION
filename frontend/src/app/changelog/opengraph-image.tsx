import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Changelog — public timeline of releases";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ENTRIES = [
  { date: "2026-04-28", kind: "feat", text: "Awards SEO + OG suite · Quantum Shield + Planet + Help OG" },
  { date: "2026-04-27", kind: "feat", text: "Bank story pages · Trust deep-dive · Wallet card · Security model" },
  { date: "2026-04-24", kind: "feat", text: "CyberChess W2 — Game DNA · PWA · Opening Trainer" },
  { date: "2026-04-22", kind: "feat", text: "Bank ecosystem layer (20 commits) — 4 phases shipped" },
];

export default function ChangelogOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at 75% 35%, rgba(251,191,36,0.20), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#fbbf24", textTransform: "uppercase", display: "flex" }}>
          AEVION · Changelog
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Every release,</span>
            <span style={{ color: "#fbbf24" }}>in public.</span>
          </div>
          <div style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            Cross-module timeline — QRight · QSign · Bureau · Planet · Bank · Awards · CyberChess.
            Every entry pins a date, a kind, and the live surfaces it shipped.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {ENTRIES.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(251,191,36,0.20)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#fbbf24",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    minWidth: 110,
                    display: "flex",
                  }}
                >
                  {e.date}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 1,
                    color: "#0f172a",
                    background: "#86efac",
                    padding: "3px 8px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    display: "flex",
                  }}
                >
                  {e.kind}
                </div>
                <div style={{ fontSize: 16, color: "#e2e8f0", display: "flex", flex: 1 }}>{e.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 16,
            fontWeight: 700,
            color: "#94a3b8",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>aevion.app/changelog</div>
          <div style={{ color: "#fbbf24", display: "flex" }}>feat · fix · docs</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
