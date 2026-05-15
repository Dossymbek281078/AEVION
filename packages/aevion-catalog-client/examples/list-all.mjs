// List every module in the AEVION registry. Prints a table by status.
//
// Run from package root after `npm run build`:
//   node examples/list-all.mjs
//
// Or against a custom backend:
//   AEVION_BASE_URL=https://localhost:3001 node examples/list-all.mjs

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

const { items, total } = await cat.list();

const byStatus = new Map();
for (const m of items) {
  if (!byStatus.has(m.status)) byStatus.set(m.status, []);
  byStatus.get(m.status).push(m);
}

console.log(`AEVION registry — ${total} modules\n`);
for (const [status, list] of byStatus.entries()) {
  console.log(`[${status}] (${list.length})`);
  for (const m of list) {
    console.log(`  • ${m.code.padEnd(22)} ${m.name}`);
  }
  console.log();
}
