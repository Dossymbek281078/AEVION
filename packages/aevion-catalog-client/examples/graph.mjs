// v0.4 graph helpers — module similarity by tag overlap.
//   node examples/graph.mjs           # registry-wide graph stats
//   node examples/graph.mjs qsign     # neighbours of one module

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

const single = process.argv[2];

if (single) {
  console.log(`Neighbours of '${single}' (top 10 by Jaccard):`);
  const n = await cat.neighbours(single, { topK: 10 });
  for (const x of n) {
    console.log(`  ${x.score.toFixed(3)}  ${x.id.padEnd(20)} [${x.sharedTags.join(", ")}]`);
  }
} else {
  const edges = await cat.graph({ topK: 3, minOverlap: 1 });
  console.log(`Registry tag-overlap graph: ${edges.length} edges, topK=3, minOverlap=1\n`);
  const byScore = [...edges].sort((a, b) => b.score - a.score).slice(0, 15);
  console.log("Strongest 15 edges:");
  for (const e of byScore) {
    console.log(`  ${e.score.toFixed(3)}  ${e.from.padEnd(18)} → ${e.to}`);
  }
}
