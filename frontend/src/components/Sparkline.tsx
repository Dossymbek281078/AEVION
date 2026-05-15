import type { CSSProperties } from "react";

type Point = { day: string; fetches: number };

type Props = {
  points: Point[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};

// Tiny inline-SVG sparkline. No client-side JS needed; safe for both
// server-rendered and client-rendered contexts.
export function Sparkline({
  points,
  width = 120,
  height = 28,
  stroke = "#0d9488",
  fill = "rgba(13,148,136,0.15)",
  style,
  ariaLabel,
}: Props) {
  if (!points || points.length === 0) {
    return (
      <div
        aria-label={ariaLabel || "no data"}
        style={{ width, height, ...style, display: "inline-block", color: "#cbd5e1", fontSize: 10, lineHeight: `${height}px`, textAlign: "center" }}
      >
        no data
      </div>
    );
  }

  const max = Math.max(1, ...points.map((p) => p.fetches));
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const xy = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p.fetches / max) * (height - 2) - 1;
    return [x, y] as const;
  });

  const linePath = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width.toFixed(1)},${height} L0,${height} Z`;
  const total = points.reduce((s, p) => s + p.fetches, 0);

  return (
    <svg
      role="img"
      aria-label={ariaLabel || `Fetches over ${points.length} days, total ${total}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
