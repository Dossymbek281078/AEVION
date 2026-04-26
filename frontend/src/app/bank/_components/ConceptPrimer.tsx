"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const DISMISS_KEY = "aevion_bank_primer_dismissed_v1";

type Audience = "user" | "creator" | "investor";

const AUDIENCE_META: Record<Audience, { labelKey: string; headlineKey: string; bulletKeys: string[]; accent: string }> = {
  user: {
    labelKey: "primer.audience.user",
    headlineKey: "primer.user.headline",
    bulletKeys: ["primer.user.b1", "primer.user.b2", "primer.user.b3"],
    accent: "#0ea5e9",
  },
  creator: {
    labelKey: "primer.audience.creator",
    headlineKey: "primer.creator.headline",
    bulletKeys: ["primer.creator.b1", "primer.creator.b2", "primer.creator.b3"],
    accent: "#d97706",
  },
  investor: {
    labelKey: "primer.audience.investor",
    headlineKey: "primer.investor.headline",
    bulletKeys: ["primer.investor.b1", "primer.investor.b2", "primer.investor.b3"],
    accent: "#7c3aed",
  },
};

type FlowNode = { id: string; labelKey: string; icon: string; x: number; y: number; color: string };
type FlowEdge = { from: string; to: string; labelKey?: string };

const NODES: FlowNode[] = [
  { id: "user", labelKey: "primer.flow.user", icon: "◉", x: 300, y: 165, color: "#f1f5f9" },
  { id: "bank", labelKey: "primer.flow.bank", icon: "₿", x: 300, y: 30, color: "#0ea5e9" },
  { id: "qright", labelKey: "primer.flow.qright", icon: "♪", x: 500, y: 70, color: "#d97706" },
  { id: "qsign", labelKey: "primer.flow.qsign", icon: "✎", x: 560, y: 220, color: "#059669" },
  { id: "chess", labelKey: "primer.flow.chess", icon: "♞", x: 420, y: 310, color: "#7c3aed" },
  { id: "planet", labelKey: "primer.flow.planet", icon: "◈", x: 180, y: 310, color: "#10b981" },
  { id: "qcore", labelKey: "primer.flow.qcore", icon: "✦", x: 40, y: 220, color: "#0369a1" },
  { id: "qright2", labelKey: "", icon: "", x: 100, y: 70, color: "#d97706" },
];

const EDGES: FlowEdge[] = [
  { from: "user", to: "bank", labelKey: "primer.flow.edge.wallet" },
  { from: "user", to: "qright", labelKey: "primer.flow.edge.ip" },
  { from: "user", to: "qsign", labelKey: "primer.flow.edge.audit" },
  { from: "user", to: "chess", labelKey: "primer.flow.edge.prizes" },
  { from: "user", to: "planet", labelKey: "primer.flow.edge.bonuses" },
  { from: "user", to: "qcore", labelKey: "primer.flow.edge.ai" },
];

