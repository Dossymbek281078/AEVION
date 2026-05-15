import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QBuild project";

type ProjectStatus = "OPEN" | "IN_PROGRESS" | "DONE";
type PublicView = {
  project: {
    id: string;
    title: string;
    description: string;
    budget: number;
    status: ProjectStatus;
    city: string | null;
    createdAt: string;
  };
  vacancies: { id: string; status: "OPEN" | "CLOSED"; salary: number }[];
  client: { name: string | null } | null;
};

async function fetchPublic(id: string): Promise<PublicView | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/projects/${encodeURIComponent(id)}/public`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: PublicView };
    if (!json?.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

function fmtBudget(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n}`;
}

export default async function ProjectOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchPublic(id);

  const status = data?.project.status ?? "OPEN";
  const accent =
    status === "OPEN" ? "#10b981" : status === "IN_PROGRESS" ? "#f59e0b" : "#64748b";
  const titleRaw = data?.project.title?.trim() || `Project ${id.slice(0, 8)}`;
  const title = titleRaw.length > 80 ? `${titleRaw.slice(0, 78)}…` : titleRaw;
  const budget = data ? fmtBudget(data.project.budget) : "—";
  const city = data?.project.city || null;
  const owner = data?.client?.name || "anonymous";
  const date = data?.project.createdAt ? data.project.createdAt.slice(0, 10) : null;
  const openVacancies = data ? data.vacancies.filter((v) => v.status === "OPEN").length : 0;

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
          background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#065f46 100%)",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "#94a3b8",
              textTransform: "uppercase",
            }}
          >
            <span>AEVION QBUILD</span>
            <span
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: accent,
                color: "#022c22",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "0.08em",
              }}
            >
              {status.replace("_", " ")}
            </span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 60,
              lineHeight: 1.1,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.01em",
              maxWidth: 1056,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 22,
              display: "flex",
              gap: 28,
              fontSize: 26,
              color: "#a7f3d0",
              fontWeight: 700,
            }}
          >
            <span>Budget {budget}</span>
            {city && <span>· {city}</span>}
            {openVacancies > 0 && (
              <span>
                · {openVacancies} open vacancy{openVacancies === 1 ? "" : "ies"}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", gap: 24 }}>
            <span>Client: {owner}</span>
            {date && <span>· {date}</span>}
          </div>
          <div style={{ fontWeight: 800, color: "#e2e8f0" }}>
            construction · recruiting · provable
          </div>
        </div>
      </div>
    ),
    size,
  );
}
