"use strict";
/**
 * QCoreAI persistence helpers.
 *
 * Two-mode store:
 *   1. Postgres (primary) — raw SQL via pg Pool when the DB is reachable.
 *   2. In-memory (fallback) — transparent Maps when the DB is unavailable.
 *
 * The mode is decided by `ensureQCoreTables()` on first use. Every exported
 * function probes `isDbReady()` and dispatches accordingly, so routes never
 * need to branch. The in-memory mode survives the life of the Node process
 * — perfect for local demos and self-contained investor runs.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.ensureSession = ensureSession;
exports.touchSession = touchSession;
exports.renameSessionIfDefault = renameSessionIfDefault;
exports.listSessions = listSessions;
exports.archiveSession = archiveSession;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
exports.renameSession = renameSession;
exports.createRun = createRun;
exports.finishRun = finishRun;
exports.listRuns = listRuns;
exports.getRun = getRun;
exports.insertMessage = insertMessage;
exports.listMessages = listMessages;
exports.shareRun = shareRun;
exports.unshareRun = unshareRun;
exports.getRunByShareToken = getRunByShareToken;
exports.getSessionPublic = getSessionPublic;
exports.getAnalytics = getAnalytics;
exports.getOpexSummary = getOpexSummary;
exports.createSharedPreset = createSharedPreset;
exports.listPublicSharedPresets = listPublicSharedPresets;
exports.getSharedPreset = getSharedPreset;
exports.importSharedPreset = importSharedPreset;
exports.deleteSharedPreset = deleteSharedPreset;
exports.getMaxOrdering = getMaxOrdering;
exports.applyRefinement = applyRefinement;
exports.setRunTags = setRunTags;
exports.searchRuns = searchRuns;
exports.getTopUserTags = getTopUserTags;
exports.getCostTimeseries = getCostTimeseries;
exports.buildHistoryContext = buildHistoryContext;
exports.getThread = getThread;
exports.buildThreadContext = buildThreadContext;
exports.createEvalSuite = createEvalSuite;
exports.listEvalSuites = listEvalSuites;
exports.listPublicEvalSuites = listPublicEvalSuites;
exports.setEvalSuitePublic = setEvalSuitePublic;
exports.getEvalSuite = getEvalSuite;
exports.updateEvalSuite = updateEvalSuite;
exports.deleteEvalSuite = deleteEvalSuite;
exports.createEvalRun = createEvalRun;
exports.updateEvalRun = updateEvalRun;
exports.getEvalRun = getEvalRun;
exports.listSuiteRuns = listSuiteRuns;
exports.createPrompt = createPrompt;
exports.getPrompt = getPrompt;
exports.listPrompts = listPrompts;
exports.listPublicPrompts = listPublicPrompts;
exports.updatePrompt = updatePrompt;
exports.deletePrompt = deletePrompt;
exports.forkPrompt = forkPrompt;
exports.getPromptVersionChain = getPromptVersionChain;
exports.getSpendLimit = getSpendLimit;
exports.setSpendLimit = setSpendLimit;
exports.deleteSpendLimit = deleteSpendLimit;
exports.getMonthlySpend = getMonthlySpend;
exports.getMonthlyTokens = getMonthlyTokens;
exports.addTokenUsage = addTokenUsage;
exports.getLedgerTokens = getLedgerTokens;
exports.getLedgerPremiumTokens = getLedgerPremiumTokens;
exports.getMonthlyPremiumTokens = getMonthlyPremiumTokens;
exports.createTemplate = createTemplate;
exports.listTemplates = listTemplates;
exports.listPublicTemplates = listPublicTemplates;
exports.getTemplate = getTemplate;
exports.updateTemplate = updateTemplate;
exports.deleteTemplate = deleteTemplate;
exports.createScheduledBatch = createScheduledBatch;
exports.listScheduledBatches = listScheduledBatches;
exports.getScheduledBatch = getScheduledBatch;
exports.updateScheduledBatch = updateScheduledBatch;
exports.deleteScheduledBatch = deleteScheduledBatch;
exports.recordScheduledRun = recordScheduledRun;
exports.getDueSchedules = getDueSchedules;
exports.useTemplate = useTemplate;
exports.createBatch = createBatch;
exports.getBatch = getBatch;
exports.listBatches = listBatches;
exports.updateBatchProgress = updateBatchProgress;
exports.listBatchRuns = listBatchRuns;
exports.createComment = createComment;
exports.listComments = listComments;
exports.logPromptAudit = logPromptAudit;
exports.listPromptAudit = listPromptAudit;
exports.createWorkspace = createWorkspace;
exports.listWorkspaces = listWorkspaces;
exports.getWorkspace = getWorkspace;
exports.updateWorkspace = updateWorkspace;
exports.deleteWorkspace = deleteWorkspace;
exports.addWorkspaceMember = addWorkspaceMember;
exports.listWorkspaceMembers = listWorkspaceMembers;
exports.removeWorkspaceMember = removeWorkspaceMember;
exports.addWorkspaceSession = addWorkspaceSession;
exports.removeWorkspaceSession = removeWorkspaceSession;
exports.listWorkspaceSessions = listWorkspaceSessions;
exports.deleteRunsBulk = deleteRunsBulk;
exports.getSessionCostSummary = getSessionCostSummary;
exports.pinSession = pinSession;
exports.createSnippet = createSnippet;
exports.listSnippets = listSnippets;
exports.getSnippet = getSnippet;
exports.updateSnippet = updateSnippet;
exports.deleteSnippet = deleteSnippet;
exports.listSnippetTagCloud = listSnippetTagCloud;
exports.mergeSessions = mergeSessions;
exports.rateRun = rateRun;
exports.getRating = getRating;
exports.getRatingsSummary = getRatingsSummary;
exports.listTopRatedRuns = listTopRatedRuns;
exports.createPipeline = createPipeline;
exports.listPipelines = listPipelines;
exports.listPublicPipelines = listPublicPipelines;
exports.getPipeline = getPipeline;
exports.updatePipeline = updatePipeline;
exports.deletePipeline = deletePipeline;
exports.usePipeline = usePipeline;
exports.createCollection = createCollection;
exports.listCollections = listCollections;
exports.deleteCollection = deleteCollection;
exports.assignSnippetToCollection = assignSnippetToCollection;
exports.bookmarkRun = bookmarkRun;
exports.unbookmarkRun = unbookmarkRun;
exports.listBookmarks = listBookmarks;
exports.isBookmarked = isBookmarked;
exports.createAnnotation = createAnnotation;
exports.updateAnnotation = updateAnnotation;
exports.deleteAnnotation = deleteAnnotation;
exports.listAnnotations = listAnnotations;
exports.listAllAnnotations = listAllAnnotations;
exports.pinWorkspaceSession = pinWorkspaceSession;
exports.searchQCore = searchQCore;
exports.setFollowUpFrom = setFollowUpFrom;
exports.createOrg = createOrg;
exports.getOrg = getOrg;
exports.listOrgs = listOrgs;
exports.deleteOrg = deleteOrg;
exports.addOrgMember = addOrgMember;
exports.removeOrgMember = removeOrgMember;
exports.listOrgMembers = listOrgMembers;
exports.isOrgMember = isOrgMember;
exports.createApiKey = createApiKey;
exports.validateApiKey = validateApiKey;
exports.listApiKeys = listApiKeys;
exports.deleteApiKey = deleteApiKey;
exports.clapRun = clapRun;
exports.getRunClapCount = getRunClapCount;
exports.setSessionAiSummary = setSessionAiSummary;
exports.getSessionAiSummary = getSessionAiSummary;
exports.checkAndIncrRateLimit = checkAndIncrRateLimit;
exports.adminResetRateLimit = adminResetRateLimit;
exports.listRateLimits = listRateLimits;
exports.createPromptChain = createPromptChain;
exports.listPromptChains = listPromptChains;
exports.getPromptChain = getPromptChain;
exports.updatePromptChain = updatePromptChain;
exports.deletePromptChain = deletePromptChain;
exports.listPublicPromptChains = listPublicPromptChains;
exports.incrPromptChainRunCount = incrPromptChainRunCount;
exports.createSessionInvite = createSessionInvite;
exports.getSessionInvite = getSessionInvite;
exports.listSessionInvites = listSessionInvites;
exports.deleteSessionInvite = deleteSessionInvite;
exports.incrementInviteUseCount = incrementInviteUseCount;
exports.logAudit = logAudit;
exports.listAuditLog = listAuditLog;
exports.getUserStats = getUserStats;
exports.addMemory = addMemory;
exports.listMemories = listMemories;
exports.deleteMemory = deleteMemory;
exports.updateMemory = updateMemory;
exports.extractMemoriesFromRun = extractMemoriesFromRun;
exports.listPinnedMemories = listPinnedMemories;
exports.pinTemplate = pinTemplate;
exports.createAbTest = createAbTest;
exports.listAbTests = listAbTests;
exports.getAbTest = getAbTest;
exports.deleteAbTest = deleteAbTest;
exports.recordAbTestResult = recordAbTestResult;
exports.setUserSetting = setUserSetting;
exports.getUserSetting = getUserSetting;
exports.getAllUserSettings = getAllUserSettings;
exports.deleteUserSetting = deleteUserSetting;
exports.createBranch = createBranch;
exports.getBranch = getBranch;
exports.listBranches = listBranches;
exports.completeBranch = completeBranch;
const crypto_1 = __importDefault(require("crypto"));
const denPoMestnomu_1 = require("../../lib/denPoMestnomu");
const dbPool_1 = require("../../lib/dbPool");
const ensureQCoreTables_1 = require("../../lib/ensureQCoreTables");
const providers_1 = require("./providers");
const pricing_1 = require("./pricing");
const pool = (0, dbPool_1.getPool)();
/* ═══════════════════════════════════════════════════════════════════════
   In-memory fallback state
   ═══════════════════════════════════════════════════════════════════════ */
const memSessions = new Map();
const memRuns = new Map();
const memMessagesByRun = new Map();
// Per-user monthly token ledger (in-memory fallback), key = `${userId}:${ym}`.
const memTokenLedger = new Map();
const memApiKeys = new Map();
const memMemories = new Map();
function nowIso() { return new Date().toISOString(); }
function deriveTitle(text) {
    const s = (text || "").trim().replace(/\s+/g, " ");
    if (!s)
        return "New session";
    return s.length > 60 ? s.slice(0, 57) + "…" : s;
}
/* ═══════════════════════════════════════════════════════════════════════
   Sessions
   ═══════════════════════════════════════════════════════════════════════ */
async function createSession(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const title = (opts.title?.trim() || "New session").slice(0, 120);
    const mode = opts.mode || "multi-agent";
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            userId: opts.userId ?? null,
            title,
            mode,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        memSessions.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreSession" ("id","userId","title","mode")
     VALUES ($1,$2,$3,$4)
     RETURNING *`, [id, opts.userId ?? null, title, mode]);
    return r.rows[0];
}
async function ensureSession(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (opts.sessionId) {
        if (!(0, ensureQCoreTables_1.isDbReady)()) {
            const existing = memSessions.get(opts.sessionId);
            if (existing) {
                if (existing.userId && opts.userId && existing.userId !== opts.userId) {
                    throw new Error("session not owned by caller");
                }
                return existing;
            }
        }
        else {
            const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "id"=$1`, [opts.sessionId]);
            const row = r.rows?.[0];
            if (row) {
                if (row.userId && opts.userId && row.userId !== opts.userId) {
                    throw new Error("session not owned by caller");
                }
                return row;
            }
        }
    }
    return createSession({
        userId: opts.userId ?? null,
        title: opts.seedTitle ? deriveTitle(opts.seedTitle) : null,
    });
}
async function touchSession(sessionId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(sessionId);
        if (s)
            s.updatedAt = nowIso();
        return;
    }
    await pool.query(`UPDATE "QCoreSession" SET "updatedAt"=NOW() WHERE "id"=$1`, [sessionId]);
}
async function renameSessionIfDefault(sessionId, seed) {
    const nice = deriveTitle(seed);
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(sessionId);
        if (s && (!s.title || s.title === "New session")) {
            s.title = nice;
            s.updatedAt = nowIso();
        }
        return;
    }
    await pool.query(`UPDATE "QCoreSession"
       SET "title"=$2, "updatedAt"=NOW()
     WHERE "id"=$1 AND ("title"='New session' OR "title" IS NULL OR "title"='')`, [sessionId, nice]);
}
async function listSessions(userId, limit = 50, includeArchived = false) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(200, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const all = Array.from(memSessions.values());
        const filtered = all.filter((s) => {
            if (userId ? s.userId !== userId : s.userId != null)
                return false;
            if (!includeArchived && s.archivedAt)
                return false;
            return true;
        });
        filtered.sort((a, b) => {
            const pa = a.pinned ? 1 : 0;
            const pb = b.pinned ? 1 : 0;
            if (pb !== pa)
                return pb - pa;
            return b.updatedAt.localeCompare(a.updatedAt);
        });
        return filtered.slice(0, lim);
    }
    const archiveFilter = includeArchived ? "" : `AND "archivedAt" IS NULL`;
    if (userId) {
        const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "userId"=$1 ${archiveFilter} ORDER BY "pinned" DESC, "updatedAt" DESC LIMIT $2`, [userId, lim]);
        return r.rows;
    }
    const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "userId" IS NULL ${archiveFilter} ORDER BY "pinned" DESC, "updatedAt" DESC LIMIT $1`, [lim]);
    return r.rows;
}
async function archiveSession(id, userId, archive) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(id);
        if (!s)
            return false;
        s.archivedAt = archive ? new Date().toISOString() : null;
        return true;
    }
    const r = await pool.query(`UPDATE "QCoreSession" SET "archivedAt"=${archive ? "NOW()" : "NULL"} WHERE "id"=$1 AND ("userId"=$2 OR "userId" IS NULL) RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function getSession(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const check = (row) => {
        if (!row)
            return null;
        if (row.userId && userId && row.userId !== userId)
            return null;
        if (row.userId && !userId)
            return null;
        return row;
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return check(memSessions.get(id));
    }
    const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "id"=$1`, [id]);
    return check(r.rows?.[0]);
}
async function deleteSession(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const session = await getSession(id, userId);
    if (!session)
        return false;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const runIds = Array.from(memRuns.values()).filter((r) => r.sessionId === id).map((r) => r.id);
        for (const rid of runIds) {
            memMessagesByRun.delete(rid);
            memRuns.delete(rid);
        }
        memSessions.delete(id);
        return true;
    }
    await pool.query(`DELETE FROM "QCoreMessage" WHERE "runId" IN (SELECT "id" FROM "QCoreRun" WHERE "sessionId"=$1)`, [id]);
    await pool.query(`DELETE FROM "QCoreRun" WHERE "sessionId"=$1`, [id]);
    await pool.query(`DELETE FROM "QCoreSession" WHERE "id"=$1`, [id]);
    return true;
}
async function renameSession(id, userId, nextTitle) {
    const session = await getSession(id, userId);
    if (!session)
        return null;
    const clean = (nextTitle || "").trim().slice(0, 120) || "New session";
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        session.title = clean;
        session.updatedAt = nowIso();
        memSessions.set(id, session);
        return session;
    }
    const r = await pool.query(`UPDATE "QCoreSession" SET "title"=$2, "updatedAt"=NOW() WHERE "id"=$1 RETURNING *`, [id, clean]);
    return r.rows?.[0] ?? null;
}
/* ═══════════════════════════════════════════════════════════════════════
   Runs
   ═══════════════════════════════════════════════════════════════════════ */
async function createRun(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const parentRunId = opts.parentRunId ?? null;
    const threadId = opts.threadId ?? (parentRunId ? null : id);
    const batchId = opts.batchId ?? null;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            sessionId: opts.sessionId,
            userInput: opts.userInput,
            status: "running",
            error: null,
            agentConfig: opts.agentConfig ?? null,
            strategy: opts.strategy ?? null,
            finalContent: null,
            totalDurationMs: null,
            totalCostUsd: null,
            shareToken: null,
            startedAt: nowIso(),
            finishedAt: null,
            parentRunId,
            threadId: threadId ?? id,
            batchId,
        };
        memRuns.set(id, row);
        memMessagesByRun.set(id, []);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreRun" ("id","sessionId","userInput","status","agentConfig","strategy","parentRunId","threadId","batchId")
     VALUES ($1,$2,$3,'running',$4,$5,$6,$7,$8)
     RETURNING *`, [
        id,
        opts.sessionId,
        opts.userInput,
        opts.agentConfig ? JSON.stringify(opts.agentConfig) : null,
        opts.strategy ?? null,
        parentRunId,
        threadId ?? id,
        batchId,
    ]);
    return r.rows[0];
}
async function finishRun(runId, status, opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const r = memRuns.get(runId);
        if (!r)
            return;
        r.status = status;
        r.error = opts.error ?? null;
        r.finalContent = opts.finalContent ?? null;
        r.totalDurationMs = opts.totalDurationMs ?? null;
        r.totalCostUsd = opts.totalCostUsd ?? null;
        r.finishedAt = nowIso();
        return;
    }
    await pool.query(`UPDATE "QCoreRun"
       SET "status"=$2,"error"=$3,"finalContent"=$4,"totalDurationMs"=$5,"totalCostUsd"=$6,"finishedAt"=NOW()
     WHERE "id"=$1`, [runId, status, opts.error ?? null, opts.finalContent ?? null, opts.totalDurationMs ?? null, opts.totalCostUsd ?? null]);
}
async function listRuns(sessionId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(200, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const rows = Array.from(memRuns.values()).filter((r) => r.sessionId === sessionId);
        rows.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        return rows.slice(0, lim);
    }
    const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "sessionId"=$1 ORDER BY "startedAt" ASC LIMIT $2`, [sessionId, lim]);
    return r.rows;
}
async function getRun(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memRuns.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "id"=$1`, [id]);
    return r.rows?.[0] || null;
}
/* ═══════════════════════════════════════════════════════════════════════
   Messages
   ═══════════════════════════════════════════════════════════════════════ */
async function insertMessage(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            runId: opts.runId,
            role: opts.role,
            stage: opts.stage ?? null,
            instance: opts.instance ?? null,
            provider: opts.provider ?? null,
            model: opts.model ?? null,
            content: opts.content,
            tokensIn: opts.tokensIn ?? null,
            tokensOut: opts.tokensOut ?? null,
            durationMs: opts.durationMs ?? null,
            costUsd: opts.costUsd ?? null,
            ordering: opts.ordering,
            createdAt: nowIso(),
        };
        const list = memMessagesByRun.get(opts.runId) || [];
        list.push(row);
        memMessagesByRun.set(opts.runId, list);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreMessage"
      ("id","runId","role","stage","instance","provider","model","content","tokensIn","tokensOut","durationMs","costUsd","ordering")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`, [
        id, opts.runId, opts.role, opts.stage ?? null, opts.instance ?? null,
        opts.provider ?? null, opts.model ?? null, opts.content,
        opts.tokensIn ?? null, opts.tokensOut ?? null, opts.durationMs ?? null,
        opts.costUsd ?? null, opts.ordering,
    ]);
    return r.rows[0];
}
async function listMessages(runId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const list = memMessagesByRun.get(runId) || [];
        return [...list].sort((a, b) => a.ordering - b.ordering);
    }
    const r = await pool.query(`SELECT * FROM "QCoreMessage" WHERE "runId"=$1 ORDER BY "ordering" ASC`, [runId]);
    return r.rows;
}
/* ═══════════════════════════════════════════════════════════════════════
   Sharing
   ═══════════════════════════════════════════════════════════════════════ */
