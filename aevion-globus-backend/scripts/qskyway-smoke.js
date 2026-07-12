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
  assert(cityIds.includes("astana") && cityIds.includes("nyc"), "registry has astana + nyc", cityIds.join(","));

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
