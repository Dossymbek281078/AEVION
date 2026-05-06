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
//  GET  /api/smeta-trainer/student/:deviceId           — снимок прогресса студента
//  POST /api/smeta-trainer/student/:deviceId/sync      — upsert прогресса (idempotent)
//  POST /api/smeta-trainer/student/:deviceId/attempt   — записать попытку (quiz/exercise/lsr-submit)
//  GET  /api/smeta-trainer/student/:deviceId/attempts  — последние N попыток
//  GET  /api/smeta-trainer/leaderboard?level=N&limit=  — топ студентов по уровню (или общий)
//  GET  /api/smeta-trainer/stats                       — агрегаты для куратора

export const smetaTrainerRouter = Router();

const STUDENTS_FILE = "smeta_students.json";
const ATTEMPTS_FILE = "smeta_attempts.json";

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

interface StudentRecord {
  deviceId: string;
  userId: string | null;
  displayName: string | null;
  group: string | null;
  startedAt: number;
  updatedAt: number;
  levels: Record<string, LevelProgress>;
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
// query: ?level=N&limit=20  (level optional — если не задан, по сумме скоров)
smetaTrainerRouter.get("/leaderboard", readLimiter, async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const level = Number(req.query.level);
  const students = await loadStudents();
  const rows = Object.values(students).map((s) => {
    const levels = Object.values(s.levels ?? {});
    const totalScore = levels.reduce((a, l) => a + (l.score ?? 0), 0);
    const doneCount = levels.filter((l) => l.status === "done").length;
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
  res.json({
    studentsTotal: list.length,
    attemptsTotal: attempts.length,
    perLevel,
    lastUpdate: list.reduce((m, s) => Math.max(m, s.updatedAt), 0),
  });
});
