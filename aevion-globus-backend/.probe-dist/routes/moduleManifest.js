"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTRA_MOUNTS = void 0;
const qevents_1 = require("./qevents");
const qventure_1 = require("./qventure");
const qskyway_1 = require("./qskyway");
const qreal_1 = require("./qreal");
const dataQuality_1 = require("./dataQuality");
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
exports.EXTRA_MOUNTS = [
    { path: "/api/qventure", router: qventure_1.qventureRouter },
    { path: "/api/qskyway", router: qskyway_1.qskywayRouter },
    { path: "/api/qevents", router: qevents_1.qeventsRouter },
    { path: "/api/qreal", router: qreal_1.qrealRouter },
    // Platform-wide data-provenance / AEVION Trust Score (not a module gate).
    { path: "/api/data-quality", router: dataQuality_1.dataQualityRouter },
];
