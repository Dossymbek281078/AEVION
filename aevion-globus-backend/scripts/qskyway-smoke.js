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
let step = 0, failed = 0;
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
  assert(cityP4.json?.wind?.groundMs > 0 && cityP4.json?.wind?.topMs >= cityP4.json?.wind?.groundMs, "layered wind (grows with altitude)", `g=${cityP4.json?.wind?.groundMs} t=${cityP4.json?.wind?.topMs}`);

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

  // bad route rejected
  const bad = await jpost("/api/qskyway/route", { from: 0, to: 0 });
  assert(bad.status === 422, "same-vertiport route rejected", `status=${bad.status}`);

  // slot market: capacity 4 then 409, non-overlapping ok
  const rid = "smoke-route-1";
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

  console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"}  (${step} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
