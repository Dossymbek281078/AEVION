"use client";

import { useMemo, useState } from "react";

interface BiomarkerRecord {
  id: number;
  type: string;
  value: number;
  unit: string;
  notes: string | null;
  measured_at: string;
}

interface Props {
  biomarkers: BiomarkerRecord[];
  loading: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  blood_pressure: "Blood Pressure",
  weight_kg:      "Weight",
  sleep_hours:    "Sleep",
  vo2max:         "VO2 Max",
  hrv:            "HRV",
  glucose:        "Glucose",
  stress_level:   "Stress",
};

const TYPE_COLORS: Record<string, string> = {
  blood_pressure: "#f87171",
  weight_kg:      "#fbbf24",
  sleep_hours:    "#a78bfa",
  vo2max:         "#22d3ee",
  hrv:            "#34d399",
  glucose:        "#fb923c",
  stress_level:   "#f472b6",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  if (same) return `Today · ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `Yesterday · ${time}`;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" }) + ` · ${time}`;
}

export default function BiomarkerHistory({ biomarkers, loading }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const types = useMemo(() => {
    const set = new Set(biomarkers.map((b) => b.type));
    return Array.from(set);
  }, [biomarkers]);

  const filtered = useMemo(() => {
    if (filter === "all") return biomarkers;
    return biomarkers.filter((b) => b.type === filter);
  }, [biomarkers, filter]);

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <h3 style={styles.title}>Log History</h3>
        <span style={styles.subtitle}>{biomarkers.length} entries</span>
      </div>

      {types.length > 0 && (
        <div style={styles.filterRow}>
          <button
            type="button"
            onClick={() => setFilter("all")}
            style={{
              ...styles.filterChip,
              ...(filter === "all" ? styles.filterChipActive : {}),
            }}
          >
            All
          </button>
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              style={{
                ...styles.filterChip,
                ...(filter === t
                  ? { ...styles.filterChipActive, borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t] }
                  : {}),
              }}
            >
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p style={styles.dim}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>No entries yet.</p>
      ) : (
        <ul style={styles.list}>
          {filtered.slice(0, 50).map((b) => (
            <li key={b.id} style={styles.row}>
              <span
                style={{
                  ...styles.dot,
                  background: TYPE_COLORS[b.type] ?? "#94a3b8",
                }}
              />
              <div style={styles.rowMain}>
                <div style={styles.rowTop}>
                  <span style={styles.rowType}>{TYPE_LABELS[b.type] ?? b.type}</span>
                  <span style={styles.rowValue}>
                    {b.value} <span style={styles.rowUnit}>{b.unit}</span>
                  </span>
                </div>
                <div style={styles.rowBottom}>
                  <span style={styles.rowTime}>{fmtDate(b.measured_at)}</span>
                  {b.notes && <span style={styles.rowNote}>· {b.notes}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(16,185,129,0.15)",
    borderRadius: 16,
    padding: 20,
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  filterChip: {
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: 16,
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    cursor: "pointer",
  },
  filterChipActive: {
    background: "rgba(52,211,153,0.1)",
    borderColor: "#34d399",
    color: "#6ee7b7",
  },
  dim: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    padding: "20px 0",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    maxHeight: 420,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 4px",
    borderBottom: "1px solid rgba(30,41,59,0.4)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  rowType: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 600,
  },
  rowValue: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "monospace",
  },
  rowUnit: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
  },
  rowBottom: {
    display: "flex",
    gap: 4,
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowTime: {},
  rowNote: {
    color: "#94a3b8",
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
