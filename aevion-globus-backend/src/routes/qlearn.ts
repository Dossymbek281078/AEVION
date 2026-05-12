import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQLearnTables, isQLearnDbReady } from "../lib/ensureQLearnTables";
import { callProvider, getProviders } from "../services/qcoreai/providers";

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

// In-memory fallback maps
const memCourses = new Map<string, Course>();
const memLessons = new Map<string, Lesson>();
const memEnrollments = new Map<string, Enrollment>();
// key: lessonId -> QuizQuestion[]
const memQuizzes = new Map<string, QuizQuestion[]>();

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
  const limit = Math.min(Number(req.query.limit) || 20, 50);

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
    } catch {
      // fall through
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
    } catch {
      // fall through
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
    } catch {
      // fall through
    }
  }
  memCourses.set(newId, course);
  res.status(201).json({ course });
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
    } catch {
      // fall through to in-memory check
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

  if (isQLearnDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QLearnLesson"
         ("id","courseId","title","content","videoUrl","duration","order","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [lesson.id, lesson.courseId, lesson.title, lesson.content,
         lesson.videoUrl, lesson.duration, lesson.order, lesson.createdAt],
      );
      res.status(201).json({ lesson });
      return;
    } catch {
      // fall through
    }
  }
  memLessons.set(lessonId, lesson);
  res.status(201).json({ lesson });
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
    } catch {
      // fall through
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
      await pool.query(
        `INSERT INTO "QLearnEnrollment" ("id","courseId","userId","progress","enrolledAt")
         VALUES ($1,$2,$3,0,NOW())
         ON CONFLICT ("courseId","userId") DO NOTHING`,
        [enrollmentId, courseId, auth.sub],
      );
      await pool.query(
        `UPDATE "QLearnCourse" SET "enrollmentCount" = "enrollmentCount" + 1 WHERE "id" = $1`,
        [courseId],
      );
      res.status(201).json({ enrollmentId });
      return;
    } catch {
      // fall through
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
  res.status(201).json({ enrollmentId });
});

// GET /api/qlearn/me/enrollments
qlearnRouter.get("/me/enrollments", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  if (isQLearnDbReady()) {
    try {
      const rows = await pool.query(
        `SELECT e.*, c."title" AS "courseTitle", c."category", c."level"
         FROM "QLearnEnrollment" e
         JOIN "QLearnCourse" c ON c."id" = e."courseId"
         WHERE e."userId" = $1
         ORDER BY e."enrolledAt" DESC`,
        [auth.sub],
      );
      res.json({ enrollments: rows.rows, total: rows.rowCount ?? rows.rows.length });
      return;
    } catch {
      // fall through
    }
  }
  const enrollments = Array.from(memEnrollments.values()).filter((e) => e.userId === auth.sub);
  res.json({ enrollments, total: enrollments.length });
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

  if (isQLearnDbReady()) {
    try {
      const row = await pool.query(`SELECT "userId" FROM "QLearnEnrollment" WHERE "id" = $1`, [enrollmentId]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Enrollment not found" }); return; }
      if (row.rows[0].userId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
      const updated = await pool.query(
        `UPDATE "QLearnEnrollment" SET "progress" = $2 WHERE "id" = $1 RETURNING *`,
        [enrollmentId, progress],
      );
      res.json({ enrollment: updated.rows[0] });
      return;
    } catch {
      // fall through
    }
  }
  const enrollment = memEnrollments.get(enrollmentId);
  if (!enrollment) { res.status(404).json({ error: "Enrollment not found" }); return; }
  if (enrollment.userId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
  enrollment.progress = progress;
  res.json({ enrollment });
});

// POST /api/qlearn/me/courses/:courseId/lessons/:lessonId/quiz — add quiz question (author only)
qlearnRouter.post("/me/courses/:courseId/lessons/:lessonId/quiz", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");

  // Verify author ownership
  const course = memCourses.get(courseId);
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
  const existing = memQuizzes.get(lessonId) ?? [];
  existing.push(q);
  memQuizzes.set(lessonId, existing);
  res.status(201).json({ question: q });
});

// GET /api/qlearn/courses/:courseId/lessons/:lessonId/quiz — get quiz questions (correctIndex hidden for non-authors)
qlearnRouter.get("/courses/:courseId/lessons/:lessonId/quiz", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const course = memCourses.get(courseId);
  const isAuthor = auth && course && course.authorId === auth.sub;
  const questions = (memQuizzes.get(lessonId) ?? []).map((q) => {
    if (isAuthor) return q;
    const { correctIndex: _ci, explanation: _exp, ...safe } = q;
    void _ci; void _exp;
    return safe;
  });
  res.json({ questions, total: questions.length });
});

// POST /api/qlearn/courses/:courseId/lessons/:lessonId/quiz/submit — submit answer
qlearnRouter.post("/courses/:courseId/lessons/:lessonId/quiz/submit", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const lessonId = param(req, "lessonId");
  const { questionId, answerIndex } = req.body as { questionId?: string; answerIndex?: number };
  if (!questionId) { res.status(400).json({ error: "questionId is required" }); return; }
  if (typeof answerIndex !== "number") { res.status(400).json({ error: "answerIndex is required" }); return; }

  const questions = memQuizzes.get(lessonId) ?? [];
  const q = questions.find((qq) => qq.id === questionId);
  if (!q) { res.status(404).json({ error: "Question not found" }); return; }

  const correct = answerIndex === q.correctIndex;
  res.json({ correct, explanation: q.explanation ?? undefined, correctIndex: q.correctIndex });
});

// POST /api/qlearn/me/courses/:courseId/ai-generate-lesson — AI lesson generator
qlearnRouter.post("/me/courses/:courseId/ai-generate-lesson", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const courseId = param(req, "courseId");

  const course = memCourses.get(courseId);
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
    order: (Array.from(memLessons.values()).filter((l) => l.courseId === courseId).length) + 1,
    createdAt: nowTs,
  };
  memLessons.set(lessonId, lesson);
  res.status(201).json({ lesson });
});
