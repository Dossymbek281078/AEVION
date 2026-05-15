"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

type Phase = "A" | "B" | "C" | "D" | "E";

interface RoadmapItem {
  id: string;
  name: string;
  code: string;
  description: string;
  phase: Phase;
  targetWindow: string;
  targetSortKey: number;
  progress: number;
  remaining: string;
}

interface PhaseMeta {
  label: string;
  period: string;
  description: string;
  color: string;
}

interface RoadmapPayload {
  items: RoadmapItem[];
  total: number;
  phases: Record<Phase, PhaseMeta>;
  generatedAt: string;
}

export default function PricingRoadmapPage() {
  const tp = usePricingT();
  const [data, setData] = useState<RoadmapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<Phase | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/pricing/roadmap"))
      .then((r) => r.json())
      .then((j: RoadmapPayload) => setData(j))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    track({ type: "page_view", source: "pricing/roadmap" });
  }, []);

  const groups = useMemo(() => {
    if (!data) return [];
    const by: Record<Phase, RoadmapItem[]> = { A: [], B: [], C: [], D: [], E: [] };
    for (const it of data.items) by[it.phase].push(it);
    return (Object.keys(by) as Phase[]).map((k) => ({ phase: k, items: by[k] }));
  }, [data]);

  return (
    <ProductPageShell maxWidth={1100}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          PUBLIC ROADMAP · 27 MODULES
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          AEVION Roadmap
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#475569",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          Открытый план по всем 27 модулям. Сроки указаны при 1 разработчике + AI-ассистент;
          реальность даёт +25–40% запас на параллельные задачи.
        </p>
      </section>

      {error && (
        <div style={{ padding: 16, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {!data ? (
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>{tp("loading.pricing")}</div>
      ) : (
        <>
          {/* Phase filter */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, justifyContent: "center" }}>
            <button
              onClick={() => setFilterPhase(null)}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                cursor: "pointer",
                background: filterPhase === null ? "#0f172a" : "#fff",
                color: filterPhase === null ? "#fff" : "#475569",
              }}
            >
              Все ({data.items.length})
            </button>
            {(Object.keys(data.phases) as Phase[]).map((p) => {
              const count = data.items.filter((x) => x.phase === p).length;
              const meta = data.phases[p];
              const active = filterPhase === p;
              return (
                <button
                  key={p}
                  onClick={() => setFilterPhase(active ? null : p)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: `1px solid ${active ? meta.color : "rgba(15,23,42,0.12)"}`,
                    cursor: "pointer",
                    background: active ? meta.color : "#fff",
                    color: active ? "#fff" : "#475569",
                  }}
                >
                  Phase {p} ({count})
                </button>
              );
            })}
          </div>

          {/* Phase groups */}
          {groups
            .filter((g) => filterPhase === null || g.phase === filterPhase)
            .map((g) => {
              if (g.items.length === 0) return null;
              const meta = data.phases[g.phase];
              return (
                <section key={g.phase} style={{ marginBottom: 40 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 16,
                      paddingLeft: 12,
                      borderLeft: `4px solid ${meta.color}`,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>
                        {meta.label}
                      </h2>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginTop: 2 }}>
                        {meta.period} · {g.items.length}{" "}
                        {g.items.length === 1 ? "модуль" : "модулей"}
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{meta.description}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {g.items.map((it) => (
                      <div
                        key={it.id}
                        style={{
                          background: "#fff",
                          border: "1px solid rgba(15,23,42,0.08)",
                          borderRadius: 12,
                          padding: 16,
                          boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                              {it.name}
                            </div>
                            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>
                              {it.code}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: `${meta.color}1a`,
                              color: meta.color,
                              whiteSpace: "nowrap",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {it.targetWindow}
                          </span>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 10,
                              color: "#64748b",
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            <span>ПРОГРЕСС</span>
                            <span>{it.progress}%</span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: "#f1f5f9",
                              borderRadius: 3,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${it.progress}%`,
                                height: "100%",
                                background:
                                  it.progress >= 70
                                    ? "linear-gradient(90deg, #10b981, #34d399)"
                                    : it.progress >= 30
                                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                                      : "linear-gradient(90deg, #94a3b8, #cbd5e1)",
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                        </div>

                        {it.remaining && (
                          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                            <span style={{ color: "#475569", fontWeight: 700 }}>Осталось:</span> {it.remaining}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
        </>
      )}

      {/* CTA */}
      <section
        style={{
          marginTop: 40,
          padding: 24,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Хотите ускорить какой-то модуль?
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 16, fontSize: 14 }}>
          Enterprise-клиенты могут влиять на roadmap-приоритеты. Свяжитесь с продажами.
        </p>
        <Link
          href="/pricing/contact?tier=enterprise"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {tp("checkout.cancel.contact")}
        </Link>
      </section>
    </ProductPageShell>
  );
}
