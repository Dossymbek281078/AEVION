import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QBuild project";

async function fetchProject(id: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/projects/${encodeURIComponent(id)}/public`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const d = j?.data as {
      project?: {
        title: string;
        description: string;
        budget: number;
        budgetCurrency?: string | null;
        city?: string | null;
        status: string;
      };
      vacancies?: { id: string }[];
    } | null;
    return d ?? null;
  } catch {
    return null;
  }
}

export default async function ProjectOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchProject(id);
  const p = data?.project;

  const title = p?.title ?? "Project";
  const budget =
    p?.budget && p.budget > 0
      ? `$${p.budget.toLocaleString()} ${p.budgetCurrency ?? "USD"}`
      : "Budget TBD";
  const city = p?.city ?? "";
  const status = p?.status ?? "OPEN";
  const vacancyCount = data?.vacancies?.length ?? 0;
  const accent =
    status === "OPEN" ? "#10b981" : status === "IN_PROGRESS" ? "#0ea5e9" : "#64748b";

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
          background:
            "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#7c2d12 100%)",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              AEVION QBUILD · PROJECT
            </span>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background: accent,
                color: "#fff",
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {status.replace("_", " ")}
            </span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 58,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
            }}
          >
            {title.length > 50 ? title.slice(0, 48) + "…" : title}
          </div>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 32,
              fontSize: 26,
              color: "#fed7aa",
              fontWeight: 700,
            }}
          >
            <span>{budget}</span>
            {city && <span>📍 {city}</span>}
            {vacancyCount > 0 && (
              <span style={{ color: "#86efac" }}>
                {vacancyCount} {vacancyCount === 1 ? "role open" : "roles open"}
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#64748b",
          }}
        >
          <span>construction project</span>
          <span style={{ fontWeight: 700, color: "#e2e8f0" }}>
            aevion.tech/build
          </span>
        </div>
      </div>
    ),
    size,
  );
}
