"use client";

import { useState } from "react";

interface RouteNode {
  country: string;
  latencyMs: number;
}

interface RouteResult {
  nodes: RouteNode[];
  totalLatencyMs: number;
  anonymityScore: number;
  seed: number;
}

export default function RoutingSimulator() {
  const [hops, setHops] = useState(3);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simulate() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api-backend/api/shadownet/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hops }),
      });
      const j = await r.json();
      if (j && j.success) {
        setResult(j.data);
      } else {
        setError(j?.error || "simulation failed");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const svgWidth = 720;
  const svgHeight = 140;
  const padX = 40;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 280px" }}>
          <label
            style={{
              display: "block",
              color: "#a855f7",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "8px",
            }}
          >
            hops: {hops}
          </label>
          <input
            type="range"
            min={3}
            max={7}
            value={hops}
            onChange={(e) => setHops(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#a855f7" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#6b21a8",
              marginTop: "4px",
              fontFamily: "monospace",
            }}
          >
            <span>3</span><span>4</span><span>5</span><span>6</span><span>7</span>
          </div>
        </div>
        <button
          onClick={simulate}
          disabled={loading}
          style={{
            background: "#a855f7",
            color: "#000",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontSize: "12px",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "routing…" : "simulate route"}
        </button>
      </div>

      {error && (
        <div
          style={{
            color: "#ef4444",
            fontFamily: "monospace",
            fontSize: "13px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(168,85,247,0.4)",
            borderRadius: "10px",
            padding: "20px",
          }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: "100%", height: "auto", marginBottom: "16px" }}
          >
            {result.nodes.map((n, i) => {
              if (i === result.nodes.length - 1) return null;
              const x1 = padX + ((svgWidth - padX * 2) / (result.nodes.length - 1)) * i;
              const x2 = padX + ((svgWidth - padX * 2) / (result.nodes.length - 1)) * (i + 1);
              return (
                <line
                  key={`l-${i}`}
                  x1={x1}
                  y1={svgHeight / 2}
                  x2={x2}
                  y2={svgHeight / 2}
                  stroke="rgba(168,85,247,0.5)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              );
            })}
            {result.nodes.map((n, i) => {
              const x = padX + ((svgWidth - padX * 2) / (result.nodes.length - 1)) * i;
              const y = svgHeight / 2;
              return (
                <g key={`n-${i}`}>
                  <circle cx={x} cy={y} r={18} fill="rgba(168,85,247,0.15)" stroke="#a855f7" strokeWidth={2}>
                    <animate attributeName="r" values="18;22;18" dur={`${1.5 + (i % 3) * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={6} fill="#a855f7" />
                  <text x={x} y={y - 28} textAnchor="middle" fill="#e9d5ff" fontSize="11" fontFamily="monospace">
                    {n.country}
                  </text>
                  <text x={x} y={y + 40} textAnchor="middle" fill="#22d3ee" fontSize="10" fontFamily="monospace">
                    {n.latencyMs}ms
                  </text>
                </g>
              );
            })}
          </svg>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              fontFamily: "monospace",
            }}
          >
            <div
              style={{
                background: "rgba(34,211,238,0.08)",
                border: "1px solid rgba(34,211,238,0.3)",
                borderRadius: "6px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "10px", color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                total latency
              </div>
              <div style={{ fontSize: "22px", color: "#a5f3fc", fontWeight: 600 }}>
                {result.totalLatencyMs}ms
              </div>
            </div>
            <div
              style={{
                background: "rgba(168,85,247,0.08)",
                border: "1px solid rgba(168,85,247,0.3)",
                borderRadius: "6px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "10px", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                anonymity score
              </div>
              <div style={{ fontSize: "22px", color: "#e9d5ff", fontWeight: 600 }}>
                {result.anonymityScore}/100
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
