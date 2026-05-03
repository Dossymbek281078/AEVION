import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  fail,
  ensureBuildTables,
  maybeCleanupExpiredBoosts,
} from "../lib/build";
import { profilesRouter } from "./build/profiles";
import { projectsRouter } from "./build/projects";
import { vacanciesRouter } from "./build/vacancies";
import { applicationsRouter } from "./build/applications";
import { messagingRouter } from "./build/messaging";
import { trialTasksRouter } from "./build/trial-tasks";
import { bookmarksRouter } from "./build/bookmarks";
import { billingRouter } from "./build/billing";
import { aiRouter } from "./build/ai";
import { reviewsRouter } from "./build/reviews";
import { loyaltyRouter } from "./build/loyalty";
import { referralsRouter } from "./build/referrals";
import { statsRouter } from "./build/stats";
import { adminRouter } from "./build/admin";
import { leadsRouter } from "./build/leads";
import { healthRouter } from "./build/health";
import { alertsRouter } from "./build/alerts";
import { verificationRouter } from "./build/verification";

export const buildRouter = Router();

// Global: 120 requests per minute per IP across all /api/build/* endpoints.
// Sub-limiter for high-abuse surfaces is applied at the route level below.
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "rate_limit_exceeded" },
});

// Tighter per-IP limits on public/write-heavy endpoints.
// DMs: 30/min — prevents DM spam without blocking normal chat.
const messageLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "message_rate_limit_exceeded" },
});

// Leads: 5/min — public endpoint, protects against bulk scraping/flooding.
const leadsLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "leads_rate_limit_exceeded" },
});

// Applications: 10/min — applying to many vacancies too fast is a red flag.
const applyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "apply_rate_limit_exceeded" },
});

// Ensure tables exist on first request; fire-and-forget boost cleanup.
buildRouter.use(async (_req, res, next) => {
  try {
    await ensureBuildTables();
    void maybeCleanupExpiredBoosts();
    next();
  } catch (err: unknown) {
    console.error("[build] ensureBuildTables failed:", err);
    fail(res, 500, "build_init_failed");
  }
});

buildRouter.use(globalLimiter);

buildRouter.use("/", profilesRouter);
buildRouter.use("/projects", projectsRouter);
buildRouter.use("/vacancies", vacanciesRouter);
// Apply limiter before the router so it fires on POST /applications
buildRouter.post("/applications", applyLimiter);
buildRouter.use("/applications", applicationsRouter);
// Message limiter on POST /messages only (GET thread/inbox is read-only)
buildRouter.post("/messages", messageLimiter);
buildRouter.use("/", messagingRouter);
buildRouter.use("/trial-tasks", trialTasksRouter);
buildRouter.use("/bookmarks", bookmarksRouter);
buildRouter.use("/", billingRouter);
buildRouter.use("/ai", aiRouter);
buildRouter.use("/reviews", reviewsRouter);
buildRouter.use("/loyalty", loyaltyRouter);
buildRouter.use("/referrals", referralsRouter);
buildRouter.use("/stats", statsRouter);
buildRouter.use("/admin", adminRouter);
// Lead limiter on POST /leads only (public endpoint)
buildRouter.post("/leads", leadsLimiter);
buildRouter.use("/leads", leadsRouter);
buildRouter.use("/health", healthRouter);
buildRouter.use("/alerts", alertsRouter);
buildRouter.use("/verification", verificationRouter);
