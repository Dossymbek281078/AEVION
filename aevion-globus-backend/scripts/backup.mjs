#!/usr/bin/env node
// Snapshot the runtime JSON ledger (qtrade.json, ecosystem.json, ...) into
// .aevion-backups/<UTC-timestamp>/. Copies the whole AEVION_DATA_DIR.
//
// Usage:
//   node scripts/backup.mjs                  # snapshot
//   node scripts/backup.mjs --keep 10        # snapshot + prune to 10 most recent
//   node scripts/backup.mjs --dest /tmp/bak  # snapshot into a custom dir
//
// Env:
//   AEVION_DATA_DIR     source dir (default: <cwd>/.aevion-data)
//   AEVION_BACKUP_DIR   destination root (default: <cwd>/.aevion-backups)

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}

function tsUtc() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}Z`;
}

async function listJson(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function main() {
  const dataDir = path.resolve(process.env.AEVION_DATA_DIR || path.join(process.cwd(), ".aevion-data"));
  const backupRoot = path.resolve(arg("--dest", process.env.AEVION_BACKUP_DIR || path.join(process.cwd(), ".aevion-backups")));
  const keep = Number(arg("--keep", "0")) || 0;

  const files = await listJson(dataDir);
  if (files.length === 0) {
    console.log(`[backup] no .json files found under ${dataDir} — nothing to snapshot`);
    process.exit(0);
  }

  const stamp = tsUtc();
  const targetDir = path.join(backupRoot, stamp);
  await fs.mkdir(targetDir, { recursive: true });

  for (const f of files) {
    await fs.copyFile(path.join(dataDir, f), path.join(targetDir, f));
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceDir: dataDir,
    files,
    backend: "aevion-globus-backend",
  };
  await fs.writeFile(path.join(targetDir, "_manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`[backup] snapshot ${stamp} — ${files.length} file(s) → ${targetDir}`);
  for (const f of files) console.log(`  · ${f}`);

  if (keep > 0) {
    const all = (await fs.readdir(backupRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
      .map((e) => e.name)
      .sort();
    const toPrune = all.slice(0, Math.max(0, all.length - keep));
    for (const old of toPrune) {
      await fs.rm(path.join(backupRoot, old), { recursive: true, force: true });
      console.log(`[backup] pruned older snapshot ${old}`);
    }
  }
}

main().catch((e) => {
  console.error("[backup] failed:", e?.message || e);
  process.exit(1);
});
