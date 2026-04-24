"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAdvance, type Advance } from "../_lib/advance";
import { useCurrency } from "../_lib/CurrencyContext";
import { convertFromAec, formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { loadRecurring, type Recurring } from "../_lib/recurring";
import { GOALS_EVENT, loadGoals, type SavingsGoal } from "../_lib/savings";
import type { Account, Operation } from "../_lib/types";

type NodeCategory = "goal" | "royalty" | "chess" | "planet" | "recurring" | "advance";

type Node = {
  id: string;
  category: NodeCategory;
  label: string;
  icon: string;
  color: string;
  magnitudeAec: number; // drives visual size
  directionIn: boolean; // true = money flows IN to wallet
  subtitle: string;
  anchorId: string | null;
};

const CATEGORY_COLOR: Record<NodeCategory, string> = {
  goal: "#0ea5e9",
  royalty: "#d97706",
  chess: "#7c3aed",
  planet: "#059669",
  recurring: "#dc2626",
  advance: "#db2777",
};

const CATEGORY_ICON: Record<NodeCategory, string> = {
  goal: "★",
  royalty: "♪",
  chess: "♞",
  planet: "◉",
  recurring: "↻",
  advance: "⇅",
};

function estimateRecurring30d(recurring: Recurring[]): number {
  const horizon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const daysFor: Record<string, number> = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };
  let sum = 0;
  for (const r of recurring) {
    if (!r.active) continue;
    const t0 = Date.parse(r.nextRunAt);
    if (!Number.isFinite(t0)) continue;
    let t = t0;
    const step = (daysFor[r.period] ?? 30) * 24 * 60 * 60 * 1000;
    while (t <= horizon) {
      sum += r.amount;
      t += step;
    }
  }
  return sum;
}

function buildNodes({
  royalty,
  chess,
  ecosystem,
  goals,
  recurring,
  advance,
}: {
  royalty: ReturnType<typeof useEcosystemData>["royalty"];
  chess: ReturnType<typeof useEcosystemData>["chess"];
  ecosystem: ReturnType<typeof useEcosystemData>["ecosystem"];
  goals: SavingsGoal[];
  recurring: Recurring[];
  advance: Advance | null;
}): Node[] {
  const list: Node[] = [];

  for (const g of goals.slice(0, 3)) {
    if (g.targetAec <= 0) continue;
    const progress = Math.min(1, g.currentAec / g.targetAec);
    list.push({
      id: `goal_${g.id}`,
      category: "goal",
      label: g.label,
      icon: CATEGORY_ICON.goal,
      color: CATEGORY_COLOR.goal,
      magnitudeAec: g.targetAec,
      directionIn: false,
      subtitle: `${(progress * 100).toFixed(0)}% · ${g.currentAec.toFixed(0)}/${g.targetAec.toFixed(0)} AEC`,
      anchorId: null,
    });
  }

  const royalty30 = royalty?.estimated30d ?? 0;
  if (royalty30 > 0) {
    list.push({
      id: "royalty",
      category: "royalty",
      label: "QRight royalties",
      icon: CATEGORY_ICON.royalty,
      color: CATEGORY_COLOR.royalty,
      magnitudeAec: royalty30,
      directionIn: true,
      subtitle: `+${royalty30.toFixed(2)} AEC projected (30d)`,
      anchorId: null,
    });
  }

  const chessTotal = chess?.totalWon ?? 0;
  if (chessTotal > 0) {
    list.push({
      id: "chess",
      category: "chess",
      label: "CyberChess prizes",
      icon: CATEGORY_ICON.chess,
      color: CATEGORY_COLOR.chess,
      magnitudeAec: chessTotal,
      directionIn: true,
      subtitle: `${chessTotal.toFixed(0)} AEC won · ${chess?.topThreeFinishes ?? 0} podium${(chess?.topThreeFinishes ?? 0) === 1 ? "" : "s"}`,
      anchorId: null,
    });
  }

  const planetLast90 = ecosystem?.perSource.planet.last90d ?? 0;
  if (planetLast90 > 0) {
    list.push({
      id: "planet",
      category: "planet",
      label: "Planet bonuses",
      icon: CATEGORY_ICON.planet,
      color: CATEGORY_COLOR.planet,
      magnitudeAec: planetLast90,
      directionIn: true,
      subtitle: `${planetLast90.toFixed(0)} AEC · 90d`,
      anchorId: null,
    });
  }

  const recurring30 = estimateRecurring30d(recurring);
  if (recurring30 > 0) {
    list.push({
      id: "recurring",
      category: "recurring",
      label: "Recurring outflow",
      icon: CATEGORY_ICON.recurring,
      color: CATEGORY_COLOR.recurring,
      magnitudeAec: recurring30,
      directionIn: false,
      subtitle: `−${recurring30.toFixed(0)} AEC scheduled (30d)`,
      anchorId: null,
    });
  }

  if (advance && advance.outstanding > 0) {
    list.push({
      id: "advance",
      category: "advance",
      label: "Salary advance",
      icon: CATEGORY_ICON.advance,
      color: CATEGORY_COLOR.advance,
      magnitudeAec: advance.outstanding,
      directionIn: false,
      subtitle: `${advance.outstanding.toFixed(2)} AEC outstanding`,
      anchorId: null,
    });
  }

  // Cap to 8 nodes for legibility; prioritise non-goal streams so constellation
  // feels rich when wallet has ecosystem flows.
  return list.slice(0, 8);
}

