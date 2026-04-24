"use client";

import { useEffect, useState } from "react";

// In-page primer: the single block that answers "what is this, and why".
// Surfaces above the product on first visit; dismissable (per-device).
// Keeps AEVION Bank approachable even when the feature surface is deep —
// new users see a clear value proposition and an ecosystem map before they
// scroll into Copilot / Constellation / Autopilot.

const DISMISS_KEY = "aevion_bank_primer_dismissed_v1";

type Audience = "user" | "creator" | "investor";

const AUDIENCE_CONTENT: Record<
  Audience,
  { label: string; headline: string; bullets: string[]; accent: string }
> = {
  user: {
    label: "If you're here to save",
    headline: "A wallet that actively helps you reach goals",
    bullets: [
      "AI Copilot watches 8 signals on-device and nudges you before you overspend.",
      "Autopilot can move small amounts into goals behind schedule — with hard daily caps.",
      "Panic Freeze locks outgoing transfers in one tap, with a 5-minute sober window.",
    ],
    accent: "#0ea5e9",
  },
  creator: {
    label: "If you make things",
    headline: "Your reputation becomes your credit",
    bullets: [
      "Trust Score aggregates 8 factors across QRight (IP), CyberChess, Planet, and your banking activity.",
      "Royalty streams from QRight flow straight into your wallet — share goals via holographic QR.",
      "Achievements unlock tiers; tiers unlock advance lines and perks across 27 AEVION modules.",
    ],
    accent: "#d97706",
  },
  investor: {
    label: "If you're evaluating",
    headline: "Capital-light fintech with an ecosystem moat",
    bullets: [
      "Client-side sovereignty: goals, recurring, gifts all live on-device. Zero vendor lock-in.",
      "Regulator-ready by design: QSign HMAC audit, Shamir SSS 2-of-3, no lending licence needed for v1.",
      "Trust Graph is a compounding moat: each of 27 AEVION products adds a Trust factor.",
    ],
    accent: "#7c3aed",
  },
};

type FlowNode = { id: string; label: string; icon: string; x: number; y: number; color: string };
type FlowEdge = { from: string; to: string; label?: string };

const NODES: FlowNode[] = [
  { id: "user", label: "You", icon: "◉", x: 300, y: 165, color: "#f1f5f9" },
  { id: "bank", label: "Bank", icon: "₿", x: 300, y: 30, color: "#0ea5e9" },
  { id: "qright", label: "QRight", icon: "♪", x: 500, y: 70, color: "#d97706" },
  { id: "qsign", label: "QSign", icon: "✎", x: 560, y: 220, color: "#059669" },
  { id: "chess", label: "CyberChess", icon: "♞", x: 420, y: 310, color: "#7c3aed" },
  { id: "planet", label: "Planet", icon: "◈", x: 180, y: 310, color: "#10b981" },
  { id: "qcore", label: "QCoreAI", icon: "✦", x: 40, y: 220, color: "#0369a1" },
  { id: "qright2", label: "", icon: "", x: 100, y: 70, color: "#d97706" },
];

const EDGES: FlowEdge[] = [
  { from: "user", to: "bank", label: "wallet" },
  { from: "user", to: "qright", label: "IP streams" },
  { from: "user", to: "qsign", label: "audit" },
  { from: "user", to: "chess", label: "prizes" },
  { from: "user", to: "planet", label: "bonuses" },
  { from: "user", to: "qcore", label: "AI" },
];

export function ConceptPrimer() {
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
        <span>Concept primer hidden.</span>
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
          Show again
        </button>
      </div>
    );
  }

  const content = AUDIENCE_CONTENT[audience];

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
        aria-label="Hide concept primer"
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
            AEVION Bank · Concept
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
            The bank that earns <em style={{ color: "#0ea5e9", fontStyle: "normal" }}>with</em> you —{" "}
            <br />
            not from you.
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
            AEVION Bank is the financial layer of a <strong>27-product ecosystem</strong>. Your
            wallet sees royalties from your IP (QRight), chess prize money (CyberChess), Planet
            bonuses, and peer transfers — all feeding one <strong>Trust Score</strong> that
            unlocks advances, tiers, and perks. A private AI Copilot watches it for you, and an
            Autopilot moves small amounts toward your goals — opt-in, capped, audited.
          </p>

          <div
            role="tablist"
            aria-label="Audience"
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}
          >
            {(Object.keys(AUDIENCE_CONTENT) as Audience[]).map((key) => {
              const c = AUDIENCE_CONTENT[key];
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
                    border: active ? `1px solid ${c.accent}` : "1px solid rgba(15,23,42,0.12)",
                    background: active ? c.accent : "#fff",
                    color: active ? "#fff" : "#334155",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "background 160ms ease, color 160ms ease",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "12px 14px",
              border: `1px solid ${content.accent}33`,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: content.accent,
                marginBottom: 6,
              }}
            >
              {content.headline}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>
              {content.bullets.map((b, i) => (
                <li key={i} style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
                  {b}
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
              Try{" "}
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
              </kbd>
              {" "}to jump anywhere
            </span>
            <span>· Copilot lives bottom-right</span>
            <span>· Scroll ↓ to see your constellation</span>
          </div>
        </div>

        <FlowDiagram activeAudience={audience} accent={content.accent} />
      </div>
    </section>
  );
}

function FlowDiagram({ activeAudience, accent }: { activeAudience: Audience; accent: string }) {
  const [prm, setPrm] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Highlight relevant edges per audience to reinforce the narrative.
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
        aria-label="AEVION ecosystem around your wallet"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Edges */}
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
              {e.label ? (
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
                  {e.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Nodes */}
        {NODES.filter((n) => n.label).map((n) => {
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
                {n.label}
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
        You are the core. The ecosystem flows around you.
      </div>
    </div>
  );
}
