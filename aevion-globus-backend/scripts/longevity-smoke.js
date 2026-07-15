#!/usr/bin/env node
/**
 * AEVION Longevity — deterministic engine smoke test.
 *
 * DB-free pure-compute router (measure → act → re-measure). No seed / no Postgres.
 * Exercises endpoint shapes + a few invariants: panel exposure, out-of-range
 * flagging, contraindication gating, deterministic weekly plan, direction-aware
 * progress scoring.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/longevity-smoke.js
 * Env: BASE default http://127.0.0.1:4001 . Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");

let step = 0;
let failed = 0;
function ok(name, extra) { step += 1; console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`); }
function fail(name, reason) { step += 1; failed += 1; console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}${reason ? "  — " + reason : ""}`); }
function assert(cond, name, reason) { if (cond) ok(name); else fail(name, reason); }

async function jpost(path, body) {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function jget(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function main() {
  console.log(`Longevity smoke → ${BASE}\n`);

  // health
  const h = await jget("/api/longevity/health");
  assert(h.status === 200 && h.json?.status === "ok", "longevity /health ok", `status=${h.status}`);
  assert((h.json?.panelMarkers ?? 0) >= 20, "longevity exposes full panel (>=20 markers)", `n=${h.json?.panelMarkers}`);
  assert((h.json?.cycleWeeks ?? 0) === 12, "longevity 12-week cycle");

  // panel
  const panel = await jget("/api/longevity/panel");
  assert(panel.status === 200 && panel.json?.groups?.["Функциональные"]?.length > 0, "panel returns grouped markers incl functional");
  assert(panel.json?.gradeLegend?.A && panel.json?.gradeLegend?.E, "panel exposes A..E grade legend");

  // assess — flag out-of-range + personalized stack
  const assess = await jpost("/api/longevity/assess", {
    values: { vitD: 22, hsCRP: 3.2, homaIR: 2.6, omega3Index: 4.5, vo2max: 30, glucose: 6.1 },
    flags: {},
  });
  const flaggedKeys = (assess.json?.flaggedMarkers || []).map((f) => f.key);
  assert(assess.status === 200 && flaggedKeys.includes("vitD") && flaggedKeys.includes("hsCRP") && flaggedKeys.includes("homaIR"),
    "assess flags low vitD + high hs-CRP/HOMA-IR", `keys=${JSON.stringify(flaggedKeys)}`);
  assert((assess.json?.recommendedStack || []).some((it) => it.grade === "A"), "assess recommends grade-A core");
  const firstTargeted = (assess.json?.recommendedStack || [])[0]?.targeted;
  assert(firstTargeted === true, "assess floats targeted interventions to the top");
  assert((assess.json?.informOnly || []).some((it) => /NMN|NR|Волновые/i.test(it.name)), "assess keeps NAD-boosters / wave-gadgets info-only");
  assert(assess.json?.saved === false && assess.json?.measurementId === null, "assess stays stateless for anonymous callers (saved=false)");

  // history — 401 without a token (no anonymous history)
  const hist = await jget("/api/longevity/history");
  assert(hist.status === 401, "history requires auth (401 anonymous)", `status=${hist.status}`);

  // assess — contraindication gating
  const gated = await jpost("/api/longevity/assess", { values: {}, flags: { diabetes: true, pregnant: true } });
  const gatedNames = (gated.json?.contraindicationGated || []).map((g) => g.name).join(" | ");
  assert(/окно питания|пост/i.test(gatedNames), "assess gates fasting/TRE under diabetes+pregnancy", `gated=${gatedNames}`);
  assert(!(gated.json?.recommendedStack || []).some((it) => it.id === "tre"), "gated item absent from recommended stack");

  // ai-plan — deterministic fallback shape (works with no AI provider)
  const plan = await jpost("/api/longevity/ai-plan", { flags: {} });
  assert(plan.status === 200 && plan.json?.weekPlan?.monday && Array.isArray(plan.json?.allowedItems),
    "ai-plan returns a weekly plan + allowed items", `source=${plan.json?.source}`);

  // progress — direction-aware improvement
  const prog = await jpost("/api/longevity/progress", {
    baseline: { hsCRP: 3.2, homaIR: 2.6, vitD: 22, omega3Index: 4.5, vo2max: 30, waist: 98, phenoAge: 52 },
    latest: { hsCRP: 0.8, homaIR: 1.3, vitD: 48, omega3Index: 8.4, vo2max: 38, waist: 90, phenoAge: 49 },
  });
  assert(prog.status === 200 && prog.json?.trajectory === "improving" && prog.json?.progressScore >= 80,
    "progress scores an all-better cycle as improving", `score=${prog.json?.progressScore}`);
  const worse = await jpost("/api/longevity/progress", {
    baseline: { hsCRP: 0.8, vitD: 48, vo2max: 40 },
    latest: { hsCRP: 2.5, vitD: 30, vo2max: 33 },
  });
  assert(worse.json?.trajectory === "worsening", "progress detects a worsening cycle", `traj=${worse.json?.trajectory}`);
  const empty = await jpost("/api/longevity/progress", { baseline: {}, latest: {} });
  assert(empty.status === 400 && empty.json?.error === "no_comparable_metrics", "progress rejects empty payload (400)");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${step} checks, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
