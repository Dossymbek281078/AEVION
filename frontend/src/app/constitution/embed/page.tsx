"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  classify,
  computeMetrics,
  COUNTRIES,
  DEFAULT_SLIDERS,
  PRESETS,
  SLIDER_META,
  SLIDER_SHORT_LABELS,
  type Sliders,
} from "@/lib/constitution";
import { useFunnel } from "@/lib/useFunnel";

/**
 * Embed widget — designed to be loaded in an <iframe> on any external site.
 *
 * URL params (precedence: artifact > sliders > preset > country > default):
 *   ?artifact=<uuid>  — load published Planet artifact and apply its sliders
 *   ?sliders=<base64json>  — explicit sliders object, base64-encoded JSON
 *   ?preset=<name>    — match against PRESETS (case-insensitive, kebab/space-insensitive)
 *   ?country=<code>   — 2-letter country code (no/sg/kz/...)
 *   ?theme=dark|light — color scheme (default: dark)
 *   ?compact=1        — hide the regime card, show only the radar
 *
 * postMessage to parent window when loaded:
 *   { type: "constitution.applied", sliders, regime: { id, name, era }, metrics }
 */

const W = 360;
const H = 360;

function parseSlidersParam(raw: string | null): Sliders | null {
  if (!raw) return null;
  try {
    const decoded = atob(raw);
    const obj = JSON.parse(decoded) as Record<string, unknown>;
    const out = { ...DEFAULT_SLIDERS };
    for (const k of Object.keys(DEFAULT_SLIDERS) as Array<keyof Sliders>) {
      const v = obj[k];
      if (typeof v === "number" && v >= 0 && v <= 100) {
        out[k] = Math.round(v);
      }
    }
    return out;
  } catch {
    return null;
  }
}

function presetByName(name: string): Sliders | null {
  const key = name.toLowerCase().replace(/[\s_-]+/g, "");
  const hit = PRESETS.find((p) => p.name.toLowerCase().replace(/[\s_-]+/g, "").includes(key));
  return hit?.sliders ?? null;
}

function countryByCodeLocal(code: string): Sliders | null {
  const c = COUNTRIES.find((x) => x.code === code.toLowerCase());
  return c?.sliders ?? null;
}