/** Enable public sharing of a run — returns the token. Idempotent (reuses existing token). */
async function shareRun(runId, userId) {
    const run = await getRun(runId);
    if (!run)
        return null;
    const session = await getSession(run.sessionId, userId);
    if (!session)
        return null;
    if (run.shareToken)
        return run.shareToken;
    const token = crypto_1.default.randomBytes(24).toString("base64url");
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        run.shareToken = token;
        memRuns.set(runId, run);
        return token;
    }
    await pool.query(`UPDATE "QCoreRun" SET "shareToken"=$2 WHERE "id"=$1`, [runId, token]);
    return token;
}
/** Disable public sharing. Returns true if a token was revoked. */
async function unshareRun(runId, userId) {
    const run = await getRun(runId);
    if (!run)
        return false;
    const session = await getSession(run.sessionId, userId);
    if (!session)
        return false;
    if (!run.shareToken)
        return false;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        run.shareToken = null;
        memRuns.set(runId, run);
        return true;
    }
    await pool.query(`UPDATE "QCoreRun" SET "shareToken"=NULL WHERE "id"=$1`, [runId]);
    return true;
}
/** Look up a run by its public share token (read-only path, no auth required). */
async function getRunByShareToken(token) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        for (const r of memRuns.values())
            if (r.shareToken === token)
                return r;
        return null;
    }
    const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "shareToken"=$1 LIMIT 1`, [token]);
    return r.rows?.[0] || null;
}
/** Public-safe session fetch (used by shared endpoint — returns only title/mode). */
async function getSessionPublic(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(id);
        return s ? { id: s.id, title: s.title, mode: s.mode } : null;
    }
    const r = await pool.query(`SELECT "id","title","mode" FROM "QCoreSession" WHERE "id"=$1`, [id]);
    return r.rows?.[0] || null;
}
async function getAnalytics(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const scope = userId ? "mine" : "anonymous";
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return analyticsFromMemory(userId, scope);
    }
    const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
    const params = userId ? [userId] : [];
    const runsQ = await pool.query(`SELECT COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"), 0)::float8 AS "costUsd",
            COALESCE(SUM(r."totalDurationMs"), 0)::bigint AS "durationMs"
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}`, params);
    const sessQ = await pool.query(`SELECT COUNT(*)::int AS sessions FROM "QCoreSession" s WHERE ${userPredicate}`, params);
    const tokensQ = await pool.query(`SELECT COALESCE(SUM(m."tokensIn"),0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"),0)::bigint AS "tokensOut",
            COUNT(*)::int AS messages
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}`, params);
    const strategyQ = await pool.query(`SELECT COALESCE(r."strategy",'sequential') AS strategy,
            COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"),0)::float8 AS "costUsd",
            COALESCE(SUM(
              (SELECT COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)
                 FROM "QCoreMessage" m WHERE m."runId"=r."id")
            ),0)::bigint AS "tokens",
            COALESCE(AVG(r."totalDurationMs"),0)::float8 AS "avgDurationMs"
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}
      GROUP BY COALESCE(r."strategy",'sequential')
      ORDER BY runs DESC`, params);
    const providerQ = await pool.query(`SELECT m."provider" AS provider,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd",
            COALESCE(SUM(m."tokensIn"),0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"),0)::bigint AS "tokensOut"
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate} AND m."provider" IS NOT NULL
      GROUP BY m."provider" ORDER BY calls DESC`, params);
    const modelQ = await pool.query(`SELECT m."provider" AS provider, m."model" AS model,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd",
            COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)::bigint AS "tokens"
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate} AND m."provider" IS NOT NULL AND m."model" IS NOT NULL
      GROUP BY m."provider", m."model" ORDER BY calls DESC LIMIT 20`, params);
    const recentQ = await pool.query(`SELECT r."id" AS "runId", r."sessionId" AS "sessionId", r."strategy" AS strategy,
            r."totalCostUsd" AS "costUsd", r."totalDurationMs" AS "totalDurationMs",
            r."startedAt" AS "startedAt", s."title" AS title
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate} ORDER BY r."startedAt" DESC LIMIT 10`, params);
    return {
        scope,
        runs: runsQ.rows[0]?.runs ?? 0,
        sessions: sessQ.rows[0]?.sessions ?? 0,
        messages: tokensQ.rows[0]?.messages ?? 0,
        totals: {
            tokensIn: Number(tokensQ.rows[0]?.tokensIn ?? 0),
            tokensOut: Number(tokensQ.rows[0]?.tokensOut ?? 0),
            costUsd: Number(runsQ.rows[0]?.costUsd ?? 0),
            durationMs: Number(runsQ.rows[0]?.durationMs ?? 0),
        },
        byStrategy: strategyQ.rows.map((r) => ({
            strategy: r.strategy, runs: r.runs,
            costUsd: Number(r.costUsd), tokens: Number(r.tokens),
            avgDurationMs: Number(r.avgDurationMs),
        })),
        byProvider: providerQ.rows.map((r) => ({
            provider: r.provider, calls: r.calls,
            costUsd: Number(r.costUsd),
            tokensIn: Number(r.tokensIn), tokensOut: Number(r.tokensOut),
        })),
        byModel: modelQ.rows.map((r) => ({
            provider: r.provider, model: r.model, calls: r.calls,
            costUsd: Number(r.costUsd), tokens: Number(r.tokens),
        })),
        recent: recentQ.rows.map((r) => ({
            runId: r.runId, sessionId: r.sessionId, strategy: r.strategy,
            costUsd: r.costUsd, totalDurationMs: r.totalDurationMs,
            startedAt: r.startedAt, title: r.title,
        })),
    };
}
async function getOpexSummary(days = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const n = Math.max(1, Math.min(90, Math.floor(days)));
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return opexFromMemory();
    const providerQ = await pool.query(`SELECT m."provider" AS provider,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."tokensIn"),0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"),0)::bigint AS "tokensOut",
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd"
       FROM "QCoreMessage" m
      WHERE m."provider" IS NOT NULL
      GROUP BY m."provider" ORDER BY "costUsd" DESC`);
    const modelQ = await pool.query(`SELECT m."provider" AS provider, m."model" AS model,
            COUNT(*)::int AS calls,
            COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)::bigint AS tokens,
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd"
       FROM "QCoreMessage" m
      WHERE m."provider" IS NOT NULL AND m."model" IS NOT NULL
      GROUP BY m."provider", m."model" ORDER BY "costUsd" DESC LIMIT 20`);
    const dailyQ = await pool.query(`SELECT to_char(date_trunc('day', r."startedAt"), 'YYYY-MM-DD') AS date,
            COUNT(m."id")::int AS calls,
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd"
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
      WHERE r."startedAt" >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY 1 ORDER BY 1`, [n]);
    const byProvider = providerQ.rows.map((r) => ({
        provider: r.provider, calls: r.calls,
        tokensIn: Number(r.tokensIn), tokensOut: Number(r.tokensOut),
        costUsd: Number(r.costUsd),
    }));
    const totals = byProvider.reduce((a, p) => {
        a.calls += p.calls;
        a.tokensIn += p.tokensIn;
        a.tokensOut += p.tokensOut;
        a.costUsd += p.costUsd;
        return a;
    }, { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 });
    return {
        totals,
        byProvider,
        byModel: modelQ.rows.map((r) => ({
            provider: r.provider, model: r.model, calls: r.calls,
            tokens: Number(r.tokens), costUsd: Number(r.costUsd),
        })),
        daily: dailyQ.rows.map((r) => ({ date: r.date, calls: r.calls, costUsd: Number(r.costUsd) })),
        source: "db",
    };
}
function opexFromMemory() {
    const byProviderMap = new Map();
    const byModelMap = new Map();
    const totals = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    for (const ms of memMessagesByRun.values()) {
        for (const m of ms) {
            if (!m.provider)
                continue;
            totals.calls += 1;
            totals.tokensIn += m.tokensIn ?? 0;
            totals.tokensOut += m.tokensOut ?? 0;
            totals.costUsd += m.costUsd ?? 0;
            const pe = byProviderMap.get(m.provider) || { provider: m.provider, calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
            pe.calls += 1;
            pe.tokensIn += m.tokensIn ?? 0;
            pe.tokensOut += m.tokensOut ?? 0;
            pe.costUsd += m.costUsd ?? 0;
            byProviderMap.set(m.provider, pe);
            if (m.model) {
                const mk = `${m.provider}:${m.model}`;
                const me = byModelMap.get(mk) || { provider: m.provider, model: m.model, calls: 0, tokens: 0, costUsd: 0 };
                me.calls += 1;
                me.tokens += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
                me.costUsd += m.costUsd ?? 0;
                byModelMap.set(mk, me);
            }
        }
    }
    return {
        totals,
        byProvider: Array.from(byProviderMap.values()).sort((a, b) => b.costUsd - a.costUsd),
        byModel: Array.from(byModelMap.values()).sort((a, b) => b.costUsd - a.costUsd).slice(0, 20),
        daily: [],
        source: "memory",
    };
}
function analyticsFromMemory(userId, scope) {
    const sessions = Array.from(memSessions.values()).filter((s) => userId ? s.userId === userId : s.userId == null);
    const sessIds = new Set(sessions.map((s) => s.id));
    const runs = Array.from(memRuns.values()).filter((r) => sessIds.has(r.sessionId));
    let tokensIn = 0, tokensOut = 0, messagesCount = 0;
    const messages = [];
    for (const r of runs) {
        const ms = memMessagesByRun.get(r.id) || [];
        for (const m of ms) {
            messages.push(m);
            tokensIn += m.tokensIn ?? 0;
            tokensOut += m.tokensOut ?? 0;
            messagesCount += 1;
        }
    }
    const totalCostUsd = runs.reduce((s, r) => s + (r.totalCostUsd ?? 0), 0);
    const totalDurationMs = runs.reduce((s, r) => s + (r.totalDurationMs ?? 0), 0);
    const byStrategyMap = new Map();
    for (const r of runs) {
        const s = r.strategy || "sequential";
        const entry = byStrategyMap.get(s) || { strategy: s, runs: 0, costUsd: 0, tokens: 0, durSum: 0, durCount: 0 };
        entry.runs += 1;
        entry.costUsd += r.totalCostUsd ?? 0;
        const ms = memMessagesByRun.get(r.id) || [];
        for (const m of ms)
            entry.tokens += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
        if (r.totalDurationMs != null) {
            entry.durSum += r.totalDurationMs;
            entry.durCount += 1;
        }
        byStrategyMap.set(s, entry);
    }
    const byProviderMap = new Map();
    const byModelMap = new Map();
    for (const m of messages) {
        if (m.provider) {
            const pe = byProviderMap.get(m.provider) || { provider: m.provider, calls: 0, costUsd: 0, tokensIn: 0, tokensOut: 0 };
            pe.calls += 1;
            pe.costUsd += m.costUsd ?? 0;
            pe.tokensIn += m.tokensIn ?? 0;
            pe.tokensOut += m.tokensOut ?? 0;
            byProviderMap.set(m.provider, pe);
        }
        if (m.provider && m.model) {
            const key = `${m.provider}|${m.model}`;
            const me = byModelMap.get(key) || { provider: m.provider, model: m.model, calls: 0, costUsd: 0, tokens: 0 };
            me.calls += 1;
            me.costUsd += m.costUsd ?? 0;
            me.tokens += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
            byModelMap.set(key, me);
        }
    }
    const recent = runs
        .slice()
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 10)
        .map((r) => ({
        runId: r.id,
        sessionId: r.sessionId,
        strategy: r.strategy,
        costUsd: r.totalCostUsd,
        totalDurationMs: r.totalDurationMs,
        startedAt: r.startedAt,
        title: memSessions.get(r.sessionId)?.title || "(session)",
    }));
    return {
        scope,
        runs: runs.length,
        sessions: sessions.length,
        messages: messagesCount,
        totals: { tokensIn, tokensOut, costUsd: totalCostUsd, durationMs: totalDurationMs },
        byStrategy: Array.from(byStrategyMap.values())
            .map((e) => ({
            strategy: e.strategy,
            runs: e.runs,
            costUsd: e.costUsd,
            tokens: e.tokens,
            avgDurationMs: e.durCount ? e.durSum / e.durCount : 0,
        }))
            .sort((a, b) => b.runs - a.runs),
        byProvider: Array.from(byProviderMap.values()).sort((a, b) => b.calls - a.calls),
        byModel: Array.from(byModelMap.values()).sort((a, b) => b.calls - a.calls).slice(0, 20),
        recent,
    };
}
const memSharedPresets = new Map();
async function createSharedPreset(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const name = (opts.name || "").trim().slice(0, 80);
    if (!name)
        throw new Error("preset name required");
    const description = opts.description ? String(opts.description).trim().slice(0, 400) : null;
    const strategy = opts.strategy === "parallel" || opts.strategy === "debate" ? opts.strategy : "sequential";
    const overrides = opts.overrides && typeof opts.overrides === "object" ? opts.overrides : {};
    const isPublic = opts.isPublic !== false;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            ownerUserId: opts.ownerUserId,
            name,
            description,
            strategy,
            overrides,
            isPublic,
            importCount: 0,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        memSharedPresets.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreSharedPreset"
       ("id","ownerUserId","name","description","strategy","overrides","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
     RETURNING *`, [id, opts.ownerUserId, name, description, strategy, JSON.stringify(overrides), isPublic]);
    return r.rows[0];
}
async function listPublicSharedPresets(query, limit = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(100, limit));
    const q = (query || "").trim();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let rows = Array.from(memSharedPresets.values()).filter((p) => p.isPublic);
        if (q) {
            const ql = q.toLowerCase();
            rows = rows.filter((p) => p.name.toLowerCase().includes(ql) || (p.description || "").toLowerCase().includes(ql));
        }
        rows.sort((a, b) => b.importCount - a.importCount || b.updatedAt.localeCompare(a.updatedAt));
        return rows.slice(0, lim);
    }
    if (q) {
        const r = await pool.query(`SELECT * FROM "QCoreSharedPreset"
        WHERE "isPublic" = TRUE
          AND ("name" ILIKE $1 OR "description" ILIKE $1)
        ORDER BY "importCount" DESC, "updatedAt" DESC
        LIMIT $2`, [`%${q}%`, lim]);
        return r.rows;
    }
    const r = await pool.query(`SELECT * FROM "QCoreSharedPreset"
      WHERE "isPublic" = TRUE
      ORDER BY "importCount" DESC, "updatedAt" DESC
      LIMIT $1`, [lim]);
    return r.rows;
}
async function getSharedPreset(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memSharedPresets.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreSharedPreset" WHERE "id"=$1`, [id]);
    return r.rows?.[0] || null;
}
async function importSharedPreset(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const p = memSharedPresets.get(id);
        if (!p || !p.isPublic)
            return null;
        p.importCount += 1;
        p.updatedAt = nowIso();
        return p;
    }
    const r = await pool.query(`UPDATE "QCoreSharedPreset"
        SET "importCount" = "importCount" + 1,
            "updatedAt"   = NOW()
      WHERE "id"=$1 AND "isPublic"=TRUE
      RETURNING *`, [id]);
    return r.rows?.[0] || null;
}
async function deleteSharedPreset(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const p = memSharedPresets.get(id);
        if (!p || p.ownerUserId !== userId)
            return false;
        memSharedPresets.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreSharedPreset" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
/* ═══════════════════════════════════════════════════════════════════════
   Refinement / search / tagging extras
   ═══════════════════════════════════════════════════════════════════════ */
/** Highest ordering value for a run, or 0 if no messages — used to append refinement messages. */
async function getMaxOrdering(runId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const list = memMessagesByRun.get(runId) || [];
        return list.reduce((m, r) => (r.ordering > m ? r.ordering : m), 0);
    }
    const r = await pool.query(`SELECT COALESCE(MAX("ordering"), 0)::int AS m FROM "QCoreMessage" WHERE "runId"=$1`, [runId]);
    return Number(r.rows?.[0]?.m ?? 0);
}
/** Apply refinement on top of a finished run: replace finalContent, accumulate cost/duration. */
async function applyRefinement(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const r = memRuns.get(opts.runId);
        if (!r)
            return null;
        r.finalContent = opts.finalContent;
        r.totalCostUsd = (r.totalCostUsd ?? 0) + opts.addCostUsd;
        r.totalDurationMs = (r.totalDurationMs ?? 0) + opts.addDurationMs;
        return r;
    }
    const r = await pool.query(`UPDATE "QCoreRun"
        SET "finalContent"=$2,
            "totalCostUsd"=COALESCE("totalCostUsd",0)+$3,
            "totalDurationMs"=COALESCE("totalDurationMs",0)+$4
      WHERE "id"=$1
      RETURNING *`, [opts.runId, opts.finalContent, opts.addCostUsd, opts.addDurationMs]);
    return r.rows?.[0] || null;
}
/** Replace a run's tags. Owner-checked, normalized (trim/dedupe/cap 16x32). */
async function setRunTags(runId, userId, tags) {
    const run = await getRun(runId);
    if (!run)
        return null;
    const session = await getSession(run.sessionId, userId);
    if (!session)
        return null;
    const cleaned = Array.from(new Set(tags
        .map((t) => (typeof t === "string" ? t.trim().slice(0, 32) : ""))
        .filter((t) => t.length > 0))).slice(0, 16);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        run.tags = cleaned;
        memRuns.set(runId, run);
        return run;
    }
    const r = await pool.query(`UPDATE "QCoreRun" SET "tags"=$2 WHERE "id"=$1 RETURNING *`, [runId, cleaned]);
    return r.rows?.[0] || null;
}
/** Substring search across the user's runs — userInput / finalContent / session.title / tags. */
async function searchRuns(userId, query, limit = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const q = (query || "").trim();
    if (!q)
        return [];
    const lim = Math.max(1, Math.min(100, limit));
    const buildPreview = (hay, needle) => {
        const lower = hay.toLowerCase();
        const idx = lower.indexOf(needle.toLowerCase());
        if (idx < 0)
            return hay.slice(0, 160);
        const start = Math.max(0, idx - 40);
        const end = Math.min(hay.length, idx + needle.length + 80);
        const slice = hay.slice(start, end).replace(/\s+/g, " ");
        return (start > 0 ? "…" : "") + slice + (end < hay.length ? "…" : "");
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const sessions = Array.from(memSessions.values()).filter((s) => userId ? s.userId === userId : s.userId == null);
        const sessionById = new Map(sessions.map((s) => [s.id, s]));
        const hits = [];
        const ql = q.toLowerCase();
        for (const r of memRuns.values()) {
            const session = sessionById.get(r.sessionId);
            if (!session)
                continue;
            const inInput = (r.userInput || "").toLowerCase().includes(ql);
            const inFinal = (r.finalContent || "").toLowerCase().includes(ql);
            const inTitle = (session.title || "").toLowerCase().includes(ql);
            const inTags = (r.tags || []).some((t) => t.toLowerCase().includes(ql));
            if (!inInput && !inFinal && !inTitle && !inTags)
                continue;
            const preview = inInput
                ? buildPreview(r.userInput, q)
                : inFinal
                    ? buildPreview(r.finalContent || "", q)
                    : inTags
                        ? `tag · ${(r.tags || []).find((t) => t.toLowerCase().includes(ql))}`
                        : (session.title || "");
            hits.push({
                runId: r.id,
                sessionId: r.sessionId,
                sessionTitle: session.title || "",
                strategy: r.strategy || null,
                status: r.status,
                startedAt: r.startedAt,
                totalCostUsd: r.totalCostUsd ?? null,
                preview,
                matched: inInput ? "input" : inFinal ? "final" : inTags ? "tag" : "title",
            });
        }
        hits.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        return hits.slice(0, lim);
    }
    const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
    const params = userId ? [userId, `%${q}%`, lim] : [`%${q}%`, lim];
    const qParam = userId ? `$2` : `$1`;
    const limParam = userId ? `$3` : `$2`;
    const r = await pool.query(`SELECT r."id" AS "runId", r."sessionId", r."strategy", r."status",
            r."startedAt", r."totalCostUsd",
            r."userInput", r."finalContent", r."tags",
            s."title" AS "sessionTitle",
            CASE
              WHEN r."userInput" ILIKE ${qParam} THEN 'input'
              WHEN r."finalContent" ILIKE ${qParam} THEN 'final'
              WHEN EXISTS (SELECT 1 FROM unnest(r."tags") t WHERE t ILIKE ${qParam}) THEN 'tag'
              ELSE 'title'
            END AS matched
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}
        AND ( r."userInput" ILIKE ${qParam}
           OR r."finalContent" ILIKE ${qParam}
           OR s."title" ILIKE ${qParam}
           OR EXISTS (SELECT 1 FROM unnest(r."tags") t WHERE t ILIKE ${qParam}) )
      ORDER BY r."startedAt" DESC
      LIMIT ${limParam}`, params);
    return r.rows.map((row) => {
        const matched = row.matched;
        const preview = matched === "input"
            ? buildPreview(row.userInput || "", q)
            : matched === "final"
                ? buildPreview(row.finalContent || "", q)
                : matched === "tag"
                    ? `tag · ${(row.tags || []).find((t) => t.toLowerCase().includes(q.toLowerCase())) || ""}`
                    : (row.sessionTitle || "");
        return {
            runId: row.runId,
            sessionId: row.sessionId,
            sessionTitle: row.sessionTitle || "",
            strategy: row.strategy,
            status: row.status,
            startedAt: row.startedAt,
            totalCostUsd: row.totalCostUsd ?? null,
            preview,
            matched,
        };
    });
}
/** Top tags across the user's runs — drives the sidebar chip strip. */
async function getTopUserTags(userId, limit = 20) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(100, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const sessionIds = new Set(Array.from(memSessions.values())
            .filter((s) => (userId ? s.userId === userId : s.userId == null))
            .map((s) => s.id));
        const counts = new Map();
        for (const r of memRuns.values()) {
            if (!sessionIds.has(r.sessionId))
                continue;
            for (const t of r.tags || []) {
                counts.set(t, (counts.get(t) || 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, lim)
            .map(([tag, count]) => ({ tag, count }));
    }
    const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
    const params = userId ? [userId, lim] : [lim];
    const limParam = userId ? `$2` : `$1`;
    const r = await pool.query(`SELECT t AS tag, COUNT(*)::int AS count
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId",
            unnest(r."tags") AS t
      WHERE ${userPredicate}
      GROUP BY t
      ORDER BY count DESC, t ASC
      LIMIT ${limParam}`, params);
    return r.rows.map((row) => ({ tag: String(row.tag), count: Number(row.count) }));
}
/** Daily cost/run timeseries for analytics — last `days` calendar days. */
async function getCostTimeseries(userId, days = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const d = Math.max(1, Math.min(365, days));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const sessionIds = new Set(Array.from(memSessions.values())
            .filter((s) => (userId ? s.userId === userId : s.userId == null))
            .map((s) => s.id));
        const buckets = new Map();
        const cutoff = Date.now() - d * 86400000;
        for (const r of memRuns.values()) {
            if (!sessionIds.has(r.sessionId))
                continue;
            const t = Date.parse(r.startedAt);
            if (!Number.isFinite(t) || t < cutoff)
                continue;
            const date = (0, denPoMestnomu_1.denPoMestnomu)(new Date(t));
            const cur = buckets.get(date) || { runs: 0, costUsd: 0 };
            cur.runs += 1;
            cur.costUsd += r.totalCostUsd ?? 0;
            buckets.set(date, cur);
        }
        return Array.from(buckets.entries())
            .map(([date, v]) => ({ date, runs: v.runs, costUsd: v.costUsd }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
    const params = userId ? [userId] : [];
    const r = await pool.query(`SELECT to_char(date_trunc('day', r."startedAt"), 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"), 0)::float8 AS "costUsd"
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}
        AND r."startedAt" >= NOW() - INTERVAL '${d} days'
      GROUP BY date
      ORDER BY date ASC`, params);
    return r.rows.map((row) => ({
        date: String(row.date),
        runs: Number(row.runs),
        costUsd: Number(row.costUsd),
    }));
}
/* ═══════════════════════════════════════════════════════════════════════
   History (for follow-up turns)
   ═══════════════════════════════════════════════════════════════════════ */
async function buildHistoryContext(sessionId, maxTurns = 6) {
    const runs = await listRuns(sessionId, maxTurns);
    const out = [];
    for (const run of runs) {
        if (run.userInput)
            out.push({ role: "user", content: run.userInput });
        if (run.finalContent)
            out.push({ role: "assistant", content: run.finalContent });
    }
    return out;
}
/** Returns all runs in a thread ordered oldest→newest (root included). */
async function getThread(threadId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const rows = Array.from(memRuns.values()).filter((r) => r.threadId === threadId || r.id === threadId);
        rows.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        return rows;
    }
    const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "threadId"=$1 ORDER BY "startedAt" ASC`, [threadId]);
    return r.rows;
}
/**
 * Builds a ChatMessage[] conversation history by walking UP the parent chain
 * from the given run (not including it). Used when continuing a specific run
 * so the agent sees the full thread context, not just the session's last N turns.
 */
async function buildThreadContext(runId, maxTurns = 12) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const chain = [];
    let current = await getRun(runId);
    let steps = 0;
    while (current && steps < maxTurns) {
        chain.unshift(current);
        if (!current.parentRunId)
            break;
        current = await getRun(current.parentRunId);
        steps++;
    }
    const out = [];
    for (const run of chain) {
        if (run.userInput)
            out.push({ role: "user", content: run.userInput });
        if (run.finalContent)
            out.push({ role: "assistant", content: run.finalContent });
    }
    return out;
}
const memEvalSuites = new Map();
const memEvalRuns = new Map();
function normalizeStrategy(s) {
    return s === "parallel" || s === "debate" ? s : "sequential";
}
function normalizeCases(cases) {
    if (!Array.isArray(cases))
        return [];
    const out = [];
    for (const c of cases) {
        if (!c || typeof c !== "object")
            continue;
        const id = String(c.id || crypto_1.default.randomUUID()).slice(0, 64);
        const input = String(c.input ?? "").slice(0, 4000);
        if (!input.trim())
            continue;
        const j = c.judge || {};
        let judge = null;
        if (j.type === "contains" && typeof j.needle === "string") {
            judge = { type: "contains", needle: String(j.needle).slice(0, 500), caseSensitive: !!j.caseSensitive };
        }
        else if (j.type === "not_contains" && typeof j.needle === "string") {
            judge = { type: "not_contains", needle: String(j.needle).slice(0, 500), caseSensitive: !!j.caseSensitive };
        }
        else if (j.type === "equals" && typeof j.expected === "string") {
            judge = { type: "equals", expected: String(j.expected).slice(0, 4000), caseSensitive: !!j.caseSensitive, trim: j.trim !== false };
        }
        else if (j.type === "regex" && typeof j.pattern === "string") {
            judge = { type: "regex", pattern: String(j.pattern).slice(0, 500), flags: typeof j.flags === "string" ? j.flags.slice(0, 8) : "" };
        }
        else if (j.type === "min_length" && Number.isFinite(Number(j.chars))) {
            judge = { type: "min_length", chars: Math.max(0, Math.min(100000, Number(j.chars))) };
        }
        else if (j.type === "max_length" && Number.isFinite(Number(j.chars))) {
            judge = { type: "max_length", chars: Math.max(0, Math.min(100000, Number(j.chars))) };
        }
        else if (j.type === "llm_judge" && typeof j.rubric === "string" && j.rubric.trim()) {
            const passThreshold = Number(j.passThreshold);
            judge = {
                type: "llm_judge",
                rubric: String(j.rubric).slice(0, 4000),
                provider: typeof j.provider === "string" ? j.provider.slice(0, 32) : undefined,
                model: typeof j.model === "string" ? j.model.slice(0, 64) : undefined,
                passThreshold: Number.isFinite(passThreshold) ? Math.max(0, Math.min(1, passThreshold)) : undefined,
            };
        }
        else {
            continue;
        }
        const weight = Number.isFinite(Number(c.weight)) ? Math.max(0, Math.min(100, Number(c.weight))) : 1;
        const name = c.name ? String(c.name).slice(0, 80) : `Case ${id.slice(0, 6)}`;
        out.push({ id, name, input, judge, weight });
        if (out.length >= 200)
            break;
    }
    return out;
}
async function createEvalSuite(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const name = (opts.name || "").trim().slice(0, 80) || "Untitled suite";
    const description = opts.description ? String(opts.description).trim().slice(0, 400) : null;
    const strategy = normalizeStrategy(opts.strategy);
    const overrides = opts.overrides && typeof opts.overrides === "object" ? opts.overrides : {};
    const cases = normalizeCases(opts.cases);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            ownerUserId: opts.ownerUserId,
            name,
            description,
            strategy,
            overrides,
            cases,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        memEvalSuites.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreEvalSuite"
       ("id","ownerUserId","name","description","strategy","overrides","cases")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     RETURNING *`, [id, opts.ownerUserId, name, description, strategy, JSON.stringify(overrides), JSON.stringify(cases)]);
    return r.rows[0];
}
async function listEvalSuites(userId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(200, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memEvalSuites.values())
            .filter((s) => s.ownerUserId === userId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, lim);
    }
    const r = await pool.query(`SELECT * FROM "QCoreEvalSuite"
      WHERE "ownerUserId" = $1
      ORDER BY "updatedAt" DESC
      LIMIT $2`, [userId, lim]);
    return r.rows;
}
async function listPublicEvalSuites(limit = 20) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(100, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memEvalSuites.values()).filter((s) => s.isPublic).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, lim);
    const r = await pool.query(`SELECT * FROM "QCoreEvalSuite" WHERE "isPublic"=TRUE ORDER BY "updatedAt" DESC LIMIT $1`, [lim]);
    return r.rows;
}
async function setEvalSuitePublic(id, userId, isPublic) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memEvalSuites.get(id);
        if (!s || s.ownerUserId !== userId)
            return false;
        s.isPublic = isPublic;
        return true;
    }
    const r = await pool.query(`UPDATE "QCoreEvalSuite" SET "isPublic"=$1 WHERE "id"=$2 AND "ownerUserId"=$3 RETURNING "id"`, [isPublic, id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function getEvalSuite(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memEvalSuites.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreEvalSuite" WHERE "id"=$1`, [id]);
    return r.rows?.[0] || null;
}
async function updateEvalSuite(id, userId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const cur = memEvalSuites.get(id);
        if (!cur || cur.ownerUserId !== userId)
            return null;
        if (patch.name != null)
            cur.name = String(patch.name).trim().slice(0, 80) || cur.name;
        if (patch.description !== undefined)
            cur.description = patch.description ? String(patch.description).trim().slice(0, 400) : null;
        if (patch.strategy)
            cur.strategy = normalizeStrategy(patch.strategy);
        if (patch.overrides && typeof patch.overrides === "object")
            cur.overrides = patch.overrides;
        if (patch.cases !== undefined)
            cur.cases = normalizeCases(patch.cases);
        cur.updatedAt = nowIso();
        return cur;
    }
    const sets = [];
    const params = [];
    let i = 1;
    if (patch.name != null) {
        const v = String(patch.name).trim().slice(0, 80);
        if (v) {
            sets.push(`"name"=$${i++}`);
            params.push(v);
        }
    }
    if (patch.description !== undefined) {
        sets.push(`"description"=$${i++}`);
        params.push(patch.description ? String(patch.description).trim().slice(0, 400) : null);
    }
    if (patch.strategy) {
        sets.push(`"strategy"=$${i++}`);
        params.push(normalizeStrategy(patch.strategy));
    }
    if (patch.overrides && typeof patch.overrides === "object") {
        sets.push(`"overrides"=$${i++}::jsonb`);
        params.push(JSON.stringify(patch.overrides));
    }
    if (patch.cases !== undefined) {
        sets.push(`"cases"=$${i++}::jsonb`);
        params.push(JSON.stringify(normalizeCases(patch.cases)));
    }
    if (!sets.length)
        return getEvalSuite(id);
    sets.push(`"updatedAt"=NOW()`);
    params.push(id, userId);
    const r = await pool.query(`UPDATE "QCoreEvalSuite" SET ${sets.join(", ")}
      WHERE "id"=$${i++} AND "ownerUserId"=$${i++}
      RETURNING *`, params);
    return r.rows?.[0] || null;
}
async function deleteEvalSuite(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memEvalSuites.get(id);
        if (!s || s.ownerUserId !== userId)
            return false;
        memEvalSuites.delete(id);
        for (const [runId, run] of memEvalRuns) {
            if (run.suiteId === id)
                memEvalRuns.delete(runId);
        }
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreEvalSuite" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function createEvalRun(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            suiteId: opts.suiteId,
            ownerUserId: opts.ownerUserId,
            status: "running",
            score: null,
            totalCases: opts.totalCases,
            passedCases: 0,
            totalCostUsd: 0,
            results: [],
            errorMessage: null,
            startedAt: nowIso(),
            completedAt: null,
        };
        memEvalRuns.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreEvalRun"
       ("id","suiteId","ownerUserId","status","totalCases","passedCases","totalCostUsd","results")
     VALUES ($1,$2,$3,'running',$4,0,0,'[]'::jsonb)
     RETURNING *`, [id, opts.suiteId, opts.ownerUserId, opts.totalCases]);
    return r.rows[0];
}
async function updateEvalRun(id, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const cur = memEvalRuns.get(id);
        if (!cur)
            return null;
        Object.assign(cur, patch);
        return cur;
    }
    const sets = [];
    const params = [];
    let i = 1;
    if (patch.status !== undefined) {
        sets.push(`"status"=$${i++}`);
        params.push(patch.status);
    }
    if (patch.score !== undefined) {
        sets.push(`"score"=$${i++}`);
        params.push(patch.score);
    }
    if (patch.passedCases !== undefined) {
        sets.push(`"passedCases"=$${i++}`);
        params.push(patch.passedCases);
    }
    if (patch.totalCostUsd !== undefined) {
        sets.push(`"totalCostUsd"=$${i++}`);
        params.push(patch.totalCostUsd);
    }
    if (patch.results !== undefined) {
        sets.push(`"results"=$${i++}::jsonb`);
        params.push(JSON.stringify(patch.results));
    }
    if (patch.errorMessage !== undefined) {
        sets.push(`"errorMessage"=$${i++}`);
        params.push(patch.errorMessage);
    }
    if (patch.completedAt !== undefined) {
        sets.push(`"completedAt"=$${i++}`);
        params.push(patch.completedAt);
    }
    if (!sets.length)
        return getEvalRun(id);
    params.push(id);
    const r = await pool.query(`UPDATE "QCoreEvalRun" SET ${sets.join(", ")}
      WHERE "id"=$${i++}
      RETURNING *`, params);
    return r.rows?.[0] || null;
}
async function getEvalRun(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memEvalRuns.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreEvalRun" WHERE "id"=$1`, [id]);
    return r.rows?.[0] || null;
}
async function listSuiteRuns(suiteId, limit = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(100, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memEvalRuns.values())
            .filter((r) => r.suiteId === suiteId)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .slice(0, lim);
    }
    const r = await pool.query(`SELECT * FROM "QCoreEvalRun"
      WHERE "suiteId"=$1
      ORDER BY "startedAt" DESC
      LIMIT $2`, [suiteId, lim]);
    return r.rows;
}
const memPrompts = new Map();
const VALID_PROMPT_ROLES = new Set(["analyst", "writer", "writerB", "critic", "judge", "system"]);
function normalizePromptRole(role) {
    if (typeof role !== "string")
        return "writer";
    return VALID_PROMPT_ROLES.has(role) ? role : "writer";
}
async function createPrompt(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const name = (opts.name || "").trim().slice(0, 80);
    if (!name)
        throw new Error("prompt name required");
    const content = (opts.content || "").slice(0, 16000);
    if (!content.trim())
        throw new Error("prompt content required");
    const description = opts.description ? String(opts.description).trim().slice(0, 400) : null;
    const role = normalizePromptRole(opts.role);
    const isPublic = opts.isPublic === true;
    const parentPromptId = opts.parentPromptId ? String(opts.parentPromptId) : null;
    // Compute version: parent.version + 1, default 1.
    let version = 1;
    if (parentPromptId) {
        const parent = await getPrompt(parentPromptId);
        if (parent)
            version = (parent.version || 1) + 1;
    }
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            ownerUserId: opts.ownerUserId,
            name,
            description,
            role,
            content,
            version,
            parentPromptId,
            isPublic,
            importCount: 0,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        memPrompts.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCorePrompt"
       ("id","ownerUserId","name","description","role","content","version","parentPromptId","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`, [id, opts.ownerUserId, name, description, role, content, version, parentPromptId, isPublic]);
    return r.rows[0];
}
async function getPrompt(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memPrompts.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCorePrompt" WHERE "id"=$1`, [id]);
    return r.rows?.[0] || null;
}
async function listPrompts(userId, limit = 100) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(500, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memPrompts.values())
            .filter((p) => p.ownerUserId === userId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, lim);
    }
    const r = await pool.query(`SELECT * FROM "QCorePrompt"
      WHERE "ownerUserId"=$1
      ORDER BY "updatedAt" DESC
      LIMIT $2`, [userId, lim]);
    return r.rows;
}
async function listPublicPrompts(query, limit = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(100, limit));
    const q = (query || "").trim();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let rows = Array.from(memPrompts.values()).filter((p) => p.isPublic);
        if (q) {
            const ql = q.toLowerCase();
            rows = rows.filter((p) => p.name.toLowerCase().includes(ql) ||
                (p.description || "").toLowerCase().includes(ql) ||
                p.content.toLowerCase().includes(ql));
        }
        rows.sort((a, b) => b.importCount - a.importCount || b.updatedAt.localeCompare(a.updatedAt));
        return rows.slice(0, lim);
    }
    if (q) {
        const r = await pool.query(`SELECT * FROM "QCorePrompt"
        WHERE "isPublic"=TRUE
          AND ("name" ILIKE $1 OR "description" ILIKE $1 OR "content" ILIKE $1)
        ORDER BY "importCount" DESC, "updatedAt" DESC
        LIMIT $2`, [`%${q}%`, lim]);
        return r.rows;
    }
    const r = await pool.query(`SELECT * FROM "QCorePrompt"
      WHERE "isPublic"=TRUE
      ORDER BY "importCount" DESC, "updatedAt" DESC
      LIMIT $1`, [lim]);
    return r.rows;
}
async function updatePrompt(id, userId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const cur = memPrompts.get(id);
        if (!cur || cur.ownerUserId !== userId)
            return null;
        if (patch.name != null) {
            const v = String(patch.name).trim().slice(0, 80);
            if (v)
                cur.name = v;
        }
        if (patch.description !== undefined)
            cur.description = patch.description ? String(patch.description).trim().slice(0, 400) : null;
        if (patch.role != null)
            cur.role = normalizePromptRole(patch.role);
        if (patch.isPublic != null)
            cur.isPublic = patch.isPublic === true;
        cur.updatedAt = nowIso();
        return cur;
    }
    const sets = [];
    const params = [];
    let i = 1;
    if (patch.name != null) {
        const v = String(patch.name).trim().slice(0, 80);
        if (v) {
            sets.push(`"name"=$${i++}`);
            params.push(v);
        }
    }
    if (patch.description !== undefined) {
        sets.push(`"description"=$${i++}`);
        params.push(patch.description ? String(patch.description).trim().slice(0, 400) : null);
    }
    if (patch.role != null) {
        sets.push(`"role"=$${i++}`);
        params.push(normalizePromptRole(patch.role));
    }
    if (patch.isPublic != null) {
        sets.push(`"isPublic"=$${i++}`);
        params.push(patch.isPublic === true);
    }
    if (!sets.length)
        return getPrompt(id);
    sets.push(`"updatedAt"=NOW()`);
    params.push(id, userId);
    const r = await pool.query(`UPDATE "QCorePrompt" SET ${sets.join(", ")}
      WHERE "id"=$${i++} AND "ownerUserId"=$${i++}
      RETURNING *`, params);
    return r.rows?.[0] || null;
}
async function deletePrompt(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const p = memPrompts.get(id);
        if (!p || p.ownerUserId !== userId)
            return false;
        memPrompts.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCorePrompt" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
/**
 * Fork an existing prompt — creates a child version. Owner's own prompts
 * are forkable freely (creates next version in the chain). Public prompts
 * by other users get the importCount bumped + a fresh root for the forker.
 */
async function forkPrompt(parentId, forkerUserId, patch) {
    const parent = await getPrompt(parentId);
    if (!parent)
        return null;
    const isOwn = parent.ownerUserId === forkerUserId;
    const isAccessible = isOwn || parent.isPublic;
    if (!isAccessible)
        return null;
    if (!isOwn) {
        // Bump parent.importCount.
        if (!(0, ensureQCoreTables_1.isDbReady)()) {
            parent.importCount += 1;
            parent.updatedAt = nowIso();
        }
        else {
            await pool.query(`UPDATE "QCorePrompt" SET "importCount" = "importCount" + 1, "updatedAt"=NOW() WHERE "id"=$1`, [parentId]);
        }
    }
    return createPrompt({
        ownerUserId: forkerUserId,
        name: patch.name?.trim() || `${parent.name} (fork)`,
        description: parent.description,
        role: parent.role,
        content: patch.content?.trim() ? patch.content.slice(0, 16000) : parent.content,
        parentPromptId: isOwn ? parent.id : null,
        isPublic: false,
    });
}
/** Returns the version chain for a prompt: ancestors + descendants. */
async function getPromptVersionChain(rootId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    // Walk up to root, then collect all descendants.
    const visited = new Set();
    const chain = [];
    // Walk ancestors.
    let cur = await getPrompt(rootId);
    while (cur && !visited.has(cur.id)) {
        visited.add(cur.id);
        chain.unshift(cur);
        if (!cur.parentPromptId)
            break;
        cur = await getPrompt(cur.parentPromptId);
    }
    // BFS descendants from every node already in the chain (each ancestor +
    // the original target). We keep visited for dedup, but the queue starts
    // populated so descendants of nodes deeper than the root are reachable.
    if (!chain.length)
        return [];
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const all = Array.from(memPrompts.values());
        const queue = [...chain];
        while (queue.length) {
            const node = queue.shift();
            const children = all.filter((p) => p.parentPromptId === node.id && !visited.has(p.id));
            for (const c of children) {
                visited.add(c.id);
                chain.push(c);
                queue.push(c);
            }
        }
        return chain.sort((a, b) => a.version - b.version);
    }
    const queue = [...chain];
    while (queue.length) {
        const node = queue.shift();
        const r = await pool.query(`SELECT * FROM "QCorePrompt" WHERE "parentPromptId"=$1`, [node.id]);
        for (const child of r.rows) {
            if (visited.has(child.id))
                continue;
            visited.add(child.id);
            chain.push(child);
            queue.push(child);
        }
    }
    return chain.sort((a, b) => a.version - b.version);
}
const memSpendLimits = new Map();
async function getSpendLimit(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memSpendLimits.get(userId) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreSpendLimit" WHERE "userId"=$1`, [userId]);
    return r.rows[0] || null;
}
async function setSpendLimit(userId, monthlyLimitUsd, alertAt = 0.8) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const clamped = Math.max(0, Math.min(1000, monthlyLimitUsd));
    const at = Math.max(0.1, Math.min(1, alertAt));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            userId,
            monthlyLimitUsd: clamped,
            alertAt: at,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        memSpendLimits.set(userId, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreSpendLimit" ("userId","monthlyLimitUsd","alertAt")
     VALUES ($1,$2,$3)
     ON CONFLICT ("userId") DO UPDATE
       SET "monthlyLimitUsd"=$2, "alertAt"=$3, "updatedAt"=NOW()
     RETURNING *`, [userId, clamped, at]);
    return r.rows[0];
}
async function deleteSpendLimit(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const had = memSpendLimits.has(userId);
        memSpendLimits.delete(userId);
        return had;
    }
    const r = await pool.query(`DELETE FROM "QCoreSpendLimit" WHERE "userId"=$1 RETURNING "userId"`, [userId]);
    return (r.rowCount ?? 0) > 0;
}
/**
 * Sum of totalCostUsd for the calling user's runs in the current calendar month.
 * Falls back to an in-memory scan for the demo mode.
 */
async function getMonthlySpend(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        // In-memory: userId isn't stored on runs directly — approximate via sessions.
        const sessions = await listSessions(userId, 200);
        const sessionIds = new Set(sessions.map((s) => s.id));
        let total = 0;
        for (const run of memRuns.values()) {
            if (sessionIds.has(run.sessionId) && run.startedAt >= monthStart) {
                total += run.totalCostUsd ?? 0;
            }
        }
        return total;
    }
    const r = await pool.query(`SELECT COALESCE(SUM(r."totalCostUsd"), 0) AS total
     FROM "QCoreRun" r
     JOIN "QCoreSession" s ON s.id = r."sessionId"
     WHERE s."userId"=$1 AND r."startedAt" >= $2`, [userId, monthStart]);
    return parseFloat(r.rows[0]?.total ?? "0") || 0;
}
/**
 * Sum of tokens (in + out) a user has spent in the current calendar month.
 * Mirrors getMonthlySpend but counts tokens instead of USD — used by the
 * free-tier quota gate (Free tariff advertises 100k tokens/month on qcoreai).
 */
async function getMonthlyTokens(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        // In-memory: tokens live on messages, runs carry the sessionId + startedAt.
        const sessions = await listSessions(userId, 200);
        const sessionIds = new Set(sessions.map((s) => s.id));
        let total = 0;
        for (const run of memRuns.values()) {
            if (!sessionIds.has(run.sessionId) || run.startedAt < monthStart)
                continue;
            for (const m of memMessagesByRun.get(run.id) ?? []) {
                total += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
            }
        }
        return total + (await getLedgerTokens(userId));
    }
    const r = await pool.query(`SELECT COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)::bigint AS total
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE s."userId"=$1 AND r."startedAt" >= $2`, [userId, monthStart]);
    const fromMessages = Number(r.rows[0]?.total ?? 0) || 0;
    // Add ad-hoc chat usage (single-shot /chat + /chat-stream) tracked in the
    // token ledger — those endpoints don't persist QCoreRun/QCoreMessage rows.
    return fromMessages + (await getLedgerTokens(userId));
}
/** Current-month YYYY-MM key (local server time, matches getMonthlyTokens). */
function currentYm() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
/**
 * Increment the per-user monthly token ledger. Called by token-spending
 * endpoints that do NOT persist a QCoreRun/QCoreMessage (single-shot /chat and
 * /chat-stream) so their usage still counts toward the free-tier quota. No-op
 * for anonymous callers (null userId) or non-positive totals.
 *
 * Pass `modelInfo` (the provider/model that actually served the request) so
 * premium/frontier-model spend (isPremiumModel in ./pricing) is also tracked
 * separately — backs each tier's premiumTokensPerMonth sub-cap. Omitting it
 * just skips the premium sub-total (treated as non-premium).
 */
async function addTokenUsage(userId, tokensIn, tokensOut, modelInfo) {
    if (!userId)
        return;
    const tin = Math.max(0, Math.round(Number(tokensIn) || 0));
    const tout = Math.max(0, Math.round(Number(tokensOut) || 0));
    if (tin === 0 && tout === 0)
        return;
    const ym = currentYm();
    const premium = modelInfo ? (0, pricing_1.isPremiumModel)(modelInfo.provider, modelInfo.model) : false;
    const ptin = premium ? tin : 0;
    const ptout = premium ? tout : 0;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const key = `${userId}:${ym}`;
        const cur = memTokenLedger.get(key) ?? { tokensIn: 0, tokensOut: 0, premiumTokensIn: 0, premiumTokensOut: 0 };
        cur.tokensIn += tin;
        cur.tokensOut += tout;
        cur.premiumTokensIn += ptin;
        cur.premiumTokensOut += ptout;
        memTokenLedger.set(key, cur);
        return;
    }
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    await pool.query(`INSERT INTO "QCoreTokenLedger" ("userId","ym","tokensIn","tokensOut","premiumTokensIn","premiumTokensOut","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT ("userId","ym") DO UPDATE
       SET "tokensIn"         = "QCoreTokenLedger"."tokensIn"         + EXCLUDED."tokensIn",
           "tokensOut"        = "QCoreTokenLedger"."tokensOut"        + EXCLUDED."tokensOut",
           "premiumTokensIn"  = "QCoreTokenLedger"."premiumTokensIn"  + EXCLUDED."premiumTokensIn",
           "premiumTokensOut" = "QCoreTokenLedger"."premiumTokensOut" + EXCLUDED."premiumTokensOut",
           "updatedAt" = NOW()`, [userId, ym, tin, tout, ptin, ptout]);
}
/** Sum of ledgered tokens (in+out) for the user in the current month. */
async function getLedgerTokens(userId) {
    const ym = currentYm();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const cur = memTokenLedger.get(`${userId}:${ym}`);
        return cur ? cur.tokensIn + cur.tokensOut : 0;
    }
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const r = await pool.query(`SELECT COALESCE("tokensIn",0)+COALESCE("tokensOut",0) AS total
       FROM "QCoreTokenLedger" WHERE "userId"=$1 AND "ym"=$2`, [userId, ym]);
    return Number(r.rows[0]?.total ?? 0) || 0;
}
/** Sum of ledgered PREMIUM-model tokens (in+out) for the user in the current month. */
async function getLedgerPremiumTokens(userId) {
    const ym = currentYm();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const cur = memTokenLedger.get(`${userId}:${ym}`);
        return cur ? cur.premiumTokensIn + cur.premiumTokensOut : 0;
    }
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const r = await pool.query(`SELECT COALESCE("premiumTokensIn",0)+COALESCE("premiumTokensOut",0) AS total
       FROM "QCoreTokenLedger" WHERE "userId"=$1 AND "ym"=$2`, [userId, ym]);
    return Number(r.rows[0]?.total ?? 0) || 0;
}
/**
 * Sum of PREMIUM-model tokens (in + out) a user has spent this calendar
 * month, across both QCoreRun/QCoreMessage (multi-agent) and the ledger
 * (single-shot /chat, /chat-stream). Mirrors getMonthlyTokens but restricted
 * to models isPremiumModel() flags — backs the tier premiumTokensPerMonth
 * sub-cap in lib/qcoreQuota.ts.
 */
async function getMonthlyPremiumTokens(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const premiumModels = (0, pricing_1.getPremiumModelNames)();
    if (premiumModels.length === 0)
        return getLedgerPremiumTokens(userId);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const sessions = await listSessions(userId, 200);
        const sessionIds = new Set(sessions.map((s) => s.id));
        let total = 0;
        for (const run of memRuns.values()) {
            if (!sessionIds.has(run.sessionId) || run.startedAt < monthStart)
                continue;
            for (const m of memMessagesByRun.get(run.id) ?? []) {
                if (!m.model || !premiumModels.includes(m.model))
                    continue;
                total += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
            }
        }
        return total + (await getLedgerPremiumTokens(userId));
    }
    const r = await pool.query(`SELECT COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)::bigint AS total
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE s."userId"=$1 AND r."startedAt" >= $2 AND m."model" = ANY($3::text[])`, [userId, monthStart, premiumModels]);
    const fromMessages = Number(r.rows[0]?.total ?? 0) || 0;
    return fromMessages + (await getLedgerPremiumTokens(userId));
}
const memTemplates = new Map();
async function createTemplate(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = {
        id,
        ownerUserId: opts.ownerUserId,
        name: opts.name.slice(0, 80),
        description: opts.description?.slice(0, 400) ?? null,
        input: opts.input.slice(0, 16000),
        strategy: opts.strategy || "sequential",
        overrides: opts.overrides ?? {},
        isPublic: opts.isPublic ?? false,
        useCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memTemplates.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreTemplate"
       ("id","ownerUserId","name","description","input","strategy","overrides","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`, [id, row.ownerUserId, row.name, row.description, row.input, row.strategy,
        JSON.stringify(row.overrides), row.isPublic]);
    return r.rows[0];
}
async function listTemplates(ownerUserId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memTemplates.values())
            .filter((t) => t.ownerUserId === ownerUserId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, limit);
    }
    const r = await pool.query(`SELECT * FROM "QCoreTemplate" WHERE "ownerUserId"=$1 ORDER BY "updatedAt" DESC LIMIT $2`, [ownerUserId, limit]);
    return r.rows;
}
async function listPublicTemplates(query, limit = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(100, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const q = (query || "").toLowerCase();
        return Array.from(memTemplates.values())
            .filter((t) => t.isPublic && (!q || t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)))
            .sort((a, b) => b.useCount - a.useCount || b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, lim);
    }
    if (query?.trim()) {
        const q = `%${query.trim()}%`;
        const r = await pool.query(`SELECT * FROM "QCoreTemplate"
        WHERE "isPublic"=TRUE AND ("name" ILIKE $1 OR "description" ILIKE $1)
        ORDER BY "useCount" DESC, "updatedAt" DESC LIMIT $2`, [q, lim]);
        return r.rows;
    }
    const r = await pool.query(`SELECT * FROM "QCoreTemplate" WHERE "isPublic"=TRUE ORDER BY "useCount" DESC, "updatedAt" DESC LIMIT $1`, [lim]);
    return r.rows;
}
async function getTemplate(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memTemplates.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreTemplate" WHERE "id"=$1`, [id]);
    return r.rows[0] || null;
}
async function updateTemplate(id, ownerUserId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memTemplates.get(id);
        if (!t || t.ownerUserId !== ownerUserId)
            return null;
        const updated = { ...t, ...patch, updatedAt: nowIso() };
        memTemplates.set(id, updated);
        return updated;
    }
    const sets = [];
    const vals = [id, ownerUserId];
    let idx = 3;
    if (patch.name !== undefined) {
        sets.push(`"name"=$${idx++}`);
        vals.push(patch.name.slice(0, 80));
    }
    if (patch.description !== undefined) {
        sets.push(`"description"=$${idx++}`);
        vals.push(patch.description?.slice(0, 400) ?? null);
    }
    if (patch.input !== undefined) {
        sets.push(`"input"=$${idx++}`);
        vals.push(patch.input.slice(0, 16000));
    }
    if (patch.strategy !== undefined) {
        sets.push(`"strategy"=$${idx++}`);
        vals.push(patch.strategy);
    }
    if (patch.overrides !== undefined) {
        sets.push(`"overrides"=$${idx++}`);
        vals.push(JSON.stringify(patch.overrides));
    }
    if (patch.isPublic !== undefined) {
        sets.push(`"isPublic"=$${idx++}`);
        vals.push(patch.isPublic);
    }
    if (!sets.length)
        return getTemplate(id);
    sets.push(`"updatedAt"=NOW()`);
    const r = await pool.query(`UPDATE "QCoreTemplate" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING *`, vals);
    return r.rows[0] || null;
}
async function deleteTemplate(id, ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memTemplates.get(id);
        if (!t || t.ownerUserId !== ownerUserId)
            return false;
        memTemplates.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreTemplate" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, ownerUserId]);
    return (r.rowCount ?? 0) > 0;
}
const memScheduledBatches = new Map();
function nextRunTime(schedule, from = new Date()) {
    if (schedule === "once")
        return null; // one-shot: set manually by caller
    const d = new Date(from);
    if (schedule === "hourly")
        d.setHours(d.getHours() + 1, 0, 0, 0);
    else if (schedule === "daily") {
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
    }
    else if (schedule === "weekly") {
        d.setDate(d.getDate() + 7);
        d.setHours(9, 0, 0, 0);
    }
    return d;
}
async function createScheduledBatch(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const schedule = (opts.schedule || "once");
    let nextRunAt = opts.nextRunAt ?? null;
    if (!nextRunAt && schedule !== "once") {
        nextRunAt = nextRunTime(schedule)?.toISOString() ?? null;
    }
    const row = {
        id,
        ownerUserId: opts.ownerUserId,
        name: opts.name.slice(0, 80),
        inputs: opts.inputs.slice(0, 20).map((s) => s.slice(0, 16000)),
        strategy: opts.strategy || "sequential",
        overrides: opts.overrides ?? {},
        schedule,
        nextRunAt,
        lastRunAt: null,
        lastBatchId: null,
        enabled: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memScheduledBatches.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreScheduledBatch"
       ("id","ownerUserId","name","inputs","strategy","overrides","schedule","nextRunAt","enabled")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
     RETURNING *`, [id, row.ownerUserId, row.name, JSON.stringify(row.inputs), row.strategy,
        JSON.stringify(row.overrides), row.schedule, row.nextRunAt]);
    return r.rows[0];
}
async function listScheduledBatches(ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memScheduledBatches.values())
            .filter((s) => s.ownerUserId === ownerUserId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const r = await pool.query(`SELECT * FROM "QCoreScheduledBatch" WHERE "ownerUserId"=$1 ORDER BY "createdAt" DESC`, [ownerUserId]);
    return r.rows;
}
async function getScheduledBatch(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memScheduledBatches.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreScheduledBatch" WHERE "id"=$1`, [id]);
    return r.rows[0] || null;
}
async function updateScheduledBatch(id, ownerUserId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memScheduledBatches.get(id);
        if (!s || s.ownerUserId !== ownerUserId)
            return null;
        const updated = { ...s, ...patch, updatedAt: nowIso() };
        memScheduledBatches.set(id, updated);
        return updated;
    }
    const sets = ["\"updatedAt\"=NOW()"];
    const vals = [id, ownerUserId];
    let idx = 3;
    if (patch.name !== undefined) {
        sets.push(`"name"=$${idx++}`);
        vals.push(patch.name);
    }
    if (patch.inputs !== undefined) {
        sets.push(`"inputs"=$${idx++}`);
        vals.push(JSON.stringify(patch.inputs));
    }
    if (patch.strategy !== undefined) {
        sets.push(`"strategy"=$${idx++}`);
        vals.push(patch.strategy);
    }
    if (patch.overrides !== undefined) {
        sets.push(`"overrides"=$${idx++}`);
        vals.push(JSON.stringify(patch.overrides));
    }
    if (patch.schedule !== undefined) {
        sets.push(`"schedule"=$${idx++}`);
        vals.push(patch.schedule);
    }
    if (patch.nextRunAt !== undefined) {
        sets.push(`"nextRunAt"=$${idx++}`);
        vals.push(patch.nextRunAt);
    }
    if (patch.enabled !== undefined) {
        sets.push(`"enabled"=$${idx++}`);
        vals.push(patch.enabled);
    }
    const r = await pool.query(`UPDATE "QCoreScheduledBatch" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING *`, vals);
    return r.rows[0] || null;
}
async function deleteScheduledBatch(id, ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memScheduledBatches.get(id);
        if (!s || s.ownerUserId !== ownerUserId)
            return false;
        memScheduledBatches.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreScheduledBatch" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, ownerUserId]);
    return (r.rowCount ?? 0) > 0;
}
/** Called by the scheduler — advance nextRunAt and record lastRunAt + lastBatchId. */
async function recordScheduledRun(id, batchId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const s = await getScheduledBatch(id);
    if (!s)
        return;
    const next = s.schedule === "once" ? null : nextRunTime(s.schedule)?.toISOString() ?? null;
    const enabledNext = s.schedule !== "once"; // disable after one-shot fires
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const r = memScheduledBatches.get(id);
        if (!r)
            return;
        r.lastRunAt = nowIso();
        r.lastBatchId = batchId;
        r.nextRunAt = next;
        r.enabled = enabledNext;
        r.updatedAt = nowIso();
        return;
    }
    await pool.query(`UPDATE "QCoreScheduledBatch"
       SET "lastRunAt"=NOW(), "lastBatchId"=$2, "nextRunAt"=$3, "enabled"=$4, "updatedAt"=NOW()
     WHERE "id"=$1`, [id, batchId, next, enabledNext]);
}
/** Returns schedules that are due (nextRunAt <= now, enabled=true). */
async function getDueSchedules() {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const nowStr = new Date().toISOString();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memScheduledBatches.values()).filter((s) => s.enabled && s.nextRunAt !== null && s.nextRunAt <= nowStr);
    }
    const r = await pool.query(`SELECT * FROM "QCoreScheduledBatch" WHERE "enabled"=TRUE AND "nextRunAt" <= NOW()`);
    return r.rows;
}
async function useTemplate(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memTemplates.get(id);
        if (!t)
            return null;
        t.useCount++;
        return t;
    }
    const r = await pool.query(`UPDATE "QCoreTemplate" SET "useCount"="useCount"+1,"updatedAt"=NOW() WHERE "id"=$1 RETURNING *`, [id]);
    return r.rows[0] || null;
}
const memBatches = new Map();
async function createBatch(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = {
        id,
        ownerUserId: opts.ownerUserId,
        strategy: opts.strategy || "sequential",
        overrides: opts.overrides ?? {},
        status: "running",
        totalRuns: opts.inputs.length,
        completedRuns: 0,
        failedRuns: 0,
        totalCostUsd: 0,
        inputs: opts.inputs,
        createdAt: nowIso(),
        completedAt: null,
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memBatches.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreBatch"
       ("id","ownerUserId","strategy","overrides","status","totalRuns","inputs")
     VALUES ($1,$2,$3,$4,'running',$5,$6)
     RETURNING *`, [id, row.ownerUserId, row.strategy, JSON.stringify(row.overrides), row.totalRuns, JSON.stringify(row.inputs)]);
    return r.rows[0];
}
async function getBatch(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memBatches.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreBatch" WHERE "id"=$1`, [id]);
    return r.rows[0] || null;
}
async function listBatches(ownerUserId, limit = 30) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memBatches.values())
            .filter((b) => b.ownerUserId === ownerUserId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, limit);
    }
    const r = await pool.query(`SELECT * FROM "QCoreBatch" WHERE "ownerUserId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [ownerUserId, limit]);
    return r.rows;
}
async function updateBatchProgress(batchId, delta) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const b = memBatches.get(batchId);
        if (!b)
            return;
        b.completedRuns += delta.completedDelta ?? 0;
        b.failedRuns += delta.failedDelta ?? 0;
        b.totalCostUsd += delta.costDelta ?? 0;
        if (b.completedRuns + b.failedRuns >= b.totalRuns) {
            b.status = b.failedRuns === b.totalRuns ? "error" : "done";
            b.completedAt = nowIso();
        }
        return;
    }
    await pool.query(`UPDATE "QCoreBatch"
       SET "completedRuns" = "completedRuns" + $2,
           "failedRuns"    = "failedRuns"    + $3,
           "totalCostUsd"  = "totalCostUsd"  + $4,
           "status" = CASE
             WHEN "completedRuns" + $2 + "failedRuns" + $3 >= "totalRuns"
             THEN CASE WHEN "completedRuns" + $2 = 0 THEN 'error' ELSE 'done' END
             ELSE 'running'
           END,
           "completedAt" = CASE
             WHEN "completedRuns" + $2 + "failedRuns" + $3 >= "totalRuns" THEN NOW()
             ELSE NULL
           END
     WHERE "id" = $1`, [batchId, delta.completedDelta ?? 0, delta.failedDelta ?? 0, delta.costDelta ?? 0]);
}
async function listBatchRuns(batchId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memRuns.values())
            .filter((r) => r.batchId === batchId)
            .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    }
    const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "batchId"=$1 ORDER BY "startedAt" ASC`, [batchId]);
    return r.rows;
}
const memComments = new Map();
async function createComment(runId, authorName, content) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const name = (authorName || "Anonymous").trim().slice(0, 60) || "Anonymous";
    const text = (content || "").trim().slice(0, 2000);
    if (!text)
        throw new Error("content required");
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = { id, runId, authorName: name, content: text, createdAt: nowIso() };
        const existing = memComments.get(runId) ?? [];
        existing.push(row);
        memComments.set(runId, existing);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreRunComment" ("id","runId","authorName","content") VALUES ($1,$2,$3,$4) RETURNING *`, [id, runId, name, text]);
    return r.rows[0];
}
async function listComments(runId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return (memComments.get(runId) ?? []).slice();
    const r = await pool.query(`SELECT * FROM "QCoreRunComment" WHERE "runId"=$1 ORDER BY "createdAt" ASC`, [runId]);
    return r.rows;
}
const memAuditLog = [];
async function logPromptAudit(userId, promptId, promptName, action, changedFields) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memAuditLog.push({ id, userId, promptId, promptName, action, changedFields: changedFields ?? null, createdAt: nowIso() });
        return;
    }
    await pool.query(`INSERT INTO "QCorePresetAuditLog" ("id","userId","promptId","promptName","action","changedFields") VALUES ($1,$2,$3,$4,$5,$6)`, [id, userId, promptId, promptName, action, changedFields ?? null]);
}
async function listPromptAudit(userId, limit = 100) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(500, limit));
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memAuditLog.filter((e) => e.userId === userId).slice(-lim).reverse();
    const r = await pool.query(`SELECT * FROM "QCorePresetAuditLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [userId, lim]);
    return r.rows;
}
const memWorkspaces = new Map();
async function createWorkspace(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = { id, name: opts.name.slice(0, 80), description: opts.description ?? null, ownerId: opts.ownerId, createdAt: nowIso(), updatedAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memWorkspaces.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreWorkspace" ("id","name","description","ownerId") VALUES ($1,$2,$3,$4) RETURNING *`, [id, row.name, row.description, row.ownerId]);
    return r.rows[0];
}
async function listWorkspaces(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memWorkspaces.values()).filter((w) => w.ownerId === userId);
    const r = await pool.query(`SELECT w.* FROM "QCoreWorkspace" w LEFT JOIN "QCoreWorkspaceMember" m ON m."workspaceId"=w."id" AND m."userId"=$1 WHERE w."ownerId"=$1 OR m."userId"=$1 ORDER BY w."updatedAt" DESC`, [userId]);
    return r.rows;
}
async function getWorkspace(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memWorkspaces.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreWorkspace" WHERE "id"=$1`, [id]);
    return r.rows[0] || null;
}
async function updateWorkspace(id, ownerId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const w = memWorkspaces.get(id);
        if (!w || w.ownerId !== ownerId)
            return null;
        const updated = { ...w, ...patch, updatedAt: nowIso() };
        memWorkspaces.set(id, updated);
        return updated;
    }
    const sets = ["\"updatedAt\"=NOW()"];
    const vals = [id, ownerId];
    let idx = 3;
    if (patch.name !== undefined) {
        sets.push(`"name"=$${idx++}`);
        vals.push(patch.name);
    }
    if (patch.description !== undefined) {
        sets.push(`"description"=$${idx++}`);
        vals.push(patch.description);
    }
    const r = await pool.query(`UPDATE "QCoreWorkspace" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerId"=$2 RETURNING *`, vals);
    return r.rows[0] || null;
}
async function deleteWorkspace(id, ownerId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const w = memWorkspaces.get(id);
        if (!w || w.ownerId !== ownerId)
            return false;
        memWorkspaces.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreWorkspace" WHERE "id"=$1 AND "ownerId"=$2 RETURNING "id"`, [id, ownerId]);
    return (r.rowCount ?? 0) > 0;
}
const memMembers = new Map(); // key = workspaceId
async function addWorkspaceMember(workspaceId, userId, role) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const row = { workspaceId, userId, role, joinedAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const list = memMembers.get(workspaceId) ?? [];
        const idx = list.findIndex((m) => m.userId === userId);
        if (idx >= 0)
            list[idx] = row;
        else
            list.push(row);
        memMembers.set(workspaceId, list);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreWorkspaceMember" ("workspaceId","userId","role") VALUES ($1,$2,$3)
     ON CONFLICT ("workspaceId","userId") DO UPDATE SET "role"=$3 RETURNING *`, [workspaceId, userId, role]);
    return r.rows[0];
}
async function listWorkspaceMembers(workspaceId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memMembers.get(workspaceId) ?? [];
    const r = await pool.query(`SELECT * FROM "QCoreWorkspaceMember" WHERE "workspaceId"=$1`, [workspaceId]);
    return r.rows;
}
async function removeWorkspaceMember(workspaceId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const list = memMembers.get(workspaceId) ?? [];
        const next = list.filter((m) => m.userId !== userId);
        memMembers.set(workspaceId, next);
        return list.length !== next.length;
    }
    const r = await pool.query(`DELETE FROM "QCoreWorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2 RETURNING "userId"`, [workspaceId, userId]);
    return (r.rowCount ?? 0) > 0;
}
const memWorkspaceSessions = new Map(); // workspaceId → sessionId[]
async function addWorkspaceSession(workspaceId, sessionId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const list = memWorkspaceSessions.get(workspaceId) ?? [];
        if (!list.includes(sessionId))
            list.push(sessionId);
        memWorkspaceSessions.set(workspaceId, list);
        return;
    }
    await pool.query(`INSERT INTO "QCoreWorkspaceSession" ("workspaceId","sessionId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [workspaceId, sessionId]);
}
async function removeWorkspaceSession(workspaceId, sessionId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const list = memWorkspaceSessions.get(workspaceId) ?? [];
        const next = list.filter((s) => s !== sessionId);
        memWorkspaceSessions.set(workspaceId, next);
        return list.length !== next.length;
    }
    const r = await pool.query(`DELETE FROM "QCoreWorkspaceSession" WHERE "workspaceId"=$1 AND "sessionId"=$2 RETURNING "sessionId"`, [workspaceId, sessionId]);
    return (r.rowCount ?? 0) > 0;
}
async function listWorkspaceSessions(workspaceId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const ids = memWorkspaceSessions.get(workspaceId) ?? [];
        return ids.map((id) => {
            const s = Array.from(memSessions.values()).find((x) => x.id === id);
            return s ? { id: s.id, title: s.title, updatedAt: s.updatedAt } : { id, title: id, updatedAt: "" };
        });
    }
    const r = await pool.query(`SELECT s."id", s."title", s."updatedAt" FROM "QCoreSession" s
     JOIN "QCoreWorkspaceSession" ws ON ws."sessionId"=s."id"
     WHERE ws."workspaceId"=$1 ORDER BY s."updatedAt" DESC`, [workspaceId]);
    return r.rows;
}
async function deleteRunsBulk(ids, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let deleted = 0;
        for (const id of ids) {
            const run = memRuns.get(id);
            // In-memory: no user ownership check (userId on session not tracked in mem-run)
            if (run) {
                memRuns.delete(id);
                deleted++;
            }
        }
        return deleted;
    }
    const result = await pool.query(`DELETE FROM "QCoreRun" WHERE "id"=ANY($1::text[]) AND "sessionId" IN (
       SELECT "id" FROM "QCoreSession" WHERE "userId"=$2
     ) RETURNING "id"`, [ids, userId]);
    return result.rowCount ?? 0;
}
async function getSessionCostSummary(userId, days = 7, limit = 10) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(50, limit));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const sessions = Array.from(memSessions.values()).filter((s) => !userId || s.userId === userId);
        return sessions.slice(0, lim).map((s) => {
            const runs = Array.from(memRuns.values()).filter((r) => r.sessionId === s.id && r.startedAt >= since);
            return {
                id: s.id, title: s.title, updatedAt: s.updatedAt,
                runCount: runs.length,
                totalCostUsd: runs.reduce((acc, r) => acc + (r.totalCostUsd ?? 0), 0),
                totalDurationMs: runs.reduce((acc, r) => acc + (r.totalDurationMs ?? 0), 0),
            };
        }).filter((s) => s.runCount > 0).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
    }
    const r = await pool.query(`SELECT s."id", s."title", s."updatedAt",
            COUNT(r."id")::int AS "runCount",
            COALESCE(SUM(r."totalCostUsd"),0) AS "totalCostUsd",
            COALESCE(SUM(r."totalDurationMs"),0) AS "totalDurationMs"
     FROM "QCoreSession" s
     JOIN "QCoreRun" r ON r."sessionId"=s."id"
     WHERE s."userId"=$1 AND r."startedAt">=$2
     GROUP BY s."id", s."title", s."updatedAt"
     ORDER BY "totalCostUsd" DESC
     LIMIT $3`, [userId, since, lim]);
    return r.rows;
}
async function pinSession(id, userId, pinned) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(id);
        if (!s)
            return false;
        s.pinned = pinned;
        return true;
    }
    const r = await pool.query(`UPDATE "QCoreSession" SET "pinned"=$1 WHERE "id"=$2 AND ("userId"=$3 OR "userId" IS NULL) RETURNING "id"`, [pinned, id, userId]);
    return (r.rowCount ?? 0) > 0;
}
const memNotebook = new Map();
async function createSnippet(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = {
        id,
        ownerUserId: opts.ownerUserId,
        runId: opts.runId,
        role: opts.role || "final",
        content: opts.content.slice(0, 32000),
        annotation: opts.annotation?.slice(0, 2000) ?? null,
        tags: (opts.tags || []).slice(0, 10).map((t) => t.trim().toLowerCase().slice(0, 32)).filter(Boolean),
        pinned: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memNotebook.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreNotebook" ("id","ownerUserId","runId","role","content","annotation","tags")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`, [id, row.ownerUserId, row.runId, row.role, row.content, row.annotation, row.tags]);
    return r.rows[0];
}
async function listSnippets(ownerUserId, opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(200, opts?.limit ?? 50));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let rows = Array.from(memNotebook.values()).filter((n) => n.ownerUserId === ownerUserId);
        if (opts?.pinned !== undefined)
            rows = rows.filter((n) => n.pinned === opts.pinned);
        if (opts?.tag)
            rows = rows.filter((n) => n.tags.includes(opts.tag));
        if (opts?.q) {
            const q = opts.q.toLowerCase();
            rows = rows.filter((n) => n.content.toLowerCase().includes(q) || (n.annotation || "").toLowerCase().includes(q));
        }
        rows.sort((a, b) => {
            if (a.pinned !== b.pinned)
                return a.pinned ? -1 : 1;
            return b.updatedAt.localeCompare(a.updatedAt);
        });
        return rows.slice(0, lim);
    }
    const conditions = [`"ownerUserId"=$1`];
    const vals = [ownerUserId];
    let idx = 2;
    if (opts?.pinned !== undefined) {
        conditions.push(`"pinned"=$${idx++}`);
        vals.push(opts.pinned);
    }
    if (opts?.tag) {
        conditions.push(`$${idx++}=ANY("tags")`);
        vals.push(opts.tag);
    }
    if (opts?.q) {
        conditions.push(`("content" ILIKE $${idx} OR "annotation" ILIKE $${idx})`);
        vals.push(`%${opts.q}%`);
        idx++;
    }
    vals.push(lim);
    const r = await pool.query(`SELECT * FROM "QCoreNotebook" WHERE ${conditions.join(" AND ")}
     ORDER BY "pinned" DESC, "updatedAt" DESC LIMIT $${idx}`, vals);
    return r.rows;
}
async function getSnippet(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memNotebook.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreNotebook" WHERE "id"=$1`, [id]);
    return r.rows[0] || null;
}
async function updateSnippet(id, ownerUserId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const n = memNotebook.get(id);
        if (!n || n.ownerUserId !== ownerUserId)
            return null;
        const updated = { ...n, ...patch, updatedAt: nowIso() };
        memNotebook.set(id, updated);
        return updated;
    }
    const sets = ["\"updatedAt\"=NOW()"];
    const vals = [id, ownerUserId];
    let idx = 3;
    if (patch.annotation !== undefined) {
        sets.push(`"annotation"=$${idx++}`);
        vals.push(patch.annotation);
    }
    if (patch.tags !== undefined) {
        sets.push(`"tags"=$${idx++}`);
        vals.push(patch.tags);
    }
    if (patch.pinned !== undefined) {
        sets.push(`"pinned"=$${idx++}`);
        vals.push(patch.pinned);
    }
    const r = await pool.query(`UPDATE "QCoreNotebook" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING *`, vals);
    return r.rows[0] || null;
}
async function deleteSnippet(id, ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const n = memNotebook.get(id);
        if (!n || n.ownerUserId !== ownerUserId)
            return false;
        memNotebook.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreNotebook" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, ownerUserId]);
    return (r.rowCount ?? 0) > 0;
}
async function listSnippetTagCloud(ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const freq = {};
        for (const n of memNotebook.values()) {
            if (n.ownerUserId !== ownerUserId)
                continue;
            for (const t of n.tags)
                freq[t] = (freq[t] ?? 0) + 1;
        }
        return Object.entries(freq).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 30);
    }
    const r = await pool.query(`SELECT unnest("tags") AS tag, COUNT(*)::int AS count
     FROM "QCoreNotebook" WHERE "ownerUserId"=$1
     GROUP BY tag ORDER BY count DESC LIMIT 30`, [ownerUserId]);
    return r.rows;
}
/** Move all runs from sourceSessionId into targetSessionId. Caller must own both. */
async function mergeSessions(targetSessionId, sourceSessionId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    // Verify ownership of both sessions
    const [target, source] = await Promise.all([
        getSession(targetSessionId, userId),
        getSession(sourceSessionId, userId),
    ]);
    if (!target)
        throw new Error("target session not found or forbidden");
    if (!source)
        throw new Error("source session not found or forbidden");
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let moved = 0;
        for (const run of memRuns.values()) {
            if (run.sessionId === sourceSessionId) {
                run.sessionId = targetSessionId;
                moved++;
            }
        }
        memSessions.delete(sourceSessionId);
        return { moved };
    }
    const r = await pool.query(`WITH moved AS (
       UPDATE "QCoreRun" SET "sessionId"=$1 WHERE "sessionId"=$2 RETURNING "id"
     )
     SELECT COUNT(*) AS moved FROM moved`, [targetSessionId, sourceSessionId]);
    const moved = parseInt(r.rows[0]?.moved ?? "0", 10);
    await pool.query(`DELETE FROM "QCoreSession" WHERE "id"=$1`, [sourceSessionId]);
    return { moved };
}
const memRatings = new Map(); // key = runId:userId
async function rateRun(runId, userId, rating, note) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${runId}:${userId ?? ""}`;
    const row = { runId, userId, rating, note: note?.slice(0, 500) ?? null, createdAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memRatings.set(key, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreRunRating" ("runId","userId","rating","note")
     VALUES ($1,$2,$3,$4)
     ON CONFLICT ("runId","userId") DO UPDATE
       SET "rating"=$3, "note"=$4, "createdAt"=NOW()
     RETURNING *`, [runId, userId ?? '', rating, row.note]);
    return r.rows[0];
}
async function getRating(runId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${runId}:${userId ?? ""}`;
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memRatings.get(key) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreRunRating" WHERE "runId"=$1 AND "userId"=$2`, [runId, userId ?? ""]);
    return r.rows[0] || null;
}
async function getRatingsSummary(runId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let up = 0, down = 0;
        for (const [k, r] of memRatings.entries()) {
            if (k.startsWith(`${runId}:`)) {
                if (r.rating === 1)
                    up++;
                else
                    down++;
            }
        }
        return { thumbsUp: up, thumbsDown: down, total: up + down };
    }
    const r = await pool.query(`SELECT
       COUNT(*) FILTER (WHERE "rating"=1)::int AS "thumbsUp",
       COUNT(*) FILTER (WHERE "rating"=-1)::int AS "thumbsDown",
       COUNT(*)::int AS "total"
     FROM "QCoreRunRating" WHERE "runId"=$1`, [runId]);
    return r.rows[0];
}
async function listTopRatedRuns(userId, limit = 20) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const acc = {};
        for (const r of memRatings.values()) {
            if (!acc[r.runId])
                acc[r.runId] = { up: 0, down: 0 };
            if (r.rating === 1)
                acc[r.runId].up++;
            else
                acc[r.runId].down++;
        }
        return Object.entries(acc)
            .map(([runId, { up, down }]) => ({ runId, thumbsUp: up, thumbsDown: down, score: up - down }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    const r = await pool.query(`SELECT "runId",
            COUNT(*) FILTER (WHERE "rating"=1)::int AS "thumbsUp",
            COUNT(*) FILTER (WHERE "rating"=-1)::int AS "thumbsDown",
            (COUNT(*) FILTER (WHERE "rating"=1) - COUNT(*) FILTER (WHERE "rating"=-1))::int AS "score"
     FROM "QCoreRunRating"
     ${userId ? `WHERE "runId" IN (SELECT r."id" FROM "QCoreRun" r JOIN "QCoreSession" s ON s.id=r."sessionId" WHERE s."userId"=$1)` : ""}
     GROUP BY "runId"
     ORDER BY "score" DESC
     LIMIT $${userId ? 2 : 1}`, userId ? [userId, limit] : [limit]);
    return r.rows;
}
const memPipelines = new Map();
async function createPipeline(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = {
        id, ownerUserId: opts.ownerUserId,
        name: opts.name.slice(0, 80),
        description: opts.description?.slice(0, 400) ?? null,
        steps: opts.steps.slice(0, 10),
        isPublic: opts.isPublic ?? false,
        useCount: 0,
        createdAt: nowIso(), updatedAt: nowIso(),
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memPipelines.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCorePipeline" ("id","ownerUserId","name","description","steps","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [id, row.ownerUserId, row.name, row.description, JSON.stringify(row.steps), row.isPublic]);
    return r.rows[0];
}
async function listPipelines(ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memPipelines.values()).filter((p) => p.ownerUserId === ownerUserId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const r = await pool.query(`SELECT * FROM "QCorePipeline" WHERE "ownerUserId"=$1 ORDER BY "updatedAt" DESC`, [ownerUserId]);
    return r.rows;
}
async function listPublicPipelines(q, limit = 20) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const qlo = q?.toLowerCase() || "";
        return Array.from(memPipelines.values()).filter((p) => p.isPublic && (!qlo || p.name.toLowerCase().includes(qlo))).sort((a, b) => b.useCount - a.useCount).slice(0, limit);
    }
    if (q?.trim()) {
        const r = await pool.query(`SELECT * FROM "QCorePipeline" WHERE "isPublic"=TRUE AND "name" ILIKE $1 ORDER BY "useCount" DESC LIMIT $2`, [`%${q.trim()}%`, limit]);
        return r.rows;
    }
    const r = await pool.query(`SELECT * FROM "QCorePipeline" WHERE "isPublic"=TRUE ORDER BY "useCount" DESC LIMIT $1`, [limit]);
    return r.rows;
}
async function getPipeline(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memPipelines.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCorePipeline" WHERE "id"=$1`, [id]);
    return r.rows[0] || null;
}
async function updatePipeline(id, ownerUserId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const p = memPipelines.get(id);
        if (!p || p.ownerUserId !== ownerUserId)
            return null;
        const up = { ...p, ...patch, updatedAt: nowIso() };
        memPipelines.set(id, up);
        return up;
    }
    const sets = ["\"updatedAt\"=NOW()"];
    const vals = [id, ownerUserId];
    let idx = 3;
    if (patch.name !== undefined) {
        sets.push(`"name"=$${idx++}`);
        vals.push(patch.name);
    }
    if (patch.description !== undefined) {
        sets.push(`"description"=$${idx++}`);
        vals.push(patch.description);
    }
    if (patch.steps !== undefined) {
        sets.push(`"steps"=$${idx++}`);
        vals.push(JSON.stringify(patch.steps));
    }
    if (patch.isPublic !== undefined) {
        sets.push(`"isPublic"=$${idx++}`);
        vals.push(patch.isPublic);
    }
    const r = await pool.query(`UPDATE "QCorePipeline" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING *`, vals);
    return r.rows[0] || null;
}
async function deletePipeline(id, ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const p = memPipelines.get(id);
        if (!p || p.ownerUserId !== ownerUserId)
            return false;
        memPipelines.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCorePipeline" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, ownerUserId]);
    return (r.rowCount ?? 0) > 0;
}
async function usePipeline(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const p = memPipelines.get(id);
        if (!p)
            return null;
        p.useCount++;
        return p;
    }
    const r = await pool.query(`UPDATE "QCorePipeline" SET "useCount"="useCount"+1,"updatedAt"=NOW() WHERE "id"=$1 RETURNING *`, [id]);
    return r.rows[0] || null;
}
const memCollections = new Map();
async function createCollection(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = { id, ownerUserId: opts.ownerUserId, name: opts.name.slice(0, 80), description: opts.description ?? null, color: opts.color?.slice(0, 20) ?? null, createdAt: nowIso(), updatedAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memCollections.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreNotebookCollection" ("id","ownerUserId","name","description","color") VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id, row.ownerUserId, row.name, row.description, row.color]);
    return r.rows[0];
}
async function listCollections(ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memCollections.values()).filter((c) => c.ownerUserId === ownerUserId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const r = await pool.query(`SELECT * FROM "QCoreNotebookCollection" WHERE "ownerUserId"=$1 ORDER BY "updatedAt" DESC`, [ownerUserId]);
    return r.rows;
}
async function deleteCollection(id, ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const c = memCollections.get(id);
        if (!c || c.ownerUserId !== ownerUserId)
            return false;
        memCollections.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreNotebookCollection" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, ownerUserId]);
    return (r.rowCount ?? 0) > 0;
}
async function assignSnippetToCollection(snippetId, collectionId, ownerUserId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memNotebook.get(snippetId);
        if (!s || s.ownerUserId !== ownerUserId)
            return false;
        s.collectionId = collectionId;
        return true;
    }
    const r = await pool.query(`UPDATE "QCoreNotebook" SET "collectionId"=$1,"updatedAt"=NOW() WHERE "id"=$2 AND "ownerUserId"=$3 RETURNING "id"`, [collectionId, snippetId, ownerUserId]);
    return (r.rowCount ?? 0) > 0;
}
const memBookmarks = new Map(); // key = runId:userId
async function bookmarkRun(runId, userId, label) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${runId}:${userId}`;
    const row = { runId, userId, label: label?.slice(0, 80) ?? null, createdAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memBookmarks.set(key, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreRunBookmark" ("runId","userId","label") VALUES ($1,$2,$3)
     ON CONFLICT ("runId","userId") DO UPDATE SET "label"=$3,"createdAt"=NOW() RETURNING *`, [runId, userId, row.label]);
    return r.rows[0];
}
async function unbookmarkRun(runId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${runId}:${userId}`;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const had = memBookmarks.has(key);
        memBookmarks.delete(key);
        return had;
    }
    const r = await pool.query(`DELETE FROM "QCoreRunBookmark" WHERE "runId"=$1 AND "userId"=$2 RETURNING "runId"`, [runId, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function listBookmarks(userId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memBookmarks.values()).filter((b) => b.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    const r = await pool.query(`SELECT * FROM "QCoreRunBookmark" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [userId, limit]);
    return r.rows;
}
async function isBookmarked(runId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memBookmarks.has(`${runId}:${userId}`);
    const r = await pool.query(`SELECT 1 FROM "QCoreRunBookmark" WHERE "runId"=$1 AND "userId"=$2`, [runId, userId]);
    return (r.rowCount ?? 0) > 0;
}
const memAnnotations = new Map(); // key = id
async function createAnnotation(runId, userId, messageRole, messageIdx, note, color = "yellow") {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = { id, runId, userId, messageRole, messageIdx: messageIdx || 0, note: note.slice(0, 2000), color, createdAt: nowIso(), updatedAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memAnnotations.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreAnnotation" ("id","runId","userId","messageRole","messageIdx","note","color")
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id, runId, userId, messageRole, messageIdx || 0, row.note, color]);
    return r.rows[0];
}
async function updateAnnotation(id, userId, note, color) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const a = memAnnotations.get(id);
        if (!a || a.userId !== userId)
            return null;
        a.note = note.slice(0, 2000);
        if (color)
            a.color = color;
        a.updatedAt = nowIso();
        return a;
    }
    const r = await pool.query(`UPDATE "QCoreAnnotation" SET "note"=$1,"color"=COALESCE($2,"color"),"updatedAt"=NOW()
     WHERE "id"=$3 AND "userId"=$4 RETURNING *`, [note.slice(0, 2000), color ?? null, id, userId]);
    return r.rows[0] ?? null;
}
async function deleteAnnotation(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const a = memAnnotations.get(id);
        if (!a || a.userId !== userId)
            return false;
        memAnnotations.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreAnnotation" WHERE "id"=$1 AND "userId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function listAnnotations(runId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memAnnotations.values()).filter((a) => a.runId === runId && a.userId === userId).sort((a, b) => a.messageIdx - b.messageIdx);
    const r = await pool.query(`SELECT * FROM "QCoreAnnotation" WHERE "runId"=$1 AND "userId"=$2 ORDER BY "messageIdx","createdAt"`, [runId, userId]);
    return r.rows;
}
async function listAllAnnotations(userId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memAnnotations.values()).filter((a) => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    const r = await pool.query(`SELECT * FROM "QCoreAnnotation" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [userId, limit]);
    return r.rows;
}
/* ═══════════════════════════════════════════════════════════════════════
   Workspace session pin order.
   ═══════════════════════════════════════════════════════════════════════ */
async function pinWorkspaceSession(workspaceId, sessionId, pinOrder) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return false;
    const r = await pool.query(`UPDATE "QCoreWorkspaceSession" SET "pinOrder"=$1 WHERE "workspaceId"=$2 AND "sessionId"=$3 RETURNING "sessionId"`, [pinOrder, workspaceId, sessionId]);
    return (r.rowCount ?? 0) > 0;
}
async function searchQCore(userId, query, limit = 20) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)() || !query.trim())
        return [];
    const q = query.trim();
    const [sessions, runs] = await Promise.all([
        pool.query(`SELECT "id","title","createdAt" FROM "QCoreSession"
       WHERE "userId"=$1 AND "title" ILIKE $2 ORDER BY "updatedAt" DESC LIMIT $3`, [userId, `%${q}%`, limit]),
        pool.query(`SELECT r."id", r."sessionId", r."userInput", r."finalContent", r."startedAt"
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
       WHERE s."userId"=$1 AND (r."userInput" ILIKE $2 OR r."finalContent" ILIKE $2)
       ORDER BY r."startedAt" DESC LIMIT $3`, [userId, `%${q}%`, limit]),
    ]);
    const results = [
        ...sessions.rows.map((s) => ({
            type: "session",
            id: s.id,
            title: s.title,
            snippet: s.title || "",
            createdAt: s.createdAt,
        })),
        ...runs.rows.map((r) => {
            const raw = r.userInput || r.finalContent || "";
            const idx = raw.toLowerCase().indexOf(q.toLowerCase());
            const start = Math.max(0, idx - 40);
            const snippet = (idx >= 0 ? "…" + raw.slice(start, start + 120) + "…" : raw.slice(0, 120));
            return {
                type: "run",
                id: r.id, sessionId: r.sessionId,
                snippet,
                createdAt: r.startedAt,
            };
        }),
    ];
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
/* ═══════════════════════════════════════════════════════════════════════
   Run follow-up — record the link between runs.
   ═══════════════════════════════════════════════════════════════════════ */
async function setFollowUpFrom(runId, fromRunId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return;
    await pool.query(`UPDATE "QCoreRun" SET "followUpFromId"=$1 WHERE "id"=$2`, [fromRunId, runId]);
}
// In-memory fallback maps
const memOrgs = new Map();
const memOrgMembers = new Map(); // key = `${orgId}:${userId}`
async function createOrg(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const now = nowIso();
    const row = { id, name: opts.name.slice(0, 200), ownerId: opts.ownerId, plan: "team", memberLimit: 5, createdAt: now, updatedAt: now };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memOrgs.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreOrg" ("id","name","ownerId") VALUES ($1,$2,$3) RETURNING *`, [id, row.name, opts.ownerId]);
    return r.rows[0];
}
async function getOrg(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memOrgs.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCoreOrg" WHERE "id"=$1`, [id]);
    return r.rows[0] ?? null;
}
async function listOrgs(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memOrgs.values()).filter((o) => o.ownerId === userId);
    const r = await pool.query(`SELECT * FROM "QCoreOrg" WHERE "ownerId"=$1 ORDER BY "createdAt" DESC`, [userId]);
    return r.rows;
}
async function deleteOrg(id, ownerId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const o = memOrgs.get(id);
        if (!o || o.ownerId !== ownerId)
            return false;
        memOrgs.delete(id);
        // Remove members
        for (const [k, m] of memOrgMembers) {
            if (m.orgId === id)
                memOrgMembers.delete(k);
        }
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreOrg" WHERE "id"=$1 AND "ownerId"=$2 RETURNING "id"`, [id, ownerId]);
    if ((r.rowCount ?? 0) > 0) {
        await pool.query(`DELETE FROM "QCoreOrgMember" WHERE "orgId"=$1`, [id]);
        return true;
    }
    return false;
}
async function addOrgMember(orgId, userId, role = "member") {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${orgId}:${userId}`;
    const row = { orgId, userId, role, joinedAt: nowIso() };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memOrgMembers.set(key, row);
        return true;
    }
    await pool.query(`INSERT INTO "QCoreOrgMember" ("orgId","userId","role") VALUES ($1,$2,$3)
     ON CONFLICT ("orgId","userId") DO UPDATE SET "role"=$3`, [orgId, userId, role]);
    return true;
}
async function removeOrgMember(orgId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${orgId}:${userId}`;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const had = memOrgMembers.has(key);
        memOrgMembers.delete(key);
        return had;
    }
    const r = await pool.query(`DELETE FROM "QCoreOrgMember" WHERE "orgId"=$1 AND "userId"=$2 RETURNING "userId"`, [orgId, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function listOrgMembers(orgId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return Array.from(memOrgMembers.values()).filter((m) => m.orgId === orgId);
    const r = await pool.query(`SELECT * FROM "QCoreOrgMember" WHERE "orgId"=$1 ORDER BY "joinedAt"`, [orgId]);
    return r.rows;
}
async function isOrgMember(orgId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${orgId}:${userId}`;
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memOrgMembers.has(key);
    const r = await pool.query(`SELECT 1 FROM "QCoreOrgMember" WHERE "orgId"=$1 AND "userId"=$2`, [orgId, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function createApiKey(userId, name, expiresInDays) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const rawBytes = crypto_1.default.randomBytes(32).toString("hex");
    const rawKey = `qck_${rawBytes}`;
    const keyHash = crypto_1.default.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);
    const id = crypto_1.default.randomUUID();
    const createdAt = nowIso();
    const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
        : null;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memApiKeys.set(id, { id, userId, name, keyHash, keyPrefix, lastUsedAt: null, expiresAt, createdAt });
    }
    else {
        await pool.query(`INSERT INTO "QCoreApiKey" ("id","userId","name","keyHash","keyPrefix","expiresAt","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, userId, name, keyHash, keyPrefix, expiresAt, createdAt]);
    }
    return { id, key: rawKey, keyPrefix, name, createdAt };
}
async function validateApiKey(rawKey) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!rawKey?.startsWith("qck_"))
        return null;
    const keyHash = crypto_1.default.createHash("sha256").update(rawKey).digest("hex");
    const now = nowIso();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        for (const row of memApiKeys.values()) {
            if (row.keyHash === keyHash) {
                if (row.expiresAt && row.expiresAt < now)
                    return null;
                row.lastUsedAt = now;
                return { userId: row.userId, keyId: row.id };
            }
        }
        return null;
    }
    const r = await pool.query(`SELECT "id","userId","expiresAt" FROM "QCoreApiKey" WHERE "keyHash"=$1`, [keyHash]);
    if (!r.rows.length)
        return null;
    const row = r.rows[0];
    if (row.expiresAt && new Date(row.expiresAt) < new Date())
        return null;
    await pool.query(`UPDATE "QCoreApiKey" SET "lastUsedAt"=$1 WHERE "id"=$2`, [now, row.id]);
    return { userId: row.userId, keyId: row.id };
}
async function listApiKeys(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memApiKeys.values())
            .filter((k) => k.userId === userId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(({ id, name, keyPrefix, lastUsedAt, expiresAt, createdAt }) => ({
            id, name, keyPrefix, lastUsedAt, expiresAt, createdAt,
        }));
    }
    const r = await pool.query(`SELECT "id","name","keyPrefix","lastUsedAt","expiresAt","createdAt"
     FROM "QCoreApiKey" WHERE "userId"=$1 ORDER BY "createdAt" DESC`, [userId]);
    return r.rows;
}
async function deleteApiKey(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = memApiKeys.get(id);
        if (!row || row.userId !== userId)
            return false;
        memApiKeys.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreApiKey" WHERE "id"=$1 AND "userId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
/* ═══════════════════════════════════════════════════════════════════════
   V45 — Run claps
   ═══════════════════════════════════════════════════════════════════════ */
async function clapRun(runId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const run = memRuns.get(runId);
        if (!run)
            return 0;
        const current = run.clapCount ?? 0;
        run.clapCount = current + 1;
        return run.clapCount;
    }
    const r = await pool.query(`UPDATE "QCoreRun" SET "clapCount" = COALESCE("clapCount",0) + 1
     WHERE "id"=$1 RETURNING "clapCount"`, [runId]);
    return r.rows[0]?.clapCount ?? 0;
}
async function getRunClapCount(runId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const run = memRuns.get(runId);
        return run?.clapCount ?? 0;
    }
    const r = await pool.query(`SELECT "clapCount" FROM "QCoreRun" WHERE "id"=$1`, [runId]);
    return r.rows[0]?.clapCount ?? 0;
}
/* ═══════════════════════════════════════════════════════════════════════
   V47 — Session AI summary (cached)
   ═══════════════════════════════════════════════════════════════════════ */
