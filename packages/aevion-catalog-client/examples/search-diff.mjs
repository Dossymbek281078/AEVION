// v0.5: text search + module diff + fingerprint.
//   node examples/search-diff.mjs              # demo all three
//   node examples/search-diff.mjs <query>      # search

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

const query = process.argv[2] ?? "ai";

console.log(`findByText("${query}"):`);
const matches = await cat.findByText(query, { limit: 10 });
for (const m of matches) {
  console.log(`  ${String(m.score).padStart(3)}  ${m.id.padEnd(20)} ${m.name}`);
}

if (matches.length >= 2) {
  console.log(`\ndiff(${matches[0].id}, ${matches[1].id}):`);
  const d = await cat.diff(matches[0].id, matches[1].id);
  console.log(`  Jaccard: ${d.tags.jaccard.toFixed(3)}`);
  console.log(`  Shared tags: [${d.tags.shared.join(", ")}]`);
  console.log(`  Only ${d.a.id}: [${d.tags.onlyA.join(", ")}]`);
  console.log(`  Only ${d.b.id}: [${d.tags.onlyB.join(", ")}]`);
  for (const f of d.fields) {
    console.log(`  ${f.key.padEnd(10)} ${f.equal ? "=" : "≠"}  ${JSON.stringify(f.a)}  vs  ${JSON.stringify(f.b)}`);
  }

  console.log(`\nfingerprintModule("${matches[0].id}"):`);
  const fp = await cat.fingerprintModule(matches[0].id);
  console.log(`  hash=${fp.hash}  canonical=${fp.length}b`);
}
