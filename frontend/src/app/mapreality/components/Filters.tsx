"use client";

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
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  countries: string[];
}) {
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
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
