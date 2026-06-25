import { ImageResponse } from "next/og";
import {
  classify,
  computeMetrics,
  PRESETS,
  SLIDER_META,
  SLIDER_SHORT_LABELS,
  type Sliders,
} from "@/lib/constitution";

export const runtime = "edge";
export const alt = "Constitution — Лаборатория устройства мира";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Static OG image for /constitution. Uses the "Open Access (идеал)" preset
 * as the silhouette — it's the most visually striking shape and matches
 * the page's aspirational framing.
 *
 * For per-scenario dynamic OG, see app/constitution/og-dynamic/route.ts
 * (TODO if needed) — the static image here is what gets cached by social
 * platforms (Twitter/X, Telegram, Facebook) when the page URL is shared.
 */
export default async function Image() {
  const sliders: Sliders =
    PRESETS.find((p) => p.name === "Open Access (идеал)")?.sliders ??
    PRESETS[0].sliders;
  const metrics = computeMetrics(sliders);
  const regime = classify(sliders);

  const W = 1200;
  const H = 630;
  const cx = 320;
  const cy = H / 2;
  const r = 220;
  const n = SLIDER_META.length;

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, val: number) => {
    const a = angleFor(i);
    const rad = (val / 100) * r;
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  };
  const polygonPoints = SLIDER_META.map((m, i) => {
    const p = pointAt(i, sliders[m.key]);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background:
            "linear-gradient(135deg, #0b1736 0%, #131f3d 55%, #050a1a 100%)",
          color: "#e7ecf8",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {[25, 50, 75, 100].map((pct) => {
            const ringR = (pct / 100) * r;
            return (
              <circle
                key={pct}
                cx={cx}
                cy={cy}
                r={ringR}
                fill="none"
                stroke="#d4af37"
                strokeOpacity={pct === 100 ? 0.4 : 0.15}
              />
            );
          })}
          {SLIDER_META.map((m, i) => {
            const outer = pointAt(i, 100);
            const labelPos = pointAt(i, 118);
            const a = angleFor(i);
            const anchor =
              Math.cos(a) > 0.3
                ? "start"
                : Math.cos(a) < -0.3
                  ? "end"
                  : "middle";
            return (
              <g key={m.key}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#d4af37"
                  strokeOpacity={0.2}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#9aa3c0"
                  fontSize="16"
                  textAnchor={anchor}
                  dominantBaseline="middle"
                >
                  {SLIDER_SHORT_LABELS[m.key]}
                </text>
              </g>
            );
          })}
          <polygon
            points={polygonPoints}
            fill="#22d3ee"
            fillOpacity={0.32}
            stroke="#22d3ee"
            strokeWidth={3}
          />
          {SLIDER_META.map((m, i) => {
            const p = pointAt(i, sliders[m.key]);
            return <circle key={m.key} cx={p.x} cy={p.y} r={5} fill="#22d3ee" />;
          })}
        </svg>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: 600,
            top: 80,
            width: 540,
            height: 470,
          }}
        >
          <div
            style={{
              color: "#d4af37",
              fontSize: 22,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
              display: "flex",
            }}
          >
            AEVION · Constitution
          </div>
          <div
            style={{
              color: "#f5d27a",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.05,
              marginBottom: 14,
              display: "flex",
            }}
          >
            Лаборатория устройства мира
          </div>
          <div
            style={{
              color: "#e7ecf8",
              fontSize: 24,
              lineHeight: 1.3,
              marginBottom: 24,
              display: "flex",
            }}
          >
            8 параметров → классификатор режимов. Куда скатится общество, если
            двигать пол снизу, закон, ротацию и прозрачность.
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "16px 18px",
              background: "rgba(34,211,238,0.10)",
              border: "1px solid rgba(34,211,238,0.40)",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                color: "#22d3ee",
                fontSize: 18,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Силуэт сценария
            </div>
            <div
              style={{
                color: "#f5d27a",
                fontSize: 32,
                fontWeight: 700,
                display: "flex",
              }}
            >
              {regime.name}
            </div>
            <div
              style={{
                color: "#9aa3c0",
                fontSize: 16,
                fontStyle: "italic",
                display: "flex",
              }}
            >
              {regime.era}
            </div>
            <div
              style={{
                display: "flex",
                gap: 18,
                marginTop: 6,
                color: "#9aa3c0",
                fontSize: 16,
              }}
            >
              <span style={{ display: "flex" }}>
                Инновация{" "}
                <b style={{ color: "#10b981", marginLeft: 6 }}>
                  {metrics.innovation}
                </b>
              </span>
              <span style={{ display: "flex" }}>
                Устойчивость{" "}
                <b style={{ color: "#10b981", marginLeft: 6 }}>
                  {metrics.stability}
                </b>
              </span>
              <span style={{ display: "flex" }}>
                Легитимность{" "}
                <b style={{ color: "#10b981", marginLeft: 6 }}>
                  {metrics.legitimacy}
                </b>
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 600,
            color: "#9aa3c0",
            fontSize: 16,
            display: "flex",
          }}
        >
          aevion.io / constitution · North · Acemoglu · Ostrom · Taleb
        </div>
      </div>
    ),
    size,
  );
}
