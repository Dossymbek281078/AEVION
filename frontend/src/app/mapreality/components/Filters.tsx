"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";
import type { Signal } from "./SignalCard";

export type FilterCategory = "all" | "need" | "event" | "request";

export type FilterState = {
  category: FilterCategory;
  country: string;
};

const CATEGORIES: Array<{ id: FilterCategory; color: string }> = [
  { id: "all", color: "rgba(148, 163, 184, 0.25)" },
  { id: "need", color: "#bae6fd" },
  { id: "event", color: "#fef08a" },
  { id: "request", color: "#bbf7d0" },
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
  const { t } = useI18n();

  function handleNearby() {
    if (!navigator.geolocation) {
      setGeoError(t("mapreality.geo.unsupported"));
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(
            apiUrl(`/api/mapreality/signals/nearby?lat=${latitude}&lng=${longitude}&radius=50&limit=20`),
            { cache: "no-store" },
          );
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const json = (await r.json()) as { success: boolean; data: { signals: Signal[] } };
          onNearby(json.data?.signals ?? []);
        } catch (e) {
          setGeoError(e instanceof Error ? e.message : t("mapreality.geo.loadErr"));
        } finally {
          setGeoLoading(false);
        }
      },
      (_err) => {
        setGeoLoading(false);
        setGeoError(t("mapreality.geo.denied"));
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
              {t("mapreality.cat." + c.id)}
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
          {geoLoading ? t("mapreality.geo.locating") : t("mapreality.geo.nearby")}
        </button>
        {geoError && (
          <span style={{ fontSize: 11, color: "#fca5a5" }}>{geoError}</span>
        )}

        <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{t("mapreality.country")}</label>
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
          <option value="">{t("mapreality.country.all")}</option>
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
