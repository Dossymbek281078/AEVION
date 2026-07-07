#!/usr/bin/env node
/**
 * AEVION QMelanin + QRenew — deterministic engine smoke test.
 *
 * Both modules are DB-free pure-compute routers, so this smoke needs no seed
 * data and no Postgres — it just exercises the engine shapes and a couple of
 * numeric invariants (PhenoAge sanity, deficiency flagging, interaction rules).
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/qrenew-smoke.js
 *
 * Env:
 *   BASE   default http://127.0.0.1:4001
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");

let step = 0;
let failed = 0;

function ok(name, extra) {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}${reason ? "  — " + reason : ""}`);
}
function assert(cond, name, reason) {
  if (cond) ok(name);
  else fail(name, reason);
}

async function jpost(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function jget(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function main() {
  console.log(`QMelanin + QRenew smoke → ${BASE}\n`);

  // ── QMelanin ────────────────────────────────────────────────────────────
  const mh = await jget("/api/qmelanin/health");
  assert(mh.status === 200 && mh.json?.status === "ok", "qmelanin /health ok", `status=${mh.status}`);
  assert((mh.json?.biomarkers ?? 0) >= 8, "qmelanin exposes biomarker panel", `n=${mh.json?.biomarkers}`);

  const assess = await jpost("/api/qmelanin/assessment", {
    age: 34, onsetAge: 26, familyHistory: true, smoking: true, diet: "vegan", stress: 8, sleepHours: 5,
  });
  assert(assess.status === 200 && assess.json?.riskBand === "high", "qmelanin assessment → high risk band", `band=${assess.json?.riskBand}`);
  assert(assess.json?.extended === true, "qmelanin high risk → extended panel");

  const labs = await jpost("/api/qmelanin/labs", {
    values: { ferritin: 18, b12: 300, copper: 65, vitaminD: 22, zinc: 95, folate: 8, selenium: 110, tsh: 1.4 },
  });
  const defKeys = labs.json?.deficientKeys || [];
  assert(labs.status === 200 && defKeys.includes("copper") && defKeys.includes("b12") && defKeys.includes("ferritin"),
    "qmelanin labs flags copper/B12/ferritin deficient", `keys=${JSON.stringify(defKeys)}`);
  assert(!defKeys.includes("zinc"), "qmelanin labs does NOT flag adequate zinc");

  const plan = await jpost("/api/qmelanin/plan", { deficientKeys: defKeys });
  const rules = (plan.json?.interactions || []).map((i) => i.rule).join(" | ");
  assert(plan.status === 200 && /цинк:медь/i.test(rules), "qmelanin plan enforces Zn:Cu interaction rule");
  assert((plan.json?.targeted || []).some((t) => t.key === "copper" && t.foods?.length),
    "qmelanin plan gives copper food sources");
  assert(plan.json?.schedule?.retestInDays === 90, "qmelanin plan schedules 90-day retest");

  // ── QRenew ──────────────────────────────────────────────────────────────
  const rh = await jget("/api/qrenew/health");
  assert(rh.status === 200 && rh.json?.status === "ok", "qrenew /health ok", `status=${rh.status}`);
  assert(rh.json?.targetedHallmarks === 4, "qrenew targets exactly 4 hallmarks", `n=${rh.json?.targetedHallmarks}`);

  const stack = await jget("/api/qrenew/stack");
  assert(stack.status === 200 && stack.json?.tiers?.A?.items?.length >= 1 && stack.json?.tiers?.D?.items?.length >= 1,
    "qrenew stack has all evidence tiers A..D");

  // PhenoAge: healthy young profile should land near/under chronological age.
  const bioYoung = await jpost("/api/qrenew/bioage", {
    albumin: 47, creatinine: 80, glucose: 4.8, crp: 0.5, lymphocytePct: 38, mcv: 89, rdw: 12.5, alp: 60, wbc: 5.5, age: 30,
  });
  assert(bioYoung.status === 200 && typeof bioYoung.json?.phenotypicAge === "number",
    "qrenew bioage returns numeric phenotypic age", `pheno=${bioYoung.json?.phenotypicAge}`);
  assert(bioYoung.json.phenotypicAge < 45 && bioYoung.json.phenotypicAge > 10,
    "qrenew PhenoAge in sane range for healthy profile", `pheno=${bioYoung.json?.phenotypicAge}`);

  // Worse inflammatory profile at same age → higher biological age.
  const bioOld = await jpost("/api/qrenew/bioage", {
    albumin: 40, creatinine: 95, glucose: 6.5, crp: 8, lymphocytePct: 20, mcv: 95, rdw: 15.5, alp: 110, wbc: 9, age: 30,
  });
  assert(bioOld.json?.phenotypicAge > bioYoung.json?.phenotypicAge,
    "qrenew PhenoAge rises with inflammatory profile", `${bioYoung.json?.phenotypicAge} → ${bioOld.json?.phenotypicAge}`);

  const missing = await jpost("/api/qrenew/bioage", { age: 40 });
  assert(missing.status === 400 && missing.json?.error === "missing_biomarkers",
    "qrenew bioage rejects incomplete input (400)");

  // Contraindication gating: diabetic must NOT be recommended FMD.
  const assessDia = await jpost("/api/qrenew/assess", { age: 55, hasDiabetes: true });
  const recIds = (assessDia.json?.recommendedStack || []).map((x) => x.id);
  assert(assessDia.status === 200 && !recIds.includes("fmd") && (assessDia.json?.contraindicationGated || []).some((g) => /Fasting/i.test(g.name)),
    "qrenew gates FMD out for diabetic profile");
  assert(recIds.includes("urolithinA") && recIds.includes("exercise"),
    "qrenew still recommends Tier A/B core");
  assert((assessDia.json?.informOnly || []).some((x) => x.tier === "D"),
    "qrenew keeps Tier D as info-only, never recommended");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${step} checks, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
