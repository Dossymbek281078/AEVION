import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AEVION QRight registration";

type EmbedView = {
  id: string;
  status: "registered" | "revoked" | "not_found";
  title?: string;
  kind?: string;
  contentHashPrefix?: string;
  ownerName?: string | null;
  country?: string | null;
  city?: string | null;
  createdAt?: string;
  revokedAt?: string | null;
};

async function fetchEmbed(id: string): Promise<EmbedView | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/qright/embed/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return { id, status: "not_found" };
    if (!res.ok) return null;
    return (await res.json()) as EmbedView;
  } catch {
    return null;
  }
}

export default async function QRightObjectOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchEmbed(id);

  const status = data?.status === "revoked" ? "REVOKED" : data?.status === "not_found" ? "NOT FOUND" : "REGISTERED";
  const accent = status === "REVOKED" ? "#dc2626" : status === "NOT FOUND" ? "#94a3b8" : "#0d9488";
  const titleRaw = data?.title?.trim() || `QRight ${id.slice(0, 8)}`;
  const title = titleRaw.length > 70 ? `${titleRaw.slice(0, 68)}…` : titleRaw;
  const kind = (data?.kind || "").toUpperCase();
  const owner = data?.ownerName || "anonymous";
  const location = [data?.city, data?.country].filter(Boolean).join(", ");
  const date = data?.createdAt ? new Date(data.createdAt).toISOString().slice(0, 10) : null;
  const sha = data?.contentHashPrefix || "";

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
            <span>AEVION QRIGHT</span>
            <span
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: accent,
                color: "#fff",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "0.08em",
              }}
            >
              {status}
            </span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 64,
              lineHeight: 1.1,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.01em",
              maxWidth: 1056,
            }}
          >
            {title}
          </div>
          {kind && (
            <div style={{ marginTop: 18, fontSize: 24, color: "#a5f3fc", fontWeight: 700, letterSpacing: "0.04em" }}>
              {kind}
              {date ? ` · ${date}` : ""}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sha && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 20,
                color: "#cbd5e1",
              }}
            >
              <span style={{ color: "#94a3b8", fontWeight: 700 }}>SHA-256</span>
              <span>{sha}…</span>
            </div>
          )}
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
              <span>Owner: {owner}</span>
              {location && <span>· {location}</span>}
            </div>
            <div style={{ fontWeight: 800, color: "#e2e8f0" }}>aevion · independent · provable</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
