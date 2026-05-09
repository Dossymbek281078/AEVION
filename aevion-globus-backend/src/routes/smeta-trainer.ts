import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/authJwt";
import { readJsonFile, writeJsonFile } from "../lib/jsonFileStore";

// AI-тренажёр сметного дела РК — backend для прогресса студентов.
// MVP storage через jsonFileStore (как aev/qright). Prisma-схема
// (SmetaStudent / SmetaProgress / SmetaAttempt) готова для миграции
// на Postgres когда DATABASE_URL будет задан.
//
// Endpoints:
//  GET  /api/smeta-trainer/student/:deviceId             — снимок прогресса студента
//  POST /api/smeta-trainer/student/:deviceId/sync        — upsert прогресса уровней (idempotent)
//  POST /api/smeta-trainer/student/:deviceId/lessons     — upsert прогресса уроков (lessonId → quizScore/completed)
//  POST /api/smeta-trainer/student/:deviceId/practice    — upsert прогресса практики (exerciseId → correct)
//  POST /api/smeta-trainer/student/:deviceId/capstone    — отметка о сдаче капстоуна
//  POST /api/smeta-trainer/student/:deviceId/achievements— синхронизация набора бейджей
//  POST /api/smeta-trainer/student/:deviceId/attempt     — записать попытку (quiz/exercise/lsr-submit)
//  GET  /api/smeta-trainer/student/:deviceId/attempts    — последние N попыток
//  GET  /api/smeta-trainer/leaderboard?level=N&group=&limit= — топ студентов (общий/по уровню/по группе)
//  GET  /api/smeta-trainer/groups                        — список уникальных групп со счётчиками
//  GET  /api/smeta-trainer/stats                         — агрегаты для куратора (включая урок-стат)
//  GET  /api/smeta-trainer/admin/students                — детальный список студентов (требует JWT)

export const smetaTrainerRouter = Router();

const STUDENTS_FILE = "smeta_students.json";
const ATTEMPTS_FILE = "smeta_attempts.json";
const OVERRIDES_FILE = "smeta_material_overrides.json";

// ── Rate limits ────────────────────────────────────────────────────
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded", limit: "120 writes/min/IP" },
});

const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded", limit: "240 reads/min/IP" },
});

