"use client";

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

const TYPE_ICONS: Record<string, string> = {
  blood_pressure: "heart",
  weight_kg:      "scale",
  sleep_hours:    "moon",
  vo2max:         "lungs",
  hrv:            "wave",
  glucose:        "drop",
  stress_level:   "bolt",
};

function getTrend(records: BiomarkerRecord[]): "up" | "down" | "flat" | null {
  if (records.length < 2) return null;
  const latest = records[0].value;
  const prev   = records[1].value;
  if (latest > prev * 1.01) return "up";
  if (latest < prev * 0.99) return "down";
  return "flat";
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (!trend) return null;
  const map = { up: { arrow: "↑", color: "#34d399" }, down: { arrow: "↓", color: "#f87171" }, flat: { arrow: "→", color: "#94a3b8" } };
  const { arrow, color } = map[trend];
  return <span style={{ color, fontWeight: 700, fontSize: 16 }}>{arrow}</span>;
}

export default function TrendCard({ biomarkers, loading }: Props) {
  if (loading) {
    return (
      <div style={styles.card}>
        <h3 style={styles.title}>Recent Trends</h3>
        <p style={styles.dimText}>Loading...</p>
      </div>
    );
  }

  if (biomarkers.length === 0) {
    return (
      <div style={styles.card}>
        <h3 style={styles.title}>Recent Trends</h3>
        <p style={styles.dimText}>No data yet. Log your first biomarker.</p>
      </div>
    );
  }

  // Group by type, keep last 7 per type for trend calc
  const byType: Record<string, BiomarkerRecord[]> = {};
  for (const r of biomarkers) {
    if (!byType[r.type]) byType[r.type] = [];
    if (byType[r.type].length < 7) byType[r.type].push(r);
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Recent Trends</h3>
      <div style={styles.grid}>
        {Object.entries(byType).map(([type, records]) => {
          const latest = records[0];
          const trend  = getTrend(records);
          return (
            <div key={type} style={styles.typeCard}>
              <div style={styles.typeHeader}>
                <span style={styles.typeLabel}>{TYPE_LABELS[type] ?? type}</span>
                <TrendArrow trend={trend} />
              </div>
              <div style={styles.typeValue}>
                {latest.value}
                <span style={styles.typeUnit}> {latest.unit}</span>
              </div>
              <div style={styles.typeTime}>
                {new Date(latest.measured_at).toLocaleDateString("en", { month: "short", day: "numeric" })}
                {records.length > 1 && (
                  <span style={styles.countBadge}> {records.length} logs</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h4 style={styles.recentTitle}>Last 7 entries</h4>
      <div style={styles.logList}>
        {biomarkers.slice(0, 7).map((r) => (
          <div key={r.id} style={styles.logItem}>
            <span style={styles.logType}>{TYPE_LABELS[r.type] ?? r.type}</span>
            <span style={styles.logVal}>{r.value} {r.unit}</span>
            <span style={styles.logDate}>
              {new Date(r.measured_at).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(15,23,42,0.6)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: "20px 24px",
  },
  title: {
    color: "#6ee7b7",
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  dimText: {
    color: "#64748b",
    fontSize: 14,
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 20,
  },
  typeCard: {
    background: "rgba(16,185,129,0.06)",
    border: "1px solid rgba(16,185,129,0.15)",
    borderRadius: 10,
    padding: "10px 14px",
  },
  typeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  typeValue: {
    color: "#e2e8f0",
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  typeUnit: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 400,
  },
  typeTime: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
  },
  countBadge: {
    color: "#6ee7b7",
    fontWeight: 600,
  },
  recentTitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "0 0 10px 0",
  },
  logList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  logItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    background: "#0f172a",
    borderRadius: 8,
  },
  logType: {
    color: "#94a3b8",
    fontSize: 12,
    flex: "0 0 120px",
    fontWeight: 500,
  },
  logVal: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 700,
    flex: 1,
  },
  logDate: {
    color: "#475569",
    fontSize: 11,
    textAlign: "right" as const,
  },
};
