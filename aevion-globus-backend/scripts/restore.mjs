#!/usr/bin/env node
// Restore a previously taken snapshot back into AEVION_DATA_DIR. The current
// state is *itself* snapshotted into <stamp>.pre-restore/ before being
// overwritten, so the operation is reversible.
//
// Usage:
//   node scripts/restore.mjs <timestamp>          # interactive confirm
//   node scripts/restore.mjs <timestamp> --yes    # skip confirm (CI/scripts)
//   node scripts/restore.mjs --list               # list available snapshots
//
// Env:
//   AEVION_DATA_DIR     destination dir (default: <cwd>/.aevion-data)
//   AEVION_BACKUP_DIR   backup root (default: <cwd>/.aevion-backups)

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function tsUtc() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}Z`;
}

async function listSnapshots(backupRoot) {
  try {
    const all = (await fs.readdir(backupRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    return all;
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function copyJsonFiles(srcDir, dstDir) {
  await fs.mkdir(dstDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  let n = 0;
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".json") || e.name === "_manifest.json") continue;
    await fs.copyFile(path.join(srcDir, e.name), path.join(dstDir, e.name));
    n++;
  }
  return n;
}

async function main() {
  const argv = process.argv.slice(2);
  const dataDir = path.resolve(process.env.AEVION_DATA_DIR || path.join(process.cwd(), ".aevion-data"));
  const backupRoot = path.resolve(process.env.AEVION_BACKUP_DIR || path.join(process.cwd(), ".aevion-backups"));

  if (argv[0] === "--list" || argv.length === 0) {
    const all = await listSnapshots(backupRoot);
    if (all.length === 0) {
      console.log(`[restore] no snapshots in ${backupRoot}`);
      process.exit(0);
    }
    console.log(`[restore] ${all.length} snapshot(s) in ${backupRoot}:`);
    for (const s of all) console.log(`  · ${s}`);
    if (argv.length === 0) {
      console.log(`\nUsage: node scripts/restore.mjs <timestamp> [--yes]`);
    }
    process.exit(0);
  }

  const stamp = argv[0];
  const yes = argv.includes("--yes");
  const srcDir = path.join(backupRoot, stamp);

  try {
    await fs.access(srcDir);
  } catch {
    console.error(`[restore] snapshot not found: ${srcDir}`);
    process.exit(1);
  }

  if (!yes) {
    console.log(`[restore] about to overwrite ${dataDir} with ${srcDir}`);
    console.log(`[restore] re-run with --yes to confirm.`);
    process.exit(2);
  }

  // Snapshot current state first so this is reversible.
  const preStamp = `${tsUtc()}.pre-restore`;
  const preDir = path.join(backupRoot, preStamp);
  let preserved = 0;
  try {
    preserved = await copyJsonFiles(dataDir, preDir);
    if (preserved === 0) {
      // Nothing to preserve; clean up the empty directory.
      await fs.rm(preDir, { recursive: true, force: true });
    } else {
      console.log(`[restore] preserved ${preserved} current file(s) → ${preDir}`);
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }

  const restored = await copyJsonFiles(srcDir, dataDir);
  console.log(`[restore] restored ${restored} file(s) from ${stamp} → ${dataDir}`);
}

main().catch((e) => {
  console.error("[restore] failed:", e?.message || e);
  process.exit(1);
});
