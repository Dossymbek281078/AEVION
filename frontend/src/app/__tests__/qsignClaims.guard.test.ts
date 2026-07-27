import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Production answers `{"qsign":{"mode":"preview","reason":"seed_unset"}}` until the
 * signing seed is set. Any page that tells a buyer the post-quantum signature is
 * shipping, GA or "in production" is therefore a claim the runtime contradicts —
 * and these are exactly the pages an investor or acquirer checks.
 *
 * Wording that stays true in both modes ("key-activated", "включается ключом")
 * is allowed. This guard is static on purpose: it fails in CI before a page ever
 * reaches a reader, whereas the runtime check (claims-vs-runtime smoke) can only
 * catch it after deploy.
 */

const APP_DIR = join(process.cwd(), "src", "app");

/** Phrases that assert the signature is live in production, not merely implemented. */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /ML-DSA-65\s+GA\b/i, why: "«GA» — прод отвечает preview" },
  { pattern: /ML-DSA-65[^.\n]{0,40}\bGA\)/i, why: "«GA» рядом с ML-DSA-65" },
  { pattern: /FIPS\s*204[^.\n]{0,30}\bin prod\b/i, why: "«in prod» — прод отвечает preview" },
  { pattern: /FIPS\s*204[^.\n]{0,30}в production/i, why: "«в production» — прод отвечает preview" },
  { pattern: /we already ship it/i, why: "«we already ship it» о постквантовой подписи" },
  { pattern: /ML-DSA-65 on the shelf/i, why: "«on the shelf» — утверждение о доступности" },
  { pattern: /No one else ships ML-DSA-65/i, why: "непроверяемое «никто больше не поставляет»" },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

export function findClaimViolations(files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const { pattern, why } of FORBIDDEN) {
      const match = text.match(pattern);
      if (!match) continue;
      const line = text.slice(0, match.index ?? 0).split("\n").length;
      violations.push(`${file.replace(APP_DIR, "src/app")}:${line} — ${why}: «${match[0]}»`);
    }
  }
  return violations;
}

describe("post-quantum claims match what production answers", () => {
  const files = collectSourceFiles(APP_DIR);

  it("scans a real, non-trivial set of page sources", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no page claims the signature is GA or in production", () => {
    expect(findClaimViolations(files)).toEqual([]);
  });

  it("the guard actually catches a violation (negative test)", () => {
    const seeded = join(APP_DIR, "__tests__", "fixtures", "qsignClaimViolation.txt");
    // The fixture holds the exact wording that shipped on /acquire before this
    // guard existed. If the matcher ever stops recognising it, the check above
    // becomes decoration.
    expect(findClaimViolations([seeded]).length).toBeGreaterThan(0);
  });
});
