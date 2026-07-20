#!/usr/bin/env node
/**
 * QCoreAI free-fleet + council — offline smoke.
 *
 * No server / DB / API keys required. Exercises the provider catalogue and the
 * council-assembly logic directly against the compiled dist, asserting:
 *   - the free fleet is present (OpenRouter/Groq/Cerebras/Mistral/Together/…),
 *   - council auto-assembles preferring FREE vendors,
 *   - it degrades gracefully to one vendor's models,
 *   - the Synthesizer defaults to Opus 4.8 (best quality/cost chair),
 *   - local runtimes (Ollama/LM Studio/Jan/LocalAI/llama.cpp) are catalogued,
 *   - the offline council convenes crowd + chair from local runtimes only.
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
  if (/_(API_KEY|TOKEN|BASE_URL)$/.test(k)) delete process.env[k];
}

const { getProviders, getFreeProviders, getLocalProviders } = require(providersPath);
const { buildCouncil, buildSynthesizer } = require(agentsPath);

console.log("QCoreAI free-fleet + council smoke\n");

// 1. Catalogue
const all = getProviders();
ok("catalogue has >= 10 providers", all.length >= 10);
const freeIds = all.filter((p) => p.free).map((p) => p.id);
for (const id of ["openrouter", "groq", "cerebras", "mistral", "together", "github", "nvidia", "ollama"]) {
  ok(`free fleet includes ${id}`, freeIds.includes(id));
}
ok("anthropic is premium (not free)", all.find((p) => p.id === "anthropic")?.tier === "premium" && all.find((p) => p.id === "anthropic")?.free === false);
// NVIDIA NIM: cloud free-tier gateway — catalogued but INACTIVE until its key is
// set (prod-safety: no NVIDIA_API_KEY => not configured => never joins a council).
const nv = all.find((p) => p.id === "nvidia");
ok("nvidia is a cloud free provider (not local)", nv?.free === true && nv?.tier === "free" && !nv?.local);
ok("nvidia unconfigured without NVIDIA_API_KEY", nv?.configured === false);
ok("nvidia carries frontier model ids", Array.isArray(nv?.models) && nv.models.length >= 3);

// 2. Only Anthropic configured → council degrades to varied Anthropic models; synth = Opus 4.8.
process.env.ANTHROPIC_API_KEY = "sk-test";
ok("no free vendor configured yet", getFreeProviders().length === 0);
const cSolo = buildCouncil(3);
ok("council degrades to 3 members on one vendor", cSolo.length === 3);
ok("solo council all anthropic", cSolo.every((m) => m.provider === "anthropic"));
ok("solo council uses distinct models", new Set(cSolo.map((m) => m.model)).size === cSolo.length);
ok("synthesizer defaults to Opus 4.8", buildSynthesizer()?.model === "claude-opus-4-8");
ok("synthesizer honours QCOREAI_SYNTH_MODEL env", (() => {
  process.env.QCOREAI_SYNTH_MODEL = "claude-fable-5";
  const m = buildSynthesizer()?.model;
  delete process.env.QCOREAI_SYNTH_MODEL;
  return m === "claude-fable-5";
})());
ok("synthesizer honours explicit synthModel override", buildSynthesizer({ provider: "anthropic", model: "claude-fable-5" })?.model === "claude-fable-5");

// 3. Free fleet configured → council prefers FREE vendors first.
process.env.OPENROUTER_API_KEY = "o";
process.env.GROQ_API_KEY = "g";
process.env.CEREBRAS_API_KEY = "c";
ok("3 free vendors now configured", getFreeProviders().length === 3);
const cFleet = buildCouncil(3);
ok("fleet council has 3 members", cFleet.length === 3);
ok("fleet council all free vendors", cFleet.every((m) => ["openrouter", "groq", "cerebras"].includes(m.provider)));
ok("fleet council personas distinct", new Set(cFleet.map((m) => m.persona)).size === 3);

// 4. Local runtimes (offline) — catalogue + offline council assembly.
const localIds = all.filter((p) => p.local).map((p) => p.id);
for (const id of ["ollama", "lmstudio", "jan", "localai", "llamacpp"]) {
  ok(`local runtimes include ${id}`, localIds.includes(id));
}
ok("all local runtimes are free", all.filter((p) => p.local).every((p) => p.free === true));
ok("no local runtime configured yet", getLocalProviders().length === 0);
// Offline council with no local runtime must NOT assemble (guarantee preserved).
ok("offline council empty without local runtime", buildCouncil(3, undefined, { localOnly: true }).length === 0);
ok("offline synth null without local runtime", buildSynthesizer(undefined, { localOnly: true }) === null);

// Configure a local runtime (LM Studio). Cloud free vendors are still set from
// section 3 — offline mode must ignore them and use only the local runtime.
process.env.LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
ok("1 local runtime now configured", getLocalProviders().length === 1);
const cOffline = buildCouncil(3, undefined, { localOnly: true });
ok("offline council assembles from local runtime", cOffline.length >= 2);
ok("offline council all local", cOffline.every((m) => m.provider === "lmstudio"));
ok("offline council ignores cloud free vendors", cOffline.every((m) => !["openrouter", "groq", "cerebras"].includes(m.provider)));
const offSynth = buildSynthesizer(undefined, { localOnly: true });
ok("offline synth is a local runtime", offSynth?.provider === "lmstudio");
// Cloud override must be ignored under offline; a local override is honoured.
ok("offline synth ignores cloud override", buildSynthesizer({ provider: "anthropic", model: "claude-opus-4-8" }, { localOnly: true })?.provider === "lmstudio");
// Sanity: non-offline council still prefers the cloud free fleet, not the local one.
ok("online council still uses cloud free fleet", buildCouncil(3).some((m) => ["openrouter", "groq", "cerebras"].includes(m.provider)));

// 5. Discovered (real, pulled) models override the static catalogue offline.
// Simulates what discoverLocalModels() returns from a live Ollama runtime.
const discovered = { lmstudio: ["qwen2.5:7b", "llama3.2:3b", "phi3:mini"] };
const cDisc = buildCouncil(3, undefined, { localOnly: true, localModels: discovered });
ok("offline council uses discovered models", cDisc.every((m) => discovered.lmstudio.includes(m.model)));
ok("offline council rejects non-discovered static models", cDisc.every((m) => !["qwen2.5-7b-instruct"].includes(m.model)));
ok("offline chair uses a discovered model", (() => {
  const s = buildSynthesizer(undefined, { localOnly: true, localModels: discovered });
  return s && s.provider === "lmstudio" && discovered.lmstudio.includes(s.model);
})());
// Empty discovery (runtime unreachable) falls back to the static catalogue.
ok("offline council falls back to static when discovery empty", buildCouncil(3, undefined, { localOnly: true, localModels: {} }).length >= 2);

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
