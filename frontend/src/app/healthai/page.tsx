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
const LS_AUTH_TOKEN = "aevion:auth:token";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const t = window.localStorage.getItem(LS_AUTH_TOKEN);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

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
  wearables_title: { en: "Connect wearables", ru: "Подключить устройства" },
  wearables_subtitle: {
    en: "Demo import: fills 7 fake daily entries to preview trends. Real OAuth coming in v2.",
    ru: "Демо-импорт: 7 фейковых дней для демонстрации трендов. Реальная OAuth-интеграция — в v2.",
  },
  wearables_apple: { en: "🍎 Apple Health (demo)", ru: "🍎 Apple Health (демо)" },
  wearables_google: { en: "❤ Google Fit (demo)", ru: "❤ Google Fit (демо)" },
  toast_imported_n: { en: "Imported {n} days ✓", ru: "Импортировано {n} дней ✓" },
  btn_llm_advice: {
    en: "🧠 Deeper AI analysis",
    ru: "🧠 Глубокий AI-анализ",
  },
  llm_loading: { en: "Thinking…", ru: "Анализирую…" },
  llm_not_configured: {
    en: "LLM is not configured on the server (set ANTHROPIC_API_KEY).",
    ru: "LLM не настроен на сервере (нужен ANTHROPIC_API_KEY).",
  },
  llm_failed: { en: "AI request failed", ru: "Запрос к AI не удался" },
  llm_card_title: { en: "AI deep analysis", ru: "Глубокий AI-анализ" },
  btn_print_report: {
    en: "🖨 Print report (PDF)",
    ru: "🖨 Печать отчёта (PDF)",
  },
  btn_export_json: { en: "⤓ Export JSON", ru: "⤓ Экспорт JSON" },
  export_section_title: {
    en: "Doctor report",
    ru: "Отчёт для врача",
  },
  export_section_subtitle: {
    en: "Print-friendly summary or raw JSON dump for backup",
    ru: "Печатный отчёт или JSON-выгрузка для бэкапа",
  },
  family_title: { en: "Family profiles", ru: "Семейные профили" },
  family_subtitle: {
    en: "Manage profiles for your family members. Sign in to AEVION to enable.",
    ru: "Управляйте профилями родственников. Войдите в AEVION для активации.",
  },
  family_no_auth: {
    en: "Sign in via /auth to attach profiles to your AEVION account.",
    ru: "Войдите через /auth, чтобы привязать профили к AEVION-аккаунту.",
  },
  family_no_profiles: {
    en: "No additional profiles yet.",
    ru: "Дополнительных профилей пока нет.",
  },
  family_member_label: { en: "Member name", ru: "Имя члена семьи" },
  family_add: { en: "+ New profile", ru: "+ Новый профиль" },
  family_switch: { en: "Switch", ru: "Открыть" },
  family_delete: { en: "Delete", ru: "Удалить" },
  family_self: { en: "Me", ru: "Я" },
  family_active: { en: "Active", ru: "Активный" },
  tab_screener: { en: "Screener", ru: "Скрининг" },
  phq9_title: { en: "PHQ-9 depression screener", ru: "PHQ-9 — скрининг депрессии" },
  phq9_subtitle: {
    en: "Standardized 9-question screener. «Over the last 2 weeks, how often have you been bothered by…»",
    ru: "Стандартизированный 9-вопросный тест. «За последние 2 недели как часто вас беспокоило…»",
  },
  phq9_q1: {
    en: "Little interest or pleasure in doing things",
    ru: "Мало интереса или удовольствия от занятий",
  },
  phq9_q2: {
    en: "Feeling down, depressed, or hopeless",
    ru: "Чувство подавленности, угнетённости или безнадёжности",
  },
  phq9_q3: {
    en: "Trouble falling/staying asleep, or sleeping too much",
    ru: "Проблемы со сном — трудности засыпания / поверхностный сон / избыточный сон",
  },
  phq9_q4: { en: "Feeling tired or having little energy", ru: "Усталость или мало энергии" },
  phq9_q5: { en: "Poor appetite or overeating", ru: "Плохой аппетит или переедание" },
  phq9_q6: {
    en: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    ru: "Плохое чувство о себе — будто вы неудачник или подвели семью",
  },
  phq9_q7: {
    en: "Trouble concentrating on things (reading the newspaper or watching TV)",
    ru: "Трудности с концентрацией внимания (чтение, ТВ)",
  },
  phq9_q8: {
    en: "Moving or speaking so slowly that other people could have noticed; or being so fidgety/restless that you have been moving around a lot more than usual",
    ru: "Заторможенность движений/речи (заметная другим), или, наоборот, повышенная неусидчивость",
  },
  phq9_q9: {
    en: "Thoughts that you would be better off dead or of hurting yourself in some way",
    ru: "Мысли о причинении вреда себе или о том, что лучше бы умереть",
  },
  phq9_opt0: { en: "Not at all", ru: "Совсем нет" },
  phq9_opt1: { en: "Several days", ru: "Несколько дней" },
  phq9_opt2: { en: "More than half the days", ru: "Более половины дней" },
  phq9_opt3: { en: "Nearly every day", ru: "Почти каждый день" },
  phq9_submit: { en: "Calculate score", ru: "Рассчитать результат" },
  phq9_result: { en: "Score: {n}/27", ru: "Результат: {n}/27" },
  phq9_sev_minimal: { en: "Minimal", ru: "Минимальные симптомы" },
  phq9_sev_mild: { en: "Mild", ru: "Лёгкая степень" },
  phq9_sev_moderate: { en: "Moderate", ru: "Умеренная степень" },
  phq9_sev_moderately_severe: { en: "Moderately severe", ru: "Умеренно-тяжёлая" },
  phq9_sev_severe: { en: "Severe", ru: "Тяжёлая степень" },
  phq9_suicide_warning: { en: "Important", ru: "Важно" },
  phq9_disclaimer_short: {
    en: "PHQ-9 is a screening tool, not a diagnosis. Discuss results with a clinician.",
    ru: "PHQ-9 — скрининг, а не диагноз. Обсудите результаты со специалистом.",
  },
  phq9_incomplete: { en: "Answer all 9 questions", ru: "Ответьте на все 9 вопросов" },
  gad7_title: {
    en: "GAD-7 anxiety screener",
    ru: "GAD-7 — скрининг тревоги",
  },
  gad7_subtitle: {
    en: "Standardized 7-question anxiety screener. «Over the last 2 weeks…»",
    ru: "Стандартизированный 7-вопросный тест тревожности. «За последние 2 недели…»",
  },
  gad7_q1: {
    en: "Feeling nervous, anxious, or on edge",
    ru: "Чувство нервозности или беспокойства",
  },
  gad7_q2: {
    en: "Not being able to stop or control worrying",
    ru: "Невозможность остановить или контролировать беспокойство",
  },
  gad7_q3: {
    en: "Worrying too much about different things",
    ru: "Слишком сильное беспокойство о разных вещах",
  },
  gad7_q4: { en: "Trouble relaxing", ru: "Трудность расслабиться" },
  gad7_q5: {
    en: "Being so restless that it's hard to sit still",
    ru: "Беспокойство, при котором трудно усидеть на месте",
  },
  gad7_q6: { en: "Becoming easily annoyed or irritable", ru: "Раздражительность" },
  gad7_q7: {
    en: "Feeling afraid as if something awful might happen",
    ru: "Чувство страха, будто может случиться что-то ужасное",
  },
  gad7_result: { en: "Score: {n}/21", ru: "Результат: {n}/21" },
  gad7_sev_minimal: { en: "Minimal", ru: "Минимальная" },
  gad7_sev_mild: { en: "Mild", ru: "Лёгкая" },
  gad7_sev_moderate: { en: "Moderate", ru: "Умеренная" },
  gad7_sev_severe: { en: "Severe", ru: "Тяжёлая" },
  gad7_incomplete: { en: "Answer all 7 questions", ru: "Ответьте на все 7 вопросов" },
  tab_plan: { en: "Plan", ru: "План" },
  plan_title: { en: "Personalized weekly plan", ru: "Персональный план на неделю" },
  plan_subtitle: {
    en: "Auto-generated from your profile, recent logs and screener results. Rule-based — safe defaults.",
    ru: "Сгенерирован из профиля, логов и результатов screener-ов. Rule-based — безопасные defaults.",
  },
  plan_section_goals: { en: "Goals", ru: "Цели" },
  plan_section_routine: { en: "Daily routine", ru: "Дневной режим" },
  plan_section_exercise: { en: "Weekly exercise", ru: "Тренировки в неделю" },
  plan_section_nutrition: { en: "Nutrition", ru: "Питание" },
  plan_section_habits: { en: "Habits", ru: "Привычки" },
  plan_section_mental: { en: "Mental health", ru: "Ментальное здоровье" },
  plan_section_rationale: { en: "Why these choices", ru: "Обоснование" },
  plan_focus: { en: "Focus on", ru: "Налегайте на" },
  plan_avoid: { en: "Limit", ru: "Ограничьте" },
  plan_sample_meals: { en: "Sample meals", ru: "Пример меню" },
  plan_habits_add: { en: "Add", ru: "Добавить" },
  plan_habits_reduce: { en: "Reduce", ru: "Уменьшить" },
  plan_wake: { en: "Wake", ru: "Подъём" },
  plan_sleep_target: { en: "Sleep target", ru: "Целевой сон" },
  plan_water: { en: "Water", ru: "Вода" },
  plan_refresh: { en: "Regenerate plan", ru: "Сгенерировать заново" },
  plan_loading: { en: "Generating…", ru: "Генерирую…" },
  plan_empty: { en: "No plan yet — open this tab to generate one.", ru: "Плана пока нет — откройте вкладку для генерации." },
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

