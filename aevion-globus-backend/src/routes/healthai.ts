import { Router, type Request, type Response } from "express";
import crypto from "crypto";

/**
 * HealthAI v1 — Personal AI Doctor MVP.
 *
 * In-memory storage. No DB yet, no real LLM yet — symptom advice через
 * rule-based mapping ключевых слов на советы. Это безопасный MVP, который
 * не претендует на медицинский диагноз (см. disclaimer).
 *
 * Endpoints:
 *  POST /profile           — register / update health profile
 *  GET  /profile/:id       — fetch profile
 *  POST /check             — symptom check, returns advice
 *  POST /log               — daily wellness log entry
 *  GET  /history/:id       — list of advice + log entries
 *  GET  /trends/:id        — 7d/30d averages and series
 *  GET  /leaderboard       — wellness streaks (по числу логов подряд)
 *  GET  /health            — status
 */

export const healthaiRouter = Router();

type HealthProfile = {
  id: string;
  age: number;
  sex: "M" | "F" | "other";
  heightCm: number;
  weightKg: number;
  conditions: string[];
  allergies: string[];
  medications: string[];
  createdAt: string;
  updatedAt: string;
};

type AdviceMatch = {
  keyword: string;
  advice: string;
  urgency: "self-care" | "consult" | "urgent";
};

type SymptomCheck = {
  id: string;
  profileId: string;
  symptoms: string[];
  severity: number;
  durationH: number;
  notes?: string;
  matched: AdviceMatch[];
  generic: string;
  disclaimer: string;
  createdAt: string;
};

type DailyLog = {
  id: string;
  profileId: string;
  date: string;
  sleepHours?: number;
  moodScore?: number;
  weightKg?: number;
  waterL?: number;
  exerciseMin?: number;
  notes?: string;
  createdAt: string;
};

const profiles = new Map<string, HealthProfile>();
const checks = new Map<string, SymptomCheck[]>();
const logs = new Map<string, DailyLog[]>();

const DISCLAIMER =
  "Это образовательный совет AI-помощника, а не медицинский диагноз. " +
  "При тревожных симптомах обязательно обратитесь к врачу.";

/**
 * Rule-based knowledge base. Каждый matcher — массив ключевых слов
 * (русский+английский), привязанные к одному совету.
 */
