const цели = [
  { имя: "devhub",      body: { tierId: "lite", app: "devhub", seats: 1, currency: "USD" } },
  { имя: "cyberchess",  body: { tierId: "lite", app: "cyberchess", seats: 1, currency: "USD" } },
  { имя: "multichat",   body: { tierId: "lite", app: "multichat", seats: 1, currency: "USD" } },
  { имя: "qventure",    body: { tierId: "lite", app: "qventure", seats: 1, currency: "USD" } },
  { имя: "ip_bureau",   body: { tierId: "lite", app: "ip_bureau", seats: 1, currency: "USD" } },
  { имя: "КОНТРОЛЬ планета lite", body: { tierId: "lite", seats: 1, currency: "USD" } },
  { имя: "КОНТРОЛЬ выдуманное приложение", body: { tierId: "lite", app: "no-such-app-2026", seats: 1, currency: "USD" } },
];
const адреса = new Map();
for (const ц of цели) {
  try {
    const r = await fetch("https://api.aevion.app/api/pricing/checkout/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ц.body),
      signal: AbortSignal.timeout(25000),
    });
    const j = await r.json().catch(() => null);
    const url = j?.url || j?.checkoutUrl || null;
    const корзина = url && /\/checkout\/(buy|cart)\//i.test(url);
    console.log(`${ц.имя.padEnd(30)} код ${r.status} | ${url ? (корзина ? "КОРЗИНА ТОВАРА" : "общая страница") : "адреса нет: " + JSON.stringify(j).slice(0, 70)}`);
    if (url) { console.log(`     ${url.slice(0, 96)}`); адреса.set(ц.имя, url); }
  } catch (e) {
    console.log(`${ц.имя.padEnd(30)} СПРОСИТЬ НЕ УДАЛОСЬ: ${String(e.message).slice(0, 50)}`);
  }
}
const разных = new Set([...адреса.values()].map((u) => u.split("?")[0]));
console.log(`\nразных адресов: ${разных.size} при ${адреса.size} ответах`);