export default function ConstitutionEmbedPage() {
  const [sliders, setSliders] = useState<Sliders>(DEFAULT_SLIDERS);
  // Охват виджета на чужих сайтах. Событие embed_view было в словаре, а слал
  // его НОЛЬ мест: сколько внешних площадок нас показывают, мы не знали.
  // Считаем один раз на загрузку и БЕЗ адреса площадки — только вид вставки.
  const { track } = useFunnel();
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const kind = sp.get("artifact")
      ? "artifact"
      : sp.get("sliders")
        ? "sliders"
        : sp.get("preset")
          ? "preset"
          : sp.get("country")
            ? "country"
            : "default";
    track("embed_view", { kind });
  }, [track]);
  const [label, setLabel] = useState<string>("Default scenario");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [compact, setCompact] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>("https://aevion.app");

  useEffect(() => {
    setOrigin(window.location.origin);
    const sp = new URLSearchParams(window.location.search);
    let resolved: Sliders | null = null;
    let resolvedLabel = "Custom";

    const artifactId = sp.get("artifact");
    if (artifactId) {
      void (async () => {
        try {
          const r = await fetch(
            `/api-backend/api/planet/constitution-artifacts/${encodeURIComponent(artifactId)}`,
          );
          if (r.ok) {
            const j = (await r.json()) as {
              payload?: { sliders?: Sliders; title?: string };
            };
            if (j.payload?.sliders) {
              setSliders({ ...DEFAULT_SLIDERS, ...j.payload.sliders });
              if (j.payload.title) setLabel(j.payload.title);
            }
          }
        } catch { /* ignore */ }
      })();
    }

    const slidersParam = sp.get("sliders");
    if (slidersParam) {
      const parsed = parseSlidersParam(slidersParam);
      if (parsed) { resolved = parsed; resolvedLabel = "Custom scenario"; }
    }
    if (!resolved) {
      const presetName = sp.get("preset");
      if (presetName) {
        const p = presetByName(presetName);
        if (p) { resolved = p; resolvedLabel = presetName; }
      }
    }
    if (!resolved) {
      const cc = sp.get("country");
      if (cc) {
        const cs = countryByCodeLocal(cc);
        if (cs) {
          resolved = cs;
          const flag = COUNTRIES.find((x) => x.code === cc.toLowerCase())?.flag ?? "";
          const name = COUNTRIES.find((x) => x.code === cc.toLowerCase())?.name ?? cc.toUpperCase();
          resolvedLabel = `${flag} ${name}`;
        }
      }
    }
    if (resolved) {
      setSliders(resolved);
      setLabel(resolvedLabel);
    }

    if (sp.get("theme") === "light") setTheme("light");
    if (sp.get("compact") === "1") setCompact(true);
  }, []);

  const metrics = useMemo(() => computeMetrics(sliders), [sliders]);
  const regime = useMemo(() => classify(sliders), [sliders]);

  // postMessage to parent when sliders/regime change
  useEffect(() => {
    try {
      window.parent.postMessage(
        {
          type: "constitution.applied",
          sliders,
          regime: { id: regime.id, name: regime.name, era: regime.era },
          metrics: { innovation: metrics.innovation, stability: metrics.stability, legitimacy: metrics.legitimacy },
          label,
        },
        "*",
      );
    } catch { /* ignore — not in iframe */ }
  }, [sliders, regime, metrics, label]);

  const cx = W / 2;
  const cy = H / 2;
  const radius = 120;
  const n = SLIDER_META.length;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, val: number) => {
    const a = angleFor(i);
    const r = (val / 100) * radius;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const polygonPoints = SLIDER_META
    .map((m, i) => {
      const p = pointAt(i, sliders[m.key]);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  const palette = theme === "light"
    ? { bg: "#f8fafc", card: "#ffffff", text: "#0f172a", muted: "#64748b", gold: "#b45309", line: "#94a3b8", fill: "#0891b2", stroke: "#0e7490" }
    : { bg: "#050a1a", card: "#0b1736", text: "#e7ecf8", muted: "#9aa3c0", gold: "#d4af37", line: "#d4af37", fill: "#22d3ee", stroke: "#0891b2" };

  return (
    <div
      style={{
        margin: 0,
        padding: 12,
        minHeight: "100vh",
        background: palette.bg,
        color: palette.text,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: 16,
          background: palette.card,
          border: `1px solid ${palette.gold}33`,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: palette.gold }}>{label}</div>
          <div style={{ fontSize: 11, color: palette.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            AEVION · Constitution
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto", width: "100%", maxWidth: W, height: "auto" }}>
          {[25, 50, 75, 100].map((pct) => (
            <circle
              key={pct}
              cx={cx}
              cy={cy}
              r={(pct / 100) * radius}
              fill="none"
              stroke={palette.line}
              strokeOpacity={pct === 100 ? 0.45 : 0.15}
              strokeDasharray={pct === 100 ? undefined : "3 4"}
            />
          ))}
          {SLIDER_META.map((m, i) => {
            const outer = pointAt(i, 100);
            const labelPos = pointAt(i, 118);
            const a = angleFor(i);
            const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
            return (
              <g key={m.key}>
                <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke={palette.line} strokeOpacity={0.2} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={palette.muted}
                  fontSize="9"
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
            fill={palette.fill}
            fillOpacity={0.3}
            stroke={palette.stroke}
            strokeWidth={2}
          />
          {SLIDER_META.map((m, i) => {
            const p = pointAt(i, sliders[m.key]);
            return <circle key={m.key} cx={p.x} cy={p.y} r={2.5} fill={palette.stroke} />;
          })}
        </svg>
        {!compact && (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: palette.gold, fontSize: 16, fontWeight: 700 }}>{regime.name}</div>
            <div style={{ color: palette.muted, fontSize: 12, fontStyle: "italic" }}>{regime.era}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
              <span style={{ color: palette.muted }}>
                Innovation <b style={{ color: "#10b981" }}>{metrics.innovation}</b>
              </span>
              <span style={{ color: palette.muted }}>
                Stability <b style={{ color: "#10b981" }}>{metrics.stability}</b>
              </span>
              <span style={{ color: palette.muted }}>
                Legitimacy <b style={{ color: "#10b981" }}>{metrics.legitimacy}</b>
              </span>
            </div>
          </div>
        )}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${palette.gold}22`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: palette.muted }}>
          <Link href="/constitution" target="_top" style={{ color: palette.muted, textDecoration: "none" }}>
            Powered by AEVION Constitution →
          </Link>
          <span>{origin}/constitution</span>
        </div>
      </div>
      {/* Hidden by default — surfaces an embed snippet for "view source"-curious devs */}
      <div style={{ maxWidth: 560, margin: "12px auto 0", fontSize: 10, color: palette.muted, fontFamily: "monospace", opacity: 0.5 }}>
        {`<iframe src="${origin}/constitution/embed?preset=nordic" width="580" height="500" frameborder="0"></iframe>`}
      </div>
    </div>
  );
}