const ADVICE_RULES: Array<{
  match: string[];
  advice: string;
  urgency: "self-care" | "consult" | "urgent";
  keyword: string;
}> = [
  {
    keyword: "headache",
    match: ["headache", "head pain", "головная боль", "болит голова", "мигрень"],
    advice:
      "Чаще всего — обезвоживание, напряжение шеи или недосып. " +
      "Выпейте 300-500мл воды, проветрите помещение, сделайте паузу от экрана. " +
      "Если боль резкая, нарастает, сопровождается рвотой или спутанностью — " +
      "обратитесь за неотложной помощью.",
    urgency: "self-care",
  },
  {
    keyword: "fever",
    match: ["fever", "температура", "жар", "озноб", "лихорадка"],
    advice:
      "Измерьте температуру. До 38°C — обильное питьё, отдых. " +
      "Выше 38.5°C, держится >2 дней или сопровождается одышкой/болью в груди " +
      "— показан очный осмотр врача.",
    urgency: "consult",
  },
  {
    keyword: "cough",
    match: ["cough", "кашель", "горло", "першит"],
    advice:
      "Тёплое питьё с мёдом или имбирём, увлажнение воздуха. " +
      "Сухой кашель >7 дней или с кровью — нужна консультация врача " +
      "и, возможно, рентген лёгких.",
    urgency: "self-care",
  },
  {
    keyword: "chest-pain",
    match: ["chest pain", "боль в груди", "давит грудь", "грудная боль"],
    advice:
      "ВАЖНО: давящая боль в груди, особенно отдающая в руку/челюсть, " +
      "одышка, холодный пот — возможный сердечный приступ. " +
      "Немедленно вызывайте скорую (112).",
    urgency: "urgent",
  },
  {
    keyword: "nausea",
    match: ["nausea", "тошнота", "рвота", "тошнит"],
    advice:
      "Малыми глотками воду или электролиты. Рисовый отвар, тосты. " +
      "Если рвота >24ч или с кровью/жёлчью — звоните врачу.",
    urgency: "consult",
  },
  {
    keyword: "fatigue",
    match: ["fatigue", "усталость", "слабость", "нет сил", "выгорание"],
    advice:
      "Проверьте сон (7-9ч), уровень железа и витамина D. " +
      "Хроническая усталость >2 недель — повод сдать общий анализ крови.",
    urgency: "consult",
  },
  {
    keyword: "anxiety",
    match: ["anxiety", "тревога", "паника", "беспокойство", "stress"],
    advice:
      "Дыхание 4-7-8 (вдох 4с, задержка 7с, выдох 8с) три раунда. " +
      "Прогулка 20 мин, ограничьте кофеин и новости. " +
      "Если эпизоды повторяются — поможет КПТ или психотерапевт.",
    urgency: "self-care",
  },
  {
    keyword: "insomnia",
    match: ["insomnia", "бессонница", "не могу уснуть", "плохо сплю"],
    advice:
      "Гигиена сна: тёмная прохладная спальня, экраны off за 60 мин до сна, " +
      "магний на ночь, фиксированное время подъёма. " +
      "Если >2 недель без эффекта — консультация сомнолога.",
    urgency: "self-care",
  },
  {
    keyword: "back-pain",
    match: ["back pain", "боль в спине", "поясница", "сорвал спину"],
    advice:
      "Тёплый душ, лёгкая растяжка (cat-cow). Избегайте долгого сидения. " +
      "Острая боль с онемением ноги — срочно к неврологу.",
    urgency: "consult",
  },
  {
    keyword: "shortness-of-breath",
    match: [
      "shortness of breath",
      "одышка",
      "тяжело дышать",
      "не хватает воздуха",
    ],
    advice:
      "ВАЖНО: внезапная сильная одышка, особенно в покое или с болью в груди — " +
      "немедленно скорая. Если одышка появляется только при нагрузке и нарастает — " +
      "консультация кардиолога/пульмонолога.",
    urgency: "urgent",
  },
];

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function classifySymptoms(symptoms: string[]): {
  matched: AdviceMatch[];
  generic: string;
} {
  const lower = symptoms.map((s) => s.toLowerCase().trim());
  const matched: AdviceMatch[] = [];
  const seen = new Set<string>();
  for (const s of lower) {
    for (const rule of ADVICE_RULES) {
      if (seen.has(rule.keyword)) continue;
      if (rule.match.some((k) => s.includes(k))) {
        matched.push({
          keyword: rule.keyword,
          advice: rule.advice,
          urgency: rule.urgency,
        });
        seen.add(rule.keyword);
      }
    }
  }
  const generic =
    matched.length === 0
      ? "Опишите симптомы подробнее: что именно беспокоит, как давно, " +
        "что ухудшает или облегчает. Если симптомы тревожные или длятся " +
        "более нескольких дней — обратитесь к врачу."
      : matched.some((m) => m.urgency === "urgent")
        ? "Среди ваших симптомов есть признаки, требующие срочной помощи. " +
          "Не откладывайте обращение в скорую."
        : "Если симптомы сохранятся или усилятся — запишитесь на приём.";
  return { matched, generic };
}

function bmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

healthaiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AEVION HealthAI",
    profilesCount: profiles.size,
    rulesCount: ADVICE_RULES.length,
    timestamp: nowIso(),
  });
});

healthaiRouter.post("/profile", (req: Request, res: Response) => {
  const body = req.body || {};
  const id = body.id || newId("hp");
  const existing = profiles.get(id);

  const profile: HealthProfile = {
    id,
    age: Number(body.age) || existing?.age || 0,
    sex: ["M", "F", "other"].includes(body.sex)
      ? body.sex
      : existing?.sex || "other",
    heightCm: Number(body.heightCm) || existing?.heightCm || 0,
    weightKg: Number(body.weightKg) || existing?.weightKg || 0,
    conditions: Array.isArray(body.conditions)
      ? body.conditions.map(String)
      : existing?.conditions || [],
    allergies: Array.isArray(body.allergies)
      ? body.allergies.map(String)
      : existing?.allergies || [],
    medications: Array.isArray(body.medications)
      ? body.medications.map(String)
      : existing?.medications || [],
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  profiles.set(id, profile);
  res.json({
    profile,
    bmi: bmi(profile.heightCm, profile.weightKg),
    isNew: !existing,
  });
});

healthaiRouter.get("/profile/:id", (req: Request, res: Response) => {
  const profile = profiles.get(req.params.id);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });
  res.json({
    profile,
    bmi: bmi(profile.heightCm, profile.weightKg),
  });
});

healthaiRouter.post("/check", (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms.map(String) : [];
  if (symptoms.length === 0) {
    return res.status(400).json({ error: "symptoms-empty" });
  }
  const severity = Math.max(1, Math.min(10, Number(body.severity) || 5));
  const durationH = Math.max(0, Number(body.durationH) || 0);

  const { matched, generic } = classifySymptoms(symptoms);

  const check: SymptomCheck = {
    id: newId("chk"),
    profileId: body.profileId,
    symptoms,
    severity,
    durationH,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
    matched,
    generic,
    disclaimer: DISCLAIMER,
    createdAt: nowIso(),
  };

  const list = checks.get(body.profileId) || [];
  list.unshift(check);
  if (list.length > 200) list.length = 200;
  checks.set(body.profileId, list);

  res.json({ check });
});

