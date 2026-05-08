import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  fail,
  ensureBuildTables,
  maybeCleanupExpiredBoosts,
} from "../lib/build";
// v1 sub-routers
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
import { publicRouter } from "./build/public";
import { settingsRouter } from "./build/settings";
import { salaryStatsRouter } from "./build/salary-stats";
import { interviewsRouter } from "./build/interviews";
import { skillBadgesRouter } from "./build/skill-badges";

export const buildRouter = Router();

const globalLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "rate_limit_exceeded" } });
const messageLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "message_rate_limit_exceeded" } });
const leadsLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "leads_rate_limit_exceeded" } });
const applyLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "apply_rate_limit_exceeded" } });
// communityMsgLimiter available for future use
const communityMsgLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "community_rate_limit_exceeded" } });
void communityMsgLimiter;

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

// ── v1 routes ──────────────────────────────────────────────────────────
buildRouter.use("/", profilesRouter);
buildRouter.use("/projects", projectsRouter);
buildRouter.use("/vacancies", vacanciesRouter);
buildRouter.post("/applications", applyLimiter);
buildRouter.use("/applications", applicationsRouter);
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
buildRouter.post("/leads", leadsLimiter);
buildRouter.use("/leads", leadsRouter);
buildRouter.use("/health", healthRouter);
buildRouter.use("/alerts", alertsRouter);
buildRouter.use("/verification", verificationRouter);
buildRouter.use("/public", publicRouter);
buildRouter.use("/settings", settingsRouter);
// Public salary intelligence
buildRouter.use("/salary-stats", salaryStatsRouter);
// Interview scheduling
buildRouter.use("/interviews", interviewsRouter);
// Skill tests + badges (also handles /skill-tests/* + /skill-badges/*)
buildRouter.use("/", skillBadgesRouter);
