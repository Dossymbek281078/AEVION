import { headers } from "next/headers";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type PublicSig = {
  id: string;
  valid: boolean;
  revoked: boolean;
  revokedAt: string | null;
  algoVersion: string;
  canonicalization: string;
  createdAt: string | null;
  hmac: { kid: string; signature: string } | null;
  ed25519: { kid: string; signature: string; publicKey: string | null } | null;
  issuer?: { email?: string | null } | null;
  geo?: { country?: string | null; city?: string | null } | null;
};

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const proto = (h.get("x-forwarded-proto") || "https").split(",")[0];
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) return `${proto}://${host}`;
  } catch {}
  return "";
}

async function loadPublic(id: string): Promise<PublicSig | null> {
  try {
    const origin = await getOrigin();
    if (!origin) return null;
    const res = await fetch(`${origin}/api/qsign/v2/${id}/public`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicSig;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `QSign embed — ${id.slice(0, 8)}`,
    robots: "noindex,nofollow",
  };
}

export default async function QSignEmbedPage({ params }: Props) {
  const { id } = await params;
  const pub = await loadPublic(id);
  const origin = await getOrigin();
  const fullUrl = origin ? `${origin}/qsign/verify/${id}` : `/qsign/verify/${id}`;

  const status = !pub
    ? ("unknown" as const)
    : pub.revoked
      ? ("revoked" as const)
      : pub.valid
        ? ("valid" as const)
        : ("tampered" as const);
  const statusText =
    status === "valid"
      ? "VALID"
      : status === "revoked"
        ? "REVOKED"
        : status === "tampered"
          ? "TAMPERED"
          : "UNKNOWN";
  const statusBg =
    status === "valid"
      ? "#047857"
      : status === "revoked"
        ? "#b91c1c"
        : status === "tampered"
          ? "#b45309"
          : "#475569";

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background: "transparent",
        minHeight: "100vh",
      }}
    >
      <a
        href={fullUrl}
        target="_top"
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          border: "1px solid rgba(15,23,42,0.12)",
          borderRadius: 12,
          background: "#fff",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
          maxWidth: 360,
          margin: "8px auto",
        }}
      >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px 10px 12px",
              borderBottom: "1px solid rgba(15,23,42,0.06)",
              background: "linear-gradient(135deg, #0b1120 0%, #11203a 100%)",
              color: "#e2e8f0",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 13,
                color: "#0b1120",
                flexShrink: 0,
              }}
            >
              A
            </div>
            <div style={{ flex: 1, lineHeight: 1.1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em" }}>
                AEVION QSign v2
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                Verifiable digital signature
              </div>
            </div>
            <span
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                background: statusBg,
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              {statusText}
            </span>
          </div>

          <div style={{ padding: "12px 14px" }}>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                color: "#475569",
                marginBottom: 6,
                wordBreak: "break-all",
              }}
            >
              {pub?.id || id}
            </div>

            {pub ? (
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 12px",
                  lineHeight: 1.4,
                }}
              >
                <span>{pub.algoVersion}</span>
                <span>{pub.canonicalization}</span>
                {pub.hmac?.kid ? <span>hmac:{pub.hmac.kid}</span> : null}
                {pub.ed25519?.kid ? <span>ed25519:{pub.ed25519.kid}</span> : null}
                {pub.geo?.country ? (
                  <span>
                    geo:{pub.geo.country}
                    {pub.geo.city ? ` · ${pub.geo.city}` : ""}
                  </span>
                ) : null}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Could not load signature.
              </div>
            )}

            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "#0d9488",
                fontWeight: 700,
              }}
            >
              Verify on AEVION →
            </div>
          </div>
        </a>
    </div>
  );
}