// ── JWT auth binding (optional) ────────────────────────────────────
function readUserIdFromBearer(req: Request): string | null {
  const header = req.headers?.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded === "object" && decoded !== null && "sub" in decoded) {
      const sub = (decoded as { sub: unknown }).sub;
      return typeof sub === "string" ? sub : null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────────
type LevelStatus = "open" | "in-progress" | "done";
type AttemptKind = "quiz" | "exercise" | "lsr-submit";

interface LevelProgress {
  level: number;
  status: LevelStatus;
  score?: number;
  completedAt?: number;
  attemptsCnt?: number;
  lastVisitAt?: number;
}

interface LessonProgressServer {
  lessonId: string;
  completed: boolean;
  quizScore?: number;
  ts: number;
}

interface PracticeAttemptServer {
  exerciseId: string;
  correct: boolean;
  attempts: number;
  ts: number;
}

interface StudentRecord {
  deviceId: string;
  userId: string | null;
  displayName: string | null;
  group: string | null;
  startedAt: number;
  updatedAt: number;
  levels: Record<string, LevelProgress>;
  /** Прогресс по урокам теории (lessonId → запись). */
  lessons?: Record<string, LessonProgressServer>;
  /** Прогресс по упражнениям practice mode. */
  practice?: Record<string, PracticeAttemptServer>;
  /** Капстоун сдан — timestamp (или null если не сдан). */
  capstonePassedAt?: number | null;
  /** Множество полученных achievement IDs (вычисляется клиентом, мы храним для агрегатов). */
  achievements?: string[];
}

interface AttemptRecord {
  id: string;
  deviceId: string;
  level: number;
  kind: AttemptKind;
  score: number | null;
  payload: unknown;
  feedback: string | null;
  ts: number;
}

// ── Helpers ────────────────────────────────────────────────────────
async function loadStudents(): Promise<Record<string, StudentRecord>> {
  return readJsonFile<Record<string, StudentRecord>>(STUDENTS_FILE, {});
}
async function saveStudents(s: Record<string, StudentRecord>): Promise<void> {
  await writeJsonFile(STUDENTS_FILE, s);
}
async function loadAttempts(): Promise<AttemptRecord[]> {
  return readJsonFile<AttemptRecord[]>(ATTEMPTS_FILE, []);
}
async function saveAttempts(a: AttemptRecord[]): Promise<void> {
  await writeJsonFile(ATTEMPTS_FILE, a);
}

// ── Material overrides (shared by curator) ────────────────────────────
type OverrideRecord = {
  name: string;
  unit: string;
  sscCode: string | null;     // null = explicit "не нормируется ССЦ"
  sscName?: string;
  smetnaya?: number;
  otpusknaya?: number | null;
  sscBook?: string;
  setBy: string | null;        // userId or null (anonymous)
  setAt: number;
};
function overrideKey(name: string, unit: string): string {
  return `${name.toLowerCase().trim()}|${unit.trim()}`;
}
async function loadOverrides(): Promise<Record<string, OverrideRecord>> {
  return readJsonFile<Record<string, OverrideRecord>>(OVERRIDES_FILE, {});
}
async function saveOverrides(o: Record<string, OverrideRecord>): Promise<void> {
  await writeJsonFile(OVERRIDES_FILE, o);
}

function isValidDeviceId(s: unknown): s is string {
  return typeof s === "string" && s.length >= 6 && s.length <= 128 && /^[\w.\-]+$/.test(s);
}
function isValidLevel(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

// ── GET /student/:deviceId ─────────────────────────────────────────
smetaTrainerRouter.get("/student/:deviceId", readLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const students = await loadStudents();
  const rec = students[deviceId] ?? null;
  res.json({ student: rec });
});

// ── POST /student/:deviceId/sync ───────────────────────────────────
// body: { displayName?, group?, levels: Record<level, LevelProgress> }
smetaTrainerRouter.post("/student/:deviceId/sync", writeLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const userId = readUserIdFromBearer(req);
  const { displayName, group, levels } = req.body ?? {};
  if (typeof levels !== "object" || levels === null) {
    return res.status(400).json({ error: "bad_levels" });
  }

  const students = await loadStudents();
  const now = Date.now();
  const existing = students[deviceId];

  // Валидация уровней — только числовые ключи 1..5 с допустимыми статусами.
  const cleanLevels: Record<string, LevelProgress> = existing?.levels ?? {};
  for (const [k, v] of Object.entries(levels as Record<string, unknown>)) {
    const lvl = Number(k);
    if (!isValidLevel(lvl)) continue;
    const lp = v as Partial<LevelProgress>;
    if (lp.status && !["open", "in-progress", "done"].includes(lp.status)) continue;
    cleanLevels[String(lvl)] = {
      level: lvl,
      status: (lp.status ?? "open") as LevelStatus,
      score: typeof lp.score === "number" ? Math.max(0, Math.min(100, lp.score)) : undefined,
      completedAt: typeof lp.completedAt === "number" ? lp.completedAt : undefined,
      attemptsCnt: typeof lp.attemptsCnt === "number" ? lp.attemptsCnt : 0,
      lastVisitAt: now,
    };
  }

  const rec: StudentRecord = {
    deviceId,
    userId: userId ?? existing?.userId ?? null,
    displayName: typeof displayName === "string" ? displayName.slice(0, 80) : (existing?.displayName ?? null),
    group: typeof group === "string" ? group.slice(0, 40) : (existing?.group ?? null),
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    levels: cleanLevels,
  };
  students[deviceId] = rec;
  await saveStudents(students);
  res.json({ student: rec });
});

