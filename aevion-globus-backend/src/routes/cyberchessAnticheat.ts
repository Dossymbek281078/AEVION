import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

type Verdict = "clean" | "unusual" | "suspicious" | "flagged";
type Confidence = "insufficient" | "low" | "medium" | "high";

interface ReportBody {
  gameId?: string;
  userId: string;
  verdict: Verdict;
  suspicionScore: number;
  confidence: Confidence;
  fideEstimate: number | null;
  stats: {
    diagnosticMoves: number;
    top1Rate: number;
    avgCpl: number;
    intrinsicRating: number;
    ratingDiscrepancy: number;
    zScore: number;
    timeCoV: number;
    longestTop1Streak: number;
  };
  analysedAt: number;
}

interface StoredReport extends ReportBody {
  reportId: string;
  ip: string;
  storedAt: number;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const MAX_REPORTS = 500;
const MAX_PER_USER = 20;

// keyed by reportId
const allReports = new Map<string, StoredReport>();
// keyed by userId → array of reportIds sorted by analysedAt DESC
const byUser = new Map<string, string[]>();

// ── Rate limiting ─────────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;
const rateLimiter = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLimiter.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) return true;
  hits.push(now);
  rateLimiter.set(ip, hits);
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VERDICTS: Verdict[] = ["clean", "unusual", "suspicious", "flagged"];
const CONFIDENCES: Confidence[] = ["insufficient", "low", "medium", "high"];

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

function evictOldestIfFull(): void {
  if (allReports.size < MAX_REPORTS) return;
  // drop oldest by storedAt
  let oldest: StoredReport | null = null;
  for (const r of allReports.values()) {
    if (!oldest || r.storedAt < oldest.storedAt) oldest = r;
  }
  if (!oldest) return;
  allReports.delete(oldest.reportId);
  const ids = byUser.get(oldest.userId);
  if (ids) {
    const filtered = ids.filter(id => id !== oldest!.reportId);
    if (filtered.length) byUser.set(oldest.userId, filtered);
    else byUser.delete(oldest.userId);
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// POST /report
router.post("/report", (req: Request, res: Response) => {
  const ip = getIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false, error: "Rate limit exceeded" });
    return;
  }

  const body = req.body as Partial<ReportBody>;

  if (!body.userId || typeof body.userId !== "string") {
    res.status(400).json({ ok: false, error: "userId required" });
    return;
  }
  if (!VERDICTS.includes(body.verdict as Verdict)) {
    res.status(400).json({ ok: false, error: "Invalid verdict" });
    return;
  }
  if (typeof body.suspicionScore !== "number" || body.suspicionScore < 0 || body.suspicionScore > 100) {
    res.status(400).json({ ok: false, error: "suspicionScore must be 0-100" });
    return;
  }
  if (!CONFIDENCES.includes(body.confidence as Confidence)) {
    res.status(400).json({ ok: false, error: "Invalid confidence" });
    return;
  }

  if (body.confidence === "insufficient") {
    res.json({ ok: true, stored: false });
    return;
  }

  evictOldestIfFull();

  const report: StoredReport = {
    ...(body as ReportBody),
    reportId: randomUUID(),
    ip,
    storedAt: Date.now(),
  };

  allReports.set(report.reportId, report);

  const ids = byUser.get(report.userId) ?? [];
  ids.unshift(report.reportId); // newest first
  byUser.set(report.userId, ids);

  res.json({ ok: true, stored: true });
});

// GET /stats/:userId
router.get("/stats/:userId", (req: Request, res: Response) => {
  const userId = String(req.params.userId ?? "");
  const ids = byUser.get(userId) ?? [];
  const reports = ids
    .map(id => allReports.get(id))
    .filter((r): r is StoredReport => !!r)
    .sort((a, b) => b.analysedAt - a.analysedAt)
    .slice(0, MAX_PER_USER);

  const totalGames = reports.length;
  const flaggedGames = reports.filter(r => r.verdict === "flagged").length;
  const suspiciousGames = reports.filter(r => r.verdict === "suspicious").length;
  const avgSuspicionScore = totalGames
    ? Math.round(reports.reduce((s, r) => s + r.suspicionScore, 0) / totalGames)
    : 0;
  const latestVerdict = reports[0]?.verdict ?? "none";

  res.json({
    ok: true,
    userId,
    reports,
    summary: { totalGames, flaggedGames, suspiciousGames, avgSuspicionScore, latestVerdict },
  });
});

// GET /flagged  (admin)
router.get("/flagged", (req: Request, res: Response) => {
  const adminKey = process.env.CYBERCHESS_ADMIN_KEY;
  if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
    res.status(403).json({ ok: false, error: "Forbidden" });
    return;
  }

  const reports = [...allReports.values()]
    .filter(r => r.verdict === "flagged" || r.verdict === "suspicious")
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .slice(0, 100);

  res.json({ ok: true, reports, total: reports.length });
});

// GET /health
router.get("/health", (_req: Request, res: Response) => {
  const flaggedCount = [...allReports.values()].filter(
    r => r.verdict === "flagged" || r.verdict === "suspicious"
  ).length;
  res.json({ ok: true, totalReports: allReports.size, flaggedCount });
});

export default router;
