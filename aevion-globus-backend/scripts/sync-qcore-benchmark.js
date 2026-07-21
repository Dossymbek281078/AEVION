#!/usr/bin/env node
/**
 * Copies the curated `historical` benchmark entries from
 * docs/benchmarks/qcore-eval-latest.json into a co-located JSON file inside
 * the frontend package (frontend/src/app/qcoreai/vs/benchmark.json), so the
 * /qcoreai/vs comparison page can import real numbers instead of typing them
 * into data.ts by hand.
 *
 * A cross-package import (frontend importing ../../../docs/...) is fragile
 * under Next.js/Vercel, which may not trace files outside the frontend
 * project root -- copying into the frontend tree at sync time sidesteps that
 * without needing a monorepo build-tool change.
 *
 * Run manually after curating a new `historical` entry, or via CI
 * (.github/workflows/qcore-benchmark.yml) after every qcore-eval.js run --
 * harmless no-op when `historical` hasn't changed.
 *
 * Usage: node scripts/sync-qcore-benchmark.js
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "docs", "benchmarks", "qcore-eval-latest.json");
const DEST = path.join(__dirname, "..", "..", "frontend", "src", "app", "qcoreai", "vs", "benchmark.json");

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const historical = Array.isArray(raw.historical) ? raw.historical : [];

fs.writeFileSync(DEST, JSON.stringify(historical, null, 2) + "\n");
console.log(`Synced ${historical.length} historical benchmark entr${historical.length === 1 ? "y" : "ies"} to frontend/src/app/qcoreai/vs/benchmark.json`);
