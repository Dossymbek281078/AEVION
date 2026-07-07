#!/usr/bin/env node
/**
 * QCoreAI Council eval harness.
 *
 * Proves — with numbers — whether the Council beats a single flagship, and at
 * what cost. Runs a benchmark question set through four modes against the LIVE
 * backend, then uses Claude Fable 5 as an impartial pairwise judge.
 *
 *   Modes:
 *     single-fable  — one call to claude-fable-5           (premium baseline)
 *     single-free   — one call to the default free model    (cheap baseline)
 *     council-l1    — Council, 1 layer  (crowd → Fable synth)
 *     council-l2    — Council, 2 layers (crowd → aggregators → Fable synth)
 *
 *   Judge: Fable 5 compares each Council answer vs the single-fable answer,
 *   A/B order randomised per item to cancel position bias. Reports win / tie /
 *   loss + win-rate, plus average cost/answer per mode.
 *
 * Usage (needs a deployed backend with ANTHROPIC + a free provider configured):
 *   node scripts/qcore-eval.js
 *   BASE=https://aevion.vercel.app/api-backend QCORE_EVAL_N=8 node scripts/qcore-eval.js
 *
 * Notes:
 *   - Free models can 429 under load; the backend auto-falls-back, and this
 *     script paces calls + retries. Keep N modest for a quick read.
 *   - Costs: Council cost comes from the run's own `done.totalCostUsd`.
 *     single-fable is computed from returned usage × list price. free = $0.
 */

const BASE = (process.env.BASE || "https://aevion.vercel.app/api-backend").replace(/\/+$/, "");
const CHAT = `${BASE}/api/qcoreai/chat`;
const MULTI = `${BASE}/api/qcoreai/multi-agent`;
const PACE_MS = Number(process.env.QCORE_EVAL_PACE || 1200);
const FABLE = "claude-fable-5";

// Curated benchmark set — MT-Bench / AlpacaEval-flavoured, across categories.
const QUESTIONS = [
  { cat: "reasoning", q: "A bat and a ball cost $1.10 total. The bat costs $1.00 more than the ball. How much is the ball? Explain briefly." },
  { cat: "reasoning", q: "Three switches outside a room control three bulbs inside; you can enter once. How do you determine which switch controls which bulb?" },
  { cat: "math", q: "If a train travels 60 km in 45 minutes, what is its average speed in km/h? Show the steps." },
  { cat: "math", q: "What is the sum of all integers from 1 to 100, and what's the fastest way to compute it?" },
  { cat: "coding", q: "Write a Python function that returns True if a string is a palindrome, ignoring case and non-alphanumeric characters." },
  { cat: "coding", q: "Explain the difference between a SQL INNER JOIN and LEFT JOIN with a tiny example." },
  { cat: "knowledge", q: "Explain the greenhouse effect to a curious 12-year-old in under 120 words." },
  { cat: "knowledge", q: "What are the main trade-offs between TCP and UDP? Give two concrete use-cases for each." },
  { cat: "writing", q: "Write a 4-line thank-you note to a mentor who taught you to stay calm under pressure." },
  { cat: "writing", q: "Rewrite this to be clearer and warmer: 'Your request has been processed and the item will arrive at some point.'" },
  { cat: "advice", q: "A solo founder has 3 months of runway and two half-built products. How should they decide what to focus on?" },
  { cat: "analysis", q: "Give the strongest argument FOR and the strongest argument AGAINST remote-only engineering teams, then a balanced verdict." },
  { cat: "reasoning", q: "You have a 3-litre jug and a 5-litre jug. How do you measure exactly 4 litres?" },
  { cat: "knowledge", q: "Why does the moon appear larger near the horizon? Is it actually larger there?" },
  { cat: "writing", q: "Write a one-sentence product tagline for an app that runs many free AI models and fuses their answers with a premium model." },
  { cat: "analysis", q: "Is it better to hardcode a list of AI models or fetch them dynamically at runtime? Give the trade-offs and a recommendation." },
];

/* ── HTTP helpers ─────────────────────────────────────────────────────────── */

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function postChat(body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.reply) return data;
      // fall through to retry on transient failure
    } catch (_) { /* retry */ }
    await sleep(PACE_MS * (i + 1));
  }
  return null;
}

// Reads the /multi-agent SSE stream, returns { final, costUsd, layers, agents }.
async function postCouncil(input, councilLayers, tries = 2) {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const r = await fetch(MULTI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, strategy: "council", councilSize: 3, councilLayers }),
      });
      if (!r.ok || !r.body) { await sleep(PACE_MS * (attempt + 1)); continue; }
      const text = await r.text();
      let final = "", costUsd = 0, layers = councilLayers, agents = 0;
      for (const line of text.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let e; try { e = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (e.type === "agent_start") agents++;
        if (e.type === "plan" && typeof e.councilLayers === "number") layers = e.councilLayers;
        if (e.type === "final") final = e.content || "";
        if (e.type === "done" && typeof e.totalCostUsd === "number") costUsd = e.totalCostUsd;
      }
      if (final) return { final, costUsd, layers, agents };
    } catch (_) { /* retry */ }
    await sleep(PACE_MS * (attempt + 1));
  }
  return null;
}

// Fable list price: $10 / 1M input, $50 / 1M output.
function fableCost(usage) {
  const tin = Number(usage?.input_tokens ?? usage?.inputTokens ?? 0) || 0;
  const tout = Number(usage?.output_tokens ?? usage?.outputTokens ?? 0) || 0;
  return (tin * 10 + tout * 50) / 1_000_000;
}

