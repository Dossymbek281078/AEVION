import { Router, Request, Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { makeServiceCapture } from "../lib/sentry/platform";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQLearnTables, isQLearnDbReady } from "../lib/ensureQLearnTables";
import { callProvider, getProviders } from "../services/qcoreai/providers";

/**
 * Признак того, что запись легла ТОЛЬКО в память процесса.
 *
 * Форма та же, что в остальных модулях: поле storage в теле ответа. Без него
 * 201 неотличим от настоящего сохранения — автор считает курс созданным, а тот
 * живёт до перезапуска сервиса.
 */
const MEMORY_NOTE = {
  storage: "memory" as const,
  warning: "Хранилище недоступно: запись сохранена только до перезапуска сервиса.",
};

const WARN =
  "Хранилище временно недоступно. Это НЕ значит, что записи нет — повторите запрос позже.";

const captureQLearnError = makeServiceCapture("qlearn");

/**
 * Register a completion certificate as a QRight IP object.
 * Fire-and-forget — failure doesn't break cert issuance.
 */
async function registerCertificateInQRight(cert: {
  certificateNumber: string;
  courseTitle: string;
  userId: string;
  completedAt: string;
}): Promise<void> {
  try {
    const raw = JSON.stringify({
      type: "learning_certificate",
      certificateNumber: cert.certificateNumber,
      courseTitle: cert.courseTitle,
      userId: cert.userId,
      completedAt: cert.completedAt,
      platform: "AEVION QLearn",
    });
    const contentHash = crypto.createHash("sha256").update(raw).digest("hex");
    const pool = getPool();
    await pool.query(
      `INSERT INTO "QRightObject"
         ("id","title","description","kind","contentHash","ownerUserId","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT DO NOTHING`,
      [
        crypto.randomUUID(),
        `Certificate: ${cert.courseTitle}`,
        `AEVION QLearn completion certificate ${cert.certificateNumber}. Issued ${cert.completedAt}.`,
        "text",
        contentHash,
        cert.userId,
      ],
    );
  } catch {
    // QRight registration is best-effort — cert still issued
  }
}

export const qlearnRouter = Router();

const pool = getPool();

// Bootstrap tables
(async () => {
  try {
    await ensureQLearnTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

/** Safely extract a route param as plain string */
function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

interface Course {
  id: string;
  authorId: string;
  title: string;
  description: string;
  category: string;
  level: string;
  price: number;
  isPublic: boolean;
  enrollmentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  videoUrl: string;
  duration: number;
  order: number;
  createdAt: string;
}

interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  progress: number;
  enrolledAt: string;
}

interface QuizQuestion {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
}

interface Certificate {
  id: string;
  enrollmentId: string;
  courseId: string;
  userId: string;
  courseTitle: string;
  completedAt: string;
  certificateNumber: string;
}

// In-memory fallback maps
const memCourses = new Map<string, Course>();
const memLessons = new Map<string, Lesson>();
const memEnrollments = new Map<string, Enrollment>();
// key: lessonId -> QuizQuestion[]
const memQuizzes = new Map<string, QuizQuestion[]>();
// key: enrollmentId -> Certificate
const memCertificates = new Map<string, Certificate>();

/* ── Хранилище сертификатов ──────────────────────────────────────────────────
 *
 * Таблицы у сертификатов не было ВООБЩЕ: они жили в Map выше, и после каждой
 * выкатки список у человека становился пустым, а запрос конкретного отвечал
 * 404. Выкаток бэкенда за сутки бывает шесть.
 *
 * Хуже потери была подмена. Повторное завершение курса выдавало НОВЫЙ номер и
 * ставило датой окончания сегодняшний день вместо настоящего — распечатанный
 * или отправленный работодателю сертификат переставал совпадать. И каждый раз
 * в QRight уходила ещё одна регистрация того же достижения.
 *
 * Слой ниже прячет развилку «база или память» от восьми мест, которые ею
 * пользовались. Развилка в одном месте — значит и чинить её потом в одном.
 */

function rowToCert(r: Record<string, unknown>): Certificate {
  const at = r.completedAt;
  return {
    id: String(r.id),
    enrollmentId: String(r.enrollmentId),
    courseId: String(r.courseId),
    userId: String(r.userId),
    courseTitle: String(r.courseTitle ?? ""),
    certificateNumber: String(r.certificateNumber),
    completedAt: at instanceof Date ? at.toISOString() : String(at),
  };
}

/**
 * Прочитать зачисление ТАК ЖЕ, как оно записано.
 *
 * Замер 23.08.2026: `POST /courses/:id/enroll` при живой базе пишет в Postgres
 * и в memEnrollments НЕ дублирует, а `POST /enrollments/:id/complete` читал
 * ИМЕННО память — то есть на проде отвечал «Enrollment not found» о зачислении,
 * которое сам же создал минуту назад. Курс нельзя было завершить, а сертификат
 * получить, НИКОГДА, пока база жива. Тестов на это не было: все проверки шли по
 * пути «базы нет», где память и есть хранилище.
 *
 * `failed` отличает «зачисления нет» от «спросить не удалось»: первое — 404,
 * второе — 503. Неотвеченный вопрос не равен отсутствию.
 */
async function enrollmentById(
  id: string,
): Promise<{ enrollment: Enrollment | null; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM "QLearnEnrollment" WHERE "id" = $1`, [id]);
      return { enrollment: rows[0] ? (rows[0] as Enrollment) : null, failed: false };
    } catch (e) {
      console.error("[QLearn] enrollment read failed", e);
      return { enrollment: null, failed: true };
    }
  }
  return { enrollment: memEnrollments.get(id) ?? null, failed: false };
}

/**
 * Мои зачисления вместе с курсом — из того же хранилища, где они лежат.
 *
 * Замер 23.08.2026: `GET /me/progress` не обращался к базе НИ РАЗУ, читал
 * memEnrollments и memCourses. Контейнер на проде пересоздаётся при каждой
 * выкатке (за сутки бывает несколько), поэтому раздел «Continue learning»
 * на странице /qlearn был пуст ВСЕГДА — он питается именно этой ручкой.
 *
 * Новых таблиц не понадобилось: зачисления и курсы уже в базе. Тот же JOIN
 * раньше жил СВОЕЙ копией внутри `/me/enrollments`; теперь у обеих ручек один
 * источник, иначе получилось бы два способа спрашивать одно и то же.
 */
type EnrollmentWithCourse = Enrollment & {
  lastActivityAt: string | null;
  courseTitle: string | null;
  category: string | null;
  level: string | null;
  description: string | null;
};

async function myEnrollments(
  userId: string,
): Promise<{ rows: EnrollmentWithCourse[]; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT e.*, c."title" AS "courseTitle", c."category", c."level", c."description"
           FROM "QLearnEnrollment" e
           JOIN "QLearnCourse" c ON c."id" = e."courseId"
          WHERE e."userId" = $1
          ORDER BY e."enrolledAt" DESC`,
        [userId],
      );
      return { rows: rows as EnrollmentWithCourse[], failed: false };
    } catch (e) {
      console.error("[QLearn] my enrollments read failed", e);
      return { rows: [], failed: true };
    }
  }
  const rows = Array.from(memEnrollments.values())
    .filter((e) => e.userId === userId)
    .map((e) => {
      const c = memCourses.get(e.courseId);
      return {
        ...e,
        lastActivityAt: memEnrollmentActivity.get(`${e.courseId}::${userId}`) ?? null,
        courseTitle: c?.title ?? null,
        category: c?.category ?? null,
        level: c?.level ?? null,
        description: c?.description ?? null,
      };
    });
  return { rows, failed: false };
}

