"use client";

/**
 * AEVION HealthAI — Personal AI Doctor v1.
 *
 * Frontend MVP: profile setup, symptom check, daily wellness log, trends,
 * history. Stateless кроме localStorage (profileId).
 *
 * Backend: /api/healthai/* (rule-based advice, in-memory).
 * Disclaimer: НЕ заменяет медицинскую консультацию.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://aevion-production-a70c.up.railway.app");

const LS_PROFILE_ID = "aevion:healthai:profileId";
const LS_TAB = "aevion:healthai:tab";

type Tab = "profile" | "check" | "log" | "trends" | "history";

type Sex = "M" | "F" | "other";

type Profile = {
  id: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  conditions: string[];
  allergies: string[];
  medications: string[];
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
  disclaimer: string;
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
  createdAt: string;
};

type Trends = {
  avg7d: Record<string, number | null> | null;
  avg30d: Record<string, number | null> | null;
  series: Array<{
    date: string;
    sleepHours: number | null;
    moodScore: number | null;
    weightKg: number | null;
  }>;
  streak: number;
};

type Risk = {
  code: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
};

type RisksResp = {
  risks: Risk[];
  summary: { total: number; high: number; medium: number; low: number };
  bmi: number;
  avgSleep7d: number | null;
  avgMood7d: number | null;
};

const URGENCY_COLOR: Record<Match["urgency"], string> = {
  "self-care": "#5eead4",
  consult: "#fbbf24",
  urgent: "#f87171",
};

const URGENCY_LABEL: Record<Match["urgency"], string> = {
  "self-care": "Self-care",
  consult: "Consult",
  urgent: "Urgent",
};

function bmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function bmiLabel(value: number): { label: string; color: string } {
  if (value === 0) return { label: "—", color: "#94a3b8" };
  if (value < 18.5) return { label: "Underweight", color: "#7dd3fc" };
  if (value < 25) return { label: "Normal", color: "#5eead4" };
  if (value < 30) return { label: "Overweight", color: "#fbbf24" };
  return { label: "Obese", color: "#f87171" };
}

export default function HealthAIPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileBmi, setProfileBmi] = useState(0);
  const [checks, setChecks] = useState<Check[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [risks, setRisks] = useState<RisksResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Profile draft
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("other");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");

  // Check draft
  const [symptomsText, setSymptomsText] = useState("");
  const [severity, setSeverity] = useState(5);
  const [durationH, setDurationH] = useState("");
  const [checkNotes, setCheckNotes] = useState("");
  const [lastCheck, setLastCheck] = useState<Check | null>(null);

  // Log draft
  const [logSleep, setLogSleep] = useState("");
  const [logMood, setLogMood] = useState(5);
  const [logWeight, setLogWeight] = useState("");
  const [logWater, setLogWater] = useState("");
  const [logExercise, setLogExercise] = useState("");
  const [logNotes, setLogNotes] = useState("");

  const profileIdRef = useRef<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const loadHistory = useCallback(async (profileId: string) => {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/history/${profileId}`);
      if (!r.ok) return;
      const j = await r.json();
      setChecks(j.checks || []);
      setLogs(j.logs || []);
    } catch {}
  }, []);

  const loadTrends = useCallback(async (profileId: string) => {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/trends/${profileId}`);
      if (!r.ok) return;
      const j = await r.json();
      setTrends(j);
    } catch {}
  }, []);

  const loadRisks = useCallback(async (profileId: string) => {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/risks/${profileId}`);
      if (!r.ok) return;
      const j = await r.json();
      setRisks(j);
    } catch {}
  }, []);

  const loadProfile = useCallback(
    async (id: string) => {
      try {
        const r = await fetch(`${BACKEND}/api/healthai/profile/${id}`);
        if (!r.ok) return false;
        const j = await r.json();
        if (j.profile) {
          setProfile(j.profile);
          setProfileBmi(j.bmi || 0);
          // populate draft
          setAge(String(j.profile.age || ""));
          setSex(j.profile.sex || "other");
          setHeightCm(String(j.profile.heightCm || ""));
          setWeightKg(String(j.profile.weightKg || ""));
          setConditions((j.profile.conditions || []).join(", "));
          setAllergies((j.profile.allergies || []).join(", "));
          setMedications((j.profile.medications || []).join(", "));
        }
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  // Mount: восстанавливаем profileId.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LS_PROFILE_ID);
      if (stored) {
        profileIdRef.current = stored;
        loadProfile(stored).then((ok) => {
          if (ok) {
            loadHistory(stored);
            loadTrends(stored);
            loadRisks(stored);
            setTab("check");
          }
        });
      }
      const t = window.localStorage.getItem(LS_TAB) as Tab | null;
      if (t === "profile" || t === "check" || t === "log" || t === "trends" || t === "history") {
        setTab(t);
      }
    } catch {}
  }, [loadProfile, loadHistory, loadTrends, loadRisks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_TAB, tab);
    } catch {}
  }, [tab]);

  const saveProfile = async () => {
    setBusy(true);
    try {
      const body = {
        id: profileIdRef.current,
        age: Number(age) || 0,
        sex,
        heightCm: Number(heightCm) || 0,
        weightKg: Number(weightKg) || 0,
        conditions: conditions.split(",").map((s) => s.trim()).filter(Boolean),
        allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
        medications: medications.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const r = await fetch(`${BACKEND}/api/healthai/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.profile) {
        showToast("Save failed");
        return;
      }
      profileIdRef.current = j.profile.id;
      try {
        window.localStorage.setItem(LS_PROFILE_ID, j.profile.id);
      } catch {}
      setProfile(j.profile);
      setProfileBmi(j.bmi || 0);
      showToast(j.isNew ? "Profile created ✓" : "Profile saved ✓");
      if (j.isNew) setTab("check");
    } finally {
      setBusy(false);
    }
  };

  const runCheck = async () => {
    if (!profileIdRef.current) {
      showToast("Set up profile first");
      setTab("profile");
      return;
    }
    const symptoms = symptomsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (symptoms.length === 0) {
      showToast("Describe at least one symptom");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/healthai/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          symptoms,
          severity,
          durationH: Number(durationH) || 0,
          notes: checkNotes,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        showToast("Check failed");
        return;
      }
      setLastCheck(j.check);
      setChecks((prev) => [j.check, ...prev].slice(0, 30));
      // Сбрасываем форму, оставляя severity на 5.
      setSymptomsText("");
      setDurationH("");
      setCheckNotes("");
    } finally {
      setBusy(false);
    }
  };

  const submitLog = async () => {
    if (!profileIdRef.current) {
      showToast("Set up profile first");
      setTab("profile");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        profileId: profileIdRef.current,
        moodScore: logMood,
      };
      if (logSleep) body.sleepHours = Number(logSleep);
      if (logWeight) body.weightKg = Number(logWeight);
      if (logWater) body.waterL = Number(logWater);
      if (logExercise) body.exerciseMin = Number(logExercise);
      if (logNotes) body.notes = logNotes;
      const r = await fetch(`${BACKEND}/api/healthai/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.log) {
        showToast("Log failed");
        return;
      }
      setLogs((prev) => {
        const filtered = prev.filter((l) => l.date !== j.log.date);
        return [j.log, ...filtered].slice(0, 90);
      });
      // Освежаем тренды и риски.
      void loadTrends(profileIdRef.current);
      void loadRisks(profileIdRef.current);
      showToast("Logged ✓");
      setLogSleep("");
      setLogWeight("");
      setLogWater("");
      setLogExercise("");
      setLogNotes("");
    } finally {
      setBusy(false);
    }
  };

  const seriesChart = useMemo(() => {
    if (!trends || trends.series.length === 0) return null;
    const points = trends.series.slice(-30);
    const w = 480;
    const h = 140;
    const pad = 24;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const buildLine = (
      pick: (p: Trends["series"][number]) => number | null,
      lo: number,
      hi: number,
    ) => {
      const xs = points.map((_, i) =>
        points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1),
      );
      const path: string[] = [];
      let started = false;
      points.forEach((p, i) => {
        const v = pick(p);
        if (v == null) return;
        const norm = (v - lo) / (hi - lo);
        const y = innerH - Math.max(0, Math.min(1, norm)) * innerH;
        const cmd = started ? "L" : "M";
        path.push(`${cmd}${(xs[i] + pad).toFixed(1)},${(y + pad).toFixed(1)}`);
        started = true;
      });
      return path.join(" ");
    };
    return {
      w,
      h,
      sleepPath: buildLine((p) => p.sleepHours, 0, 12),
      moodPath: buildLine((p) => p.moodScore, 1, 10),
      weightPath: buildLine((p) => p.weightKg, 30, 200),
    };
  }, [trends]);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #060912 0%, #0c1322 100%)",
        minHeight: "100vh",
        color: "#e2e8f8",
        padding: "24px 16px 60px",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Wave1Nav variant="dark" />

        <header style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              <span style={{ color: "#5eead4" }}>Health</span>
              <span style={{ color: "#7dd3fc" }}>AI</span>
            </h1>
            <span style={{ fontSize: 12, color: "#94a3b8", letterSpacing: "0.04em" }}>
              PERSONAL AI DOCTOR · v1
            </span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
            Личный AI-помощник: профиль, симптом-чек, ежедневные показатели,
            тренды и история. Не заменяет визит к врачу — это образовательный сервис.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 18,
            flexWrap: "wrap",
            borderBottom: "1px solid rgba(120,160,220,0.18)",
            paddingBottom: 10,
          }}
        >
          {(["profile", "check", "log", "trends", "history"] as const).map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 14px",
                  background: active ? "rgba(94,234,212,0.18)" : "transparent",
                  border: active
                    ? "1px solid rgba(94,234,212,0.55)"
                    : "1px solid rgba(120,160,220,0.18)",
                  borderRadius: 999,
                  color: active ? "#5eead4" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  letterSpacing: "0.02em",
                }}
              >
                {t === "profile"
                  ? "Profile"
                  : t === "check"
                    ? "Symptom check"
                    : t === "log"
                      ? "Daily log"
                      : t === "trends"
                        ? "Trends"
                        : "History"}
              </button>
            );
          })}
        </div>

        {tab === "profile" ? (
          <Card>
            <CardHeader title="Health profile" subtitle="Базовая информация для персонализации советов" />
            <Grid2>
              <Field label="Age">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Sex">
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} style={inputStyle}>
                  <option value="other">Other / prefer not to say</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </Field>
              <Field label="Height (cm)">
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </Grid2>
            <Field label="Chronic conditions (comma separated)">
              <input
                type="text"
                placeholder="e.g. диабет, гипертония"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Allergies">
              <input
                type="text"
                placeholder="e.g. пыльца, орехи"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Medications">
              <input
                type="text"
                placeholder="что принимаете регулярно"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                style={inputStyle}
              />
            </Field>
            {profile ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(94,234,212,0.08)",
                  border: "1px solid rgba(94,234,212,0.25)",
                  marginTop: 10,
                }}
              >
                <div style={{ fontSize: 12, color: "#94a3b8" }}>BMI</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: bmiLabel(profileBmi).color,
                  }}
                >
                  {profileBmi || "—"}
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700 }}>
                  {bmiLabel(profileBmi).label}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
                  {profile.id.slice(0, 14)}…
                </div>
              </div>
            ) : null}
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button type="button" onClick={saveProfile} disabled={busy} style={primaryBtn}>
                {profile ? "Update profile" : "Create profile"}
              </button>
            </div>
          </Card>
        ) : null}

        {tab === "check" ? (
          <>
            <Card>
              <CardHeader
                title="Symptom check"
                subtitle="Опишите что беспокоит — получите advice. Серьёзные симптомы → немедленно к врачу."
              />
              <Field label="Symptoms (comma or new line)">
                <textarea
                  rows={3}
                  placeholder="напр. headache, fatigue, тошнота"
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
                />
              </Field>
              <Grid2>
                <Field label={`Severity ${severity}/10`}>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </Field>
                <Field label="Duration (hours)">
                  <input
                    type="number"
                    min={0}
                    value={durationH}
                    onChange={(e) => setDurationH(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </Grid2>
              <Field label="Notes (optional)">
                <input
                  type="text"
                  value={checkNotes}
                  onChange={(e) => setCheckNotes(e.target.value)}
                  style={inputStyle}
                  placeholder="что облегчает / ухудшает"
                />
              </Field>
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={runCheck} disabled={busy} style={primaryBtn}>
                  Get advice
                </button>
              </div>
            </Card>

            {lastCheck ? <CheckCard check={lastCheck} /> : null}
          </>
        ) : null}

        {tab === "log" ? (
          <Card>
            <CardHeader
              title="Daily wellness log"
              subtitle={`Записано: ${logs.length} ${logs.length === 1 ? "day" : "days"}`}
            />
            <Grid2>
              <Field label="Sleep (hours)">
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={24}
                  value={logSleep}
                  onChange={(e) => setLogSleep(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label={`Mood ${logMood}/10`}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={logMood}
                  onChange={(e) => setLogMood(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  type="number"
                  step={0.1}
                  value={logWeight}
                  onChange={(e) => setLogWeight(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Water (litres)">
                <input
                  type="number"
                  step={0.1}
                  value={logWater}
                  onChange={(e) => setLogWater(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Exercise (minutes)">
                <input
                  type="number"
                  min={0}
                  value={logExercise}
                  onChange={(e) => setLogExercise(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </Grid2>
            <Field label="Notes (optional)">
              <input
                type="text"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="как день прошёл"
                style={inputStyle}
              />
            </Field>
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={submitLog} disabled={busy} style={primaryBtn}>
                Log today
              </button>
            </div>
          </Card>
        ) : null}

        {tab === "trends" ? (
          <Card>
            <CardHeader
              title="Trends"
              subtitle={
                trends?.streak
                  ? `🔥 ${trends.streak}-day streak`
                  : "Add daily logs to see trends"
              }
            />
            {risks && risks.risks.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <h3 style={sectionTitle}>
                  Risk indicators
                  {risks.summary.high > 0 ? (
                    <span style={{ color: "#f87171", marginLeft: 8 }}>
                      · {risks.summary.high} high
                    </span>
                  ) : null}
                  {risks.summary.medium > 0 ? (
                    <span style={{ color: "#fbbf24", marginLeft: 8 }}>
                      · {risks.summary.medium} medium
                    </span>
                  ) : null}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {risks.risks.map((r) => (
                    <RiskCard key={r.code} risk={r} />
                  ))}
                </div>
              </div>
            ) : null}
            {risks && risks.risks.length === 0 ? (
              <div
                style={{
                  ...emptyStyle,
                  background: "rgba(94,234,212,0.06)",
                  color: "#5eead4",
                  fontStyle: "normal",
                  border: "1px solid rgba(94,234,212,0.25)",
                  marginBottom: 14,
                }}
              >
                ✓ No active risk flags. Keep up the wellness routine.
              </div>
            ) : null}
            {!trends || trends.series.length === 0 ? (
              <div style={emptyStyle}>No data yet. Add at least one log to see trends.</div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <Stat
                    label="Sleep 7d"
                    value={trends.avg7d?.sleep}
                    unit="h"
                    color="#7dd3fc"
                  />
                  <Stat label="Mood 7d" value={trends.avg7d?.mood} unit="/10" color="#5eead4" />
                  <Stat label="Weight 7d" value={trends.avg7d?.weight} unit="kg" color="#fbbf24" />
                  <Stat label="Water 7d" value={trends.avg7d?.water} unit="L" color="#a5b4fc" />
                  <Stat label="Exer. 7d" value={trends.avg7d?.exercise} unit="min" color="#f472b6" />
                </div>
                {seriesChart ? (
                  <div
                    style={{
                      background: "rgba(8,12,24,0.7)",
                      borderRadius: 10,
                      padding: 8,
                      border: "1px solid rgba(120,160,220,0.18)",
                    }}
                  >
                    <svg viewBox={`0 0 ${seriesChart.w} ${seriesChart.h}`} width="100%">
                      <path
                        d={seriesChart.sleepPath}
                        stroke="#7dd3fc"
                        strokeWidth={1.6}
                        fill="none"
                      />
                      <path
                        d={seriesChart.moodPath}
                        stroke="#5eead4"
                        strokeWidth={1.6}
                        fill="none"
                      />
                      <path
                        d={seriesChart.weightPath}
                        stroke="#fbbf24"
                        strokeWidth={1.4}
                        fill="none"
                        opacity={0.8}
                      />
                    </svg>
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        fontSize: 11,
                        color: "#94a3b8",
                        marginTop: 6,
                      }}
                    >
                      <span style={{ color: "#7dd3fc" }}>● Sleep</span>
                      <span style={{ color: "#5eead4" }}>● Mood</span>
                      <span style={{ color: "#fbbf24" }}>● Weight</span>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {tab === "history" ? (
          <Card>
            <CardHeader title="History" subtitle={`${checks.length} checks · ${logs.length} logs`} />
            {checks.length === 0 && logs.length === 0 ? (
              <div style={emptyStyle}>Empty. Run a symptom check or daily log to start.</div>
            ) : (
              <>
                {checks.length > 0 ? (
                  <>
                    <h3 style={sectionTitle}>Symptom checks</h3>
                    {checks.slice(0, 10).map((c) => (
                      <CheckCard key={c.id} check={c} compact />
                    ))}
                  </>
                ) : null}
                {logs.length > 0 ? (
                  <>
                    <h3 style={sectionTitle}>Daily logs</h3>
                    {logs.slice(0, 30).map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "100px 1fr",
                          gap: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "rgba(20,28,46,0.5)",
                          border: "1px solid rgba(120,160,220,0.14)",
                          marginBottom: 6,
                          alignItems: "baseline",
                        }}
                      >
                        <div style={{ fontFamily: "ui-monospace, monospace", color: "#7dd3fc", fontSize: 12, fontWeight: 700 }}>
                          {l.date}
                        </div>
                        <div style={{ fontSize: 12, color: "#cbd5e1", display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {l.sleepHours != null ? <span>💤 {l.sleepHours}h</span> : null}
                          {l.moodScore != null ? <span>🙂 {l.moodScore}/10</span> : null}
                          {l.weightKg != null ? <span>⚖ {l.weightKg}kg</span> : null}
                          {l.waterL != null ? <span>💧 {l.waterL}L</span> : null}
                          {l.exerciseMin != null ? <span>🏃 {l.exerciseMin}min</span> : null}
                          {l.notes ? <span style={{ opacity: 0.7 }}>· {l.notes}</span> : null}
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        <div
          style={{
            marginTop: 22,
            padding: 14,
            borderRadius: 10,
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.3)",
            fontSize: 12,
            color: "#fecaca",
            lineHeight: 1.5,
          }}
        >
          ⚠ <b>Disclaimer.</b> AEVION HealthAI — образовательный AI-помощник.
          Не ставит диагнозы и не заменяет квалифицированную медицинскую
          консультацию. При тревожных симптомах обратитесь к врачу или вызовите
          скорую (112).
        </div>
      </div>

      {toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 18px",
            background: "rgba(13,148,136,0.95)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            borderRadius: 10,
            boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(12,18,32,0.78)",
        border: "1px solid rgba(120,160,220,0.22)",
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#e2e8f8" }}>{title}</h2>
      {subtitle ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{subtitle}</p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(20,28,46,0.6)",
        border: "1px solid rgba(120,160,220,0.16)",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ marginTop: 3 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color }}>
          {value == null ? "—" : value}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>{value == null ? "" : unit}</span>
      </div>
    </div>
  );
}

const RISK_COLOR: Record<Risk["severity"], string> = {
  low: "#a5b4fc",
  medium: "#fbbf24",
  high: "#f87171",
};

const RISK_LABEL: Record<Risk["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function RiskCard({ risk }: { risk: Risk }) {
  const c = RISK_COLOR[risk.severity];
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: `${c}10`,
        border: `1px solid ${c}55`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: c,
            background: `${c}22`,
            padding: "2px 8px",
            borderRadius: 999,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {RISK_LABEL[risk.severity]}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f8" }}>
          {risk.title}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>
        {risk.detail}
      </div>
    </div>
  );
}

function CheckCard({ check, compact }: { check: Check; compact?: boolean }) {
  return (
    <div
      style={{
        background: compact ? "rgba(20,28,46,0.5)" : "rgba(94,234,212,0.05)",
        border: compact
          ? "1px solid rgba(120,160,220,0.14)"
          : "1px solid rgba(94,234,212,0.3)",
        borderRadius: 12,
        padding: compact ? 12 : 16,
        marginBottom: compact ? 8 : 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#5eead4" }}>
          ⓘ {new Date(check.createdAt).toLocaleString()}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          severity {check.severity}/10
          {check.durationH ? ` · ${check.durationH}h` : ""}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#e2e8f8", marginBottom: 10 }}>
        <b>Symptoms:</b> {check.symptoms.join(", ")}
      </div>
      {check.matched.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {check.matched.map((m, i) => (
            <div
              key={i}
              style={{
                padding: 10,
                borderRadius: 8,
                background: "rgba(8,12,24,0.6)",
                border: `1px solid ${URGENCY_COLOR[m.urgency]}55`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: URGENCY_COLOR[m.urgency],
                    background: `${URGENCY_COLOR[m.urgency]}22`,
                    padding: "2px 8px",
                    borderRadius: 999,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {URGENCY_LABEL[m.urgency]}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f8" }}>
                  {m.keyword}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>{m.advice}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
        {check.generic}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "rgba(20,28,46,0.7)",
  border: "1px solid rgba(120,160,220,0.25)",
  borderRadius: 8,
  color: "#e2e8f8",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 18px",
  background: "linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)",
  color: "#06141a",
  border: "1px solid rgba(94,234,212,0.55)",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  letterSpacing: "0.02em",
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center" as const,
  color: "#94a3b8",
  fontSize: 13,
  fontStyle: "italic" as const,
  background: "rgba(20,28,46,0.4)",
  borderRadius: 8,
};

const sectionTitle: React.CSSProperties = {
  margin: "14px 0 8px",
  fontSize: 13,
  color: "#7dd3fc",
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};
