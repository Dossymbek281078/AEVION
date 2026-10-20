"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qjobsRouter = void 0;
const express_1 = require("express");
const platform_1 = require("../lib/sentry/platform");
const node_crypto_1 = __importDefault(require("node:crypto"));
const authJwt_1 = require("../lib/authJwt");
const dbPool_1 = require("../lib/dbPool");
const ensureQJobsTables_1 = require("../lib/ensureQJobsTables");
const captureQJobsError = (0, platform_1.makeServiceCapture)("qjobs");
const rateLimit_1 = require("../lib/rateLimit");
const providers_1 = require("../services/qcoreai/providers");
const postLimiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 10, keyPrefix: "qjobs:post", message: "rate_limited" });
const applyLimiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 5, keyPrefix: "qjobs:apply", message: "rate_limited" });
// Платный вызов модели. Без ограничителя ручка была открыта: замер 21.08.2026
// нашёл 26 платных ручек, у 17 ограничителя не было, тринадцать закрывает
// кампания в другой ветке — эта оставалась ничьей. Предел строже соседних,
// потому что цена запроса здесь не в базе, а у поставщика.
const aiMatchLimiter = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 5, keyPrefix: "qjobs:ai-match", message: "rate_limited" });
exports.qjobsRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
(async () => {
    try {
        await (0, ensureQJobsTables_1.ensureQJobsTables)(pool);
    }
    catch {
        // silent — in-memory fallback active
    }
})();
// ─── In-memory fallback ───────────────────────────────────────────────────────
const memJobs = new Map();
const memApplications = new Map();
const memSavedJobs = new Map(); // userId -> Set<jobId>
// ─── Constants ────────────────────────────────────────────────────────────────
const JOB_TYPES = ["full-time", "part-time", "contract", "freelance", "internship"];
const APP_STATUSES = ["pending", "reviewing", "accepted", "rejected"];
// ─── Helpers ──────────────────────────────────────────────────────────────────
function param(req, key) {
    const v = req.params[key];
    return Array.isArray(v) ? v[0] : String(v ?? "");
}
function nowIso() {
    return new Date().toISOString();
}
// ─── GET /api/qjobs/health ────────────────────────────────────────────────────
exports.qjobsRouter.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "qjobs",
        db: (0, ensureQJobsTables_1.isQJobsDbReady)() ? "postgres" : "in-memory",
    });
});
// ─── GET /api/qjobs/types ─────────────────────────────────────────────────────
exports.qjobsRouter.get("/types", (_req, res) => {
    res.json({ types: JOB_TYPES });
});
// ─── GET /api/qjobs/jobs ──────────────────────────────────────────────────────
exports.qjobsRouter.get("/jobs", async (req, res) => {
    const { type, location, q, skills, limit } = req.query;
    // `|| 20` ловит NaN, но НЕ отрицательное: limit=-5 проходило дальше и
    // уезжало в SQL как LIMIT -5, что Postgres отвергает пятисоткой. Проверено
    // на проде 19.08.2026, и ровно эти ручки называл журнал ошибок
    // («LIMIT must not be negative» x4 за неделю). Идиом — как в bureau.ts.
    const limitN = Math.min(Math.max(parseInt(String(limit ?? "20"), 10) || 20, 1), 100);
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const conditions = [`"isActive"=TRUE`];
            const args = [];
            let idx = 1;
            if (type && JOB_TYPES.includes(type)) {
                conditions.push(`"type"=$${idx++}`);
                args.push(type);
            }
            if (location) {
                conditions.push(`"location" ILIKE $${idx++}`);
                args.push(`%${location}%`);
            }
            if (q) {
                conditions.push(`("title" ILIKE $${idx++} OR "company" ILIKE $${idx})`);
                args.push(`%${q}%`);
                idx++;
                args.push(`%${q}%`);
            }
            if (skills) {
                const skillList = skills.split(",").map((s) => s.trim()).filter(Boolean);
                if (skillList.length > 0) {
                    conditions.push(`"skills" && $${idx++}::text[]`);
                    args.push(skillList);
                }
            }
            const where = conditions.join(" AND ");
            const [{ rows }, { rows: countRows }] = await Promise.all([
                pool.query(`SELECT * FROM "QJobsPosting" WHERE ${where} ORDER BY "createdAt" DESC LIMIT $${idx}`, [...args, limitN]),
                pool.query(`SELECT COUNT(*)::int AS total FROM "QJobsPosting" WHERE ${where}`, args),
            ]);
            return res.json({ jobs: rows, total: countRows[0]?.total ?? rows.length });
        }
        let jobs = Array.from(memJobs.values()).filter((j) => j.isActive);
        if (type && JOB_TYPES.includes(type))
            jobs = jobs.filter((j) => j.type === type);
        if (location)
            jobs = jobs.filter((j) => j.location.toLowerCase().includes(location.toLowerCase()));
        if (q) {
            const lq = q.toLowerCase();
            jobs = jobs.filter((j) => j.title.toLowerCase().includes(lq) || j.company.toLowerCase().includes(lq));
        }
        if (skills) {
            const skillList = skills.split(",").map((s) => s.trim().toLowerCase());
            jobs = jobs.filter((j) => skillList.some((s) => j.skills.some((js) => js.toLowerCase().includes(s))));
        }
        jobs = jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const total = jobs.length;
        return res.json({ jobs: jobs.slice(0, limitN), total });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── GET /api/qjobs/jobs/:id ──────────────────────────────────────────────────
exports.qjobsRouter.get("/jobs/:id", async (req, res) => {
    const id = param(req, "id");
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows } = await pool.query(`SELECT * FROM "QJobsPosting" WHERE "id"=$1`, [id]);
            if (!rows[0])
                return res.status(404).json({ error: "not_found" });
            return res.json({ job: rows[0] });
        }
        const job = memJobs.get(id);
        if (!job)
            return res.status(404).json({ error: "not_found" });
        return res.json({ job });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── POST /api/qjobs/me/jobs ──────────────────────────────────────────────────
exports.qjobsRouter.post("/me/jobs", postLimiter, async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const { title, description, company, location, type, salary, skills } = req.body;
    if (!title || !description || !company) {
        return res.status(400).json({ error: "title, description, company required" });
    }
    const job = {
        id: node_crypto_1.default.randomUUID(),
        employerId: auth.sub,
        title: title.trim(),
        description: description.trim(),
        company: company.trim(),
        location: typeof location === "string" ? location.trim() : "Remote",
        type: typeof type === "string" && JOB_TYPES.includes(type) ? type : "full-time",
        salary: typeof salary === "string" ? salary.trim() : null,
        skills: Array.isArray(skills) ? skills.filter((s) => typeof s === "string") : [],
        isActive: true,
        applicantCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            await pool.query(`INSERT INTO "QJobsPosting" ("id","employerId","title","description","company","location","type","salary","skills","isActive","applicantCount","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,0,NOW(),NOW())`, [job.id, job.employerId, job.title, job.description, job.company, job.location, job.type, job.salary, job.skills]);
        }
        else {
            memJobs.set(job.id, job);
        }
        return res.status(201).json({ job });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── PATCH /api/qjobs/me/jobs/:id ────────────────────────────────────────────
exports.qjobsRouter.patch("/me/jobs/:id", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const id = param(req, "id");
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows } = await pool.query(`SELECT * FROM "QJobsPosting" WHERE "id"=$1`, [id]);
            if (!rows[0])
                return res.status(404).json({ error: "not_found" });
            if (rows[0].employerId !== auth.sub)
                return res.status(403).json({ error: "forbidden" });
            const job = rows[0];
            const { title, description, company, location, type, salary, skills } = req.body;
            const { rows: updated } = await pool.query(`UPDATE "QJobsPosting" SET "title"=$1,"description"=$2,"company"=$3,"location"=$4,"type"=$5,"salary"=$6,"skills"=$7,"updatedAt"=NOW()
         WHERE "id"=$8 RETURNING *`, [
                title ?? job.title,
                description ?? job.description,
                company ?? job.company,
                location ?? job.location,
                type ?? job.type,
                salary !== undefined ? salary : job.salary,
                skills ?? job.skills,
                id,
            ]);
            return res.json({ job: updated[0] });
        }
        const job = memJobs.get(id);
        if (!job)
            return res.status(404).json({ error: "not_found" });
        if (job.employerId !== auth.sub)
            return res.status(403).json({ error: "forbidden" });
        const updates = req.body;
        Object.assign(job, { ...updates, updatedAt: nowIso() });
        return res.json({ job });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── DELETE /api/qjobs/me/jobs/:id — soft delete ─────────────────────────────
exports.qjobsRouter.delete("/me/jobs/:id", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const id = param(req, "id");
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows } = await pool.query(`SELECT "employerId" FROM "QJobsPosting" WHERE "id"=$1`, [id]);
            if (!rows[0])
                return res.status(404).json({ error: "not_found" });
            if (rows[0].employerId !== auth.sub)
                return res.status(403).json({ error: "forbidden" });
            await pool.query(`UPDATE "QJobsPosting" SET "isActive"=FALSE,"updatedAt"=NOW() WHERE "id"=$1`, [id]);
        }
        else {
            const job = memJobs.get(id);
            if (!job)
                return res.status(404).json({ error: "not_found" });
            if (job.employerId !== auth.sub)
                return res.status(403).json({ error: "forbidden" });
            job.isActive = false;
            job.updatedAt = nowIso();
        }
        return res.json({ ok: true });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── POST /api/qjobs/jobs/:id/apply ──────────────────────────────────────────
