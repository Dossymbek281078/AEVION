/* AEVION board-art overlays.

   Subtle, decorative SVG overlays rendered BEHIND the pieces inside the board.
   Default opacity ≈ 0.10 (almost invisible) so it never interferes with play.
   All artwork is original (we drew it) or inspired by public-domain motifs:
     - "wave"     — Hokusai-style cresting wave (his original is PD since 1849)
     - "eiffel"   — Eiffel Tower silhouette (architecture itself is not copyrighted)
     - "shanyrak" — Kazakh шанырак / yurt-roof rosette (folk symbol — родина AEVION)
     - "persian"  — interlocking 8-point stars (classic Islamic geometric pattern)
     - "klimt"    — gold-circle pattern in Klimt's manner (PD post-2018)
   No Marvel / Disney / branded IP — all safe under common-law usage. */

import React from "react";

export type BoardArt = "off" | "wave" | "eiffel" | "shanyrak" | "persian" | "klimt";

export const BOARD_ART_OPTIONS: { v: BoardArt; label: string; hint: string }[] = [
  { v: "off",      label: "Без",       hint: "Чистая доска" },
  { v: "wave",     label: "Волна",     hint: "Хокусай · Большая волна (PD 1849)" },
  { v: "eiffel",   label: "Эйфель",    hint: "Силуэт Эйфелевой башни" },
  { v: "shanyrak", label: "Шанырак",   hint: "Казахский орнамент шанырак" },
  { v: "persian",  label: "Персид.",   hint: "Исламская геометрия — 8-конечные звёзды" },
  { v: "klimt",    label: "Klimt",     hint: "Золотые круги в стиле Климта (PD)" },
];

type Props = {
  art: BoardArt;
  /** Hex / rgba — overlay tint colour. Default light-cream. */
  tint?: string;
  /** 0..1 — how visible the overlay is. Default 0.10. */
  opacity?: number;
};

export default function BoardArtOverlay({ art, tint = "#94a3b8", opacity = 0.1 }: Props) {
  if (art === "off") return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        opacity,
      }}
      aria-hidden
    >
      {art === "wave" && WaveArt(tint)}
      {art === "eiffel" && EiffelArt(tint)}
      {art === "shanyrak" && ShanyrakArt(tint)}
      {art === "persian" && PersianArt(tint)}
      {art === "klimt" && KlimtArt(tint)}
    </svg>
  );
}

/* ─────────── individual designs (vector, no rasters) ─────────── */

function WaveArt(c: string) {
  // Stylised cresting wave, head bottom-left, foam-curls echoing Hokusai
  return (
    <g fill="none" stroke={c} strokeWidth="0.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0,72 C20,48 38,52 50,68 C60,82 78,82 100,60" />
      <path d="M0,82 C18,62 36,66 50,80 C62,92 80,90 100,72" />
      <path d="M0,92 C16,76 34,80 50,90 C64,98 82,96 100,84" />
      {/* foam curls */}
      <circle cx="14" cy="56" r="3" />
      <circle cx="26" cy="50" r="2" />
      <circle cx="42" cy="60" r="2.4" />
      <path d="M50,68 q4,-12 16,-12 q-6,4 -8,12" />
      <path d="M70,72 q4,-8 14,-8 q-5,3 -7,8" />
    </g>
  );
}

function EiffelArt(c: string) {
  // Eiffel silhouette centred, tapering 4 legs → middle deck → top spire
  return (
    <g fill="none" stroke={c} strokeWidth="0.4" strokeLinecap="round">
      {/* outer silhouette */}
      <path d="M50,5 L50,20 M44,20 L56,20 M44,20 L34,55 M56,20 L66,55 M34,55 L26,95 M66,55 L74,95" />
      {/* horizontal decks */}
      <line x1="38" y1="40" x2="62" y2="40" />
      <line x1="33" y1="60" x2="67" y2="60" />
      <line x1="28" y1="85" x2="72" y2="85" />
      {/* lattice cross-bracing */}
      <g strokeWidth="0.22">
        <path d="M38,40 L62,60 M62,40 L38,60" />
        <path d="M33,60 L67,85 M67,60 L33,85" />
        <path d="M44,20 L56,40 M56,20 L44,40" />
      </g>
      {/* spire light */}
      <circle cx="50" cy="5" r="0.9" fill={c} stroke="none" />
    </g>
  );
}

function ShanyrakArt(c: string) {
  // Kazakh шанырак — circular yurt-roof rosette: outer ring + spokes + inner ring
  const cx = 50, cy = 50;
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, cx + Math.cos(a) * 32, cy + Math.sin(a) * 32];
  });
  return (
    <g fill="none" stroke={c} strokeWidth="0.35">
      <circle cx={cx} cy={cy} r="34" />
      <circle cx={cx} cy={cy} r="22" />
      <circle cx={cx} cy={cy} r="12" />
      <circle cx={cx} cy={cy} r="3" />
      {spokes.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
      {/* outer scallops */}
      {Array.from({ length: 32 }, (_, i) => {
        const a1 = (i / 32) * Math.PI * 2;
        const a2 = ((i + 1) / 32) * Math.PI * 2;
        const r = 38;
        const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
        const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
        return <path key={i} d={`M${x1},${y1} Q${cx + Math.cos((a1 + a2) / 2) * 41},${cy + Math.sin((a1 + a2) / 2) * 41} ${x2},${y2}`} />;
      })}
    </g>
  );
}

function PersianArt(c: string) {
  // Interlocking 8-point stars — classic Islamic geometric tile
  const tiles: React.ReactNode[] = [];
  const star = (cx: number, cy: number, r: number, key: string) => {
    const pts: string[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.5;
      pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
    }
    return <polygon key={key} points={pts.join(" ")} fill="none" stroke={c} strokeWidth="0.3" />;
  };
  for (let r = 0; r < 5; r++) {
    for (let cIdx = 0; cIdx < 5; cIdx++) {
      const x = cIdx * 22 + (r % 2 ? 11 : 0);
      const y = r * 22;
      tiles.push(star(x, y, 7, `${r}-${cIdx}`));
    }
  }
  return <g>{tiles}</g>;
}

function KlimtArt(c: string) {
  // Densely packed circles of varying size — Klimt-esque gold-leaf field
  const dots: React.ReactNode[] = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 44; i++) {
    const cx = rnd() * 100;
    const cy = rnd() * 100;
    const r = 1.2 + rnd() * 4;
    dots.push(<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="0.3" />);
    if (rnd() > 0.55) dots.push(<circle key={`f${i}`} cx={cx} cy={cy} r={r * 0.45} fill={c} opacity="0.4" />);
  }
  // Spiral accent
  const spiralPts: string[] = [];
  for (let t = 0; t < 24; t++) {
    const a = t * 0.5;
    const r = 2 + t * 0.6;
    spiralPts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return (
    <g>
      {dots}
      <polyline points={spiralPts.join(" ")} fill="none" stroke={c} strokeWidth="0.35" />
    </g>
  );
}