export function WealthConstellation({
  account,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { royalty, chess, ecosystem } = useEcosystemData();
  const { code } = useCurrency();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [advance, setAdvance] = useState<Advance | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [prm, setPrm] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setGoals(loadGoals());
      setRecurring(loadRecurring());
      setAdvance(loadAdvance());
    };
    sync();
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq) {
      setPrm(mq.matches);
      const onPrm = () => setPrm(mq.matches);
      mq.addEventListener?.("change", onPrm);
      window.addEventListener(GOALS_EVENT, sync);
      window.addEventListener("focus", sync);
      window.addEventListener("storage", sync);
      return () => {
        mq.removeEventListener?.("change", onPrm);
        window.removeEventListener(GOALS_EVENT, sync);
        window.removeEventListener("focus", sync);
        window.removeEventListener("storage", sync);
      };
    }
    window.addEventListener(GOALS_EVENT, sync);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GOALS_EVENT, sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const nodes = useMemo(
    () => buildNodes({ royalty, chess, ecosystem, goals, recurring, advance }),
    [royalty, chess, ecosystem, goals, recurring, advance],
  );

  // Geometry
  const width = 640;
  const height = 340;
  const cx = width / 2;
  const cy = height / 2;
  const rx = 240;
  const ry = 110;

  const maxMagnitude = Math.max(1, ...nodes.map((n) => n.magnitudeAec));
  const balanceSize = Math.max(24, Math.min(48, 20 + Math.log10(Math.max(1, account.balance + 1)) * 10));

  const placements = useMemo(() => {
    if (nodes.length === 0) return [];
    return nodes.map((n, i) => {
      // Distribute around ellipse, slight vertical stagger to avoid collisions.
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const stagger = i % 2 === 0 ? 1 : 0.85;
      const sx = cx + Math.cos(angle) * rx;
      const sy = cy + Math.sin(angle) * ry * stagger;
      const rel = n.magnitudeAec / maxMagnitude;
      const r = 8 + rel * 10; // 8..18 px
      return { node: n, sx, sy, r, angle };
    });
  }, [nodes, cx, cy, rx, ry, maxMagnitude]);

  const displayBalance = formatCurrency(convertFromAec(account.balance, code), code);
  const inflowAec = nodes.filter((n) => n.directionIn).reduce((s, n) => s + n.magnitudeAec, 0);
  const outflowAec = nodes.filter((n) => !n.directionIn).reduce((s, n) => s + n.magnitudeAec, 0);

  return (
    <section
      aria-labelledby="constellation-heading"
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#e2e8f0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes aevion-flow-in {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -24; }
        }
        @keyframes aevion-flow-out {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 24; }
        }
        @keyframes aevion-twinkle {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes aevion-center-pulse {
          0%, 100% { r: 4; opacity: 0.35; }
          50%      { r: 18; opacity: 0; }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg,#7c3aed,#0ea5e9)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 15,
            }}
          >
            ✧
          </span>
          <div>
            <h2 id="constellation-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              Wealth Constellation
            </h2>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Your financial gravity well — live streams around the wallet core.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: "#34d399" }}>↑ in {inflowAec.toFixed(0)} AEC</span>
          <span style={{ color: "#f87171" }}>↓ out {outflowAec.toFixed(0)} AEC</span>
          <span style={{ color: "#93c5fd" }}>◉ {nodes.length} streams</span>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Wealth constellation with ${nodes.length} streams around the wallet core`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            <radialGradient id="aevion-core-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f0f9ff" />
              <stop offset="50%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#1e293b" />
            </radialGradient>
            <radialGradient id="aevion-halo-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(14,165,233,0.5)" />
              <stop offset="100%" stopColor="rgba(14,165,233,0)" />
            </radialGradient>
          </defs>

          {/* Background stars — decorative dots */}
          {Array.from({ length: 40 }, (_, i) => {
            const x = ((i * 67) % width) + 5;
            const y = ((i * 41) % height) + 3;
            const sz = 0.6 + ((i * 13) % 3) * 0.4;
            const delay = ((i * 7) % 10) * 0.35;
            return (
              <circle
                key={`bg-${i}`}
                cx={x}
                cy={y}
                r={sz}
                fill="#94a3b8"
                opacity={0.35}
                style={
                  prm
                    ? undefined
                    : {
                        animation: `aevion-twinkle 3.5s ease-in-out ${delay}s infinite`,
                      }
                }
              />
            );
          })}

          {/* Orbit guideline */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="rgba(148,163,184,0.15)"
            strokeDasharray="3 6"
          />

          {/* Flow lines from center to each node */}
          {placements.map(({ node, sx, sy }) => (
            <line
              key={`flow-${node.id}`}
              x1={cx}
              y1={cy}
              x2={sx}
              y2={sy}
              stroke={node.color}
              strokeWidth={1.8}
              strokeDasharray="6 6"
              opacity={hoverId && hoverId !== node.id ? 0.2 : 0.7}
              style={
                prm
                  ? undefined
                  : {
                      animation: node.directionIn
                        ? "aevion-flow-in 2.4s linear infinite"
                        : "aevion-flow-out 2.4s linear infinite",
                    }
              }
            />
          ))}

          {/* Core halo */}
          <circle
            cx={cx}
            cy={cy}
            r={balanceSize + 18}
            fill="url(#aevion-halo-grad)"
            opacity={0.8}
          />
          {/* Core pulse */}
          {!prm ? (
            <circle
              cx={cx}
              cy={cy}
              r={6}
              fill="rgba(14,165,233,0.35)"
              style={{ animation: "aevion-center-pulse 2.6s ease-out infinite" }}
            />
          ) : null}
          {/* Core (wallet) */}
          <circle cx={cx} cy={cy} r={balanceSize} fill="url(#aevion-core-grad)" stroke="rgba(14,165,233,0.6)" strokeWidth={1.5} />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            style={{ fontSize: 11, fontWeight: 900, fill: "#0f172a", letterSpacing: "0.04em" }}
          >
            WALLET
          </text>
          <text
            x={cx}
            y={cy - balanceSize - 8}
            textAnchor="middle"
            style={{ fontSize: 12, fontWeight: 900, fill: "#e2e8f0" }}
          >
            {displayBalance}
          </text>

          {/* Satellites */}
          {placements.map(({ node, sx, sy, r }) => {
            const isActive = hoverId === node.id;
            return (
              <g key={node.id}>
                {/* Satellite halo */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={r + 6}
                  fill={`${node.color}22`}
                  style={
                    prm
                      ? undefined
                      : { animation: `aevion-twinkle 3s ease-in-out ${(sx + sy) % 4}s infinite` }
                  }
                />
                <circle
                  cx={sx}
                  cy={sy}
                  r={r}
                  fill={node.color}
                  stroke={isActive ? "#fff" : "rgba(255,255,255,0.25)"}
                  strokeWidth={isActive ? 2 : 1}
                  onMouseEnter={() => setHoverId(node.id)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{ cursor: "pointer", transition: "stroke-width 160ms ease" }}
                  aria-label={`${node.label} · ${node.subtitle}`}
                />
                <text
                  x={sx}
                  y={sy + 4}
                  textAnchor="middle"
                  pointerEvents="none"
                  style={{ fontSize: 11, fontWeight: 900, fill: "#fff" }}
                >
                  {node.icon}
                </text>
                {/* Label under satellite */}
                <text
                  x={sx}
                  y={sy + r + 14}
                  textAnchor="middle"
                  pointerEvents="none"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    fill: isActive ? "#fff" : "#cbd5e1",
                    letterSpacing: "0.02em",
                  }}
                >
                  {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoverId ? (
          (() => {
            const place = placements.find((p) => p.node.id === hoverId);
            if (!place) return null;
            return (
              <div
                role="tooltip"
                style={{
                  position: "absolute",
                  left: `${(place.sx / width) * 100}%`,
                  top: `${(place.sy / height) * 100}%`,
                  transform: "translate(-50%, -120%)",
                  background: "#fff",
                  color: "#0f172a",
                  padding: "8px 10px",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.25)",
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: place.node.color, fontSize: 13 }}>{place.node.icon}</span>
                  <span>{place.node.label}</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>
                  {place.node.subtitle}
                </div>
              </div>
            );
          })()
        ) : null}

        {nodes.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#94a3b8",
            }}
          >
            Add a goal, earn a royalty, or set up recurring to populate the constellation.
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 700,
          marginTop: 10,
        }}
      >
        {(Object.keys(CATEGORY_COLOR) as NodeCategory[]).map((cat) => {
          const hasAny = nodes.some((n) => n.category === cat);
          if (!hasAny) return null;
          return (
            <span
              key={cat}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 999,
                background: `${CATEGORY_COLOR[cat]}25`,
                color: CATEGORY_COLOR[cat],
              }}
            >
              {CATEGORY_ICON[cat]} {cat}
            </span>
          );
        })}
      </div>
    </section>
  );
}
