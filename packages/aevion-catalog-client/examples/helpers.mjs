// Convenience helpers (v0.2): searchByTag / byStatus / byKind /
// mvpsAndLaunched / topTags. Each returns the items array directly
// so you can skip the `{ items } =` destructure.
//
//   node examples/helpers.mjs
//
// Or against a custom backend:
//   AEVION_BASE_URL=https://localhost:3001 node examples/helpers.mjs

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

function preview(list) {
  return list
    .slice(0, 3)
    .map((m) => m.code)
    .join(", ");
}

const tagged = await cat.searchByTag("ai");
console.log(`searchByTag("ai") — ${tagged.length} modules`);
console.log(`  first 3: ${preview(tagged) || "(none)"}\n`);

const live = await cat.mvpsAndLaunched();
console.log(`mvpsAndLaunched() — ${live.length} modules`);
console.log(`  first 3: ${preview(live) || "(none)"}\n`);

const cores = await cat.byKind("core");
console.log(`byKind("core") — ${cores.length} modules`);
console.log(`  first 3: ${preview(cores) || "(none)"}\n`);

const research = await cat.byStatus(["research", "planning"]);
console.log(`byStatus(["research","planning"]) — ${research.length} modules`);
console.log(`  first 3: ${preview(research) || "(none)"}\n`);

const top = await cat.topTags(5);
console.log(`topTags(5):`);
for (const { tag, count } of top) {
  console.log(`  ${tag.padEnd(14)} ${String(count).padStart(3)}`);
}
