import { Router } from "express";
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

export const buildRouter = Router();

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

buildRouter.use("/", profilesRouter);
buildRouter.use("/projects", projectsRouter);
buildRouter.use("/vacancies", vacanciesRouter);
buildRouter.use("/applications", applicationsRouter);
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
buildRouter.use("/leads", leadsRouter);
buildRouter.use("/health", healthRouter);