/**
 * Сохранить урок. Один путь на обе ручки — обычное создание и генерацию ИИ.
 *
 * У генерации ИИ своей записи в базу не было вовсе: урок уходил в Map и
 * исчезал при ближайшей выкатке, а ответ был неотличим от настоящего
 * сохранения. Это при том, что «AI-тренер» стоит в описании товара.
 */
async function lessonSave(lesson: Lesson): Promise<{ failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QLearnLesson"
         ("id","courseId","title","content","videoUrl","duration","order","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [lesson.id, lesson.courseId, lesson.title, lesson.content,
         lesson.videoUrl, lesson.duration, lesson.order, lesson.createdAt],
      );
      return { failed: false };
    } catch (e) {
      console.error("[QLearn] lesson insert failed", e);
      return { failed: true };
    }
  }
  memLessons.set(lesson.id, lesson);
  return { failed: false };
}

/** Сколько уроков уже в курсе — для порядкового номера следующего. */
async function lessonCount(courseId: string): Promise<number> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM "QLearnLesson" WHERE "courseId" = $1`, [courseId]);
      return Number(rows[0]?.n ?? 0);
    } catch (e) {
      console.error("[QLearn] lesson count failed", e);
      return 0;
    }
  }
  return Array.from(memLessons.values()).filter((l) => l.courseId === courseId).length;
}

/** Вопросы теста к уроку — слой хранилища. */
async function quizAdd(q: QuizQuestion): Promise<{ failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QLearnQuiz" ("id","lessonId","question","options","correctIndex","explanation")
         VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
        [q.id, q.lessonId, q.question, JSON.stringify(q.options), q.correctIndex, q.explanation],
      );
      return { failed: false };
    } catch (e) {
      console.error("[QLearn] quiz insert failed", e);
      return { failed: true };
    }
  }
  const existing = memQuizzes.get(q.lessonId) ?? [];
  existing.push(q);
  memQuizzes.set(q.lessonId, existing);
  return { failed: false };
}

async function quizzesOf(lessonId: string): Promise<{ rows: QuizQuestion[]; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM "QLearnQuiz" WHERE "lessonId" = $1 ORDER BY "createdAt"`, [lessonId]);
      return {
        rows: rows.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          lessonId: String(r.lessonId),
          question: String(r.question),
          options: Array.isArray(r.options) ? (r.options as string[]) : [],
          correctIndex: Number(r.correctIndex),
          explanation: r.explanation === null || r.explanation === undefined ? null : String(r.explanation),
        })),
        failed: false,
      };
    } catch (e) {
      console.error("[QLearn] quiz list failed", e);
      return { rows: [], failed: true };
    }
  }
  return { rows: memQuizzes.get(lessonId) ?? [], failed: false };
}

/**
 * Закладки и дни активности — слой хранилища.
 *
 * До 23.08.2026 обе жили ТОЛЬКО в Map: замер дал ноль обращений к базе внутри
 * `/me/bookmarks`, `/me/streak` и обеих записей. На проде это значит, что
 * закладка исчезала при ближайшей выкатке, а серия дней обнулялась вместе с
 * ней — и человек видел не «сбой», а «я, оказывается, ничего не отмечал».
 *
 * Возвращаем `failed` там, где иначе пришлось бы выдать ПУСТОТУ за ответ.
 */
async function bookmarkAdd(userId: string, courseId: string): Promise<{ created: boolean; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const r = await pool.query(
        `INSERT INTO "QLearnBookmark" ("userId","courseId") VALUES ($1,$2)
         ON CONFLICT ("userId","courseId") DO NOTHING`,
        [userId, courseId],
      );
      return { created: (r.rowCount ?? 0) > 0, failed: false };
    } catch (e) {
      console.error("[QLearn] bookmark add failed", e);
      return { created: false, failed: true };
    }
  }
  const key = `${userId}::${courseId}`;
  if (memBookmarks.has(key)) return { created: false, failed: false };
  memBookmarks.set(key, { courseId, userId, bookmarkedAt: new Date().toISOString() });
  return { created: true, failed: false };
}

async function bookmarkRemove(userId: string, courseId: string): Promise<{ removed: boolean; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const r = await pool.query(
        `DELETE FROM "QLearnBookmark" WHERE "userId" = $1 AND "courseId" = $2`,
        [userId, courseId],
      );
      return { removed: (r.rowCount ?? 0) > 0, failed: false };
    } catch (e) {
      console.error("[QLearn] bookmark remove failed", e);
      return { removed: false, failed: true };
    }
  }
  return { removed: memBookmarks.delete(`${userId}::${courseId}`), failed: false };
}

