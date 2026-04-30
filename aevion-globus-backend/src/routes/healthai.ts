import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { verifyBearerOptional } from "../lib/authJwt";

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
  userId?: string | null;
  memberLabel?: string | null;
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

type CycleEntry = {
  id: string;
  profileId: string;
  date: string;
  flow?: string;
  symptoms: string[];
  notes?: string;
  createdAt: string;
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

const profilesMem = new Map<string, HealthProfile>();
const checksMem = new Map<string, SymptomCheck[]>();
const logsMem = new Map<string, DailyLog[]>();
const cyclesMem = new Map<string, CycleEntry[]>();
const planSnapshotsMem = new Map<string, any[]>();

/**
 * Hybrid store: Prisma если есть DATABASE_URL и таблицы доступны, иначе
 * in-memory Maps. Init выполняется лениво при первом use, чтобы не
 * падать на старте если БД ещё не готова.
 */
let prisma: PrismaClient | null = null;
let useDb = false;
let dbInitTried = false;

async function ensureDb() {
  if (dbInitTried) return;
  dbInitTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[HealthAI] DATABASE_URL absent — in-memory mode");
    return;
  }
  try {
    const p = new PrismaClient();
    await p.healthProfile.findFirst();
    prisma = p;
    useDb = true;
    console.log("[HealthAI] Prisma persistence enabled");
  } catch (e) {
    console.warn(
      "[HealthAI] Prisma init failed, fallback in-memory:",
      e instanceof Error ? e.message : e,
    );
  }
}
void ensureDb();

function rowToProfile(r: any): HealthProfile {
  return {
    id: r.id,
    userId: r.userId ?? null,
    memberLabel: r.memberLabel ?? null,
    age: r.age,
    sex: r.sex,
    heightCm: r.heightCm,
    weightKg: Number(r.weightKg),
    conditions: r.conditions || [],
    allergies: r.allergies || [],
    medications: r.medications || [],
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt:
      r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  };
}

