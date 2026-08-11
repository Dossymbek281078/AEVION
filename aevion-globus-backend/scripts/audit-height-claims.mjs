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
  parseInfoboxHeights, compareTagToArticle, storeyRatio, rawHeightFields,
} from "./lib/wiki-infobox.mjs";
import { parseMetres, overpassBodyProblem } from "./lib/city-twin-geometry.mjs";
import fs from "node:fs";

const BBOX = {
  astana: { minLat: 51.1183717, maxLat: 51.1356973, minLon: 71.4104119, maxLon: 71.4432041 },
  nyc: { minLat: 40.7474728, maxLat: 40.7629936, minLon: -74.0002478, maxLon: -73.9758674 },
  tokyo: { minLat: 35.683592, maxLat: 35.6978747, minLon: 139.6879457, maxLon: 139.7037075 },
};
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = "AEVION-QSkyway/1.0 (height-claim audit; contact via github.com/Dossymbek281078/AEVION)";

const city = process.argv[2];
const showAll = process.argv.includes("--all");
// Overpass is a donated public service, and this audit asks it the same question
// every run. A cache keeps iteration off the wire entirely — the same courtesy
// --plateau-cache extends to MLIT, and the reason a re-run of this script cost
// minutes of someone else's server all afternoon.
const cacheFlag = process.argv.indexOf("--osm-cache");
// Кэш теперь ВКЛЮЧЁН по умолчанию, а не по флагу, которого не было даже в
// справке выше. 11.08.2026 из-за этого каждый запуск шёл в сеть: аудит по
// Нью-Йорку дважды не дошёл до отчёта — `overpass-api.de` отдаёт на запрос по
// Мидтауну HTTP 504, и перебор зеркал занимает больше двадцати минут. Один
// удачный ответ теперь делает все следующие запуски мгновенными, что и есть
// та вежливость к чужому серверу, о которой говорит комментарий выше.
// Обойти: `--no-cache` (спросить сеть заново) или `--osm-cache <каталог>`.
const DEFAULT_OSM_CACHE = new URL("../.aevion-data/osm-cache/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const osmCache = process.argv.includes("--no-cache")
  ? null
  : (cacheFlag > 0 ? process.argv[cacheFlag + 1] : DEFAULT_OSM_CACHE);
if (osmCache) fs.mkdirSync(osmCache, { recursive: true });
if (!BBOX[city]) {
  console.error(`unknown city "${city}" — known: ${Object.keys(BBOX).join(", ")}`);
  process.exit(1);
}

/**
 * Rounds outside, hosts inside — deliberately, and not the obvious nesting.
 *
 * With hosts on the OUTER loop a dead mirror costs three full timeouts before
 * anything else is tried: on 2026-07-27 overpass.kumi.systems stopped answering
 * while overpass-api.de replied in one second, and this script sat for nine
 * minutes per run because it asked the dead one three times first. Round-robin
 * spends one timeout per host per round, so a healthy mirror is reached at once.
 */
async function overpass(query) {
  let last;
  for (let round = 1; round <= 3; round++) {
    for (const host of OVERPASS) {
      // Пишем ДО запроса, а не только при ошибке. Худший случай честно длинный:
      // три круга × три зеркала × 120 с плюс паузы — больше двадцати минут, и всё
      // это время инструмент не печатал ни строки. Человек в такой тишине решает,
      // что он повис, и больше его не запускает: 11.08.2026 я так и решил на
      // прогоне по Нью-Йорку и снял процесс. Проверка, которую перестают звать,
      // ничем не лучше отсутствующей — ровно та болезнь, что этот модуль лечит.
      process.stderr.write(`  → ${new URL(host).host} (круг ${round} из 3, ждём до 120 с)…\n`);
      try {
        const res = await fetch(host, {
          method: "POST", body: query,
          headers: { "Content-Type": "text/plain", "User-Agent": UA },
          signal: AbortSignal.timeout(120_000),
        });
        // 429/504 is Overpass asking us to wait, not saying the data is absent.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // …and an overloaded instance says so with HTTP **200** and an HTML page:
        // "Error: runtime error: … The server is probably too busy to handle your
        // request." Parsing that as JSON throws something unreadable about
        // token '<', which reads like a bug here rather than a busy server.
        const body = await res.text();
        const bodyProblem = overpassBodyProblem(body);
        if (bodyProblem) throw new Error(bodyProblem);
        return JSON.parse(body).elements;
      } catch (e) {
        last = e;
        process.stderr.write(`  ${host} round ${round}: ${e.message}\n`);
      }
    }
    if (round < 3) await new Promise((r) => setTimeout(r, 12_000 * round));
  }
  throw last;
}

/**
 * → { text } | { error }.
 *
 * The two outcomes must stay apart all the way to the report. An earlier version
 * collapsed them and printed "published no height this parser could read" for
 * articles it had simply been rate-limited out of — Wikipedia answers a burst of
 * requests with "You are making too many requests", and the audit then blamed
 * the data for a property of its own network call. It made the parser look
 * broken on 小田急サザンタワー, whose article it parses perfectly.
 */
async function articleText(tag) {
  // `wikipedia=en:Some Title`; a bare title means English.
  const i = tag.indexOf(":");
  const lang = i > 0 ? tag.slice(0, i) : "en";
  const page = i > 0 ? tag.slice(i + 1) : tag;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions`
    + `&titles=${encodeURIComponent(page)}&rvprop=content&rvslots=main&format=json`
    + `&formatversion=2&redirects=1`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const body = await res.text();
      // A throttled answer arrives as plain text, not JSON.
      if (!body.startsWith("{")) throw new Error(body.slice(0, 60).trim());
      const j = JSON.parse(body);
      const text = j?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
      return text ? { text } : { error: "article has no content" };
    } catch (e) {
      if (attempt === 4) return { error: e.message };
      await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
  }
  return { error: "unreachable" };
}

const b = BBOX[city];
const cacheFile = osmCache ? `${osmCache}/audit-${city}-heights.json` : null;
let elements;
if (cacheFile && fs.existsSync(cacheFile)) {
  elements = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  process.stderr.write(`QSkyway height audit: ${city} — ${elements.length} elements from cache (возраст ${Math.round((Date.now() - fs.statSync(cacheFile).mtimeMs) / 86400000)} дн., обойти — --no-cache)\n`);
} else {
  process.stderr.write(`QSkyway height audit: ${city} — querying Overpass…\n`);
  elements = await overpass(
    `[out:json][timeout:180];`
    + `(way["building"]["height"](${b.minLat},${b.minLon},${b.maxLat},${b.maxLon});`
    + ` relation["building"]["height"](${b.minLat},${b.minLon},${b.maxLat},${b.maxLon}););out tags;`,
  );
  if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(elements));
}

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
const notFetched = [];  // we never saw the article
const noHeight = [];    // we read it, and it publishes no height at all
const unparsed = [];    // it publishes one, in a shape we cannot read — our backlog
for (const r of rows) {
  if (!r.wikipedia) continue;
  const got = await articleText(r.wikipedia);
  await new Promise((res) => setTimeout(res, 800)); // be polite to Wikipedia
  if (got.error) { r.article = { verdict: "not-fetched", error: got.error }; notFetched.push(r); continue; }
  const box = parseInfoboxHeights(got.text);
  r.box = box;
  r.article = compareTagToArticle(r.h, box);
  // Neither of these is a clean bill of health, and reporting them as one is how
  // a tool ends up saying "no findings" about a city it never checked.
  if (r.article.verdict === "unknown") {
    // Two different silences: the article states no height at all, or it states
    // one we could not read. Only the second is our backlog.
    r.rawFields = rawHeightFields(got.text);
    (r.rawFields.length ? unparsed : noHeight).push(r);
  }
  if (r.article.verdict === "over" || r.article.verdict === "under") findings.push(r);
}

const impossible = rows.filter((r) => r.ratio?.band === "impossible");
const suspicious = rows.filter((r) => r.ratio?.band === "suspicious");

const line = (r) => `  ${r.id.padEnd(20)} ${String(r.h).padStart(7)} m`
  // Guard on the RATIO, not on the floor count: OSM carries fractional storeys
  // (`building:levels=0.5`), for which storeyRatio declines to answer while the
  // level count is still present. Keying off `levels` crashed --all on exactly
  // that row.
  + (r.ratio ? ` / ${r.levels} floors = ${r.ratio.mPerFloor} m per storey`
    : r.levels !== null ? ` / ${r.levels} floors` : " (no floor count)")
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
    ? `  (read ${rows.filter((r) => r.wikipedia).length - notFetched.length - noHeight.length}`
      + ` of ${rows.filter((r) => r.wikipedia).length} linked articles`
      + `${noHeight.length ? `; ${noHeight.length} publish no height at all` : ""}`
      + `${unparsed.length ? `; ${unparsed.length} publish one we could not read — OUR backlog` : ""}`
      + `${notFetched.length ? `; ${notFetched.length} could not be fetched at all — that is our network, not their data` : ""}`
      + `${notFetched.length + noHeight.length ? ` — "none" above says nothing about those` : ""})\n`
    : "")
  + `\n· unusual but possible (2-2.8 m per storey), reported only:\n`
  + `${suspicious.length ? suspicious.map(line).join("\n") : "  none"}\n`
  // The unread list is the audit's own backlog: every one of these may hide a
  // finding, and printing only their COUNT makes the gap easy to leave open.
  + (showAll && unparsed.length
    ? `\n· publish a height we could not read — fix the parser, then re-run:\n`
      + unparsed.map((r) => `    ${r.id.padEnd(20)} tag ${r.h} m   ${r.wikipedia}`
        + `   [${r.rawFields.map((f) => `${f.field}=${f.raw.slice(0, 40)}`).join(", ")}]`).join("\n") + "\n"
    : "")
  + (showAll && noHeight.length
    ? `\n· read, and they publish no height at all — nothing to fix here:\n`
      + noHeight.map((r) => `    ${r.id.padEnd(20)} tag ${r.h} m   ${r.wikipedia}`).join("\n") + "\n"
    : "")
  + (showAll && notFetched.length
    ? `\n· never fetched (our network, not their data):\n`
      + notFetched.map((r) => `    ${r.id.padEnd(20)} ${r.wikipedia}   ${r.article.error}`).join("\n") + "\n"
    : "")
  + (showAll ? `\n· every height tag:\n${rows.map(line).join("\n")}\n` : "")
  + `\nA tag UNDER its published height is the expensive direction: the twin trusts\n`
  + `a height tag completely, so an understated obstacle is flown over with no\n`
  + `clearance. A tag OVER it only costs a detour. Neither is fixed here — the\n`
  + `honest repair is upstream in OSM.\n`,
);
