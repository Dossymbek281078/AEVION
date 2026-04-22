"use client";

import { useMemo } from "react";
import { computeTrustScore, tierColor, tierLabel } from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";

export function TrustScoreCard({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { score, tier, breakdown } = useMemo(
    () => computeTrustScore(account, operations),
    [account, operations],
  );

  const color = tierColor[tier];
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        background: "#fff",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <svg width={80} height={80} viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
          <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={6} />
          <circle
            cx={40}
            cy={40}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 40 40)"
          />
          <text x={40} y={44} textAnchor="middle" fontSize={20} fontWeight={900} fill="#0f172a">
            {score}
          </text>
          <text x={40} y={56} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">
            / 100
          </text>
        </svg>
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color,
              marginBottom: 4,
            }}
          >
            Trust score · {tierLabel[tier]}
          </div>
          <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
            Your reputation in the AEVION Trust Graph. Grows with account age, transfer volume,
            network diversity and activity.
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {breakdown.map((b) => (
          <div key={b.label}>
            <div
              style={{
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 700,
                letterSpacing: "0.06em",
                marginBottom: 4,
                textTransform: "uppercase" as const,
              }}
            >
              {b.label}
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(b.points / b.max) * 100}%`,
                  height: "100%",
                  background: color,
                  transition: "width 300ms",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              {b.points}/{b.max} · {b.hint}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
