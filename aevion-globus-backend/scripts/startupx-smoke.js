#!/usr/bin/env node
/**
 * Startup Exchange smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/startupx-smoke.js
 *        BASE=https://aevion-production-a70c.up.railway.app node scripts/startupx-smoke.js
 *
 * Covers the capability the exchange sells, not just the fact that routes
 * answer: a tier, terms an investor can read, and a free assessment that
 * compares those terms to the market — plus the two refusals that keep the
 * feed honest (no deal terms → no listing; no demo link → no product listing).
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

const DESCRIPTION =
  "Проблема: мелкие перевозчики ищут обратный груз вручную в чатах и теряют треть рейсов на пустом " +
  "пробеге. Для кого: перевозчики с парком 1–5 машин. Мы делаем платформу, которая автоматически " +
  "подбирает груз по маршруту освободившейся машины. Зарабатываем на комиссии 5% с рейса. " +
  "В отличие от досок объявлений, подбор идёт по факту освободившейся машины.";

async function run() {
  console.log(`\nStartup Exchange smoke → ${BASE}\n`);

  console.log("1. Health + tier contract");
  const h = await req("GET", "/api/startupx/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);

  // Every route falls back to an in-memory store when Postgres is unavailable,
  // and that fallback is deliberately silent — it keeps preview deploys usable.
  // The danger is that it is ALSO silent when the migration breaks in an
  // environment that does have a database: listings would be served from RAM,
  // every assertion below would still pass, and the data would vanish on the
  // next restart. So where a database is configured, using it is not optional.
  if (process.env.DATABASE_URL) {
    assert("Postgres is actually in use (DATABASE_URL is set)", h.body?.dbReady === true,
      `dbReady=${h.body?.dbReady} — миграция или подключение сломаны, данные уходят в память`);
  } else {
    console.log("  · DATABASE_URL не задан — проверка идёт на in-memory сторе");
  }

  const tiers = await req("GET", "/api/startupx/tiers");
  assert("GET /tiers → 200", tiers.status === 200, String(tiers.status));
  const tierIds = (tiers.body?.data?.tiers ?? []).map((t) => t.id);
  assert("three tiers exposed", JSON.stringify(tierIds) === JSON.stringify(["idea", "mvp", "product"]), JSON.stringify(tierIds));
  assert("disclaimer served with the contract", /не гарантирует/.test(tiers.body?.data?.disclaimer ?? ""));
  assert("sector list served", Array.isArray(tiers.body?.data?.sectors) && tiers.body.data.sectors.length > 0);

  console.log("\n2. Free assessment of a draft (no deal terms, nothing stored)");
  const draft = await req("POST", "/api/startupx/assess", {
    title: "Draft check",
    description: DESCRIPTION,
    tier: "idea",
    sector: "marketplace",
  });
  assert("POST /assess → 200", draft.status === 200, String(draft.status));
  const draftA = draft.body?.data?.assessment;
  assert("score is a number 0–100", typeof draftA?.score === "number" && draftA.score >= 0 && draftA.score <= 100, String(draftA?.score));
  assert("nothing stored", draft.body?.data?.stored === false);
  assert("blind spots always present", Array.isArray(draftA?.blindSpots) && draftA.blindSpots.length >= 4);
  assert("disclaimer travels inside the payload", /не гарантирует/.test(draftA?.disclaimer ?? ""));
  // A Russian description must actually score: `\b` never matches before a
  // Cyrillic letter, and a regex written that way silently scored every
  // Russian listing as though it said nothing.
  const clarity = (draftA?.factors ?? []).find((f) => f.key === "clarity");
  assert("Russian text is read, not silently ignored", (clarity?.score ?? 0) > 60, `clarity=${clarity?.score}`);

  console.log("\n3. Refusals that keep the feed honest");
  const noTerms = await req("POST", "/api/startupx/ideas", {
    title: "No terms", description: DESCRIPTION, tier: "idea",
  });
  assert("publishing without deal terms → 400", noTerms.status === 400, String(noTerms.status));
  assert("the missing field is named", (noTerms.body?.issues ?? []).some((i) => i.field === "deal.intent"));

  const noDemo = await req("POST", "/api/startupx/ideas", {
    title: "No demo", description: DESCRIPTION, tier: "product",
    deal: { intent: "sell_full", askingPriceUsd: 150000 },
  });
  assert("a working product without a link → 400", noDemo.status === 400, String(noDemo.status));
  assert("demoUrl is the named field", (noDemo.body?.issues ?? []).some((i) => i.field === "demoUrl"));

  console.log("\n4. Publish a listing with terms");
  const tag = `smoke-${Date.now()}`;
  const sub = await req("POST", "/api/startupx/ideas", {
    title: `Smoke listing ${tag}`,
    description: DESCRIPTION,
    tier: "idea",
    sector: "marketplace",
    geography: "KZ",
    deal: { intent: "raise", askUsd: 30000, equityOfferedPct: 15, buildBy: "founder" },
    founderEmail: "smoke@test.local",
    contactMethod: "@smoke_bot",
  });
  assert("POST /ideas → 201", sub.status === 201, String(sub.status));
  const created = sub.body?.data;
  assert("listing id returned", !!created?.id, JSON.stringify(sub.body).slice(0, 200));
  assert("content hash stamped", typeof created?.contentHash === "string" && created.contentHash.length === 64);
  assert("manage token issued once", typeof created?.manageToken === "string" && /^[0-9a-f]{64}$/.test(created.manageToken));
  assert("tier persisted", created?.listing?.tier === "idea", String(created?.listing?.tier));
  // $30k for 15% is a $200k post-money — the number an investor reads first.
  assert("implied post-money computed", created?.assessment?.deal?.implied?.postMoneyUsd === 200000,
    String(created?.assessment?.deal?.implied?.postMoneyUsd));
  assert("market band attached", (created?.assessment?.deal?.band?.high ?? 0) > 0);

  const listingId = created?.id;

  console.log("\n5. Feed reads back the tier and the score");
  const list = await req("GET", "/api/startupx/ideas?limit=5&tier=idea&sort=score");
  assert("GET /ideas → 200", list.status === 200, String(list.status));
  assert("listings array present", Array.isArray(list.body?.data?.listings));
  assert("tier filter honoured", (list.body?.data?.listings ?? []).every((l) => l.tier === "idea"));

  console.log("\n6. Single listing");
  if (listingId) {
    const single = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("GET /ideas/:id → 200", single.status === 200, String(single.status));
    assert("id matches", single.body?.data?.id === listingId);
    assert("interest_count present", typeof single.body?.data?.interest_count === "number");
    assert("assessment stored with the row", typeof single.body?.data?.assessment?.score === "number");
  } else {
    console.log("  (skipped — no listing id)");
  }

  console.log("\n7. Investor offer carries terms, not just an email");
  if (listingId) {
    const interest = await req("POST", `/api/startupx/ideas/${listingId}/interest`, {
      investorEmail: "investor@smoke.local",
      message: "Smoke test interest",
      intent: "raise",
      ticketUsd: 10000,
      equityPct: 5,
    });
    assert("POST /interest → 201", interest.status === 201, String(interest.status));
    assert("intent recorded", interest.body?.data?.intent === "raise", JSON.stringify(interest.body?.data));
  }

  console.log("\n8. The founder can actually read the offers");
  if (listingId && created?.manageToken) {
    const mine = await req("GET", `/api/startupx/ideas/${listingId}/offers?token=${created.manageToken}`);
    assert("GET /offers with the founder's token → 200", mine.status === 200, String(mine.status));
    const offers = mine.body?.data?.offers ?? [];
    assert("the offer sent in step 7 is there", offers.length >= 1, `count=${offers.length}`);
    assert("terms came through, not just an email",
      offers[0]?.ticketUsd === 10000 && offers[0]?.equityPct === 5 && offers[0]?.intent === "raise",
      JSON.stringify(offers[0]));

    const stranger = await req("GET", `/api/startupx/ideas/${listingId}/offers?token=${"0".repeat(64)}`);
    assert("a wrong token → 401", stranger.status === 401, String(stranger.status));
    const bare = await req("GET", `/api/startupx/ideas/${listingId}/offers`);
    assert("no token → 401", bare.status === 401, String(bare.status));
  }

  console.log("\n9. Correcting the terms after reading the analysis");
  // The analysis says the ask is above market; the founder's next move is to
  // change the number. Editing must re-score, and must not touch the text the
  // authorship stamp covers.
  if (listingId && created?.manageToken) {
    const before = created.assessment?.deal?.implied?.postMoneyUsd;
    const edited = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      deal: { intent: "raise", askUsd: 20000, equityOfferedPct: 20, buildBy: "founder" },
    });
    assert("PATCH with the founder's token → 200", edited.status === 200, String(edited.status));
    const after = edited.body?.data?.assessment?.deal?.implied?.postMoneyUsd;
    assert("the implied valuation is recomputed", after === 100000, `before=${before} after=${after}`);
    assert("the authorship stamp still covers the original text",
      edited.body?.data?.listing?.content_hash === created.contentHash,
      `${edited.body?.data?.listing?.content_hash} vs ${created.contentHash}`);

    const refused = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      deal: { intent: "raise", askUsd: 20000 },
    });
    assert("an edit that breaks the rules is refused → 400", refused.status === 400, String(refused.status));

    const stranger = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${"0".repeat(64)}`, {
      deal: { intent: "raise", askUsd: 1, equityOfferedPct: 99 },
    });
    assert("a wrong token cannot edit → 401", stranger.status === 401, String(stranger.status));
  }

  console.log("\n10. The run cleans up after itself");
  // Prod once held 19 listings, all of them "Smoke Idea …", because every night
  // this script published one more and nothing ever took it down. A withdrawal
  // is a real founder action, so the smoke exercises the feature AND stops
  // filling the public feed with test data.
  if (listingId && created?.manageToken) {
    const gone = await req("DELETE", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`);
    assert("DELETE with the founder's token → 200", gone.status === 200, String(gone.status));
    const after = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("withdrawn listing disappears from the public surface", after.status === 404, String(after.status));
    const stillMine = await req("GET", `/api/startupx/ideas/${listingId}/offers?token=${created.manageToken}`);
    assert("but the founder still sees the offers already received", stillMine.status === 200, String(stillMine.status));

    // Withdrawal must not be a one-way door: taking a listing down by mistake
    // should not cost the id, the authorship stamp and every offer on it.
    const restored = await req("PATCH", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`, {
      restore: true,
      deal: { intent: "raise", askUsd: 20000, equityOfferedPct: 20, buildBy: "founder" },
    });
    assert("a withdrawn listing can be restored", restored.status === 200, String(restored.status));
    const back = await req("GET", `/api/startupx/ideas/${listingId}`);
    assert("and is public again", back.status === 200, String(back.status));

    // Put it back down so the run still leaves the feed as it found it.
    await req("DELETE", `/api/startupx/ideas/${listingId}?token=${created.manageToken}`);
  }

  console.log("\n11. Stats");
  const stats = await req("GET", "/api/startupx/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total is a number", typeof stats.body?.data?.total === "number");
  assert("byTier present", typeof stats.body?.data?.byTier === "object");
  assert("byStage kept for older consumers", typeof stats.body?.data?.byStage === "object");

  console.log(`\nStartup Exchange: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
