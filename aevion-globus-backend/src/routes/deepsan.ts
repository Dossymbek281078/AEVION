import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { getPool } from "../lib/dbPool";
import { ensureDeepSanTables, isDeepSanDbReady } from "../lib/ensureDeepSanTables";

export const deepSanRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureDeepSanTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

deepSanRouter.use(limiter);

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeepSanTask {
  id: number;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  done: boolean;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface DeepSanSession {
  id: number;
  task_id: number | null;
  duration_min: number;
  actual_duration_min: number | null;
  started_at: string;
  ended_at: string | null;
  status: "active" | "done" | "abandoned";
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

let memTaskSeq = 1;
let memSessionSeq = 1;
const memTasks = new Map<number, DeepSanTask>();
const memSessions = new Map<number, DeepSanSession>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

function validPriority(p: unknown): p is DeepSanTask["priority"] {
  return VALID_PRIORITIES.includes(p as DeepSanTask["priority"]);
}

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function fail(res: Response, message: string, status = 400): void {
  res.status(status).json({ success: false, error: message });
}

// ─── GET /api/deepsan/health ──────────────────────────────────────────────────

deepSanRouter.get("/health", (_req: Request, res: Response) => {
  ok(res, {
    module: "deepsan",
    db: isDeepSanDbReady() ? "postgres" : "in-memory",
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/deepsan/tasks ───────────────────────────────────────────────────

deepSanRouter.get("/tasks", async (req: Request, res: Response) => {
  const priority = req.query.priority as string | undefined;
  const done = req.query.done as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  if (isDeepSanDbReady()) {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (priority && validPriority(priority)) {
        conditions.push(`priority = $${idx++}`);
        params.push(priority);
      }
      if (done !== undefined) {
        conditions.push(`done = $${idx++}`);
        params.push(done === "true" || done === "1");
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit);
      const result = await pool.query(
        `SELECT * FROM deepsan_tasks ${where} ORDER BY created_at DESC LIMIT $${idx}`,
        params,
      );
      return ok(res, result.rows);
    } catch (e) {
      console.error("[DeepSan] GET /tasks db error:", e);
      return fail(res, "database error", 500);
    }
  }

  // in-memory
  let tasks = Array.from(memTasks.values());
  if (priority && validPriority(priority)) tasks = tasks.filter((t) => t.priority === priority);
  if (done !== undefined) {
    const wantDone = done === "true" || done === "1";
    tasks = tasks.filter((t) => t.done === wantDone);
  }
  tasks = tasks.slice(0, limit);
  return ok(res, tasks);
});

// ─── POST /api/deepsan/tasks ──────────────────────────────────────────────────

deepSanRouter.post("/tasks", async (req: Request, res: Response) => {
  const { title, description, priority = "medium", dueDate, tags } = req.body ?? {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return fail(res, "title is required");
  }
  if (!validPriority(priority)) {
    return fail(res, "priority must be low|medium|high|critical");
  }

  const titleClean = String(title).trim().slice(0, 512);
  const descClean = description ? String(description).trim().slice(0, 4096) : null;
  const dueDateClean = dueDate ? String(dueDate) : null;
  const tagsClean: string[] = Array.isArray(tags)
    ? tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20)
    : [];

  if (isDeepSanDbReady()) {
    try {
      const result = await pool.query(
        `INSERT INTO deepsan_tasks (title, description, priority, due_date, tags)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [titleClean, descClean, priority, dueDateClean, tagsClean],
      );
      return ok(res, result.rows[0], 201);
    } catch (e) {
      console.error("[DeepSan] POST /tasks db error:", e);
      return fail(res, "database error", 500);
    }
  }

  const now = new Date().toISOString();
  const task: DeepSanTask = {
    id: memTaskSeq++,
    title: titleClean,
    description: descClean,
    priority,
    done: false,
    due_date: dueDateClean,
    tags: tagsClean,
    created_at: now,
    updated_at: now,
  };
  memTasks.set(task.id, task);
  return ok(res, task, 201);
});

// ─── PATCH /api/deepsan/tasks/:id ────────────────────────────────────────────

deepSanRouter.patch("/tasks/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return fail(res, "invalid id");

  const { title, done, priority, dueDate } = req.body ?? {};
  if (priority !== undefined && !validPriority(priority)) {
    return fail(res, "priority must be low|medium|high|critical");
  }

  if (isDeepSanDbReady()) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let idx = 1;

      if (title !== undefined) { sets.push(`title = $${idx++}`); params.push(String(title).trim().slice(0, 512)); }
      if (done !== undefined)  { sets.push(`done = $${idx++}`);  params.push(Boolean(done)); }
      if (priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(priority); }
      if (dueDate !== undefined)  { sets.push(`due_date = $${idx++}`); params.push(dueDate || null); }

      params.push(id);
      const result = await pool.query(
        `UPDATE deepsan_tasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (!result.rowCount) return fail(res, "task not found", 404);
      return ok(res, result.rows[0]);
    } catch (e) {
      console.error("[DeepSan] PATCH /tasks/:id db error:", e);
      return fail(res, "database error", 500);
    }
  }

  const task = memTasks.get(id);
  if (!task) return fail(res, "task not found", 404);
  if (title !== undefined) task.title = String(title).trim().slice(0, 512);
  if (done !== undefined)  task.done = Boolean(done);
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined)  task.due_date = dueDate || null;
  task.updated_at = new Date().toISOString();
  return ok(res, task);
});

// ─── DELETE /api/deepsan/tasks/:id ───────────────────────────────────────────

deepSanRouter.delete("/tasks/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return fail(res, "invalid id");

  if (isDeepSanDbReady()) {
    try {
      const result = await pool.query("DELETE FROM deepsan_tasks WHERE id = $1 RETURNING id", [id]);
      if (!result.rowCount) return fail(res, "task not found", 404);
      return ok(res, { deleted: id });
    } catch (e) {
      console.error("[DeepSan] DELETE /tasks/:id db error:", e);
      return fail(res, "database error", 500);
    }
  }

  if (!memTasks.has(id)) return fail(res, "task not found", 404);
  memTasks.delete(id);
  return ok(res, { deleted: id });
});

// ─── POST /api/deepsan/focus ──────────────────────────────────────────────────

deepSanRouter.post("/focus", async (req: Request, res: Response) => {
  const { taskId, durationMin = 25 } = req.body ?? {};
  const duration = Number(durationMin);
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    return fail(res, "durationMin must be 1–180");
  }
  const taskIdNum = taskId != null ? Number(taskId) : null;

  if (isDeepSanDbReady()) {
    try {
      const result = await pool.query(
        `INSERT INTO deepsan_sessions (task_id, duration_min) VALUES ($1, $2) RETURNING *`,
        [taskIdNum, duration],
      );
      return ok(res, result.rows[0], 201);
    } catch (e) {
      console.error("[DeepSan] POST /focus db error:", e);
      return fail(res, "database error", 500);
    }
  }

  const now = new Date().toISOString();
  const session: DeepSanSession = {
    id: memSessionSeq++,
    task_id: taskIdNum,
    duration_min: duration,
    actual_duration_min: null,
    started_at: now,
    ended_at: null,
    status: "active",
  };
  memSessions.set(session.id, session);
  return ok(res, session, 201);
});

// ─── GET /api/deepsan/focus/active ───────────────────────────────────────────

deepSanRouter.get("/focus/active", async (_req: Request, res: Response) => {
  if (isDeepSanDbReady()) {
    try {
      const result = await pool.query(
        `SELECT * FROM deepsan_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
      );
      return ok(res, result.rows[0] ?? null);
    } catch (e) {
      console.error("[DeepSan] GET /focus/active db error:", e);
      return fail(res, "database error", 500);
    }
  }

  const active = Array.from(memSessions.values())
    .filter((s) => s.status === "active")
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  return ok(res, active);
});

// ─── PATCH /api/deepsan/focus/:id/done ───────────────────────────────────────

deepSanRouter.patch("/focus/:id/done", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return fail(res, "invalid id");

  const { actualDurationMin } = req.body ?? {};
  const actual = actualDurationMin != null ? Number(actualDurationMin) : null;

  if (isDeepSanDbReady()) {
    try {
      const result = await pool.query(
        `UPDATE deepsan_sessions
         SET status = 'done', ended_at = NOW(), actual_duration_min = $1
         WHERE id = $2 RETURNING *`,
        [actual, id],
      );
      if (!result.rowCount) return fail(res, "session not found", 404);
      return ok(res, result.rows[0]);
    } catch (e) {
      console.error("[DeepSan] PATCH /focus/:id/done db error:", e);
      return fail(res, "database error", 500);
    }
  }

  const session = memSessions.get(id);
  if (!session) return fail(res, "session not found", 404);
  session.status = "done";
  session.ended_at = new Date().toISOString();
  session.actual_duration_min = actual;
  return ok(res, session);
});

// ─── GET /api/deepsan/stats ───────────────────────────────────────────────────

deepSanRouter.get("/stats", async (_req: Request, res: Response) => {
  if (isDeepSanDbReady()) {
    try {
      const [tasksRow, sessionsRow, streakRow] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int                          AS total_tasks,
            COUNT(*) FILTER (WHERE done)::int      AS done_tasks
          FROM deepsan_tasks
        `),
        pool.query(`
          SELECT COALESCE(SUM(COALESCE(actual_duration_min, duration_min)), 0)::int AS total_focus_min
          FROM deepsan_sessions WHERE status = 'done'
        `),
        pool.query(`
          WITH daily AS (
            SELECT DISTINCT DATE(started_at AT TIME ZONE 'UTC') AS d
            FROM deepsan_sessions
            WHERE status = 'done'
            ORDER BY d DESC
          ),
          numbered AS (
            SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) AS rn
            FROM daily
          )
          SELECT COUNT(*)::int AS streak
          FROM numbered
          WHERE d = CURRENT_DATE - CAST((rn - 1) AS INT)
        `),
      ]);
      return ok(res, {
        totalTasks: tasksRow.rows[0].total_tasks,
        doneTasks: tasksRow.rows[0].done_tasks,
        totalFocusMin: sessionsRow.rows[0].total_focus_min,
        streakDays: streakRow.rows[0].streak,
      });
    } catch (e) {
      console.error("[DeepSan] GET /stats db error:", e);
      return fail(res, "database error", 500);
    }
  }

  // in-memory stats
  const tasks = Array.from(memTasks.values());
  const sessions = Array.from(memSessions.values()).filter((s) => s.status === "done");
  const totalFocusMin = sessions.reduce(
    (acc, s) => acc + (s.actual_duration_min ?? s.duration_min),
    0,
  );

  // simple streak: count consecutive days with done sessions
  const doneDays = new Set(
    sessions.map((s) => s.started_at.slice(0, 10)),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (doneDays.has(key)) streak++;
    else break;
  }

  return ok(res, {
    totalTasks: tasks.length,
    doneTasks: tasks.filter((t) => t.done).length,
    totalFocusMin,
    streakDays: streak,
  });
});

