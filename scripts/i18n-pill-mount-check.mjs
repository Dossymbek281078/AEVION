// Guards the AppShellLanguagePill mount in ClientProviders.tsx.
//
// Why: app-shell prefixes (/build, /qcoreai, /cyberchess, ...) suppress
// SiteHeader, which also hid the LanguageSwitcher. Pill was added 2026-05-22
// (ba0328d5) to cover ~98 sub-pages. Squash-merges have dropped mount calls
// 5+ times in this repo (see memory feedback_aevion_squash_mount_drops.md) —
// this check fails fast in CI if pill goes missing.
//
// Exports runPillMountCheck() so i18n-kk-extract.mjs can chain it; also
// runnable directly via `node scripts/i18n-pill-mount-check.mjs`.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CLIENT_PROVIDERS = "frontend/src/components/ClientProviders.tsx";
const PILL_FILE = "frontend/src/components/AppShellLanguagePill.tsx";

export function runPillMountCheck() {
  const errors = [];

  if (!fs.existsSync(PILL_FILE)) {
    errors.push(`missing file: ${PILL_FILE}`);
  } else {
    const pill = fs.readFileSync(PILL_FILE, "utf8");
    if (!/export\s+function\s+AppShellLanguagePill\b/.test(pill)) {
      errors.push(`${PILL_FILE}: missing 'export function AppShellLanguagePill'`);
    }
    if (!/LanguageSwitcher/.test(pill)) {
      errors.push(`${PILL_FILE}: doesn't render <LanguageSwitcher />`);
    }
  }

  if (!fs.existsSync(CLIENT_PROVIDERS)) {
    errors.push(`missing file: ${CLIENT_PROVIDERS}`);
  } else {
    const cp = fs.readFileSync(CLIENT_PROVIDERS, "utf8");
    if (!/import\s+\{[^}]*AppShellLanguagePill[^}]*\}\s+from\s+["']@\/components\/AppShellLanguagePill["']/.test(cp)) {
      errors.push(`${CLIENT_PROVIDERS}: missing import { AppShellLanguagePill } from "@/components/AppShellLanguagePill"`);
    }
    if (!/<AppShellLanguagePill\s*\/>/.test(cp)) {
      errors.push(`${CLIENT_PROVIDERS}: missing <AppShellLanguagePill /> in JSX`);
    }
    if (!/isApp\s*&&\s*<AppShellLanguagePill/.test(cp)) {
      errors.push(`${CLIENT_PROVIDERS}: pill must render only when isApp is true (look for 'isApp && <AppShellLanguagePill')`);
    }
  }

  if (errors.length) {
    console.log("✗ AppShellLanguagePill mount check FAILED:");
    for (const e of errors) console.log(`    ${e}`);
    console.log("");
    console.log("  Pill covers ~98 app-shell sub-pages where SiteHeader is suppressed.");
    console.log("  Reintroduce per commit ba0328d5 (feat(i18n): floating LanguageSwitcher pill).");
    return errors.length;
  }

  console.log("✓ AppShellLanguagePill mounted in ClientProviders.tsx");
  return 0;
}

// Run standalone if invoked directly
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath === selfPath) {
  const failed = runPillMountCheck();
  if (failed) process.exit(1);
}
