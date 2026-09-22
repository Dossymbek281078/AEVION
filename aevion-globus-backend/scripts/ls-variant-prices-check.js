#!/usr/bin/env node
/**
 * Сверка: цена в КАССЕ = цена на ВИТРИНЕ.
 *
 * Зачем. Вебхук уже умеет ловить расхождение (priceForReference), но срабатывает
 * ПОСЛЕ оплаты — то есть после того, как человек заплатил не ту сумму. Замер
 * 16.09.2026 показал, чем это кончается: вариант давал ступень full ($2250) за
 * $149, и товары пришлось снимать с публикации. Этот скрипт задаёт тот же
 * вопрос ДО продажи.
 *
 * Как устроено — ни одна цена здесь не зашита:
 *   ожидание — из нашего же публичного /api/pricing (tiers[].priceTermTotal и
 *              standaloneApps[].terms[].total): ровно то, что видит покупатель;
 *   факт     — из Lemon Squeezy по id варианта (attributes.price, центы).
 * Повторять формулу лестницы в третий раз не нужно и опасно: копия разошлась бы
 * молча.
 *
 * Запуск (ключ живёт в Railway, на машине его нет):
 *   railway run node scripts/ls-variant-prices-check.js
 * Из PowerShell, не из Bash: Bash-инструмент не достаётся до API Railway.
 *
 * Коды выхода: 0 — всё сходится; 1 — есть расхождение; 2 — спросить НЕ удалось
 * (нет ключа, витрина или касса не ответили). Код 2 это НЕ «всё хорошо».
 *
 * Значение ключа не печатается никогда — только факт наличия.
 */

const PRICING_URL = process.env.PRICING_URL || "https://api.aevion.app/api/pricing";
const LS_API = "https://api.lemonsqueezy.com/v1/variants";
const KEY = process.env.LEMON_SQUEEZY_API_KEY || "";

const TERMS = ["lite", "medium", "pro", "full", "max"];

/** tier_lite → LEMON_SQUEEZY_VARIANT_LITE; app_ip_bureau_max → ..._IP_BUREAU_MAX. */
function envNameFor(ref) {
  return `LEMON_SQUEEZY_VARIANT_${ref.replace(/^(tier|app)_/, "").toUpperCase()}`;
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* не JSON — вернём как есть */ }
  return { status: r.status, body, text };
}

async function main() {
  if (!KEY) {
    console.error("СПРОСИТЬ НЕ УДАЛОСЬ: LEMON_SQUEEZY_API_KEY не задан в окружении.");
    console.error("Запускайте через: railway run node scripts/ls-variant-prices-check.js");
    process.exitCode = 2;
    return;
  }

  // ── Ожидание: что показываем покупателю ────────────────────────────────────
  const pricing = await getJson(PRICING_URL, { accept: "application/json" });
  if (pricing.status !== 200 || !pricing.body) {
    console.error(`СПРОСИТЬ НЕ УДАЛОСЬ: витрина ${PRICING_URL} ответила ${pricing.status}.`);
    process.exitCode = 2;
    return;
  }

  /** ref → ожидаемая сумма за весь срок, в долларах */
  const expected = new Map();
  for (const t of pricing.body.tiers || []) {
    if (TERMS.includes(t.id) && typeof t.priceTermTotal === "number") {
      expected.set(`tier_${t.id}`, t.priceTermTotal);
    }
  }
  for (const app of pricing.body.standaloneApps || []) {
    for (const term of app.terms || []) {
      if (typeof term.total === "number") {
        expected.set(`app_${app.slug}_${term.tierId}`, term.total);
      }
    }
  }

  if (expected.size === 0) {
    console.error("СПРОСИТЬ НЕ УДАЛОСЬ: витрина не вернула ни одной цены — сверять не с чем.");
    process.exitCode = 2;
    return;
  }

  // ── Факт: что спишет касса ────────────────────────────────────────────────
  const rows = [];
  let mismatched = 0, unknown = 0, checked = 0;

  for (const [ref, dollars] of expected) {
    const envName = envNameFor(ref);
    const variantId = process.env[envName];
    if (!variantId) {
      rows.push({ ref, verdict: "вариант НЕ заведён", envName });
      unknown++;
      continue;
    }
    const v = await getJson(`${LS_API}/${variantId}`, {
      authorization: `Bearer ${KEY}`,
      accept: "application/vnd.api+json",
    });
    if (v.status !== 200 || !v.body?.data?.attributes) {
      rows.push({ ref, verdict: `касса ответила ${v.status}` });
      unknown++;
      continue;
    }
    const cents = v.body.data.attributes.price;
    if (typeof cents !== "number") {
      rows.push({ ref, verdict: "у варианта нет цены в ответе кассы" });
      unknown++;
      continue;
    }
    checked++;
    const actual = cents / 100;
    if (actual === dollars) {
      rows.push({ ref, verdict: "сходится", expected: dollars, actual });
    } else {
      mismatched++;
      rows.push({ ref, verdict: "РАСХОЖДЕНИЕ", expected: dollars, actual });
    }
  }

  // ── Отчёт ─────────────────────────────────────────────────────────────────
  for (const r of rows) {
    const money = r.expected !== undefined ? `витрина $${r.expected} · касса $${r.actual}` : "";
    const mark = r.verdict === "сходится" ? "  ok " : r.verdict === "РАСХОЖДЕНИЕ" ? "  !! " : "  ?? ";
    console.log(`${mark}${r.ref.padEnd(26)} ${r.verdict}${money ? "  " + money : ""}${r.envName ? "  (" + r.envName + ")" : ""}`);
  }
  console.log(
    `\nсверено ${checked} из ${expected.size} · расхождений ${mismatched} · без ответа ${unknown}`,
  );

  if (mismatched > 0) {
    console.error("\nРАСХОЖДЕНИЕ ЦЕНЫ: покупатель заплатит не ту сумму, которую видит.");
    process.exitCode = 1;
  } else if (unknown > 0) {
    console.error(
      "\nЧасть вариантов проверить НЕ удалось — это не «всё хорошо», а отсутствие ответа.",
    );
    process.exitCode = 2;
  } else {
    console.log("Все цены кассы совпадают с витриной.");
  }
}

main().catch((e) => {
  console.error("СПРОСИТЬ НЕ УДАЛОСЬ:", String(e && e.message ? e.message : e).slice(0, 200));
  process.exitCode = 2;
});
