import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AEVION Bank Flow — From sources, through the wallet, to categories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Decorative stylised Sankey on the right of the OG. Pure CSS / SVG primitives —
// not a real Sankey computed from data, just visually evocative.

export default function FlowOg() {
  // Three sample sources on the left, three categories on the right.
  const W = 540;
  const H = 360;
  const colW = 36;
  const sources = [
    { label: "Banking", color: "#0f766e", y: 30, h: 110 },
    { label: "QRight", color: "#7c3aed", y: 150, h: 80 },
    { label: "Planet", color: "#059669", y: 240, h: 90 },
  ];
  const cats = [
    { label: "Subs", color: "#d97706", y: 30, h: 100 },
    { label: "Tips", color: "#db2777", y: 140, h: 70 },
    { label: "Contacts", color: "#0ea5e9", y: 220, h: 110 },
  ];

  // Pre-compute simple ribbons: distribute each source across cats proportionally.
  const ribbons: Array<{ from: typeof sources[0]; to: typeof cats[0]; fy: number; ty: number; fh: number; th: number }> = [];
  const totalSrc = sources.reduce((s, n) => s + n.h, 0);
  const totalCat = cats.reduce((s, n) => s + n.h, 0);
  for (const s of sources) {
    let fOff = 0;
    for (const c of cats) {
      const flow = (s.h / totalSrc) * (c.h / totalCat) * Math.min(totalSrc, totalCat);
      const fh = (flow / s.h) * s.h;
      const th = (flow / c.h) * c.h;
      ribbons.push({
        from: s,
        to: c,
        fy: s.y + fOff,
        ty: c.y + ribbons
          .filter((r) => r.to.label === c.label)
          .reduce((acc, r) => acc + r.th, 0),
        fh,
        th,
      });
      fOff += fh;
    }
  }

  const curve = (x1: number, y1: number, x2: number, y2: number, h1: number, h2: number) => {
    const cx1 = x1 + (x2 - x1) * 0.5;
    const cx2 = x1 + (x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2} L ${x2} ${y2 + h2} C ${cx2} ${y2 + h2}, ${cx1} ${y1 + h1}, ${x1} ${y1 + h1} Z`;
  };

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 64,
          gap: 32,
          background:
            "radial-gradient(circle at 20% 80%, rgba(13,148,136,0.30), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 540 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            AEVION · Money flow
          </div>
          <div
            style={{
              fontSize: 70,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Sources →</span>
            <span style={{ color: "#5eead4" }}>wallet → categories.</span>
          </div>
          <div style={{ fontSize: 20, color: "#cbd5e1", lineHeight: 1.45, display: "flex" }}>
            Sankey-style picture of every dollar that came in and where it went out.
            Mass-balanced. Locale-aware. Period-switchable.
          </div>
        </div>

        {/* Decorative Sankey */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <g opacity={0.55}>
            {ribbons.map((r, i) => (
              <path
                key={i}
                d={curve(colW, r.fy, W - colW, r.ty, r.fh, r.th)}
                fill={r.from.color}
                opacity={0.5}
              />
            ))}
          </g>
          {sources.map((s) => (
            <rect key={s.label} x={0} y={s.y} width={colW} height={s.h} fill={s.color} rx={4} />
          ))}
          {cats.map((c) => (
            <rect key={c.label} x={W - colW} y={c.y} width={colW} height={c.h} fill={c.color} rx={4} />
          ))}
        </svg>
      </div>
    ),
    { ...size },
  );
}