exports.qjobsRouter.post("/jobs/:id/apply", applyLimiter, async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const jobId = param(req, "id");
    const { coverLetter } = req.body;
    const application = {
        id: node_crypto_1.default.randomUUID(),
        jobId,
        applicantId: auth.sub,
        coverLetter: typeof coverLetter === "string" ? coverLetter.trim() : null,
        status: "pending",
        createdAt: nowIso(),
    };
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows: job } = await pool.query(`SELECT "id" FROM "QJobsPosting" WHERE "id"=$1 AND "isActive"=TRUE`, [jobId]);
            if (!job[0])
                return res.status(404).json({ error: "job not found" });
            await pool.query(`INSERT INTO "QJobsApplication" ("id","jobId","applicantId","coverLetter","status","createdAt")
         VALUES ($1,$2,$3,$4,'pending',NOW()) ON CONFLICT ("jobId","applicantId") DO NOTHING`, [application.id, application.jobId, application.applicantId, application.coverLetter]);
            await pool.query(`UPDATE "QJobsPosting" SET "applicantCount"="applicantCount"+1 WHERE "id"=$1`, [jobId]);
            return res.status(201).json({ applicationId: application.id });
        }
        const job = memJobs.get(jobId);
        if (!job || !job.isActive)
            return res.status(404).json({ error: "job not found" });
        const dupKey = Array.from(memApplications.values()).find((a) => a.jobId === jobId && a.applicantId === auth.sub);
        if (dupKey)
            return res.status(409).json({ error: "already applied" });
        memApplications.set(application.id, application);
        job.applicantCount += 1;
        return res.status(201).json({ applicationId: application.id });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── GET /api/qjobs/me/applications ──────────────────────────────────────────
