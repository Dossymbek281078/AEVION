/**
 * ConstitutionEmbed — read-only mini widget.
 *
 * Drop anywhere to show a "constitution fingerprint" for a given Sliders
 * snapshot. No interactivity, no API calls — pure visual.
 *
 * Use cases:
 *   - Country pages on Globus: show that country's radar at a glance
 *   - Bank/QRight dashboards: show the ecosystem's overall freedom index
 *   - Saved scenarios catalog: thumbnail preview before opening full page
 */

import {
  classify,
  computeMetrics,
  SLIDER_META,
  SLIDER_SHORT_LABELS,
  type Sliders,
} from "@/lib/constitution";
import { METRIC_LABELS, REGIME_TEXT, SHORT_LABELS, type ConstitutionLang } from "@/lib/constitutionI18n";

type Size = "sm" | "md";

const SIZES: Record<Size, { svg: number; radius: number; card: string }> = {
  sm: { svg: 180, radius: 62, card: "p-2 text-xs" },
  md: { svg: 240, radius: 88, card: "p-3 text-sm" },
};

export function ConstitutionEmbed({
  sliders,
  label,
  size = "md",
  lang,
}: {
  sliders: Sliders;
  label?: string;
  size?: Size;
  /**
   * 21.10.2026: явный язык подписей (ru/en/kk) из lib/constitutionI18n — тогда виджет
   * под translate="no" и не зависит от живого перевода. Без него — прежние русские
   * подписи lib/constitution, их доводит живой переводчик (остальные страницы).
   */
  lang?: ConstitutionLang;
}) {
  const dim = SIZES[size];
  const W = dim.svg;
  const H = dim.svg;
  const cx = W / 2;
  const cy = H / 2;
  const r = dim.radius;
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

  const metrics = computeMetrics(sliders);
  const regime = classify(sliders);
  const чужой = lang === "en" || lang === "kk" ? lang : null;
  const оси = чужой ? SHORT_LABELS[чужой] : SLIDER_SHORT_LABELS;
  const режим = чужой && REGIME_TEXT[regime.id]
    ? { name: REGIME_TEXT[regime.id].name[чужой], era: REGIME_TEXT[regime.id].era[чужой] }
    : { name: regime.name, era: regime.era };
  const метрики = METRIC_LABELS[lang ?? "ru"];

  return (
    <div
      className={`bg-[#0b1736]/85 border border-[#d4af37]/30 rounded-lg ${dim.card} text-[#e7ecf8]`}
      style={{ width: W + 24 }}
      translate={lang ? "no" : undefined}
    >
      {label && (
        <div className="text-[#d4af37] font-semibold mb-1 truncate">{label}</div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
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
              strokeOpacity={pct === 100 ? 0.35 : 0.12}
              strokeDasharray={pct === 100 ? undefined : "2 3"}
            />
          );
        })}
        {SLIDER_META.map((m, i) => {
          const outer = pointAt(i, 100);
          const labelPos = pointAt(i, 118);
          const a = angleFor(i);
          const anchor =
            Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
          return (
            <g key={m.key}>
              <line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="#d4af37"
                strokeOpacity={0.15}
              />
              {size === "md" && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#9aa3c0"
                  fontSize="8"
                  textAnchor={anchor}
                  dominantBaseline="middle"
                >
                  {оси[m.key]}
                </text>
              )}
            </g>
          );
        })}
        <polygon
          points={polygonPoints}
          fill="#22d3ee"
          fillOpacity={0.28}
          stroke="#22d3ee"
          strokeWidth={1.5}
        />
        {SLIDER_META.map((m, i) => {
          const p = pointAt(i, sliders[m.key]);
          return <circle key={m.key} cx={p.x} cy={p.y} r={2} fill="#22d3ee" />;
        })}
      </svg>
      <div className="mt-1">
        <div className="text-[#f5d27a] font-semibold truncate">{режим.name}</div>
        <div className="text-[#9aa3c0] truncate text-[10px]">{режим.era}</div>
      </div>
      <div className="mt-1 flex justify-between gap-2">
        <span className="text-[#9aa3c0]">
          {метрики.innovation}{" "}
          <span className="text-emerald-400 font-mono">{metrics.innovation}</span>
        </span>
        <span className="text-[#9aa3c0]">
          {метрики.stability}{" "}
          <span className="text-emerald-400 font-mono">{metrics.stability}</span>
        </span>
      </div>
    </div>
  );
}

export default ConstitutionEmbed;