function rowToCheck(r: any): SymptomCheck {
  return {
    id: r.id,
    profileId: r.profileId,
    symptoms: r.symptoms || [],
    severity: r.severity,
    durationH: Number(r.durationH),
    notes: r.notes ?? undefined,
    matched: typeof r.matched === "string" ? JSON.parse(r.matched) : r.matched,
    generic: r.generic || "",
    disclaimer: r.disclaimer || DISCLAIMER,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

function rowToCycle(r: any): CycleEntry {
  return {
    id: r.id,
    profileId: r.profileId,
    date: r.date,
    flow: r.flow ?? undefined,
    symptoms: r.symptoms || [],
    notes: r.notes ?? undefined,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

function rowToLog(r: any): DailyLog {
  return {
    id: r.id,
    profileId: r.profileId,
    date: r.date,
    sleepHours: r.sleepHours == null ? undefined : Number(r.sleepHours),
    moodScore: r.moodScore ?? undefined,
    weightKg: r.weightKg == null ? undefined : Number(r.weightKg),
    waterL: r.waterL == null ? undefined : Number(r.waterL),
    exerciseMin: r.exerciseMin ?? undefined,
    notes: r.notes ?? undefined,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

const store = {
  async getProfile(id: string): Promise<HealthProfile | null> {
    await ensureDb();
    if (useDb && prisma) {
      const r = await prisma.healthProfile.findUnique({ where: { id } });
      return r ? rowToProfile(r) : null;
    }
    return profilesMem.get(id) || null;
  },
  async upsertProfile(p: HealthProfile): Promise<HealthProfile> {
    await ensureDb();
    if (useDb && prisma) {
      const r = await prisma.healthProfile.upsert({
        where: { id: p.id },
        update: {
          userId: p.userId ?? null,
          memberLabel: p.memberLabel ?? null,
          age: p.age,
          sex: p.sex,
          heightCm: p.heightCm,
          weightKg: p.weightKg,
          conditions: p.conditions,
          allergies: p.allergies,
          medications: p.medications,
        },
        create: {
          id: p.id,
          userId: p.userId ?? null,
          memberLabel: p.memberLabel ?? null,
          age: p.age,
          sex: p.sex,
          heightCm: p.heightCm,
          weightKg: p.weightKg,
          conditions: p.conditions,
          allergies: p.allergies,
          medications: p.medications,
        },
      });
      return rowToProfile(r);
    }
    profilesMem.set(p.id, p);
    return p;
  },
  async listProfilesByUser(userId: string): Promise<HealthProfile[]> {
    await ensureDb();
    if (useDb && prisma) {
      const rows = await prisma.healthProfile.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(rowToProfile);
    }
    return Array.from(profilesMem.values()).filter((p) => p.userId === userId);
  },
  async deleteProfile(id: string): Promise<boolean> {
    await ensureDb();
    if (useDb && prisma) {
      try {
        await prisma.healthProfile.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    }
    return profilesMem.delete(id);
  },
  async getChecks(profileId: string, limit = 200): Promise<SymptomCheck[]> {
    await ensureDb();
    if (useDb && prisma) {
      const rows = await prisma.symptomCheck.findMany({
        where: { profileId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(rowToCheck);
    }
    return (checksMem.get(profileId) || []).slice(0, limit);
  },
  async addCheck(c: SymptomCheck): Promise<void> {
    await ensureDb();
    if (useDb && prisma) {
      await prisma.symptomCheck.create({
        data: {
          id: c.id,
          profileId: c.profileId,
          symptoms: c.symptoms,
          severity: c.severity,
          durationH: c.durationH,
          notes: c.notes,
          matched: c.matched as any,
          generic: c.generic,
          disclaimer: c.disclaimer,
        },
      });
      return;
    }
    const list = checksMem.get(c.profileId) || [];
    list.unshift(c);
    if (list.length > 200) list.length = 200;
    checksMem.set(c.profileId, list);
  },
  async getLogs(profileId: string, limit = 365): Promise<DailyLog[]> {
    await ensureDb();
    if (useDb && prisma) {
      const rows = await prisma.healthDailyLog.findMany({
        where: { profileId },
        orderBy: { date: "desc" },
        take: limit,
      });
      return rows.map(rowToLog);
    }
    return (logsMem.get(profileId) || []).slice(0, limit);
  },
  async upsertLog(l: DailyLog): Promise<DailyLog> {
    await ensureDb();
    if (useDb && prisma) {
      const r = await prisma.healthDailyLog.upsert({
        where: {
          profileId_date: { profileId: l.profileId, date: l.date },
        },
        update: {
          sleepHours: l.sleepHours,
          moodScore: l.moodScore,
          weightKg: l.weightKg,
          waterL: l.waterL,
          exerciseMin: l.exerciseMin,
          notes: l.notes,
        },
        create: {
          id: l.id,
          profileId: l.profileId,
          date: l.date,
          sleepHours: l.sleepHours,
          moodScore: l.moodScore,
          weightKg: l.weightKg,
          waterL: l.waterL,
          exerciseMin: l.exerciseMin,
          notes: l.notes,
        },
      });
      return rowToLog(r);
    }
    const list = logsMem.get(l.profileId) || [];
    const idx = list.findIndex((x) => x.date === l.date);
    if (idx >= 0) list[idx] = l;
    else list.unshift(l);
    if (list.length > 365) list.length = 365;
    logsMem.set(l.profileId, list);
    return l;
  },
  async getCycles(profileId: string, limit = 365): Promise<CycleEntry[]> {
    await ensureDb();
    if (useDb && prisma) {
      const rows = await prisma.cycleEntry.findMany({
        where: { profileId },
        orderBy: { date: "desc" },
        take: limit,
      });
      return rows.map(rowToCycle);
    }
    return (cyclesMem.get(profileId) || []).slice(0, limit);
  },
  async upsertCycle(c: CycleEntry): Promise<CycleEntry> {
    await ensureDb();
    if (useDb && prisma) {
      const r = await prisma.cycleEntry.upsert({
        where: { profileId_date: { profileId: c.profileId, date: c.date } },
        update: { flow: c.flow, symptoms: c.symptoms, notes: c.notes },
        create: {
          id: c.id,
          profileId: c.profileId,
          date: c.date,
          flow: c.flow,
          symptoms: c.symptoms,
          notes: c.notes,
        },
      });
      return rowToCycle(r);
    }
    const list = cyclesMem.get(c.profileId) || [];
    const idx = list.findIndex((x) => x.date === c.date);
    if (idx >= 0) list[idx] = c;
    else list.unshift(c);
    cyclesMem.set(c.profileId, list);
    return c;
  },
  async addPlanSnapshot(s: {
    id: string;
    profileId: string;
    plan: unknown;
    bmi?: number | null;
    avgSleep7d?: number | null;
    avgMood7d?: number | null;
    generatedAt: string;
  }): Promise<void> {
    await ensureDb();
    if (useDb && prisma) {
      await prisma.planSnapshot.create({
        data: {
          id: s.id,
          profileId: s.profileId,
          plan: s.plan as any,
          bmi: s.bmi ?? null,
          avgSleep7d: s.avgSleep7d ?? null,
          avgMood7d: s.avgMood7d ?? null,
          generatedAt: new Date(s.generatedAt),
        },
      });
      return;
    }
    const list = planSnapshotsMem.get(s.profileId) || [];
    list.unshift(s as any);
    if (list.length > 50) list.length = 50;
    planSnapshotsMem.set(s.profileId, list);
  },
  async listPlanSnapshots(profileId: string, limit = 30): Promise<any[]> {
    await ensureDb();
    if (useDb && prisma) {
      const rows = await prisma.planSnapshot.findMany({
        where: { profileId },
        orderBy: { generatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        profileId: r.profileId,
        plan: r.plan,
        bmi: r.bmi == null ? null : Number(r.bmi),
        avgSleep7d: r.avgSleep7d == null ? null : Number(r.avgSleep7d),
        avgMood7d: r.avgMood7d == null ? null : Number(r.avgMood7d),
        generatedAt:
          r.generatedAt instanceof Date
            ? r.generatedAt.toISOString()
            : r.generatedAt,
      }));
    }
    return (planSnapshotsMem.get(profileId) || []).slice(0, limit);
  },
  async getPlanSnapshot(id: string): Promise<any | null> {
    await ensureDb();
    if (useDb && prisma) {
      const r = await prisma.planSnapshot.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id,
        profileId: r.profileId,
        plan: r.plan,
        bmi: r.bmi == null ? null : Number(r.bmi),
        avgSleep7d: r.avgSleep7d == null ? null : Number(r.avgSleep7d),
        avgMood7d: r.avgMood7d == null ? null : Number(r.avgMood7d),
        generatedAt:
          r.generatedAt instanceof Date
            ? r.generatedAt.toISOString()
            : r.generatedAt,
      };
    }
    for (const list of planSnapshotsMem.values()) {
      const found = list.find((x) => x.id === id);
      if (found) return found;
    }
    return null;
  },
  async allProfileIdsWithLogs(): Promise<string[]> {
    await ensureDb();
    if (useDb && prisma) {
      const rows = await prisma.healthDailyLog.groupBy({
        by: ["profileId"],
      });
      return rows.map((r) => r.profileId);
    }
    return Array.from(logsMem.keys());
  },
};

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

function round(n: number, decimals = 1): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

healthaiRouter.get("/health", async (_req, res) => {
  await ensureDb();
  res.json({
    status: "ok",
    service: "AEVION HealthAI",
    persistence: useDb ? "prisma" : "in-memory",
    profilesCount: useDb && prisma
      ? await prisma.healthProfile.count()
      : profilesMem.size,
    rulesCount: ADVICE_RULES.length,
    timestamp: nowIso(),
  });
});

healthaiRouter.post("/profile", async (req: Request, res: Response) => {
  const body = req.body || {};
  const id = body.id || newId("hp");
  const existing = await store.getProfile(id);
  const auth = verifyBearerOptional(req);

  // Если профиль уже принадлежит другому юзеру — отказать (если предъявлен токен).
  if (existing?.userId && auth?.sub && existing.userId !== auth.sub) {
    return res.status(403).json({ error: "profile-belongs-to-another-user" });
  }

  const profile: HealthProfile = {
    id,
    userId: existing?.userId ?? (auth?.sub ?? null),
    memberLabel:
      typeof body.memberLabel === "string"
        ? body.memberLabel.slice(0, 80)
        : existing?.memberLabel ?? null,
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

  const saved = await store.upsertProfile(profile);
  res.json({
    profile: saved,
    bmi: bmi(saved.heightCm, saved.weightKg),
    isNew: !existing,
  });
});

healthaiRouter.get("/profiles/me", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth-required" });
  const profiles = await store.listProfilesByUser(auth.sub);
  res.json({
    profiles: profiles.map((p) => ({
      ...p,
      bmi: bmi(p.heightCm, p.weightKg),
    })),
  });
});

healthaiRouter.delete("/profile/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth-required" });
  const profile = await store.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });
  if (profile.userId !== auth.sub) {
    return res.status(403).json({ error: "not-profile-owner" });
  }
  const ok = await store.deleteProfile(req.params.id);
  res.json({ ok });
});

healthaiRouter.get("/profile/:id", async (req: Request, res: Response) => {
  const profile = await store.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });
  res.json({
    profile,
    bmi: bmi(profile.heightCm, profile.weightKg),
  });
});

healthaiRouter.post("/check", async (req: Request, res: Response) => {
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

  await store.addCheck(check);
  res.json({ check });
});

healthaiRouter.post("/log", async (req: Request, res: Response) => {
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

  const saved = await store.upsertLog(log);
  res.json({ log: saved });
});

healthaiRouter.get("/history/:id", async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const cks = await store.getChecks(profileId, 20);
  const lgs = await store.getLogs(profileId, 90);
  res.json({ checks: cks, logs: lgs });
});

healthaiRouter.get("/trends/:id", async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const lgs = await store.getLogs(profileId);
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

/**
 * LLM provider chain: Anthropic → OpenAI → Gemini. Каждый со одинаковыми
 * safety guardrails. Если ни один не настроен — 503.
 */
async function callLlmAnthropic(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ advice: string; model: string }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("not-configured");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = (await r.json()) as {
    content?: Array<{ text?: string }>;
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(data.error?.message || `Anthropic ${r.status}`);
  const reply = data.content?.map((b) => b.text || "").join("").trim() || "";
  if (!reply) throw new Error("empty-reply");
  return { advice: reply, model: "claude-haiku-4-5" };
}

async function callLlmOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ advice: string; model: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("not-configured");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(data.error?.message || `OpenAI ${r.status}`);
  const reply = data.choices?.[0]?.message?.content?.trim() || "";
  if (!reply) throw new Error("empty-reply");
  return { advice: reply, model };
}

async function callLlmGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ advice: string; model: string }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("not-configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(data.error?.message || `Gemini ${r.status}`);
  const reply =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || "";
  if (!reply) throw new Error("empty-reply");
  return { advice: reply, model };
}