// ── POST /student/:deviceId/lessons ────────────────────────────────
// body: { lessons: Record<lessonId, { completed: boolean; quizScore?: number; ts: number }> }
// Идемпотентный upsert: новые записи мерджатся с существующими, max(ts) и
// max(quizScore) — сохраняем лучшее из попыток.
smetaTrainerRouter.post("/student/:deviceId/lessons", writeLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const { lessons } = req.body ?? {};
  if (typeof lessons !== "object" || lessons === null) {
    return res.status(400).json({ error: "bad_lessons" });
  }
  const students = await loadStudents();
  const existing = students[deviceId];
  if (!existing) return res.status(404).json({ error: "student_not_found" });

  const merged: Record<string, LessonProgressServer> = { ...(existing.lessons ?? {}) };
  for (const [lessonId, v] of Object.entries(lessons as Record<string, unknown>)) {
    if (typeof lessonId !== "string" || lessonId.length < 2 || lessonId.length > 64) continue;
    const lp = v as Partial<LessonProgressServer>;
    const prev = merged[lessonId];
    const completed = !!lp.completed || !!prev?.completed;
    const newScore = typeof lp.quizScore === "number" ? Math.max(0, Math.min(100, lp.quizScore)) : undefined;
    const score = newScore != null
      ? Math.max(prev?.quizScore ?? 0, newScore)
      : prev?.quizScore;
    merged[lessonId] = {
      lessonId,
      completed,
      quizScore: score,
      ts: typeof lp.ts === "number" ? Math.max(prev?.ts ?? 0, lp.ts) : Date.now(),
    };
  }
  existing.lessons = merged;
  existing.updatedAt = Date.now();
  students[deviceId] = existing;
  await saveStudents(students);
  res.json({ student: existing });
});

// ── POST /student/:deviceId/practice ───────────────────────────────
// body: { practice: Record<exerciseId, { correct: boolean; attempts: number; ts: number }> }
smetaTrainerRouter.post("/student/:deviceId/practice", writeLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const { practice } = req.body ?? {};
  if (typeof practice !== "object" || practice === null) {
    return res.status(400).json({ error: "bad_practice" });
  }
  const students = await loadStudents();
  const existing = students[deviceId];
  if (!existing) return res.status(404).json({ error: "student_not_found" });

  const merged: Record<string, PracticeAttemptServer> = { ...(existing.practice ?? {}) };
  for (const [exId, v] of Object.entries(practice as Record<string, unknown>)) {
    if (typeof exId !== "string" || exId.length < 2 || exId.length > 64) continue;
    const pa = v as Partial<PracticeAttemptServer>;
    const prev = merged[exId];
    merged[exId] = {
      exerciseId: exId,
      correct: !!pa.correct || !!prev?.correct,
      attempts: Math.max(prev?.attempts ?? 0, typeof pa.attempts === "number" ? pa.attempts : 0),
      ts: typeof pa.ts === "number" ? Math.max(prev?.ts ?? 0, pa.ts) : Date.now(),
    };
  }
  existing.practice = merged;
  existing.updatedAt = Date.now();
  students[deviceId] = existing;
  await saveStudents(students);
  res.json({ student: existing });
});

// ── POST /student/:deviceId/capstone ───────────────────────────────
// body: { passed: boolean }
smetaTrainerRouter.post("/student/:deviceId/capstone", writeLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const { passed } = req.body ?? {};
  if (typeof passed !== "boolean") return res.status(400).json({ error: "bad_passed" });
  const students = await loadStudents();
  const existing = students[deviceId];
  if (!existing) return res.status(404).json({ error: "student_not_found" });
  // Не сбрасываем уже сданный капстоун
  if (passed && !existing.capstonePassedAt) existing.capstonePassedAt = Date.now();
  if (!passed) existing.capstonePassedAt = null;
  existing.updatedAt = Date.now();
  students[deviceId] = existing;
  await saveStudents(students);
  res.json({ student: existing });
});

