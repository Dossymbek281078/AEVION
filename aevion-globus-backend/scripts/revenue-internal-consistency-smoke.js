// Витрина показывает выручку из /api/revenue/summary. Своя проверочная
// покупка, попавшая в эту цифру, — не косметика: 27.07.2026 таких было две,
// и они давали 89% брутто на инвесторской странице.
//
// Один фильтр в computeLiveTotals это чинит, но только для тех каналов,
// которые были в коде в тот день. Добавит кто-нибудь Paddle или новый канал
// без фильтра — цифра снова раздуется, и никто не заметит: тест на функцию
// останется зелёным, потому что функция не изменилась.
//
// Поэтому проверяется ИНВАРИАНТ между ручками, а не реализация:
//     summary.gross  ==  Σ(баланс канала − свои покупки этого канала)
//     summary.count  ==  Σ(продаж канала − своих продаж канала)
// Любой канал, попавший в сумму мимо фильтра, ломает равенство.

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const CENT = 0.011; // допуск на округление в центах

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

/** Канал, у которого не задан токен, отвечает {stub:true} — это не провал. */
function live(balance) {
  return balance && !balance.stub;
}

(async () => {
  console.log(`  BASE = ${BASE}`);

  const summary = await get("/api/revenue/summary");
  check(
    "summary отдаёт свои покупки отдельным полем",
    typeof summary.internalUsd === "number" && typeof summary.internalCount === "number",
    `получено ${JSON.stringify(summary)}`,
  );

  const channels = [
    ["gumroad", await get("/api/revenue/gumroad/balance")],
    ["lemonsqueezy", await get("/api/revenue/lemonsqueezy/balance")],
  ];

  const liveChannels = channels.filter(([, b]) => live(b));
  if (liveChannels.length === 0) {
    console.log("  SKIP  ни один канал не сконфигурирован — сверять нечего");
    process.exit(0);
  }

  for (const [name, b] of liveChannels) {
    check(
      `${name}/balance отдаёт свои покупки отдельным полем`,
      typeof b.internalUsd === "number" && typeof b.internalCount === "number",
      `получено ${JSON.stringify(b)}`,
    );
  }

  const externalGross = liveChannels.reduce((sum, [, b]) => sum + (b.grossUsd ?? 0) - (b.internalUsd ?? 0), 0);
  const externalCount = liveChannels.reduce((sum, [, b]) => sum + (b.saleCount ?? 0) - (b.internalCount ?? 0), 0);
  const internalGross = liveChannels.reduce((sum, [, b]) => sum + (b.internalUsd ?? 0), 0);
  const internalCount = liveChannels.reduce((sum, [, b]) => sum + (b.internalCount ?? 0), 0);

  check(
    "выручка на витрине = каналы минус свои покупки",
    Math.abs((summary.grossUsd ?? 0) - externalGross) < CENT,
    `summary.grossUsd=${summary.grossUsd}, каналы−свои=${externalGross.toFixed(2)}`,
  );
  check(
    "число продаж на витрине = продажи каналов минус свои",
    (summary.saleCount ?? 0) === externalCount,
    `summary.saleCount=${summary.saleCount}, каналы−свои=${externalCount}`,
  );
  check(
    "свои покупки сходятся между витриной и каналами",
    Math.abs((summary.internalUsd ?? 0) - internalGross) < CENT && (summary.internalCount ?? 0) === internalCount,
    `summary=${summary.internalUsd}/${summary.internalCount}, каналы=${internalGross.toFixed(2)}/${internalCount}`,
  );
  check(
    "ни одна своя покупка не попала в выручку",
    (summary.saleCount ?? 0) + (summary.internalCount ?? 0) ===
      liveChannels.reduce((sum, [, b]) => sum + (b.saleCount ?? 0), 0),
    `витрина ${summary.saleCount}+${summary.internalCount}, каналы ` +
      `${liveChannels.reduce((sum, [, b]) => sum + (b.saleCount ?? 0), 0)}`,
  );

  console.log(
    failures === 0
      ? `\nPASS — выручка снаружи ${(summary.grossUsd ?? 0).toFixed(2)} USD, свои покупки ${internalGross.toFixed(2)} USD не в ней`
      : `\nFAIL — ${failures} расхождений`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.log(`\nFAIL — ${err.message}`);
  process.exit(1);
});