healthaiRouter.post("/check-llm", async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const profile = await store.getProfile(body.profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });

  const symptoms = Array.isArray(body.symptoms) ? body.symptoms.map(String) : [];
  if (symptoms.length === 0) {
    return res.status(400).json({ error: "symptoms-empty" });
  }
  const lang =
    body.lang === "en" || body.lang === "ru" ? body.lang : "ru";

  const profileLine = `Возраст: ${profile.age || "?"}, пол: ${profile.sex}, рост: ${profile.heightCm || "?"}см, вес: ${profile.weightKg || "?"}кг.`;
  const conditionsLine = profile.conditions.length
    ? `Хронические: ${profile.conditions.join(", ")}.`
    : "";
  const allergiesLine = profile.allergies.length
    ? `Аллергии: ${profile.allergies.join(", ")}.`
    : "";
  const medsLine = profile.medications.length
    ? `Лекарства: ${profile.medications.join(", ")}.`
    : "";

  const systemPrompt =
    lang === "en"
      ? `You are AEVION HealthAI — an educational health assistant. STRICT RULES:
1. NEVER provide a medical diagnosis.
2. NEVER recommend specific medications or dosages.
3. If symptoms suggest URGENT condition (chest pain, stroke signs, severe shortness of breath, sudden severe pain, suicidal ideation) — say so clearly and recommend emergency services.
4. Otherwise: 2-4 short paragraphs of self-care + clear marker when to see a doctor.
5. Plain language, no jargon. Reference the user's profile only if relevant.
6. End with disclaimer: "Это не медицинский диагноз — при сомнениях обратитесь к врачу."`
      : `Ты — AEVION HealthAI, образовательный AI-помощник по здоровью. ЖЁСТКИЕ ПРАВИЛА:
1. НИКОГДА не ставь диагноз.
2. НИКОГДА не рекомендуй конкретные лекарства и дозировки.
3. Если симптомы указывают на СРОЧНОЕ состояние (боль в груди, признаки инсульта, тяжёлая одышка, внезапная острая боль, суицидальные мысли) — прямо скажи об этом и направь к скорой.
4. Иначе: 2-4 коротких абзаца с self-care советами + ясный маркер когда обращаться к врачу.
5. Простой язык, без жаргона. Ссылайся на профиль пациента только если это релевантно.
6. Закончи дисклеймером: "Это не медицинский диагноз — при сомнениях обратитесь к врачу."`;

  const userPrompt =
    lang === "en"
      ? `Patient profile: ${profileLine} ${conditionsLine} ${allergiesLine} ${medsLine}\nSymptoms: ${symptoms.join("; ")}.\nDuration: ${body.durationH || "?"}h. Severity: ${body.severity || "?"}/10.${body.notes ? `\nNotes: ${body.notes}` : ""}\n\nGive structured advice.`
      : `Профиль пациента: ${profileLine} ${conditionsLine} ${allergiesLine} ${medsLine}\nСимптомы: ${symptoms.join("; ")}.\nДлительность: ${body.durationH || "?"}ч. Тяжесть: ${body.severity || "?"}/10.${body.notes ? `\nЗаметки: ${body.notes}` : ""}\n\nДай структурированный совет.`;

  // Provider chain: Anthropic → OpenAI → Gemini. Юзер может pin через body.provider.
  const requested =
    body.provider === "anthropic" ||
    body.provider === "openai" ||
    body.provider === "gemini"
      ? body.provider
      : null;
  const chain: Array<["anthropic" | "openai" | "gemini", typeof callLlmAnthropic]> =
    requested
      ? [
          [
            requested,
            requested === "anthropic"
              ? callLlmAnthropic
              : requested === "openai"
                ? callLlmOpenAI
                : callLlmGemini,
          ],
        ]
      : [
          ["anthropic", callLlmAnthropic],
          ["openai", callLlmOpenAI],
          ["gemini", callLlmGemini],
        ];

  const tried: Array<{ provider: string; error: string }> = [];
  for (const [name, fn] of chain) {
    try {
      const { advice, model } = await fn(systemPrompt, userPrompt);
      return res.json({
        advice,
        provider: name,
        model,
        triedFallbacks: tried,
        disclaimer: DISCLAIMER,
      });
    } catch (e: any) {
      tried.push({
        provider: name,
        error: String(e?.message || e),
      });
      // continue chain
    }
  }
  // Все провайдеры упали или не настроены.
  const allUnconfigured = tried.every((t) => t.error === "not-configured");
  res.status(allUnconfigured ? 503 : 502).json({
    error: allUnconfigured ? "llm-not-configured" : "llm-all-failed",
    hint: allUnconfigured
      ? "Set at least one of ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY in env."
      : "All configured LLM providers failed; see attempts.",
    attempts: tried,
  });
});