exports.qjobsRouter.get("/me/applications", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows } = await pool.query(`SELECT * FROM "QJobsApplication" WHERE "applicantId"=$1 ORDER BY "createdAt" DESC`, [auth.sub]);
            return res.json({ applications: rows });
        }
        const applications = Array.from(memApplications.values())
            .filter((a) => a.applicantId === auth.sub)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return res.json({ applications });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── GET /api/qjobs/me/jobs/:id/applicants ────────────────────────────────────
exports.qjobsRouter.get("/me/jobs/:id/applicants", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const jobId = param(req, "id");
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows: job } = await pool.query(`SELECT "employerId" FROM "QJobsPosting" WHERE "id"=$1`, [jobId]);
            if (!job[0])
                return res.status(404).json({ error: "not_found" });
            if (job[0].employerId !== auth.sub)
                return res.status(403).json({ error: "forbidden" });
            const { rows } = await pool.query(`SELECT * FROM "QJobsApplication" WHERE "jobId"=$1 ORDER BY "createdAt" DESC`, [jobId]);
            return res.json({ applicants: rows });
        }
        const job = memJobs.get(jobId);
        if (!job)
            return res.status(404).json({ error: "not_found" });
        if (job.employerId !== auth.sub)
            return res.status(403).json({ error: "forbidden" });
        const applicants = Array.from(memApplications.values())
            .filter((a) => a.jobId === jobId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return res.json({ applicants });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── POST /api/qjobs/ai/match ─────────────────────────────────────────────────
exports.qjobsRouter.post("/ai/match", aiMatchLimiter, async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const { skills: reqSkills, experience, preferences } = req.body;
    // Auto-fetch skills from QBuild skill-badges if not provided
    let skills = Array.isArray(reqSkills) && reqSkills.length > 0 ? reqSkills : [];
    if (skills.length === 0) {
        try {
            const { getPool: gp } = await Promise.resolve().then(() => __importStar(require("../lib/dbPool")));
            const bp = gp();
            // Таблица называется "BuildSkillBadge" (её создаёт routes/build/skill-badges.ts),
            // а колонок "testTitle" и "status" не существует ни в одной таблице платформы.
            // Прежний запрос не мог выполниться НИКОГДА, и `catch {}` это прятал: человек
            // с заработанными значками получал ответ «привяжите профиль QBuild».
            // Найдено 19.08.2026 сверкой «что запрашиваем» против «что создаём».
            const { rows: badges } = await bp.query(`SELECT "testId" FROM "BuildSkillBadge" WHERE "userId"=$1 AND "passed"=TRUE LIMIT 10`, [auth.sub]);
            if (badges.length > 0)
                skills = badges.map((b) => b.testId);
        }
        catch (e) {
            // Отсутствие значков — обычное дело, поэтому путь остаётся мягким. Но
            // молчать нельзя: именно молчание и продержало неверный запрос до сих пор.
            console.warn("[qjobs] skill badges lookup failed:", e instanceof Error ? e.message : e);
        }
    }
    if (skills.length === 0) {
        return res.status(400).json({ error: "skills array required (or link your QBuild profile)" });
    }
    // Load active jobs from Postgres (prefer) or in-memory
    let activeJobs = [];
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows } = await pool.query(`SELECT * FROM "QJobsPosting" WHERE "isActive"=TRUE ORDER BY "createdAt" DESC LIMIT 20`);
            activeJobs = rows;
        }
    }
    catch { /* ignore */ }
    if (activeJobs.length === 0)
        activeJobs = Array.from(memJobs.values()).filter((j) => j.isActive);
    try {
        const provider = (0, providers_1.getProviders)().find((p) => p.configured);
        if (provider) {
            const jobSummaries = activeJobs.slice(0, 15).map((j) => ({
                id: j.id, title: j.title, company: j.company, skills: j.skills, type: j.type,
            }));
            const prompt = `You are a job-matching AI. Candidate profile:\n- Skills: ${skills.join(", ")}\n- Experience: ${experience ?? "not specified"}\n- Preferences: ${preferences ?? "none"}\n\nRate these jobs by match (0–100). Respond ONLY with a JSON array, no prose:\n[{"jobId":"...","matchScore":85,"reason":"2 matching skills: TypeScript, React"}]\n\nJobs:\n${JSON.stringify(jobSummaries)}`;
            const result = await (0, providers_1.callProvider)(provider.id, [{ role: "user", content: prompt }], provider.defaultModel ?? "gpt-4o-mini", 0.2);
            const raw = result.reply.trim();
            const jsonStr = raw.includes("[") ? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1) : "[]";
            const aiMatches = JSON.parse(jsonStr);
            const jobMap = new Map(activeJobs.map((j) => [j.id, j]));
            const matches = aiMatches
                .filter((m) => m.matchScore >= 20)
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 5)
                .map((m) => {
                const job = jobMap.get(m.jobId);
                return job ? { job, score: m.matchScore / 100, reasons: [m.reason] } : null;
            })
                .filter(Boolean);
            return res.json({ matches, mode: "ai", skillsUsed: skills });
        }
    }
    catch {
        // fall through to simple match
    }
    // Fallback: simple skill overlap scoring
    const lowerSkills = skills.map((s) => s.toLowerCase());
    const ranked = activeJobs
        .map((j) => {
        const matched = j.skills.filter((js) => lowerSkills.some((s) => js.toLowerCase().includes(s)));
        const score = Math.min(1, matched.length * 0.25);
        return { job: j, score, reasons: matched.length > 0 ? [`Matched skills: ${matched.join(", ")}`] : [] };
    })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    return res.json({ matches: ranked, mode: "fallback", skillsUsed: skills });
});
// ─── GET /api/qjobs/salary-insights ──────────────────────────────────────────
const SALARY_MAP = {
    "software engineer": { min: 80000, max: 150000 },
    "frontend developer": { min: 70000, max: 130000 },
    "backend developer": { min: 75000, max: 140000 },
    "fullstack developer": { min: 75000, max: 145000 },
    "data scientist": { min: 90000, max: 160000 },
    "product manager": { min: 85000, max: 155000 },
    "designer": { min: 60000, max: 110000 },
    "devops engineer": { min: 85000, max: 150000 },
    "qa engineer": { min: 60000, max: 110000 },
    "data analyst": { min: 65000, max: 120000 },
    "machine learning engineer": { min: 100000, max: 175000 },
    "marketing manager": { min: 55000, max: 105000 },
    "sales manager": { min: 50000, max: 120000 },
};
exports.qjobsRouter.get("/salary-insights", (req, res) => {
    const title = String(req.query.title ?? "").toLowerCase().trim();
    const location = String(req.query.location ?? "").trim();
    const key = Object.keys(SALARY_MAP).find((k) => title.includes(k) || k.includes(title));
    const range = key
        ? { ...SALARY_MAP[key], currency: "USD", source: "AEVION estimate" }
        : { min: 40000, max: 120000, currency: "USD", source: "AEVION estimate", note: "Generic estimate" };
    return res.json({ title: title || undefined, location: location || undefined, salary: range });
});
// ─── GET /api/qjobs/saved-jobs ────────────────────────────────────────────────
exports.qjobsRouter.get("/saved-jobs", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows } = await pool.query(`SELECT j.* FROM "QJobsPosting" j
         JOIN "QJobsSavedJob" s ON s."jobId" = j."id"
         WHERE s."userId"=$1 AND j."isActive"=TRUE
         ORDER BY s."createdAt" DESC`, [auth.sub]);
            return res.json({ jobs: rows });
        }
    }
    catch (e) {
        console.error("[QJobs] /saved-jobs DB error", e);
    }
    const saved = memSavedJobs.get(auth.sub) ?? new Set();
    const jobs = Array.from(saved).map((id) => memJobs.get(id)).filter(Boolean);
    return res.json({ jobs });
});
// ─── POST /api/qjobs/jobs/:id/save — toggle ───────────────────────────────────
exports.qjobsRouter.post("/jobs/:id/save", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const jobId = param(req, "id");
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const existing = await pool.query(`SELECT id FROM "QJobsSavedJob" WHERE "userId"=$1 AND "jobId"=$2`, [auth.sub, jobId]);
            if ((existing.rowCount ?? 0) > 0) {
                await pool.query(`DELETE FROM "QJobsSavedJob" WHERE "userId"=$1 AND "jobId"=$2`, [auth.sub, jobId]);
                return res.json({ saved: false });
            }
            else {
                await pool.query(`INSERT INTO "QJobsSavedJob"("id","userId","jobId") VALUES($1,$2,$3) ON CONFLICT ("userId","jobId") DO NOTHING`, [node_crypto_1.default.randomUUID(), auth.sub, jobId]);
                return res.json({ saved: true });
            }
        }
    }
    catch (e) {
        console.error("[QJobs] save toggle DB error", e);
        // Ниже вакансия ищется в памяти, и её отсутствие уходило как «not_found»:
        // человек читал бы «такой вакансии нет» про существующую.
        return res.status(503).json({
            error: "storage_unavailable",
            warning: "Хранилище временно недоступно. Это НЕ значит, что вакансии нет — " +
                "повторите запрос позже.",
        });
    }
    const job = memJobs.get(jobId);
    if (!job)
        return res.status(404).json({ error: "not_found" });
    const saved = memSavedJobs.get(auth.sub) ?? new Set();
    let isSaved;
    if (saved.has(jobId)) {
        saved.delete(jobId);
        isSaved = false;
    }
    else {
        saved.add(jobId);
        isSaved = true;
    }
    memSavedJobs.set(auth.sub, saved);
    return res.json({ saved: isSaved });
});
// ─── PATCH /api/qjobs/applications/:id — employer updates status ──────────────
exports.qjobsRouter.patch("/applications/:id", async (req, res) => {
    const auth = (0, authJwt_1.verifyBearerOptional)(req);
    if (!auth)
        return res.status(401).json({ error: "auth required" });
    const appId = param(req, "id");
    const { status } = req.body;
    if (!status || !APP_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${APP_STATUSES.join(", ")}` });
    }
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const { rows: appRows } = await pool.query(`SELECT a.*, j."employerId" FROM "QJobsApplication" a
         JOIN "QJobsPosting" j ON j."id"=a."jobId"
         WHERE a."id"=$1`, [appId]);
            if (!appRows[0])
                return res.status(404).json({ error: "not_found" });
            if (appRows[0].employerId !== auth.sub) {
                return res.status(403).json({ error: "forbidden" });
            }
            const { rows: updated } = await pool.query(`UPDATE "QJobsApplication" SET "status"=$1 WHERE "id"=$2 RETURNING *`, [status, appId]);
            return res.json({ application: updated[0] });
        }
        const application = memApplications.get(appId);
        if (!application)
            return res.status(404).json({ error: "not_found" });
        const job = memJobs.get(application.jobId);
        if (!job || job.employerId !== auth.sub)
            return res.status(403).json({ error: "forbidden" });
        application.status = status;
        return res.json({ application });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
// ─── GET /api/qjobs/stats ─────────────────────────────────────────────────────
exports.qjobsRouter.get("/stats", async (_req, res) => {
    try {
        if ((0, ensureQJobsTables_1.isQJobsDbReady)()) {
            const [jobs, apps, byType] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "isActive") ::int AS active FROM "QJobsPosting"`),
                pool.query(`SELECT COUNT(*)::int AS total FROM "QJobsApplication"`),
                pool.query(`SELECT "type", COUNT(*)::int AS count FROM "QJobsPosting" WHERE "isActive" GROUP BY "type" ORDER BY count DESC`),
            ]);
            return res.json({
                postings: { total: jobs.rows[0].total, active: jobs.rows[0].active },
                applications: { total: apps.rows[0].total },
                byType: Object.fromEntries(byType.rows.map((r) => [r.type, r.count])),
                backend: "postgres",
            });
        }
        const allJobs = Array.from(memJobs.values());
        const byType = JOB_TYPES.reduce((acc, t) => ({ ...acc, [t]: allJobs.filter((j) => j.type === t && j.isActive).length }), {});
        return res.json({
            postings: { total: allJobs.length, active: allJobs.filter((j) => j.isActive).length },
            applications: { total: memApplications.size },
            byType,
            backend: "memory",
        });
    }
    catch (err) {
        captureQJobsError(err, { route: "qjobs" });
        return res.status(500).json({ error: "internal_error" });
    }
});
