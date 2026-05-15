/**
 * Общие SVG-примитивы для учебных чертежей.
 * Используются во всех страницах drawings-practice.
 */

/** Размерная линия (горизонтальная или вертикальная). */
export function DimLine({
  x1, y1, x2, y2, label, offset = 18,
  color = "#94a3b8", fontSize = 9,
}: {
  x1: number; y1: number; x2: number; y2: number;
  label: string; offset?: number;
  color?: string; fontSize?: number;
}) {
  const isH = Math.abs(y1 - y2) < 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const px = isH ? mx : mx - offset;
  const py = isH ? my - offset / 2 : my;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={px} y={py} textAnchor="middle" fontSize={fontSize} fill={color} fontStyle="italic">
        {label}
      </text>
    </g>
  );
}

/** Диагональная штриховка (земля, грунт). */
export function HatchFill({
  x, y, w, h, color = "#d4b483", spacing = 8,
}: {
  x: number; y: number; w: number; h: number;
  color?: string; spacing?: number;
}) {
  const lines: React.ReactElement[] = [];
  for (let i = -h; i < w + h; i += spacing) {
    const x1 = x + i;
    const y1 = y;
    const x2 = x + i + h;
    const y2 = y + h;
    lines.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={0.6} strokeLinecap="round" />
    );
  }
  return (
    <g clipPath={`url(#clip-${x}-${y})`}>
      <defs>
        <clipPath id={`clip-${x}-${y}`}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      {lines}
    </g>
  );
}

/** Бетонный блок с диагональной штриховкой. */
export function ConcreteBlock({
  x, y, w, h, fill = "#e2e8f0", stroke = "#64748b",
  highlighted = false, highlightFill = "#bfdbfe", highlightStroke = "#2563eb",
}: {
  x: number; y: number; w: number; h: number;
  fill?: string; stroke?: string;
  highlighted?: boolean; highlightFill?: string; highlightStroke?: string;
}) {
  const f = highlighted ? highlightFill : fill;
  const s = highlighted ? highlightStroke : stroke;
  const sw = highlighted ? 2 : 1.5;
  const lines: React.ReactElement[] = [];
  const spacing = 10;
  for (let i = -h; i < w + h; i += spacing) {
    lines.push(
      <line key={i} x1={x + i} y1={y} x2={x + i + h} y2={y + h}
        stroke={highlighted ? "#93c5fd" : "#94a3b8"} strokeWidth={0.4} />
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={f} stroke={s} strokeWidth={sw} />
      <g clipPath={`url(#clip-cb-${x}-${y}-${w}-${h})`}>
        <defs><clipPath id={`clip-cb-${x}-${y}-${w}-${h}`}><rect x={x} y={y} width={w} height={h} /></clipPath></defs>
        {lines}
      </g>
    </g>
  );
}

/** Кирпичный блок со швами. */
export function BrickBlock({
  x, y, w, h, highlighted = false, brickH = 14, brickW = 26,
}: {
  x: number; y: number; w: number; h: number;
  highlighted?: boolean; brickH?: number; brickW?: number;
}) {
  const fill = highlighted ? "#fde68a" : "#fef9c3";
  const stroke = highlighted ? "#d97706" : "#e5e7eb";
  const rows: React.ReactElement[] = [];
  let row = 0;
  for (let py = y; py < y + h; py += brickH, row++) {
    const offset = (row % 2 === 0) ? 0 : brickW / 2;
    for (let px = x - offset; px < x + w; px += brickW) {
      const rx = Math.max(px, x);
      const rw = Math.min(px + brickW, x + w) - rx;
      if (rw <= 0) continue;
      rows.push(
        <rect key={`${row}-${px}`} x={rx} y={py} width={rw} height={brickH}
          fill={fill} stroke={stroke} strokeWidth={0.6} />
      );
    }
  }
  const borderStroke = highlighted ? "#d97706" : "#ca8a04";
  return (
    <g>
      {rows}
      <rect x={x} y={y} width={w} height={h}
        fill="none" stroke={borderStroke} strokeWidth={highlighted ? 2 : 1.5} />
    </g>
  );
}

/** Стрелка (для уровней, осей). */
export function Arrow({
  x1, y1, x2, y2, color = "#64748b", size = 6,
}: {
  x1: number; y1: number; x2: number; y2: number;
  color?: string; size?: number;
}) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ax = x2 - size * Math.cos(angle - Math.PI / 6);
  const ay = y2 - size * Math.sin(angle - Math.PI / 6);
  const bx = x2 - size * Math.cos(angle + Math.PI / 6);
  const by = y2 - size * Math.sin(angle + Math.PI / 6);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} />
      <polygon points={`${x2},${y2} ${ax},${ay} ${bx},${by}`} fill={color} />
    </g>
  );
}

/** Метка уровня отметки (уголок + значение). */
export function LevelMark({
  x, y, label, side = "right", color = "#475569",
}: {
  x: number; y: number; label: string;
  side?: "left" | "right"; color?: string;
}) {
  const d = side === "right" ? 1 : -1;
  return (
    <g>
      <line x1={x - 8 * d} y1={y} x2={x + 30 * d} y2={y} stroke={color} strokeWidth={0.8} />
      <line x1={x} y1={y} x2={x + 6 * d} y2={y - 6} stroke={color} strokeWidth={0.8} />
      <text x={x + 34 * d} y={y + 4} fontSize={8} fill={color} textAnchor={side === "right" ? "start" : "end"}>
        {label}
      </text>
    </g>
  );
}

/** Заголовок чертежа (стандартный блок). */
export function DrawingTitle({
  title, subtitle, scale, number,
}: {
  title: string; subtitle?: string; scale?: string; number?: string;
}) {
  return (
    <g>
      <text x={0} y={0} fontSize={11} fontWeight="700" fill="#1e293b">{title}</text>
      {subtitle && <text x={0} y={14} fontSize={9} fill="#64748b" fontStyle="italic">{subtitle}</text>}
      {scale && <text x={0} y={subtitle ? 26 : 14} fontSize={8} fill="#94a3b8">М {scale} · {number ?? "Школа №47"}</text>}
    </g>
  );
}
