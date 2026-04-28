import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type EmbedView = {
  id: string;
  status: "registered" | "revoked" | "not_found";
  title?: string;
  kind?: string;
  contentHash?: string;
  contentHashPrefix?: string;
  ownerName?: string | null;
  country?: string | null;
  city?: string | null;
  createdAt?: string;
  revokedAt?: string | null;
  revokeReason?: string | null;
};

async function loadEmbed(id: string): Promise<EmbedView | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/qright/embed/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (res.status === 404) return { id, status: "not_found" };
    if (!res.ok) return null;
    return (await res.json()) as EmbedView;
  } catch {
    return null;
  }
}

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return "";
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: "QRight registration — AEVION",
    description: "Public registration record on the AEVION QRight registry.",
    openGraph: { type: "article", title: "QRight registration — AEVION" },
  };
  if (!id) return fallback;
  const data = await loadEmbed(id);
  if (!data || data.status === "not_found") return fallback;

  const statusLabel =
    data.status === "revoked" ? "REVOKED" : "REGISTERED";
  const titleLine = data.title
    ? `${data.title} · ${statusLabel}`
    : `QRight ${id.slice(0, 8)} · ${statusLabel}`;
  const desc = [
    statusLabel,
    data.kind ? `kind=${data.kind}` : null,
    data.ownerName ? `owner=${data.ownerName}` : null,
    data.contentHashPrefix ? `sha256=${data.contentHashPrefix}…` : null,
    data.createdAt ? `at=${data.createdAt.slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${titleLine} — AEVION QRight`,
    description: desc,
    openGraph: {
      type: "article",
      title: titleLine,
      description: desc,
    },
  };
}

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 22,
  background: "#fff",
};
const dt: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
};
const dd: CSSProperties = {
  fontSize: 14,
  color: "#0f172a",
  margin: 0,
  marginBottom: 14,
  wordBreak: "break-all",
};
const mono: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};

export default async function QRightObjectPage({ params }: Props) {
  const { id } = await params;
  const data = await loadEmbed(id);
  const origin = await getOrigin();

  const badgeUrl = `${getApiBase()}/api/qright/badge/${encodeURIComponent(id)}.svg`;
  const verifyUrl = origin ? `${origin}/qright/object/${id}` : `/qright/object/${id}`;
  const embedJsonUrl = origin
    ? `${origin}/api-backend/api/qright/embed/${id}`
    : `/api-backend/api/qright/embed/${id}`;

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Failed to load</div>
            <div style={{ fontSize: 13 }}>The AEVION registry is unreachable. Try again later.</div>
          </div>
        </div>
      </main>
    );
  }

  if (data.status === "not_found") {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div
            style={{
              ...card,
              borderColor: "rgba(234,179,8,0.4)",
              background: "rgba(254,252,232,0.6)",
              color: "#854d0e",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>Not registered</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              No QRight object with id <code style={mono}>{id}</code>.
            </div>
            <Link
              href="/qright"
              style={{ color: "#0d9488", fontWeight: 800, textDecoration: "none", fontSize: 13 }}
            >
              ← Register your work on AEVION QRight
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isRevoked = data.status === "revoked";
  const accent = isRevoked ? "#dc2626" : "#0d9488";
  const accentBg = isRevoked ? "rgba(220,38,38,0.08)" : "rgba(13,148,136,0.08)";

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/qright"
            style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
          >
            ← AEVION QRight
          </Link>
        </div>

        <div
          style={{
            ...card,
            borderColor: accent,
            borderWidth: 2,
            marginBottom: 18,
            background: `linear-gradient(135deg, ${accentBg}, #fff)`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: "4px 12px",
              borderRadius: 999,
              background: accent,
              color: "#fff",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            {isRevoked ? "✕ REVOKED" : "✓ REGISTERED"}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            {data.title || "Untitled work"}
          </h1>
          {isRevoked && (
            <p style={{ marginTop: 10, marginBottom: 0, color: "#7f1d1d", fontSize: 13 }}>
              <strong>This registration has been revoked by the owner.</strong>
              {data.revokeReason ? ` Reason: ${data.revokeReason}` : null}
            </p>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="AEVION QRight badge" height={22} style={{ display: "block" }} />
            <Link
              href={`/qright/badge/${id}`}
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: accent,
                textDecoration: "none",
                padding: "5px 12px",
                borderRadius: 8,
                border: `1px solid ${accent}`,
              }}
            >
              Get embed code →
            </Link>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 14 }}>
            Registration record
          </h2>
          {data.kind && (
            <>
              <div style={dt}>Kind</div>
              <p style={{ ...dd, textTransform: "uppercase", fontWeight: 700 }}>{data.kind}</p>
            </>
          )}
          {data.ownerName && (
            <>
              <div style={dt}>Owner</div>
              <p style={dd}>{data.ownerName}</p>
            </>
          )}
          {(data.country || data.city) && (
            <>
              <div style={dt}>Location</div>
              <p style={dd}>{[data.city, data.country].filter(Boolean).join(", ")}</p>
            </>
          )}
          {data.createdAt && (
            <>
              <div style={dt}>Registered</div>
              <p style={dd}>{new Date(data.createdAt).toUTCString()}</p>
            </>
          )}
          {data.revokedAt && (
            <>
              <div style={dt}>Revoked</div>
              <p style={{ ...dd, color: "#b91c1c" }}>{new Date(data.revokedAt).toUTCString()}</p>
            </>
          )}
          {data.contentHash && (
            <>
              <div style={dt}>SHA-256 of canonical payload</div>
              <p style={{ ...dd, ...mono }}>{data.contentHash}</p>
            </>
          )}
          <div style={dt}>Object ID</div>
          <p style={{ ...dd, ...mono }}>{id}</p>
        </div>

        <div style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 12 }}>
            Independent verification
          </h2>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 0, marginBottom: 14, lineHeight: 1.6 }}>
            The hash above is reproducible from the original work. To verify without trusting AEVION, drop
            the work&apos;s file plus the verification bundle into the offline verifier.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              href="/verify-offline"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Offline verifier →
            </Link>
            <a
              href={embedJsonUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Embed JSON
            </a>
            <a
              href={badgeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Raw badge SVG
            </a>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 24 }}>
          {verifyUrl}
        </div>
      </div>
    </main>
  );
}