async function setSessionAiSummary(sessionId, summary) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(sessionId);
        if (s) {
            s.aiSummary = summary;
            s.aiSummaryAt = nowIso();
        }
        return;
    }
    await pool.query(`UPDATE "QCoreSession" SET "aiSummary"=$1, "aiSummaryAt"=NOW() WHERE "id"=$2`, [summary, sessionId]);
}
async function getSessionAiSummary(sessionId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const s = memSessions.get(sessionId);
        if (!s || !s.aiSummary)
            return null;
        return { summary: s.aiSummary, generatedAt: s.aiSummaryAt };
    }
    const r = await pool.query(`SELECT "aiSummary","aiSummaryAt" FROM "QCoreSession" WHERE "id"=$1`, [sessionId]);
    const row = r.rows[0];
    if (!row || !row.aiSummary)
        return null;
    return { summary: row.aiSummary, generatedAt: row.aiSummaryAt };
}
/* ═══════════════════════════════════════════════════════════════════════
   V49 — Per-user rate limits
   ═══════════════════════════════════════════════════════════════════════ */
const memRateLimits = new Map();
async function checkAndIncrRateLimit(userId, bucket, limit, windowMs) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${userId}::${bucket}`;
    const now = Date.now();
    const resetAt = new Date(now + windowMs).toISOString();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const cur = memRateLimits.get(key);
        const windowStart = cur ? new Date(cur.windowStart).getTime() : 0;
        if (!cur || now - windowStart >= windowMs) {
            memRateLimits.set(key, { count: 1, windowStart: new Date(now).toISOString() });
            return { allowed: true, remaining: limit - 1, resetAt };
        }
        if (cur.count >= limit) {
            return { allowed: false, remaining: 0, resetAt: new Date(windowStart + windowMs).toISOString() };
        }
        cur.count += 1;
        return { allowed: true, remaining: limit - cur.count, resetAt: new Date(windowStart + windowMs).toISOString() };
    }
    // DB path: upsert with window reset logic
    const windowSecs = Math.ceil(windowMs / 1000);
    const r = await pool.query(`INSERT INTO "QCoreRateLimit" ("userId","bucket","count","windowStart")
     VALUES ($1,$2,1,NOW())
     ON CONFLICT ("userId","bucket") DO UPDATE
       SET "count" = CASE
             WHEN EXTRACT(EPOCH FROM (NOW() - "QCoreRateLimit"."windowStart")) * 1000 >= $3
             THEN 1
             ELSE "QCoreRateLimit"."count" + 1
           END,
           "windowStart" = CASE
             WHEN EXTRACT(EPOCH FROM (NOW() - "QCoreRateLimit"."windowStart")) * 1000 >= $3
             THEN NOW()
             ELSE "QCoreRateLimit"."windowStart"
           END
     RETURNING "count","windowStart"`, [userId, bucket, windowMs]);
    const row = r.rows[0];
    const count = row?.count ?? 1;
    const windowStart = row?.windowStart ? new Date(row.windowStart).getTime() : now;
    const computedResetAt = new Date(windowStart + windowMs).toISOString();
    const allowed = count <= limit;
    return { allowed, remaining: Math.max(0, limit - count), resetAt: computedResetAt };
}
async function adminResetRateLimit(userId, bucket) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const key = `${userId}::${bucket}`;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const existed = memRateLimits.has(key);
        memRateLimits.delete(key);
        return existed;
    }
    const r = await pool.query(`DELETE FROM "QCoreRateLimit" WHERE "userId"=$1 AND "bucket"=$2 RETURNING "userId"`, [userId, bucket]);
    return (r.rowCount ?? 0) > 0;
}
async function listRateLimits(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const prefix = `${userId}::`;
        const results = [];
        for (const [key, val] of memRateLimits.entries()) {
            if (key.startsWith(prefix)) {
                results.push({ bucket: key.slice(prefix.length), count: val.count, windowStart: val.windowStart });
            }
        }
        return results;
    }
    const r = await pool.query(`SELECT "bucket","count","windowStart" FROM "QCoreRateLimit" WHERE "userId"=$1`, [userId]);
    return r.rows;
}
const memPromptChains = new Map();
async function createPromptChain(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const row = {
        id,
        userId: opts.userId,
        name: opts.name.slice(0, 120),
        description: opts.description?.slice(0, 500) ?? null,
        steps: (opts.steps ?? []).slice(0, 20),
        isPublic: opts.isPublic ?? false,
        runCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memPromptChains.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCorePromptChain" ("id","userId","name","description","steps","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [id, row.userId, row.name, row.description, JSON.stringify(row.steps), row.isPublic]);
    const dbRow = r.rows[0];
    return { ...dbRow, steps: typeof dbRow.steps === "string" ? JSON.parse(dbRow.steps) : (dbRow.steps ?? []) };
}
async function listPromptChains(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memPromptChains.values())
            .filter((c) => c.userId === userId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    const r = await pool.query(`SELECT * FROM "QCorePromptChain" WHERE "userId"=$1 ORDER BY "updatedAt" DESC`, [userId]);
    return r.rows.map((row) => ({ ...row, steps: typeof row.steps === "string" ? JSON.parse(row.steps) : (row.steps ?? []) }));
}
async function getPromptChain(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return memPromptChains.get(id) ?? null;
    const r = await pool.query(`SELECT * FROM "QCorePromptChain" WHERE "id"=$1`, [id]);
    if (!r.rows[0])
        return null;
    const row = r.rows[0];
    return { ...row, steps: typeof row.steps === "string" ? JSON.parse(row.steps) : (row.steps ?? []) };
}
async function updatePromptChain(id, userId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = memPromptChains.get(id);
        if (!row || row.userId !== userId)
            return null;
        const updated = { ...row, ...patch, updatedAt: nowIso() };
        memPromptChains.set(id, updated);
        return updated;
    }
    const sets = [];
    const vals = [];
    let idx = 1;
    if (patch.name !== undefined) {
        sets.push(`"name"=$${idx++}`);
        vals.push(String(patch.name).slice(0, 120));
    }
    if (patch.description !== undefined) {
        sets.push(`"description"=$${idx++}`);
        vals.push(patch.description?.slice(0, 500) ?? null);
    }
    if (patch.steps !== undefined) {
        sets.push(`"steps"=$${idx++}`);
        vals.push(JSON.stringify(patch.steps));
    }
    if (patch.isPublic !== undefined) {
        sets.push(`"isPublic"=$${idx++}`);
        vals.push(Boolean(patch.isPublic));
    }
    if (sets.length === 0)
        return getPromptChain(id);
    sets.push(`"updatedAt"=NOW()`);
    vals.push(id, userId);
    const r = await pool.query(`UPDATE "QCorePromptChain" SET ${sets.join(",")} WHERE "id"=$${idx++} AND "userId"=$${idx++} RETURNING *`, vals);
    if (!r.rows[0])
        return null;
    const row = r.rows[0];
    return { ...row, steps: typeof row.steps === "string" ? JSON.parse(row.steps) : (row.steps ?? []) };
}
async function deletePromptChain(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = memPromptChains.get(id);
        if (!row || row.userId !== userId)
            return false;
        memPromptChains.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCorePromptChain" WHERE "id"=$1 AND "userId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function listPublicPromptChains(limit = 20) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memPromptChains.values())
            .filter((c) => c.isPublic)
            .sort((a, b) => b.runCount - a.runCount)
            .slice(0, limit);
    }
    const r = await pool.query(`SELECT * FROM "QCorePromptChain" WHERE "isPublic"=TRUE ORDER BY "runCount" DESC LIMIT $1`, [limit]);
    return r.rows.map((row) => ({ ...row, steps: typeof row.steps === "string" ? JSON.parse(row.steps) : (row.steps ?? []) }));
}
async function incrPromptChainRunCount(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = memPromptChains.get(id);
        if (row) {
            row.runCount += 1;
            row.updatedAt = nowIso();
        }
        return;
    }
    await pool.query(`UPDATE "QCorePromptChain" SET "runCount"="runCount"+1,"updatedAt"=NOW() WHERE "id"=$1`, [id]);
}
const memInvites = new Map();
async function createSessionInvite(sessionId, invitedBy, opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const token = "si_" + crypto_1.default.randomBytes(24).toString("base64url");
    const role = opts?.role || "viewer";
    const expiresAt = opts?.expiresInDays
        ? new Date(Date.now() + opts.expiresInDays * 86400000).toISOString()
        : null;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = { id, sessionId, invitedBy, token, role, expiresAt, usedCount: 0, createdAt: nowIso() };
        memInvites.set(token, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreSessionInvite" ("id","sessionId","invitedBy","token","role","expiresAt")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [id, sessionId, invitedBy, token, role, expiresAt]);
    return r.rows[0];
}
async function getSessionInvite(token) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = memInvites.get(token);
        if (!row)
            return null;
        if (row.expiresAt && new Date(row.expiresAt) < new Date())
            return null;
        return row;
    }
    // Роль 'collab' — НЕ приглашение. 28.08.2026 ссылки совместного просмотра
    // переехали из памяти в эту же таблицу, и без фильтра токен просмотра стал
    // бы резолвиться здесь как обычное приглашение: два разных права с разным
    // сроком жизни за одним ключом. Механизмы разные — держим их раздельно.
    const r = await pool.query(`SELECT * FROM "QCoreSessionInvite"
      WHERE "token"=$1 AND "role" <> 'collab'
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`, [token]);
    return r.rows[0] ?? null;
}
async function listSessionInvites(sessionId, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memInvites.values())
            .filter((inv) => inv.sessionId === sessionId && inv.invitedBy === userId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    // Роль 'collab' сюда не входит по той же причине, что и в getSessionInvite:
    // ссылки совместного просмотра живут в этой таблице с 28.08.2026, но
    // приглашениями не являются. Частичное разделение хуже полного: список,
    // который иногда показывает чужой механизм, однажды дадут на экран.
    const r = await pool.query(`SELECT * FROM "QCoreSessionInvite"
      WHERE "sessionId"=$1 AND "invitedBy"=$2 AND "role" <> 'collab'
      ORDER BY "createdAt" DESC`, [sessionId, userId]);
    return r.rows;
}
async function deleteSessionInvite(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        for (const [token, inv] of memInvites.entries()) {
            if (inv.id === id && inv.invitedBy === userId) {
                memInvites.delete(token);
                return true;
            }
        }
        return false;
    }
    // Роль 'collab' исключена и здесь — третье и последнее место, где механизмы
    // делят таблицу. Достать id ссылки просмотра через API приглашений сегодня
    // нельзя (список её не показывает), то есть путь недостижим. Ровно так я и
    // рассуждал про читателя по токену — и получил там настоящую дыру. Правило
    // должно быть одинаковым во всех трёх местах, иначе следующий добавит
    // четвёртое и будет гадать, какое из них главное.
    const r = await pool.query(`DELETE FROM "QCoreSessionInvite"
      WHERE "id"=$1 AND "invitedBy"=$2 AND "role" <> 'collab'`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function incrementInviteUseCount(token) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = memInvites.get(token);
        if (row)
            row.usedCount += 1;
        return;
    }
    await pool.query(`UPDATE "QCoreSessionInvite" SET "usedCount"="usedCount"+1 WHERE "token"=$1`, [token]);
}
// In-memory: per-user list, max 100 entries each
const memUserAuditLog = new Map();
async function logAudit(userId, action, opts) {
    try {
        await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
        const id = crypto_1.default.randomUUID();
        if (!(0, ensureQCoreTables_1.isDbReady)()) {
            const list = memUserAuditLog.get(userId) ?? [];
            list.unshift({ id, userId, action, resourceId: opts?.resourceId ?? null, resourceType: opts?.resourceType ?? null, meta: opts?.meta ?? null, ip: opts?.ip ?? null, createdAt: nowIso() });
            if (list.length > 100)
                list.length = 100;
            memUserAuditLog.set(userId, list);
            return;
        }
        await pool.query(`INSERT INTO "QCoreUserAuditLog" ("id","userId","action","resourceId","resourceType","meta","ip")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, userId, action, opts?.resourceId ?? null, opts?.resourceType ?? null, opts?.meta ? JSON.stringify(opts.meta) : null, opts?.ip ?? null]);
    }
    catch { /* fire-and-forget — never throws */ }
}
async function listAuditLog(userId, limit = 50) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return (memUserAuditLog.get(userId) ?? []).slice(0, limit);
    }
    const r = await pool.query(`SELECT * FROM "QCoreUserAuditLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [userId, limit]);
    return r.rows;
}
/* ═══════════════════════════════════════════════════════════════════════
   V54 — Comprehensive user stats (/me/stats)
   ═══════════════════════════════════════════════════════════════════════ */
async function getUserStats(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return {
            totalSessions: 0,
            totalRuns: 0,
            totalCostUsd: 0,
            totalTokensIn: 0,
            totalTokensOut: 0,
            avgCostPerRun: 0,
            mostUsedStrategy: "",
            mostUsedProvider: "",
            joinedAt: null,
        };
    }
    const [sessR, runR, stratR, provR] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS cnt, MIN("createdAt") AS first FROM "QCoreSession" WHERE "userId"=$1`, [userId]),
        pool.query(`SELECT COUNT(*) AS cnt, COALESCE(SUM("totalCostUsd"),0) AS cost FROM "QCoreRun" r
       JOIN "QCoreSession" s ON r."sessionId"=s."id" WHERE s."userId"=$1`, [userId]),
        pool.query(`SELECT r."strategy", COUNT(*) AS cnt FROM "QCoreRun" r
       JOIN "QCoreSession" s ON r."sessionId"=s."id"
       WHERE s."userId"=$1 AND r."strategy" IS NOT NULL
       GROUP BY r."strategy" ORDER BY cnt DESC LIMIT 1`, [userId]),
        pool.query(`SELECT m."provider", COUNT(*) AS cnt FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON m."runId"=r."id"
       JOIN "QCoreSession" s ON r."sessionId"=s."id"
       WHERE s."userId"=$1 AND m."provider" IS NOT NULL
       GROUP BY m."provider" ORDER BY cnt DESC LIMIT 1`, [userId]),
    ]);
    const totalSessions = parseInt(sessR.rows[0]?.cnt ?? "0", 10);
    const joinedAt = sessR.rows[0]?.first ?? null;
    const totalRuns = parseInt(runR.rows[0]?.cnt ?? "0", 10);
    const totalCostUsd = parseFloat(runR.rows[0]?.cost ?? "0");
    const avgCostPerRun = totalRuns > 0 ? totalCostUsd / totalRuns : 0;
    const mostUsedStrategy = stratR.rows[0]?.strategy ?? "";
    const mostUsedProvider = provR.rows[0]?.provider ?? "";
    // Token totals (best-effort — QCoreMessage may not exist)
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    try {
        const tokR = await pool.query(`SELECT COALESCE(SUM("tokensIn"),0) AS ti, COALESCE(SUM("tokensOut"),0) AS to_
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON m."runId"=r."id"
       JOIN "QCoreSession" s ON r."sessionId"=s."id"
       WHERE s."userId"=$1`, [userId]);
        totalTokensIn = parseFloat(tokR.rows[0]?.ti ?? "0");
        totalTokensOut = parseFloat(tokR.rows[0]?.to_ ?? "0");
    }
    catch { /* table might differ */ }
    return { totalSessions, totalRuns, totalCostUsd, totalTokensIn, totalTokensOut, avgCostPerRun, mostUsedStrategy, mostUsedProvider, joinedAt };
}
/* ═══════════════════════════════════════════════════════════════════════
   V59 — AI Memory helpers
   ═══════════════════════════════════════════════════════════════════════ */
