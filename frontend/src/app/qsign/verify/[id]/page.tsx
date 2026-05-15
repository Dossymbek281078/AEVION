import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getApiBase } from "@/lib/apiBase";
import { CopyButton, ShareButton } from "./ClientBits";

export const dynamic = "force-dynamic";

type PublicView = {
  id: string;
  algoVersion: string;
  canonicalization: string;
  createdAt: string | null;
  valid: boolean;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  payload: unknown;
  payloadCanonical: string;
  payloadHash: string;
  hmac: { kid: string; algo: string; signature: string; valid: boolean };
  ed25519: {
    kid: string;
    algo: string;
    signature: string;
    publicKey: string | null;
    valid: boolean | null;
  } | null;
  dilithium: null;
  issuer: { userId: string | null; email: string | null };
  geo: {
    source: string | null;
    country: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

async function loadPublic(id: string): Promise<PublicView | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/qsign/v2/${encodeURIComponent(id)}/public`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicView;
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

/* ───────── metadata ───────── */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: "QSign verification — AEVION",
    description:
      "Public verification page for a QSign v2 signature (RFC 8785 + HMAC + Ed25519).",
    openGraph: {
      title: "QSign verification — AEVION",
      description: "RFC 8785 + HMAC + Ed25519 signature verification.",
      type: "article",
    },
  };
  if (!id) return fallback;

  const pub = await loadPublic(id);
  if (!pub) return fallback;

  const statusText = pub.revoked
    ? "revoked"
    : pub.valid
    ? "valid"
    : "invalid";
  const desc = [
    `Signature ${id.slice(0, 8)} · ${statusText}`,
    `${pub.algoVersion} · ${pub.canonicalization}`,
    `hmac=${pub.hmac.kid}`,
    pub.ed25519 ? `ed25519=${pub.ed25519.kid}` : null,
    pub.geo?.country ? `geo=${pub.geo.country}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `QSign ${id.slice(0, 8)} — ${statusText.toUpperCase()}`,
    description: desc,
    openGraph: {
      title: `QSign ${id.slice(0, 8)} — ${statusText.toUpperCase()}`,
      description: desc,
      type: "article",
    },
  };
}

/* ───────── styles ───────── */

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const mono: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#334155",
};
const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

/* ───────── page ───────── */

