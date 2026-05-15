// Single-module deep lookup. Shows full metadata including
// relatedModules (top-5 by tag overlap).
//
//   node examples/get-module.mjs           # defaults to qpersona
//   node examples/get-module.mjs qsign     # any module id

import { AevionCatalog } from "../dist/index.js";

const id = process.argv[2] || "qpersona";
const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

const m = await cat.get(id);

console.log(`${m.name} (${m.code})`);
console.log("─".repeat(60));
console.log(`Status:      ${m.status}`);
console.log(`Kind:        ${m.kind}`);
console.log(`Priority:    ${m.priority}`);
console.log(`Tags:        ${m.tags.join(", ")}`);
console.log(`Frontend:    ${m.frontend}`);
if (m.openapi) console.log(`OpenAPI:     ${m.openapi}`);
if (m.health) console.log(`Health:      ${m.health}`);
console.log();
console.log(`Description: ${m.description}`);
console.log();
console.log("Related modules:");
for (const r of m.relatedModules) {
  console.log(`  → ${r.id.padEnd(20)} ${r.name} (overlap ${r.overlap})`);
}
