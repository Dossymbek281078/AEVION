"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

const BIOMARKER_TYPES = [
  { value: "blood_pressure", label: "Blood Pressure", unit: "mmHg", placeholder: "120/80" },
  { value: "weight_kg",      label: "Weight",         unit: "kg",   placeholder: "75" },
  { value: "sleep_hours",    label: "Sleep",          unit: "hrs",  placeholder: "7.5" },
  { value: "vo2max",         label: "VO2 Max",        unit: "ml/kg/min", placeholder: "45" },
  { value: "hrv",            label: "HRV",            unit: "ms",   placeholder: "55" },
  { value: "glucose",        label: "Glucose",        unit: "mg/dL",placeholder: "95" },
  { value: "stress_level",   label: "Stress Level",   unit: "1-10", placeholder: "4" },
];

interface Props {
  onLogged: () => void;
}

export default function BiomarkerForm({ onLogged }: Props) {
  const [type, setType] = useState(BIOMARKER_TYPES[0].value);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selected = BIOMARKER_TYPES.find((t) => t.value === type) ?? BIOMARKER_TYPES[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!value.trim()) { setError("Enter a value"); return; }
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("/api/qlife/biomarkers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          value: parseFloat(value),
          unit: selected.unit,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) { setError(data.error || "Failed to log"); return; }
      setValue("");
      setNotes("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onLogged();
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>Quick Log</h3>

      <div style={styles.row}>
        <label style={styles.label}>Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={styles.select}
        >
          {BIOMARKER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Value ({selected.unit})</label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={selected.placeholder}
          style={styles.input}
        />
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="After workout, morning..."
          style={styles.input}
        />
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.successMsg}>Logged!</p>}

      <button type="submit" disabled={loading} style={styles.btn}>
        {loading ? "Saving..." : "+ Log Biomarker"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    background: "rgba(16,185,129,0.05)",
    border: "1px solid rgba(16,185,129,0.25)",
    borderRadius: 16,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: {
    color: "#6ee7b7",
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    marginBottom: 4,
  },
  row: {
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
  },
  select: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
  },
  input: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
  },
  btn: {
    background: "linear-gradient(135deg, #10b981, #0d9488)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    padding: "10px 20px",
    marginTop: 4,
    alignSelf: "flex-start",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    margin: 0,
  },
  successMsg: {
    color: "#34d399",
    fontSize: 13,
    margin: 0,
    fontWeight: 700,
  },
};
