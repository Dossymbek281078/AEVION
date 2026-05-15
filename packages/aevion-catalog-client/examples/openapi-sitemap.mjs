// Two new v0.3 endpoints: openapi() returns the aggregate API index,
// sitemap() returns parsed URL list from /api/aevion/sitemap.xml.

import { AevionCatalog } from "../dist/index.js";

const cat = new AevionCatalog({
  baseUrl: process.env.AEVION_BASE_URL || "https://api.aevion.app",
});

const idx = await cat.openapi();
console.log(`${idx.name} v${idx.version}`);
console.log(`  ${idx.modules.length} modules, ${idx.services.length} services`);
if (idx.sdk?.npm?.length) {
  console.log(`  SDK packages: ${idx.sdk.npm.slice(0, 5).join(", ")}${idx.sdk.npm.length > 5 ? "…" : ""}`);
}

const sm = await cat.sitemap();
console.log(`\nSitemap: ${sm.length} URLs`);
for (const u of sm.slice(0, 5)) {
  const p = u.priority !== null ? ` p=${u.priority}` : "";
  const f = u.changefreq ? ` ${u.changefreq}` : "";
  console.log(`  ${u.loc}${p}${f}`);
}
