import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { revokeReasonLabel } from "@/lib/qrightRevokeReasons";
import { pickLang, tString } from "@/lib/qrightServerI18n";
import { CopyHash } from "./CopyHash";

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
  revokeReasonCode?: string | null;
  certificateId?: string | null;
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

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const origin = await getOrigin();
  const rssUrl = origin
    ? `${origin}/api-backend/api/qright/objects/${encodeURIComponent(id)}/changelog.rss`
    : `${getApiBase()}/api/qright/objects/${encodeURIComponent(id)}/changelog.rss`;
  const fallback: Metadata = {
    title: "QRight registration — AEVION",
    description: "Public registration record on the AEVION QRight registry.",
    openGraph: { type: "article", title: "QRight registration — AEVION" },
    twitter: { card: "summary_large_image", title: "QRight registration — AEVION" },
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
    alternates: { types: { "application/rss+xml": rssUrl } },
    openGraph: {
      type: "article",
      title: titleLine,
      description: desc,
    },
    twitter: {
      card: "summary_large_image",
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

export default async function QRightObjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const isEmbed = sp.embed === "1" || sp.embed === "true";
  const h = await headers();
  const lang = pickLang(sp, h);
  const t = (key: string, vars?: Record<string, string | number>) =>
    tString("object", lang, key, vars);
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
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{t("failedTitle")}</div>
            <div style={{ fontSize: 13 }}>{t("failedDetail")}</div>
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
            <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>{t("notFoundTitle")}</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              {(() => {
                const [pre, post] = t("notFoundDetail").split("{id}");
                return (
                  <>
                    {pre}
                    <code style={mono}>{id}</code>
                    {post}
                  </>
                );
              })()}
            </div>
            <Link
              href="/qright"
              style={{ color: "#0d9488", fontWeight: 800, textDecoration: "none", fontSize: 13 }}
            >
              {t("registerCta")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isRevoked = data.status === "revoked";
  const accent = isRevoked ? "#dc2626" : "#0d9488";
  const accentBg = isRevoked ? "rgba(220,38,38,0.08)" : "rgba(13,148,136,0.08)";

  if (isEmbed) {
    // Compact iframe mode: no chrome, single card sized to fit a
    // ~360x140 third-party embed slot. Click anywhere → opens full
    // public page in a new tab.
    return (
      <main
        style={{
          minHeight: "100%",
          padding: 8,
          background: "transparent",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <a
          href={`/qright/object/${id}`}
          target="_blank"
          rel="noopener"
          style={{
            display: "block",
            textDecoration: "none",
            border: `2px solid ${accent}`,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accentBg}, #fff)`,
            padding: "12px 14px",
            color: "#0f172a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: accent,
                color: "#fff",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.08em",
              }}
            >
              {isRevoked ? t("revokedFull") : "✓ AEVION QRIGHT"}
            </span>
            {data.kind && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {data.kind}
              </span>
            )}
            {data.createdAt && (
              <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
                {new Date(data.createdAt).toISOString().slice(0, 10)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, color: "#0f172a", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.title || t("untitled")}
          </div>
          {data.contentHashPrefix && (
            <div style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10, color: "#64748b" }}>
              SHA-256: {data.contentHashPrefix}…
            </div>
          )}
          {isRevoked && data.revokeReason && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#7f1d1d" }}>
              {data.revokeReason}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: accent, fontWeight: 700 }}>
            {t("viewProof")}
          </div>
        </a>
      </main>
    );
  }

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
        name: "QRight",
        item: origin ? `${origin}/qright` : "https://aevion.tech/qright",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: data.title || `QRight ${id.slice(0, 8)}`,
        item: verifyUrl,
      },
    ],
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/qright"
            style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
          >
            {t("back")}
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
            {isRevoked ? t("revokedFull") : `✓ ${t("registered")}`}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            {data.title || t("untitled")}
          </h1>
          {isRevoked && (
            <p style={{ marginTop: 10, marginBottom: 0, color: "#7f1d1d", fontSize: 13 }}>
              <strong>{t("revokedNotice")}</strong>
              {data.revokeReasonCode ? (
                <> {t("revokedReason")}: <em>{revokeReasonLabel(data.revokeReasonCode, lang)}</em>.</>
              ) : null}
              {data.revokeReason ? ` ${data.revokeReason}` : null}
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
              {t("embedCta")}
            </Link>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 14 }}>
            {t("recordTitle")}
          </h2>
          {data.kind && (
            <>
              <div style={dt}>{t("kind")}</div>
              <p style={{ ...dd, textTransform: "uppercase", fontWeight: 700 }}>{data.kind}</p>
            </>
          )}
          {data.ownerName && (
            <>
              <div style={dt}>{t("owner")}</div>
              <p style={dd}>{data.ownerName}</p>
            </>
          )}
          {(data.country || data.city) && (
            <>
              <div style={dt}>{t("location")}</div>
              <p style={dd}>{[data.city, data.country].filter(Boolean).join(", ")}</p>
            </>
          )}
          {data.createdAt && (
            <>
              <div style={dt}>{t("registeredAt")}</div>
              <p style={dd}>{new Date(data.createdAt).toUTCString()}</p>
            </>
          )}
          {data.revokedAt && (
            <>
              <div style={dt}>{t("revokedAt")}</div>
              <p style={{ ...dd, color: "#b91c1c" }}>{new Date(data.revokedAt).toUTCString()}</p>
            </>
          )}
          {data.contentHash && (
            <>
              <div style={dt}>{t("contentHash")}</div>
              <p style={{ ...dd, ...mono, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 auto" }}>{data.contentHash}</span>
                <CopyHash value={data.contentHash} label="SHA-256" />
              </p>
            </>
          )}
          <div style={dt}>{t("objectId")}</div>
          <p style={{ ...dd, ...mono }}>{id}</p>
        </div>

        <div style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 12 }}>
            {t("verifyTitle")}
          </h2>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 0, marginBottom: 14, lineHeight: 1.6 }}>
            {t("verifyHelp")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {data.certificateId && (
              <Link
                href={`/verify/${data.certificateId}`}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: accent,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                {t("cryptoVerify")}
              </Link>
            )}
            <Link
              href="/verify-offline"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: data.certificateId ? "#fff" : "#0f172a",
                color: data.certificateId ? "#0f172a" : "#fff",
                border: data.certificateId ? "1px solid rgba(15,23,42,0.15)" : "none",
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {t("offlineVerify")}
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
              {t("embedJson")}
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
              {t("rawBadge")}
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