type Tab = "profile" | "check" | "log" | "trends" | "history" | "screener" | "plan";

type Sex = "M" | "F" | "other";

type Profile = {
  id: string;
  userId?: string | null;
  memberLabel?: string | null;
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
  const [memberLabel, setMemberLabel] = useState("");

  // Family
  const [familyProfiles, setFamilyProfiles] = useState<Array<Profile & { bmi: number }>>([]);
  const [hasAuthToken, setHasAuthToken] = useState(false);
  useEffect(() => {
    try {
      setHasAuthToken(!!window.localStorage.getItem(LS_AUTH_TOKEN));
    } catch {}
  }, []);

  // Check draft
  const [symptomsText, setSymptomsText] = useState("");
  const [severity, setSeverity] = useState(5);
  const [durationH, setDurationH] = useState("");
  const [checkNotes, setCheckNotes] = useState("");
  const [lastCheck, setLastCheck] = useState<Check | null>(null);
  const [llmAdvice, setLlmAdvice] = useState<string | null>(null);
  const [llmBusy, setLlmBusy] = useState(false);

  // PHQ-9 state
  const [phq9, setPhq9] = useState<Array<number | null>>(() => Array(9).fill(null));
  const [phq9Result, setPhq9Result] = useState<{
    score: number;
    severity: string;
    suicideFlag: boolean;
    suicideAdvice: string | null;
    advice: string;
    createdAt: string;
  } | null>(null);
  const [phq9Busy, setPhq9Busy] = useState(false);

  // GAD-7 state
  const [gad7, setGad7] = useState<Array<number | null>>(() => Array(7).fill(null));
  const [gad7Result, setGad7Result] = useState<{
    score: number;
    severity: string;
    advice: string;
    createdAt: string;
  } | null>(null);
  const [gad7Busy, setGad7Busy] = useState(false);

  // Plan state
  type Plan = {
    goals: string[];
    dailyRoutine: { wake: string; sleepTarget: string; waterL: number; meals: string[] };
    weeklyExercise: Array<{ type: string; frequency: string; minutes: number }>;
    nutrition: { focus: string[]; avoid: string[]; sampleMeals: string[] };
    habitsToAdd: string[];
    habitsToReduce: string[];
    mentalHealth: string[];
    rationale: string[];
  };
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMeta, setPlanMeta] = useState<{ generatedAt: string } | null>(null);

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

  const loadGad7Last = useCallback(async (profileId: string) => {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/screener/gad7/${profileId}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.last) {
        setGad7Result({
          score: j.last.score,
          severity: j.last.severity,
          advice: "",
          createdAt: j.last.createdAt,
        });
        if (Array.isArray(j.last.answers) && j.last.answers.length === 7) {
          setGad7(j.last.answers);
        }
      }
    } catch {}
  }, []);

  const loadPhq9Last = useCallback(async (profileId: string) => {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/screener/phq9/${profileId}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.last) {
        setPhq9Result({
          score: j.last.score,
          severity: j.last.severity,
          suicideFlag: j.last.suicideFlag,
          suicideAdvice: null,
          advice: "",
          createdAt: j.last.createdAt,
        });
        if (Array.isArray(j.last.answers) && j.last.answers.length === 9) {
          setPhq9(j.last.answers);
        }
      }
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
          setMemberLabel(j.profile.memberLabel || "");
        }
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const loadFamily = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/healthai/profiles/me`, {
        headers: authHeader(),
      });
      if (!r.ok) return;
      const j = await r.json();
      setFamilyProfiles(j.profiles || []);
    } catch {}
  }, []);

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
            loadPhq9Last(stored);
            loadGad7Last(stored);
            void loadFamily();
            setTab("check");
          }
        });
      }
      const t = window.localStorage.getItem(LS_TAB) as Tab | null;
      if (
        t === "profile" ||
        t === "check" ||
        t === "log" ||
        t === "trends" ||
        t === "history" ||
        t === "screener" ||
        t === "plan"
      ) {
        setTab(t);
      }
    } catch {}
  }, [loadProfile, loadHistory, loadTrends, loadRisks, loadPhq9Last, loadGad7Last, loadFamily]);

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
        memberLabel: memberLabel || undefined,
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
        headers: { "Content-Type": "application/json", ...authHeader() },
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
      void loadFamily();
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
      setLlmAdvice(null);
      setChecks((prev) => [j.check, ...prev].slice(0, 30));
      // Сбрасываем форму, оставляя severity на 5.
      setSymptomsText("");
      setDurationH("");
      setCheckNotes("");
    } finally {
      setBusy(false);
    }
  };

  const switchToProfile = (id: string) => {
    profileIdRef.current = id;
    try {
      window.localStorage.setItem(LS_PROFILE_ID, id);
    } catch {}
    void loadProfile(id).then(() => {
      void loadHistory(id);
      void loadTrends(id);
      void loadRisks(id);
      void loadPhq9Last(id);
      void loadGad7Last(id);
      setPlan(null);
      setLastCheck(null);
      setLlmAdvice(null);
    });
  };

  const newFamilyProfile = async () => {
    if (!hasAuthToken) {
      showToast(t("family_no_auth", lang));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/healthai/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ age: 0, sex: "other" }),
      });
      const j = await r.json();
      if (!r.ok || !j.profile) {
        showToast(t("toast_save_failed", lang));
        return;
      }
      void loadFamily();
      switchToProfile(j.profile.id);
    } finally {
      setBusy(false);
    }
  };

  const deleteFamilyProfile = async (id: string) => {
    if (!hasAuthToken) return;
    const r = await fetch(`${BACKEND}/api/healthai/profile/${id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (!r.ok) return;
    void loadFamily();
    if (id === profileIdRef.current) {
      profileIdRef.current = null;
      try {
        window.localStorage.removeItem(LS_PROFILE_ID);
      } catch {}
      setProfile(null);
    }
  };

  const generatePlan = useCallback(async () => {
    if (!profileIdRef.current) return;
    setPlanBusy(true);
    try {
      const r = await fetch(
        `${BACKEND}/api/healthai/plan/${profileIdRef.current}`,
      );
      if (!r.ok) return;
      const j = await r.json();
      if (j.plan) {
        setPlan(j.plan);
        setPlanMeta({ generatedAt: j.generatedAt });
      }
    } finally {
      setPlanBusy(false);
    }
  }, []);

  // Auto-generate при первом открытии Plan tab.
  useEffect(() => {
    if (tab === "plan" && !plan && profileIdRef.current && !planBusy) {
      void generatePlan();
    }
  }, [tab, plan, planBusy, generatePlan]);

  const submitGad7 = async () => {
    if (!profileIdRef.current) {
      showToast(t("toast_no_profile", lang));
      setTab("profile");
      return;
    }
    if (gad7.some((v) => v == null)) {
      showToast(t("gad7_incomplete", lang));
      return;
    }
    setGad7Busy(true);
    try {
      const r = await fetch(`${BACKEND}/api/healthai/screener/gad7`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          answers: gad7,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        showToast(t("toast_check_failed", lang));
        return;
      }
      setGad7Result({
        score: j.score,
        severity: j.severity,
        advice: j.advice,
        createdAt: j.createdAt,
      });
    } finally {
      setGad7Busy(false);
    }
  };

  const submitPhq9 = async () => {
    if (!profileIdRef.current) {
      showToast(t("toast_no_profile", lang));
      setTab("profile");
      return;
    }
    if (phq9.some((v) => v == null)) {
      showToast(t("phq9_incomplete", lang));
      return;
    }
    setPhq9Busy(true);
    try {
      const r = await fetch(`${BACKEND}/api/healthai/screener/phq9`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          answers: phq9,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        showToast(t("toast_check_failed", lang));
        return;
      }
      setPhq9Result({
        score: j.score,
        severity: j.severity,
        suicideFlag: j.suicideFlag,
        suicideAdvice: j.suicideAdvice,
        advice: j.advice,
        createdAt: j.createdAt,
      });
    } finally {
      setPhq9Busy(false);
    }
  };

  const runLlmCheck = async () => {
    if (!profileIdRef.current || !lastCheck) return;
    setLlmBusy(true);
    setLlmAdvice(null);
    try {
      const r = await fetch(`${BACKEND}/api/healthai/check-llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profileIdRef.current,
          symptoms: lastCheck.symptoms,
          severity: lastCheck.severity,
          durationH: lastCheck.durationH,
          notes: lastCheck.notes,
          lang,
        }),
      });
      const j = await r.json();
      if (r.status === 503) {
        showToast(t("llm_not_configured", lang));
        return;
      }
      if (!r.ok || !j.advice) {
        showToast(t("llm_failed", lang));
        return;
      }
      setLlmAdvice(j.advice);
    } finally {
      setLlmBusy(false);
    }
  };

  const importWearables = async (source: "apple-health" | "google-fit") => {
    if (!profileIdRef.current) {
      showToast(t("toast_no_profile", lang));
      setTab("profile");
      return;
    }
    setBusy(true);
    try {
      const today = new Date();
      const entries: Array<{
        date: string;
        sleepHours: number;
        moodScore: number;
        weightKg?: number;
        waterL: number;
        exerciseMin: number;
      }> = [];
      const baseWeight = profile?.weightKg && profile.weightKg > 30 ? profile.weightKg : 70;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        entries.push({
          date,
          sleepHours: Math.round((6 + Math.random() * 3) * 2) / 2,
          moodScore: 4 + Math.floor(Math.random() * 6),
          weightKg: Math.round((baseWeight + (Math.random() - 0.5) * 1.5) * 10) / 10,
          waterL: Math.round((1.2 + Math.random() * 1.8) * 10) / 10,
          exerciseMin: Math.floor(Math.random() * 60) * 5,
        });
      }
      const r = await fetch(`${BACKEND}/api/healthai/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profileIdRef.current, source, entries }),
      });
      const j = await r.json();
      if (!r.ok) {
        showToast(t("toast_log_failed", lang));
        return;
      }
      showToast(t("toast_imported_n", lang, { n: j.imported || 0 }));
      // Полная перезагрузка истории/трендов/рисков.
      void loadHistory(profileIdRef.current);
      void loadTrends(profileIdRef.current);
      void loadRisks(profileIdRef.current);
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
          {(["profile", "check", "log", "trends", "history", "screener", "plan"] as const).map((t) => {
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
                        : t === "history"
                          ? STR.tab_history[lang]
                          : t === "screener"
                            ? STR.tab_screener[lang]
                            : STR.tab_plan[lang]}
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
            <Field label={t("family_member_label", lang)}>
              <input
                type="text"
                placeholder="—"
                value={memberLabel}
                onChange={(e) => setMemberLabel(e.target.value)}
                style={inputStyle}
              />
            </Field>
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

        {tab === "profile" ? (
          <Card>
            <CardHeader
              title={t("family_title", lang)}
              subtitle={t("family_subtitle", lang)}
            />
            {!hasAuthToken ? (
              <div style={emptyStyle}>{t("family_no_auth", lang)}</div>
            ) : (
              <>
                {familyProfiles.length === 0 ? (
                  <div style={emptyStyle}>{t("family_no_profiles", lang)}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {familyProfiles.map((p) => {
                      const isActive = p.id === profile?.id;
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            gap: 8,
                            padding: "8px 10px",
                            background: isActive
                              ? "rgba(94,234,212,0.12)"
                              : "rgba(20,28,46,0.5)",
                            border: isActive
                              ? "1px solid rgba(94,234,212,0.45)"
                              : "1px solid rgba(120,160,220,0.18)",
                            borderRadius: 8,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#e2e8f8",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {p.memberLabel || t("family_self", lang)}
                              {isActive ? (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 9,
                                    color: "#5eead4",
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    fontWeight: 800,
                                  }}
                                >
                                  · {t("family_active", lang)}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {p.age || "?"}y · {p.sex} · BMI {p.bmi || "—"}
                            </div>
                          </div>
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => switchToProfile(p.id)}
                              style={{
                                padding: "4px 10px",
                                background: "rgba(94,234,212,0.18)",
                                color: "#5eead4",
                                border: "1px solid rgba(94,234,212,0.4)",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {t("family_switch", lang)}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => deleteFamilyProfile(p.id)}
                            style={{
                              padding: "4px 8px",
                              background: "rgba(248,113,113,0.12)",
                              color: "#f87171",
                              border: "1px solid rgba(248,113,113,0.3)",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={newFamilyProfile}
                    disabled={busy}
                    style={primaryBtn}
                  >
                    {t("family_add", lang)}
                  </button>
                </div>
              </>
            )}
          </Card>
        ) : null}

        {tab === "profile" && profile ? (
          <Card>
            <CardHeader
              title={t("export_section_title", lang)}
              subtitle={t("export_section_subtitle", lang)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={`/healthai/report?id=${encodeURIComponent(profile.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...primaryBtn,
                  background: "linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {t("btn_print_report", lang)}
              </a>
              <a
                href={`${BACKEND}/api/healthai/export/${encodeURIComponent(profile.id)}`}
                download
                style={{
                  ...primaryBtn,
                  background: "rgba(120,160,220,0.18)",
                  borderColor: "rgba(120,160,220,0.45)",
                  color: "#cbd5e1",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {t("btn_export_json", lang)}
              </a>
            </div>
          </Card>
        ) : null}

        {tab === "profile" && profile ? (
          <Card>
            <CardHeader
              title={t("wearables_title", lang)}
              subtitle={t("wearables_subtitle", lang)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => importWearables("apple-health")}
                disabled={busy}
                style={{
                  ...primaryBtn,
                  background: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)",
                  borderColor: "rgba(248,113,113,0.55)",
                  color: "#fff",
                }}
              >
                {t("wearables_apple", lang)}
              </button>
              <button
                type="button"
                onClick={() => importWearables("google-fit")}
                disabled={busy}
                style={{
                  ...primaryBtn,
                  background: "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)",
                  borderColor: "rgba(96,165,250,0.55)",
                  color: "#fff",
                }}
              >
                {t("wearables_google", lang)}
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

            {lastCheck ? (
              <>
                <CheckCard check={lastCheck} lang={lang} />
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={runLlmCheck}
                    disabled={llmBusy}
                    style={{
                      ...primaryBtn,
                      background:
                        "linear-gradient(180deg, #a855f7 0%, #7e22ce 100%)",
                      borderColor: "rgba(196,181,253,0.55)",
                      color: "#fff",
                    }}
                  >
                    {llmBusy ? t("llm_loading", lang) : t("btn_llm_advice", lang)}
                  </button>
                </div>
                {llmAdvice ? (
                  <Card>
                    <CardHeader
                      title={t("llm_card_title", lang)}
                      subtitle="claude-haiku-4.5"
                    />
                    <div
                      style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap" as const,
                      }}
                    >
                      {llmAdvice}
                    </div>
                  </Card>
                ) : null}
              </>
            ) : null}
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

        {tab === "screener" ? (
          <Card>
            <CardHeader
              title={t("phq9_title", lang)}
              subtitle={t("phq9_subtitle", lang)}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                const qKey = `phq9_q${n}` as const;
                const idx = n - 1;
                const cur = phq9[idx];
                return (
                  <div
                    key={n}
                    style={{
                      padding: 10,
                      background: "rgba(20,28,46,0.5)",
                      border: "1px solid rgba(120,160,220,0.18)",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#cbd5e1",
                        fontWeight: 600,
                        marginBottom: 8,
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 22,
                          height: 22,
                          textAlign: "center",
                          lineHeight: "22px",
                          background: "rgba(94,234,212,0.18)",
                          borderRadius: 11,
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#5eead4",
                          marginRight: 8,
                        }}
                      >
                        {n}
                      </span>
                      {t(qKey, lang)}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {[0, 1, 2, 3].map((opt) => {
                        const active = cur === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const next = [...phq9];
                              next[idx] = opt;
                              setPhq9(next);
                            }}
                            style={{
                              padding: "6px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              background: active
                                ? "rgba(94,234,212,0.24)"
                                : "rgba(8,12,24,0.6)",
                              color: active ? "#5eead4" : "#94a3b8",
                              border: active
                                ? "1px solid rgba(94,234,212,0.55)"
                                : "1px solid rgba(120,160,220,0.18)",
                              borderRadius: 6,
                              cursor: "pointer",
                              flex: "1 1 100px",
                            }}
                          >
                            {opt}. {t(`phq9_opt${opt}`, lang)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={submitPhq9}
                disabled={phq9Busy}
                style={primaryBtn}
              >
                {t("phq9_submit", lang)}
              </button>
            </div>
            {phq9Result ? (
              <div style={{ marginTop: 14 }}>
                {(() => {
                  const sevColor: Record<string, string> = {
                    minimal: "#5eead4",
                    mild: "#7dd3fc",
                    moderate: "#fbbf24",
                    "moderately-severe": "#f97316",
                    severe: "#f87171",
                  };
                  const sevLabel: Record<string, string> = {
                    minimal: t("phq9_sev_minimal", lang),
                    mild: t("phq9_sev_mild", lang),
                    moderate: t("phq9_sev_moderate", lang),
                    "moderately-severe": t("phq9_sev_moderately_severe", lang),
                    severe: t("phq9_sev_severe", lang),
                  };
                  const c = sevColor[phq9Result.severity] || "#94a3b8";
                  return (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: `${c}10`,
                        border: `1px solid ${c}55`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 12,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontSize: 22, fontWeight: 900, color: c }}>
                          {t("phq9_result", lang, { n: phq9Result.score })}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#cbd5e1",
                          }}
                        >
                          · {sevLabel[phq9Result.severity]}
                        </div>
                      </div>
                      {phq9Result.advice ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#cbd5e1",
                            lineHeight: 1.5,
                            marginBottom: 10,
                          }}
                        >
                          {phq9Result.advice}
                        </div>
                      ) : null}
                      {phq9Result.suicideFlag ? (
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: "rgba(248,113,113,0.18)",
                            border: "1px solid rgba(248,113,113,0.55)",
                            marginTop: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#fecaca",
                              marginBottom: 4,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                            }}
                          >
                            ⚠ {t("phq9_suicide_warning", lang)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#fecaca",
                              lineHeight: 1.55,
                            }}
                          >
                            {phq9Result.suicideAdvice ||
                              "Q9 > 0 — необходима неотложная консультация специалиста."}
                          </div>
                        </div>
                      ) : null}
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 10,
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        {t("phq9_disclaimer_short", lang)} ·{" "}
                        {new Date(phq9Result.createdAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </Card>
        ) : null}

        {tab === "screener" ? (
          <Card>
            <CardHeader
              title={t("gad7_title", lang)}
              subtitle={t("gad7_subtitle", lang)}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                const qKey = `gad7_q${n}` as const;
                const idx = n - 1;
                const cur = gad7[idx];
                return (
                  <div
                    key={n}
                    style={{
                      padding: 10,
                      background: "rgba(20,28,46,0.5)",
                      border: "1px solid rgba(120,160,220,0.18)",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#cbd5e1",
                        fontWeight: 600,
                        marginBottom: 8,
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 22,
                          height: 22,
                          textAlign: "center",
                          lineHeight: "22px",
                          background: "rgba(165,180,252,0.18)",
                          borderRadius: 11,
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#a5b4fc",
                          marginRight: 8,
                        }}
                      >
                        {n}
                      </span>
                      {t(qKey, lang)}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {[0, 1, 2, 3].map((opt) => {
                        const active = cur === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const next = [...gad7];
                              next[idx] = opt;
                              setGad7(next);
                            }}
                            style={{
                              padding: "6px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              background: active
                                ? "rgba(165,180,252,0.24)"
                                : "rgba(8,12,24,0.6)",
                              color: active ? "#a5b4fc" : "#94a3b8",
                              border: active
                                ? "1px solid rgba(165,180,252,0.55)"
                                : "1px solid rgba(120,160,220,0.18)",
                              borderRadius: 6,
                              cursor: "pointer",
                              flex: "1 1 100px",
                            }}
                          >
                            {opt}. {t(`phq9_opt${opt}`, lang)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={submitGad7}
                disabled={gad7Busy}
                style={primaryBtn}
              >
                {t("phq9_submit", lang)}
              </button>
            </div>
            {gad7Result ? (
              <div style={{ marginTop: 14 }}>
                {(() => {
                  const sevColor: Record<string, string> = {
                    minimal: "#5eead4",
                    mild: "#7dd3fc",
                    moderate: "#fbbf24",
                    severe: "#f87171",
                  };
                  const sevLabel: Record<string, string> = {
                    minimal: t("gad7_sev_minimal", lang),
                    mild: t("gad7_sev_mild", lang),
                    moderate: t("gad7_sev_moderate", lang),
                    severe: t("gad7_sev_severe", lang),
                  };
                  const c = sevColor[gad7Result.severity] || "#94a3b8";
                  return (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: `${c}10`,
                        border: `1px solid ${c}55`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 12,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontSize: 22, fontWeight: 900, color: c }}>
                          {t("gad7_result", lang, { n: gad7Result.score })}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#cbd5e1",
                          }}
                        >
                          · {sevLabel[gad7Result.severity]}
                        </div>
                      </div>
                      {gad7Result.advice ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#cbd5e1",
                            lineHeight: 1.5,
                          }}
                        >
                          {gad7Result.advice}
                        </div>
                      ) : null}
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 10,
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        {t("phq9_disclaimer_short", lang)} ·{" "}
                        {new Date(gad7Result.createdAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </Card>
        ) : null}

        {tab === "plan" ? (
          <Card>
            <CardHeader
              title={t("plan_title", lang)}
              subtitle={t("plan_subtitle", lang)}
            />
            {!plan && planBusy ? (
              <div style={emptyStyle}>{t("plan_loading", lang)}</div>
            ) : !plan ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={emptyStyle}>{t("plan_empty", lang)}</div>
                <button type="button" onClick={generatePlan} disabled={planBusy} style={primaryBtn}>
                  {t("plan_refresh", lang)}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={generatePlan}
                    disabled={planBusy}
                    style={{
                      ...primaryBtn,
                      background: "rgba(120,160,220,0.18)",
                      color: "#cbd5e1",
                      borderColor: "rgba(120,160,220,0.45)",
                    }}
                  >
                    🔄 {t("plan_refresh", lang)}
                  </button>
                </div>

                {plan.goals.length > 0 ? (
                  <PlanSection title={t("plan_section_goals", lang)} accent="#5eead4">
                    {plan.goals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </PlanSection>
                ) : null}

                <PlanSection title={t("plan_section_routine", lang)} accent="#7dd3fc">
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>
                    <div>🌅 <b>{t("plan_wake", lang)}:</b> {plan.dailyRoutine.wake}</div>
                    <div>🌙 <b>{t("plan_sleep_target", lang)}:</b> {plan.dailyRoutine.sleepTarget}</div>
                    <div>💧 <b>{t("plan_water", lang)}:</b> {plan.dailyRoutine.waterL} L</div>
                  </div>
                </PlanSection>

                {plan.weeklyExercise.length > 0 ? (
                  <PlanSection title={t("plan_section_exercise", lang)} accent="#fbbf24">
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {plan.weeklyExercise.map((e, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            background: "rgba(20,28,46,0.6)",
                            borderRadius: 6,
                            border: "1px solid rgba(120,160,220,0.16)",
                            fontSize: 13,
                          }}
                        >
                          <span style={{ color: "#e2e8f8", fontWeight: 600 }}>{e.type}</span>
                          <span style={{ color: "#94a3b8" }}>
                            {e.frequency} · {e.minutes} мин
                          </span>
                        </div>
                      ))}
                    </div>
                  </PlanSection>
                ) : null}

                <PlanSection title={t("plan_section_nutrition", lang)} accent="#f472b6">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#5eead4", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                        ✓ {t("plan_focus", lang)}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                        {plan.nutrition.focus.map((s, i) => (<li key={i}>{s}</li>))}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#f87171", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                        ✗ {t("plan_avoid", lang)}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                        {plan.nutrition.avoid.map((s, i) => (<li key={i}>{s}</li>))}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                        🍽 {t("plan_sample_meals", lang)}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                        {plan.nutrition.sampleMeals.map((s, i) => (<li key={i}>{s}</li>))}
                      </ul>
                    </div>
                  </div>
                </PlanSection>

                <PlanSection title={t("plan_section_habits", lang)} accent="#a5b4fc">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {plan.habitsToAdd.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#5eead4", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                          + {t("plan_habits_add", lang)}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {plan.habitsToAdd.map((s, i) => (<li key={i}>{s}</li>))}
                        </ul>
                      </div>
                    ) : null}
                    {plan.habitsToReduce.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#f87171", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                          − {t("plan_habits_reduce", lang)}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {plan.habitsToReduce.map((s, i) => (<li key={i}>{s}</li>))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </PlanSection>

                {plan.mentalHealth.length > 0 ? (
                  <PlanSection title={t("plan_section_mental", lang)} accent="#c084fc">
                    {plan.mentalHealth.map((s, i) => (<li key={i}>{s}</li>))}
                  </PlanSection>
                ) : null}

                {plan.rationale.length > 0 ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 10,
                      background: "rgba(20,28,46,0.5)",
                      border: "1px solid rgba(120,160,220,0.18)",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                      {t("plan_section_rationale", lang)}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                      {plan.rationale.map((s, i) => (<li key={i}>{s}</li>))}
                    </ul>
                  </div>
                ) : null}
                {planMeta ? (
                  <div style={{ marginTop: 10, fontSize: 10, color: "#94a3b8", fontStyle: "italic", textAlign: "right" }}>
                    {new Date(planMeta.generatedAt).toLocaleString()}
                  </div>
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

function PlanSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  // Если children — узлы <li>, оборачиваем их в <ul>; иначе рендерим как есть.
  const arr = Array.isArray(children) ? children : [children];
  const allLi = arr.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      "type" in (c as { type?: unknown }) &&
      (c as { type?: unknown }).type === "li",
  );
  return (
    <div style={{ marginBottom: 14 }}>
      <h3
        style={{
          margin: "0 0 6px",
          fontSize: 12,
          fontWeight: 800,
          color: accent,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      {allLi ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            fontSize: 13,
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          {children}
        </ul>
      ) : (
        children
      )}
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