async function bookmarksOf(
  userId: string,
): Promise<{ rows: Array<{ courseId: string; bookmarkedAt: string }>; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT "courseId", "bookmarkedAt" FROM "QLearnBookmark"
          WHERE "userId" = $1 ORDER BY "bookmarkedAt" DESC`,
        [userId],
      );
      return {
        rows: rows.map((r: { courseId: string; bookmarkedAt: unknown }) => ({
          courseId: r.courseId,
          bookmarkedAt: new Date(String(r.bookmarkedAt)).toISOString(),
        })),
        failed: false,
      };
    } catch (e) {
      console.error("[QLearn] bookmark list failed", e);
      return { rows: [], failed: true };
    }
  }
  const rows = Array.from(memBookmarks.values())
    .filter((b) => b.userId === userId)
    .map((b) => ({ courseId: b.courseId, bookmarkedAt: b.bookmarkedAt }))
    .sort((a, b) => b.bookmarkedAt.localeCompare(a.bookmarkedAt));
  return { rows, failed: false };
}

/**
 * Отметить день активности. Идемпотентно по паре (человек, день).
 *
 * Отказ НЕ роняет операцию, ради которой отметка ставится (урок, тест,
 * прогресс), но и не остаётся невидимым: пишем в журнал ЧТО и КОМУ не
 * удалось — след без этих двух вещей бесполезен.
 */
async function activityRecord(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (isQLearnDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QLearnActivity" ("userId","day") VALUES ($1,$2::date)
         ON CONFLICT ("userId","day") DO NOTHING`,
        [userId, today],
      );
      return;
    } catch (e) {
      console.error(`[QLearn] activity not recorded for user ${userId} on ${today}`, e);
      return;
    }
  }
  const rec = memActivity.get(userId) ?? { days: new Set<string>(), lastTouched: new Date().toISOString() };
  rec.days.add(today);
  rec.lastTouched = new Date().toISOString();
  memActivity.set(userId, rec);
}

async function activityDays(
  userId: string,
): Promise<{ days: Set<string>; lastTouched: string | null; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT "day", "touchedAt" FROM "QLearnActivity" WHERE "userId" = $1 ORDER BY "day" DESC`,
        [userId],
      );
      const days = new Set<string>(
        rows.map((r: { day: unknown }) => new Date(String(r.day)).toISOString().slice(0, 10)),
      );
      const lastTouched = rows[0] ? new Date(String(rows[0].touchedAt)).toISOString() : null;
      return { days, lastTouched, failed: false };
    } catch (e) {
      console.error("[QLearn] activity read failed", e);
      return { days: new Set<string>(), lastTouched: null, failed: true };
    }
  }
  const rec = memActivity.get(userId);
  return { days: rec?.days ?? new Set<string>(), lastTouched: rec?.lastTouched ?? null, failed: false };
}

/**
 * Курс по идентификатору — ЕДИНСТВЕННЫЙ читатель таблицы курсов по id.
 *
 * Раньше их было три: за названием для сертификата, за карточкой для списка
 * закладок и за автором для проверки прав. Три способа спросить одно и то же
 * расходятся при первой же правке, поэтому здесь один, а вызывающие берут
 * нужные поля сами.
 *
 * `failed` отличает «курса нет» от «спросить не удалось».
 */
async function courseById(courseId: string): Promise<{ course: Course | null; failed: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM "QLearnCourse" WHERE "id" = $1`, [courseId]);
      return { course: rows[0] ? (rows[0] as Course) : null, failed: false };
    } catch (e) {
      console.error("[QLearn] course read failed", e);
      return { course: null, failed: true };
    }
  }
  return { course: memCourses.get(courseId) ?? null, failed: false };
}

/**
 * Создать сертификат ОДИН раз на зачисление.
 *
 * ON CONFLICT DO NOTHING + повторное чтение: если сертификат уже есть,
 * возвращаем существующий, а не выдаём второй с новым номером и сегодняшней
 * датой. Именно это и было главным дефектом.
 */
async function certIssue(cert: Certificate): Promise<{ cert: Certificate; created: boolean }> {
  if (isQLearnDbReady()) {
    try {
      const ins = await pool.query(
        `INSERT INTO "QLearnCertificate"
           ("id","enrollmentId","courseId","userId","courseTitle","certificateNumber","completedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT ("enrollmentId") DO NOTHING
         RETURNING *`,
        [cert.id, cert.enrollmentId, cert.courseId, cert.userId, cert.courseTitle,
         cert.certificateNumber, cert.completedAt],
      );
      if (ins.rows[0]) return { cert: rowToCert(ins.rows[0]), created: true };
      const cur = await pool.query(
        `SELECT * FROM "QLearnCertificate" WHERE "enrollmentId" = $1`, [cert.enrollmentId]);
      if (cur.rows[0]) return { cert: rowToCert(cur.rows[0]), created: false };
    } catch (e) {
      console.warn("[QLearn] certificate insert failed, falling back to memory:", e);
    }
  }
  const existing = memCertificates.get(cert.enrollmentId);
  if (existing) return { cert: existing, created: false };
  memCertificates.set(cert.enrollmentId, cert);
  return { cert, created: true };
}

async function certByEnrollment(enrollmentId: string): Promise<Certificate | null> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM "QLearnCertificate" WHERE "enrollmentId" = $1`, [enrollmentId]);
      if (rows[0]) return rowToCert(rows[0]);
    } catch (e) { console.warn("[QLearn] certificate read failed:", e); }
  }
  return memCertificates.get(enrollmentId) ?? null;
}

async function certByNumber(certificateNumber: string): Promise<Certificate | null> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM "QLearnCertificate" WHERE "certificateNumber" = $1`, [certificateNumber]);
      if (rows[0]) return rowToCert(rows[0]);
    } catch (e) { console.warn("[QLearn] certificate lookup failed:", e); }
  }
  return Array.from(memCertificates.values())
    .find((c) => c.certificateNumber === certificateNumber) ?? null;
}

