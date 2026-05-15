"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type TriggerType = "craving" | "stress" | "social" | "emotion";

interface TriggerRecord {
  id: number;
  alias: string;
  trigger_type: TriggerType;
  intensity: number;
  note: string | null;
  coped_how: string | null;
  logged_at: string;
}

interface Props {
  alias: string;
}

const TRIGGER_OPTIONS: { value: TriggerType; label: string; emoji: string }[] = [
  { value: "craving", label: "Тяга", emoji: "🔥" },
  { value: "stress", label: "Стресс", emoji: "⚡" },
  { value: "social", label: "Соц. ситуация", emoji: "👥" },
  { value: "emotion", label: "Эмоция", emoji: "🌊" },
];

export default function TriggerLog({ alias }: Props) {
  const [triggerType, setTriggerType] = useState<TriggerType>("craving");
  const [intensity, setIntensity] = useState<number>(5);
  const [note, setNote] = useState("");
  const [copedHow, setCopedHow] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [triggers, setTriggers] = useState<TriggerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTriggers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        apiUrl(`/api/psyapp-deps/triggers/${encodeURIComponent(alias)}?limit=10`),
        { cache: "no-store" },
      );
      const d = await r.json();
      if (d.ok) setTriggers(d.triggers ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [alias]);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/psyapp-deps/triggers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias,
          trigger_type: triggerType,
          intensity_1_10: intensity,
          note: note.trim() || undefined,
          copedHow: copedHow.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || "Не получилось записать");
        return;
      }
      setNote("");
      setCopedHow("");
      setIntensity(5);
      setTriggerType("craving");
      loadTriggers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сеть недоступна");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Журнал триггеров</h2>
      <p style={styles.hint}>
        Записывай моменты, когда сильно тянет. Это снижает власть триггера над тобой.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.row}>
          {TRIGGER_OPTIONS.map((o) => {
            const active = triggerType === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setTriggerType(o.value)}
                style={{
                  ...styles.chip,
                  background: active ? "#3f6f4f" : "#1f1a14",
                  borderColor: active ? "#5b9d70" : "#3a342c",
                  color: active ? "#f5ebd7" : "#d6c7a8",
                }}
              >
                <span>{o.emoji}</span>
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.field}>
          <div style={styles.intensityRow}>
            <label style={styles.label}>Интенсивность</label>
            <span style={styles.intensityValue}>{intensity} / 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            style={styles.slider}
          />
          <div style={styles.intensityScale}>
            <span>лёгкая</span>
            <span>средняя</span>
            <span>невыносимая</span>
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Что произошло? (опц.)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Контекст, мысли, ощущения…"
            style={styles.textarea}
            rows={2}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Как справился? (опц.)</label>
          <textarea
            value={copedHow}
            onChange={(e) => setCopedHow(e.target.value.slice(0, 500))}
            placeholder="Дыхание, прогулка, позвонил другу…"
            style={styles.textarea}
            rows={2}
          />
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <button type="submit" disabled={submitting} style={styles.submit}>
          {submitting ? "Сохраняю…" : "Записать триггер"}
        </button>
      </form>

      <div style={styles.divider} />

      <h3 style={styles.subtitle}>Последние 10 записей</h3>
      {loading ? (
        <p style={styles.empty}>Загружаю…</p>
      ) : triggers.length === 0 ? (
        <p style={styles.empty}>Пока пусто. Первая запись — самая важная.</p>
      ) : (
        <ul style={styles.list}>
          {triggers.map((t) => {
            const opt = TRIGGER_OPTIONS.find((o) => o.value === t.trigger_type);
            return (
              <li key={t.id} style={styles.item}>
                <div style={styles.itemHeader}>
                  <span style={styles.itemType}>
                    {opt?.emoji} {opt?.label}
                  </span>
                  <span style={styles.itemIntensity}>{t.intensity}/10</span>
                  <span style={styles.itemDate}>
                    {new Date(t.logged_at).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {t.note ? <div style={styles.itemNote}>{t.note}</div> : null}
                {t.coped_how ? (
                  <div style={styles.itemCoped}>↳ {t.coped_how}</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#1a1510",
    border: "1px solid #3a342c",
    borderRadius: 16,
    padding: 24,
  },
  title: { margin: "0 0 6px 0", color: "#f5ebd7", fontSize: 18, fontWeight: 700 },
  hint: { margin: "0 0 16px 0", color: "#b8a98c", fontSize: 13, lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  row: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    border: "1px solid",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    color: "#d6c7a8",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  intensityRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  intensityValue: {
    color: "#9bd4a8",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  },
  slider: { width: "100%", accentColor: "#3f6f4f" },
  intensityScale: {
    display: "flex",
    justifyContent: "space-between",
    color: "#7d6f54",
    fontSize: 10,
  },
  textarea: {
    background: "#0f0c08",
    border: "1px solid #3a342c",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#f5ebd7",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
  },
  error: {
    background: "#3a1f1f",
    color: "#f5b5b5",
    border: "1px solid #5a2f2f",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
  },
  submit: {
    background: "#3f6f4f",
    color: "#f5ebd7",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  divider: { borderTop: "1px solid #2a241c", margin: "20px 0 16px 0" },
  subtitle: { margin: "0 0 12px 0", color: "#d6c7a8", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" },
  empty: { color: "#7d6f54", fontSize: 13, fontStyle: "italic", margin: 0 },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  item: {
    background: "#0f0c08",
    border: "1px solid #2a241c",
    borderRadius: 8,
    padding: "10px 12px",
  },
  itemHeader: { display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" },
  itemType: { color: "#f5ebd7", fontSize: 13, fontWeight: 600 },
  itemIntensity: {
    color: "#9bd4a8",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  },
  itemDate: { color: "#7d6f54", fontSize: 11, marginLeft: "auto" },
  itemNote: { color: "#d6c7a8", fontSize: 13, marginTop: 6, lineHeight: 1.5 },
  itemCoped: { color: "#9bd4a8", fontSize: 12, marginTop: 4, lineHeight: 1.5 },
};
