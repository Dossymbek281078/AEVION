import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Wishlist — Wants with savings counters";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ITEMS = [
  { name: "Studio mic", saved: 320, target: 480, color: "#5eead4" },
  { name: "Apartment deposit", saved: 4_200, target: 6_000, color: "#a78bfa" },
  { name: "Trip to Almaty", saved: 180, target: 600, color: "#fbbf24" },
];

export default function WishlistOg() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at 30% 20%, rgba(94,234,212,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase", display: "flex" }}>
          AEVION · Wishlist
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Save toward</span>
            <span style={{ color: "#5eead4" }}>what you want.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 920 }}>
            {ITEMS.map((it) => {
              const pct = Math.round((it.saved / it.target) * 100);
              return (
                <div
                  key={it.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 18px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${it.color}33`,
                  }}
                >
                  <div style={{ width: 220, fontWeight: 700, color: "#fff", fontSize: 18, display: "flex" }}>{it.name}</div>
                  <div
                    style={{
                      flex: 1,
                      height: 14,
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    <div style={{ width: `${pct}%`, background: it.color, display: "flex" }} />
                  </div>
                  <div style={{ width: 80, textAlign: "right", fontWeight: 800, color: it.color, fontSize: 16, display: "flex", justifyContent: "flex-end" }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 16,
            fontWeight: 700,
            color: "#94a3b8",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>aevion.app/bank/wishlist</div>
          <div style={{ color: "#5eead4", display: "flex" }}>local-only · multilingual</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