async function addMemory(userId, content, opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const category = opts?.category || "general";
    const source = opts?.source ?? null;
    const pinned = opts?.pinned ?? false;
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = { id, userId, content, category, source, pinned, createdAt: nowIso(), updatedAt: nowIso() };
        memMemories.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreMemory" ("id","userId","content","category","source","pinned")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [id, userId, content, category, source, pinned]);
    return r.rows[0];
}
async function listMemories(userId, opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const lim = Math.max(1, Math.min(200, opts?.limit ?? 50));
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        let rows = Array.from(memMemories.values()).filter((m) => m.userId === userId);
        if (opts?.category)
            rows = rows.filter((m) => m.category === opts.category);
        if (opts?.pinned !== undefined)
            rows = rows.filter((m) => m.pinned === opts.pinned);
        rows.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
        return rows.slice(0, lim);
    }
    const conditions = [`"userId"=$1`];
    const params = [userId];
    if (opts?.category) {
        params.push(opts.category);
        conditions.push(`"category"=$${params.length}`);
    }
    if (opts?.pinned !== undefined) {
        params.push(opts.pinned);
        conditions.push(`"pinned"=$${params.length}`);
    }
    params.push(lim);
    const r = await pool.query(`SELECT * FROM "QCoreMemory" WHERE ${conditions.join(" AND ")} ORDER BY "pinned" DESC, "createdAt" DESC LIMIT $${params.length}`, params);
    return r.rows;
}
async function deleteMemory(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const m = memMemories.get(id);
        if (!m || m.userId !== userId)
            return false;
        memMemories.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreMemory" WHERE "id"=$1 AND "userId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function updateMemory(id, userId, patch) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const m = memMemories.get(id);
        if (!m || m.userId !== userId)
            return null;
        if (patch.content !== undefined)
            m.content = patch.content;
        if (patch.category !== undefined)
            m.category = patch.category;
        if (patch.pinned !== undefined)
            m.pinned = patch.pinned;
        m.updatedAt = nowIso();
        return m;
    }
    const sets = [`"updatedAt"=NOW()`];
    const params = [id, userId];
    if (patch.content !== undefined) {
        params.push(patch.content);
        sets.push(`"content"=$${params.length}`);
    }
    if (patch.category !== undefined) {
        params.push(patch.category);
        sets.push(`"category"=$${params.length}`);
    }
    if (patch.pinned !== undefined) {
        params.push(patch.pinned);
        sets.push(`"pinned"=$${params.length}`);
    }
    const r = await pool.query(`UPDATE "QCoreMemory" SET ${sets.join(",")} WHERE "id"=$1 AND "userId"=$2 RETURNING *`, params);
    return r.rows[0] || null;
}
async function extractMemoriesFromRun(userId, finalContent, userInput) {
    // Best-effort — swallows all errors so the caller (run completion) never blocks.
    try {
        const providerId = (0, providers_1.resolveProvider)();
        if (providerId === "stub")
            return; // no provider configured
        const prompt = `Extract 2-3 key facts or preferences from this conversation that should be remembered. Return JSON array of strings. Conversation: Q: ${userInput.slice(0, 500)}\nA: ${finalContent.slice(0, 1000)}`;
        const prov = (0, providers_1.getProviders)().find((p) => p.id === providerId);
        const result = await (0, providers_1.callProvider)(providerId, [{ role: "user", content: prompt }], prov?.defaultModel ?? "", 0.3);
        let facts = [];
        try {
            const cleaned = result.reply.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            facts = JSON.parse(cleaned);
            if (!Array.isArray(facts))
                facts = [];
        }
        catch {
            return;
        }
        for (const fact of facts.slice(0, 3)) {
            if (typeof fact === "string" && fact.trim()) {
                await addMemory(userId, fact.trim(), { category: "fact", pinned: false });
            }
        }
    }
    catch { /* silent */ }
}
async function listPinnedMemories(userId, limit = 5) {
    return listMemories(userId, { pinned: true, limit });
}
/* ═══════════════════════════════════════════════════════════════════════
   V60 — Template pin helper
   ═══════════════════════════════════════════════════════════════════════ */
