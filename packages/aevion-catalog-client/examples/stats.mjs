// Registry-wide stats: by-status, by-kind, top-20 tags. Useful for
// README badges and homepage hero copy.
//
//   node examples/stats.mjs

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

const stats = await cat.stats();

console.log(`AEVION registry — ${stats.total} modules total\n`);

console.log("By status:");
for (const [status, n] of Object.entries(stats.byStatus)) {
  const bar = "█".repeat(Math.round((n / stats.total) * 40));
  console.log(`  ${status.padEnd(14)} ${String(n).padStart(3)}  ${bar}`);
}

console.log("\nBy kind:");
for (const [kind, n] of Object.entries(stats.byKind)) {
  console.log(`  ${kind.padEnd(14)} ${String(n).padStart(3)}`);
}

console.log("\nTop tags:");
for (const { tag, count } of stats.byTag.slice(0, 10)) {
  console.log(`  ${tag.padEnd(14)} ${String(count).padStart(3)}`);
}