export default async function QSignVerifyPage({ params }: Props) {
  const { id } = await params;
  const pub = await loadPublic(id);
  const origin = await getOrigin();
  const shareUrl = origin ? `${origin}/qsign/verify/${id}` : `/qsign/verify/${id}`;

  if (!pub) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "60px auto",
          padding: "0 20px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            ...card,
            textAlign: "center",
            padding: 40,
            background: "linear-gradient(180deg, #fef2f2, #fff)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#b91c1c",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            Signature not found
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900 }}>
            {id}
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px" }}>
            This QSign signature id does not exist, or the backend is unavailable.
          </p>
          <Link
            href="/qsign"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← Back to QSign Studio
          </Link>
        </div>
      </main>
    );
  }

  const qrSvg = await QRCode.toString(shareUrl, {
    type: "svg",
    margin: 1,
    width: 180,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  // ───── status computation ─────
  const bannerBg = pub.revoked
    ? "linear-gradient(135deg, #b45309, #78350f)"
    : pub.valid
    ? "linear-gradient(135deg, #065f46, #064e3b)"
    : "linear-gradient(135deg, #991b1b, #7f1d1d)";
  const bannerTitle = pub.revoked
    ? "REVOKED"
    : pub.valid
    ? "VALID SIGNATURE"
    : "INVALID SIGNATURE";
  const bannerCaption = pub.revoked
    ? "This signature was revoked by its issuer. Historical cryptographic validity is unchanged, but the signature is no longer in force."
    : pub.valid
    ? "All cryptographic checks passed. The payload has not been altered since it was signed."
    : "One or more cryptographic checks failed. Do not trust this payload.";

  const payloadPretty = (() => {
    try {
      return JSON.stringify(pub.payload, null, 2);
    } catch {
      return pub.payloadCanonical;
    }
  })();

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "40px auto 80px",
        padding: "0 20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* breadcrumbs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <Link
          href="/qsign"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#475569",
            textDecoration: "none",
          }}
        >
          ← QSign Studio
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <ShareButton url={shareUrl} />
          <Link
            href="/planet"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              color: "#0f766e",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            AEVION Planet
          </Link>
        </div>
      </div>

      {/* status banner */}
      <div
        style={{
          borderRadius: 20,
          overflow: "hidden",
          marginBottom: 22,
          background: bannerBg,
          color: "#fff",
          padding: "26px 26px 22px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              opacity: 0.85,
              marginBottom: 6,
            }}
          >
            QSign {pub.algoVersion}
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            {bannerTitle}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              opacity: 0.88,
              lineHeight: 1.5,
              maxWidth: 480,
            }}
          >
            {bannerCaption}
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 11,
              opacity: 0.85,
            }}
          >
            <span>id: <code style={{ fontFamily: "monospace" }}>{pub.id}</code></span>
            {pub.createdAt ? (
              <span>
                signed: {new Date(pub.createdAt).toISOString().replace("T", " ").slice(0, 19)} UTC
              </span>
            ) : null}
            {pub.revoked && pub.revokedAt ? (
              <span>
                revoked: {new Date(pub.revokedAt).toISOString().replace("T", " ").slice(0, 19)} UTC
              </span>
            ) : null}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 10,
            borderRadius: 12,
            width: 180,
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      {pub.revoked && pub.revocationReason ? (
        <div
          style={{
            ...card,
            borderColor: "rgba(180,83,9,0.25)",
            background: "rgba(254,243,199,0.35)",
            marginBottom: 18,
          }}
        >
          <div style={label}>Revocation reason</div>
          <div style={{ fontSize: 14, color: "#78350f", fontWeight: 600 }}>
            {pub.revocationReason}
          </div>
        </div>
      ) : null}

      {/* cryptographic checks grid */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: pub.ed25519 ? "1fr 1fr" : "1fr",
          marginBottom: 18,
        }}
      >
        <CheckCard
          title="HMAC-SHA256"
          kid={pub.hmac.kid}
          valid={pub.hmac.valid}
          signature={pub.hmac.signature}
          publicKey={null}
        />
        {pub.ed25519 ? (
          <CheckCard
            title="Ed25519"
            kid={pub.ed25519.kid}
            valid={pub.ed25519.valid}
            signature={pub.ed25519.signature}
            publicKey={pub.ed25519.publicKey}
          />
        ) : null}
      </div>

      {/* payload card */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 15 }}>Signed payload</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CopyButton value={payloadPretty} label="copy payload" />
            <CopyButton value={pub.payloadCanonical} label="copy canonical" />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>Canonicalization</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            {pub.canonicalization} — keys sorted, no whitespace, deterministic.
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>SHA-256 hash of canonical</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ ...mono, wordBreak: "break-all", flex: 1 }}>
              {pub.payloadHash}
            </code>
            <CopyButton value={pub.payloadHash} label="copy hash" />
          </div>
        </div>

        <pre
          style={{
            ...mono,
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 14,
            borderRadius: 10,
            overflow: "auto",
            maxHeight: 360,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {payloadPretty}
        </pre>
      </div>

      {/* issuer + geo */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "1fr 1fr",
          marginBottom: 18,
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>Issuer</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            {pub.issuer.email ? (
              <>
                <div style={label}>email</div>
                <div style={{ marginBottom: 8, color: "#0f172a", fontWeight: 600 }}>
                  {pub.issuer.email}
                </div>
              </>
            ) : null}
            {pub.issuer.userId ? (
              <>
                <div style={label}>user id</div>
                <code style={mono}>{pub.issuer.userId}</code>
              </>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Anonymous issuer</div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
            Geo anchor
          </div>
          {pub.geo ? (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div style={label}>source</div>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                {pub.geo.source || "—"}
              </div>
              {(pub.geo.country || pub.geo.city) && (
                <>
                  <div style={label}>location</div>
                  <div style={{ marginBottom: 8 }}>
                    {[pub.geo.city, pub.geo.country].filter(Boolean).join(", ") || "—"}
                  </div>
                </>
              )}
              {pub.geo.lat !== null && pub.geo.lng !== null ? (
                <>
                  <div style={label}>coords</div>
                  <code style={mono}>
                    {pub.geo.lat.toFixed(4)}, {pub.geo.lng.toFixed(4)}
                  </code>
                </>
              ) : null}
            </div>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 12 }}>
              No geo data attached to this signature.
            </div>
          )}
        </div>
      </div>

      {/* footer / how-to-verify */}
      <div
        style={{
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 14,
          padding: 18,
          background: "rgba(15,23,42,0.02)",
          fontSize: 13,
          color: "#475569",
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: "#0f172a" }}>
          Verify independently
        </div>
        <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>
          <li>
            Canonicalize the payload per <strong>RFC 8785 (JCS)</strong> — sort keys
            lexicographically, strip whitespace.
          </li>
          <li>
            SHA-256 of the canonical string should equal{" "}
            <code style={mono}>{pub.payloadHash}</code>.
          </li>
          <li>
            HMAC-SHA256 verify requires the shared secret published under key id{" "}
            <code style={mono}>{pub.hmac.kid}</code>.
          </li>
          {pub.ed25519 && pub.ed25519.publicKey ? (
            <li>
              Ed25519 verify is fully public: use the public key{" "}
              <code style={{ ...mono, wordBreak: "break-all" }}>
                {pub.ed25519.publicKey}
              </code>
              .
            </li>
          ) : null}
        </ol>
        <div>
          Machine-readable view:{" "}
          <Link
            href={`/api-backend/api/qsign/v2/${id}/public`}
            style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}
          >
            /api/qsign/v2/{id}/public
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ───────── sub-components (server) ───────── */

function CheckCard({
  title,
  kid,
  valid,
  signature,
  publicKey,
}: {
  title: string;
  kid: string;
  valid: boolean | null;
  signature: string;
  publicKey: string | null;
}) {
  const color =
    valid === null ? "#64748b" : valid ? "#047857" : "#b91c1c";
  const bg =
    valid === null
      ? "rgba(100,116,139,0.08)"
      : valid
      ? "rgba(16,185,129,0.08)"
      : "rgba(239,68,68,0.08)";
  const statusText =
    valid === null ? "not checked" : valid ? "valid" : "invalid";
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: bg,
            color,
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {statusText}
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={label}>key id</div>
        <code style={mono}>{kid}</code>
      </div>
      <div style={{ marginBottom: publicKey ? 10 : 0 }}>
        <div style={label}>signature</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <code
            style={{
              ...mono,
              wordBreak: "break-all",
              flex: 1,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            {signature}
          </code>
          <CopyButton value={signature} label="copy" />
        </div>
      </div>
      {publicKey ? (
        <div>
          <div style={label}>public key</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <code
              style={{
                ...mono,
                wordBreak: "break-all",
                flex: 1,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {publicKey}
            </code>
            <CopyButton value={publicKey} label="copy" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
