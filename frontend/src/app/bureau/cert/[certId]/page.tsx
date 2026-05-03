import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type EmbedView = {
  id: string;
  status: "active" | "revoked" | "not_found";
  title?: string;
  kind?: string;
  verificationLevel?: "anonymous" | "verified" | "notarized";
  verifiedName?: string | null;
  verifiedAt?: string | null;
  protectedAt?: string;
  verifyUrl?: string;
};

async function loadEmbed(certId: string): Promise<EmbedView | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/bureau/cert/${encodeURIComponent(certId)}/embed`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (res.status === 404) return { id: certId, status: "not_found" };
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

type Props = {
  params: Promise<{ certId: string }>;
};

const KIND_LABELS: Record<string, string> = {
  music: "Music / Audio",
  code: "Code / Software",
  design: "Design / Visual",
  text: "Text / Article",
  video: "Video / Film",
  idea: "Idea / Concept",
  other: "Other",
};

function levelTheme(level: string | undefined, status: string | undefined) {
  if (status === "revoked") {
    return { label: "REVOKED", color: "#dc2626", bg: "rgba(220,38,38,0.08)" };
  }
  if (level === "notarized") {
    return { label: "NOTARIZED", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" };
  }
  if (level === "verified") {
    return { label: "VERIFIED", color: "#16a34a", bg: "rgba(22,163,74,0.08)" };
  }
  return { label: "ANONYMOUS", color: "#64748b", bg: "rgba(100,116,139,0.08)" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certId } = await params;
  const origin = await getOrigin();
  const ogImage = origin
    ? `${origin}/api-backend/api/bureau/cert/${encodeURIComponent(certId)}/og.svg`
    : `${getApiBase()}/api/bureau/cert/${encodeURIComponent(certId)}/og.svg`;
  const fallback: Metadata = {
    title: "AEVION Bureau certificate",
    description: "Public verification record on the AEVION Bureau registry.",
    openGraph: {
      type: "article",
      title: "AEVION Bureau certificate",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AEVION Bureau certificate",
      images: [ogImage],
    },
  };
  if (!certId) return fallback;
  const data = await loadEmbed(certId);
  if (!data || data.status === "not_found") return fallback;

  const theme = levelTheme(data.verificationLevel, data.status);
  const titleLine = data.title
    ? `${data.title} · ${theme.label}`
    : `Bureau ${certId.slice(0, 8)} · ${theme.label}`;
  const desc = [
    theme.label,
    data.kind ? `kind=${data.kind}` : null,
    data.verifiedName ? `author=${data.verifiedName}` : null,
    data.protectedAt ? `at=${String(data.protectedAt).slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${titleLine} — AEVION Bureau`,
    description: desc,
    alternates: {
      types: {
        "application/rss+xml": origin
          ? `${origin}/api-backend/api/bureau/cert/${encodeURIComponent(certId)}/changelog.rss`
          : `${getApiBase()}/api/bureau/cert/${encodeURIComponent(certId)}/changelog.rss`,
      },
    },
    openGraph: {
      type: "article",
      title: titleLine,
      description: desc,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleLine,
      description: desc,
      images: [ogImage],
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

export default async function BureauCertPage({ params }: Props) {
  const { certId } = await params;
  const data = await loadEmbed(certId);
  const origin = await getOrigin();
  const apiBase = getApiBase();
  const badgeUrl = `${apiBase}/api/bureau/cert/${encodeURIComponent(certId)}/badge.svg`;
  const embedJsonUrl = origin
    ? `${origin}/api-backend/api/bureau/cert/${encodeURIComponent(certId)}/embed`
    : `${apiBase}/api/bureau/cert/${encodeURIComponent(certId)}/embed`;
  const rssUrl = origin
    ? `${origin}/api-backend/api/bureau/cert/${encodeURIComponent(certId)}/changelog.rss`
    : `${apiBase}/api/bureau/cert/${encodeURIComponent(certId)}/changelog.rss`;
  const certPageUrl = origin ? `${origin}/bureau/cert/${certId}` : `/bureau/cert/${certId}`;

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Could not load certificate</div>
            <div style={{ fontSize: 13 }}>The Bureau API did not respond. Try again in a moment.</div>
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
            <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>Certificate not found</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              No certificate matches <code style={{ fontFamily: "ui-monospace, monospace" }}>{certId}</code> on the AEVION Bureau registry.
            </div>
            <Link
              href="/bureau"
              style={{ color: "#0d9488", fontWeight: 800, textDecoration: "none", fontSize: 13 }}
            >
              Browse the Bureau →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const theme = levelTheme(data.verificationLevel, data.status);
  const isRevoked = data.status === "revoked";
  const isVerified = data.verificationLevel === "verified" || data.verificationLevel === "notarized";
  const protectedAt = data.protectedAt
    ? new Date(data.protectedAt).toISOString().slice(0, 10)
    : null;
  const verifiedAt = data.verifiedAt
    ? new Date(data.verifiedAt).toISOString().slice(0, 10)
    : null;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "AEVION",
        item: origin || "https://aevion.tech",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Bureau",
        item: origin ? `${origin}/bureau` : "https://aevion.tech/bureau",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: data.title || certId,
        item: certPageUrl,
      },
    ],
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
        <nav style={{ fontSize: 12, color: "#64748b" }}>
          <Link href="/bureau" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 700 }}>
            ← AEVION Bureau
          </Link>
        </nav>

        <div style={{ ...card, borderColor: theme.color, background: theme.bg }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: 8,
              background: theme.color,
              color: "#fff",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            {theme.label}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
            {data.title || `Certificate ${certId.slice(0, 12)}`}
          </h1>
          {data.kind && (
            <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
              {KIND_LABELS[data.kind] || data.kind}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={dt}>Certificate ID</div>
          <p style={{ ...dd, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
            {certId}
          </p>

          <div style={dt}>Verification</div>
          <p style={dd}>
            {isVerified ? (
              <>
                <strong>{data.verifiedName || "Verified author"}</strong>
                {verifiedAt && (
                  <span style={{ color: "#64748b" }}> · since {verifiedAt}</span>
                )}
              </>
            ) : isRevoked ? (
              <span style={{ color: "#b91c1c" }}>This certificate's verification has been revoked.</span>
            ) : (
              <span style={{ color: "#64748b" }}>Author identity has not been verified.</span>
            )}
          </p>

          {protectedAt && (
            <>
              <div style={dt}>Protected on</div>
              <p style={dd}>{protectedAt}</p>
            </>
          )}

          <div style={dt}>Public badge</div>
          <div style={{ marginTop: 4, marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="AEVION Bureau badge" style={{ height: 22 }} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link
              href={`/bureau/badge/${certId}`}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#0d9488",
                textDecoration: "none",
                border: "1px solid rgba(13,148,136,0.3)",
                padding: "6px 12px",
                borderRadius: 8,
              }}
            >
              Embed badge →
            </Link>
            {!isVerified && !isRevoked && (
              <Link
                href={`/bureau/upgrade/${certId}`}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  background: "#0d9488",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
              >
                Upgrade to Verified →
              </Link>
            )}
            {data.verificationLevel === "verified" && !isRevoked && (
              <Link
                href={`/bureau/cert/${certId}/notarize`}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  background: "#7c3aed",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
              >
                Request Notarization →
              </Link>
            )}
            <a
              href={embedJsonUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                textDecoration: "none",
                border: "1px solid rgba(71,85,105,0.3)",
                padding: "6px 12px",
                borderRadius: 8,
              }}
            >
              Embed JSON ↗
            </a>
            <a
              href={rssUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#b45309",
                textDecoration: "none",
                border: "1px solid rgba(180,83,9,0.3)",
                padding: "6px 12px",
                borderRadius: 8,
              }}
            >
              RSS ↗
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