// ── MVP concept board surface ───────────────────────────────────────────────
interface DeepSanConceptMessage {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

const DEEPSAN_CONCEPT_MAX = 200;
const deepsanConceptMessages: DeepSanConceptMessage[] = [];

deepSanRouter.get("/status", limiter, (_req: Request, res: Response) => {
  res.json({
    module: "deepsan",
    code: "DEEPSAN",
    status: "mvp",
    description: "Anti-chaos: Kanban + Pomodoro + focus sessions + concept board.",
    endpoints: {
      tasks: "/api/deepsan/tasks",
      sessions: "/api/deepsan/sessions",
      stats: "/api/deepsan/stats",
      conceptMessages: "/api/deepsan/concept/messages",
      conceptStats: "/api/deepsan/concept-stats",
    },
    conceptMessagesCount: deepsanConceptMessages.length,
    timestamp: new Date().toISOString(),
  });
});

deepSanRouter.get("/concept/messages", limiter, (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
  const items = deepsanConceptMessages.slice(0, limit);
  res.json({ items, total: deepsanConceptMessages.length, moduleId: "deepsan", noun: "concept/messages" });
});

deepSanRouter.post("/concept/messages", limiter, (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
    const payload = (body.payload && typeof body.payload === "object")
      ? body.payload as Record<string, unknown>
      : body;
    const idea = String(payload.idea ?? payload.title ?? "").trim().slice(0, 200);
    if (!idea) return res.status(400).json({ error: "missing_field", field: "idea" });
    const rationale = String(payload.rationale ?? payload.summary ?? "").trim().slice(0, 800);
    const author = String(payload.author ?? "").trim().slice(0, 80);
    const tagsRaw = Array.isArray(payload.tags) ? payload.tags : ["deepsan"];
    const tags = tagsRaw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6);
    const msg: DeepSanConceptMessage = {
      id: crypto.randomUUID(),
      payload: { idea, rationale, author },
      tags: tags.length ? tags : ["deepsan"],
      createdAt: new Date().toISOString(),
    };
    deepsanConceptMessages.unshift(msg);
    if (deepsanConceptMessages.length > DEEPSAN_CONCEPT_MAX) {
      deepsanConceptMessages.length = DEEPSAN_CONCEPT_MAX;
    }
    return res.status(201).json(msg);
  } catch (err: unknown) {
    console.error("[deepsan] concept_post_failed", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "concept_post_failed" });
  }
});

deepSanRouter.get("/concept-stats", limiter, (_req: Request, res: Response) => {
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  const last7d = deepsanConceptMessages.filter(
    (m) => now - new Date(m.createdAt).getTime() <= sevenDays,
  ).length;
  const tagCounts = new Map<string, number>();
  for (const m of deepsanConceptMessages) {
    for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  res.json({
    moduleId: "deepsan",
    noun: "concept/messages",
    total: deepsanConceptMessages.length,
    last7d,
    topTags,
  });
});
