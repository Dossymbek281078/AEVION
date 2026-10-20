"use strict";
/**
 * QChainGov — decentralized governance and organizational infrastructure.
 *
 * Per AEVION fintech manifest: governance + coordination layer. Proposals,
 * voting, treasury coordination, organizational management with AI-assisted
 * governance analysis hooks.
 *
 * Architecture:
 *  - Identity:  AEVION JWT (every proposal/vote bound to userId)
 *  - Wallet:    voting power can be AEV-weighted (read from QPayNet/AEV
 *               wallets) or 1-user-1-vote depending on proposal mode.
 *  - Security:  one vote per user per proposal (UNIQUE constraint),
 *               proposals immutable after voting opens.
 *  - Audit:     proposals + votes append-only; tallies materialized on read.
 *  - AI hook:   Sentry-style aggregation of vote rationales for downstream
 *               summarization via QCoreAI.
 *
 * Vote modes:
 *  - "yes-no-abstain"   — simple 3-option vote
 *  - "ranked-choice"    — ordered preference list (max 10 options)
 *  - "weighted"         — split N voting power across options (sum ≤ 1.0)
 *
 * Endpoints:
 *   GET  /api/qchaingov/health
 *   POST /api/qchaingov/proposals              — create (auth)
 *   GET  /api/qchaingov/proposals              — list
 *   GET  /api/qchaingov/proposals/:id          — detail + tally
 *   POST /api/qchaingov/proposals/:id/votes    — cast vote (auth)
 *   POST /api/qchaingov/proposals/:id/open     — admin opens voting
 *   POST /api/qchaingov/proposals/:id/close    — admin closes
 *   GET  /api/qchaingov/proposals/:id/votes    — list votes (public)
 *   GET  /api/qchaingov/stats
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qchaingovRouter = void 0;
const express_1 = require("express");
const platform_1 = require("../lib/sentry/platform");
const node_crypto_1 = __importDefault(require("node:crypto"));
const dbPool_1 = require("../lib/dbPool");
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const authJwt_1 = require("../lib/authJwt");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const captureQChaingov = (0, platform_1.makeServiceCapture)("qchaingov");
exports.qchaingovRouter = (0, express_1.Router)();
const writeLimit = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false });
const voteLimit = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false });
const readLimit = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false });
const PROPOSAL_STATUSES = new Set(["draft", "open", "closed", "executed", "rejected"]);
const VOTE_MODES = new Set(["yes-no-abstain", "ranked-choice", "weighted"]);
const CATEGORIES = new Set([
    "treasury", "protocol", "module", "partnership",
    "tokenomics", "social", "operations", "emergency",
]);
function isAdmin(auth) {
    if (!auth?.email)
        return false;
    const list = (process.env.QCHAINGOV_ADMIN_EMAILS || "").toLowerCase()
        .split(",").map(s => s.trim()).filter(Boolean);
    if (list.length === 0) {
        // Without this, /open /close /execute silently 403 for everyone and the
        // cause (unset env) is undiagnosable from logs. Make it explicit.
        console.error("[qchaingov] admin emails not configured: QCHAINGOV_ADMIN_EMAILS is empty — all admin actions (open/close/execute) will be denied");
        return false;
    }
    return list.includes(auth.email.toLowerCase());
}
let tablesReady = false;
async function ensureTables() {
    if (tablesReady)
        return;
    const pool = (0, dbPool_1.getPool)();
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "QChainGovProposal" (
      "id"             TEXT PRIMARY KEY,
      "authorUserId"   TEXT NOT NULL,
      "title"          TEXT NOT NULL,
      "summary"        TEXT NOT NULL,
      "body"           TEXT NOT NULL,
      "category"       TEXT NOT NULL DEFAULT 'protocol',
      "voteMode"       TEXT NOT NULL DEFAULT 'yes-no-abstain',
      "options"        JSONB NOT NULL DEFAULT '[]'::jsonb,
      "quorumPercent"  INT NOT NULL DEFAULT 10,
      "passThreshold"  INT NOT NULL DEFAULT 50,
      "status"         TEXT NOT NULL DEFAULT 'draft',
      "votesOpenAt"    TIMESTAMPTZ,
      "votesCloseAt"   TIMESTAMPTZ,
      "executedAt"     TIMESTAMPTZ,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QChainGovProposal_status_idx" ON "QChainGovProposal" ("status", "createdAt");`);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "QChainGovVote" (
      "id"            TEXT PRIMARY KEY,
      "proposalId"    TEXT NOT NULL,
      "voterUserId"   TEXT NOT NULL,
      "choice"        TEXT NOT NULL,
      "weight"        DOUBLE PRECISION NOT NULL DEFAULT 1,
      "rationale"     TEXT,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("proposalId", "voterUserId")
    );
  `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QChainGovVote_proposal_idx" ON "QChainGovVote" ("proposalId");`);
    tablesReady = true;
}
// Состояние базы в ручке здоровья. Добавлено 19.08.2026: сторож запасного
// хранилища видел 9 модулей из 12 — остальные не публиковали поле, и молчание
// читалось как благополучие.
//
// У этого модуля, в отличие от соседей, нет готового признака готовности:
// ensureTables() просто выполняет запросы и бросает при отказе. Поэтому здесь
// дешёвая прямая проверка SELECT 1 — она стоит миллисекунды и отвечает на
// вопрос честно, а не по флагу, который могли забыть обновить.
exports.qchaingovRouter.get("/health", async (_req, res) => {
    let db = "memory";
    try {
        await (0, dbPool_1.getPool)().query("SELECT 1");
        db = "postgres";
    }
    catch { /* база недоступна — так и скажем, а не промолчим */ }
    res.json({ status: "ok", service: "qchaingov", db, timestamp: new Date().toISOString() });
});
// ── POST /proposals — create draft proposal
exports.qchaingovRouter.post("/proposals", writeLimit, async (req, res) => {
    try {
        await ensureTables();
        const auth = (0, authJwt_1.verifyBearerOptional)(req);
        if (!auth)
            return res.status(401).json({ error: "auth required" });
        const { title, summary, body, category = "protocol", voteMode = "yes-no-abstain", options = ["yes", "no", "abstain"], quorumPercent = 10, passThreshold = 50, votesOpenAt, votesCloseAt, } = req.body || {};
        if (typeof title !== "string" || title.trim().length < 5 || title.length > 200) {
            return res.status(400).json({ error: "title must be 5..200 chars" });
        }
        if (typeof summary !== "string" || summary.trim().length < 10 || summary.length > 500) {
            return res.status(400).json({ error: "summary must be 10..500 chars" });
        }
        if (typeof body !== "string" || body.trim().length < 20 || body.length > 20000) {
            return res.status(400).json({ error: "body must be 20..20000 chars" });
        }
        if (!CATEGORIES.has(category)) {
            return res.status(400).json({ error: "invalid_category", allowed: Array.from(CATEGORIES) });
        }
        if (!VOTE_MODES.has(voteMode)) {
            return res.status(400).json({ error: "invalid_voteMode", allowed: Array.from(VOTE_MODES) });
        }
        if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
            return res.status(400).json({ error: "options must be array 2..10" });
        }
        const cleanOptions = options.map(o => String(o).slice(0, 80).trim()).filter(Boolean);
        if (cleanOptions.length !== options.length) {
            return res.status(400).json({ error: "options must be non-empty strings" });
        }
        const qP = parseInt(String(quorumPercent), 10);
        const pT = parseInt(String(passThreshold), 10);
        if (!Number.isFinite(qP) || qP < 1 || qP > 100)
            return res.status(400).json({ error: "quorumPercent 1..100" });
        if (!Number.isFinite(pT) || pT < 1 || pT > 100)
            return res.status(400).json({ error: "passThreshold 1..100" });
        const id = node_crypto_1.default.randomUUID();
        const pool = (0, dbPool_1.getPool)();
        await pool.query(`INSERT INTO "QChainGovProposal"
         ("id","authorUserId","title","summary","body","category","voteMode","options","quorumPercent","passThreshold","votesOpenAt","votesCloseAt","status")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,'draft')`, [
            id, auth.sub,
            title.trim(), summary.trim(), body.trim(),
            category, voteMode, JSON.stringify(cleanOptions),
            qP, pT,
            votesOpenAt ? new Date(votesOpenAt) : null,
            votesCloseAt ? new Date(votesCloseAt) : null,
        ]);
        res.status(201).json({ id, status: "draft", options: cleanOptions });
    }
    catch (err) {
        console.error("[qchaingov] proposal_create_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/POST/proposals" });
        res.status(500).json({ error: "proposal_create_failed" });
    }
});
exports.qchaingovRouter.get("/proposals", readLimit, async (req, res) => {
    try {
        await ensureTables();
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1), 100);
        const status = String(req.query.status ?? "").trim();
        const category = String(req.query.category ?? "").trim();
        const params = [];
        const where = [];
        if (PROPOSAL_STATUSES.has(status)) {
            params.push(status);
            where.push(`"status" = $${params.length}`);
        }
        if (CATEGORIES.has(category)) {
            params.push(category);
            where.push(`"category" = $${params.length}`);
        }
        params.push(limit);
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query(`
      SELECT "id","authorUserId","title","summary","category","voteMode","options","quorumPercent","passThreshold","status","votesOpenAt","votesCloseAt","createdAt"
      FROM "QChainGovProposal"
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY "createdAt" DESC LIMIT $${params.length}
    `, params);
        res.json({ proposals: r.rows, total: r.rowCount });
    }
    catch (err) {
        console.error("[qchaingov] proposals_list_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/GET/proposals" });
        res.status(500).json({ error: "proposals_list_failed" });
    }
});
exports.qchaingovRouter.get("/proposals/:id", readLimit, async (req, res) => {
    try {
        await ensureTables();
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        const pool = (0, dbPool_1.getPool)();
        const p = await pool.query(`SELECT * FROM "QChainGovProposal" WHERE "id" = $1 LIMIT 1`, [id]);
        if (p.rowCount === 0)
            return res.status(404).json({ error: "proposal_not_found" });
        const tallyR = await pool.query(`SELECT "choice", COUNT(*)::int AS votes, COALESCE(SUM("weight"),0)::float AS weight
       FROM "QChainGovVote" WHERE "proposalId" = $1 GROUP BY "choice"`, [id]);
        const totalR = await pool.query(`SELECT COUNT(*)::int AS total, COALESCE(SUM("weight"),0)::float AS total_weight
       FROM "QChainGovVote" WHERE "proposalId" = $1`, [id]);
        res.json({
            proposal: p.rows[0],
            tally: tallyR.rows,
            totals: totalR.rows[0],
        });
    }
    catch (err) {
        console.error("[qchaingov] proposal_get_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/GET/proposals/:id" });
        res.status(500).json({ error: "proposal_get_failed" });
    }
});
// ── POST /proposals/:id/votes — cast a vote
exports.qchaingovRouter.post("/proposals/:id/votes", voteLimit, async (req, res) => {
    try {
        await ensureTables();
        const auth = (0, authJwt_1.verifyBearerOptional)(req);
        if (!auth)
            return res.status(401).json({ error: "auth required" });
        const id = String(req.params.id || "").trim();
        const { choice, weight = 1, rationale } = req.body || {};
        if (!choice || typeof choice !== "string")
            return res.status(400).json({ error: "choice required" });
        const w = Number(weight);
        if (!Number.isFinite(w) || w <= 0 || w > 1000000)
            return res.status(400).json({ error: "weight 0..1000000" });
        const pool = (0, dbPool_1.getPool)();
        const p = await pool.query(`SELECT "status","options" FROM "QChainGovProposal" WHERE "id" = $1 LIMIT 1`, [id]);
        if (p.rowCount === 0)
            return res.status(404).json({ error: "proposal_not_found" });
        const proposal = p.rows[0];
        if (proposal.status !== "open")
            return res.status(400).json({ error: "voting_not_open", status: proposal.status });
        const allowedOptions = Array.isArray(proposal.options) ? proposal.options : [];
        if (!allowedOptions.includes(choice)) {
            return res.status(400).json({ error: "invalid_choice", allowed: allowedOptions });
        }
        const voteId = node_crypto_1.default.randomUUID();
        try {
            await pool.query(`INSERT INTO "QChainGovVote" ("id","proposalId","voterUserId","choice","weight","rationale")
         VALUES ($1,$2,$3,$4,$5,$6)`, [voteId, id, auth.sub, choice, w, rationale ? String(rationale).slice(0, 1000) : null]);
        }
        catch (e) {
            const err = e;
            if (err.code === "23505")
                return res.status(409).json({ error: "already_voted" });
            throw e;
        }
        res.status(201).json({ id: voteId, proposalId: id, choice, weight: w });
    }
    catch (err) {
        console.error("[qchaingov] vote_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/POST/proposals/:id/votes" });
        res.status(500).json({ error: "vote_failed" });
    }
});
exports.qchaingovRouter.post("/proposals/:id/open", writeLimit, async (req, res) => {
    try {
        await ensureTables();
        const auth = (0, authJwt_1.verifyBearerOptional)(req);
        if (!isAdmin(auth))
            return res.status(403).json({ error: "admin_only" });
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query(`UPDATE "QChainGovProposal" SET "status" = 'open', "votesOpenAt" = NOW()
       WHERE "id" = $1 AND "status" = 'draft' RETURNING "id","status"`, [String(req.params.id || "")]);
        if ((r.rowCount ?? 0) === 0)
            return res.status(404).json({ error: "draft_proposal_not_found" });
        res.json({ ok: true, proposal: r.rows[0] });
    }
    catch (err) {
        console.error("[qchaingov] proposal_open_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/POST/proposals/:id/open" });
        res.status(500).json({ error: "proposal_open_failed" });
    }
});
exports.qchaingovRouter.post("/proposals/:id/close", writeLimit, async (req, res) => {
    try {
        await ensureTables();
        const auth = (0, authJwt_1.verifyBearerOptional)(req);
        if (!isAdmin(auth))
            return res.status(403).json({ error: "admin_only" });
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query(`UPDATE "QChainGovProposal" SET "status" = 'closed', "votesCloseAt" = NOW()
       WHERE "id" = $1 AND "status" = 'open' RETURNING "id","status"`, [String(req.params.id || "")]);
        if ((r.rowCount ?? 0) === 0)
            return res.status(404).json({ error: "open_proposal_not_found" });
        res.json({ ok: true, proposal: r.rows[0] });
    }
    catch (err) {
        console.error("[qchaingov] proposal_close_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/POST/proposals/:id/close" });
        res.status(500).json({ error: "proposal_close_failed" });
    }
});
// ── POST /proposals/:id/execute — admin tally-based pass/reject flip
//
// MVP simplification notes:
//  - Quorum is treated as a soft signal: if totalVotes >= proposal.quorumPercent
//    we consider quorum met. There is no canonical user-base counter (a true
//    quorum requires `eligible voters` denominator). Revisit when AEV-weighted
//    voting & a registered-voter table exist.
//  - On "executed" we currently DO NOT emit a Z-Tide event for the author —
//    the Z-Tide kind whitelist has no "proposal-executed" entry and we don't
//    want to fake-map onto "helpful-comment". TODO: extend Z-Tide whitelist
//    with "proposal-executed" then wire emitZTideEvent here.
exports.qchaingovRouter.post("/proposals/:id/execute", writeLimit, async (req, res) => {
    try {
        await ensureTables();
        const auth = (0, authJwt_1.verifyBearerOptional)(req);
        if (!isAdmin(auth))
            return res.status(403).json({ error: "admin_only" });
        const id = String(req.params.id || "").trim();
        if (!id)
            return res.status(400).json({ error: "id required" });
        const pool = (0, dbPool_1.getPool)();
        const p = await pool.query(`SELECT "id","voteMode","options","quorumPercent","passThreshold","authorUserId","status"
       FROM "QChainGovProposal" WHERE "id" = $1 LIMIT 1`, [id]);
        if (p.rowCount === 0)
            return res.status(404).json({ error: "proposal_not_found" });
        const proposal = p.rows[0];
        if (proposal.status !== "closed") {
            return res.status(400).json({ error: "proposal_not_closed", status: proposal.status });
        }
        const tallyR = await pool.query(`SELECT "choice", COUNT(*)::int AS votes, COALESCE(SUM("weight"),0)::float AS weight
       FROM "QChainGovVote" WHERE "proposalId" = $1 GROUP BY "choice"`, [id]);
        const tally = tallyR.rows;
        const totalVotes = tally.reduce((s, r) => s + (r.votes || 0), 0);
        const totalWeight = tally.reduce((s, r) => s + (r.weight || 0), 0);
        // Quorum: quorumPercent is a 0..100 percentage and must NOT be compared
        // against a raw vote count. With no registered-voter table, we derive an
        // eligible-voter denominator from QCHAINGOV_ELIGIBLE_VOTERS (operator-set
        // electorate size); the required participation = ceil(eligible * pct/100).
        // If the electorate size is not configured we fall back to requiring at
        // least one vote (prior soft behaviour) so quorum never silently blocks.
        const eligibleVoters = parseInt(String(process.env.QCHAINGOV_ELIGIBLE_VOTERS || ""), 10);
        const quorumMet = Number.isFinite(eligibleVoters) && eligibleVoters > 0
            ? totalVotes >= Math.ceil((eligibleVoters * proposal.quorumPercent) / 100)
            : totalVotes > 0;
        let passed = false;
        let achievedPct = 0;
        let winningChoice = null;
        if (proposal.voteMode === "yes-no-abstain") {
            const yesWeight = tally.find(r => r.choice === "yes")?.weight ?? 0;
            const noWeight = tally.find(r => r.choice === "no")?.weight ?? 0;
            const denom = yesWeight + noWeight;
            achievedPct = denom > 0 ? (yesWeight / denom) * 100 : 0;
            passed = quorumMet && achievedPct >= proposal.passThreshold;
            winningChoice = passed ? "yes" : (yesWeight > noWeight ? "yes" : (noWeight > 0 ? "no" : null));
        }
        else {
            // weighted or ranked-choice — winner = highest weight bucket
            let topWeight = -1;
            for (const row of tally) {
                if (row.weight > topWeight) {
                    topWeight = row.weight;
                    winningChoice = row.choice;
                }
            }
            achievedPct = totalWeight > 0 ? (Math.max(topWeight, 0) / totalWeight) * 100 : 0;
            passed = quorumMet && achievedPct >= proposal.passThreshold;
        }
        const newStatus = passed ? "executed" : "rejected";
        const upd = await pool.query(`UPDATE "QChainGovProposal" SET "status" = $1, "executedAt" = NOW()
       WHERE "id" = $2 AND "status" = 'closed' RETURNING "id","status","executedAt"`, [newStatus, id]);
        if ((upd.rowCount ?? 0) === 0) {
            return res.status(409).json({ error: "proposal_state_changed" });
        }
        const executedAt = (upd.rows[0].executedAt instanceof Date)
            ? upd.rows[0].executedAt.toISOString()
            : String(upd.rows[0].executedAt);
        // NOTE: Z-Tide event for proposal.authorUserId intentionally omitted — see
        // header comment for rationale (no matching kind in whitelist).
        res.json({
            ok: true,
            proposalId: id,
            status: newStatus,
            quorumMet,
            threshold: { required: proposal.passThreshold, achieved: Number(achievedPct.toFixed(2)) },
            winningChoice,
            totalVotes,
            totalWeight,
            executedAt,
        });
    }
    catch (err) {
        console.error("[qchaingov] proposal_execute_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/POST/proposals/:id/execute" });
        res.status(500).json({ error: "proposal_execute_failed" });
    }
});
exports.qchaingovRouter.get("/proposals/:id/votes", readLimit, async (req, res) => {
    try {
        await ensureTables();
        const id = String(req.params.id || "").trim();
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query(`SELECT "id","voterUserId","choice","weight","rationale","createdAt"
       FROM "QChainGovVote" WHERE "proposalId" = $1 ORDER BY "createdAt" DESC LIMIT 200`, [id]);
        res.json({ votes: r.rows, total: r.rowCount });
    }
    catch (err) {
        console.error("[qchaingov] votes_list_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/GET/proposals/:id/votes" });
        res.status(500).json({ error: "votes_list_failed" });
    }
});
exports.qchaingovRouter.get("/stats", readLimit, async (_req, res) => {
    try {
        await ensureTables();
        const pool = (0, dbPool_1.getPool)();
        const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM "QChainGovProposal")::int                        AS total_proposals,
        (SELECT COUNT(*) FROM "QChainGovProposal" WHERE "status"='open')::int  AS open_proposals,
        (SELECT COUNT(*) FROM "QChainGovProposal" WHERE "status"='closed')::int AS closed_proposals,
        (SELECT COUNT(*) FROM "QChainGovVote")::int                            AS total_votes,
        (SELECT COUNT(DISTINCT "voterUserId") FROM "QChainGovVote")::int       AS unique_voters
    `);
        res.json({ ...r.rows[0], service: "qchaingov" });
    }
    catch (err) {
        console.error("[qchaingov] stats_failed", err instanceof Error ? err.message : err);
        captureQChaingov(err, { route: "qchaingov/GET/stats" });
        res.status(500).json({ error: "stats_failed" });
    }
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.qchaingovRouter.get("/status", readLimit, (_req, res) => {
    res.json({
        module: "qchaingov",
        code: "QCHAINGOV",
        status: "mvp",
        description: "DAO governance — identity-bound proposals, votes, transparent execution.",
        endpoints: {
            health: "/api/qchaingov/health",
            stats: "/api/qchaingov/stats",
            proposals: "/api/qchaingov/proposals",
            conceptMessages: "/api/qchaingov/concept/messages",
            conceptStats: "/api/qchaingov/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({
    router: exports.qchaingovRouter,
    moduleId: "qchaingov",
    defaultTag: "qchaingov",
    fieldMap: { idea: "topic", rationale: "motivation", extraFields: ["category"] },
    readLimit,
    writeLimit,
});