// ── POST /student/:deviceId/achievements ───────────────────────────
// body: { achievements: string[] }
smetaTrainerRouter.post("/student/:deviceId/achievements", writeLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const { achievements } = req.body ?? {};
  if (!Array.isArray(achievements)) return res.status(400).json({ error: "bad_achievements" });
  const clean = achievements.filter(
    (a): a is string => typeof a === "string" && a.length >= 2 && a.length <= 48,
  ).slice(0, 100);
  const students = await loadStudents();
  const existing = students[deviceId];
  if (!existing) return res.status(404).json({ error: "student_not_found" });
  // Объединяем со старым множеством — бейдж нельзя «отнять»
  const merged = new Set([...(existing.achievements ?? []), ...clean]);
  existing.achievements = [...merged];
  existing.updatedAt = Date.now();
  students[deviceId] = existing;
  await saveStudents(students);
  res.json({ student: existing });
});

// ── POST /student/:deviceId/attempt ────────────────────────────────
// body: { level, kind, score?, payload?, feedback? }
smetaTrainerRouter.post("/student/:deviceId/attempt", writeLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const { level, kind, score, payload, feedback } = req.body ?? {};
  if (!isValidLevel(level)) return res.status(400).json({ error: "bad_level" });
  if (!["quiz", "exercise", "lsr-submit"].includes(kind)) {
    return res.status(400).json({ error: "bad_kind" });
  }
  const attempts = await loadAttempts();
  const rec: AttemptRecord = {
    id: crypto.randomUUID(),
    deviceId,
    level,
    kind: kind as AttemptKind,
    score: typeof score === "number" ? Math.max(0, Math.min(100, score)) : null,
    payload: payload ?? null,
    feedback: typeof feedback === "string" ? feedback.slice(0, 4000) : null,
    ts: Date.now(),
  };
  attempts.push(rec);
  // обрезаем до последних 5000 — защита от роста без backup
  if (attempts.length > 5000) attempts.splice(0, attempts.length - 5000);
  await saveAttempts(attempts);
  res.json({ attempt: rec });
});

// ── GET /student/:deviceId/attempts ────────────────────────────────
smetaTrainerRouter.get("/student/:deviceId/attempts", readLimiter, async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) return res.status(400).json({ error: "bad_device_id" });
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  const attempts = await loadAttempts();
  const filtered = attempts.filter((a) => a.deviceId === deviceId).slice(-limit).reverse();
  res.json({ attempts: filtered });
});

// ── GET /leaderboard ───────────────────────────────────────────────
// query: ?level=N&group=X&limit=20  (level/group optional)
smetaTrainerRouter.get("/leaderboard", readLimiter, async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const level = Number(req.query.level);
  const group = typeof req.query.group === "string" ? req.query.group.trim() : "";
  const students = await loadStudents();
  let entries = Object.values(students);
  if (group) {
    entries = entries.filter((s) => (s.group ?? "").toLowerCase() === group.toLowerCase());
  }
  const rows = entries.map((s) => {
    const levels = Object.values(s.levels ?? {});
    const totalScore = levels.reduce((a, l) => a + (l.score ?? 0), 0);
    const doneCount = levels.filter((l) => l.status === "done").length;
    const lessonsCount = Object.values(s.lessons ?? {}).filter((l) => l.completed).length;
    const practiceCount = Object.values(s.practice ?? {}).filter((p) => p.correct).length;
    const achievementsCount = (s.achievements ?? []).length;
    let levelScore: number | null = null;
    if (isValidLevel(level)) {
      const lp = s.levels[String(level)];
      levelScore = lp?.score ?? null;
    }
    return {
      deviceId: s.deviceId,
      displayName: s.displayName,
      group: s.group,
      doneCount,
      totalScore,
      levelScore,
      lessonsCount,
      practiceCount,
      achievementsCount,
      capstonePassedAt: s.capstonePassedAt ?? null,
      updatedAt: s.updatedAt,
    };
  });
  rows.sort((a, b) =>
    isValidLevel(level)
      ? (b.levelScore ?? -1) - (a.levelScore ?? -1)
      : b.totalScore - a.totalScore || b.doneCount - a.doneCount,
  );
  res.json({ leaderboard: rows.slice(0, limit) });
});

