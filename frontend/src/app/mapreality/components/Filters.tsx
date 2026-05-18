"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import type { Signal } from "./SignalCard";

export type FilterCategory = "all" | "need" | "event" | "request";

export type FilterState = {
  category: FilterCategory;
  country: string;
};

const CATEGORIES: Array<{ id: FilterCategory; label: string; color: string }> = [
  { id: "all", label: "All", color: "rgba(148, 163, 184, 0.25)" },
  { id: "need", label: "Need", color: "#bae6fd" },
  { id: "event", label: "Event", color: "#fef08a" },
  { id: "request", label: "Request", color: "#bbf7d0" },
];

export function Filters({
  value,
  onChange,
  countries,
  onNearby,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  countries: string[];
  onNearby: (signals: Signal[]) => void;
}) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function handleNearby() {
    if (!navigator.geolocation) {
      setGeoError("Геолокация не поддерживается браузером");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(
            `/api/mapreality/signals/nearby?lat=${latitude}&lng=${longitude}&radius=50&limit=20`,
            { cache: "no-store" },
          );
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const json = (await r.json()) as { success: boolean; data: { signals: Signal[] } };
          onNearby(json.data?.signals ?? []);
        } catch (e) {
          setGeoError(e instanceof Error ? e.message : "Ошибка загрузки");
        } finally {
          setGeoLoading(false);
        }
      },
      (_err) => {
        setGeoLoading(false);
        setGeoError("Доступ к геолокации отклонён");
      },
      { timeout: 10_000 },
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "rgba(15, 23, 42, 0.55)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        borderRadius: 14,
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => {
          const active = value.category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange({ ...value, category: c.id })}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: "1px solid",
                borderColor: active ? c.color : "rgba(148, 163, 184, 0.25)",
                background: active ? c.color : "transparent",
                color: active ? "#0f172a" : "#cbd5e1",
                cursor: "pointer",
                transition: "background 120ms, color 120ms",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleNearby}
          disabled={geoLoading}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 999,
            border: "1px solid rgba(125, 211, 252, 0.4)",
            background: geoLoading ? "rgba(125, 211, 252, 0.08)" : "rgba(125, 211, 252, 0.15)",
            color: "#7dd3fc",
            cursor: geoLoading ? "not-allowed" : "pointer",
            opacity: geoLoading ? 0.65 : 1,
            transition: "background 120ms, opacity 120ms",
          }}
        >
          {geoLoading ? "Определяем..." : "Рядом со мной"}
        </button>
        {geoError && (
          <span style={{ fontSize: 11, color: "#fca5a5" }}>{geoError}</span>
        )}

        <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Country</label>
        <select
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
          style={{
            padding: "5px 8px",
            fontSize: 13,
            background: "rgba(15, 23, 42, 0.85)",
            color: "#e2e8f0",
            border: "1px solid rgba(148, 163, 184, 0.3)",
            borderRadius: 8,
            cursor: "pointer",
            minWidth: 110,
          }}
        >
          <option value="">All</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
