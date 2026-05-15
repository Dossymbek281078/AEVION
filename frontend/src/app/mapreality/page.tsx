"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import MvpConceptBoard from "@/components/MvpConceptBoard";
import { SignalForm } from "./components/SignalForm";
import { SignalCard, type Signal } from "./components/SignalCard";
import { Filters, type FilterState } from "./components/Filters";
import { StatsBar } from "./components/StatsBar";

type SortBy = "support" | "recent";

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AEVION MapReality",
  applicationCategory: "MappingApplication",
  description:
    "Карта реальных потребностей — гражданские сигналы с гео-привязкой, поддержка сообщества (+1), агрегация по странам и категориям.",
  url: "https://aevion.app/mapreality",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const ALIAS_STORAGE_KEY = "aevion.mapreality.alias";

export default function MapRealityPage() {
  const [alias, setAlias] = useState("");
  const [filters, setFilters] = useState<FilterState>({ category: "all", country: "" });
  const [sortBy, setSortBy] = useState<SortBy>("support");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nearbySignals, setNearbySignals] = useState<Signal[] | null>(null);

  // Restore alias from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(ALIAS_STORAGE_KEY);
    if (saved) setAlias(saved);
  }, []);

  // Persist alias
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (alias) window.localStorage.setItem(ALIAS_STORAGE_KEY, alias);
  }, [alias]);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category !== "all") params.set("category", filters.category);
      if (filters.country) params.set("country", filters.country);
      params.set("limit", "50");
      const r = await fetch(`/api/mapreality/signals?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { signals: Signal[]; total: number };
      setSignals(data.signals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.country]);

  useEffect(() => {
    void fetchSignals();
  }, [fetchSignals, refreshKey]);

  const sortedSignals = useMemo(() => {
    const arr = signals.slice();
    if (sortBy === "support") {
      arr.sort((a, b) => {
        if (b.support_count !== a.support_count) return b.support_count - a.support_count;
        return b.created_at.localeCompare(a.created_at);
      });
    } else {
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return arr;
  }, [signals, sortBy]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const s of signals) set.add(s.country);
    return Array.from(set).sort();
  }, [signals]);

  const handleSupported = useCallback((updated: Signal) => {
    setSignals((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const handleSubmitted = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #020617 0%, #0f172a 30%, #020617 100%)",
        color: "#e2e8f0",
        padding: "20px 18px 60px",
      }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <Link href="/" style={{ color: "#7dd3fc", textDecoration: "none", fontSize: 14 }}>
            ← AEVION ·{" "}
            <span style={{ fontWeight: 700 }}>MapReality</span>{" "}
            <span
              style={{
                background: "rgba(186, 230, 253, 0.15)",
                color: "#bae6fd",
                padding: "1px 7px",
                borderRadius: 4,
                fontSize: 10,
                marginLeft: 4,
                border: "1px solid rgba(186, 230, 253, 0.3)",
              }}
            >
              MVP
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Your alias</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value.slice(0, 64))}
              placeholder="pick a pseudonym"
              style={{
                padding: "5px 9px",
                fontSize: 13,
                background: "rgba(15, 23, 42, 0.85)",
                color: "#e2e8f0",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: 8,
                minWidth: 140,
              }}
            />
          </div>
        </header>

        <section style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: -0.5,
            }}
          >
            Map of real{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #7dd3fc, #86efac, #fde047)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              needs & signals
            </span>
            .
          </h1>
          <p style={{ maxWidth: 640, margin: "10px auto 0", color: "#cbd5e1", fontSize: 15, lineHeight: 1.55 }}>
            Citizens publish signals (need / event / request) tied to a country and city. Others support what matters
            with +1. Pick an alias, publish, support.
          </p>
        </section>

        <StatsBar refreshKey={refreshKey} />

        <SignalForm authorAlias={alias} onSubmitted={handleSubmitted} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Filters value={filters} onChange={setFilters} countries={countries} onNearby={setNearbySignals} />

          {nearbySignals !== null && (
            <div
              style={{
                background: "rgba(125, 211, 252, 0.06)",
                border: "1px solid rgba(125, 211, 252, 0.25)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#7dd3fc" }}>
                  Сигналы рядом (50 км) — {nearbySignals.length}
                </span>
                <button
                  type="button"
                  onClick={() => setNearbySignals(null)}
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                  }}
                >
                  скрыть
                </button>
              </div>
              {nearbySignals.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
                  Нет активных сигналов в радиусе 50 км от вас.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 10,
                  }}
                >
                  {nearbySignals.map((s) => (
                    <SignalCard
                      key={s.id}
                      signal={s}
                      supporterAlias={alias}
                      onSupported={(updated) =>
                        setNearbySignals((prev) =>
                          prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              padding: "0 4px",
            }}
          >
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              {loading
                ? "Loading…"
                : error
                ? <span style={{ color: "#fca5a5" }}>Error: {error}</span>
                : `${sortedSignals.length} signal${sortedSignals.length === 1 ? "" : "s"}`}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { id: "support", label: "Top supported" },
                { id: "recent", label: "Most recent" },
              ] as Array<{ id: SortBy; label: string }>).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: sortBy === opt.id ? "rgba(186, 230, 253, 0.6)" : "rgba(148, 163, 184, 0.25)",
                    background: sortBy === opt.id ? "rgba(186, 230, 253, 0.15)" : "transparent",
                    color: sortBy === opt.id ? "#bae6fd" : "#94a3b8",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            {sortedSignals.length === 0 && !loading && !error && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "32px 16px",
                  background: "rgba(15, 23, 42, 0.4)",
                  borderRadius: 12,
                  color: "#94a3b8",
                  fontSize: 14,
                }}
              >
                No signals yet — be the first to publish one above.
              </div>
            )}
            {sortedSignals.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                supporterAlias={alias}
                onSupported={handleSupported}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <MvpConceptBoard
            moduleId="mapreality"
            noun="concept/messages"
            accent="emerald"
            sectionTitle="Map concept board"
            sectionHint="Какие слои реальности должны быть на карте? Какие сигналы важны для AR-навигации?"
            titleField="idea"
            summaryField="rationale"
            fields={[
              { key: "idea", label: "Идея / слой", placeholder: "напр.: тепловые карты безопасности районов", required: true },
              { key: "rationale", label: "Зачем нужен этот слой", type: "textarea", placeholder: "Какую проблему решает, как верифицировать" },
              { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
            ]}
          />
        </div>

        <footer
          style={{
            marginTop: 16,
            paddingTop: 18,
            borderTop: "1px solid rgba(148, 163, 184, 0.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <span>API: <code style={{ background: "rgba(148,163,184,0.1)", padding: "1px 6px", borderRadius: 4 }}>/api/mapreality/*</code></span>
          <Link href="/" style={{ color: "#7dd3fc", textDecoration: "none" }}>← All AEVION modules</Link>
        </footer>
      </div>
    </main>
  );
}