healthaiRouter.post("/log", (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : todayDate();

  const log: DailyLog = {
    id: newId("log"),
    profileId: body.profileId,
    date,
    sleepHours:
      body.sleepHours != null ? Number(body.sleepHours) : undefined,
    moodScore:
      body.moodScore != null
        ? Math.max(1, Math.min(10, Number(body.moodScore)))
        : undefined,
    weightKg: body.weightKg != null ? Number(body.weightKg) : undefined,
    waterL: body.waterL != null ? Number(body.waterL) : undefined,
    exerciseMin:
      body.exerciseMin != null ? Number(body.exerciseMin) : undefined,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
    createdAt: nowIso(),
  };

  const list = logs.get(body.profileId) || [];
  // Если за этот же date уже есть запись — заменяем (last wins).
  const idx = list.findIndex((l) => l.date === date);
  if (idx >= 0) list[idx] = log;
  else list.unshift(log);
  if (list.length > 365) list.length = 365;
  logs.set(body.profileId, list);

  res.json({ log });
});

healthaiRouter.get("/history/:id", (req: Request, res: Response) => {
  const profileId = req.params.id;
  const cks = checks.get(profileId) || [];
  const lgs = logs.get(profileId) || [];
  res.json({ checks: cks.slice(0, 20), logs: lgs.slice(0, 90) });
});

healthaiRouter.get("/trends/:id", (req: Request, res: Response) => {
  const profileId = req.params.id;
  const lgs = logs.get(profileId) || [];
  if (lgs.length === 0) {
    return res.json({
      avg7d: null,
      avg30d: null,
      series: [],
      streak: 0,
    });
  }

  const sorted = [...lgs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last7 = sorted.slice(-7);
  const last30 = sorted.slice(-30);

  const avg = (rows: DailyLog[], pick: (l: DailyLog) => number | undefined) => {
    const vals = rows.map(pick).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return Math.round(
      (vals.reduce((s, v) => s + v, 0) / vals.length) * 100,
    ) / 100;
  };

  const series = sorted.map((l) => ({
    date: l.date,
    sleepHours: l.sleepHours ?? null,
    moodScore: l.moodScore ?? null,
    weightKg: l.weightKg ?? null,
  }));

  // Streak: самая длинная цепочка последовательных дней с любым логом.
  let streak = 0;
  let cur = 0;
  let prevDate: Date | null = null;
  for (const l of sorted) {
    const d = new Date(l.date + "T00:00:00Z");
    if (
      prevDate &&
      Math.abs(d.getTime() - prevDate.getTime()) === 24 * 3600 * 1000
    ) {
      cur += 1;
    } else {
      cur = 1;
    }
    if (cur > streak) streak = cur;
    prevDate = d;
  }

  res.json({
    avg7d: {
      sleep: avg(last7, (l) => l.sleepHours),
      mood: avg(last7, (l) => l.moodScore),
      weight: avg(last7, (l) => l.weightKg),
      water: avg(last7, (l) => l.waterL),
      exercise: avg(last7, (l) => l.exerciseMin),
    },
    avg30d: {
      sleep: avg(last30, (l) => l.sleepHours),
      mood: avg(last30, (l) => l.moodScore),
      weight: avg(last30, (l) => l.weightKg),
      water: avg(last30, (l) => l.waterL),
      exercise: avg(last30, (l) => l.exerciseMin),
    },
    series,
    streak,
  });
});

healthaiRouter.get("/leaderboard", (_req, res) => {
  const board: Array<{ profileId: string; streak: number; logs: number }> = [];
  for (const [profileId, lgs] of logs) {
    const sorted = [...lgs].sort((a, b) => (a.date < b.date ? -1 : 1));
    let streak = 0;
    let cur = 0;
    let prevDate: Date | null = null;
    for (const l of sorted) {
      const d = new Date(l.date + "T00:00:00Z");
      if (
        prevDate &&
        Math.abs(d.getTime() - prevDate.getTime()) === 24 * 3600 * 1000
      ) {
        cur += 1;
      } else {
        cur = 1;
      }
      if (cur > streak) streak = cur;
      prevDate = d;
    }
    board.push({ profileId, streak, logs: lgs.length });
  }
  board.sort((a, b) => b.streak - a.streak || b.logs - a.logs);
  res.json({ leaderboard: board.slice(0, 20) });
});
