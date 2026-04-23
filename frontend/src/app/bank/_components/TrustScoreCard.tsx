"use client";

import { useMemo } from "react";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import {
  computeEcosystemTrustScore,
  tierColor,
  tierDescription,
  tierLabel,
} from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";
import { RadarChart } from "./charts";

export function TrustScoreCard({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { royalty, chess, ecosystem } = useEcosystemData();

  const trust = useMemo(
    () => computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem }),
    [account, operations, royalty, chess, ecosystem],
  );

  const color = tierColor[trust.tier];
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (trust.score / 100) * circ;

  const bankingFactors = trust.factors.filter((f) => f.cluster === "banking");
  const ecoFactors = trust.factors.filter((f) => f.cluster === "ecosystem");

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        background: "#fff",
        marginBottom: 16,
      }}
      aria-labelledby="trust-heading"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 260px) 1fr",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative" as const, width: 220, height: 220 }}>
            <RadarChart
              axes={trust.factors.map((f) => ({
                key: f.key,
                label: f.label,
                points: f.points,
                max: f.max,
              }))}
              size={220}
              color={color}
              ariaLabel={`Ecosystem Trust radar, overall score ${trust.score} of 100`}
            />
            <div
              style={{
                position: "absolute" as const,
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none" as const,
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  background: "#fff",
                  border: `2px solid ${color}`,
                  boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                  {trust.score}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", marginTop: 2 }}>
                  / 100
                </div>
              </div>
            </div>
          </div>
          <svg width={0} height={0} style={{ display: "none" }}>
            <circle r={r} strokeDasharray={`${dash} ${circ}`} />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color,
              marginBottom: 4,
            }}
          >
            Ecosystem Trust Score · {tierLabel[trust.tier]}
          </div>
          <h2
            id="trust-heading"
            style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px", color: "#0f172a" }}
          >
            Your reputation across AEVION
          </h2>
          <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, margin: "0 0 12px" }}>
            {tierDescription[trust.tier]}
          </p>
          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
            <FactorGroup title="Banking" color="#0f766e" factors={bankingFactors} />
            <FactorGroup title="Ecosystem" color={color} factors={ecoFactors} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FactorGroup({
  title,
  color,
  factors,
}: {
  title: string;
  color: string;
  factors: Array<{ key: string; label: string; points: number; max: number; hint: string }>;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: "#94a3b8",
          marginBottom: 4,
          marginTop: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 8,
        }}
      >
        {factors.map((f) => {
          const pct = (f.points / f.max) * 100;
          return (
            <div key={f.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 11 }}>{f.label}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>
                  {f.points}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={f.points}
                aria-valuemin={0}
                aria-valuemax={f.max}
                aria-label={`${f.label}: ${f.points} out of ${f.max}`}
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: color,
                    transition: "width 400ms ease",
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{f.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
