// URL builders — no network call. Use these in your README,
// dashboards or build scripts.
//
//   node examples/urls.mjs

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog();

console.log("CSV export — all MVP modules tagged 'ai':");
console.log("  " + cat.csvUrl({ status: "mvp", tag: "ai" }));

console.log("\nMarkdown export — all 'product' kind:");
console.log("  " + cat.markdownUrl({ kind: "product" }));

console.log("\nProjection — only id and name fields:");
console.log("  " + cat.csvUrl({ fields: ["id", "name"] }));

console.log("\nBadge URLs (drop into README):");
for (const id of ["qpersona", "qsign", "qright", "planet"]) {
  console.log(`  ${id}: ${cat.badgeUrl(id)}`);
}

console.log("\nMarkdown:");
console.log(`  ![AEVION QPersona](${cat.badgeUrl("qpersona")})`);
