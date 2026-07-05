#!/usr/bin/env node
/**
 * QCoreAI free-fleet + council — offline smoke.
 *
 * No server / DB / API keys required. Exercises the provider catalogue and the
 * council-assembly logic directly against the compiled dist, asserting:
 *   - the free fleet is present (OpenRouter/Groq/Cerebras/Mistral/Together/…),
 *   - council auto-assembles preferring FREE vendors,
 *   - it degrades gracefully to one vendor's models,
 *   - the Synthesizer prefers Fable 5.
 *
 * Run (from aevion-globus-backend/, after `npx tsc`):
 *   node scripts/qcore-fleet-smoke.js
 */

const path = require("path");
const providersPath = path.join(__dirname, "..", "dist", "services", "qcoreai", "providers.js");
const agentsPath = path.join(__dirname, "..", "dist", "services", "qcoreai", "agents.js");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

// Clean provider env so "configured" reflects only what each case sets.
for (const k of Object.keys(process.env)) {
  if (/_(API_KEY|TOKEN)$/.test(k) || k === "OLLAMA_BASE_URL") delete process.env[k];
}

const { getProviders, getFreeProviders } = require(providersPath);
const { buildCouncil, buildSynthesizer } = require(agentsPath);

console.log("QCoreAI free-fleet + council smoke\n");

// 1. Catalogue
const all = getProviders();
ok("catalogue has >= 10 providers", all.length >= 10);
const freeIds = all.filter((p) => p.free).map((p) => p.id);
for (const id of ["openrouter", "groq", "cerebras", "mistral", "together", "github", "ollama"]) {
  ok(`free fleet includes ${id}`, freeIds.includes(id));
}
ok("anthropic is premium (not free)", all.find((p) => p.id === "anthropic")?.tier === "premium" && all.find((p) => p.id === "anthropic")?.free === false);

// 2. Only Anthropic configured → council degrades to varied Anthropic models; synth = Fable 5.
process.env.ANTHROPIC_API_KEY = "sk-test";
ok("no free vendor configured yet", getFreeProviders().length === 0);
const cSolo = buildCouncil(3);
ok("council degrades to 3 members on one vendor", cSolo.length === 3);
ok("solo council all anthropic", cSolo.every((m) => m.provider === "anthropic"));
ok("solo council uses distinct models", new Set(cSolo.map((m) => m.model)).size === cSolo.length);
ok("synthesizer prefers Fable 5", buildSynthesizer()?.model === "claude-fable-5");

// 3. Free fleet configured → council prefers FREE vendors first.
process.env.OPENROUTER_API_KEY = "o";
process.env.GROQ_API_KEY = "g";
process.env.CEREBRAS_API_KEY = "c";
ok("3 free vendors now configured", getFreeProviders().length === 3);
const cFleet = buildCouncil(3);
ok("fleet council has 3 members", cFleet.length === 3);
ok("fleet council all free vendors", cFleet.every((m) => ["openrouter", "groq", "cerebras"].includes(m.provider)));
ok("fleet council personas distinct", new Set(cFleet.map((m) => m.persona)).size === 3);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
