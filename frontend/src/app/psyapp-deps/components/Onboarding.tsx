"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type Addiction = "alcohol" | "smoking" | "other";

interface Props {
  onStarted: (alias: string) => void;
}

const OPTIONS: { value: Addiction; label: string; emoji: string; hint: string }[] = [
  { value: "alcohol", label: "Алкоголь", emoji: "🍷", hint: "Полный отказ или сокращение" },
  { value: "smoking", label: "Курение", emoji: "🚬", hint: "Сигареты, вейп, никотин" },
  { value: "other",   label: "Другое",   emoji: "✨", hint: "Сахар, азартные игры, экраны" },
];

function suggestAlias(): string {
  const a = "abcdefghjkmnpqrstuvwxyz";
  const r = () => a[Math.floor(Math.random() * a.length)];
  const n = () => Math.floor(Math.random() * 9) + 1;
  return `user-${r()}${r()}${n()}${n()}`;
}

export default function Onboarding({ onStarted }: Props) {
  const [alias, setAlias] = useState<string>(suggestAlias());
  const [addiction, setAddiction] = useState<Addiction>("alcohol");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!/^[a-z0-9_-]{2,40}$/i.test(alias)) {
      setError("Псевдоним 2–40 символов: латиница, цифры, _ или -");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/psyapp-deps/users/${encodeURIComponent(alias)}/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addiction }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || "Не получилось начать. Попробуй ещё раз.");
        setLoading(false);
        return;
      }
      try {
        localStorage.setItem("psyapp-deps-alias", alias);
      } catch {
        // ignore quota errors
      }
      onStarted(alias);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Сеть недоступна";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Начнём путь</h2>
      <p style={styles.subtitle}>
        Без имени, без email. Только псевдоним — чтобы сохранять прогресс на этом устройстве.
      </p>

      <div style={styles.field}>
        <label style={styles.label}>Псевдоним</label>
        <div style={styles.row}>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value.toLowerCase())}
            placeholder="user-ab12"
            style={styles.input}
            maxLength={40}
          />
          <button
            type="button"
            onClick={() => setAlias(suggestAlias())}
            style={styles.diceBtn}
            title="Сгенерировать новый"
          >
            🎲
          </button>
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>От чего хочешь освободиться?</label>
        <div style={styles.optionGrid}>
          {OPTIONS.map((o) => {
            const active = addiction === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setAddiction(o.value)}
                style={{
                  ...styles.option,
                  borderColor: active ? "#3f6f4f" : "#3a342c",
                  background: active ? "#2a3a2e" : "#1f1a14",
                  boxShadow: active ? "0 0 0 1px #3f6f4f inset" : "none",
                }}
              >
                <span style={styles.optionEmoji}>{o.emoji}</span>
                <span style={styles.optionLabel}>{o.label}</span>
                <span style={styles.optionHint}>{o.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        style={{
          ...styles.cta,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Запускаем…" : "Начать путь"}
      </button>
      <p style={styles.note}>
        Данные хранятся на сервере под этим псевдонимом. Это поддержка, не медицинский совет.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#1a1510",
    border: "1px solid #3a342c",
    borderRadius: 16,
    padding: 24,
    maxWidth: 520,
    margin: "0 auto",
  },
  title: { margin: "0 0 8px 0", color: "#f5ebd7", fontSize: 22, fontWeight: 700 },
  subtitle: { margin: "0 0 20px 0", color: "#b8a98c", fontSize: 14, lineHeight: 1.5 },
  field: { marginBottom: 18 },
  label: {
    display: "block",
    color: "#d6c7a8",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    background: "#0f0c08",
    border: "1px solid #3a342c",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#f5ebd7",
    fontSize: 14,
    outline: "none",
  },
  diceBtn: {
    background: "#2a241c",
    border: "1px solid #3a342c",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 16,
    color: "#f5ebd7",
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
  },
  option: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: "12px 14px",
    border: "1px solid #3a342c",
    borderRadius: 10,
    background: "#1f1a14",
    cursor: "pointer",
    color: "#f5ebd7",
    textAlign: "left",
  },
  optionEmoji: { fontSize: 22 },
  optionLabel: { fontSize: 14, fontWeight: 600 },
  optionHint: { fontSize: 11, color: "#9b8b6e" },
  error: {
    background: "#3a1f1f",
    color: "#f5b5b5",
    border: "1px solid #5a2f2f",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    marginBottom: 12,
  },
  cta: {
    width: "100%",
    background: "#3f6f4f",
    color: "#f5ebd7",
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  note: {
    margin: "12px 0 0 0",
    color: "#8a7c5e",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 1.5,
  },
};
