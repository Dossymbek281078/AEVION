import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQJobsTables, isQJobsDbReady } from "../lib/ensureQJobsTables";
import { rateLimit } from "../lib/rateLimit";
import { callProvider, getProviders } from "../services/qcoreai/providers";

const postLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "qjobs:post", message: "rate_limited" });
const applyLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "qjobs:apply", message: "rate_limited" });

export const qjobsRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureQJobsTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobPosting {
  id: string;
  employerId: string;
  title: string;
  description: string;
  company: string;
  location: string;
  type: string;
  salary: string | null;
  skills: string[];
  isActive: boolean;
  applicantCount: number;
  createdAt: string;
  updatedAt: string;
}

interface JobApplication {
  id: string;
  jobId: string;
  applicantId: string;
  coverLetter: string | null;
  status: string;
  createdAt: string;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memJobs = new Map<string, JobPosting>();
const memApplications = new Map<string, JobApplication>();
const memSavedJobs = new Map<string, Set<string>>(); // userId -> Set<jobId>

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPES = ["full-time", "part-time", "contract", "freelance", "internship"];
const APP_STATUSES = ["pending", "reviewing", "accepted", "rejected"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── GET /api/qjobs/health ────────────────────────────────────────────────────
qjobsRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "qjobs",
    db: isQJobsDbReady() ? "postgres" : "in-memory",
  });
});

// ─── GET /api/qjobs/types ─────────────────────────────────────────────────────
qjobsRouter.get("/types", (_req: Request, res: Response) => {
  res.json({ types: JOB_TYPES });
});

