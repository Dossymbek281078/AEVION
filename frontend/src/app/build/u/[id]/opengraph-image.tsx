import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QBuild profile";

async function fetchProfile(id: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/profiles/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.data as {
      name: string;
      title: string | null;
      city: string | null;
      buildRole: string;
      experienceYears: number;
      avgRating?: number;
      reviewCount?: number;
      verifiedAt: string | null;
    } | null;
  } catch {
    return null;
  }
}

export default async function ProfileOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await fetchProfile(id);

  const name = p?.name ?? "QBuild Profile";
  const role = p?.buildRole ?? "";
  const title = p?.title ?? "";
  const city = p?.city ?? "";
  const exp = p?.experienceYears ? `${p.experienceYears}y exp` : "";
  const rating = p?.avgRating && p.avgRating > 0 ? `★ ${p.avgRating.toFixed(1)}` : "";
  const verified = p?.verifiedAt ? "✓ Verified" : "";

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
          <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            AEVION QBUILD
          </div>
          <div style={{ marginTop: 28, fontSize: 60, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {name.length > 30 ? name.slice(0, 28) + "…" : name}
          </div>
          {title && (
            <div style={{ marginTop: 12, fontSize: 26, color: "#a7f3d0", fontWeight: 600 }}>
              {title.length > 60 ? title.slice(0, 58) + "…" : title}
            </div>
          )}
          <div style={{ marginTop: 18, display: "flex", gap: 24, fontSize: 22, color: "#94a3b8", fontWeight: 600 }}>
            {role && <span>{role}</span>}
            {city && <span>📍 {city}</span>}
            {exp && <span>⏱ {exp}</span>}
            {rating && <span style={{ color: "#fbbf24" }}>{rating}</span>}
            {verified && <span style={{ color: "#bae6fd" }}>{verified}</span>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#64748b" }}>
          <span>construction · recruiting</span>
          <span style={{ fontWeight: 700, color: "#e2e8f0" }}>aevion.tech/build</span>
        </div>
      </div>
    ),
    size,
  );
}
