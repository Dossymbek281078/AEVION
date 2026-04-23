"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { computeWealthForecast, SCENARIOS, type ScenarioKey } from "../_lib/forecast";
import { SOURCE_COLOR, SOURCE_LABEL } from "../_lib/ecosystem";
import { loadGoals, type SavingsGoal } from "../_lib/savings";
import type { Account } from "../_lib/types";
import { Money } from "./Money";
import { SkeletonBlock } from "./Skeleton";

type Horizon = "d30" | "d90" | "d365";
const HORIZON_LABEL: Record<Horizon, string> = { d30: "30 days", d90: "3 months", d365: "1 year" };

export function WealthForecast({ account }: { account: Account }) {
  const { ecosystem } = useEcosystemData();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [scenario, setScenario] = useState<ScenarioKey>("realistic");
  const [horizon, setHorizon] = useState<Horizon>("d90");
  const { code } = useCurrency();

  useEffect(() => {
    setGoals(loadGoals());
  }, []);

  const forecast = useMemo(
    () => computeWealthForecast({ currentBalance: account.balance, ecosystem, goals }),
    [account.balance, ecosystem, goals],
  );

  if (!ecosystem) {
    return (
      <section
        style={{
          border: "1px solid rgba(14,165,233,0.2)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(14,165,233,0.04) 0%, #ffffff 100%)",
        }}
      >
        <SkeletonBlock label="Computing wealth forecast" minHeight={240} />
      </section>
    );
  }

  const activeScenario = SCENARIOS.find((s) => s.key === scenario) ?? SCENARIOS[1];
  const horizonValue = forecast.projectedBalanceBy[scenario][horizon];
  const gain = horizonValue - account.balance;
  const trendColor = forecast.trendPct > 2 ? "#059669" : forecast.trendPct < -2 ? "#dc2626" : "#64748b";

  return (
    <section
      style={{
        border: "1px solid rgba(14,165,233,0.25)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, rgba(14,165,233,0.05) 0%, #ffffff 100%)",
      }}
      aria-labelledby="wealth-forecast-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ↗
          </span>
          <div>
            <h2
              id="wealth-forecast-heading"
              style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0369a1" }}
            >
              Wealth forecast
            </h2>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
              Forward-looking view based on your 30-day earning pace across all AEVION modules.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <StatTile
          label="Earning pace"
          value={<Money aec={forecast.monthlyRate} decimals={0} />}
          hint={`per month · ${forecast.dailyRate.toFixed(2)} AEC/day`}
          accent="#0369a1"
        />
        <StatTile
          label="7d trend"
          value={`${forecast.trendPct >= 0 ? "+" : ""}${forecast.trendPct.toFixed(0)}%`}
          hint="vs 30d average"
          accent={trendColor}
        />
        <StatTile
          label="1-year run rate"
          value={<Money aec={forecast.yearlyRate} decimals={0} compact />}
          hint="if pace holds"
          accent="#0d9488"
        />
        <StatTile
          label="Active goals"
          value={String(forecast.goalETAs.length)}
          hint={forecast.goalETAs.length ? "projected below" : "create one to track ETA"}
          accent="#7c3aed"
        />
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: `1px solid ${activeScenario.color}33`,
          background: `linear-gradient(135deg, ${activeScenario.color}0c, transparent)`,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", gap: 4 }} role="group" aria-label="Scenario">
            {SCENARIOS.map((s) => {
              const active = s.key === scenario;
              return (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key)}
                  aria-pressed={active}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: active ? `1px solid ${s.color}` : "1px solid rgba(15,23,42,0.12)",
                    background: active ? s.color : "#fff",
                    color: active ? "#fff" : "#334155",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 4 }} role="group" aria-label="Horizon">
            {(Object.keys(HORIZON_LABEL) as Horizon[]).map((h) => {
              const active = h === horizon;
              return (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  aria-pressed={active}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: active ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.12)",
                    background: active ? "#0f172a" : "#fff",
                    color: active ? "#fff" : "#334155",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {HORIZON_LABEL[h]}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "#64748b",
              }}
            >
              Projected balance in {HORIZON_LABEL[horizon]}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: activeScenario.color,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              {formatCurrency(horizonValue, code, { decimals: 0 })}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {gain >= 0 ? "+" : ""}
              {formatCurrency(gain, code, { decimals: 0 })} vs today · {activeScenario.description}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            {(["d30", "d90", "d365"] as const).map((h) => {
              const v = forecast.projectedBalanceBy[scenario][h];
              const active = h === horizon;
              return (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  aria-pressed={active}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 10,
                    border: active ? `1px solid ${activeScenario.color}` : "1px solid rgba(15,23,42,0.08)",
                    background: active ? `${activeScenario.color}14` : "#fff",
                    cursor: "pointer",
                    textAlign: "center" as const,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>
                    {HORIZON_LABEL[h]}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: activeScenario.color,
                      marginTop: 2,
                    }}
                  >
                    {formatCurrency(v, code, { decimals: 0, compact: true })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Goal ETAs ({forecast.goalETAs.length})
          </div>
          {forecast.goalETAs.length === 0 ? (
            <div
              style={{
                padding: 14,
                fontSize: 12,
                color: "#94a3b8",
                border: "1px dashed rgba(15,23,42,0.1)",
                borderRadius: 10,
              }}
            >
              Create a savings goal below and we'll show when you'll hit it at current pace.
            </div>
          ) : (
            <ul
              role="list"
              style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}
            >
              {forecast.goalETAs.slice(0, 4).map((g) => (
                <li
                  key={g.goalId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#fff",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0f172a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {g.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                      <Money aec={g.remaining} decimals={0} /> remaining
                      {g.daysToComplete != null && g.etaISO
                        ? ` · by ${new Date(g.etaISO).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year:
                              new Date(g.etaISO).getFullYear() !== new Date().getFullYear()
                                ? "numeric"
                                : undefined,
                          })}`
                        : " · need positive inflow to forecast"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: g.daysToComplete != null ? "#0369a1" : "#94a3b8",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {g.daysToComplete != null ? `${g.daysToComplete}d` : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Pace breakdown · last 30d
          </div>
          {forecast.topSourceShare.length === 0 || forecast.topSourceShare[0].amount === 0 ? (
            <div
              style={{
                padding: 14,
                fontSize: 12,
                color: "#94a3b8",
                border: "1px dashed rgba(15,23,42,0.1)",
                borderRadius: 10,
              }}
            >
              No ecosystem inflow yet. Register work in QRight or play a tournament to start.
            </div>
          ) : (
            <ul
              role="list"
              style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}
            >
              {forecast.topSourceShare.map((row) => {
                const color = SOURCE_COLOR[row.source];
                return (
                  <li key={row.source}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontWeight: 700, color: "#0f172a" }}>
                        {SOURCE_LABEL[row.source]}
                      </span>
                      <span style={{ fontWeight: 800, color: "#0f172a" }}>
                        <Money aec={row.amount} decimals={0} />
                      </span>
                      <span style={{ color: "#94a3b8", fontWeight: 700, minWidth: 36, textAlign: "right" as const }}>
                        {(row.share * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(row.share * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${SOURCE_LABEL[row.source]} share`}
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${row.share * 100}%`,
                          height: "100%",
                          background: color,
                          transition: "width 400ms ease",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        Projections extrapolate your 30-day pace. Goal ETAs assume you'll set aside ~50 % of net
        inflow. Not investment advice.
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: accent,
          letterSpacing: "-0.02em",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{hint}</div>
    </div>
  );
}
