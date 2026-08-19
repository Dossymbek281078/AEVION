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

  // Точки тренда обязаны нести флаг: /trend отдаёт СВОЮ, урезанную форму точки,
  // и один раз она уже потеряла includesInternal — фронт рисовал предупреждение
  // о ступеньке, которое не могло появиться никогда.
  const trend = await get("/api/revenue/trend?windowDays=90");
  const points = trend.series ?? [];
  if (points.length === 0) {
    console.log("  SKIP  снапшотов в окне нет — точки тренда проверять не на чем");
  } else {
    check(
      "точки тренда несут флаг includesInternal",
      points.every((p) => typeof p.includesInternal === "boolean"),
      `первая точка: ${JSON.stringify(points[0])}`,
    );
    // Флага мало: график вычитает саму сумму, чтобы рисовать деньги снаружи на
    // всей истории. Поле уже терялось при сужении формы точки — дважды.
    check(
      "точки тренда несут сумму своих покупок",
      points.every((p) => "internalUsd" in p),
      `первая точка: ${JSON.stringify(points[0])}`,
    );

    // Двойное вычитание своих покупок (гросс уже очищен, а их вычитают снова)
    // даёт отрицательную выручку — 27.07.2026 на графике вышло −$139.01. Логика
    // вычитания живёт во фронте, и API-смок её не видит; здесь проверяется то,
    // что видно снаружи: последняя точка обязана совпасть с текущей выручкой.
    // Если признак «свои покупки в гроссе» разъедется с реальностью, разойдутся
    // и эти два числа.
    const last = points[points.length - 1];
    const lastExternal = last.includesInternal ? last.grossUsd - (last.internalUsd ?? 0) : last.grossUsd;
    check(
      "последняя точка тренда совпадает с текущей выручкой",
      Math.abs(lastExternal - (summary.grossUsd ?? 0)) < CENT,
      `точка ${lastExternal.toFixed(2)}, summary ${(summary.grossUsd ?? 0).toFixed(2)}`,
    );
    const external = points.map((p) => (p.includesInternal ? p.grossUsd - (p.internalUsd ?? 0) : p.grossUsd));
    check(
      "ни одна точка тренда не даёт отрицательную выручку",
      external.every((v) => v >= -0.001),
      `минимум ${Math.min(...external).toFixed(2)}`,
    );
  }

  console.log(
    failures === 0
      ? `\nPASS — FAIL=0, выручка снаружи ${(summary.grossUsd ?? 0).toFixed(2)} USD, свои покупки ${internalGross.toFixed(2)} USD не в ней`
      : `\nFAIL — ${failures} расхождений`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.log(`\nFAIL — ${err.message}`);
  process.exit(1);
});
