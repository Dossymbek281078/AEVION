#!/usr/bin/env node
/**
 * QSkyway — audit the height claims a city twin is built on.
 *
 * WHY THIS EXISTS: the twin trusts an OSM `height` tag completely — it enters as
 * hs=0, MEASURED, and SRC_CLEARANCE gives that class zero safety margin. On
 * 2026-07-27 an ad-hoc version of this check found, in minutes, that OSM tags
 * 30 Rockefeller Plaza at height=10 (70 floors, ~259 m real) and Abu Dhabi Plaza
 * at 382 m against the 310.8 m its own linked article publishes. Those findings
 * came from a throwaway script that was never committed — the same disease
 * fetch-city-twin.mjs was written to cure, so this one lives here.
 *
 * Usage:
 *   node scripts/audit-height-claims.mjs astana
 *   node scripts/audit-height-claims.mjs nyc --all     (list every comparison)
 *
 * Reports only. It never writes a twin and never exits non-zero on a finding:
 * a height that disagrees with its article is a question for a human, not a
 * build failure. Where the city has an authority survey (NYC, Tokyo) a bad tag
 * is usually corrected downstream anyway; where it does not (Astana) the tag is
 * load-bearing, which is exactly why this is worth running per city.
 */

import {
  parseInfoboxHeights, compareTagToArticle, storeyRatio,
} from "./lib/wiki-infobox.mjs";
import { parseMetres } from "./lib/city-twin-geometry.mjs";

const BBOX = {
  astana: { minLat: 51.1183717, maxLat: 51.1356973, minLon: 71.4104119, maxLon: 71.4432041 },
  nyc: { minLat: 40.7474728, maxLat: 40.7629936, minLon: -74.0002478, maxLon: -73.9758674 },
  tokyo: { minLat: 35.683592, maxLat: 35.6978747, minLon: 139.6879457, maxLon: 139.7037075 },
};
const OVERPASS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const UA = "AEVION-QSkyway/1.0 (height-claim audit; contact via github.com/Dossymbek281078/AEVION)";

const city = process.argv[2];
const showAll = process.argv.includes("--all");
if (!BBOX[city]) {
  console.error(`unknown city "${city}" — known: ${Object.keys(BBOX).join(", ")}`);
  process.exit(1);
}

async function overpass(query) {
  let last;
  for (const host of OVERPASS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(host, {
          method: "POST", body: query,
          headers: { "Content-Type": "text/plain", "User-Agent": UA },
          signal: AbortSignal.timeout(180_000),
        });
        // 429/504 is Overpass asking us to wait, not saying the data is absent.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).elements;
      } catch (e) {
        last = e;
        process.stderr.write(`  ${host} attempt ${attempt}: ${e.message}\n`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 12_000 * attempt));
      }
    }
  }
  throw last;
}

async function articleText(tag) {
  // `wikipedia=en:Some Title`; a bare title means English.
  const i = tag.indexOf(":");
  const lang = i > 0 ? tag.slice(0, i) : "en";
  const page = i > 0 ? tag.slice(i + 1) : tag;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions`
    + `&titles=${encodeURIComponent(page)}&rvprop=content&rvslots=main&format=json`
    + `&formatversion=2&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? null;
}

const b = BBOX[city];
process.stderr.write(`QSkyway height audit: ${city} — querying Overpass…\n`);
const elements = await overpass(
  `[out:json][timeout:180];`
  + `(way["building"]["height"](${b.minLat},${b.minLon},${b.maxLat},${b.maxLon});`
  + ` relation["building"]["height"](${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}););out tags;`,
);

const rows = [];
for (const el of elements) {
  const h = parseMetres(el.tags.height) ?? parseMetres(el.tags["building:height"]);
  if (h === null) continue;
  const levels = parseMetres(el.tags["building:levels"]);
  rows.push({
    id: `${el.type}/${el.id}`,
    name: el.tags.name ?? el.tags["name:en"] ?? "",
    building: el.tags.building,
    h, levels,
    wikipedia: el.tags.wikipedia ?? null,
    ratio: levels !== null ? storeyRatio(h, levels) : null,
  });
}

const findings = [];
const unreadable = [];
for (const r of rows) {
  if (!r.wikipedia) continue;
  const text = await articleText(r.wikipedia);
  await new Promise((res) => setTimeout(res, 400)); // be polite to Wikipedia
  if (!text) { r.article = { verdict: "no-article" }; unreadable.push(r); continue; }
  const box = parseInfoboxHeights(text);
  r.box = box;
  r.article = compareTagToArticle(r.h, box);
  // An article this parser could not read a height out of is NOT a clean bill of
  // health, and reporting it as one is how a tool ends up saying "no findings"
  // about a city it never actually checked. Japanese infoboxes, for one, name
  // their fields in Japanese — so a Tokyo run reads far fewer articles than it
  // fetches, and the count below is what makes that visible instead of silent.
  if (r.article.verdict === "unknown") unreadable.push(r);
  if (r.article.verdict === "over" || r.article.verdict === "under") findings.push(r);
}

const impossible = rows.filter((r) => r.ratio?.band === "impossible");
const suspicious = rows.filter((r) => r.ratio?.band === "suspicious");

const line = (r) => `  ${r.id.padEnd(20)} ${String(r.h).padStart(7)} m`
  + (r.levels !== null ? ` / ${r.levels} floors = ${r.ratio.mPerFloor} m per storey` : " (no floor count)")
  + (r.article?.published ? `  | its article publishes ${r.article.published} m` : "")
  + (r.name ? `  ${r.name}` : "");

process.stdout.write(
  `\n── ${city}: ${rows.length} buildings carry a height tag ──\n`
  + `  with a floor count to check it against : ${rows.filter((r) => r.levels !== null).length}\n`
  + `  naming their own reference (wikipedia=) : ${rows.filter((r) => r.wikipedia).length}\n`
  + `\n⚠ the source contradicts ITSELF (under 2 m per storey) — heightOf already`
  + ` overrides these:\n${impossible.length ? impossible.map(line).join("\n") : "  none"}\n`
  + `\n⚠ the element disagrees with the article IT links to:\n`
  + `${findings.length ? findings.map((r) => `${line(r)}   [${r.article.verdict}]`).join("\n") : "  none"}\n`
  + (rows.some((r) => r.wikipedia)
    ? `  (checked ${rows.filter((r) => r.wikipedia).length - unreadable.length}`
      + ` of ${rows.filter((r) => r.wikipedia).length} linked articles`
      + `${unreadable.length ? `; ${unreadable.length} published no height this parser could read — "none" above says nothing about those` : ""})\n`
    : "")
  + `\n· unusual but possible (2-2.8 m per storey), reported only:\n`
  + `${suspicious.length ? suspicious.map(line).join("\n") : "  none"}\n`
  + (showAll ? `\n· every height tag:\n${rows.map(line).join("\n")}\n` : "")
  + `\nA tag UNDER its published height is the expensive direction: the twin trusts\n`
  + `a height tag completely, so an understated obstacle is flown over with no\n`
  + `clearance. A tag OVER it only costs a detour. Neither is fixed here — the\n`
  + `honest repair is upstream in OSM.\n`,
);
