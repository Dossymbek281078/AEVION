import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export const runtime = "edge";
export const alt = "QSign v2 signature verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type PublicSig = {
  id: string;
  valid: boolean;
  revoked: boolean;
  algoVersion?: string;
  canonicalization?: string;
  hmac?: { kid: string };
  ed25519?: { kid: string } | null;
  issuer?: { email?: string | null } | null;
  geo?: { country?: string | null } | null;
};

async function loadPublic(id: string): Promise<PublicSig | null> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host = h.get("x-forwarded-host") || h.get("host");
    if (!host) return null;
    const res = await fetch(`${proto}://${host}/api/qsign/v2/${id}/public`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicSig;
  } catch {
    return null;
  }
}

export default async function OG({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = "then" in (params as any) ? await (params as Promise<{ id: string }>) : (params as { id: string });
  const id = resolved?.id || "";
  const pub = await loadPublic(id);

  const statusText = !pub
    ? "UNKNOWN"
    : pub.revoked
      ? "REVOKED"
      : pub.valid
        ? "VALID"
        : "TAMPERED";
  const statusColor = !pub
    ? "#475569"
    : pub.revoked
      ? "#b91c1c"
      : pub.valid
        ? "#047857"
        : "#b45309";

  const idShort = id ? id.slice(0, 12) + "…" : "—";
  const algoLine = pub
    ? [pub.algoVersion, pub.canonicalization].filter(Boolean).join(" · ")
    : "qsign-v2.0 · RFC8785";
  const kidLine = pub
    ? [
        pub.hmac?.kid ? `hmac:${pub.hmac.kid}` : null,
        pub.ed25519?.kid ? `ed25519:${pub.ed25519.kid}` : null,
        pub.geo?.country ? `geo:${pub.geo.country}` : null,
      ]
        .filter(Boolean)
        .join("  ·  ")
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0b1120 0%, #11203a 50%, #0b1120 100%)",
          color: "#e2e8f0",
          padding: 64,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 22,
              color: "#0b1120",
            }}
          >
            A
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.05em" }}>
              AEVION
            </div>
            <div style={{ fontSize: 16, color: "#94a3b8" }}>QSign v2</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              padding: "16px 28px",
              borderRadius: 16,
              background: statusColor,
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: "0.05em",
              color: "#fff",
              display: "flex",
            }}
          >
            {statusText}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#cbd5e1",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {idShort}
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 24,
            color: "#94a3b8",
            display: "flex",
          }}
        >
          {algoLine}
        </div>

        {kidLine ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 20,
              color: "#64748b",
              fontFamily: "ui-monospace, monospace",
              display: "flex",
            }}
          >
            {kidLine}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#475569",
            fontSize: 18,
          }}
        >
          <div style={{ display: "flex" }}>RFC 8785 · HMAC-SHA256 · Ed25519</div>
          <div style={{ display: "flex" }}>aevion.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
