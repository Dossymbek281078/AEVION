import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

// Edge so the image renders fast and doesn't tie up the Node server.
export const runtime = "edge";
export const alt = "AEVION Digital IP Bureau — public certificate registry";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Totals = {
  certificates?: number;
  verifications?: number;
  authorsApprox?: number;
  countriesApprox?: number;
};

async function fetchTotals(): Promise<Totals | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/pipeline/bureau/stats`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { totals?: Totals } | null;
    return (j && j.totals) || null;
  } catch {
    return null;
  }
}

function fmt(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return n.toLocaleString();
}

export default async function Image(): Promise<ImageResponse> {
  const t = await fetchTotals();
  const stat = (label: string, value: string, accent: string) => ({
    label,
    value,
    accent,
  });
  const stats = [
    stat("Certificates", fmt(t?.certificates), "#5eead4"),
    stat("Verifications", fmt(t?.verifications), "#93c5fd"),
    stat("Authors", fmt(t?.authorsApprox), "#fcd34d"),
    stat("Countries", fmt(t?.countriesApprox), "#fda4af"),
  ];

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
          padding: "70px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: brand line */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, #0d9488, #06b6d4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            A
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
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
            <div
              style={{ fontSize: 18, color: "#94a3b8", marginTop: 4 }}
            >
              Public, verifiable registry of cryptographically protected works
            </div>
          </div>
        </div>

        {/* Middle: headline */}
        <div
          style={{
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginTop: 60,
            color: "#fff",
          }}
        >
          Proof of authorship,
          <br />
          backed by math + treaty.
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 22,
            marginTop: 56,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "20px 22px",
                borderRadius: 16,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
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
                  fontSize: 48,
                  fontWeight: 900,
                  color: s.accent,
                  marginTop: 8,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom: crypto stack chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: "auto",
            flexWrap: "wrap",
          }}
        >
          {[
            "SHA-256",
            "HMAC-SHA256",
            "Ed25519",
            "Shamir SSS",
            "Merkle root",
          ].map((c) => (
            <div
              key={c}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(94,234,212,0.12)",
                color: "#5eead4",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "0.05em",
                border: "1px solid rgba(94,234,212,0.3)",
              }}
            >
              {c}
            </div>
          ))}
          <div
            style={{
              marginLeft: "auto",
              fontSize: 16,
              color: "#94a3b8",
              fontWeight: 700,
            }}
          >
            Berne · WIPO · TRIPS · eIDAS · ESIGN
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
