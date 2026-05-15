import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

type Theme = {
  accent: string;
  bg: string;
  kicker: string;
  defaultLabel: string;
};

const THEMES: Record<string, Theme> = {
  artifact:    { accent: "#86efac", bg: "linear-gradient(135deg, #020617 0%, #0c1e1e 60%, #020617 100%)", kicker: "Planet artifact",     defaultLabel: "AI artifact" },
  certificate: { accent: "#7dd3fc", bg: "linear-gradient(135deg, #020617 0%, #0c4a6e 60%, #020617 100%)", kicker: "QRight certificate", defaultLabel: "Authorship certificate" },
  receipt:     { accent: "#a78bfa", bg: "linear-gradient(135deg, #020617 0%, #1e1b4b 60%, #020617 100%)", kicker: "QSign receipt",      defaultLabel: "Signed receipt" },
  bureau:      { accent: "#f472b6", bg: "linear-gradient(135deg, #020617 0%, #4c0519 60%, #020617 100%)", kicker: "Bureau certificate", defaultLabel: "Bureau certificate" },
  award:       { accent: "#c4b5fd", bg: "linear-gradient(135deg, #020617 0%, #1e1b4b 60%, #020617 100%)", kicker: "AEVION award",       defaultLabel: "Recognition" },
  module:      { accent: "#5eead4", bg: "linear-gradient(135deg, #020617 0%, #052e2b 60%, #020617 100%)", kicker: "AEVION module",      defaultLabel: "Module" },
  payment:     { accent: "#fbbf24", bg: "linear-gradient(135deg, #020617 0%, #422006 60%, #020617 100%)", kicker: "Bank payment",       defaultLabel: "AEC payment" },
  tx:          { accent: "#fbbf24", bg: "linear-gradient(135deg, #020617 0%, #422006 60%, #020617 100%)", kicker: "Bank transaction",   defaultLabel: "AEC transaction" },
};

const FALLBACK: Theme = {
  accent: "#7dd3fc",
  bg: "linear-gradient(135deg, #020617 0%, #0f172a 60%, #020617 100%)",
  kicker: "AEVION",
  defaultLabel: "Trust OS",
};

function clamp(s: string | undefined, max: number): string {
  if (!s) return "";
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  const theme = THEMES[type] ?? FALLBACK;

  const url = new URL(req.url);
  const title    = clamp(url.searchParams.get("title")    || id || theme.defaultLabel, 80);
  const subtitle = clamp(url.searchParams.get("subtitle") || "", 200);
  const tag      = clamp(url.searchParams.get("tag")      || "", 24);
  const status   = clamp(url.searchParams.get("status")   || "", 24);

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
          background: `radial-gradient(circle at 30% 30%, ${theme.accent}33, transparent 55%), ${theme.bg}`,
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: theme.accent,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · {theme.kicker}
          </div>
          {tag ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#020617",
                background: theme.accent,
                padding: "4px 10px",
                borderRadius: 6,
                letterSpacing: 1,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                display: "flex",
              }}
            >
              {tag}
            </div>
          ) : null}
          {status ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: theme.accent,
                background: "rgba(255,255,255,0.06)",
                padding: "4px 10px",
                borderRadius: 6,
                letterSpacing: 1,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                border: `1px solid ${theme.accent}55`,
                display: "flex",
              }}
            >
              {status}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              color: "#f8fafc",
              display: "flex",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 1000, lineHeight: 1.45, display: "flex" }}>
              {subtitle}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#64748b",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              letterSpacing: 1,
              display: "flex",
            }}
          >
            id: {id}
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
          <div style={{ display: "flex" }}>aevion.app</div>
          <div style={{ color: theme.accent, display: "flex" }}>27 nodes · one Trust Graph</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // 1h browser cache, 1d CDN cache, stale-while-revalidate up to 7d
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
