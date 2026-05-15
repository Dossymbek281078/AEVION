"use client";

/**
 * AEVION HealthAI — print-friendly health report для врача.
 *
 * Открывается с ?id=<profileId>. Подгружает /api/healthai/export/<id>
 * и рендерит компактный layout, оптимизированный для Ctrl+P → Save as PDF.
 *
 * Поддерживает кириллицу из коробки (системный шрифт).
 */

import { useEffect, useState } from "react";

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://aevion-production-a70c.up.railway.app");

type Profile = {
  id: string;
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  conditions: string[];
  allergies: string[];
  medications: string[];
  createdAt: string;
};

type Match = {
  keyword: string;
  advice: string;
  urgency: "self-care" | "consult" | "urgent";
};

type Check = {
  id: string;
  symptoms: string[];
  severity: number;
  durationH: number;
  matched: Match[];
  generic: string;
  createdAt: string;
  notes?: string;
};

type Log = {
  id: string;
  date: string;
  sleepHours?: number;
  moodScore?: number;
  weightKg?: number;
  waterL?: number;
  exerciseMin?: number;
  notes?: string;
};

type ExportData = {
  exportedAt: string;
  profile: Profile;
  bmi: number;
  symptomChecks: Check[];
  dailyLogs: Log[];
  disclaimer: string;
};

const URGENCY_RU: Record<Match["urgency"], string> = {
  "self-care": "Самопомощь",
  consult: "К врачу",
  urgent: "Срочно",
};

export default function HealthReportPage() {
  const [data, setData] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get("id");
    if (!id) {
      setError("Не указан id профиля. Откройте /healthai/report?id=<profileId>.");
      return;
    }
    fetch(`${BACKEND}/api/healthai/export/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  if (error) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui", color: "#111" }}>
        <h1>Ошибка</h1>
        <p>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui", color: "#111" }}>
        Loading…
      </main>
    );
  }

  const p = data.profile;
  return (
    <main
      style={{
        padding: "32px 36px",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: "#0f172a",
        background: "#fff",
        maxWidth: 800,
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <style>{`
        @media print {
          @page { margin: 16mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .row { display: grid; grid-template-columns: 200px 1fr; gap: 8px; margin-bottom: 4px; }
        .row .k { color: #475569; font-size: 12px; }
        .row .v { font-weight: 600; font-size: 13px; }
        h1 { margin: 0 0 4px; font-size: 24px; }
        h2 { margin: 18px 0 8px; font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-right: 6px; }
        .urg-self { background: #ccfbf1; color: #0f766e; }
        .urg-consult { background: #fef3c7; color: #92400e; }
        .urg-urgent { background: #fee2e2; color: #991b1b; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
        th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 700; }
      `}</style>

      <header style={{ marginBottom: 18 }}>
        <h1>
          <span style={{ color: "#0d9488" }}>AEVION HealthAI</span>{" "}
          <span style={{ color: "#0f172a", fontSize: 16, fontWeight: 600 }}>
            · Health Report
          </span>
        </h1>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
          Generated {new Date(data.exportedAt).toLocaleString()}
        </div>
      </header>

      <button
        type="button"
        className="no-print"
        onClick={() => window.print()}
        style={{
          marginBottom: 18,
          padding: "8px 14px",
          background: "#0d9488",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        🖨 Print / Save as PDF
      </button>

      <h2>Patient profile</h2>
      <div style={{ display: "grid", gap: 4 }}>
        <div className="row"><span className="k">Profile ID</span><span className="v">{p.id}</span></div>
        <div className="row"><span className="k">Age</span><span className="v">{p.age || "—"}</span></div>
        <div className="row"><span className="k">Sex</span><span className="v">{p.sex}</span></div>
        <div className="row"><span className="k">Height</span><span className="v">{p.heightCm || "—"} cm</span></div>
        <div className="row"><span className="k">Weight</span><span className="v">{p.weightKg || "—"} kg</span></div>
        <div className="row"><span className="k">BMI</span><span className="v">{data.bmi || "—"}</span></div>
        <div className="row"><span className="k">Chronic conditions</span><span className="v">{p.conditions.length ? p.conditions.join(", ") : "—"}</span></div>
        <div className="row"><span className="k">Allergies</span><span className="v">{p.allergies.length ? p.allergies.join(", ") : "—"}</span></div>
        <div className="row"><span className="k">Medications</span><span className="v">{p.medications.length ? p.medications.join(", ") : "—"}</span></div>
      </div>

      <h2>Symptom checks ({data.symptomChecks.length})</h2>
      {data.symptomChecks.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>No checks recorded.</div>
      ) : (
        data.symptomChecks.map((c) => (
          <div key={c.id} className="card">
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
              {new Date(c.createdAt).toLocaleString()} · severity {c.severity}/10
              {c.durationH ? ` · ${c.durationH}h` : ""}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Symptoms: {c.symptoms.join(", ")}
            </div>
            {c.matched.length > 0 ? (
              <div style={{ fontSize: 12 }}>
                {c.matched.map((m, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <span className={`pill urg-${m.urgency}`}>{URGENCY_RU[m.urgency]}</span>
                    <b>{m.keyword}.</b> {m.advice}
                  </div>
                ))}
              </div>
            ) : null}
            {c.notes ? (
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                <i>Notes:</i> {c.notes}
              </div>
            ) : null}
          </div>
        ))
      )}

      <h2>Daily wellness log ({data.dailyLogs.length} entries)</h2>
      {data.dailyLogs.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>No logs recorded.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Sleep (h)</th>
              <th>Mood</th>
              <th>Weight (kg)</th>
              <th>Water (L)</th>
              <th>Exercise (min)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {data.dailyLogs
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{l.sleepHours ?? "—"}</td>
                  <td>{l.moodScore ? `${l.moodScore}/10` : "—"}</td>
                  <td>{l.weightKg ?? "—"}</td>
                  <td>{l.waterL ?? "—"}</td>
                  <td>{l.exerciseMin ?? "—"}</td>
                  <td style={{ fontSize: 11, color: "#475569" }}>{l.notes || ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <div
        style={{
          marginTop: 22,
          padding: 12,
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 6,
          fontSize: 11,
          color: "#7f1d1d",
        }}
      >
        ⚠ {data.disclaimer}
      </div>

      <footer style={{ marginTop: 18, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
        AEVION HealthAI · Personal AI Doctor v2 · {p.id}
      </footer>
    </main>
  );
}
