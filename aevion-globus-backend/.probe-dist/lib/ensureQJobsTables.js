"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQJobsDbReady = isQJobsDbReady;
exports.getQJobsDbError = getQJobsDbError;
exports.ensureQJobsTables = ensureQJobsTables;
let ensured = false;
let dbReady = null;
let dbError = null;
function isQJobsDbReady() {
    return dbReady === true;
}
function getQJobsDbError() {
    return dbError;
}
async function ensureQJobsTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        dbReady = false;
        ensured = true;
        dbError = e instanceof Error ? e.message : "database unavailable";
        console.warn(`[QJobs] Database unavailable — falling back to in-memory store: ${dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "QJobsPosting" (
        "id"             TEXT PRIMARY KEY,
        "employerId"     TEXT NOT NULL,
        "title"          TEXT NOT NULL,
        "description"    TEXT NOT NULL,
        "company"        TEXT NOT NULL,
        "location"       TEXT NOT NULL DEFAULT 'Remote',
        "type"           TEXT NOT NULL DEFAULT 'full-time',
        "salary"         TEXT,
        "skills"         TEXT[] DEFAULT '{}',
        "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
        "applicantCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS "QJobsPosting_active_idx"
        ON "QJobsPosting" ("isActive", "createdAt" DESC)
        WHERE "isActive"=TRUE;
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "QJobsApplication" (
        "id"          TEXT PRIMARY KEY,
        "jobId"       TEXT NOT NULL,
        "applicantId" TEXT NOT NULL,
        "coverLetter" TEXT,
        "status"      TEXT NOT NULL DEFAULT 'pending',
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QJobsApp_unique"
        ON "QJobsApplication" ("jobId", "applicantId");
    `);
        await pool.query(`CREATE TABLE IF NOT EXISTS "QJobsSavedJob" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE ("userId","jobId"));`);
        await pool.query(`CREATE INDEX IF NOT EXISTS "QJobsSaved_user_idx" ON "QJobsSavedJob" ("userId","createdAt" DESC);`);
        dbReady = true;
        console.log("[QJobs] Tables ready");
    }
    catch (e) {
        dbReady = false;
        dbError = e instanceof Error ? e.message : "table creation failed";
        console.warn(`[QJobs] Could not create tables — falling back to in-memory: ${dbError}`);
    }
    finally {
        ensured = true;
    }
}
