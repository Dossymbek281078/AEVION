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
const LS_LOCALE = "aevion:locale";

type Lang = "en" | "ru";

const STR: Record<string, Record<Lang, string>> = {
  subtitle: { en: "PERSONAL AI DOCTOR · v1", ru: "ПЕРСОНАЛЬНЫЙ AI-ДОКТОР · v1" },
  hero: {
    en: "Personal AI assistant: profile, symptom check, daily metrics, trends and history. Doesn't replace a doctor visit — educational service.",
    ru: "Личный AI-помощник: профиль, симптом-чек, ежедневные показатели, тренды и история. Не заменяет визит к врачу — это образовательный сервис.",
  },
  tab_profile: { en: "Profile", ru: "Профиль" },
  tab_check: { en: "Symptom check", ru: "Симптом-чек" },
  tab_log: { en: "Daily log", ru: "Дневник" },
  tab_trends: { en: "Trends", ru: "Тренды" },
  tab_history: { en: "History", ru: "История" },
  card_profile_title: { en: "Health profile", ru: "Медицинский профиль" },
  card_profile_subtitle: {
    en: "Baseline info for personalized advice",
    ru: "Базовая информация для персонализации советов",
  },
  card_check_title: { en: "Symptom check", ru: "Симптом-чек" },
  card_check_subtitle: {
    en: "Describe what bothers you — get advice. Severe symptoms → see a doctor immediately.",
    ru: "Опишите что беспокоит — получите advice. Серьёзные симптомы → немедленно к врачу.",
  },
  card_log_title: { en: "Daily wellness log", ru: "Дневник самочувствия" },
  card_log_subtitle_n: { en: "Logged: {n} {d}", ru: "Записано: {n} {d}" },
  day_one: { en: "day", ru: "день" },
  day_many: { en: "days", ru: "дней" },
  card_trends_title: { en: "Trends", ru: "Тренды" },
  trends_subtitle_streak: { en: "🔥 {n}-day streak", ru: "🔥 {n} дней подряд" },
  trends_subtitle_empty: {
    en: "Add daily logs to see trends",
    ru: "Добавьте логи для отображения трендов",
  },
  card_history_title: { en: "History", ru: "История" },
  hist_subtitle: { en: "{c} checks · {l} logs", ru: "{c} чеков · {l} логов" },
  field_age: { en: "Age", ru: "Возраст" },
  field_sex: { en: "Sex", ru: "Пол" },
  field_height: { en: "Height (cm)", ru: "Рост (см)" },
  field_weight: { en: "Weight (kg)", ru: "Вес (кг)" },
  field_conditions: {
    en: "Chronic conditions (comma separated)",
    ru: "Хронические заболевания (через запятую)",
  },
  field_allergies: { en: "Allergies", ru: "Аллергии" },
  field_medications: { en: "Medications", ru: "Лекарства" },
  field_symptoms: {
    en: "Symptoms (comma or new line)",
    ru: "Симптомы (запятая или новая строка)",
  },
  field_severity_n: { en: "Severity {n}/10", ru: "Тяжесть {n}/10" },
  field_duration: { en: "Duration (hours)", ru: "Длительность (часы)" },
  field_notes: { en: "Notes (optional)", ru: "Заметки (необязательно)" },
  field_sleep: { en: "Sleep (hours)", ru: "Сон (часы)" },
  field_mood_n: { en: "Mood {n}/10", ru: "Настроение {n}/10" },
  field_water: { en: "Water (litres)", ru: "Вода (литры)" },
  field_exercise: { en: "Exercise (minutes)", ru: "Тренировка (минуты)" },
  ph_conditions: { en: "e.g. diabetes, hypertension", ru: "напр. диабет, гипертония" },
  ph_allergies: { en: "e.g. pollen, nuts", ru: "напр. пыльца, орехи" },
  ph_medications: { en: "regular medications", ru: "что принимаете регулярно" },
  ph_symptoms: { en: "e.g. headache, fatigue, nausea", ru: "напр. headache, fatigue, тошнота" },
  ph_check_notes: {
    en: "what makes it better / worse",
    ru: "что облегчает / ухудшает",
  },
  ph_log_notes: { en: "how the day went", ru: "как день прошёл" },
  sex_other: { en: "Other / prefer not to say", ru: "Другое / без указания" },
  sex_male: { en: "Male", ru: "Мужской" },
  sex_female: { en: "Female", ru: "Женский" },
  btn_create_profile: { en: "Create profile", ru: "Создать профиль" },
  btn_update_profile: { en: "Update profile", ru: "Обновить профиль" },
  btn_get_advice: { en: "Get advice", ru: "Получить совет" },
  btn_log_today: { en: "Log today", ru: "Сохранить за сегодня" },
  bmi: { en: "BMI", ru: "ИМТ" },
  bmi_under: { en: "Underweight", ru: "Недостаточный вес" },
  bmi_normal: { en: "Normal", ru: "Норма" },
  bmi_over: { en: "Overweight", ru: "Избыточный вес" },
  bmi_obese: { en: "Obese", ru: "Ожирение" },
  stat_sleep: { en: "Sleep 7d", ru: "Сон 7д" },
  stat_mood: { en: "Mood 7d", ru: "Настр. 7д" },
  stat_weight: { en: "Weight 7d", ru: "Вес 7д" },
  stat_water: { en: "Water 7d", ru: "Вода 7д" },
  stat_exercise: { en: "Exer. 7d", ru: "Спорт 7д" },
  trends_empty: {
    en: "No data yet. Add at least one log to see trends.",
    ru: "Пока нет данных. Добавьте хотя бы один лог.",
  },
  history_empty: {
    en: "Empty. Run a symptom check or daily log to start.",
    ru: "Пусто. Запустите симптом-чек или ежедневный лог.",
  },
  section_checks: { en: "Symptom checks", ru: "Симптом-чеки" },
  section_logs: { en: "Daily logs", ru: "Ежедневные логи" },
  section_risks: { en: "Risk indicators", ru: "Риск-индикаторы" },
  risks_empty: {
    en: "✓ No active risk flags. Keep up the wellness routine.",
    ru: "✓ Активных рисков нет. Поддерживайте режим — отличная работа.",
  },
  symptoms: { en: "Symptoms", ru: "Симптомы" },
  severity_short: { en: "severity", ru: "тяжесть" },
  urg_self: { en: "Self-care", ru: "Самопомощь" },
  urg_consult: { en: "Consult", ru: "К врачу" },
  urg_urgent: { en: "Urgent", ru: "Срочно" },
  risk_low: { en: "Low", ru: "Низкий" },
  risk_medium: { en: "Medium", ru: "Средний" },
  risk_high: { en: "High", ru: "Высокий" },
  toast_save_failed: { en: "Save failed", ru: "Не удалось сохранить" },
  toast_check_failed: { en: "Check failed", ru: "Не удалось" },
  toast_log_failed: { en: "Log failed", ru: "Не удалось" },
  toast_profile_created: { en: "Profile created ✓", ru: "Профиль создан ✓" },
  toast_profile_saved: { en: "Profile saved ✓", ru: "Профиль сохранён ✓" },
  toast_no_profile: { en: "Set up profile first", ru: "Сначала создайте профиль" },
  toast_no_symptoms: {
    en: "Describe at least one symptom",
    ru: "Опишите хотя бы один симптом",
  },
  toast_logged: { en: "Logged ✓", ru: "Записано ✓" },
  disclaimer_label: { en: "Disclaimer.", ru: "Дисклеймер." },
  disclaimer_text: {
    en:
      "AEVION HealthAI is an educational AI assistant. " +
      "It does not provide diagnoses and does not replace qualified medical advice. " +
      "If you have alarming symptoms, see a doctor or call emergency services.",
    ru:
      "AEVION HealthAI — образовательный AI-помощник. " +
      "Не ставит диагнозы и не заменяет квалифицированную медицинскую " +
      "консультацию. При тревожных симптомах обратитесь к врачу или вызовите скорую (112).",
  },
};

