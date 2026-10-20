"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitServerReport = submitServerReport;
const express_1 = require("express");
const rateLimit_1 = require("../lib/rateLimit");
const node_crypto_1 = require("node:crypto");
// Обычный импорт, а не require: под `require` подмена драйвера в тестах не
// действует — хранилище выглядит недоступным, и тест проходит, не выполнив ни
// одного запроса. Последний шахматный файл, где оставалась эта форма (12.08).
const pg_1 = __importDefault(require("pg"));
// ── Storage ───────────────────────────────────────────────────────────────────
//
// In-memory Map stays the primary read path (unchanged behaviour, zero
// regression risk) — MAX_REPORTS bounds it and it always worked this way.
// Postgres is added purely as a durability layer: reports used to vanish on
// every Railway redeploy (this store had no persistence at all), which
// matters a lot more now that submitServerReport() feeds it unspoofable
// server-computed signals worth keeping. Write-through, non-blocking, silent
// no-op on any DB error — same pattern as cyberchessMatchStore.ts.
const MAX_REPORTS = 500;
const MAX_PER_USER = 20;
// keyed by reportId
const allReports = new Map();
// keyed by userId → array of reportIds sorted by analysedAt DESC
const byUser = new Map();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool = null;
let dbReady = false;
let dbInitTried = false;
/**
 * Кулдаун вместо защёлки — по той же причине, что и в хранилище партий
 * (19.08.2026). Раньше одна неудачная попытка при первом отчёте выключала базу
 * до перезапуска процесса, и отчёты античита жили только в памяти: снаружи это
 * выглядело как работающий модуль.
 */
