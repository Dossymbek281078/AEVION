#!/usr/bin/env node
/**
 * Checkout rails PROD smoke — каскад процессингов + новые каналы PayBox/PayPal.
 * Проверяет: LS-чекаут (6/6 tier×period real), webhook-liveness PayBox/PayPal,
 * отклонение поддельной подписи PayBox (401), и что KZT/PayPal без ENV
 * корректно деградируют в дефолтный каскад (LS), а не падают.
 *
 * Usage: BASE=https://... node scripts/checkout-rails-prod-smoke.js
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(12000) });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
}
async function post(path, payload, form = false) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? payload : JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
}

async function run() {
  console.log(`\nCheckout rails PROD smoke → ${BASE}\n`);

  // 1-2. Healthz каскада
  const hz = await get("/api/pricing/checkout/healthz");
  hz.status === 200 && hz.body?.ok ? ok("GET /pricing/checkout/healthz → 200 ok") : fail("checkout healthz", String(hz.status));
  hz.body?.primaryProvider ? ok("primaryProvider present", hz.body.primaryProvider) : fail("primaryProvider present");

  // 3-8. LS-чекаут: все 6 комбинаций tier×period → real
  for (const tier of ["lite", "medium", "full"]) {
    for (const period of ["monthly", "annual"]) {
      const r = await post("/api/pricing/checkout/session", { tierId: tier, period, modules: ["cyberchess"] });
      const realUrl = r.status === 200 && r.body?.mode === "real" && typeof r.body?.url === "string";
      realUrl ? ok(`checkout ${tier}/${period} → real`, r.body.provider) : fail(`checkout ${tier}/${period} → real`, `${r.status} ${r.body?.mode}`);
    }
  }

  // 9. KZT без PAYBOX → graceful fallback в каскад (real, не падение)
  const kzt = await post("/api/pricing/checkout/session", { tierId: "lite", period: "monthly", modules: ["healthai"], currency: "KZT" });
  kzt.status === 200 && kzt.body?.mode === "real" ? ok("KZT checkout graceful (fallback в каскад)", kzt.body.provider) : fail("KZT checkout graceful", `${kzt.status} ${kzt.body?.mode}`);

  // 10. method=paypal без ENV → graceful fallback (real)
  const pp = await post("/api/pricing/checkout/session", { tierId: "medium", period: "monthly", method: "paypal" });
  pp.status === 200 && pp.body?.mode === "real" ? ok("PayPal checkout graceful (fallback в каскад)", pp.body.provider) : fail("PayPal checkout graceful", `${pp.status} ${pp.body?.mode}`);

  // 11-12. PayBox webhook liveness + отклонение поддельной подписи
  const pbLive = await get("/api/paybox/webhook");
  pbLive.status === 200 && pbLive.body?.ok ? ok("GET /api/paybox/webhook → liveness ok") : fail("paybox webhook liveness", String(pbLive.status));
  const pbForge = await post("/api/paybox/webhook", "pg_order_id=tier_lite_monthly_1&pg_payment_id=1&pg_result=1&pg_sig=deadbeef", true);
  pbForge.status === 401 ? ok("PayBox forged signature → 401") : fail("PayBox forged → 401", String(pbForge.status));

  // 13-14. PayPal webhook liveness + отклонение неверифицированного события
  const ppLive = await get("/api/paypal/webhook");
  ppLive.status === 200 && ppLive.body?.ok ? ok("GET /api/paypal/webhook → liveness ok") : fail("paypal webhook liveness", String(ppLive.status));
  const ppForge = await post("/api/paypal/webhook", { event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "x" } });
  ppForge.status === 401 ? ok("PayPal unverified event → 401") : fail("PayPal unverified → 401", String(ppForge.status));

  // 15-17. Revenue health отражает новые каналы
  const rh = await get("/api/revenue/health");
  rh.status === 200 ? ok("GET /api/revenue/health → 200") : fail("revenue health", String(rh.status));
  rh.body?.providers?.paybox ? ok("revenue health → paybox present", `configured=${rh.body.providers.paybox.configured}`) : fail("paybox in health");
  rh.body?.providers?.paypal ? ok("revenue health → paypal present", `configured=${rh.body.providers.paypal.configured}`) : fail("paypal in health");

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed ? 1 : 0);
}
run().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
