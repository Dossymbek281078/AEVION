#!/usr/bin/env node
/**
 * Does /studio/capabilities tell the truth?
 *
 * On 2026-07-26 four capabilities reported "live" while being completely
 * broken — image (every provider blocked), video (no credit), voice (the
 * model had been deleted by the provider) and the *.aevion.build domain (the
 * zone was never delegated). Every one was found by calling the thing by
 * hand. Nothing automated would have noticed, because the capability list
 * only ever checked whether an env var was set.
 *
 * This calls the cheap end of each capability for real and compares the
 * answer with what the shop window claims. It deliberately does NOT run the
 * expensive generators (image, video, 3D): a daily paid generation is a cost
 * decision, not a health check. Those are reported as "not probed" rather
 * than assumed fine — the exact assumption this script exists to kill.
 *
 *   BASE=https://aevion.vercel.app node scripts/capability-truth-check.js
 *
 * Exit 1 when a capability claims live and the real call disagrees.
 */

const BASE = process.env.BASE || "https://aevion.vercel.app";
const API = `${BASE}/api-backend/api/devhub`;

const PAID_SO_NOT_PROBED = new Set(["image", "video", "audio_music", "screenshot_code"]);

async function json(url, init) {
  const r = await fetch(url, init);
  let body = null;
  try { body = await r.json(); } catch { /* non-JSON is still a result */ }
  return { status: r.status, body };
}

/** Cheap, side-effect-free probes. Anything that sends something to a human
 * (email, sms, whatsapp) is intentionally absent. */
const PROBES = {
  async code() {
    const r = await json(`${API}/templates`);
    return { ok: r.status === 200, detail: `templates HTTP ${r.status}` };
  },
  async translate() {
    const r = await json(`${API}/media/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok", targetLang: "EN" }),
    });
    return { ok: r.status === 200, detail: r.body?.error ? String(r.body.error).slice(0, 120) : `HTTP ${r.status}` };
  },
  async audio_tts() {
    const r = await json(`${API}/media/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok" }),
    });
    // 402 is our own quota gate, not a provider fault.
    return { ok: r.status === 200 || r.status === 402, detail: r.body?.error ? String(r.body.error).slice(0, 120) : `HTTP ${r.status}` };
  },
  async github() {
    const r = await json(`${API}/studio/capabilities`);
    const gh = (r.body?.capabilities || []).find((c) => c.id === "github");
    return { ok: !!gh, detail: "declared only — a real push would create a repo" };
  },
  async domain() {
    // The failure that hid for two weeks: records existed, the zone did not
    // resolve. Ask DNS, not Cloudflare's API.
    const host = process.env.DOMAIN_PROBE_HOST || "cf-pages-test-394137.aevion.build";
    try {
      const r = await fetch(`https://${host}`, { redirect: "follow" });
      return { ok: r.status < 500, detail: `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, detail: `does not resolve: ${String(e.message || e).slice(0, 80)}` };
    }
  },
};

(async () => {
  const caps = await json(`${API}/studio/capabilities`);
  if (caps.status !== 200) {
    console.error(`capabilities endpoint HTTP ${caps.status} — cannot compare anything`);
    process.exit(1);
  }
  const declared = caps.body.capabilities || [];
  console.log(`capabilities declared: ${declared.length}\n`);

  const mismatches = [];
  // Обратный случай: возможность объявлена НЕ рабочей, а проба успешна.
  // Блок вывода для него был добавлен без этого вычисления, и скрипт падал
  // на `staleReds is not defined` — печатал таблицу и не доходил до вердикта.
  const staleReds = [];
  for (const cap of declared) {
    const probe = PROBES[cap.id];
    if (!probe) {
      const why = PAID_SO_NOT_PROBED.has(cap.id) ? "paid generation — not probed" : "no cheap probe";
      console.log(`  ${cap.id.padEnd(16)} ${String(cap.status).padEnd(13)} (${why})`);
      continue;
    }
    let result;
    try {
      result = await probe();
    } catch (e) {
      result = { ok: false, detail: String(e.message || e).slice(0, 120) };
    }
    const claimsWorking = cap.status === "live";
    const mismatch = claimsWorking && !result.ok;
    console.log(`  ${cap.id.padEnd(16)} ${String(cap.status).padEnd(13)} real: ${result.ok ? "ok" : "FAILS"}  ${result.detail}`);
    if (mismatch) mismatches.push({ id: cap.id, declared: cap.status, detail: result.detail });
    if (!claimsWorking && result.ok) staleReds.push({ id: cap.id, detail: `объявлено ${cap.status}` });
  }

  if (staleReds.length > 0) {
    console.log(`
${staleReds.length} capability(ies) report degraded while the probe succeeds:`);
    for (const s of staleReds) console.log(`  - ${s.id}: ${s.detail} (clears within the health TTL; daily repeats mean something records failures that are not real)`);
  }

  if (staleReds.length > 0) {
    console.log(`
${staleReds.length} capability(ies) report degraded while the probe succeeds:`);
    for (const s of staleReds) console.log(`  - ${s.id}: ${s.detail} (clears within the health TTL; daily repeats mean something records failures that are not real)`);
  }

  if (mismatches.length === 0) {
    console.log("\nno capability claims to work while failing");
    return;
  }
  console.log(`\n${mismatches.length} capability(ies) claim live but fail when called:`);
  for (const m of mismatches) console.log(`  - ${m.id}: ${m.detail}`);
  process.exit(1);
})().catch((e) => {
  console.error("check failed to run:", e.message);
  process.exit(2);
});
