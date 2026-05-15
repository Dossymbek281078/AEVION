import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QBuild vacancy";

async function fetchVacancy(id: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/vacancies/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.data as {
      title: string;
      salary: number;
      salaryCurrency: string | null;
      city: string | null;
      status: string;
      projectTitle: string | null;
    } | null;
  } catch {
    return null;
  }
}

export default async function VacancyOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await fetchVacancy(id);

  const title = v?.title ?? "Vacancy";
  const salary = v?.salary && v.salary > 0
    ? `$${v.salary.toLocaleString()} ${v.salaryCurrency ?? "USD"}`
    : "Salary TBD";
  const city = v?.city ?? "";
  const project = v?.projectTitle ?? "";
  const status = v?.status ?? "OPEN";
  const accent = status === "OPEN" ? "#10b981" : "#64748b";

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
          background: "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#064e3b 100%)",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              AEVION QBUILD · VACANCY
            </span>
            <span style={{ padding: "4px 12px", borderRadius: 999, background: accent, color: "#022c22", fontSize: 16, fontWeight: 900 }}>
              {status}
            </span>
          </div>
          <div style={{ marginTop: 28, fontSize: 58, fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
            {title.length > 50 ? title.slice(0, 48) + "…" : title}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 32, fontSize: 26, color: "#a7f3d0", fontWeight: 700 }}>
            <span>{salary}</span>
            {city && <span>📍 {city}</span>}
          </div>
          {project && (
            <div style={{ marginTop: 12, fontSize: 20, color: "#64748b" }}>
              Project: {project.length > 60 ? project.slice(0, 58) + "…" : project}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#64748b" }}>
          <span>construction recruiting</span>
          <span style={{ fontWeight: 700, color: "#e2e8f0" }}>aevion.tech/build</span>
        </div>
      </div>
    ),
    size,
  );
}
