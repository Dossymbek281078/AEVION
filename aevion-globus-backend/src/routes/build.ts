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
import { availabilityRouter } from "./build/availability";
import { storiesRouter } from "./build/stories";
import { shiftsRouter } from "./build/shifts";
import { teamHiringRouter } from "./build/team-hiring";
import { interviewsRouter } from "./build/interviews";
import { skillBadgesRouter } from "./build/skill-badges";
import { referencesRouter } from "./build/references";
import { paymentCalendarRouter } from "./build/payment-calendar";
import { pushRouter } from "./build/push";
import { contractsRouter } from "./build/contracts";
import { documentsRouter } from "./build/documents";
import { portfolioPhotosRouter } from "./build/portfolio-photos";
import { safetyBriefingRouter } from "./build/safety-briefing";
import { communitiesRouter } from "./build/communities";
import { videoRoomsRouter } from "./build/video-rooms";

export const buildRouter = Router();

const globalLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "rate_limit_exceeded" } });
const messageLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "message_rate_limit_exceeded" } });
const leadsLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "leads_rate_limit_exceeded" } });
const applyLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "apply_rate_limit_exceeded" } });
const communityMsgLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "community_rate_limit_exceeded" } });

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
buildRouter.use("/salary-stats", salaryStatsRouter);
buildRouter.use("/availability", availabilityRouter);
buildRouter.use("/stories", storiesRouter);
buildRouter.use("/shifts", shiftsRouter);
buildRouter.use("/team-requests", teamHiringRouter);
buildRouter.use("/interviews", interviewsRouter);
buildRouter.use("/", skillBadgesRouter);
buildRouter.use("/", referencesRouter);
buildRouter.use("/payment-calendar", paymentCalendarRouter);
buildRouter.use("/push", pushRouter);
// QSign-backed contract generation — mounts under /applications so
// POST /applications/:id/contract is the full path. No new tables.
buildRouter.use("/applications", contractsRouter);
// Document verification — PENDING→VERIFIED|REJECTED workflow. New
// BuildDocument table declared in lib/build/index.ts.
buildRouter.use("/documents", documentsRouter);
// Work-site portfolio photos — public gallery on worker profile. New
// BuildPortfolioPhoto table in lib/build/index.ts.
buildRouter.use("/portfolio/photos", portfolioPhotosRouter);
// Pre-shift safety briefing sign-off. New BuildSafetyBriefing table.
buildRouter.use("/safety-briefing", safetyBriefingRouter);
// Community topical chat rooms. Tables were bootstrapped in #146 and
// are already in the schema; the mount was accidentally dropped in
// 0445a81c (skill-tests squash). Rate-limit only message POSTs.
buildRouter.post("/communities/:slug/messages", communityMsgLimiter);
buildRouter.use("/communities", communitiesRouter);
// Video rooms — Daily.co-backed. Bootstrapped in #147, mount dropped
// in 0445a81c. DAILY_API_KEY optional — stub URL returned without it.
buildRouter.use("/video/rooms", videoRoomsRouter);
