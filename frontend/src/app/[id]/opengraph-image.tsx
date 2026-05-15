import { ImageResponse } from "next/og";
import { apiUrl } from "@/lib/apiBase";

export const runtime = "nodejs";
export const alt = "AEVION node — module landing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type GlobusProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
};

const KIND_COLOR: Record<string, string> = {
  module: "#7dd3fc",
  service: "#a78bfa",
  product: "#fbbf24",
  research: "#5eead4",
  legal: "#f472b6",
};

export default async function ProjectOg({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const p = (await Promise.resolve(params)) as { id: string };
  const id = p.id;

  let project: GlobusProject | null = null;
  try {
    const res = await fetch(apiUrl(`/api/globus/projects/${id}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) project = (await res.json()) as GlobusProject;
  } catch {
    project = null;
  }

  const name = project?.name || id;
  const code = project?.code || "AEVION";
  const kind = project?.kind || "module";
  const status = project?.status || "live";
  const desc = (project?.description || "AEVION ecosystem node — one identity, one Trust Graph.").slice(0, 180);
  const accent = KIND_COLOR[kind] || "#7dd3fc";

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
            `radial-gradient(circle at 30% 30%, ${accent}40, transparent 55%), linear-gradient(135deg, #020617 0%, #0f172a 60%, #020617 100%)`,
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 4,
              color: accent,
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${accent}55`,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              display: "flex",
            }}
          >
            {code}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, color: "#94a3b8", textTransform: "uppercase", display: "flex" }}>
            AEVION · {kind} · {status}
          </div>
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
            {name}
          </div>
          <div style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 980, lineHeight: 1.45, display: "flex" }}>
            {desc}
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
          <div style={{ display: "flex" }}>aevion.app/{id}</div>
          <div style={{ color: accent, display: "flex" }}>27 nodes · one Trust Graph</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