const AC_DB_INIT_RETRY_MS = Number(process.env.CYBERCHESS_DB_INIT_RETRY_MS ?? 30000);
let dbInitNextTryAt = 0;
async function ensureDb() {
    if (dbReady)
        return;
    if (Date.now() < dbInitNextTryAt)
        return;
    dbInitTried = true;
    dbInitNextTryAt = Date.now() + AC_DB_INIT_RETRY_MS;
    if (!process.env.DATABASE_URL)
        return;
    try {
        const p = new pg_1.default.Pool({ connectionString: process.env.DATABASE_URL });
        await p.query(`
      CREATE TABLE IF NOT EXISTS "CyberAnticheatReport" (
        "reportId"       TEXT PRIMARY KEY,
        "gameId"         TEXT,
        "userId"         TEXT NOT NULL,
        "source"         TEXT NOT NULL DEFAULT 'client',
        "verdict"        TEXT NOT NULL,
        "suspicionScore" DOUBLE PRECISION NOT NULL,
        "confidence"     TEXT NOT NULL,
        "fideEstimate"   DOUBLE PRECISION,
        "stats"          JSONB NOT NULL,
        "ip"             TEXT,
        "analysedAt"     TIMESTAMPTZ NOT NULL,
        "storedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "cyberanticheat_user_idx" ON "CyberAnticheatReport" ("userId","analysedAt" DESC);
      CREATE INDEX IF NOT EXISTS "cyberanticheat_flag_idx" ON "CyberAnticheatReport" ("verdict","suspicionScore" DESC);
    `);
        pool = p;
        dbReady = true;
        console.log("[CyberAnticheat] pg connected — report persistence ready");
    }
    catch (e) {
        console.warn("[CyberAnticheat] pg init failed:", e instanceof Error ? e.message : e);
    }
}
async function persistReport(report) {
    // Зовём всегда: решение «пробовать ли сейчас» принимает сам ensureDb по
    // кулдауну. Прежнее условие с dbInitTried делало повтор невозможным.
    if (!dbReady)
        await ensureDb();
    if (!dbReady || !pool)
        return;
    try {
        await pool.query(`INSERT INTO "CyberAnticheatReport"
         ("reportId","gameId","userId","source","verdict","suspicionScore","confidence","fideEstimate","stats","ip","analysedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,to_timestamp($11/1000.0))
       ON CONFLICT ("reportId") DO NOTHING`, [
            report.reportId,
            report.gameId ?? null,
            report.userId,
            report.source,
            report.verdict,
            report.suspicionScore,
            report.confidence,
            report.fideEstimate,
            JSON.stringify(report.stats),
            report.ip,
            report.analysedAt,
        ]);
    }
    catch (e) {
        console.warn("[CyberAnticheat] persist failed:", e instanceof Error ? e.message : e);
    }
}
// ── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = 10;
const rateLimiter = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const hits = (rateLimiter.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
    if (hits.length >= RATE_LIMIT)
        return true;
    hits.push(now);
    rateLimiter.set(ip, hits);
    return false;
}
// ── Helpers ───────────────────────────────────────────────────────────────────
const VERDICTS = ["clean", "unusual", "suspicious", "flagged"];
const CONFIDENCES = ["insufficient", "low", "medium", "high"];
// Reads req.ip through the shared helper. This used to take the LEFTMOST
// X-Forwarded-For entry, which a proxy never writes — the caller does. Varying
// that header per request handed every request its own bucket, so the limit
// below could not fire while looking, from outside, exactly like one that works.
function getIp(req) {
    return (0, rateLimit_1.clientIp)(req);
}
function evictOldestIfFull() {
    if (allReports.size < MAX_REPORTS)
        return;
    // drop oldest by storedAt
    let oldest = null;
    for (const r of allReports.values()) {
        if (!oldest || r.storedAt < oldest.storedAt)
            oldest = r;
    }
    if (!oldest)
        return;
    allReports.delete(oldest.reportId);
    const ids = byUser.get(oldest.userId);
    if (ids) {
        const filtered = ids.filter(id => id !== oldest.reportId);
        if (filtered.length)
            byUser.set(oldest.userId, filtered);
        else
            byUser.delete(oldest.userId);
    }
}
/** Shared write path for both the client-facing POST /report and internal server reports. */
function storeReport(report) {
    evictOldestIfFull();
    allReports.set(report.reportId, report);
    const ids = byUser.get(report.userId) ?? [];
    ids.unshift(report.reportId); // newest first
    byUser.set(report.userId, ids);
    void persistReport(report).catch(() => { });
}
/**
 * Internal entry point for server-computed signals (e.g. the move-time
 * analysis submitted from cyberchessMatchmaking.ts's settleMatch()). Bypasses
 * HTTP/IP-rate-limiting — this is a trusted same-process call, not
 * attacker-reachable — and always tags `source: 'server'` so downstream
 * readers (`/flagged`, `/stats/:userId`) can weight it above self-reported
 * client signals.
 *
 * `stats` fields the server can't compute (engine-agreement/CPL — no
 * server-side engine exists yet, see the "server-side engine analysis" scope
 * note) are filled with neutral zero defaults rather than omitted, so this
 * reuses the exact same StoredReport shape the client report already writes.
 */