// ─── GET /api/qjobs/jobs ──────────────────────────────────────────────────────
qjobsRouter.get("/jobs", async (req: Request, res: Response) => {
  const { type, location, q, skills, limit } = req.query as Record<string, string | undefined>;
  const limitN = Math.min(Number(limit) || 20, 100);

  try {
    if (isQJobsDbReady()) {
      const conditions: string[] = [`"isActive"=TRUE`];
      const args: unknown[] = [];
      let idx = 1;
      if (type && JOB_TYPES.includes(type)) { conditions.push(`"type"=$${idx++}`); args.push(type); }
      if (location) { conditions.push(`"location" ILIKE $${idx++}`); args.push(`%${location}%`); }
      if (q) { conditions.push(`("title" ILIKE $${idx++} OR "company" ILIKE $${idx})`); args.push(`%${q}%`); idx++; args.push(`%${q}%`); }
      if (skills) {
        const skillList = skills.split(",").map((s: string) => s.trim()).filter(Boolean);
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
    if (type && JOB_TYPES.includes(type)) jobs = jobs.filter((j) => j.type === type);
    if (location) jobs = jobs.filter((j) => j.location.toLowerCase().includes(location.toLowerCase()));
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
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qjobs/jobs/:id ──────────────────────────────────────────────────
qjobsRouter.get("/jobs/:id", async (req: Request, res: Response) => {
  const id = param(req, "id");
  try {
    if (isQJobsDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QJobsPosting" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      return res.json({ job: rows[0] });
    }
    const job = memJobs.get(id);
    if (!job) return res.status(404).json({ error: "not_found" });
    return res.json({ job });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qjobs/me/jobs ──────────────────────────────────────────────────
qjobsRouter.post("/me/jobs", postLimiter, async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const { title, description, company, location, type, salary, skills } = req.body as {
    title?: string;
    description?: string;
    company?: string;
    location?: string;
    type?: string;
    salary?: string;
    skills?: string[];
  };

  if (!title || !description || !company) {
    return res.status(400).json({ error: "title, description, company required" });
  }

  const job: JobPosting = {
    id: crypto.randomUUID(),
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
    if (isQJobsDbReady()) {
      await pool.query(
        `INSERT INTO "QJobsPosting" ("id","employerId","title","description","company","location","type","salary","skills","isActive","applicantCount","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,0,NOW(),NOW())`,
        [job.id, job.employerId, job.title, job.description, job.company, job.location, job.type, job.salary, job.skills],
      );
    } else {
      memJobs.set(job.id, job);
    }
    return res.status(201).json({ job });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── PATCH /api/qjobs/me/jobs/:id ────────────────────────────────────────────
qjobsRouter.patch("/me/jobs/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const id = param(req, "id");

  try {
    if (isQJobsDbReady()) {
      const { rows } = await pool.query(`SELECT * FROM "QJobsPosting" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      const job = rows[0];
      const { title, description, company, location, type, salary, skills } = req.body as Partial<JobPosting>;
      const { rows: updated } = await pool.query(
        `UPDATE "QJobsPosting" SET "title"=$1,"description"=$2,"company"=$3,"location"=$4,"type"=$5,"salary"=$6,"skills"=$7,"updatedAt"=NOW()
         WHERE "id"=$8 RETURNING *`,
        [
          title ?? job.title,
          description ?? job.description,
          company ?? job.company,
          location ?? job.location,
          type ?? job.type,
          salary !== undefined ? salary : job.salary,
          skills ?? job.skills,
          id,
        ],
      );
      return res.json({ job: updated[0] });
    }

    const job = memJobs.get(id);
    if (!job) return res.status(404).json({ error: "not_found" });
    if (job.employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    const updates = req.body as Partial<JobPosting>;
    Object.assign(job, { ...updates, updatedAt: nowIso() });
    return res.json({ job });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── DELETE /api/qjobs/me/jobs/:id — soft delete ─────────────────────────────
qjobsRouter.delete("/me/jobs/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const id = param(req, "id");

  try {
    if (isQJobsDbReady()) {
      const { rows } = await pool.query(`SELECT "employerId" FROM "QJobsPosting" WHERE "id"=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "not_found" });
      if (rows[0].employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      await pool.query(`UPDATE "QJobsPosting" SET "isActive"=FALSE,"updatedAt"=NOW() WHERE "id"=$1`, [id]);
    } else {
      const job = memJobs.get(id);
      if (!job) return res.status(404).json({ error: "not_found" });
      if (job.employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      job.isActive = false;
      job.updatedAt = nowIso();
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qjobs/jobs/:id/apply ──────────────────────────────────────────
qjobsRouter.post("/jobs/:id/apply", applyLimiter, async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const jobId = param(req, "id");
  const { coverLetter } = req.body as { coverLetter?: string };

  const application: JobApplication = {
    id: crypto.randomUUID(),
    jobId,
    applicantId: auth.sub,
    coverLetter: typeof coverLetter === "string" ? coverLetter.trim() : null,
    status: "pending",
    createdAt: nowIso(),
  };

  try {
    if (isQJobsDbReady()) {
      const { rows: job } = await pool.query(`SELECT "id" FROM "QJobsPosting" WHERE "id"=$1 AND "isActive"=TRUE`, [jobId]);
      if (!job[0]) return res.status(404).json({ error: "job not found" });
      await pool.query(
        `INSERT INTO "QJobsApplication" ("id","jobId","applicantId","coverLetter","status","createdAt")
         VALUES ($1,$2,$3,$4,'pending',NOW()) ON CONFLICT ("jobId","applicantId") DO NOTHING`,
        [application.id, application.jobId, application.applicantId, application.coverLetter],
      );
      await pool.query(`UPDATE "QJobsPosting" SET "applicantCount"="applicantCount"+1 WHERE "id"=$1`, [jobId]);
      return res.status(201).json({ applicationId: application.id });
    }

    const job = memJobs.get(jobId);
    if (!job || !job.isActive) return res.status(404).json({ error: "job not found" });

    const dupKey = Array.from(memApplications.values()).find(
      (a) => a.jobId === jobId && a.applicantId === auth.sub,
    );
    if (dupKey) return res.status(409).json({ error: "already applied" });

    memApplications.set(application.id, application);
    job.applicantCount += 1;
    return res.status(201).json({ applicationId: application.id });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qjobs/me/applications ──────────────────────────────────────────
qjobsRouter.get("/me/applications", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  try {
    if (isQJobsDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM "QJobsApplication" WHERE "applicantId"=$1 ORDER BY "createdAt" DESC`,
        [auth.sub],
      );
      return res.json({ applications: rows });
    }
    const applications = Array.from(memApplications.values())
      .filter((a) => a.applicantId === auth.sub)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ applications });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qjobs/me/jobs/:id/applicants ────────────────────────────────────
qjobsRouter.get("/me/jobs/:id/applicants", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const jobId = param(req, "id");

  try {
    if (isQJobsDbReady()) {
      const { rows: job } = await pool.query(`SELECT "employerId" FROM "QJobsPosting" WHERE "id"=$1`, [jobId]);
      if (!job[0]) return res.status(404).json({ error: "not_found" });
      if (job[0].employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
      const { rows } = await pool.query(
        `SELECT * FROM "QJobsApplication" WHERE "jobId"=$1 ORDER BY "createdAt" DESC`,
        [jobId],
      );
      return res.json({ applicants: rows });
    }

    const job = memJobs.get(jobId);
    if (!job) return res.status(404).json({ error: "not_found" });
    if (job.employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });

    const applicants = Array.from(memApplications.values())
      .filter((a) => a.jobId === jobId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ applicants });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── POST /api/qjobs/ai/match ─────────────────────────────────────────────────
qjobsRouter.post("/ai/match", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const { skills, experience, preferences } = req.body as {
    skills?: string[];
    experience?: string;
    preferences?: string;
  };

  if (!Array.isArray(skills) || skills.length === 0) {
    return res.status(400).json({ error: "skills array required" });
  }

  const activeJobs = Array.from(memJobs.values()).filter((j) => j.isActive);

  try {
    const provider = getProviders().find((p) => p.configured);
    if (provider) {
      const jobSummaries = activeJobs.slice(0, 10).map((j) => ({
        id: j.id, title: j.title, skills: j.skills, type: j.type,
      }));
      const prompt = `Given candidate skills: ${skills.join(", ")} and experience: ${experience ?? "not specified"}. Preferences: ${preferences ?? "none"}. From these jobs: ${JSON.stringify(jobSummaries)} Return JSON array of top 3 job IDs ranked by match: [{"jobId": "...", "matchScore": 0-100, "reason": "..."}]`;
      const result = await callProvider(
        provider.id,
        [{ role: "user" as const, content: prompt }],
        provider.defaultModel,
        0.3,
      );
      const raw = result.reply.trim();
      const jsonStr = raw.includes("[") ? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1) : "[]";
      const aiMatches = JSON.parse(jsonStr) as Array<{ jobId: string; matchScore: number; reason: string }>;
      const matches = aiMatches
        .map((m) => { const job = memJobs.get(m.jobId); return job ? { job, matchScore: m.matchScore, reason: m.reason } : null; })
        .filter(Boolean);
      return res.json({ matches, mode: "ai" });
    }
  } catch {
    // fall through to simple match
  }

  // Fallback: simple skill overlap
  const lowerSkills = skills.map((s) => s.toLowerCase());
  const ranked = activeJobs
    .map((j) => {
      const overlap = j.skills.filter((js) => lowerSkills.some((s) => js.toLowerCase().includes(s))).length;
      return { job: j, matchScore: Math.min(100, overlap * 25), reason: `Matched ${overlap} skill(s)` };
    })
    .filter((m) => m.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  return res.json({ matches: ranked, mode: "fallback" });
});

// ─── GET /api/qjobs/salary-insights ──────────────────────────────────────────
const SALARY_MAP: Record<string, { min: number; max: number }> = {
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

qjobsRouter.get("/salary-insights", (req: Request, res: Response) => {
  const title = String(req.query.title ?? "").toLowerCase().trim();
  const location = String(req.query.location ?? "").trim();
  const key = Object.keys(SALARY_MAP).find((k) => title.includes(k) || k.includes(title));
  const range = key
    ? { ...SALARY_MAP[key], currency: "USD", source: "AEVION estimate" }
    : { min: 40000, max: 120000, currency: "USD", source: "AEVION estimate", note: "Generic estimate" };
  return res.json({ title: title || undefined, location: location || undefined, salary: range });
});

// ─── GET /api/qjobs/saved-jobs ────────────────────────────────────────────────
qjobsRouter.get("/saved-jobs", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });
  const saved = memSavedJobs.get(auth.sub) ?? new Set<string>();
  const jobs = Array.from(saved).map((id) => memJobs.get(id)).filter(Boolean) as JobPosting[];
  return res.json({ jobs });
});

// ─── POST /api/qjobs/jobs/:id/save — toggle ───────────────────────────────────
qjobsRouter.post("/jobs/:id/save", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });
  const jobId = param(req, "id");
  const job = memJobs.get(jobId);
  if (!job) return res.status(404).json({ error: "not_found" });
  const saved = memSavedJobs.get(auth.sub) ?? new Set<string>();
  let isSaved: boolean;
  if (saved.has(jobId)) { saved.delete(jobId); isSaved = false; }
  else { saved.add(jobId); isSaved = true; }
  memSavedJobs.set(auth.sub, saved);
  return res.json({ saved: isSaved });
});

// ─── PATCH /api/qjobs/applications/:id — employer updates status ──────────────
qjobsRouter.patch("/applications/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const appId = param(req, "id");
  const { status } = req.body as { status?: string };

  if (!status || !APP_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${APP_STATUSES.join(", ")}` });
  }

  try {
    if (isQJobsDbReady()) {
      const { rows: appRows } = await pool.query(
        `SELECT a.*, j."employerId" FROM "QJobsApplication" a
         JOIN "QJobsPosting" j ON j."id"=a."jobId"
         WHERE a."id"=$1`,
        [appId],
      );
      if (!appRows[0]) return res.status(404).json({ error: "not_found" });
      if ((appRows[0] as JobApplication & { employerId: string }).employerId !== auth.sub) {
        return res.status(403).json({ error: "forbidden" });
      }
      const { rows: updated } = await pool.query(
        `UPDATE "QJobsApplication" SET "status"=$1 WHERE "id"=$2 RETURNING *`,
        [status, appId],
      );
      return res.json({ application: updated[0] });
    }

    const application = memApplications.get(appId);
    if (!application) return res.status(404).json({ error: "not_found" });
    const job = memJobs.get(application.jobId);
    if (!job || job.employerId !== auth.sub) return res.status(403).json({ error: "forbidden" });
    application.status = status;
    return res.json({ application });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// ─── GET /api/qjobs/stats ─────────────────────────────────────────────────────
qjobsRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    if (isQJobsDbReady()) {
      const [jobs, apps, byType] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "isActive") ::int AS active FROM "QJobsPosting"`),
        pool.query(`SELECT COUNT(*)::int AS total FROM "QJobsApplication"`),
        pool.query(`SELECT "type", COUNT(*)::int AS count FROM "QJobsPosting" WHERE "isActive" GROUP BY "type" ORDER BY count DESC`),
      ]);
      return res.json({
        postings: { total: jobs.rows[0].total, active: jobs.rows[0].active },
        applications: { total: apps.rows[0].total },
        byType: Object.fromEntries(byType.rows.map((r: { type: string; count: number }) => [r.type, r.count])),
        backend: "postgres",
      });
    }
    const allJobs = Array.from(memJobs.values());
    const byType = JOB_TYPES.reduce((acc, t) => ({ ...acc, [t]: allJobs.filter((j) => j.type === t && j.isActive).length }), {} as Record<string, number>);
    return res.json({
      postings: { total: allJobs.length, active: allJobs.filter((j) => j.isActive).length },
      applications: { total: memApplications.size },
      byType,
      backend: "memory",
    });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});
