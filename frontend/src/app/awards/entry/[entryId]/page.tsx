import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type EmbedView = {
  id: string;
  status: "pending" | "qualified" | "disqualified" | "not_found";
  seasonId?: string;
  season?: {
    code: string;
    title: string;
    status: string;
  };
  artifactVersionId?: string;
  submissionTitle?: string;
  artifactType?: string;
  submittedAt?: string;
  qualifiedAt?: string | null;
  medalPlace?: number | null;
  verifyUrl?: string;
};

async function loadEmbed(entryId: string): Promise<EmbedView | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/awards/entries/${encodeURIComponent(entryId)}/embed`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (res.status === 404) return { id: entryId, status: "not_found" };
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
  params: Promise<{ entryId: string }>;
};

function medalTheme(place: number | null | undefined, status: string | undefined) {
  if (place === 1) return { color: "#eab308", bg: "rgba(253,224,71,0.10)", label: "🥇 Gold · 1st place" };
  if (place === 2) return { color: "#94a3b8", bg: "rgba(203,213,225,0.10)", label: "🥈 Silver · 2nd place" };
  if (place === 3) return { color: "#b45309", bg: "rgba(180,83,9,0.10)", label: "🥉 Bronze · 3rd place" };
  if (status === "qualified") return { color: "#0d9488", bg: "rgba(13,148,136,0.08)", label: "Qualified" };
  if (status === "disqualified") return { color: "#dc2626", bg: "rgba(220,38,38,0.08)", label: "Disqualified" };
  return { color: "#475569", bg: "rgba(71,85,105,0.08)", label: "Submitted" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entryId } = await params;
  const origin = await getOrigin();
  const ogImage = origin
    ? `${origin}/api-backend/api/awards/entries/${encodeURIComponent(entryId)}/og.svg`
    : `${getApiBase()}/api/awards/entries/${encodeURIComponent(entryId)}/og.svg`;
  const fallback: Metadata = {
    title: "AEVION Awards entry",
    description: "Public Awards entry record on the AEVION Awards registry.",
    openGraph: {
      type: "article",
      title: "AEVION Awards entry",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AEVION Awards entry",
      images: [ogImage],
    },
  };
  if (!entryId) return fallback;
  const data = await loadEmbed(entryId);
  if (!data || data.status === "not_found") return fallback;

  const theme = medalTheme(data.medalPlace, data.status);
  const titleLine = data.submissionTitle
    ? `${data.submissionTitle} · ${theme.label}`
    : `${data.season?.title || entryId} · ${theme.label}`;
  const desc = [
    theme.label,
    data.season?.title ? `season=${data.season.title}` : null,
    data.artifactType ? `type=${data.artifactType}` : null,
    data.submittedAt ? `at=${String(data.submittedAt).slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const seasonRssUrl = data.seasonId
    ? origin
      ? `${origin}/api-backend/api/awards/seasons/${encodeURIComponent(data.seasonId)}/changelog.rss`
      : `${getApiBase()}/api/awards/seasons/${encodeURIComponent(data.seasonId)}/changelog.rss`
    : undefined;
  return {
    title: `${titleLine} — AEVION Awards`,
    description: desc,
    alternates: seasonRssUrl
      ? {
          types: {
            "application/rss+xml": seasonRssUrl,
          },
        }
      : undefined,
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
};

export default async function AwardsEntryPage({ params }: Props) {
  const { entryId } = await params;
  const data = await loadEmbed(entryId);
  const origin = await getOrigin();
  const apiBase = getApiBase();
  const badgeUrl = `${apiBase}/api/awards/entries/${encodeURIComponent(entryId)}/badge.svg`;
  const embedJsonUrl = origin
    ? `${origin}/api-backend/api/awards/entries/${encodeURIComponent(entryId)}/embed`
    : `${apiBase}/api/awards/entries/${encodeURIComponent(entryId)}/embed`;
  const entryPageUrl = origin ? `${origin}/awards/entry/${entryId}` : `/awards/entry/${entryId}`;

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Could not load entry</div>
            <div style={{ fontSize: 13 }}>The Awards backend is temporarily unreachable.</div>
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
            <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>Entry not found</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              No award entry matches <code style={{ fontFamily: "ui-monospace, monospace" }}>{entryId}</code>.
            </div>
            <Link
              href="/awards"
              style={{ color: "#0d9488", fontWeight: 800, textDecoration: "none", fontSize: 13 }}
            >
              Browse AEVION Awards →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const theme = medalTheme(data.medalPlace, data.status);
  const submittedAt = data.submittedAt
    ? new Date(data.submittedAt).toISOString().slice(0, 10)
    : null;
  const qualifiedAt = data.qualifiedAt
    ? new Date(data.qualifiedAt).toISOString().slice(0, 10)
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
        name: "Awards",
        item: origin ? `${origin}/awards` : "https://aevion.tech/awards",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: data.submissionTitle || data.season?.title || entryId,
        item: entryPageUrl,
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
          <Link href="/awards" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 700 }}>
            ← AEVION Awards
          </Link>
          {data.seasonId && (
            <>
              <span style={{ margin: "0 6px" }}>/</span>
              <Link
                href={`/awards/results?season=${data.seasonId}`}
                style={{ color: "#0d9488", textDecoration: "none", fontWeight: 700 }}
              >
                {data.season?.title || "Season"}
              </Link>
            </>
          )}
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
            {data.submissionTitle || `Entry ${entryId.slice(0, 12)}`}
          </h1>
          {data.season?.title && (
            <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
              {data.season.title}
              {data.artifactType ? ` · ${data.artifactType}` : ""}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={dt}>Entry ID</div>
          <p style={{ ...dd, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, wordBreak: "break-all" }}>
            {entryId}
          </p>

          {submittedAt && (
            <>
              <div style={dt}>Submitted</div>
              <p style={dd}>{submittedAt}</p>
            </>
          )}

          {qualifiedAt && (
            <>
              <div style={dt}>Qualified</div>
              <p style={dd}>{qualifiedAt}</p>
            </>
          )}

          <div style={dt}>Public badge</div>
          <div style={{ marginTop: 4, marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="AEVION Awards badge" style={{ height: 22 }} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link
              href={`/awards/badge/${entryId}`}
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
            {data.artifactVersionId && (
              <Link
                href={`/planet/artifact/${data.artifactVersionId}`}
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
                Artifact detail →
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
          </div>
        </div>
      </div>
    </main>
  );
}