/* ── Judge (Fable 5, pairwise, order-randomised) ──────────────────────────── */

async function judge(question, answerA, answerB) {
  const sys =
    "You are an impartial expert judge. You will see a question and two answers (A and B). " +
    "Decide which answer is better overall, weighing accuracy first, then completeness, clarity, and helpfulness. " +
    "Reply with EXACTLY one token: A, B, or TIE. No other text.";
  const user = `Question:\n${question}\n\n[Answer A]\n${answerA}\n\n[Answer B]\n${answerB}\n\nWhich is better? Reply A, B, or TIE.`;
  const data = await postChat({
    provider: "anthropic",
    model: FABLE,
    messages: [{ role: "system", content: sys }, { role: "user", content: user }],
  });
  const t = (data?.reply || "").trim().toUpperCase();
  if (t.startsWith("A")) return "A";
  if (t.startsWith("B")) return "B";
  return "TIE";
}

// Compare `candidate` vs the `baseline` (single-fable), returning win/tie/loss
// FROM THE CANDIDATE'S PERSPECTIVE, with A/B slot randomised.
async function compare(question, candidate, baseline) {
  const candFirst = Math.random() < 0.5;
  const a = candFirst ? candidate : baseline;
  const b = candFirst ? baseline : candidate;
  const verdict = await judge(question, a, b);
  if (verdict === "TIE") return "tie";
  const candWon = candFirst ? verdict === "A" : verdict === "B";
  return candWon ? "win" : "loss";
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

(async () => {
  const N = Math.min(Number(process.env.QCORE_EVAL_N || QUESTIONS.length), QUESTIONS.length);
  const set = QUESTIONS.slice(0, N);
  console.log(`QCoreAI Council eval — ${N} questions vs ${BASE}\n`);

  const modes = {
    "single-fable": { cost: [], answers: [] },
    "single-free": { cost: [], answers: [] },
    "council-l1": { cost: [], answers: [] },
    "council-l2": { cost: [], answers: [] },
  };
  // win/tie/loss of each candidate vs single-fable
  const duel = { "single-free": { win: 0, tie: 0, loss: 0 }, "council-l1": { win: 0, tie: 0, loss: 0 }, "council-l2": { win: 0, tie: 0, loss: 0 } };

  for (let i = 0; i < set.length; i++) {
    const { q, cat } = set[i];
    process.stdout.write(`[${i + 1}/${N}] (${cat}) generating… `);

    const fable = await postChat({ provider: "anthropic", model: FABLE, messages: [{ role: "user", content: q }] });
    await sleep(PACE_MS);
    const free = await postChat({ provider: "openrouter", messages: [{ role: "user", content: q }] });
    await sleep(PACE_MS);
    const l1 = await postCouncil(q, 1);
    await sleep(PACE_MS);
    const l2 = await postCouncil(q, 2);
    await sleep(PACE_MS);

    if (!fable?.reply) { console.log("skip (no fable baseline)"); continue; }
    modes["single-fable"].answers[i] = fable.reply;
    modes["single-fable"].cost.push(fableCost(fable.usage));
    if (free?.reply) { modes["single-free"].answers[i] = free.reply; modes["single-free"].cost.push(0); }
    if (l1?.final) { modes["council-l1"].answers[i] = l1.final; modes["council-l1"].cost.push(l1.costUsd); }
    if (l2?.final) { modes["council-l2"].answers[i] = l2.final; modes["council-l2"].cost.push(l2.costUsd); }

    // Judge each candidate vs the fable baseline.
    for (const cand of ["single-free", "council-l1", "council-l2"]) {
      const ans = modes[cand].answers[i];
      if (!ans) continue;
      const res = await compare(q, ans, fable.reply);
      duel[cand][res]++;
      await sleep(PACE_MS);
    }
    console.log("done");
  }

  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) + "%" : "—");

  console.log("\n════════════════ RESULTS ════════════════\n");
  console.log("Cost per answer (USD):");
  for (const m of Object.keys(modes)) {
    console.log(`  ${m.padEnd(13)} $${avg(modes[m].cost).toFixed(4)}  (n=${modes[m].cost.length})`);
  }

  console.log("\nWin-rate vs single Fable 5 (judge: Fable 5, order-randomised):");
  console.log("  candidate       win  tie  loss   win-rate*");
  for (const cand of ["council-l2", "council-l1", "single-free"]) {
    const d = duel[cand];
    const decided = d.win + d.loss;
    // win-rate* = wins / decided (ties excluded) — >50% means it beats the flagship
    console.log(`  ${cand.padEnd(14)} ${String(d.win).padStart(3)} ${String(d.tie).padStart(4)} ${String(d.loss).padStart(5)}   ${pct(d.win, decided)}`);
  }
  console.log("\n* win-rate excludes ties; >50% = beats the single flagship.");

  const l2 = duel["council-l2"], l2dec = l2.win + l2.loss;
  const l2rate = l2dec ? (100 * l2.win) / l2dec : 0;
  const cheaper = avg(modes["council-l2"].cost) < avg(modes["single-fable"].cost);
  console.log(`\nVerdict: Council L2 win-rate vs flagship = ${l2rate.toFixed(0)}% (ties excluded); ` +
    `${cheaper ? "CHEAPER" : "not cheaper"} per answer than single Fable 5.`);
})();
