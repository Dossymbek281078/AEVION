"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepSanRouter = void 0;
const express_1 = require("express");
const denPoMestnomu_1 = require("../lib/denPoMestnomu");
const queryNumber_1 = require("../lib/queryNumber");
const platform_1 = require("../lib/sentry/platform");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const dbPool_1 = require("../lib/dbPool");
const ensureDeepSanTables_1 = require("../lib/ensureDeepSanTables");
const captureDeepSanError = (0, platform_1.makeServiceCapture)("deepsan");
exports.deepSanRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
(async () => {
    try {
        await (0, ensureDeepSanTables_1.ensureDeepSanTables)(pool);
    }
    catch {
        // silent — in-memory fallback active
    }
})();
// ─── Rate limiter ──────────────────────────────────────────────────────────────
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});
exports.deepSanRouter.use(limiter);
// ─── In-memory fallback ───────────────────────────────────────────────────────
let memTaskSeq = 1;
let memSessionSeq = 1;
const memTasks = new Map();
const memSessions = new Map();
// ─── Helpers ──────────────────────────────────────────────────────────────────
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
function validPriority(p) {
    return VALID_PRIORITIES.includes(p);
}
function ok(res, data, status = 200) {
    res.status(status).json({ success: true, data });
}
function fail(res, message, status = 400) {
    res.status(status).json({ success: false, error: message });
}
// ─── GET /api/deepsan/health ──────────────────────────────────────────────────
exports.deepSanRouter.get("/health", (_req, res) => {
    ok(res, {
        module: "deepsan",
        db: (0, ensureDeepSanTables_1.isDeepSanDbReady)() ? "postgres" : "in-memory",
        timestamp: new Date().toISOString(),
    });
});
// ─── GET /api/deepsan/tasks ───────────────────────────────────────────────────
exports.deepSanRouter.get("/tasks", async (req, res) => {
    const priority = req.query.priority;
    const done = req.query.done;
    // ?? ловит только null/undefined, поэтому Number("zzz") давало NaN, а
    // Math.min(NaN, 200) — тоже NaN: в SQL уходило LIMIT NaN и Postgres валил
    // запрос пятисоткой. Отрицательное проходило как есть (LIMIT -5 — тоже
    // ошибка СУБД). Идиом взят тот же, что в bureau.ts, чтобы не заводить
    // второй способ делать одно и то же.
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const conditions = [];
            const params = [];
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
            const result = await pool.query(`SELECT * FROM deepsan_tasks ${where} ORDER BY created_at DESC LIMIT $${idx}`, params);
            return ok(res, result.rows);
        }
        catch (e) {
            console.error("[DeepSan] GET /tasks db error:", e);
            captureDeepSanError(e, { route: "deepsan/GET/tasks" });
            return fail(res, "database error", 500);
        }
    }
    // in-memory
    let tasks = Array.from(memTasks.values());
    if (priority && validPriority(priority))
        tasks = tasks.filter((t) => t.priority === priority);
    if (done !== undefined) {
        const wantDone = done === "true" || done === "1";
        tasks = tasks.filter((t) => t.done === wantDone);
    }
    tasks = tasks.slice(0, limit);
    return ok(res, tasks);
});
// ─── POST /api/deepsan/tasks ──────────────────────────────────────────────────
exports.deepSanRouter.post("/tasks", async (req, res) => {
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
    const tagsClean = Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
        : [];
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const result = await pool.query(`INSERT INTO deepsan_tasks (title, description, priority, due_date, tags)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`, [titleClean, descClean, priority, dueDateClean, tagsClean]);
            return ok(res, result.rows[0], 201);
        }
        catch (e) {
            console.error("[DeepSan] POST /tasks db error:", e);
            captureDeepSanError(e, { route: "deepsan/POST/tasks" });
            return fail(res, "database error", 500);
        }
    }
    const now = new Date().toISOString();
    const task = {
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
exports.deepSanRouter.patch("/tasks/:id", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(req.params.id);
    if (id === null)
        return fail(res, "invalid id");
    const { title, done, priority, dueDate } = req.body ?? {};
    if (priority !== undefined && !validPriority(priority)) {
        return fail(res, "priority must be low|medium|high|critical");
    }
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const sets = ["updated_at = NOW()"];
            const params = [];
            let idx = 1;
            if (title !== undefined) {
                sets.push(`title = $${idx++}`);
                params.push(String(title).trim().slice(0, 512));
            }
            if (done !== undefined) {
                sets.push(`done = $${idx++}`);
                params.push(Boolean(done));
            }
            if (priority !== undefined) {
                sets.push(`priority = $${idx++}`);
                params.push(priority);
            }
            if (dueDate !== undefined) {
                sets.push(`due_date = $${idx++}`);
                params.push(dueDate || null);
            }
            params.push(id);
            const result = await pool.query(`UPDATE deepsan_tasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, params);
            if (!result.rowCount)
                return fail(res, "task not found", 404);
            return ok(res, result.rows[0]);
        }
        catch (e) {
            console.error("[DeepSan] PATCH /tasks/:id db error:", e);
            captureDeepSanError(e, { route: "deepsan/PATCH/tasks/:id" });
            return fail(res, "database error", 500);
        }
    }
    const task = memTasks.get(id);
    if (!task)
        return fail(res, "task not found", 404);
    if (title !== undefined)
        task.title = String(title).trim().slice(0, 512);
    if (done !== undefined)
        task.done = Boolean(done);
    if (priority !== undefined)
        task.priority = priority;
    if (dueDate !== undefined)
        task.due_date = dueDate || null;
    task.updated_at = new Date().toISOString();
    return ok(res, task);
});
// ─── DELETE /api/deepsan/tasks/:id ───────────────────────────────────────────
exports.deepSanRouter.delete("/tasks/:id", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(req.params.id);
    if (id === null)
        return fail(res, "invalid id");
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const result = await pool.query("DELETE FROM deepsan_tasks WHERE id = $1 RETURNING id", [id]);
            if (!result.rowCount)
                return fail(res, "task not found", 404);
            return ok(res, { deleted: id });
        }
        catch (e) {
            console.error("[DeepSan] DELETE /tasks/:id db error:", e);
            captureDeepSanError(e, { route: "deepsan/DELETE/tasks/:id" });
            return fail(res, "database error", 500);
        }
    }
    if (!memTasks.has(id))
        return fail(res, "task not found", 404);
    memTasks.delete(id);
    return ok(res, { deleted: id });
});
// ─── POST /api/deepsan/focus ──────────────────────────────────────────────────
exports.deepSanRouter.post("/focus", async (req, res) => {
    const { taskId, durationMin = 25 } = req.body ?? {};
    const duration = Number(durationMin);
    if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
        return fail(res, "durationMin must be 1–180");
    }
    const taskIdNum = taskId != null ? Number(taskId) : null;
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const result = await pool.query(`INSERT INTO deepsan_sessions (task_id, duration_min) VALUES ($1, $2) RETURNING *`, [taskIdNum, duration]);
            return ok(res, result.rows[0], 201);
        }
        catch (e) {
            console.error("[DeepSan] POST /focus db error:", e);
            captureDeepSanError(e, { route: "deepsan/POST/focus" });
            return fail(res, "database error", 500);
        }
    }
    const now = new Date().toISOString();
    const session = {
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
exports.deepSanRouter.get("/focus/active", async (_req, res) => {
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const result = await pool.query(`SELECT * FROM deepsan_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
            return ok(res, result.rows[0] ?? null);
        }
        catch (e) {
            console.error("[DeepSan] GET /focus/active db error:", e);
            captureDeepSanError(e, { route: "deepsan/GET/focus/active" });
            return fail(res, "database error", 500);
        }
    }
    const active = Array.from(memSessions.values())
        .filter((s) => s.status === "active")
        .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
    return ok(res, active);
});
// ─── PATCH /api/deepsan/focus/:id/done ───────────────────────────────────────
exports.deepSanRouter.patch("/focus/:id/done", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(req.params.id);
    if (id === null)
        return fail(res, "invalid id");
    const { actualDurationMin } = req.body ?? {};
    const actual = actualDurationMin != null ? Number(actualDurationMin) : null;
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
        try {
            const result = await pool.query(`UPDATE deepsan_sessions
         SET status = 'done', ended_at = NOW(), actual_duration_min = $1
         WHERE id = $2 RETURNING *`, [actual, id]);
            if (!result.rowCount)
                return fail(res, "session not found", 404);
            return ok(res, result.rows[0]);
        }
        catch (e) {
            console.error("[DeepSan] PATCH /focus/:id/done db error:", e);
            captureDeepSanError(e, { route: "deepsan/PATCH/focus/:id/done" });
            return fail(res, "database error", 500);
        }
    }
    const session = memSessions.get(id);
    if (!session)
        return fail(res, "session not found", 404);
    session.status = "done";
    session.ended_at = new Date().toISOString();
    session.actual_duration_min = actual;
    return ok(res, session);
});
// ─── GET /api/deepsan/stats ───────────────────────────────────────────────────
exports.deepSanRouter.get("/stats", async (_req, res) => {
    if ((0, ensureDeepSanTables_1.isDeepSanDbReady)()) {
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
        }
        catch (e) {
            console.error("[DeepSan] GET /stats db error:", e);
            captureDeepSanError(e, { route: "deepsan/GET/stats" });
            return fail(res, "database error", 500);
        }
    }
    // in-memory stats
    const tasks = Array.from(memTasks.values());
    const sessions = Array.from(memSessions.values()).filter((s) => s.status === "done");
    const totalFocusMin = sessions.reduce((acc, s) => acc + (s.actual_duration_min ?? s.duration_min), 0);
    // simple streak: count consecutive days with done sessions
    const doneDays = new Set(sessions.map((s) => s.started_at.slice(0, 10)));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = (0, denPoMestnomu_1.denPoMestnomu)(d);
        if (doneDays.has(key))
            streak++;
        else
            break;
    }
    return ok(res, {
        totalTasks: tasks.length,
        doneTasks: tasks.filter((t) => t.done).length,
        totalFocusMin,
        streakDays: streak,
    });
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.deepSanRouter.get("/status", limiter, (_req, res) => {
    res.json({
        module: "deepsan",
        code: "DEEPSAN",
        status: "mvp",
        description: "Anti-chaos: Kanban + Pomodoro + focus sessions + concept board.",
        endpoints: {
            tasks: "/api/deepsan/tasks",
            focus: "/api/deepsan/focus",
            focusActive: "/api/deepsan/focus/active",
            stats: "/api/deepsan/stats",
            conceptMessages: "/api/deepsan/concept/messages",
            conceptStats: "/api/deepsan/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({ router: exports.deepSanRouter, moduleId: "deepsan", defaultTag: "deepsan", readLimit: limiter, writeLimit: limiter });
