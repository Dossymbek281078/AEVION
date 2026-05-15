import { ImageResponse } from "next/og";
import { apiUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QCoreAI — shared multi-agent run";

type Payload = {
  session: { title: string } | null;
  run: {
    strategy: string | null;
    totalCostUsd: number | null;
    totalDurationMs: number | null;
    userInput: string;
  };
};

async function fetchShared(token: string): Promise<Payload | null> {
  try {
    const res = await fetch(apiUrl(`/api/qcoreai/shared/${encodeURIComponent(token)}`), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Payload;
  } catch {
    return null;
  }
}

function prettyStrategy(s: string | null | undefined) {
  if (s === "parallel") return "Parallel · Writer‖Writer → Judge";
  if (s === "debate") return "Debate · Pro‖Con → Moderator";
  return "Sequential · Analyst → Writer → Critic";
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  return `$${v.toFixed(4)}`;
}

function fmtDur(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function SharedOgImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShared(token);
  const titleRaw = data?.session?.title?.trim() || "Shared QCoreAI run";
  const title = titleRaw.length > 90 ? `${titleRaw.slice(0, 88)}…` : titleRaw;
  const promptRaw = data?.run?.userInput?.trim() || "";
  const prompt = promptRaw.length > 160 ? `${promptRaw.slice(0, 158)}…` : promptRaw;
  const strategy = prettyStrategy(data?.run?.strategy);
  const cost = `Cost ${fmtMoney(data?.run?.totalCostUsd)}`;
  const dur = fmtDur(data?.run?.totalDurationMs);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0e7490 100%)",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 900, letterSpacing: 2, color: "#e2e8f0" }}>
            AEVION QCoreAI
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#94a3b8", marginTop: 6 }}>
            Multi-agent run · shared snapshot
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.15,
              color: "#f8fafc",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#cbd5e1",
              lineHeight: 1.35,
              marginTop: 24,
            }}
          >
            {prompt}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 18 }}>
          <div
            style={{
              display: "flex",
              padding: "12px 20px",
              borderRadius: 999,
              background: "rgba(34,211,238,0.12)",
              border: "1px solid rgba(34,211,238,0.35)",
              color: "#a5f3fc",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {strategy}
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 20px",
              borderRadius: 999,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "#a7f3d0",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {cost}
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 20px",
              borderRadius: 999,
              background: "rgba(148,163,184,0.12)",
              border: "1px solid rgba(148,163,184,0.3)",
              color: "#e2e8f0",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {dur}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