// ── GET /groups ────────────────────────────────────────────────────
// Список уникальных групп со счётчиком студентов — для group-фильтра в UI.
smetaTrainerRouter.get("/groups", readLimiter, async (_req, res) => {
  const students = await loadStudents();
  const counts = new Map<string, number>();
  for (const s of Object.values(students)) {
    const g = (s.group ?? "").trim();
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const groups = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
  res.json({ groups });
});

// ── GET /admin/students ────────────────────────────────────────────
// Детальный список всех студентов (для куратора). Требует JWT.
// query: ?group=X&limit=200
smetaTrainerRouter.get("/admin/students", readLimiter, async (req, res) => {
  const userId = readUserIdFromBearer(req);
  if (!userId) return res.status(401).json({ error: "auth_required" });
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
  const group = typeof req.query.group === "string" ? req.query.group.trim() : "";
  const students = await loadStudents();
  let entries = Object.values(students);
  if (group) {
    entries = entries.filter((s) => (s.group ?? "").toLowerCase() === group.toLowerCase());
  }
  // Полный snapshot (без обрезки), но с производными счётчиками для удобства UI
  const rows = entries
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((s) => ({
      ...s,
      lessonsDone: Object.values(s.lessons ?? {}).filter((l) => l.completed).length,
      practiceDone: Object.values(s.practice ?? {}).filter((p) => p.correct).length,
      achievementsCount: (s.achievements ?? []).length,
      doneLevels: Object.values(s.levels ?? {}).filter((l) => l.status === "done").length,
    }));
  res.json({ students: rows, totalInGroup: entries.length });
});

// ── GET /stats ─────────────────────────────────────────────────────
// Агрегаты для куратора курса.
smetaTrainerRouter.get("/stats", readLimiter, async (_req, res) => {
  const [students, attempts] = await Promise.all([loadStudents(), loadAttempts()]);
  const list = Object.values(students);
  const perLevel: Record<number, { open: number; "in-progress": number; done: number; avgScore: number }> = {
    1: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
    2: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
    3: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
    4: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
    5: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
  };
  for (const s of list) {
    for (const lp of Object.values(s.levels ?? {})) {
      const bucket = perLevel[lp.level];
      if (!bucket) continue;
      bucket[lp.status] += 1;
    }
  }
  // средний скор по сданным
  for (const lvl of [1, 2, 3, 4, 5]) {
    const scores = list
      .map((s) => s.levels[String(lvl)]?.score)
      .filter((x): x is number => typeof x === "number");
    perLevel[lvl].avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }
  // Урок-статистика: сколько уникальных уроков пройдено суммарно, средний балл по lessonId
  const lessonScoreSums = new Map<string, { sum: number; cnt: number; doneCnt: number }>();
  let lessonsCompletedTotal = 0;
  for (const s of list) {
    for (const lp of Object.values(s.lessons ?? {})) {
      const cur = lessonScoreSums.get(lp.lessonId) ?? { sum: 0, cnt: 0, doneCnt: 0 };
      if (lp.quizScore != null) {
        cur.sum += lp.quizScore;
        cur.cnt += 1;
      }
      if (lp.completed) {
        cur.doneCnt += 1;
        lessonsCompletedTotal += 1;
      }
      lessonScoreSums.set(lp.lessonId, cur);
    }
  }
  // Топ-5 «трудных» уроков (низший средний балл, с не менее 2 ответами)
  const hardestLessons = [...lessonScoreSums.entries()]
    .filter(([, v]) => v.cnt >= 2)
    .sort((a, b) => (a[1].sum / a[1].cnt) - (b[1].sum / b[1].cnt))
    .slice(0, 5)
    .map(([lessonId, v]) => ({
      lessonId,
      avgScore: Math.round(v.sum / v.cnt),
      attempts: v.cnt,
      doneCount: v.doneCnt,
    }));

  // Практика и капстоун
  const practiceCorrectTotal = list.reduce(
    (s, st) => s + Object.values(st.practice ?? {}).filter((p) => p.correct).length,
    0,
  );
  const capstonePassed = list.filter((s) => s.capstonePassedAt).length;

  res.json({
    studentsTotal: list.length,
    attemptsTotal: attempts.length,
    perLevel,
    lessonsCompletedTotal,
    practiceCorrectTotal,
    capstonePassed,
    hardestLessons,
    lastUpdate: list.reduce((m, s) => Math.max(m, s.updatedAt), 0),
  });
});

// ── GET /material-overrides ────────────────────────────────────────
// Публичный список shared-привязок (любой студент видит то, что куратор закрепил).
smetaTrainerRouter.get("/material-overrides", readLimiter, async (_req, res) => {
  const all = await loadOverrides();
  res.json({ overrides: Object.values(all) });
});

// ── POST /material-overrides ───────────────────────────────────────
// body: { name, unit, sscCode (string|null), sscName?, smetnaya?, otpusknaya?, sscBook? }
// Запись доступна только при авторизации (JWT в Authorization: Bearer ...).
// Это «куратор/админ» — для shared overrides нужна явная привязка к userId.
smetaTrainerRouter.post("/material-overrides", writeLimiter, async (req, res) => {
  const userId = readUserIdFromBearer(req);
  if (!userId) return res.status(401).json({ error: "auth_required" });
  const { name, unit, sscCode, sscName, smetnaya, otpusknaya, sscBook } = req.body ?? {};
  if (typeof name !== "string" || name.length < 1 || name.length > 200) {
    return res.status(400).json({ error: "bad_name" });
  }
  if (typeof unit !== "string" || unit.length < 1 || unit.length > 20) {
    return res.status(400).json({ error: "bad_unit" });
  }
  if (sscCode !== null && (typeof sscCode !== "string" || !/^\d{3}-\d{3}-\d{4}$/.test(sscCode))) {
    return res.status(400).json({ error: "bad_sscCode" });
  }
  const all = await loadOverrides();
  const rec: OverrideRecord = {
    name, unit, sscCode,
    sscName: typeof sscName === "string" ? sscName.slice(0, 200) : undefined,
    smetnaya: typeof smetnaya === "number" && smetnaya >= 0 ? smetnaya : undefined,
    otpusknaya: typeof otpusknaya === "number" ? otpusknaya : null,
    sscBook: typeof sscBook === "string" ? sscBook.slice(0, 80) : undefined,
    setBy: userId,
    setAt: Date.now(),
  };
  all[overrideKey(name, unit)] = rec;
  await saveOverrides(all);
  res.json({ override: rec });
});

// ── DELETE /material-overrides ─────────────────────────────────────
// query: ?name=...&unit=...
smetaTrainerRouter.delete("/material-overrides", writeLimiter, async (req, res) => {
  const userId = readUserIdFromBearer(req);
  if (!userId) return res.status(401).json({ error: "auth_required" });
  const name = String(req.query.name ?? "");
  const unit = String(req.query.unit ?? "");
  if (!name || !unit) return res.status(400).json({ error: "bad_query" });
  const all = await loadOverrides();
  const key = overrideKey(name, unit);
  if (!(key in all)) return res.status(404).json({ error: "not_found" });
  delete all[key];
  await saveOverrides(all);
  res.json({ ok: true });
});