async function certsByUser(userId: string): Promise<Certificate[]> {
  if (isQLearnDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM "QLearnCertificate" WHERE "userId" = $1 ORDER BY "completedAt" DESC`, [userId]);
      return rows.map(rowToCert);
    } catch (e) { console.warn("[QLearn] certificate list failed:", e); }
  }
  return Array.from(memCertificates.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
// Bookmarks: key = `${userId}::${courseId}` → { courseId, userId, bookmarkedAt }
const memBookmarks = new Map<string, { courseId: string; userId: string; bookmarkedAt: string }>();
// Streak/activity tracking: key = userId → { days: Set<YYYY-MM-DD>, lastTouched: ISO }
const memActivity = new Map<string, { days: Set<string>; lastTouched: string }>();
// Last activity per enrollment (courseId|userId) → ISO timestamp, for "Continue learning"
const memEnrollmentActivity = new Map<string, string>();

/** Compute current + longest streak from a set of YYYY-MM-DD strings. */
function computeStreak(days: Set<string>): { current: number; longest: number; totalDays: number } {
  if (days.size === 0) return { current: 0, longest: 0, totalDays: 0 };
  const sorted = Array.from(days).sort();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Longest run of consecutive days
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00Z").getTime();
    const cur = new Date(sorted[i] + "T00:00:00Z").getTime();
    if (cur - prev === 86_400_000) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current streak: walk backwards from today (or yesterday if today not present yet)
  let cursorIso = days.has(today) ? today : (days.has(yesterday) ? yesterday : null);
  let current = 0;
  while (cursorIso && days.has(cursorIso)) {
    current++;
    const prev = new Date(new Date(cursorIso + "T00:00:00Z").getTime() - 86_400_000);
    cursorIso = prev.toISOString().slice(0, 10);
  }

  return { current, longest, totalDays: days.size };
}

const CATEGORIES = [
  { id: "tech", name: "Technology" },
  { id: "business", name: "Business" },
  { id: "design", name: "Design" },
  { id: "music", name: "Music" },
  { id: "language", name: "Language" },
  { id: "other", name: "Other" },
];

// GET /api/qlearn/health
qlearnRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "qlearn",
    db: isQLearnDbReady() ? "postgres" : "in-memory",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/qlearn/categories
qlearnRouter.get("/categories", (_req: Request, res: Response) => {
  res.json({ categories: CATEGORIES });
});

// GET /api/qlearn/courses
qlearnRouter.get("/courses", async (req: Request, res: Response) => {
  const category = req.query.category ? String(req.query.category) : undefined;
  const level = req.query.level ? String(req.query.level) : undefined;
  const q = req.query.q ? String(req.query.q) : undefined;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 50);

  if (isQLearnDbReady()) {
    try {
      const conditions: string[] = ['"isPublic" = TRUE'];
      const params: unknown[] = [];
      if (category) { params.push(category); conditions.push(`"category" = $${params.length}`); }
      if (level) { params.push(level); conditions.push(`"level" = $${params.length}`); }
      if (q) { params.push(`%${q}%`); conditions.push(`("title" ILIKE $${params.length} OR "description" ILIKE $${params.length})`); }
      params.push(limit);
      const where = `WHERE ${conditions.join(" AND ")}`;
      const rows = await pool.query(
        `SELECT * FROM "QLearnCourse" ${where} ORDER BY "enrollmentCount" DESC LIMIT $${params.length}`,
        params,
      );
      res.json({ courses: rows.rows, total: rows.rowCount ?? rows.rows.length });
      return;
    } catch (e) {
      // Голый catch без возврата уводил управление ниже, в память (в проде
      // пустую), и курс объявлялся несуществующим. Ответ «Course not found» на
      // отказ базы — законный и потому незаметный.
      console.error("[QLearn] GET /courses DB error", e);
      res.status(503).json({ error: "storage_unavailable", warning: WARN });
      return;
    }
  }

  let courses = Array.from(memCourses.values()).filter((c) => c.isPublic);
  if (category) courses = courses.filter((c) => c.category === category);
  if (level) courses = courses.filter((c) => c.level === level);
  if (q) courses = courses.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  courses.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
  courses = courses.slice(0, limit);
  res.json({ courses, total: courses.length });
});

// GET /api/qlearn/courses/:id
qlearnRouter.get("/courses/:id", async (req: Request, res: Response) => {
  const id = param(req, "id");
  if (isQLearnDbReady()) {
    try {
      const row = await pool.query(`SELECT * FROM "QLearnCourse" WHERE "id" = $1`, [id]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Course not found" }); return; }
      const lessons = await pool.query(
        `SELECT "id","title","order","duration" FROM "QLearnLesson" WHERE "courseId" = $1 ORDER BY "order"`,
        [id],
      );
      res.json({ course: row.rows[0], lessons: lessons.rows });
      return;
    } catch (e) {
      // Голый catch без возврата уводил управление ниже, в память — в
      // проде она пуста, и запись объявлялась несуществующей. «Не
      // найдено» на отказ базы законно и потому незаметно.
      console.error("[QLearn] GET /courses/:id DB error", e);
      res.status(503).json({ error: "storage_unavailable", warning: WARN });
      return;
    }
  }
  const course = memCourses.get(id);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  const lessons = Array.from(memLessons.values())
    .filter((l) => l.courseId === id)
    .map(({ id: lid, title, order, duration }) => ({ id: lid, title, order, duration }))
    .sort((a, b) => a.order - b.order);
  res.json({ course, lessons });
});

// POST /api/qlearn/me/courses — create course
qlearnRouter.post("/me/courses", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const { title, description, category, level, price } = req.body as {
    title?: string; description?: string; category?: string; level?: string; price?: number;
  };
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if (!category) { res.status(400).json({ error: "category is required" }); return; }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const course: Course = {
    id: newId,
    authorId: auth.sub,
    title: title.trim(),
    description: description?.trim() || "",
    category,
    level: level || "beginner",
    price: Number(price) || 0,
    isPublic: true,
    enrollmentCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (isQLearnDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QLearnCourse"
         ("id","authorId","title","description","category","level","price","isPublic","enrollmentCount","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [course.id, course.authorId, course.title, course.description, course.category,
         course.level, course.price, course.isPublic, course.enrollmentCount, course.createdAt, course.updatedAt],
      );
      res.status(201).json({ course });
      return;
    } catch (e) {
      // Курс, созданный ТОЛЬКО в памяти одного процесса, не создан: автор
      // добавит к нему уроки и потеряет всё при перезапуске. Признак в теле
      // (MEMORY_NOTE) честен, но состояние всё равно ловушка — поэтому отказ.
      // Ниже по файлу тот же выбор сделан для записи на курс (21.08).
      console.error("[QLearn] POST /courses DB error", e);
      res.status(503).json({ error: "storage_unavailable", warning: WARN });
      return;
    }
  }
  // Сюда попадаем, только если базы НЕТ ВОВСЕ: тогда память И ЕСТЬ хранилище,
  // и сказать об этом надо — но отказывать не в чем.
  memCourses.set(newId, course);
  res.status(201).json({ course, ...MEMORY_NOTE });
});

// POST /api/qlearn/me/courses/:id/lessons
qlearnRouter.post("/me/courses/:id/lessons", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "id");

  const { title, content, videoUrl, duration, order } = req.body as {
    title?: string; content?: string; videoUrl?: string; duration?: number; order?: number;
  };
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }

  if (isQLearnDbReady()) {
    try {
      const courseRow = await pool.query(`SELECT "authorId" FROM "QLearnCourse" WHERE "id" = $1`, [courseId]);
      if (courseRow.rows.length === 0) { res.status(404).json({ error: "Course not found" }); return; }
      if (courseRow.rows[0].authorId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
    } catch (e) {
      // Отказ базы уводил в память: на проде она пуста, и автор существующего
      // курса получал «Course not found». Урок при этом не создавался.
      console.error("[QLearn] POST lessons DB error", e);
      res.status(503).json({ error: "storage_unavailable", warning: WARN });
      return;
    }
  } else {
    const course = memCourses.get(courseId);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    if (course.authorId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const lessonId = crypto.randomUUID();
  const now = new Date().toISOString();
  const lesson: Lesson = {
    id: lessonId,
    courseId,
    title: title.trim(),
    content: content || "",
    videoUrl: videoUrl || "",
    duration: Number(duration) || 0,
    order: Number(order) || 0,
    createdAt: now,
  };

  // Вторая try/catch этой ручки: первую (проверку прав) починили раньше, а эта
  // тихо роняла урок в память и отвечала 201 — автор считал урок созданным.
  const saved = await lessonSave(lesson);
  if (saved.failed) {
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  res.status(201).json(isQLearnDbReady() ? { lesson } : { lesson, ...MEMORY_NOTE });
});

// GET /api/qlearn/courses/:id/lessons/:lessonId
qlearnRouter.get("/courses/:id/lessons/:lessonId", async (req: Request, res: Response) => {
  const courseId = param(req, "id");
  const lessonId = param(req, "lessonId");
  if (isQLearnDbReady()) {
    try {
      const row = await pool.query(
        `SELECT * FROM "QLearnLesson" WHERE "id" = $1 AND "courseId" = $2`,
        [lessonId, courseId],
      );
      if (row.rows.length === 0) { res.status(404).json({ error: "Lesson not found" }); return; }
      res.json({ lesson: row.rows[0] });
      return;
    } catch (e) {
      // «Lesson not found» на отказ базы законен на вид и потому незаметен:
      // человек решает, что урока нет, и уходит с курса.
      console.error("[QLearn] GET lesson DB error", e);
      res.status(503).json({ error: "storage_unavailable", warning: WARN });
      return;
    }
  }
  const lesson = memLessons.get(lessonId);
  if (!lesson || lesson.courseId !== courseId) { res.status(404).json({ error: "Lesson not found" }); return; }
  res.json({ lesson });
});

// POST /api/qlearn/courses/:id/enroll
qlearnRouter.post("/courses/:id/enroll", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "id");

  if (isQLearnDbReady()) {
    try {
      const courseRow = await pool.query(`SELECT "id" FROM "QLearnCourse" WHERE "id" = $1`, [courseId]);
      if (courseRow.rows.length === 0) { res.status(404).json({ error: "Course not found" }); return; }
      const enrollmentId = crypto.randomUUID();
      const inserted = await pool.query(
        `INSERT INTO "QLearnEnrollment" ("id","courseId","userId","progress","enrolledAt")
         VALUES ($1,$2,$3,0,NOW())
         ON CONFLICT ("courseId","userId") DO NOTHING
         RETURNING "id"`,
        [enrollmentId, courseId, auth.sub],
      );
      if (inserted.rowCount && inserted.rowCount > 0) {
        await pool.query(
          `UPDATE "QLearnCourse" SET "enrollmentCount" = "enrollmentCount" + 1 WHERE "id" = $1`,
          [courseId],
        );
      }
      res.status(201).json({ enrollmentId });
      return;
    } catch (e) {
      // Отсюда управление уходило вниз, в память (в проде пустую), и студент
      // получал «Course not found» про существующий курс — а запись при этом
      // молча не происходила. Проверено контролем 21.08.2026: с живой базой
      // ручка отвечает 201, с упавшей — 404.
      console.error("[QLearn] enroll DB error", e);
      res.status(503).json({
        error: "storage_unavailable",
        warning:
          "Хранилище временно недоступно. Запись на курс НЕ сохранена — " +
          "повторите попытку позже.",
      });
      return;
    }
  }
  const course = memCourses.get(courseId);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  const existing = Array.from(memEnrollments.values()).find(
    (e) => e.courseId === courseId && e.userId === auth.sub,
  );
  if (existing) { res.status(201).json({ enrollmentId: existing.id }); return; }
  const enrollmentId = crypto.randomUUID();
  memEnrollments.set(enrollmentId, {
    id: enrollmentId,
    courseId,
    userId: auth.sub,
    progress: 0,
    enrolledAt: new Date().toISOString(),
  });
  course.enrollmentCount += 1;
  await activityRecord(auth.sub);
  memEnrollmentActivity.set(`${courseId}::${auth.sub}`, new Date().toISOString());
  res.status(201).json({ enrollmentId });
});

// GET /api/qlearn/me/enrollments
qlearnRouter.get("/me/enrollments", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const { rows, failed } = await myEnrollments(auth.sub);
  if (failed) {
    // Пустой список на отказ базы читается как «вы никуда не записаны»,
    // и человек записывается заново, платя второй раз за тот же курс.
    res.status(503).json({ error: "storage_unavailable", warning: WARN });
    return;
  }
  res.json({ enrollments: rows, total: rows.length });
});

// PATCH /api/qlearn/enrollments/:id/progress
qlearnRouter.patch("/enrollments/:id/progress", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const enrollmentId = param(req, "id");

  const { progress } = req.body as { progress?: number };
  if (typeof progress !== "number" || progress < 0 || progress > 100) {
    res.status(400).json({ error: "progress must be a number 0-100" });
    return;
  }

  // Раньше у ветки с живой базой был СВОЙ выход (res.json + return) до общего
  // хвоста, и потому на проде не отрабатывало ничего из того, что ниже:
  // ни отметка активности, ни выдача сертификата при 100%. Оба удобства
  // работали только там, где база отсутствует, — то есть в тестах.
  let enrollment: Enrollment | null = null;

  if (isQLearnDbReady()) {
    try {
      const row = await pool.query(`SELECT "userId" FROM "QLearnEnrollment" WHERE "id" = $1`, [enrollmentId]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Enrollment not found" }); return; }
      if (row.rows[0].userId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
      const updated = await pool.query(
        `UPDATE "QLearnEnrollment" SET "progress" = $2, "lastActivityAt" = NOW()
          WHERE "id" = $1 RETURNING *`,
        [enrollmentId, progress],
      );
      enrollment = updated.rows[0] as Enrollment;
    } catch (e) {
      // Голый catch уводил управление вниз, в память: на проде она пуста, и
      // отказ базы отвечал «Enrollment not found» либо тихо писал прогресс в
      // память процесса и объявлял успех.
      console.error("[QLearn] PATCH progress DB error", e);
      res.status(503).json({ error: "storage_unavailable", warning: WARN });
      return;
    }
  } else {
    const mem = memEnrollments.get(enrollmentId);
    if (!mem) { res.status(404).json({ error: "Enrollment not found" }); return; }
    if (mem.userId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
    mem.progress = progress;
    enrollment = mem;
  }

  // Streak + "continue learning" hooks
  await activityRecord(auth.sub);
  memEnrollmentActivity.set(`${enrollment.courseId}::${auth.sub}`, new Date().toISOString());

  // Auto-generate certificate at 100%
  //
  // certIssue() сам решает, выдавать ли новый: при повторном вызове вернёт
  // существующий. Раньше проверка была `!memCertificates.has(...)`, и после
  // перезапуска она отвечала «нет такого» — рождался второй сертификат с новым
  // номером, сегодняшней датой и ещё одной регистрацией в QRight.
  if (progress === 100) {
    const courseTitle = (await courseById(enrollment.courseId)).course?.title ?? null;
    const { cert, created } = await certIssue({
      id: crypto.randomUUID(),
      enrollmentId,
      courseId: enrollment.courseId,
      userId: auth.sub,
      courseTitle: courseTitle ?? "Unknown Course",
      completedAt: new Date().toISOString(),
      certificateNumber: "AEVION-" + Date.now(),
    });
    // В реестр — только при ПЕРВОЙ выдаче, иначе там копится по записи на
    // каждую выкатку, все про одно достижение.
    if (created) void registerCertificateInQRight(cert);
  }

  res.json({ enrollment });
});

// POST /api/qlearn/enrollments/:id/complete — manually mark as complete + issue cert
qlearnRouter.post("/enrollments/:id/complete", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const enrollmentId = param(req, "id");

  const { enrollment, failed } = await enrollmentById(enrollmentId);
  if (failed) {
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  if (!enrollment) { res.status(404).json({ error: "Enrollment not found" }); return; }
  if (enrollment.userId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
  if (Number(enrollment.progress) !== 100) {
    res.status(400).json({ error: "progress must be 100 to complete" }); return;
  }

  const already = await certByEnrollment(enrollmentId);
  if (already) { res.json({ certificate: already }); return; }

  const courseTitle = (await courseById(enrollment.courseId)).course?.title ?? null;
  const cert: Certificate = {
    id: crypto.randomUUID(),
    enrollmentId,
    courseId: enrollment.courseId,
    userId: auth.sub,
    courseTitle: courseTitle ?? "Unknown Course",
    completedAt: new Date().toISOString(),
    certificateNumber: "AEVION-" + Date.now(),
  };
  const { cert: issued, created } = await certIssue(cert);
  if (created) void registerCertificateInQRight(issued);
  // qrightRegistered больше не утверждается наперёд: регистрация запускается
  // без ожидания, и до 19.08.2026 ответ объявлял успех, которого ещё не знал.
  res.status(201).json({ certificate: issued, qrightRegistrationStarted: created });
});

// GET /api/qlearn/enrollments/:id/certificate — get certificate for enrollment
qlearnRouter.get("/enrollments/:id/certificate", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const enrollmentId = param(req, "id");

  const cert = await certByEnrollment(enrollmentId);
  if (!cert) { res.status(404).json({ error: "Certificate not found" }); return; }
  if (cert.userId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ certificate: cert });
});

// GET /api/qlearn/me/certificates — all my certificates
qlearnRouter.get("/me/certificates", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const certs = await certsByUser(auth.sub);
  res.json({ certificates: certs, total: certs.length });
});

// GET /api/qlearn/certificates/:certificateNumber — public certificate verification
qlearnRouter.get("/certificates/:certificateNumber", async (req: Request, res: Response) => {
  const certNumber = req.params.certificateNumber;
  const cert = await certByNumber(String(certNumber));
  if (!cert) {
    res.json({ valid: false });
    return;
  }
  res.json({
    valid: true,
    courseTitle: cert.courseTitle,
    completedAt: cert.completedAt,
    userId: cert.userId,
  });
});

// POST /api/qlearn/certificates/batch-verify — verify multiple certificates at once
qlearnRouter.post("/certificates/batch-verify", async (req: Request, res: Response) => {
  const body = req.body as { certificateNumbers?: unknown };
  const nums = Array.isArray(body.certificateNumbers) ? body.certificateNumbers.slice(0, 50) : [];
  if (nums.length === 0) {
    res.status(400).json({ error: "certificateNumbers array required (max 50)" }); return;
  }
  const results = await Promise.all(nums.map(async (rawNum) => {
    const num = String(rawNum).slice(0, 100);
    const cert = await certByNumber(num);
    if (!cert) return { certificateNumber: num, valid: false };
    return {
      certificateNumber: num,
      valid: true,
      courseTitle: cert.courseTitle,
      completedAt: cert.completedAt,
    };
  }));
  const valid = results.filter((r) => r.valid).length;
  res.json({ results, summary: { total: results.length, valid, invalid: results.length - valid } });
});

// GET /api/qlearn/me/certificates/count — quick count of user's certificates (no full list)
qlearnRouter.get("/me/certificates/count", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const count = (await certsByUser(auth.sub)).length;
  res.json({ count, userId: auth.sub });
});

// POST /api/qlearn/me/courses/:courseId/lessons/:lessonId/quiz — add quiz question (author only)
qlearnRouter.post("/me/courses/:courseId/lessons/:lessonId/quiz", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");

  // Проверка прав шла по memCourses: при живой базе курс там отсутствует, и
  // автор получал «Course not found» о СВОЁМ существующем курсе.
  const { course, failed: courseFailed } = await courseById(courseId);
  if (courseFailed) {
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.authorId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }

  const { question, options, correctIndex, explanation } = req.body as {
    question?: string;
    options?: string[];
    correctIndex?: number;
    explanation?: string;
  };
  if (!question || typeof question !== "string") { res.status(400).json({ error: "question is required" }); return; }
  if (!Array.isArray(options) || options.length < 2) { res.status(400).json({ error: "options must be array with >=2 items" }); return; }
  if (typeof correctIndex !== "number" || correctIndex < 0 || correctIndex >= options.length) {
    res.status(400).json({ error: "correctIndex must be valid index into options" }); return;
  }

  const q: QuizQuestion = {
    id: crypto.randomUUID(),
    lessonId,
    question: question.trim(),
    options: options.map(String),
    correctIndex,
    explanation: explanation ? String(explanation).trim() : null,
  };
  const { failed } = await quizAdd(q);
  if (failed) {
    // «Вопрос добавлен» о том, чего нет, — автор соберёт тест и потеряет его.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  res.status(201).json({ question: q });
});

// GET /api/qlearn/courses/:courseId/lessons/:lessonId/quiz — get quiz questions (correctIndex hidden for non-authors)
qlearnRouter.get("/courses/:courseId/lessons/:lessonId/quiz", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  // isAuthor тоже считался по memCourses: при живой базе он был ложью ВСЕГДА,
  // и автор не видел правильных ответов в собственном тесте.
  const { course } = await courseById(courseId);
  const isAuthor = Boolean(auth && course && course.authorId === auth.sub);
  const { rows, failed } = await quizzesOf(lessonId);
  if (failed) {
    // Пустой тест читается как «вопросов нет», а не как сбой.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  const questions = rows.map((q) => {
    if (isAuthor) return q;
    const { correctIndex: _ci, explanation: _exp, ...safe } = q;
    void _ci; void _exp;
    return safe;
  });
  res.json({ questions, total: questions.length });
});

// POST /api/qlearn/courses/:courseId/lessons/:lessonId/quiz/submit — submit answer
qlearnRouter.post("/courses/:courseId/lessons/:lessonId/quiz/submit", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const lessonId = param(req, "lessonId");
  const { questionId, answerIndex } = req.body as { questionId?: string; answerIndex?: number };
  if (!questionId) { res.status(400).json({ error: "questionId is required" }); return; }
  if (typeof answerIndex !== "number") { res.status(400).json({ error: "answerIndex is required" }); return; }

  const { rows: questions, failed } = await quizzesOf(lessonId);
  if (failed) {
    // «Вопрос не найден» о вопросе, который человек видит на экране, —
    // законный на вид ответ и потому незаметный.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  const q = questions.find((qq) => qq.id === questionId);
  if (!q) { res.status(404).json({ error: "Question not found" }); return; }

  const correct = answerIndex === q.correctIndex;
  await activityRecord(auth.sub);
  res.json({ correct, explanation: q.explanation ?? undefined, correctIndex: q.correctIndex });
});

// ---------------------------------------------------------------------------
// Bookmarks — POST/DELETE/GET — save courses for later
// ---------------------------------------------------------------------------

// POST /api/qlearn/courses/:id/bookmark — bookmark a course
qlearnRouter.post("/courses/:id/bookmark", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "id");
  if (!isQLearnDbReady() && memCourses.size > 0 && !memCourses.has(courseId)) {
    res.status(404).json({ error: "Course not found" }); return;
  }
  const { created, failed } = await bookmarkAdd(auth.sub, courseId);
  if (failed) {
    // Молча ответить «отмечено» нельзя: человек уйдёт со страницы, уверенный,
    // что курс сохранён, и не найдёт его.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  if (!created) { res.status(200).json({ bookmarked: true, alreadyBookmarked: true }); return; }
  res.status(201).json({ bookmarked: true });
});

// DELETE /api/qlearn/courses/:id/bookmark — remove bookmark
qlearnRouter.delete("/courses/:id/bookmark", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "id");
  const { removed, failed } = await bookmarkRemove(auth.sub, courseId);
  if (failed) {
    // «Снято» о том, что осталось на месте, — та же ложь, только наоборот.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  res.json({ bookmarked: false, removed });
});

// GET /api/qlearn/me/bookmarks — list my bookmarked courses (hydrated)
qlearnRouter.get("/me/bookmarks", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const { rows, failed } = await bookmarksOf(auth.sub);
  if (failed) {
    // Пустой список читается как «я ничего не отмечал», а не как сбой.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  const items = await Promise.all(
    rows.map(async (b) => {
      const c = (await courseById(b.courseId)).course;
      const course = c
        ? {
            id: c.id, title: c.title, description: c.description, category: c.category,
            level: c.level, price: c.price, enrollmentCount: c.enrollmentCount,
          }
        : null;
      return { courseId: b.courseId, bookmarkedAt: b.bookmarkedAt, course };
    }),
  );
  res.json({ bookmarks: items, total: items.length });
});

// ---------------------------------------------------------------------------
// Streak + progress overview ("Continue learning")
// ---------------------------------------------------------------------------

// GET /api/qlearn/me/streak — current/longest daily streak + activity history
qlearnRouter.get("/me/streak", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const { days, lastTouched, failed } = await activityDays(auth.sub);
  if (failed) {
    // «Серия 0» — утверждение о человеке. Неотвеченный вопрос им не является.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (days.size === 0) {
    res.json({ current: 0, longest: 0, totalDays: 0, lastActiveAt: null, today, activeToday: false });
    return;
  }
  res.json({
    ...computeStreak(days),
    lastActiveAt: lastTouched,
    today,
    activeToday: days.has(today),
  });
});

// GET /api/qlearn/me/progress — overview of all my courses with continue-learning ordering
qlearnRouter.get("/me/progress", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  // Раньше здесь читалась ТОЛЬКО память: на проде она пуста после каждой
  // выкатки, и раздел «Continue learning» на странице был пуст всегда.
  const { rows: mine, failed } = await myEnrollments(auth.sub);
  if (failed) {
    // Пустая сводка на неотвеченный вопрос выглядит как «вы ничего не
    // проходите» — то есть отказ хранилища притворяется фактом о человеке.
    res.status(503).json({ error: "storage_unavailable", warning: WARN });
    return;
  }
  const certIds = new Set((await certsByUser(auth.sub)).map((c) => c.enrollmentId));
  const hydrated = mine.map((e) => {
    // Порядок «продолжить обучение» держится на этом поле. Колонка появилась
    // 23.08.2026; у записей, сделанных до неё, она пуста — тогда берём память
    // текущего процесса, а если и там пусто, дату записи на курс. Ни один из
    // трёх источников не выдаётся за другой: пустое значение не превращается
    // в «занимался только что».
    const lastActivityAt =
      (e.lastActivityAt ? new Date(String(e.lastActivityAt)).toISOString() : null) ??
      memEnrollmentActivity.get(`${e.courseId}::${auth.sub}`) ??
      e.enrolledAt;
    // Раньше смотрели ТОЛЬКО в память: после выкатки у человека оставался
    // курс, значок сертификата исчезал вместе с самим сертификатом.
    const hasCertificate = certIds.has(e.id);
    return {
      enrollmentId: e.id,
      courseId: e.courseId,
      progress: Number(e.progress),
      enrolledAt: e.enrolledAt,
      lastActivityAt,
      hasCertificate,
      course: e.courseTitle
        ? {
            id: e.courseId,
            title: e.courseTitle,
            category: e.category,
            level: e.level,
            description: e.description,
          }
        : null,
    };
  });

  const inProgress = hydrated
    .filter((h) => h.progress > 0 && h.progress < 100)
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  const notStarted = hydrated
    .filter((h) => h.progress === 0)
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
  const completed = hydrated
    .filter((h) => h.progress === 100)
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  const avgProgress = hydrated.length === 0
    ? 0
    : Math.round(hydrated.reduce((sum, h) => sum + h.progress, 0) / hydrated.length);

  res.json({
    summary: {
      total: hydrated.length,
      inProgress: inProgress.length,
      notStarted: notStarted.length,
      completed: completed.length,
      avgProgress,
    },
    continueLearning: inProgress.slice(0, 6),
    notStarted: notStarted.slice(0, 6),
    completed: completed.slice(0, 6),
  });
});

// POST /api/qlearn/me/courses/:courseId/ai-generate-lesson — AI lesson generator
// Ограничитель на платный ИИ (свип 06.09.2026: auth был, предела темпа не было).
const qlearnAiLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "qlearn-ai" });

qlearnRouter.post("/me/courses/:courseId/ai-generate-lesson", qlearnAiLimit, async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "courseId");

  // Права считались по memCourses: при живой базе курса там нет, поэтому автор
  // получал «Course not found» о СВОЁМ курсе — генерация ИИ не работала на
  // проде вовсе, хотя «AI-тренер» стоит в описании товара.
  const { course, failed: courseFailed } = await courseById(courseId);
  if (courseFailed) {
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  if (course.authorId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }

  const { topic } = req.body as { topic?: string };
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({ error: "topic is required" }); return;
  }

  let title = `Lesson: ${topic.trim()}`;
  let content = `This lesson covers: ${topic.trim()}`;
  let summary = `Introduction to ${topic.trim()}`;

  // Try AI generation
  const providers = getProviders();
  const configured = providers.filter((p) => p.configured);
  if (configured.length > 0) {
    try {
      const result = await callProvider(
        configured[0].id,
        [{ role: "user", content: `Generate a complete lesson about: ${topic.trim()}. Return JSON: {"title": string, "content": string, "summary": string}` }],
        configured[0].defaultModel,
        0.5,
      );
      const raw = result.reply.trim();
      const jsonStr = raw.startsWith("{") ? raw : (raw.match(/```(?:json)?\n?([\s\S]+?)```/)?.[1] ?? raw);
      const parsed = JSON.parse(jsonStr) as { title?: string; content?: string; summary?: string };
      if (parsed.title) title = String(parsed.title);
      if (parsed.content) content = String(parsed.content);
      if (parsed.summary) summary = String(parsed.summary);
    } catch {
      // fallback to stub already set above
    }
  }

  const lessonId = crypto.randomUUID();
  const nowTs = new Date().toISOString();
  const lesson: Lesson = {
    id: lessonId,
    courseId,
    title,
    content: `${content}\n\n**Summary:** ${summary}`,
    videoUrl: "",
    duration: 0,
    order: (await lessonCount(courseId)) + 1,
    createdAt: nowTs,
  };
  const saved = await lessonSave(lesson);
  if (saved.failed) {
    // Сгенерированный урок, лежащий в памяти одного процесса, не создан:
    // автор увидит «готово», а к вечеру урока не будет.
    res.status(503).json({ error: "storage_unavailable", warning: WARN }); return;
  }
  res.status(201).json(isQLearnDbReady() ? { lesson } : { lesson, ...MEMORY_NOTE });
});
