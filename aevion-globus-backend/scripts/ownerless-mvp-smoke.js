#!/usr/bin/env node
/**
 * AEVION ownerless-MVP frontend smoke — verifies the 10 module landings
 * shipped 2026-05-12 actually render in production with their key content.
 *
 * Usage:
 *   node aevion-globus-backend/scripts/ownerless-mvp-smoke.js
 *   FRONT=https://aevion.app node ./aevion-globus-backend/scripts/ownerless-mvp-smoke.js
 *
 * Read-only — safe in any environment including prod.
 * Exits 0 on full PASS, 1 on any failure.
 */

const FRONT = (process.env.FRONT || "https://aevion.app").replace(/\/+$/, "");

const MVPS = [
  // 19.08.2026: смоук краснел на ЗДОРОВОЙ странице. Он искал английское
  // "doppelganger", а страницу перевели на русский — там теперь «двойник».
  // Размер 36 КБ, как у соседних проходящих, содержимое на месте.
  //
  // Слово-ожидание должно пережить перевод, иначе сторож краснеет на каждой
  // работе над текстом и его отключают. Оставляем название модуля (оно не
  // переводится) и принимаем оба языка для смыслового слова.
  { id: "qpersona", contains: ["QPersona"], containsAny: ["doppelganger", "двойник"] },
  { id: "qlife", contains: ["QLife", "Personal", "OS"] },
  { id: "voice-of-earth", contains: ["Voice of Earth", "language", "royalty"] },
  { id: "kids-ai-content", contains: ["Kids AI", "safe", "AI"] },
  { id: "startup-exchange", contains: ["Startup", "Pitch", "QRight"] },
  { id: "shadownet", contains: ["ShadowNet", "metadata", "mesh"] },
  { id: "deepsan", contains: ["DeepSan", "Inbox", "Focus"] },
  { id: "psyapp-deps", contains: ["PsyApp", "trigger", "anonymous"] },
  { id: "mapreality", contains: ["MapReality", "signals", "QSign"] },
  { id: "lifebox", contains: ["LifeBox", "Shamir"] },
  // Live catalog browser (separate from MVPs but in same scope)
  { id: "fintech/catalog", contains: ["catalog", "AEVION"] },
];

let pass = 0;
let fail = 0;

async function checkOne({ id, contains, containsAny }) {
  const url = `${FRONT}/${id}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { Accept: "text/html" } });
    const ms = Date.now() - t0;
    if (!r.ok) {
      console.log(`  ❌ /${id.padEnd(20)} (${ms}ms) HTTP ${r.status}`);
      fail++;
      return;
    }
    const html = await r.text();
    const lower = html.toLowerCase();
    const missing = contains.filter((kw) => !lower.includes(kw.toLowerCase()));
    // containsAny: достаточно ОДНОГО из вариантов. Так ожидание переживает
    // перевод страницы, не переставая ловить пустую оболочку: название модуля
    // в contains остаётся обязательным.
    if (Array.isArray(containsAny) && containsAny.length
        && !containsAny.some((kw) => lower.includes(kw.toLowerCase()))) {
      missing.push(containsAny.join("|"));
    }
    if (missing.length > 0) {
      console.log(`  ⚠️  /${id.padEnd(20)} (${ms}ms) missing: [${missing.join(", ")}]`);
      fail++;
      return;
    }
    console.log(`  ✅ /${id.padEnd(20)} (${ms}ms) ${html.length}B`);
    pass++;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`  ❌ /${id.padEnd(20)} (${ms}ms) ${e.message}`);
    fail++;
  }
}

(async () => {
  console.log(`[ownerless-mvp-smoke] Target: ${FRONT}`);
  console.log("");
  for (const mvp of MVPS) await checkOne(mvp);
  console.log("");
  console.log(`[ownerless-mvp-smoke] PASS=${pass}/${MVPS.length} FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("[ownerless-mvp-smoke] FATAL:", e?.stack || e);
  process.exit(2);
});