async function pinTemplate(id, userId, pinned) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memTemplates.get(id);
        if (!t || t.ownerUserId !== userId)
            return false;
        t.pinned = pinned;
        return true;
    }
    const r = await pool.query(`UPDATE "QCoreTemplate" SET "pinned"=$3, "updatedAt"=NOW() WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`, [id, userId, pinned]);
    return (r.rowCount ?? 0) > 0;
}
const memAbTests = new Map();
async function createAbTest(opts) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const strategy = opts.strategy || "sequential";
    const overrides = opts.overrides ?? {};
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            userId: opts.userId,
            name: opts.name,
            promptA: opts.promptA,
            promptB: opts.promptB,
            strategy,
            overrides,
            status: "active",
            runsA: 0,
            runsB: 0,
            avgCostA: 0,
            avgCostB: 0,
            avgRatingA: 0,
            avgRatingB: 0,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        memAbTests.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreAbTest" ("id","userId","name","promptA","promptB","strategy","overrides")
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id, opts.userId, opts.name, opts.promptA, opts.promptB, strategy, JSON.stringify(overrides)]);
    const row = r.rows[0];
    return { ...row, overrides: row.overrides ?? {} };
}
async function listAbTests(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return Array.from(memAbTests.values())
            .filter((t) => t.userId === userId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const r = await pool.query(`SELECT * FROM "QCoreAbTest" WHERE "userId"=$1 ORDER BY "createdAt" DESC`, [userId]);
    return r.rows.map((row) => ({ ...row, overrides: row.overrides ?? {} }));
}
async function getAbTest(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memAbTests.get(id);
        if (!t || t.userId !== userId)
            return null;
        return t;
    }
    const r = await pool.query(`SELECT * FROM "QCoreAbTest" WHERE "id"=$1 AND "userId"=$2`, [id, userId]);
    if (!r.rows[0])
        return null;
    return { ...r.rows[0], overrides: r.rows[0].overrides ?? {} };
}
async function deleteAbTest(id, userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memAbTests.get(id);
        if (!t || t.userId !== userId)
            return false;
        memAbTests.delete(id);
        return true;
    }
    const r = await pool.query(`DELETE FROM "QCoreAbTest" WHERE "id"=$1 AND "userId"=$2 RETURNING "id"`, [id, userId]);
    return (r.rowCount ?? 0) > 0;
}
async function recordAbTestResult(id, variant, costUsd, rating) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const t = memAbTests.get(id);
        if (!t)
            return;
        if (variant === "a") {
            const prevN = t.runsA;
            t.runsA += 1;
            t.avgCostA = (t.avgCostA * prevN + costUsd) / t.runsA;
            t.avgRatingA = (t.avgRatingA * prevN + rating) / t.runsA;
        }
        else {
            const prevN = t.runsB;
            t.runsB += 1;
            t.avgCostB = (t.avgCostB * prevN + costUsd) / t.runsB;
            t.avgRatingB = (t.avgRatingB * prevN + rating) / t.runsB;
        }
        t.updatedAt = nowIso();
        return;
    }
    if (variant === "a") {
        await pool.query(`UPDATE "QCoreAbTest"
       SET "runsA"="runsA"+1,
           "avgCostA"=("avgCostA"*"runsA"+$2)/("runsA"+1),
           "avgRatingA"=("avgRatingA"*"runsA"+$3)/("runsA"+1),
           "updatedAt"=NOW()
       WHERE "id"=$1`, [id, costUsd, rating]);
    }
    else {
        await pool.query(`UPDATE "QCoreAbTest"
       SET "runsB"="runsB"+1,
           "avgCostB"=("avgCostB"*"runsB"+$2)/("runsB"+1),
           "avgRatingB"=("avgRatingB"*"runsB"+$3)/("runsB"+1),
           "updatedAt"=NOW()
       WHERE "id"=$1`, [id, costUsd, rating]);
    }
}
/* ═══════════════════════════════════════════════════════════════════════
   V64 — User settings (key-value store)
   ═══════════════════════════════════════════════════════════════════════ */
