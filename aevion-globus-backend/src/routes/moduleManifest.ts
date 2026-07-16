import type { Router } from "express";
import { qeventsRouter } from "./qevents";
import { qventureRouter } from "./qventure";
import { qskywayRouter } from "./qskyway";
import { dataQualityRouter } from "./dataQuality";

/**
 * A single module → route-prefix mount.
 */
export type ModuleMount = {
  /** Path prefix (e.g. "/api/qevents") or an array of prefixes. */
  path: string | string[];
  /** The module's Express router. */
  router: Router;
  /** Optional AEVION module id — when set, the mount is gated behind
   *  requireModule(module) exactly like the inline mounts in index.ts. */
  module?: string;
};

/**
 * Append-only module route registry.
 *
 * Why this exists: historically every module registered its routes by adding an
 * `app.use("/api/<id>", ...)` line somewhere in the ~900-line mount section of
 * `index.ts`. Because all 40+ modules edited that ONE file, parallel branches
 * collided on it constantly, and squash-merges silently dropped a module's
 * `app.use()` (see memory: "squash-merge drops mount"). New modules should add
 * ONE entry HERE instead — appends to a list rarely conflict, and a dropped
 * entry is obvious in review.
 *
 * index.ts applies these BEFORE the planning-stub loop, so a dedicated module
 * router wins over the generic /api/<id> status stub, matching the existing
 * convention. Order within this array is preserved.
 *
 * Migration is gradual and safe: the legacy inline mounts in index.ts keep
 * working untouched; move a module here only when you're already editing it and
 * can verify its endpoints. The three below were migrated as the seed.
 */
export const EXTRA_MOUNTS: ModuleMount[] = [
  { path: "/api/qventure", router: qventureRouter },
  { path: "/api/qskyway", router: qskywayRouter },
  { path: "/api/qevents", router: qeventsRouter },
  // Platform-wide data-provenance / AEVION Trust Score (not a module gate).
  { path: "/api/data-quality", router: dataQualityRouter },
];
