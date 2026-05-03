import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "edge";
export const alt = "AEVION customer story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface CaseSummary {
  customer: string;
  customerInitials: string;
  customerColor: string;
  industry: string;
  region: string;
  tier: string;
  hook: string;
  metrics?: Array<{ label: string; delta: string }>;
}

async function fetchCase(id: string): Promise<CaseSummary | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/pricing/cases/${id}`, { cache: "force-cache" });
    if (!r.ok) return null;
    return (await r.json()) as CaseSummary;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await fetchCase(id);

  const customer = c?.customer ?? "AEVION";
  const initials = c?.customerInitials ?? "A";
  const color = c?.customerColor ?? "#0d9488";
  const region = c?.region ?? "AEVION Customer Story";
  const tier = (c?.tier ?? "pro").toUpperCase();
  const hook = c?.hook ?? "Customer story";
  const top3 = (c?.metrics ?? []).slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, ${color} 130%)`,
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>AEVION</span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "6px 14px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              color: "#94a3b8",
            }}
          >
            CUSTOMER STORY · {tier}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 14,
                background: color,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "0.04em",
              }}
            >
              {initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em" }}>{customer}</div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{region}</div>
            </div>
          </div>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              maxWidth: 1000,
              color: "#5eead4",
            }}
          >
            {hook}
          </h1>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 28 }}>
            {top3.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", color: "#5eead4" }}>{m.delta}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>{m.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 16, color: "#64748b" }}>aevion.io/pricing/cases</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
