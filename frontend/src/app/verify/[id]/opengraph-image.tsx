import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "edge";
export const alt = "AEVION verified certificate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type PageProps = { params: Promise<{ id: string }> };

type Verify = {
  valid?: boolean;
  certificate?: {
    id?: string;
    title?: string;
    kind?: string;
    author?: string;
    location?: string | null;
    contentHash?: string;
    protectedAt?: string;
  };
  stats?: { verifiedCount?: number };
};

const KIND_LABEL: Record<string, string> = {
  music: "Music",
  code: "Code",
  design: "Design",
  text: "Text",
  video: "Video",
  idea: "Idea",
  other: "Work",
};

const KIND_ACCENT: Record<string, string> = {
  music: "#fcd34d",
  code: "#5eead4",
  design: "#fda4af",
  text: "#93c5fd",
  video: "#c4b5fd",
  idea: "#fdba74",
  other: "#cbd5e1",
};

async function fetchVerify(id: string): Promise<Verify | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/pipeline/verify/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Verify;
  } catch {
    return null;
  }
}

function shortHash(h: string | undefined): string {
  if (!h) return "—";
  if (h.length <= 16) return h;
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export default async function Image({ params }: PageProps): Promise<ImageResponse> {
  const { id } = await params;
  const v = await fetchVerify(id);
  const c = v?.certificate;
  const valid = !!v?.valid;
  const kind = (c?.kind || "other") as string;
  const accent = KIND_ACCENT[kind] || "#cbd5e1";
  const kindLabel = KIND_LABEL[kind] || "Work";
  const verifies = v?.stats?.verifiedCount ?? 0;
  const protectedAt = c?.protectedAt
    ? new Date(c.protectedAt).toISOString().slice(0, 10)
    : "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #020617 0%, #0f172a 35%, #1e1b4b 100%)",
          color: "#f1f5f9",
          padding: "60px 70px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: brand + status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 13,
                background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              A
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#5eead4",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              AEVION Digital IP Bureau
            </div>
          </div>
          <div
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              background: valid
                ? "rgba(16,185,129,0.18)"
                : "rgba(239,68,68,0.18)",
              color: valid ? "#34d399" : "#fca5a5",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              border: `1px solid ${valid ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            }}
          >
            {valid ? "✓ Verified" : "⚠ Unknown"}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginTop: 56,
            color: "#fff",
            display: "flex",
          }}
        >
          {c?.title || "Untitled certificate"}
        </div>

        {/* By line */}
        <div
          style={{
            fontSize: 26,
            color: "#cbd5e1",
            marginTop: 18,
            display: "flex",
          }}
        >
          by {c?.author || "—"}
          {c?.location ? ` · ${c.location}` : ""}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
          {[
            { label: "Type", value: kindLabel, accent },
            { label: "Protected", value: protectedAt, accent: "#5eead4" },
            { label: "Verifications", value: `${verifies}×`, accent: "#93c5fd" },
            {
              label: "Hash (SHA-256)",
              value: shortHash(c?.contentHash),
              accent: "#fdba74",
              mono: true,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "16px 20px",
                borderRadius: 14,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: s.mono ? 22 : 32,
                  fontWeight: 900,
                  color: s.accent,
                  marginTop: 6,
                  letterSpacing: "-0.01em",
                  fontFamily: s.mono
                    ? "ui-monospace, Menlo, monospace"
                    : "system-ui, sans-serif",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 24,
            fontSize: 14,
            color: "#94a3b8",
            fontWeight: 700,
          }}
        >
          <div>SHA-256 · HMAC-SHA256 · Ed25519 · Shamir SSS · Merkle root</div>
          <div>Berne · WIPO · TRIPS · eIDAS · ESIGN</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
