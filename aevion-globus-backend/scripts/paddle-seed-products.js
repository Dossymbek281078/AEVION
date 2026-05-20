#!/usr/bin/env node
/**
 * AEVION — Create Paddle products & prices for subscription tiers.
 *
 * Creates:
 *   1. AEVION Pro    — $19/mo  | $192/yr
 *   2. AEVION Business — $99/mo | $998/yr
 *   3. QStore — generic one-time purchase product
 *
 * Saves price IDs to stdout — add to Railway vars:
 *   PADDLE_PRICE_PRO_MONTHLY, PADDLE_PRICE_PRO_ANNUAL
 *   PADDLE_PRICE_BIZ_MONTHLY, PADDLE_PRICE_BIZ_ANNUAL
 *   PADDLE_PRODUCT_QSTORE
 *
 * Usage:
 *   PADDLE_API_KEY=pdl_live_... node scripts/paddle-seed-products.js
 */

const KEY = process.env.PADDLE_API_KEY?.trim();
const SANDBOX = process.env.PADDLE_SANDBOX !== "false";
const BASE = SANDBOX ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

if (!KEY) { console.error("PADDLE_API_KEY required"); process.exit(1); }

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  if (!r.ok) { console.error(`${method} ${path} → ${r.status}:`, text.slice(0, 300)); return null; }
  return JSON.parse(text);
}

async function createProduct(name, description, taxCategory = "standard") {
  const r = await api("POST", "/products", { name, description, tax_category: taxCategory });
  return r?.data;
}

async function createPrice(productId, description, amountUsd, interval, frequency) {
  const body = {
    product_id: productId,
    description,
    unit_price: { amount: String(Math.round(amountUsd * 100)), currency_code: "USD" },
    tax_mode: "account_setting",
    ...(interval ? {
      billing_cycle: { interval, frequency },
    } : {}),
  };
  const r = await api("POST", "/prices", body);
  return r?.data;
}

async function run() {
  console.log(`\nAEVION Paddle Product Seeder → ${BASE}\n`);
  const results = {};

  // ── AEVION Pro ──────────────────────────────────────────────────────────────
  console.log("Creating AEVION Pro...");
  const pro = await createProduct(
    "AEVION Pro",
    "Full access to AEVION platform: QCoreAI multi-agent AI, QRight IP protection, QSign, Bureau, QTradeOffline, 30+ modules.",
  );
  if (!pro) { console.error("Failed to create Pro product"); process.exit(1); }
  console.log("  ✓ Product:", pro.id, pro.name);
  results.PADDLE_PRODUCT_PRO = pro.id;

  const proMonthly = await createPrice(pro.id, "AEVION Pro — Monthly", 19, "month", 1);
  if (proMonthly) { results.PADDLE_PRICE_PRO_MONTHLY = proMonthly.id; console.log("  ✓ Pro monthly:", proMonthly.id); }

  const proAnnual = await createPrice(pro.id, "AEVION Pro — Annual (−16%)", 192, "year", 1);
  if (proAnnual) { results.PADDLE_PRICE_PRO_ANNUAL = proAnnual.id; console.log("  ✓ Pro annual:", proAnnual.id); }

  // ── AEVION Business ─────────────────────────────────────────────────────────
  console.log("\nCreating AEVION Business...");
  const biz = await createProduct(
    "AEVION Business",
    "AEVION Business tier: team seats, advanced analytics, priority support, all Pro features + enterprise integrations.",
  );
  if (!biz) { console.error("Failed to create Business product"); process.exit(1); }
  console.log("  ✓ Product:", biz.id, biz.name);
  results.PADDLE_PRODUCT_BIZ = biz.id;

  const bizMonthly = await createPrice(biz.id, "AEVION Business — Monthly", 99, "month", 1);
  if (bizMonthly) { results.PADDLE_PRICE_BIZ_MONTHLY = bizMonthly.id; console.log("  ✓ Business monthly:", bizMonthly.id); }

  const bizAnnual = await createPrice(biz.id, "AEVION Business — Annual (−16%)", 998, "year", 1);
  if (bizAnnual) { results.PADDLE_PRICE_BIZ_ANNUAL = bizAnnual.id; console.log("  ✓ Business annual:", bizAnnual.id); }

  // ── QStore One-time ─────────────────────────────────────────────────────────
  console.log("\nCreating QStore generic product...");
  const qstore = await createProduct(
    "AEVION QStore Purchase",
    "One-time digital product purchase via AEVION QStore marketplace.",
  );
  if (qstore) {
    results.PADDLE_PRODUCT_QSTORE = qstore.id;
    console.log("  ✓ QStore product:", qstore.id);
  }

  // ── Output ──────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("Add these to Railway Variables (AEVION service):\n");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}=${v}`);
  }

  console.log("\nrailway command:");
  const args = Object.entries(results).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(`  railway variables set ${args} --service AEVION`);
}

run().catch(e => { console.error(e); process.exit(1); });
