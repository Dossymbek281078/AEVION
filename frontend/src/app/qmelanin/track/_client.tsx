"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import ModulePricingChip from "@/components/ModulePricingChip";

// QMelanin · Track — фотофиксация + недельные чек-ины. Клиент держит записи
// у себя (localStorage/в стейте), backend /track считает тренд stateless.
// Число седых в фиксированной зоне (напр. висок 2×2 см) — самый дешёвый
// самозамер; честно предупреждаем про чувствительность к свету/ракурсу.

interface Entry { date: string; grayCountZone: string; subjectiveScore: string; }

interface TrackResult {
  points: number;
  firstCount: number;
  lastCount: number;
  delta: number;
  direction: "improving" | "worsening" | "stable";
  weeksTracked: number | null;
  interpretation: string;
  disclaimer: string;
}

const LS_KEY = "qmelanin_track_entries";

function loadEntries(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

export default function QMelaninTrackClient() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function persist(next: Entry[]) {
    setEntries(next);
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* private mode — тренд всё равно считается на сервере из текущего стейта */
    }
  }

  function addEntry() {
    persist([...entries, { date: "", grayCountZone: "", subjectiveScore: "" }]);
  }

  function updateEntry(i: number, field: keyof Entry, v: string) {
    persist(entries.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)));
  }

  function removeEntry(i: number) {
    persist(entries.filter((_, idx) => idx !== i));
  }

  async function computeTrend() {
    setLoading(true);
    setError(null);
    try {
      const payload = entries
        .filter((e) => e.date && e.grayCountZone)
        .map((e) => ({
          date: e.date,
          grayCountZone: parseFloat(e.grayCountZone),
          subjectiveScore: e.subjectiveScore ? parseFloat(e.subjectiveScore) : undefined,
        }));
      const res = await fetch(apiUrl("/api/qmelanin/track"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: payload }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.hint || `Сервер вернул ${res.status}`);
      }
      setResult((await res.json()) as TrackResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось посчитать тренд");
    } finally {
      setLoading(false);
    }
  }

  const dirColor =
    result?.direction === "improving" ? "#5fbf7f" : result?.direction === "worsening" ? "#e0a878" : "#c8823f";

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · QMelanin · Track</div>
        <h1 style={styles.h1}>Дневник седины</h1>
        <p style={styles.lede}>
          Раз в неделю сфотографируйте одну и ту же зону (например висок, участок 2×2 см) при одинаковом
          свете и посчитайте седые волосы в ней. Записи хранятся у вас в браузере; сервер считает только
          тренд. Это чувствительный к ракурсу самозамер — смотрите на динамику за месяцы, не на одну точку.
        </p>
        <div style={{ marginTop: 14 }}>
          <ModulePricingChip moduleId="qmelanin" theme="dark" />
        </div>

        <section style={styles.card}>
          <h2 style={styles.h2}>Недельные чек-ины</h2>
          {entries.length === 0 && <p style={styles.hint}>Пока нет записей — добавьте первую.</p>}
          {entries.map((e, i) => (
            <div key={i} style={styles.row}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Дата</span>
                <input
                  type="date"
                  value={e.date}
                  onChange={(ev) => updateEntry(i, "date", ev.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Седых в зоне</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="напр. 12"
                  value={e.grayCountZone}
                  onChange={(ev) => updateEntry(i, "grayCountZone", ev.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Самооценка 1–10</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="необяз."
                  value={e.subjectiveScore}
                  onChange={(ev) => updateEntry(i, "subjectiveScore", ev.target.value)}
                  style={styles.input}
                />
              </label>
              <button onClick={() => removeEntry(i)} style={styles.remove} aria-label={`Удалить запись ${i + 1}`}>
                ✕
              </button>
            </div>
          ))}
          <div style={styles.actions}>
            <button onClick={addEntry} style={styles.btnGhost}>+ Добавить чек-ин</button>
            <button onClick={computeTrend} disabled={loading || entries.length === 0} style={styles.btn}>
              {loading ? "Считаю тренд…" : "Показать тренд"}
            </button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
        </section>

        {result && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Тренд</h2>
            <div style={styles.statRow}>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Записей</div>
                <div style={styles.statValue}>{result.points}</div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Было → стало</div>
                <div style={styles.statValue}>{result.firstCount} → {result.lastCount}</div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Δ</div>
                <div style={{ ...styles.statValue, color: dirColor }}>
                  {result.delta > 0 ? `+${result.delta}` : result.delta}
                </div>
              </div>
              {result.weeksTracked !== null && (
                <div style={styles.stat}>
                  <div style={styles.statLabel}>Недель</div>
                  <div style={styles.statValue}>{result.weeksTracked}</div>
                </div>
              )}
            </div>
            <p style={{ ...styles.interpretation, borderColor: dirColor }}>{result.interpretation}</p>
            <p style={styles.disclaimer}>{result.disclaimer}</p>
          </section>
        )}

        <p style={styles.foot}>
          ← Назад к <a href="/qmelanin" style={styles.link}>протоколу QMelanin</a>
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070b14", color: "#e8eef6", padding: "48px 20px" },
  wrap: { maxWidth: 860, margin: "0 auto" },
  eyebrow: { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c8823f" },
  h1: { fontSize: 34, margin: "10px 0 0", fontWeight: 700 },
  lede: { color: "#9fb0c4", marginTop: 14, lineHeight: 1.6, maxWidth: 660 },
  card: { background: "#0d1422", border: "1px solid #1c2942", borderRadius: 16, padding: 24, marginTop: 26 },
  h2: { fontSize: 20, margin: "0 0 16px" },
  hint: { color: "#8b9bb0", fontSize: 14 },
  row: { display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 5, flex: "1 1 140px" },
  fieldLabel: { fontSize: 13, color: "#c3d0e0" },
  input: { background: "#0a101c", border: "1px solid #24344f", borderRadius: 8, padding: "9px 11px", color: "#e8eef6", fontSize: 14 },
  remove: { background: "transparent", color: "#8b9bb0", border: "1px solid #24344f", borderRadius: 8, padding: "9px 12px", cursor: "pointer" },
  actions: { display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" },
  btn: { background: "#c8823f", color: "#0a0a0a", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "transparent", color: "#c8823f", border: "1px solid #c8823f", borderRadius: 10, padding: "12px 18px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  error: { color: "#e0787f", marginTop: 12 },
  statRow: { display: "flex", gap: 14, flexWrap: "wrap" },
  stat: { background: "#0a101c", border: "1px solid #1c2942", borderRadius: 12, padding: "12px 18px", minWidth: 90 },
  statLabel: { fontSize: 12, color: "#8b9bb0" },
  statValue: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  interpretation: { marginTop: 18, borderLeft: "3px solid #c8823f", paddingLeft: 14, color: "#c3d0e0", lineHeight: 1.6 },
  disclaimer: { marginTop: 16, fontSize: 12.5, color: "#8b9bb0", borderTop: "1px solid #1c2942", paddingTop: 14 },
  foot: { marginTop: 26, color: "#8b9bb0", fontSize: 14 },
  link: { color: "#c8823f" },
};