const memUserSettings = new Map();
function settingsKey(userId, key) {
    return `${userId}:${key}`;
}
async function setUserSetting(userId, key, value) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        memUserSettings.set(settingsKey(userId, key), value);
        return;
    }
    await pool.query(`INSERT INTO "QCoreUserSettings" ("userId","key","value","updatedAt")
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT ("userId","key") DO UPDATE SET "value"=$3,"updatedAt"=NOW()`, [userId, key, JSON.stringify(value)]);
}
async function getUserSetting(userId, key) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const v = memUserSettings.get(settingsKey(userId, key));
        return v !== undefined ? v : null;
    }
    const r = await pool.query(`SELECT "value" FROM "QCoreUserSettings" WHERE "userId"=$1 AND "key"=$2`, [userId, key]);
    if (!r.rows[0])
        return null;
    return r.rows[0].value;
}
async function getAllUserSettings(userId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const prefix = `${userId}:`;
        const result = {};
        for (const [k, v] of memUserSettings.entries()) {
            if (k.startsWith(prefix))
                result[k.slice(prefix.length)] = v;
        }
        return result;
    }
    const r = await pool.query(`SELECT "key","value" FROM "QCoreUserSettings" WHERE "userId"=$1`, [userId]);
    const result = {};
    for (const row of r.rows)
        result[row.key] = row.value;
    return result;
}
async function deleteUserSetting(userId, key) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return memUserSettings.delete(settingsKey(userId, key));
    }
    const r = await pool.query(`DELETE FROM "QCoreUserSettings" WHERE "userId"=$1 AND "key"=$2 RETURNING "key"`, [userId, key]);
    return (r.rowCount ?? 0) > 0;
}
const memBranches = new Map();
async function createBranch(parentRunId, branchReason, alternativeInput, strategy = "debate") {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    const id = crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const row = {
            id,
            parentRunId,
            branchReason,
            alternativeInput,
            strategy,
            status: "pending",
            resultRunId: null,
            createdAt: now,
        };
        memBranches.set(id, row);
        return row;
    }
    const r = await pool.query(`INSERT INTO "QCoreRunBranch"
       ("id","parentRunId","branchReason","alternativeInput","strategy","status","resultRunId","createdAt")
     VALUES ($1,$2,$3,$4,$5,'pending',NULL,NOW())
     RETURNING *`, [id, parentRunId, branchReason, alternativeInput, strategy]);
    const row = r.rows[0];
    return {
        id: row.id,
        parentRunId: row.parentRunId,
        branchReason: row.branchReason,
        alternativeInput: row.alternativeInput,
        strategy: row.strategy,
        status: row.status,
        resultRunId: row.resultRunId ?? null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
}
async function getBranch(id) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        return memBranches.get(id) ?? null;
    }
    const r = await pool.query(`SELECT * FROM "QCoreRunBranch" WHERE "id"=$1`, [id]);
    if (!r.rows[0])
        return null;
    const row = r.rows[0];
    return {
        id: row.id,
        parentRunId: row.parentRunId,
        branchReason: row.branchReason,
        alternativeInput: row.alternativeInput,
        strategy: row.strategy,
        status: row.status,
        resultRunId: row.resultRunId ?? null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
}
async function listBranches(parentRunId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const out = [];
        for (const b of memBranches.values()) {
            if (b.parentRunId === parentRunId)
                out.push(b);
        }
        return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    const r = await pool.query(`SELECT * FROM "QCoreRunBranch" WHERE "parentRunId"=$1 ORDER BY "createdAt" ASC`, [parentRunId]);
    return r.rows.map((row) => ({
        id: row.id,
        parentRunId: row.parentRunId,
        branchReason: row.branchReason,
        alternativeInput: row.alternativeInput,
        strategy: row.strategy,
        status: row.status,
        resultRunId: row.resultRunId ?? null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    }));
}
async function completeBranch(id, resultRunId) {
    await (0, ensureQCoreTables_1.ensureQCoreTables)(pool);
    if (!(0, ensureQCoreTables_1.isDbReady)()) {
        const b = memBranches.get(id);
        if (!b)
            return false;
        memBranches.set(id, { ...b, status: "completed", resultRunId });
        return true;
    }
    const r = await pool.query(`UPDATE "QCoreRunBranch"
     SET "status"='completed', "resultRunId"=$2
     WHERE "id"=$1
     RETURNING "id"`, [id, resultRunId]);
    return (r.rowCount ?? 0) > 0;
}
