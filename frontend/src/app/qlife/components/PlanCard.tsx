"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const ALL_GOALS = [
  { id: "sleep",     label: "Sleep",       icon: "Moon"  },
  { id: "cardio",    label: "Cardio",      icon: "Heart" },
  { id: "nutrition", label: "Nutrition",   icon: "Leaf"  },
  { id: "stress",    label: "Stress",      icon: "Brain" },
  { id: "brain",     label: "Brain",       icon: "Zap"   },
];

const GOAL_COLORS: Record<string, string> = {
  sleep:     "#818cf8",
  cardio:    "#f472b6",
  nutrition: "#34d399",
  stress:    "#fb923c",
  brain:     "#60a5fa",
};

interface PlanItem {
  goal: string;
  recommendation: string;
  frequency: string;
  expected_benefit: string;
}

export default function PlanCard() {
  const [age, setAge] = useState("");
  const [goals, setGoals] = useState<string[]>(["sleep", "cardio"]);
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");

  function toggleGoal(id: string) {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    setError(null);
    setPlan(null);
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
      setError("Enter your age (10–120)");
      return;
    }
    if (goals.length === 0) {
      setError("Select at least one goal");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("/api/qlife/plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: ageNum, goals }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) { setError(data.error || "Generation failed"); return; }
      setPlan(data.plan);
      setProvider(data.provider ?? "");
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>AI Longevity Plan</h3>
      <p style={styles.subtitle}>
        Get a personalized anti-aging protocol based on your age and goals.
      </p>

      <div style={styles.controls}>
        <div style={styles.ageRow}>
          <label style={styles.label}>Your age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="35"
            min={10}
            max={120}
            style={styles.ageInput}
          />
        </div>

        <div>
          <label style={styles.label}>Goals</label>
          <div style={styles.goalsGrid}>
            {ALL_GOALS.map((g) => {
              const active = goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  style={{
                    ...styles.goalBtn,
                    background: active ? `${GOAL_COLORS[g.id]}22` : "transparent",
                    border: `1px solid ${active ? GOAL_COLORS[g.id] : "#334155"}`,
                    color: active ? GOAL_COLORS[g.id] : "#94a3b8",
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          style={styles.generateBtn}
        >
          {loading ? "Generating plan..." : "Generate My Plan"}
        </button>
      </div>

      {plan && plan.length > 0 && (
        <div style={styles.planSection}>
          <div style={styles.planHeader}>
            <span style={styles.planHeaderText}>Your Longevity Plan</span>
            {provider && (
              <span style={styles.providerBadge}>via {provider}</span>
            )}
          </div>
          <div style={styles.planGrid}>
            {plan.map((item, i) => {
              const color = GOAL_COLORS[item.goal] ?? "#6ee7b7";
              return (
                <div key={i} style={{ ...styles.planItem, borderColor: `${color}40` }}>
                  <div style={{ ...styles.planGoalBadge, background: `${color}22`, color }}>
                    {item.goal}
                  </div>
                  <p style={styles.planRec}>{item.recommendation}</p>
                  <div style={styles.planMeta}>
                    <span style={styles.planFreq}>{item.frequency}</span>
                    <span style={styles.planBenefit}>{item.expected_benefit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
    margin: "0 0 6px 0",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    margin: "0 0 20px 0",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  ageRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
    display: "block",
  },
  ageInput: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    width: 100,
  },
  goalsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  goalBtn: {
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    transition: "all 0.15s",
  },
  generateBtn: {
    background: "linear-gradient(135deg, #10b981, #0d9488)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    padding: "12px 24px",
    alignSelf: "flex-start",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    margin: 0,
  },
  planSection: {
    marginTop: 24,
  },
  planHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  planHeaderText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 700,
  },
  providerBadge: {
    background: "#1e293b",
    borderRadius: 20,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
  },
  planItem: {
    background: "#0f172a",
    border: "1px solid",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  planGoalBadge: {
    borderRadius: 6,
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    textTransform: "capitalize",
    alignSelf: "flex-start",
  },
  planRec: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
  },
  planMeta: {
    borderTop: "1px solid #1e293b",
    paddingTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  planFreq: {
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  planBenefit: {
    color: "#64748b",
    fontSize: 12,
  },
};