function t(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  let v = STR[key]?.[lang] ?? key;
  if (vars) for (const [k, val] of Object.entries(vars)) v = v.replace(`{${k}}`, String(val));
  return v;
}

function detectLocale(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LS_LOCALE);
    if (stored === "ru" || stored === "en") return stored;
  } catch {}
  const lang =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language.toLowerCase()
      : "en";
  if (lang.startsWith("ru")) return "ru";
  return "en";
}

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

function urgencyLabel(u: Match["urgency"], lang: Lang): string {
  const map: Record<Match["urgency"], string> = {
    "self-care": "urg_self",
    consult: "urg_consult",
    urgent: "urg_urgent",
  };
  return t(map[u], lang);
}

function bmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function bmiLabel(value: number, lang: Lang): { label: string; color: string } {
  if (value === 0) return { label: "—", color: "#94a3b8" };
  if (value < 18.5) return { label: t("bmi_under", lang), color: "#7dd3fc" };
  if (value < 25) return { label: t("bmi_normal", lang), color: "#5eead4" };
  if (value < 30) return { label: t("bmi_over", lang), color: "#fbbf24" };
  return { label: t("bmi_obese", lang), color: "#f87171" };
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
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    setLang(detectLocale());
  }, []);
  const switchLang = (next: Lang) => {
    setLang(next);
    try {
      window.localStorage.setItem(LS_LOCALE, next);
    } catch {}
  };

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
        showToast(t("toast_save_failed", lang));
        return;
      }
      profileIdRef.current = j.profile.id;
      try {
        window.localStorage.setItem(LS_PROFILE_ID, j.profile.id);
      } catch {}
      setProfile(j.profile);
      setProfileBmi(j.bmi || 0);
      showToast(t(j.isNew ? "toast_profile_created" : "toast_profile_saved", lang));
      if (j.isNew) setTab("check");
    } finally {
      setBusy(false);
    }
  };

  const runCheck = async () => {
    if (!profileIdRef.current) {
      showToast(t("toast_no_profile", lang));
      setTab("profile");
      return;
    }
    const symptoms = symptomsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (symptoms.length === 0) {
      showToast(t("toast_no_symptoms", lang));
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
        showToast(t("toast_check_failed", lang));
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
      showToast(t("toast_no_profile", lang));
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
        showToast(t("toast_log_failed", lang));
        return;
      }
      setLogs((prev) => {
        const filtered = prev.filter((l) => l.date !== j.log.date);
        return [j.log, ...filtered].slice(0, 90);
      });
      // Освежаем тренды и риски.
      void loadTrends(profileIdRef.current);
      void loadRisks(profileIdRef.current);
      showToast(t("toast_logged", lang));
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              <span style={{ color: "#5eead4" }}>Health</span>
              <span style={{ color: "#7dd3fc" }}>AI</span>
            </h1>
            <span style={{ fontSize: 12, color: "#94a3b8", letterSpacing: "0.04em" }}>
              {t("subtitle", lang)}
            </span>
            <div style={{ flex: 1 }} />
            <div
              role="group"
              aria-label="Locale"
              style={{
                display: "flex",
                gap: 0,
                border: "1px solid rgba(120,160,220,0.3)",
                borderRadius: 999,
                overflow: "hidden",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {(["en", "ru"] as const).map((l) => {
                const active = l === lang;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => switchLang(l)}
                    style={{
                      padding: "5px 12px",
                      background: active ? "rgba(94,234,212,0.22)" : "transparent",
                      color: active ? "#5eead4" : "#94a3b8",
                      border: "none",
                      cursor: "pointer",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
            {t("hero", lang)}
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
                  ? STR.tab_profile[lang]
                  : t === "check"
                    ? STR.tab_check[lang]
                    : t === "log"
                      ? STR.tab_log[lang]
                      : t === "trends"
                        ? STR.tab_trends[lang]
                        : STR.tab_history[lang]}
              </button>
            );
          })}
        </div>

        {tab === "profile" ? (
          <Card>
            <CardHeader
              title={t("card_profile_title", lang)}
              subtitle={t("card_profile_subtitle", lang)}
            />
            <Grid2>
              <Field label={t("field_age", lang)}>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label={t("field_sex", lang)}>
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} style={inputStyle}>
                  <option value="other">{t("sex_other", lang)}</option>
                  <option value="M">{t("sex_male", lang)}</option>
                  <option value="F">{t("sex_female", lang)}</option>
                </select>
              </Field>
              <Field label={t("field_height", lang)}>
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label={t("field_weight", lang)}>
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
            <Field label={t("field_conditions", lang)}>
              <input
                type="text"
                placeholder={t("ph_conditions", lang)}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label={t("field_allergies", lang)}>
              <input
                type="text"
                placeholder={t("ph_allergies", lang)}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label={t("field_medications", lang)}>
              <input
                type="text"
                placeholder={t("ph_medications", lang)}
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
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("bmi", lang)}</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: bmiLabel(profileBmi, lang).color,
                  }}
                >
                  {profileBmi || "—"}
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700 }}>
                  {bmiLabel(profileBmi, lang).label}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
                  {profile.id.slice(0, 14)}…
                </div>
              </div>
            ) : null}
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button type="button" onClick={saveProfile} disabled={busy} style={primaryBtn}>
                {profile ? t("btn_update_profile", lang) : t("btn_create_profile", lang)}
              </button>
            </div>
          </Card>
        ) : null}

        {tab === "check" ? (
          <>
            <Card>
              <CardHeader
                title={t("card_check_title", lang)}
                subtitle={t("card_check_subtitle", lang)}
              />
              <Field label={t("field_symptoms", lang)}>
                <textarea
                  rows={3}
                  placeholder={t("ph_symptoms", lang)}
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
                />
              </Field>
              <Grid2>
                <Field label={t("field_severity_n", lang, { n: severity })}>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </Field>
                <Field label={t("field_duration", lang)}>
                  <input
                    type="number"
                    min={0}
                    value={durationH}
                    onChange={(e) => setDurationH(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </Grid2>
              <Field label={t("field_notes", lang)}>
                <input
                  type="text"
                  value={checkNotes}
                  onChange={(e) => setCheckNotes(e.target.value)}
                  style={inputStyle}
                  placeholder={t("ph_check_notes", lang)}
                />
              </Field>
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={runCheck} disabled={busy} style={primaryBtn}>
                  {t("btn_get_advice", lang)}
                </button>
              </div>
            </Card>

            {lastCheck ? <CheckCard check={lastCheck} lang={lang} /> : null}
          </>
        ) : null}

        {tab === "log" ? (
          <Card>
            <CardHeader
              title={t("card_log_title", lang)}
              subtitle={t("card_log_subtitle_n", lang, {
                n: logs.length,
                d: logs.length === 1 ? t("day_one", lang) : t("day_many", lang),
              })}
            />
            <Grid2>
              <Field label={t("field_sleep", lang)}>
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
              <Field label={t("field_mood_n", lang, { n: logMood })}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={logMood}
                  onChange={(e) => setLogMood(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </Field>
              <Field label={t("field_weight", lang)}>
                <input
                  type="number"
                  step={0.1}
                  value={logWeight}
                  onChange={(e) => setLogWeight(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label={t("field_water", lang)}>
                <input
                  type="number"
                  step={0.1}
                  value={logWater}
                  onChange={(e) => setLogWater(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label={t("field_exercise", lang)}>
                <input
                  type="number"
                  min={0}
                  value={logExercise}
                  onChange={(e) => setLogExercise(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </Grid2>
            <Field label={t("field_notes", lang)}>
              <input
                type="text"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder={t("ph_log_notes", lang)}
                style={inputStyle}
              />
            </Field>
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={submitLog} disabled={busy} style={primaryBtn}>
                {t("btn_log_today", lang)}
              </button>
            </div>
          </Card>
        ) : null}

        {tab === "trends" ? (
          <Card>
            <CardHeader
              title={t("card_trends_title", lang)}
              subtitle={
                trends?.streak
                  ? t("trends_subtitle_streak", lang, { n: trends.streak })
                  : t("trends_subtitle_empty", lang)
              }
            />
            {risks && risks.risks.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <h3 style={sectionTitle}>
                  {t("section_risks", lang)}
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
                    <RiskCard key={r.code} risk={r} lang={lang} />
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
                {t("risks_empty", lang)}
              </div>
            ) : null}
            {!trends || trends.series.length === 0 ? (
              <div style={emptyStyle}>{t("trends_empty", lang)}</div>
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
                    label={t("stat_sleep", lang)}
                    value={trends.avg7d?.sleep}
                    unit="h"
                    color="#7dd3fc"
                  />
                  <Stat label={t("stat_mood", lang)} value={trends.avg7d?.mood} unit="/10" color="#5eead4" />
                  <Stat label={t("stat_weight", lang)} value={trends.avg7d?.weight} unit="kg" color="#fbbf24" />
                  <Stat label={t("stat_water", lang)} value={trends.avg7d?.water} unit="L" color="#a5b4fc" />
                  <Stat label={t("stat_exercise", lang)} value={trends.avg7d?.exercise} unit="min" color="#f472b6" />
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
            <CardHeader
              title={t("card_history_title", lang)}
              subtitle={t("hist_subtitle", lang, { c: checks.length, l: logs.length })}
            />
            {checks.length === 0 && logs.length === 0 ? (
              <div style={emptyStyle}>{t("history_empty", lang)}</div>
            ) : (
              <>
                {checks.length > 0 ? (
                  <>
                    <h3 style={sectionTitle}>{t("section_checks", lang)}</h3>
                    {checks.slice(0, 10).map((c) => (
                      <CheckCard key={c.id} check={c} compact lang={lang} />
                    ))}
                  </>
                ) : null}
                {logs.length > 0 ? (
                  <>
                    <h3 style={sectionTitle}>{t("section_logs", lang)}</h3>
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
          ⚠ <b>{t("disclaimer_label", lang)}</b> {t("disclaimer_text", lang)}
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

function riskLabel(s: Risk["severity"], lang: Lang): string {
  const map: Record<Risk["severity"], string> = {
    low: "risk_low",
    medium: "risk_medium",
    high: "risk_high",
  };
  return t(map[s], lang);
}

function RiskCard({ risk, lang }: { risk: Risk; lang: Lang }) {
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
          {riskLabel(risk.severity, lang)}
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

function CheckCard({
  check,
  compact,
  lang,
}: {
  check: Check;
  compact?: boolean;
  lang: Lang;
}) {
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
          {t("severity_short", lang)} {check.severity}/10
          {check.durationH ? ` · ${check.durationH}h` : ""}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#e2e8f8", marginBottom: 10 }}>
        <b>{t("symptoms", lang)}:</b> {check.symptoms.join(", ")}
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
                  {urgencyLabel(m.urgency, lang)}
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
