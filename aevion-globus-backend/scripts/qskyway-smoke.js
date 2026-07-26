#!/usr/bin/env node
/**
 * AEVION QSkyway — deterministic engine smoke test.
 *
 * DB-free pure-compute router (A* over a real OSM height field + in-memory QRight
 * slot market), so no seed / no Postgres. Exercises health, city twin, 4D routing
 * (incl. clearance invariant across all vertiport pairs) and the slot capacity gate.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/qskyway-smoke.js
 * Env: BASE default http://127.0.0.1:4001
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
// Write legs (slot booking, registry entry) self-skip against prod so the daily
// run can cover the whole read surface without leaving smoke rows behind.
const READ_ONLY = process.env.READ_ONLY === "1";
let step = 0, failed = 0;
let skipped = 0;
const skip = (n, why) => { skipped++; console.log(`  ${String(++step).padStart(2, "0")}  SKIP  ${n}  — ${why}`); };
// A skipped write leg did not pass — folding it into the pass count would make
// a prod run look like it verified more than it actually did.
const summary = () => `${failed === 0 ? "ALL PASS" : failed + " FAILED"}  (${step - skipped}/${step} checks${skipped ? `, ${skipped} skipped` : ""})`;
const ok = (n, x) => console.log(`  ${String(++step).padStart(2, "0")}  PASS  ${n}${x ? "  " + x : ""}`);
const fail = (n, r) => { step++; failed++; console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${n}${r ? "  — " + r : ""}`); };
const assert = (c, n, r) => (c ? ok(n) : fail(n, r));
async function jget(p) { const r = await fetch(`${BASE}${p}`); return { status: r.status, json: await r.json().catch(() => null) }; }
async function jpost(p, b) { const r = await fetch(`${BASE}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => null) }; }

async function main() {
  console.log(`QSkyway smoke → ${BASE}\n`);

  const h = await jget("/api/qskyway/health");
  assert(h.status === 200 && h.json?.status === "ok", "/health ok", `status=${h.status}`);
  assert((h.json?.buildings ?? 0) >= 300, "digital twin has buildings", `n=${h.json?.buildings}`);
  const vpN = h.json?.vertiports ?? 0;
  assert(vpN >= 5, "vertiports present", `n=${vpN}`);

  const city = await jget("/api/qskyway/city");
  assert(city.status === 200 && Array.isArray(city.json?.buildings), "/city returns twin", `status=${city.status}`);
  assert(Array.isArray(city.json?.grid?.heights) && city.json.grid.heights.length > 0, "/city has height field");

  // route between vp0 and vp1
  const r01 = await jpost("/api/qskyway/route", { from: 0, to: 1 });
  assert(r01.status === 200 && Array.isArray(r01.json?.path) && r01.json.path.length > 1, "route vp0→vp1", `status=${r01.status}`);
  assert(r01.json?.cruiseAltM >= 50 && r01.json?.distanceKm > 0, "route has altitude + distance", `alt=${r01.json?.cruiseAltM} d=${r01.json?.distanceKm}`);

  // multi-city registry
  const cs = await jget("/api/qskyway/cities");
  assert(cs.status === 200 && Array.isArray(cs.json?.cities), "/cities lists registry", `status=${cs.status}`);
  const cityIds = (cs.json?.cities ?? []).map((c) => c.id);
  assert(cityIds.includes("astana") && cityIds.includes("nyc") && cityIds.includes("tokyo"), "registry has astana + nyc + tokyo", cityIds.join(","));

  // clearance invariant across all vertiport pairs, per city
  for (const cid of cityIds) {
    const ch = await jget(`/api/qskyway/city?city=${cid}`);
    const nvp = ch.json?.vertiports?.length ?? 0;
    let pairs = 0, reachable = 0, violations = 0;
    for (let i = 0; i < nvp; i++) for (let j = 0; j < nvp; j++) {
      if (i === j) continue; pairs++;
      const r = await jpost("/api/qskyway/route", { from: i, to: j, city: cid });
      if (r.status === 200 && r.json?.path) {
        reachable++;
        const { alts, obstacles } = r.json;
        for (let k = 0; k < alts.length; k++) if (alts[k] < obstacles[k] + 15) violations++;
      }
    }
    assert(reachable === pairs, `[${cid}] all vertiport pairs routable`, `${reachable}/${pairs}`);
    assert(violations === 0, `[${cid}] corridor clears obstacles + margin`, `violations=${violations}`);
  }

  // ── Phase 4: no-fly, wind, signature, vertiport suitability ──────────────
  const cityP4 = await jget("/api/qskyway/city?city=astana");
  const nofly = cityP4.json?.nofly ?? [];
  assert(Array.isArray(nofly) && nofly.length >= 1, "no-fly zones exposed", `n=${nofly.length}`);
  assert(cityP4.json?._signature?.alg === "Ed25519" && !!cityP4.json?._signature?.contentHash, "twin carries Ed25519 signature");
  // groundMs >= 0, not > 0: a real METAR reading can legitimately be calm (0 m/s).
  assert(cityP4.json?.wind?.groundMs >= 0 && cityP4.json?.wind?.topMs >= cityP4.json?.wind?.groundMs, "layered wind (grows with altitude)", `g=${cityP4.json?.wind?.groundMs} t=${cityP4.json?.wind?.topMs}`);
  assert(["metar", "illustrative"].includes(cityP4.json?.wind?.source), "wind reports its source", `source=${cityP4.json?.wind?.source}`);

  // /health surfaces METAR fetch status (fails soft — this only checks shape, not that the feed is currently up)
  const h2 = await jget("/api/qskyway/health");
  assert(typeof h2.json?.wind?.lastFetchOk === "boolean" && h2.json?.wind?.cities, "/health reports METAR wind status");

  // no-fly avoidance: no path cell may fall inside a zone
  const cell = cityP4.json?.grid?.cell ?? 20;
  let insideCount = 0, checked = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i === j) continue; checked++;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "astana" });
    if (r.status !== 200) continue;
    for (const p of r.json.path) {
      const x = (p.c + 0.5) * cell, y = (p.r + 0.5) * cell;
      for (const z of nofly) if (Math.hypot(x - z.x, y - z.y) <= z.radiusM) insideCount++;
    }
  }
  assert(insideCount === 0, "routes avoid no-fly zones", `violations=${insideCount} over ${checked} routes`);

  // wind affects ETA (still vs wind differ) + fields present
  const wr = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "astana" });
  assert(typeof wr.json?.etaMinWind === "number" && typeof wr.json?.etaMinStill === "number", "route reports still + wind ETA");
  assert(wr.json?.avgWindMs >= 0, "route reports avg wind", `w=${wr.json?.avgWindMs}m/s`);

  // Ed25519 verify
  const ver = await jget("/api/qskyway/verify?city=nyc");
  assert(ver.status === 200 && ver.json?.valid === true && ver.json?.alg === "Ed25519", "Ed25519 twin signature verifies");

  // ── Tokyo (third city): no-fly exposed, avoided, twin signs + verifies ────
  const tk = await jget("/api/qskyway/city?city=tokyo");
  const tkNofly = tk.json?.nofly ?? [];
  assert(tk.status === 200 && (tk.json?.buildings?.length ?? 0) >= 300, "[tokyo] twin has buildings", `n=${tk.json?.buildings?.length}`);
  assert(Array.isArray(tkNofly) && tkNofly.length >= 2, "[tokyo] no-fly zones exposed", `n=${tkNofly.length}`);
  const tkCell = tk.json?.grid?.cell ?? 20;
  let tkInside = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "tokyo" });
    if (r.status !== 200) continue;
    for (const p of r.json.path) {
      const x = (p.c + 0.5) * tkCell, y = (p.r + 0.5) * tkCell;
      for (const z of tkNofly) if (Math.hypot(x - z.x, y - z.y) <= z.radiusM) tkInside++;
    }
  }
  assert(tkInside === 0, "[tokyo] routes avoid no-fly zones", `violations=${tkInside}`);
  const tkVer = await jget("/api/qskyway/verify?city=tokyo");
  assert(tkVer.status === 200 && tkVer.json?.valid === true, "[tokyo] Ed25519 twin signature verifies");

  // vertiport suitability scoring
  const vps = await jget("/api/qskyway/vertiports?city=nyc");
  assert(vps.status === 200 && Array.isArray(vps.json?.vertiports) && vps.json.vertiports.length > 0, "vertiport scoring endpoint");
  assert(vps.json.vertiports.every((v) => typeof v.suitability === "number" && typeof v.class === "string"), "each pad has suitability + class");

  // /city embeds the same scoring as vertiportScores (frontend suitability panel reads this,
  // not the standalone /vertiports endpoint — both must agree)
  const cityNyc = await jget("/api/qskyway/city?city=nyc");
  const embedded = cityNyc.json?.vertiportScores ?? [];
  assert(Array.isArray(embedded) && embedded.length === vps.json.vertiports.length, "/city embeds vertiportScores matching /vertiports count", `${embedded.length} vs ${vps.json.vertiports.length}`);
  assert(embedded.every((v) => typeof v.suitability === "number" && typeof v.class === "string"), "embedded scores carry suitability + class");

  // ── Phase 5: height-data provenance + confidence-adjusted clearance ─────────
  const cs2 = await jget("/api/qskyway/cities");
  assert((cs2.json?.cities ?? []).every((c) => c.dataQuality && typeof c.dataQuality.measuredPct === "number" && typeof c.dataQuality.realPct === "number"), "each city reports height dataQuality");
  const hm = await jget("/api/qskyway/health");
  const bm = hm.json?.clearanceModel?.byHeightSourceM ?? {};
  assert(bm.guessed > bm.derived && bm.derived >= bm.measured, "confidence-clearance model configured (guessed > derived >= measured)", `m=${bm.measured} d=${bm.derived} g=${bm.guessed}`);
  const tkq = await jget("/api/qskyway/city?city=tokyo");
  assert(tkq.json?.dataQuality?.total > 0 && Array.isArray(tkq.json?.grid?.src) && tkq.json.grid.src.length === tkq.json.grid.heights.length, "twin carries height-source grid + dataQuality");
  const p5r = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "tokyo" });
  assert(typeof p5r.json?.avgConfClearM === "number" && typeof p5r.json?.heightConfidencePct === "number", "route reports confidence-clearance metrics");
  // confidence clearance is exercised where corridors must cross uncertain buildings.
  // A* prefers open street canyons, so not every pair is padded — scan all pairs.
  let maxPad = 0, padded = 0;
  const tvp = tkq.json?.vertiports?.length ?? 0;
  for (let i = 0; i < tvp; i++) for (let j = 0; j < tvp; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "tokyo" });
    if (r.json?.avgConfClearM > 0) { padded++; if (r.json.avgConfClearM > maxPad) maxPad = r.json.avgConfClearM; }
  }
  assert(padded > 0 && maxPad > 0, "[tokyo] confidence-clearance raises corridors over uncertain buildings", `${padded} routes padded, max=${maxPad}m`);
  // clearance invariant already holds base+conf, so the per-city loop still shows 0 violations

  // ── Phase 7: regulatory airspace ceilings (real FAA UASFM feed for NYC) ─────
  const asN = cityNyc.json?.airspace;
  assert(asN?.available === true && asN.authority === "FAA", "[nyc] twin carries a real regulator ceiling feed", `authority=${asN?.authority}`);
  assert(asN.cells > 0 && asN.coveragePct >= 90, "[nyc] feed covers the twin", `${asN?.cells} cells, ${asN?.coveragePct}%`);
  assert(asN.minCeilingM === 0 && asN.maxCeilingM > 0, "[nyc] ceilings span from no-auto-authorization to a real limit", `${asN?.minCeilingM}–${asN?.maxCeilingM}m`);
  // Cities without an open regulator feed must say so rather than inventing one.
  const cityAst = await jget("/api/qskyway/city?city=astana");
  assert(cityAst.json?.airspace?.available === false, "[astana] no regulator feed is reported honestly, not faked");

  // Advisory (default) mode must not have changed routability — the verdict is
  // added information, not a new restriction.
  const advis = await jpost("/api/qskyway/route", { from: 1, to: 2, city: "nyc" });
  assert(advis.status === 200 && advis.json?.respectCeiling === false, "[nyc] default route stays advisory", `status=${advis.status}`);
  assert(advis.json?.airspace?.available === true && typeof advis.json.airspace.compliant === "boolean", "[nyc] route carries a ceiling verdict");
  assert(advis.json.airspace.coveragePct >= 90, "[nyc] verdict covers the route", `${advis.json?.airspace?.coveragePct}%`);
  const advAst = await jpost("/api/qskyway/route", { from: 1, to: 2, city: "astana" });
  assert(advAst.json?.airspace?.compliant === null, "[astana] no feed → no verdict (null, not a green tick)");

  // Strict mode: the published ceiling becomes a hard constraint. Every corridor
  // it does return must actually respect it, and pads under a 0 ft ceiling must
  // be unreachable — that is the real regulatory picture, not a bug.
  let strictOk = 0, strictBlocked = 0, strictViolating = 0;
  const nycVp = cityNyc.json?.vertiports?.length ?? 0;
  for (let i = 0; i < nycVp; i++) for (let j = 0; j < nycVp; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "nyc", respectCeiling: true });
    if (r.status === 200) { strictOk++; if (r.json?.airspace?.compliant !== true) strictViolating++; }
    else if (r.status === 422 && r.json?.reason === "airspace-ceiling") strictBlocked++;
  }
  assert(strictOk > 0 && strictViolating === 0, "[nyc] every strict-mode corridor respects the published ceiling", `${strictOk} routed, ${strictViolating} violating`);
  assert(strictBlocked > 0, "[nyc] pads without automatic authorization are refused in strict mode", `${strictBlocked} of ${nycVp * (nycVp - 1)} pairs`);
  const blockedEx = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "nyc", respectCeiling: true });
  assert(blockedEx.status === 422 && blockedEx.json?.airspaceIfUnrestricted?.available === true, "[nyc] ceiling refusal explains what an unrestricted flight would need", `status=${blockedEx.status}`);
  // Cities with no feed must be unaffected by the flag rather than silently blocked.
  const strictAst = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "astana", respectCeiling: true });
  assert(strictAst.status === 200, "[astana] strict flag cannot block a city that has no published ceiling", `status=${strictAst.status}`);

  // The snapshot is frozen data about a rule that changes — the service must be
  // able to say whether it is still current, and must not guess when unchecked.
  const fr = asN.freshness;
  assert(fr && typeof fr.checked === "boolean" && "upToDate" in fr, "[nyc] airspace layer reports a freshness verdict");
  assert(fr.snapshotEffective === asN.effective, "[nyc] freshness verdict names the edition actually routed against", `${fr?.snapshotEffective}`);
  assert(fr.checked === false ? fr.upToDate === null : typeof fr.upToDate === "boolean", "[nyc] unchecked freshness is null, never a silent 'fresh'", `checked=${fr?.checked} upToDate=${fr?.upToDate}`);

  // The ceiling layer is attested too, not just the city twin — otherwise "we
  // routed against FAA edition X" is an unverifiable claim.
  assert(asN._signature?.alg === "Ed25519" && /^[0-9a-f]{64}$/.test(asN._signature?.contentHash ?? ""), "[nyc] airspace layer carries an Ed25519 attestation");
  const sigVer = await jget("/api/qskyway/verify?city=nyc");
  assert(sigVer.status === 200 && sigVer.json?.twin?.valid === true, "[nyc] twin signature verifies", `status=${sigVer.status}`);
  assert(sigVer.json?.airspace?.attested === true && sigVer.json.airspace.valid === true, "[nyc] airspace signature verifies");
  assert(sigVer.json.airspace.contentHash === asN._signature.contentHash, "[nyc] /verify and /city attest the same airspace content");
  assert(sigVer.json.airspace.effective === asN.effective, "[nyc] attestation is bound to the published edition", `${sigVer.json?.airspace?.effective}`);
  const verAst = await jget("/api/qskyway/verify?city=astana");
  assert(verAst.json?.airspace?.attested === false && verAst.json.airspace.valid === null, "[astana] nothing to attest is reported as such, not as invalid");
  assert(verAst.json?.valid === true, "[astana] twin verdict is unaffected by the absent airspace layer");

  // Pads inherit the same published ceiling as the grid they stand on.
  const padCeil = (cityNyc.json?.vertiportScores ?? []).filter((v) => typeof v.ceilingM === "number");
  assert(padCeil.length === nycVp, "[nyc] every pad reports its published ceiling", `${padCeil.length}/${nycVp}`);
  assert(padCeil.some((v) => v.needsAtcCoordination === true), "[nyc] pads under a 0 ft ceiling are flagged for ATC coordination");

  // One signed document an operator can actually file, instead of stitching
  // three responses together by hand.
  const just = await jpost("/api/qskyway/route/justification", { from: 1, to: 2, city: "nyc" });
  assert(just.status === 200 && just.json?.document?.kind === "qskyway.route.justification/1", "[nyc] route justification issued", `status=${just.status}`);
  const jd = just.json.document;
  assert(jd.twinContentHash === cityNyc.json._signature.contentHash, "justification binds the twin actually routed over");
  assert(jd.airspace?.contentHash === asN._signature.contentHash, "justification binds the airspace edition actually obeyed");
  assert(jd.airspace?.effective === asN.effective && jd.airspace?.authority === "FAA", "justification names the authority and edition", `${jd.airspace?.authority} ${jd.airspace?.effective}`);
  assert(typeof jd.airspace?.compliant === "boolean", "justification states the verdict, green or not");
  assert(typeof just.json?.scope === "string" && just.json.scope.includes("НЕ"), "scope limit travels with the document");
  const jver = await jpost("/api/qskyway/route/justification/verify", { document: jd, attestation: just.json.attestation });
  assert(jver.json?.valid === true && jver.json?.hashValid === true && jver.json?.signatureValid === true, "justification verifies round-trip");
  // Tampering must be caught and attributed: a changed value is a hash failure,
  // not a signature failure, and the two must not be reported as one.
  const tampered = await jpost("/api/qskyway/route/justification/verify", {
    document: { ...jd, cruiseAltM: jd.cruiseAltM + 100 }, attestation: just.json.attestation,
  });
  assert(tampered.json?.valid === false && tampered.json?.hashValid === false, "tampered justification is rejected as a content change", `hashValid=${tampered.json?.hashValid}`);
  const justAst = await jpost("/api/qskyway/route/justification", { from: 0, to: 1, city: "astana" });
  assert(justAst.status === 200 && justAst.json?.document?.airspace === null, "[astana] justification omits an altitude verdict it cannot make");
  assert(/AIP KZ/.test(justAst.json?.document?.permission?.authority ?? ""), "[astana] justification still discloses the prohibition that does apply");
  // Astana has no CEILING grid but does have a published prohibition, so the
  // scope must say which of the two is missing — "нет" alone matched either.
  assert(/потолк/i.test(justAst.json?.scope ?? "") && /ЗАПРЕТНАЯ/.test(justAst.json?.scope ?? ""), "[astana] scope calls the prohibition a prohibition, not a permission regime", (justAst.json?.scope ?? "").slice(0, 90));
  assert(justAst.json?.document?.permission?.kind === "prohibition", "[astana] the SIGNED document carries the prohibition/permission distinction");
  assert(!/требует индивидуального разрешения/.test(justAst.json?.scope ?? ""), "[astana] the filing never says a banned flight merely needs permission");

  // Phase 8: a permission regime is a published rule too — a city with no
  // ceiling grid must not be reported as having no regulator.
  const cityTk = await jget("/api/qskyway/city?city=tokyo");
  const perm = cityTk.json?.airspace?.permission;
  assert(cityTk.json?.airspace?.available === false, "[tokyo] no ceiling grid is published — still reported honestly");
  assert(perm?.available === true && /MLIT/.test(perm.authority ?? ""), "[tokyo] permission regime from the real authority is reported", `${perm?.authority}`);
  assert(perm.basis === "raster-sampled", "[tokyo] permission provenance says it was sampled, not ingested", `basis=${perm?.basis}`);
  assert(perm.coveragePct === 100 && perm.uniform === true, "[tokyo] uniform coverage is stated as uniform, not drawn as a map", `${perm?.coveragePct}%`);
  // Astana: the eAIP publishes a prohibited area that covers the whole twin.
  // Reporting it as "no source" was the module's own worst inaccuracy.
  // The disclaimer is read by every API consumer; it must not still be claiming
  // Astana has no source after the source was found.
  const disc = h.json?.disclaimer ?? "";
  assert(/UAP28/.test(disc) && !/Астана — открытого фида регулятора не найдено/.test(disc), "disclaimer names Astana's real zone rather than claiming none exists", disc.slice(-90));
  const permAst = await jget("/api/qskyway/city?city=astana");
  const pa = permAst.json?.airspace?.permission;
  assert(pa?.available === true && /AIP KZ/.test(pa.authority ?? ""), "[astana] published prohibited area is reported", `${pa?.authority}`);
  assert(pa.kind === "prohibition", "[astana] a prohibition is not rendered as a permission", `kind=${pa?.kind}`);
  // The UI picks its label off this field, so its absence would silently relabel
  // a ban as "needs permission" — the exact collapse the type exists to prevent.
  const pt = (await jget("/api/qskyway/city?city=tokyo")).json?.airspace?.permission;
  assert(pt?.kind === "permission", "[tokyo] permission regime keeps its own kind", `kind=${pt?.kind}`);
  assert(pa.basis === "ingested" && /UAP28/.test(pa.regime ?? ""), "[astana] zone identifier and provenance are stated", `${pa?.regime?.slice(0, 40)}`);
  assert(pa.coveragePct === 100 && /ЗАПРЕТНОЙ/.test(pa.note ?? ""), "[astana] full coverage is stated as prohibition, not as 'needs permission'");
  // A demo circle named after a real restriction must say it is a demo circle.
  const gov = (permAst.json?.nofly ?? []).find((z) => z.id === "nfz-gov");
  assert(gov && /демо/i.test(gov.name ?? ""), "[astana] the placeholder zone is named as a placeholder", gov?.name);
  assert(gov && /UAP28/.test(gov.realityNote ?? "") && /4\.5/.test(gov.realityNote ?? ""), "[astana] the placeholder points at the real published zone it stands in for");
  const cov = cs2.json?.airspaceCoverage ?? (await jget("/api/qskyway/cities")).json?.airspaceCoverage;
  assert(cov?.withFeed === 3 && cov?.withCeilings === 1 && cov?.withPermissionRegime === 2, "every city now has a published rule of some kind", `feed=${cov?.withFeed} ceil=${cov?.withCeilings} perm=${cov?.withPermissionRegime}`);
  assert(Array.isArray(cov?.missing) && cov.missing.length === 0, "nothing is left claiming no regulator source", (cov?.missing ?? []).join(","));
  const justTk = await jpost("/api/qskyway/route/justification", { from: 0, to: 1, city: "tokyo" });
  assert(justTk.json?.document?.permission?.authority && /MLIT/.test(justTk.json.document.permission.authority), "[tokyo] justification carries the permission regime it must disclose");
  // The disclaimer must not contradict the document it is attached to.
  assert(/режим разрешений/.test(justTk.json?.scope ?? "") && !/фида регулятора нет/.test(justTk.json?.scope ?? ""), "[tokyo] scope text matches what the document actually contains");

  // What the ceiling costs across the whole network — the figure the page shows
  // and the pitch quotes, so it must come from the engine, not from a slide.
  const imp = await jget("/api/qskyway/airspace/impact?city=nyc");
  assert(imp.status === 200 && imp.json?.available === true, "[nyc] regulatory impact is measured", `status=${imp.status}`);
  assert(imp.json?.pairs === imp.json?.routable, "[nyc] impact measures every pair, all still routable in advisory mode", `${imp.json?.routable}/${imp.json?.pairs}`);
  assert(imp.json.compliant > 0 && imp.json.compliant < imp.json.pairs, "[nyc] the published ceiling genuinely bites — some pairs comply, some do not", `${imp.json?.compliant}/${imp.json?.pairs}`);
  assert(imp.json.strictRoutable <= imp.json.pairs && imp.json.strictRoutable >= imp.json.compliant, "[nyc] strict-routable sits between compliant and total", `strict=${imp.json?.strictRoutable}`);
  assert(imp.json.padsNeedingAtc >= 1 && !/\d+ площадок стоят/.test(imp.json.note ?? ""), "[nyc] impact note counts pads with correct Russian agreement", imp.json?.note?.slice(-60));
  const impTk = await jget("/api/qskyway/airspace/impact?city=tokyo");
  assert(impTk.json?.available === false, "[tokyo] no ceiling grid means nothing to measure, said plainly");

  // The shipped Bitcoin proof: a proof nobody keeps is a proof that does not
  // exist, so the one for the edition in use must verify with no arguments.
  const pf = await jget("/api/qskyway/airspace/proof?city=nyc");
  assert(pf.status === 200 && pf.json?.contentHash === asN._signature.contentHash, "[nyc] shipped proof is for the edition actually served", `${pf.status}`);
  assert(pf.json?.coversCurrentEdition === true, "[nyc] shipped proof still covers the current edition");
  assert(pf.json?.verification?.ots?.verified === true && pf.json?.verification?.ots?.status === "bitcoin-confirmed", "[nyc] shipped proof verifies against Bitcoin", `block=${pf.json?.verification?.ots?.bitcoinBlockHeight}`);
  assert(pf.json?.verification?.fullyProven === true && pf.json?.bitcoinBlockHeight > 0, "[nyc] edition is trustlessly timestamped", `block=${pf.json?.bitcoinBlockHeight}`);
  // The verdict is cached once Bitcoin-confirmed so a public GET stops calling
  // the OpenTimestamps calendars on every request; the cached answer must be the
  // same answer, not a trimmed one.
  const pf2 = await jget("/api/qskyway/airspace/proof?city=nyc");
  assert(JSON.stringify(pf2.json) === JSON.stringify(pf.json), "[nyc] repeat proof request returns an identical verdict (served from cache)");
  // Anchoring an edition that is already anchored must not stamp again: a public
  // POST into someone else's calendars is an open tap, and a second timestamp
  // over the same hash proves nothing the first one did not.
  const reAnchor = await jpost("/api/qskyway/airspace/anchor", { city: "nyc" });
  assert(reAnchor.status === 200 && reAnchor.json?.reused === true, "[nyc] re-anchoring an already-anchored edition reuses the shipped proof", `reused=${reAnchor.json?.reused}`);
  assert(reAnchor.json?.contentHash === asN._signature.contentHash && (reAnchor.json?.calendars ?? []).length === 0, "[nyc] the reused answer is the same proof and hit no calendars");
  const pfAst = await jget("/api/qskyway/airspace/proof?city=astana");
  assert(pfAst.status === 404, "[astana] no shipped proof where there is no edition to anchor", `status=${pfAst.status}`);

  // Registry bridge. The DB is optional for QSkyway but mandatory for QRight, so
  // both outcomes are legitimate — what must never happen is a success response
  // when nothing was written.
  if (READ_ONLY) {
    skip("[nyc] airspace edition registered in QRight", "READ_ONLY — registry write skipped");
  } else {
  const reg1 = await jpost("/api/qskyway/airspace/register", { city: "nyc" });
  if (reg1.status === 503) {
    assert(!reg1.json?.ok && typeof reg1.json?.error === "string", "registry unavailable is reported as failure, not silent success", "no DB in this env");
  } else {
    assert(reg1.status === 201 || reg1.status === 200, "[nyc] airspace edition registered in QRight", `status=${reg1.status}`);
    assert(reg1.json?.contentHash === asN._signature.contentHash, "registry entry carries the signed layer's hash");
    // Idempotency is on the hash, so a second call must resolve to the same object.
    const reg2 = await jpost("/api/qskyway/airspace/register", { city: "nyc" });
    assert(reg2.json?.alreadyRegistered === true && reg2.json?.qrightObjectId === reg1.json.qrightObjectId, "re-registering the same edition returns the same object, not a duplicate");
  }
  const regAst = await jpost("/api/qskyway/airspace/register", { city: "astana" });
  assert(regAst.status === 422, "[astana] nothing to register without a regulator feed", `status=${regAst.status}`);
  }

  // bad route rejected
  const bad = await jpost("/api/qskyway/route", { from: 0, to: 0 });
  assert(bad.status === 422, "same-vertiport route rejected", `status=${bad.status}`);

  // slot market: capacity 4 then 409, non-overlapping ok
  // routeId must be unique per run — against a persistent (Postgres) store, a
  // fixed id collides with slots booked by earlier runs and books=0 forever.
  const rid = "smoke-route-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const before = await jget("/api/qskyway/slots");
  assert(before.status === 200 && typeof before.json?.count === "number" && Array.isArray(before.json?.slots), "GET /slots lists the market", `count=${before.json?.count}`);
  assert(["postgres", "memory"].includes(before.json?.store), "GET /slots reports its store backend", `store=${before.json?.store}`);
  if (READ_ONLY) {
    skip("slot market capacity gate", "READ_ONLY — booking writes skipped");
    console.log(`\n${summary()}`);
    process.exit(failed === 0 ? 0 : 1);
  }
  let okCount = 0, conflict = false;
  for (let i = 0; i < 5; i++) {
    const s = await jpost("/api/qskyway/slots", { routeId: rid, t0: "2026-07-11T09:00:00Z", t1: "2026-07-11T09:03:00Z", holder: "op" + i });
    if (s.status === 201) okCount++; else if (s.status === 409) conflict = true;
  }
  assert(okCount === 4, "slot market books up to capacity", `booked=${okCount}`);
  assert(conflict, "slot market rejects over-capacity (409)");
  const late = await jpost("/api/qskyway/slots", { routeId: rid, t0: "2026-07-11T10:00:00Z", t1: "2026-07-11T10:03:00Z", holder: "late" });
  assert(late.status === 201, "non-overlapping window bookable", `status=${late.status}`);
  assert(typeof late.json?.slot?.receipt === "string" && late.json.slot.receipt.startsWith("qright:"), "slot issues QRight receipt");
  const after = await jget("/api/qskyway/slots");
  assert(after.json?.count === before.json.count + okCount + 1, "GET /slots count reflects new bookings", `${before.json.count} → ${after.json?.count}`);
  assert(after.json.slots.some((s) => s.id === late.json.slot.id), "GET /slots list includes the just-booked slot");

  console.log(`\n${summary()}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