healthaiRouter.post("/import", async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const source =
    body.source === "apple-health" ||
    body.source === "google-fit" ||
    body.source === "manual"
      ? body.source
      : "manual";
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) {
    return res.status(400).json({ error: "entries-empty" });
  }

  let imported = 0;
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const date =
      typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
        ? e.date
        : null;
    if (!date) continue;
    const log: DailyLog = {
      id: newId("log"),
      profileId: body.profileId,
      date,
      sleepHours: e.sleepHours != null ? Number(e.sleepHours) : undefined,
      moodScore:
        e.moodScore != null
          ? Math.max(1, Math.min(10, Number(e.moodScore)))
          : undefined,
      weightKg: e.weightKg != null ? Number(e.weightKg) : undefined,
      waterL: e.waterL != null ? Number(e.waterL) : undefined,
      exerciseMin: e.exerciseMin != null ? Number(e.exerciseMin) : undefined,
      notes: `imported:${source}`,
      createdAt: nowIso(),
    };
    await store.upsertLog(log);
    imported++;
  }
  res.json({ imported, source });
});

healthaiRouter.get("/risks/:id", async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const profile = await store.getProfile(profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });

  const lgs = await store.getLogs(profileId);
  const cks = await store.getChecks(profileId);
  const sorted = [...lgs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last7 = sorted.slice(-7);
  const last30 = sorted.slice(-30);

  const avg = (rows: DailyLog[], pick: (l: DailyLog) => number | undefined) => {
    const vals = rows.map(pick).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  type RiskFlag = {
    code: string;
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
  };
  const risks: RiskFlag[] = [];

  const bmiVal = bmi(profile.heightCm, profile.weightKg);
  if (bmiVal >= 30) {
    risks.push({
      code: "bmi-obese",
      severity: "high",
      title: "BMI в зоне ожирения",
      detail: `BMI ${bmiVal} — рекомендована консультация терапевта/эндокринолога. План питания + регулярная активность 150+ мин/неделю.`,
    });
  } else if (bmiVal >= 27) {
    risks.push({
      code: "bmi-overweight",
      severity: "medium",
      title: "BMI выше нормы",
      detail: `BMI ${bmiVal} — увеличьте суточную активность, контроль порций. Цель: 0.5-1кг/мес снижение.`,
    });
  } else if (bmiVal > 0 && bmiVal < 18.5) {
    risks.push({
      code: "bmi-underweight",
      severity: "medium",
      title: "BMI ниже нормы",
      detail: `BMI ${bmiVal} — повышенная утомляемость, ослабленный иммунитет. Проверьте уровень железа, ферритина, B12.`,
    });
  }

  const avgSleep7 = avg(last7, (l) => l.sleepHours);
  if (avgSleep7 != null && avgSleep7 < 6.5 && last7.length >= 4) {
    risks.push({
      code: "sleep-deficit",
      severity: avgSleep7 < 5.5 ? "high" : "medium",
      title: "Хронический недосып",
      detail: `Средний сон ${avgSleep7.toFixed(1)}ч за 7 дней (норма 7-9ч). Недосып повышает риски гипертонии, диабета, депрессии.`,
    });
  }

  const avgMood7 = avg(last7, (l) => l.moodScore);
  if (avgMood7 != null && avgMood7 < 5 && last7.length >= 3) {
    risks.push({
      code: "mood-low",
      severity: avgMood7 < 3.5 ? "high" : "medium",
      title: "Сниженное настроение",
      detail: `Средний mood ${avgMood7.toFixed(1)}/10 за 7 дней. Если состояние сохраняется >2 недель — обратитесь к психотерапевту.`,
    });
  }

  // Weight trend (за 30 дней разница >= 3kg в любую сторону = flag).
  const weightSeries = last30
    .map((l) => l.weightKg)
    .filter((v): v is number => v != null);
  if (weightSeries.length >= 4) {
    const first = weightSeries[0];
    const lastW = weightSeries[weightSeries.length - 1];
    const diff = lastW - first;
    if (Math.abs(diff) >= 3) {
      risks.push({
        code: diff > 0 ? "weight-rising" : "weight-falling",
        severity: Math.abs(diff) >= 5 ? "medium" : "low",
        title: diff > 0 ? "Резкий набор веса" : "Резкая потеря веса",
        detail: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}кг за последние 30 дней. ${
          diff > 0
            ? "Если без сознательной программы — проверьте щитовидную, кортизол, диабет."
            : "Если без диеты — потеря >5% веса требует обследования (онкомаркеры, ЖКТ, эндокринная система)."
        }`,
      });
    }
  }

  // Streak broken — последняя запись >3 дней назад.
  if (sorted.length > 0) {
    const lastDate = new Date(sorted[sorted.length - 1].date + "T00:00:00Z");
    const daysSince = Math.floor(
      (Date.now() - lastDate.getTime()) / (24 * 3600 * 1000),
    );
    if (daysSince > 3) {
      risks.push({
        code: "tracking-gap",
        severity: "low",
        title: "Перерыв в логировании",
        detail: `${daysSince} дней без записи. Регулярный wellness log усиливает выводы трендов.`,
      });
    }
  }

  // Recent urgent symptom check (за 7 дней).
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recentUrgent = cks.find(
    (c) =>
      new Date(c.createdAt).getTime() >= sevenDaysAgo &&
      c.matched.some((m) => m.urgency === "urgent"),
  );
  if (recentUrgent) {
    risks.push({
      code: "recent-urgent-symptom",
      severity: "high",
      title: "Недавний urgent-симптом",
      detail: `Symptom-check от ${new Date(recentUrgent.createdAt).toLocaleDateString()} содержал признаки, требующие срочной помощи. Проконтролируйте, что обращение к врачу состоялось.`,
    });
  }

  // Сортировка по severity (high → low).
  const order = { high: 0, medium: 1, low: 2 };
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  res.json({
    risks,
    summary: {
      total: risks.length,
      high: risks.filter((r) => r.severity === "high").length,
      medium: risks.filter((r) => r.severity === "medium").length,
      low: risks.filter((r) => r.severity === "low").length,
    },
    bmi: bmiVal,
    avgSleep7d: avgSleep7,
    avgMood7d: avgMood7,
    disclaimer: DISCLAIMER,
  });
});

/**
 * Cycle tracking — period log + predictions (avg cycle length из последних
 * 3 законченных циклов).
 */
healthaiRouter.post("/cycle", async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : todayDate();
  const flow =
    body.flow === "spotting" ||
    body.flow === "light" ||
    body.flow === "medium" ||
    body.flow === "heavy"
      ? body.flow
      : undefined;
  const symptoms = Array.isArray(body.symptoms)
    ? body.symptoms.map(String).slice(0, 20)
    : [];
  const entry: CycleEntry = {
    id: newId("cyc"),
    profileId: body.profileId,
    date,
    flow,
    symptoms,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
    createdAt: nowIso(),
  };
  const saved = await store.upsertCycle(entry);
  res.json({ entry: saved });
});

healthaiRouter.get("/cycle/:profileId", async (req: Request, res: Response) => {
  const profileId = req.params.profileId;
  const all = await store.getCycles(profileId);
  if (all.length === 0) {
    return res.json({
      entries: [],
      lastPeriodStart: null,
      avgCycleLength: null,
      predictedNextStart: null,
      predictedOvulation: null,
    });
  }
  const sorted = [...all].sort((a, b) => (a.date < b.date ? -1 : 1));
  // Period start = первая запись с flow != spotting в каждом блоке последовательных дней.
  const isPeriod = (e: CycleEntry) =>
    !!e.flow && e.flow !== "spotting";
  const starts: string[] = [];
  let prev: string | null = null;
  for (const e of sorted) {
    if (!isPeriod(e)) {
      prev = null;
      continue;
    }
    if (prev) {
      const a = new Date(prev + "T00:00:00Z");
      const b = new Date(e.date + "T00:00:00Z");
      if ((b.getTime() - a.getTime()) / (24 * 3600 * 1000) <= 2) {
        prev = e.date;
        continue;
      }
    }
    starts.push(e.date);
    prev = e.date;
  }
  const lastStart = starts[starts.length - 1] || null;
  let avgLen: number | null = null;
  if (starts.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      const a = new Date(starts[i - 1] + "T00:00:00Z");
      const b = new Date(starts[i] + "T00:00:00Z");
      diffs.push(Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000)));
    }
    const recent = diffs.slice(-3);
    avgLen = Math.round(recent.reduce((s, x) => s + x, 0) / recent.length);
    if (avgLen < 18 || avgLen > 60) avgLen = null;
  }
  let predictedNext: string | null = null;
  let predictedOv: string | null = null;
  if (lastStart && avgLen) {
    const lastDate = new Date(lastStart + "T00:00:00Z");
    const nextDate = new Date(lastDate.getTime() + avgLen * 24 * 3600 * 1000);
    predictedNext = nextDate.toISOString().slice(0, 10);
    const ovDate = new Date(nextDate.getTime() - 14 * 24 * 3600 * 1000);
    predictedOv = ovDate.toISOString().slice(0, 10);
  }
  res.json({
    entries: sorted.slice(-90),
    periodStarts: starts,
    lastPeriodStart: lastStart,
    avgCycleLength: avgLen,
    predictedNextStart: predictedNext,
    predictedOvulation: predictedOv,
    disclaimer: DISCLAIMER,
  });
});

/**
 * PHQ-9 — Patient Health Questionnaire-9, стандартизированный screener
 * депрессии. 9 вопросов, каждый 0-3. Score 0-27.
 *  0-4: minimal · 5-9: mild · 10-14: moderate · 15-19: moderately severe · 20-27: severe
 *  Q9 (suicide ideation) > 0 → immediate flag.
 */
const PHQ9_LAST = new Map<string, { score: number; severity: string; suicideFlag: boolean; answers: number[]; createdAt: string }>();

function phq9Severity(score: number): { severity: string; advice: string } {
  if (score <= 4)
    return {
      severity: "minimal",
      advice:
        "Симптомов депрессии практически нет. Поддерживайте режим (сон 7-9ч, активность, контакт с близкими).",
    };
  if (score <= 9)
    return {
      severity: "mild",
      advice:
        "Лёгкие симптомы. Стоит проверить через 2-4 недели. Полезны ежедневные прогулки 30+ мин, психогигиена, ограничение алкоголя.",
    };
  if (score <= 14)
    return {
      severity: "moderate",
      advice:
        "Умеренная степень. Рекомендована консультация терапевта/психотерапевта. Психотерапия и/или медикаменты могут быть показаны.",
    };
  if (score <= 19)
    return {
      severity: "moderately-severe",
      advice:
        "Умеренно-тяжёлая степень. Активное лечение показано: психотерапия + (часто) фармакотерапия. Не откладывайте обращение к специалисту.",
    };
  return {
    severity: "severe",
    advice:
      "Тяжёлая степень. Необходима неотложная консультация психиатра. Активное лечение, контроль безопасности.",
  };
}

healthaiRouter.post("/screener/phq9", async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const profile = await store.getProfile(body.profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });

  if (!Array.isArray(body.answers) || body.answers.length !== 9) {
    return res.status(400).json({ error: "answers-must-be-9-numbers" });
  }
  const answers: number[] = [];
  for (const a of body.answers) {
    const n = Math.round(Number(a));
    if (!Number.isFinite(n) || n < 0 || n > 3) {
      return res.status(400).json({ error: "answer-must-be-0-to-3" });
    }
    answers.push(n);
  }
  const score = answers.reduce((s, v) => s + v, 0);
  const { severity, advice } = phq9Severity(score);
  const suicideFlag = answers[8] > 0;

  const result = {
    score,
    severity,
    suicideFlag,
    suicideAdvice: suicideFlag
      ? "Вы отметили мысли о самоповреждении. ЭТО ВАЖНО. Свяжитесь со специалистом или позвоните на телефон доверия: РФ 8-800-2000-122 / Казахстан 150 / международный +1-800-273-8255 (US National Suicide Prevention Lifeline)."
      : null,
    advice,
    answers,
    createdAt: nowIso(),
    disclaimer: DISCLAIMER,
  };
  PHQ9_LAST.set(body.profileId, {
    score,
    severity,
    suicideFlag,
    answers,
    createdAt: result.createdAt,
  });
  res.json(result);
});

healthaiRouter.get(
  "/screener/phq9/:profileId",
  async (req: Request, res: Response) => {
    const last = PHQ9_LAST.get(req.params.profileId);
    if (!last) return res.json({ last: null });
    res.json({ last });
  },
);

/**
 * GAD-7 — Generalized Anxiety Disorder 7-item, стандартизированный
 * скрининг тревожных расстройств. 7 вопросов 0-3, score 0-21.
 *  0-4: minimal · 5-9: mild · 10-14: moderate · 15-21: severe
 */
const GAD7_LAST = new Map<string, { score: number; severity: string; answers: number[]; createdAt: string }>();

function gad7Severity(score: number): { severity: string; advice: string } {
  if (score <= 4)
    return {
      severity: "minimal",
      advice:
        "Тревога в норме. Продолжайте здоровые привычки: регулярный сон, физ. активность, ограничение кофеина.",
    };
  if (score <= 9)
    return {
      severity: "mild",
      advice:
        "Лёгкая тревога. Помогают: дыхательные техники (4-7-8), 20-30 мин прогулок, mindfulness 10 мин в день. Если симптомы сохраняются >3 недель — консультация специалиста.",
    };
  if (score <= 14)
    return {
      severity: "moderate",
      advice:
        "Умеренная тревога. Рекомендована консультация психотерапевта (КПТ показала высокую эффективность при тревожных расстройствах).",
    };
  return {
    severity: "severe",
    advice:
      "Тяжёлая тревога. Активное лечение показано: психотерапия + (часто) фармакотерапия. Не откладывайте обращение к специалисту.",
  };
}

healthaiRouter.post("/screener/gad7", async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!body.profileId || typeof body.profileId !== "string") {
    return res.status(400).json({ error: "profileId-required" });
  }
  const profile = await store.getProfile(body.profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });

  if (!Array.isArray(body.answers) || body.answers.length !== 7) {
    return res.status(400).json({ error: "answers-must-be-7-numbers" });
  }
  const answers: number[] = [];
  for (const a of body.answers) {
    const n = Math.round(Number(a));
    if (!Number.isFinite(n) || n < 0 || n > 3) {
      return res.status(400).json({ error: "answer-must-be-0-to-3" });
    }
    answers.push(n);
  }
  const score = answers.reduce((s, v) => s + v, 0);
  const { severity, advice } = gad7Severity(score);

  const result = {
    score,
    severity,
    advice,
    answers,
    createdAt: nowIso(),
    disclaimer: DISCLAIMER,
  };
  GAD7_LAST.set(body.profileId, {
    score,
    severity,
    answers,
    createdAt: result.createdAt,
  });
  res.json(result);
});

healthaiRouter.get(
  "/screener/gad7/:profileId",
  async (req: Request, res: Response) => {
    const last = GAD7_LAST.get(req.params.profileId);
    if (!last) return res.json({ last: null });
    res.json({ last });
  },
);

/**
 * Personalized plan generator. Rule-based (НЕ LLM) — генерирует
 * weekly plan на основе профиля + последних трендов + screener-результатов.
 * Безопасный фолбэк: общие рекомендации WHO для здоровых взрослых.
 */
type GeneratedPlan = {
  goals: string[];
  dailyRoutine: {
    wake: string;
    sleepTarget: string;
    waterL: number;
    meals: string[];
  };
  weeklyExercise: Array<{ type: string; frequency: string; minutes: number }>;
  nutrition: { focus: string[]; avoid: string[]; sampleMeals: string[] };
  habitsToAdd: string[];
  habitsToReduce: string[];
  mentalHealth: string[];
  rationale: string[];
};

healthaiRouter.get("/plan/:profileId", async (req: Request, res: Response) => {
  const profileId = req.params.profileId;
  const profile = await store.getProfile(profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });

  const lgs = await store.getLogs(profileId);
  const sorted = [...lgs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last7 = sorted.slice(-7);

  const avgSleep = (() => {
    const v = last7.map((l) => l.sleepHours).filter((x): x is number => x != null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  })();
  const avgMood = (() => {
    const v = last7.map((l) => l.moodScore).filter((x): x is number => x != null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  })();
  const avgExercise = (() => {
    const v = last7.map((l) => l.exerciseMin).filter((x): x is number => x != null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  })();

  const bmiVal = bmi(profile.heightCm, profile.weightKg);
  const phq9 = PHQ9_LAST.get(profileId);
  const gad7 = GAD7_LAST.get(profileId);

  const goals: string[] = [];
  const habitsAdd: string[] = [];
  const habitsReduce: string[] = [];
  const mental: string[] = [];
  const rationale: string[] = [];

  // BMI-based goals.
  if (bmiVal >= 30) {
    goals.push("Снижение веса 0.5-0.7кг/неделю безопасным дефицитом калорий ~500ккал");
    rationale.push(`BMI ${bmiVal} в зоне ожирения`);
  } else if (bmiVal >= 27) {
    goals.push("Постепенное снижение веса до BMI <25 (примерно 0.5кг/неделю)");
    rationale.push(`BMI ${bmiVal} избыточный`);
  } else if (bmiVal > 0 && bmiVal < 18.5) {
    goals.push("Постепенный набор веса +0.3кг/неделю через калорийный профицит и силовые");
    rationale.push(`BMI ${bmiVal} ниже нормы`);
  } else if (bmiVal > 0) {
    goals.push("Поддержание веса в норме");
  }

  // Sleep goal.
  if (avgSleep != null && avgSleep < 6.5) {
    goals.push("Восстановить сон 7-9ч в сутки");
    habitsAdd.push("Wind-down routine: за 60 мин до сна — экраны off, тёплый душ, чтение");
    habitsReduce.push("Кофеин после 14:00, алкоголь вечером");
    rationale.push(`Сон 7д avg ${avgSleep.toFixed(1)}ч ниже нормы`);
  } else {
    habitsAdd.push("Постоянное время отбоя ±30 мин даже на выходных");
  }

  // Activity goal.
  if (avgExercise == null || avgExercise < 20) {
    goals.push("Достичь WHO-минимума 150 мин кардио + 2 силовые в неделю");
    rationale.push("Текущая активность ниже WHO-минимума");
  }

  // Mental health.
  if (phq9 && phq9.score >= 10) {
    mental.push("PHQ-9 ≥10 — рекомендована консультация психотерапевта (КПТ показала высокую эффективность)");
    mental.push("30 мин outdoor прогулок ежедневно — эффект сопоставим с антидепрессантами при mild-moderate депрессии");
  } else if (avgMood != null && avgMood < 5) {
    mental.push("Среднее настроение ниже 5/10 — добавьте 30 мин дневного света утром (помогает регуляции серотонина)");
  }
  if (gad7 && gad7.score >= 10) {
    mental.push("GAD-7 ≥10 — психотерапия (КПТ) первая линия при тревожных расстройствах");
    mental.push("Дыхание 4-7-8 (вдох 4с, задержка 7с, выдох 8с) 3 раунда — снижает кортизол быстро");
  } else {
    mental.push("Mindfulness 10 мин/день (Headspace, Calm) — научно доказанный эффект на стресс");
  }

  // Conditions-aware nutrition.
  const focus: string[] = [
    "Овощи и зелень минимум 400г/день",
    "Белок 1.2-1.6г на кг веса (рыба, птица, бобовые, творог)",
    "Цельные крупы (овсянка, гречка, киноа)",
    "Орехи 30-40г/день (омега-3)",
  ];
  const avoid: string[] = [
    "Сладкие напитки и соки",
    "Промышленные транс-жиры (выпечка, фастфуд)",
    "Избыток рафинированных углеводов",
  ];
  if (profile.conditions.some((c) => /diabet|диабет/i.test(c))) {
    focus.unshift("Низкогликемические продукты (овощи, бобовые, ягоды)");
    avoid.unshift("Простые сахара, белый рис, белый хлеб");
    rationale.push("Диабет в анамнезе — приоритет низкого GI");
  }
  if (profile.conditions.some((c) => /гипертон|hypertens/i.test(c))) {
    focus.push("Калий-богатые продукты (бананы, авокадо, листовая зелень)");
    avoid.push("Соль >5г/день, обработанное мясо");
    rationale.push("Гипертония — DASH-pattern диета");
  }

  // Filter allergies.
  const allergiesLower = profile.allergies.map((a) => a.toLowerCase());
  const filterAllergens = (arr: string[]) =>
    arr.filter((s) => {
      const sl = s.toLowerCase();
      return !allergiesLower.some((a) => a && sl.includes(a));
    });

  const sampleMealsBase = [
    "Завтрак: овсянка с ягодами и орехами + йогурт",
    "Обед: куриная грудка + киноа + овощи на пару",
    "Полдник: яблоко + горсть миндаля",
    "Ужин: запечённая рыба + овощной салат + гречка",
  ];
  const sampleMeals = filterAllergens(sampleMealsBase);
  const focusFiltered = filterAllergens(focus);

  // Exercise plan.
  const weeklyExercise: GeneratedPlan["weeklyExercise"] = [];
  if (bmiVal >= 27) {
    weeklyExercise.push({ type: "Кардио (быстрая ходьба, плавание, велосипед)", frequency: "5×/неделю", minutes: 40 });
    weeklyExercise.push({ type: "Силовая тренировка", frequency: "2-3×/неделю", minutes: 45 });
  } else {
    weeklyExercise.push({ type: "Кардио (бег, плавание, велосипед)", frequency: "3×/неделю", minutes: 30 });
    weeklyExercise.push({ type: "Силовая тренировка", frequency: "2×/неделю", minutes: 45 });
  }
  if (profile.age >= 50) {
    weeklyExercise.push({ type: "Баланс и гибкость (йога, тай-чи)", frequency: "2×/неделю", minutes: 30 });
  } else {
    weeklyExercise.push({ type: "Растяжка / mobility", frequency: "ежедневно", minutes: 10 });
  }

  // Daily routine.
  const dailyRoutine: GeneratedPlan["dailyRoutine"] = {
    wake: "7:00",
    sleepTarget: "23:00 (7-8ч)",
    waterL: profile.weightKg ? Math.round(profile.weightKg * 0.03 * 10) / 10 : 2.5,
    meals: sampleMeals,
  };

  // Habits.
  habitsAdd.push("Утро: 500мл воды натощак");
  habitsAdd.push("Прогулка 15+ мин после обеда (улучшает гликемию)");
  if (profile.age >= 40) habitsAdd.push("Ежегодные screening: BP, липиды, глюкоза");

  habitsReduce.push("Sitting >2ч подряд — каждый час 2-3 мин стоя/растяжки");

  const plan: GeneratedPlan = {
    goals,
    dailyRoutine,
    weeklyExercise,
    nutrition: {
      focus: focusFiltered,
      avoid,
      sampleMeals,
    },
    habitsToAdd: habitsAdd,
    habitsToReduce: habitsReduce,
    mentalHealth: mental,
    rationale,
  };

  const generatedAt = nowIso();
  const snapshotId = newId("plan");
  void store
    .addPlanSnapshot({
      id: snapshotId,
      profileId,
      plan,
      bmi: bmiVal || null,
      avgSleep7d: avgSleep,
      avgMood7d: avgMood,
      generatedAt,
    })
    .catch(() => {});

  res.json({
    plan,
    snapshotId,
    bmi: bmiVal,
    avgSleep7d: avgSleep,
    avgMood7d: avgMood,
    avgExercise7d: avgExercise,
    phq9: phq9 ? { score: phq9.score, severity: phq9.severity } : null,
    gad7: gad7 ? { score: gad7.score, severity: gad7.severity } : null,
    generatedAt,
    disclaimer: DISCLAIMER,
  });
});

healthaiRouter.get("/plan/history/:profileId", async (req: Request, res: Response) => {
  const list = await store.listPlanSnapshots(req.params.profileId);
  res.json({
    snapshots: list.map((s) => ({
      id: s.id,
      generatedAt: s.generatedAt,
      bmi: s.bmi,
      avgSleep7d: s.avgSleep7d,
      avgMood7d: s.avgMood7d,
      goalsCount: Array.isArray(s.plan?.goals) ? s.plan.goals.length : 0,
    })),
  });
});

healthaiRouter.get("/plan/snapshot/:id", async (req: Request, res: Response) => {
  const snap = await store.getPlanSnapshot(req.params.id);
  if (!snap) return res.status(404).json({ error: "snapshot-not-found" });
  res.json(snap);
});

/** Полный экспорт профиля для врача (или для backup). */
healthaiRouter.get("/export/:id", async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const profile = await store.getProfile(profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });
  const cks = await store.getChecks(profileId);
  const lgs = await store.getLogs(profileId);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="aevion-healthai-${profileId}.json"`,
  );
  res.json({
    exportedAt: nowIso(),
    profile,
    bmi: bmi(profile.heightCm, profile.weightKg),
    symptomChecks: cks,
    dailyLogs: lgs,
    disclaimer: DISCLAIMER,
  });
});

/**
 * Population averages: сравнение пользователя с агрегатами по всем профилям.
 * Считает средние sleep / mood / weight / BMI по всем активным профилям и
 * возвращает дельты для конкретного profileId. Для разогрева анонимной демо-
 * среды есть baseline — статичные «глобальные» averages если в системе пока
 * меньше 5 профилей.
 */
const POP_BASELINE = {
  sleepHours: 6.9,
  moodScore: 6.4,
  bmi: 25.7,
  exerciseMin: 28,
};

healthaiRouter.get("/population/:profileId", async (req, res) => {
  const profileId = req.params.profileId;
  const profile = await store.getProfile(profileId);
  if (!profile) return res.status(404).json({ error: "profile-not-found" });

  const ids = await store.allProfileIdsWithLogs();
  const profiles: HealthProfile[] = [];
  for (const id of ids) {
    const p = await store.getProfile(id);
    if (p) profiles.push(p);
  }
  // ensure self counted даже если без логов
  if (!profiles.find((p) => p.id === profileId)) profiles.push(profile);

  let sleepSum = 0,
    sleepN = 0,
    moodSum = 0,
    moodN = 0,
    exSum = 0,
    exN = 0;
  let bmiSum = 0,
    bmiN = 0;
  for (const p of profiles) {
    const lgs = await store.getLogs(p.id);
    const last = lgs.slice(0, 7);
    for (const l of last) {
      if (typeof l.sleepHours === "number") {
        sleepSum += l.sleepHours;
        sleepN += 1;
      }
      if (typeof l.moodScore === "number") {
        moodSum += l.moodScore;
        moodN += 1;
      }
      if (typeof l.exerciseMin === "number") {
        exSum += l.exerciseMin;
        exN += 1;
      }
    }
    const b = bmi(p.heightCm, p.weightKg);
    if (b > 0) {
      bmiSum += b;
      bmiN += 1;
    }
  }

  const usedBaseline = profiles.length < 5;
  const popSleep = usedBaseline
    ? POP_BASELINE.sleepHours
    : sleepN > 0
    ? sleepSum / sleepN
    : POP_BASELINE.sleepHours;
  const popMood = usedBaseline
    ? POP_BASELINE.moodScore
    : moodN > 0
    ? moodSum / moodN
    : POP_BASELINE.moodScore;
  const popBmi = usedBaseline
    ? POP_BASELINE.bmi
    : bmiN > 0
    ? bmiSum / bmiN
    : POP_BASELINE.bmi;
  const popExercise = usedBaseline
    ? POP_BASELINE.exerciseMin
    : exN > 0
    ? exSum / exN
    : POP_BASELINE.exerciseMin;

  // self averages
  const selfLogs = (await store.getLogs(profileId)).slice(0, 7);
  const num = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
  const selfSleep = num(
    selfLogs.filter((l) => typeof l.sleepHours === "number").map((l) => l.sleepHours as number),
  );
  const selfMood = num(
    selfLogs.filter((l) => typeof l.moodScore === "number").map((l) => l.moodScore as number),
  );
  const selfExercise = num(
    selfLogs.filter((l) => typeof l.exerciseMin === "number").map((l) => l.exerciseMin as number),
  );
  const selfBmiRaw = bmi(profile.heightCm, profile.weightKg);
  const selfBmi = selfBmiRaw > 0 ? selfBmiRaw : null;

  res.json({
    sample: profiles.length,
    usedBaseline,
    population: {
      sleepHours: round(popSleep, 1),
      moodScore: round(popMood, 1),
      bmi: round(popBmi, 1),
      exerciseMin: round(popExercise, 0),
    },
    self: {
      sleepHours: selfSleep == null ? null : round(selfSleep, 1),
      moodScore: selfMood == null ? null : round(selfMood, 1),
      bmi: selfBmi,
      exerciseMin: selfExercise == null ? null : round(selfExercise, 0),
    },
    delta: {
      sleepHours:
        selfSleep == null ? null : round(selfSleep - popSleep, 1),
      moodScore:
        selfMood == null ? null : round(selfMood - popMood, 1),
      bmi: selfBmi == null ? null : round(selfBmi - popBmi, 1),
      exerciseMin:
        selfExercise == null
          ? null
          : round(selfExercise - popExercise, 0),
    },
  });
});

healthaiRouter.get("/leaderboard", async (_req, res) => {
  const ids = await store.allProfileIdsWithLogs();
  const board: Array<{ profileId: string; streak: number; logs: number }> = [];
  for (const profileId of ids) {
    const lgs = await store.getLogs(profileId);
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
