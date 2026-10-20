"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const build_1 = require("../lib/build");
// v1 sub-routers
const profiles_1 = require("./build/profiles");
const projects_1 = require("./build/projects");
const vacancies_1 = require("./build/vacancies");
const applications_1 = require("./build/applications");
const messaging_1 = require("./build/messaging");
const trial_tasks_1 = require("./build/trial-tasks");
const bookmarks_1 = require("./build/bookmarks");
const billing_1 = require("./build/billing");
const ai_1 = require("./build/ai");
const reviews_1 = require("./build/reviews");
const loyalty_1 = require("./build/loyalty");
const referrals_1 = require("./build/referrals");
const stats_1 = require("./build/stats");
const admin_1 = require("./build/admin");
const leads_1 = require("./build/leads");
const health_1 = require("./build/health");
const alerts_1 = require("./build/alerts");
const verification_1 = require("./build/verification");
const public_1 = require("./build/public");
const settings_1 = require("./build/settings");
const salary_stats_1 = require("./build/salary-stats");
const availability_1 = require("./build/availability");
const stories_1 = require("./build/stories");
const shifts_1 = require("./build/shifts");
const team_hiring_1 = require("./build/team-hiring");
const interviews_1 = require("./build/interviews");
const skill_badges_1 = require("./build/skill-badges");
const references_1 = require("./build/references");
const payment_calendar_1 = require("./build/payment-calendar");
const push_1 = require("./build/push");
const contracts_1 = require("./build/contracts");
const documents_1 = require("./build/documents");
const portfolio_photos_1 = require("./build/portfolio-photos");
const safety_briefing_1 = require("./build/safety-briefing");
const communities_1 = require("./build/communities");
const video_rooms_1 = require("./build/video-rooms");
exports.buildRouter = (0, express_1.Router)();
const globalLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "rate_limit_exceeded" } });
const messageLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "message_rate_limit_exceeded" } });
const leadsLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "leads_rate_limit_exceeded" } });
const applyLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "apply_rate_limit_exceeded" } });
const communityMsgLimiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, error: "community_rate_limit_exceeded" } });
exports.buildRouter.use(async (_req, res, next) => {
    try {
        await (0, build_1.ensureBuildTables)();
        void (0, build_1.maybeCleanupExpiredBoosts)();
        next();
    }
    catch (err) {
        console.error("[build] ensureBuildTables failed:", err);
        (0, build_1.fail)(res, 500, "build_init_failed");
    }
});
exports.buildRouter.use(globalLimiter);
// ── v1 routes ──────────────────────────────────────────────────────────
exports.buildRouter.use("/", profiles_1.profilesRouter);
exports.buildRouter.use("/projects", projects_1.projectsRouter);
exports.buildRouter.use("/vacancies", vacancies_1.vacanciesRouter);
exports.buildRouter.post("/applications", applyLimiter);
exports.buildRouter.use("/applications", applications_1.applicationsRouter);
exports.buildRouter.post("/messages", messageLimiter);
exports.buildRouter.use("/", messaging_1.messagingRouter);
exports.buildRouter.use("/trial-tasks", trial_tasks_1.trialTasksRouter);
exports.buildRouter.use("/bookmarks", bookmarks_1.bookmarksRouter);
exports.buildRouter.use("/", billing_1.billingRouter);
exports.buildRouter.use("/ai", ai_1.aiRouter);
exports.buildRouter.use("/reviews", reviews_1.reviewsRouter);
exports.buildRouter.use("/loyalty", loyalty_1.loyaltyRouter);
exports.buildRouter.use("/referrals", referrals_1.referralsRouter);
exports.buildRouter.use("/stats", stats_1.statsRouter);
exports.buildRouter.use("/admin", admin_1.adminRouter);
exports.buildRouter.post("/leads", leadsLimiter);
exports.buildRouter.use("/leads", leads_1.leadsRouter);
exports.buildRouter.use("/health", health_1.healthRouter);
exports.buildRouter.use("/alerts", alerts_1.alertsRouter);
exports.buildRouter.use("/verification", verification_1.verificationRouter);
exports.buildRouter.use("/public", public_1.publicRouter);
exports.buildRouter.use("/settings", settings_1.settingsRouter);
exports.buildRouter.use("/salary-stats", salary_stats_1.salaryStatsRouter);
exports.buildRouter.use("/availability", availability_1.availabilityRouter);
exports.buildRouter.use("/stories", stories_1.storiesRouter);
exports.buildRouter.use("/shifts", shifts_1.shiftsRouter);
exports.buildRouter.use("/team-requests", team_hiring_1.teamHiringRouter);
exports.buildRouter.use("/interviews", interviews_1.interviewsRouter);
exports.buildRouter.use("/", skill_badges_1.skillBadgesRouter);
exports.buildRouter.use("/", references_1.referencesRouter);
exports.buildRouter.use("/payment-calendar", payment_calendar_1.paymentCalendarRouter);
exports.buildRouter.use("/push", push_1.pushRouter);
// QSign-backed contract generation — mounts under /applications so
// POST /applications/:id/contract is the full path. No new tables.
exports.buildRouter.use("/applications", contracts_1.contractsRouter);
// Document verification — PENDING→VERIFIED|REJECTED workflow. New
// BuildDocument table declared in lib/build/index.ts.
exports.buildRouter.use("/documents", documents_1.documentsRouter);
// Work-site portfolio photos — public gallery on worker profile. New
// BuildPortfolioPhoto table in lib/build/index.ts.
exports.buildRouter.use("/portfolio/photos", portfolio_photos_1.portfolioPhotosRouter);
// Pre-shift safety briefing sign-off. New BuildSafetyBriefing table.
exports.buildRouter.use("/safety-briefing", safety_briefing_1.safetyBriefingRouter);
// Community topical chat rooms. Tables were bootstrapped in #146 and
// are already in the schema; the mount was accidentally dropped in
// 0445a81c (skill-tests squash). Rate-limit only message POSTs.
exports.buildRouter.post("/communities/:slug/messages", communityMsgLimiter);
exports.buildRouter.use("/communities", communities_1.communitiesRouter);
// Video rooms — Daily.co-backed. Bootstrapped in #147, mount dropped
// in 0445a81c. DAILY_API_KEY optional — stub URL returned without it.
exports.buildRouter.use("/video/rooms", video_rooms_1.videoRoomsRouter);
