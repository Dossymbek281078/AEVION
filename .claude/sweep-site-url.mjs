// One-shot sweep: replace hardcoded https://aevion.app in JSON-LD layouts
// with the SITE constant from @/lib/siteUrl. Idempotent — safe to re-run.
//
// Usage: node .claude/sweep-site-url.mjs

import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "frontend/src/app/awards/music/layout.tsx",
  "frontend/src/app/planet/layout.tsx",
  "frontend/src/app/awards/layout.tsx",
  "frontend/src/app/awards/film/layout.tsx",
  "frontend/src/app/security/layout.tsx",
  "frontend/src/app/quantum-shield/layout.tsx",
  "frontend/src/app/bank/about/layout.tsx",
  "frontend/src/app/bank/api/layout.tsx",
  "frontend/src/app/bank/layout.tsx",
  "frontend/src/app/help/layout.tsx",
  "frontend/src/app/press/layout.tsx",
  "frontend/src/app/bank/changelog/layout.tsx",
  "frontend/src/app/demo/deep/layout.tsx",
  "frontend/src/app/bank/trust/layout.tsx",
  "frontend/src/app/bank/security/layout.tsx",
  "frontend/src/app/demo/layout.tsx",
];

let totalChanged = 0;

for (const file of FILES) {
  const before = readFileSync(file, "utf8");

  if (!before.includes("https://aevion.app")) {
    console.log(`[skip] ${file} (no literal URL)`);
    continue;
  }

  // Replace `"https://aevion.app/PATH"` → `` `${SITE}/PATH` ``
  let after = before.replace(/"https:\/\/aevion\.app\/([^"]+)"/g, "`${SITE}/$1`");
  // Replace bare `"https://aevion.app"` → `SITE`
  after = after.replace(/"https:\/\/aevion\.app"/g, "SITE");

  // Inject import if not present.
  if (!after.includes('from "@/lib/siteUrl"')) {
    // Find first line after existing top-level imports.
    const lines = after.split(/\r?\n/);
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\b/.test(lines[i])) lastImportIdx = i;
      else if (lines[i].trim() === "" || lastImportIdx >= 0) break;
    }

    const inject = [
      'import { getSiteUrl } from "@/lib/siteUrl";',
      "",
      "const SITE = getSiteUrl();",
    ];

    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, ...inject);
    } else {
      // No imports — prepend at top.
      lines.unshift(...inject, "");
    }
    after = lines.join("\n");
  }

  if (after !== before) {
    writeFileSync(file, after, "utf8");
    totalChanged++;
    console.log(`[edit] ${file}`);
  } else {
    console.log(`[no-op] ${file}`);
  }
}

console.log(`\nDone. ${totalChanged}/${FILES.length} files changed.`);