function submitServerReport(input) {
    if (input.confidence === "insufficient")
        return;
    const report = {
        gameId: input.gameId,
        userId: input.userId,
        verdict: input.verdict,
        suspicionScore: input.suspicionScore,
        confidence: input.confidence,
        fideEstimate: null,
        stats: {
            diagnosticMoves: input.diagnosticMoves,
            top1Rate: 0,
            avgCpl: 0,
            intrinsicRating: 0,
            ratingDiscrepancy: 0,
            zScore: 0,
            timeCoV: input.timeCoV,
            longestTop1Streak: 0,
            instantMoves: input.instantMoves,
        },
        analysedAt: Date.now(),
        reportId: (0, node_crypto_1.randomUUID)(),
        ip: "server",
        storedAt: Date.now(),
        source: "server",
    };
    storeReport(report);
}
// ── Router ────────────────────────────────────────────────────────────────────
const router = (0, express_1.Router)();
// POST /report
router.post("/report", (req, res) => {
    const ip = getIp(req);
    if (isRateLimited(ip)) {
        res.status(429).json({ ok: false, error: "Rate limit exceeded" });
        return;
    }
    const body = req.body;
    if (!body.userId || typeof body.userId !== "string") {
        res.status(400).json({ ok: false, error: "userId required" });
        return;
    }
    if (!VERDICTS.includes(body.verdict)) {
        res.status(400).json({ ok: false, error: "Invalid verdict" });
        return;
    }
    if (typeof body.suspicionScore !== "number" || body.suspicionScore < 0 || body.suspicionScore > 100) {
        res.status(400).json({ ok: false, error: "suspicionScore must be 0-100" });
        return;
    }
    if (!CONFIDENCES.includes(body.confidence)) {
        res.status(400).json({ ok: false, error: "Invalid confidence" });
        return;
    }
    if (body.confidence === "insufficient") {
        res.json({ ok: true, stored: false });
        return;
    }
    const report = {
        ...body,
        reportId: (0, node_crypto_1.randomUUID)(),
        ip,
        storedAt: Date.now(),
        source: "client",
    };
    storeReport(report);
    res.json({ ok: true, stored: true });
});
// GET /stats/:userId
router.get("/stats/:userId", (req, res) => {
    const userId = String(req.params.userId ?? "");
    const ids = byUser.get(userId) ?? [];
    const reports = ids
        .map(id => allReports.get(id))
        .filter((r) => !!r)
        .sort((a, b) => b.analysedAt - a.analysedAt)
        .slice(0, MAX_PER_USER);
    // Вердикт складывается ТОЛЬКО из серверных сигналов.
    //
    // Клиентский отчёт присылает браузер, и в нём произвольный userId: кто угодно
    // мог отправить «flagged» про любого игрока, и это попадало в его статистику
    // наравне с измерениями сервера. Соседняя админская ручка /flagged прямо
    // пишет, что серверные сигналы «unspoofable, a cheating client can't fake or
    // suppress them» — то есть про клиентские там уже знали, а здесь считали
    // вровень. Обвинение, которое может выписать любой прохожий, не должно
    // выглядеть как вывод системы.
    const serverReports = reports.filter(r => r.source === "server");
    const clientReports = reports.filter(r => r.source !== "server");
    const totalGames = serverReports.length;
    const flaggedGames = serverReports.filter(r => r.verdict === "flagged").length;
    const suspiciousGames = serverReports.filter(r => r.verdict === "suspicious").length;
    const avgSuspicionScore = totalGames
        ? Math.round(serverReports.reduce((s, r) => s + r.suspicionScore, 0) / totalGames)
        : 0;
    const latestVerdict = serverReports[0]?.verdict ?? "none";
    // Клиентские отчёты не выбрасываем — они полезны как сигнал, — но называем
    // тем, что они есть: непроверенные заявления.
    const unverified = {
        total: clientReports.length,
        flagged: clientReports.filter(r => r.verdict === "flagged").length,
        suspicious: clientReports.filter(r => r.verdict === "suspicious").length,
    };
    // Наружу — без поля `ip`. Оно попадало в ПУБЛИЧНЫЙ ответ: по номеру игрока
    // можно было прочитать адреса тех, чьи браузеры присылали отчёты. Хранить его
    // для разбора злоупотреблений нормально, отдавать всем — нет.
    const publicReports = reports.map(({ ip: _ip, ...rest }) => rest);
    res.json({
        ok: true,
        userId,
        reports: publicReports,
        summary: {
            totalGames,
            flaggedGames,
            suspiciousGames,
            avgSuspicionScore,
            latestVerdict,
            unverified,
        },
    });
});
// GET /flagged  (admin)
router.get("/flagged", (req, res) => {
    const adminKey = process.env.CYBERCHESS_ADMIN_KEY;
    if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
        res.status(403).json({ ok: false, error: "Forbidden" });
        return;
    }
    const reports = [...allReports.values()]
        .filter(r => r.verdict === "flagged" || r.verdict === "suspicious")
        // Server-sourced signals first (unspoofable — a cheating client can't
        // fake or suppress them), then by suspicion score within each group.
        .sort((a, b) => {
        if (a.source !== b.source)
            return a.source === "server" ? -1 : 1;
        return b.suspicionScore - a.suspicionScore;
    })
        .slice(0, 100);
    res.json({ ok: true, reports, total: reports.length });
});
// GET /health
router.get("/health", (_req, res) => {
    const flaggedCount = [...allReports.values()].filter(r => r.verdict === "flagged" || r.verdict === "suspicious").length;
    res.json({ ok: true, totalReports: allReports.size, flaggedCount });
});
exports.default = router;
