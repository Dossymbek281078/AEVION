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

// Capture a real NVIDIA key (if the operator set one) BEFORE the env wipe below,
// so section 6 can make one real network call against build.nvidia.com. Every
// other section stays fully offline/synthetic.
const REAL_NVIDIA_KEY = process.env.NVIDIA_API_KEY || "";

// Clean provider env so "configured" reflects only what each case sets.
for (const k of Object.keys(process.env)) {
  if (/_(API_KEY|TOKEN|BASE_URL)$/.test(k)) delete process.env[k];
}

const { getProviders, getFreeProviders, getLocalProviders, callProvider } = require(providersPath);
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

// 6. Provider health tracking — repeated failures on one pair sink it below
//    healthy pairs in council member selection (never remove it entirely).
const providerHealthPath = path.join(__dirname, "..", "dist", "services", "qcoreai", "providerHealth.js");
const { recordOutcome, healthScore } = require(providerHealthPath);
const orDefault = all.find((p) => p.id === "openrouter").defaultModel;
ok("healthScore starts neutral with no recorded history", healthScore("openrouter", orDefault) === 1);
for (let i = 0; i < 5; i++) recordOutcome("openrouter", orDefault, false);
ok("healthScore drops after 5 consecutive failures", healthScore("openrouter", orDefault) < 0.5);
const cHealthAware = buildCouncil(3);
ok("unhealthy pair sinks out of a 3-member council", !cHealthAware.some((m) => m.provider === "openrouter" && m.model === orDefault));
ok("healthy vendors still fill the council", cHealthAware.some((m) => m.provider === "groq") && cHealthAware.some((m) => m.provider === "cerebras"));
for (let i = 0; i < 20; i++) recordOutcome("openrouter", orDefault, true);
ok("healthScore recovers after sustained successes", healthScore("openrouter", orDefault) === 1);

// 7. NVIDIA NIM — one real network call, opt-in only. Skipped (not failed) when
//    no NVIDIA_API_KEY is set in the invoking shell, matching how the other
//    live/prod smokes gate on optional env rather than requiring it.
(async () => {
  if (!REAL_NVIDIA_KEY) {
    console.log("  – nvidia live call (skip — set NVIDIA_API_KEY to exercise integrate.api.nvidia.com)");
  } else {
    process.env.NVIDIA_API_KEY = REAL_NVIDIA_KEY;
    try {
      const res = await callProvider(
        "nvidia",
        [{ role: "user", content: "Reply with exactly one word: pong" }],
        "meta/llama-3.3-70b-instruct",
        0.2
      );
      ok("nvidia live call returns a non-empty reply", typeof res?.reply === "string" && res.reply.trim().length > 0);
    } catch (e) {
      fail++;
      console.log(`  ✗ nvidia live call — ${e?.message || e}`);
    }
  }

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