export function ConceptPrimer() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [audience, setAudience] = useState<Audience>("user");
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setLoaded(true);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const restore = () => {
    setDismissed(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
  };

  if (!loaded) return null;

  if (dismissed) {
    return (
      <div
        style={{
          marginBottom: 16,
          padding: "6px 12px",
          borderRadius: 10,
          background: "rgba(14,165,233,0.06)",
          fontSize: 11,
          color: "#0369a1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>{t("primer.hidden")}</span>
        <button
          type="button"
          onClick={restore}
          style={{
            border: "none",
            background: "transparent",
            color: "#0369a1",
            fontWeight: 800,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {t("primer.showAgain")}
        </button>
      </div>
    );
  }

  const meta = AUDIENCE_META[audience];

  return (
    <section
      aria-labelledby="primer-heading"
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background:
          "linear-gradient(135deg, rgba(14,165,233,0.05), rgba(124,58,237,0.05))",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("primer.dismissLabel")}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          border: "none",
          background: "transparent",
          color: "#94a3b8",
          fontSize: 16,
          fontWeight: 900,
          cursor: "pointer",
          padding: 4,
          zIndex: 2,
        }}
      >
        ×
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
          gap: 20,
          alignItems: "start",
        }}
        className="aevion-primer-grid"
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 4,
            }}
          >
            {t("primer.eyebrow")}
          </div>
          <h2
            id="primer-heading"
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: 0,
              color: "#0f172a",
              lineHeight: 1.15,
            }}
          >
            {t("primer.title.a")}{" "}
            <em style={{ color: "#0ea5e9", fontStyle: "normal" }}>{t("primer.title.b")}</em>{" "}
            {t("primer.title.c")}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#475569",
              lineHeight: 1.55,
              margin: "10px 0 14px",
              maxWidth: 520,
            }}
          >
            {t("primer.body")}
          </p>

          <div
            role="tablist"
            aria-label="Audience"
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}
          >
            {(Object.keys(AUDIENCE_META) as Audience[]).map((key) => {
              const m = AUDIENCE_META[key];
              const active = audience === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAudience(key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: active ? `1px solid ${m.accent}` : "1px solid rgba(15,23,42,0.12)",
                    background: active ? m.accent : "#fff",
                    color: active ? "#fff" : "#334155",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "background 160ms ease, color 160ms ease",
                  }}
                >
                  {t(m.labelKey)}
                </button>
              );
            })}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "12px 14px",
              border: `1px solid ${meta.accent}33`,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: meta.accent,
                marginBottom: 6,
              }}
            >
              {t(meta.headlineKey)}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
              {meta.bulletKeys.map((bKey, i) => (
                <li key={i} style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
                  {t(bKey)}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
              flexWrap: "wrap",
              fontSize: 11,
              color: "#64748b",
              fontWeight: 700,
            }}
          >
            <span>
              {t("primer.try.cmdk")}{" "}
              <kbd
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(15,23,42,0.06)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10,
                }}
              >
                ⌘K
              </kbd>{" "}
              {t("primer.try.cmdkAfter")}
            </span>
            <span>{t("primer.try.copilot")}</span>
            <span>{t("primer.try.scroll")}</span>
          </div>
        </div>

        <FlowDiagram activeAudience={audience} accent={meta.accent} />
      </div>
    </section>
  );
}

function FlowDiagram({ activeAudience, accent }: { activeAudience: Audience; accent: string }) {
  const { t } = useI18n();
  const [prm, setPrm] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const highlighted: Record<Audience, string[]> = {
    user: ["bank", "qcore"],
    creator: ["qright", "qsign", "chess"],
    investor: ["bank", "qsign", "planet"],
  };
  const hotNodes = new Set(highlighted[activeAudience]);

  const userNode = NODES.find((n) => n.id === "user");
  if (!userNode) return null;

  return (
    <div
      style={{
        background: "#0f172a",
        borderRadius: 12,
        padding: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes aevion-primer-flow {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -16; }
        }
      `}</style>
      <svg
        viewBox="0 0 600 370"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("primer.flow.label")}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {EDGES.map((e) => {
          const from = NODES.find((n) => n.id === e.from);
          const to = NODES.find((n) => n.id === e.to);
          if (!from || !to) return null;
          const isHot = hotNodes.has(e.to) || hotNodes.has(e.from);
          return (
            <g key={`${e.from}-${e.to}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHot ? accent : "#334155"}
                strokeWidth={isHot ? 2 : 1}
                strokeDasharray="5 5"
                opacity={isHot ? 0.95 : 0.3}
                style={
                  prm
                    ? undefined
                    : {
                        animation: "aevion-primer-flow 2.8s linear infinite",
                      }
                }
              />
              {e.labelKey ? (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  textAnchor="middle"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fill: isHot ? accent : "#64748b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {t(e.labelKey)}
                </text>
              ) : null}
            </g>
          );
        })}

        {NODES.filter((n) => n.labelKey).map((n) => {
          const hot = hotNodes.has(n.id) || n.id === "user";
          const isUser = n.id === "user";
          const r = isUser ? 28 : 22;
          return (
            <g key={n.id}>
              {hot ? (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 6}
                  fill={`${n.color}30`}
                />
              ) : null}
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={isUser ? "url(#user-grad)" : n.color}
                stroke={hot ? "#fff" : "rgba(255,255,255,0.2)"}
                strokeWidth={hot ? 1.8 : 1}
              />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  fill: isUser ? "#0f172a" : "#fff",
                }}
              >
                {n.icon}
              </text>
              <text
                x={n.x}
                y={n.y + r + 14}
                textAnchor="middle"
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  fill: hot ? "#fff" : "#94a3b8",
                  letterSpacing: "0.02em",
                }}
              >
                {n.labelKey ? t(n.labelKey) : ""}
              </text>
            </g>
          );
        })}

        <defs>
          <radialGradient id="user-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </radialGradient>
        </defs>
      </svg>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {t("primer.flow.caption")}
      </div>
    </div>
  );
}
