import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTier } from "../src/data/pricing";

/**
 * За один и тот же доступ нельзя брать разные деньги.
 *
 * 19.08.2026 замер нашёл ровно это: страница /go — единственная ссылка из шапок
 * соцсетей, то есть первое, что видит холодный трафик, — продаёт «AEVION
 * All-Access» за $59/мес. В коде выдачи стоит `xpxzam: "tier_full_monthly"`,
 * то есть покупка даёт тариф Full. На сайте тот же Full стоит $49.
 *
 * Разница в $10 — не главное. Главное, что дороже платит человек, пришедший по
 * рекламе: он не видел прайса и не может сравнить. А тот, кто дошёл до /pricing
 * сам, платит меньше за то же самое. Это невозможно объяснить покупателю,
 * который однажды заметит, и незаметно для нас, потому что нигде не падает.
 *
 * Правило простое: если два товара выдают одну и ту же ступень доступа, цена у
 * них обязана совпадать. Скидка на годовую оплату — не исключение из правила,
 * а другая длительность, поэтому сравниваем только помесячные.
 */

const REPO = join(__dirname, "..", "..");
const WEBHOOK = join(__dirname, "..", "src", "routes", "gumroadWebhook.ts");
const PRODUCTS = join(REPO, "frontend", "src", "lib", "products.ts");

/** permalink Gumroad → ссылка выдачи (tier_* / app_* / external). */
function gumroadGrants(): Record<string, string> {
  const src = readFileSync(WEBHOOK, "utf8");
  const out: Record<string, string> = {};
  // Строки вида `xpxzam: "tier_full_monthly",` — комментарии пропускаем.
  for (const line of src.split("\n")) {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    const m = /^\s*(\w{5,10}):\s*"([\w-]+)",/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** permalink → цена на витрине сайта (то, что реально спишет касса). */
function storePrices(): Record<string, { usd: number; title: string; billing: string }> {
  const src = readFileSync(PRODUCTS, "utf8");
  const out: Record<string, { usd: number; title: string; billing: string }> = {};
  for (const m of src.matchAll(/\{[^{}]*processor:\s*"gumroad"[^{}]*\}/gs)) {
    const b = m[0];
    const id = /id:\s*"([^"]+)"/.exec(b)?.[1];
    const usd = /priceUsd:\s*([\d.]+)/.exec(b)?.[1];
    const title = /title:\s*"([^"]+)"/.exec(b)?.[1] ?? "";
    const billing = /billing:\s*"([^"]+)"/.exec(b)?.[1] ?? "once";
    if (id && usd) out[id] = { usd: Number(usd), title, billing };
  }
  return out;
}

/** tier_<id>_monthly → цена этого тарифа на платформе. */
function tierMonthly(reference: string): number | null {
  const m = /^tier_(\w+)_monthly$/.exec(reference);
  if (!m) return null;
  return getTier(m[1])?.priceMonthly ?? null;
}

/**
 * Случаи, которые нельзя починить кодом: цена живёт в кабинете кассы, менять её
 * — рука основателя. Держим поимённо и с тем, что должно произойти, иначе
 * сторож стал бы вечно красным, а красный сторож перестают читать.
 */
const AWAITING_FOUNDER: Record<string, string> = {
  xpxzam:
    "AEVION All-Access на Gumroad стоит $59/мес и выдаёт tier_full_monthly — тот же тариф Full, " +
    "который на сайте стоит $49/мес. Дороже платит человек, пришедший по ссылке из соцсетей: " +
    "он прайса не видел и сравнить не может. Решение: поставить в кабинете Gumroad $49 " +
    "(тогда цены сойдутся), либо убрать товар и вести /go на чекаут Full.",
};

describe("за один и тот же доступ — одна цена", () => {
  const grants = gumroadGrants();
  const prices = storePrices();

  test("контроль: обе таблицы прочитались", () => {
    // Пустой разбор дал бы зелёный на любом расхождении.
    expect(Object.keys(grants).length, "не разобрана таблица выдачи Gumroad").toBeGreaterThanOrEqual(5);
    expect(Object.keys(prices).length, "не разобраны цены витрины").toBeGreaterThanOrEqual(5);
  });

  test("контроль: связь товар → тариф вообще находится", () => {
    // Если формат таблицы изменят, сторож обязан упасть здесь, а не молча
    // перестать что-либо проверять.
    const toTier = Object.values(grants).filter((r) => r.startsWith("tier_"));
    expect(toTier.length, "ни один товар Gumroad не сопоставлен тарифу").toBeGreaterThanOrEqual(1);
  });

  test("товар Gumroad не дороже того же тарифа на сайте", () => {
    const bad: string[] = [];

    for (const [permalink, reference] of Object.entries(grants)) {
      const expected = tierMonthly(reference);
      if (expected == null) continue; // товар не про тариф — не наш случай
      const p = prices[permalink];
      if (!p) continue; // товара нет на витрине сайта — другой вопрос
      if (p.billing !== "monthly") continue; // разовые с подпиской не сравниваем

      if (Math.abs(p.usd - expected) > 0.01) {
        if (AWAITING_FOUNDER[permalink]) continue;
        bad.push(
          `${p.title} (/${permalink}): $${p.usd}/мес, а тот же ${reference} на сайте — $${expected}/мес`,
        );
      }
    }

    expect(
      bad,
      `за один и тот же доступ берут разные деньги:\n  ${bad.join("\n  ")}\n` +
        `Дороже платит тот, кто пришёл по ссылке из соцсетей и прайса не видел.`,
    ).toEqual([]);
  });

  test("список «ждёт основателя» не протух", () => {
    // Исключение, которое уже неверно, опаснее отсутствия проверки: оно молча
    // разрешает то, что давно починили.
    const stale: string[] = [];
    for (const permalink of Object.keys(AWAITING_FOUNDER)) {
      const reference = grants[permalink];
      const expected = reference ? tierMonthly(reference) : null;
      const p = prices[permalink];
      if (!reference || expected == null || !p) {
        stale.push(`${permalink}: товара или его связи с тарифом больше нет`);
        continue;
      }
      if (Math.abs(p.usd - expected) <= 0.01) {
        stale.push(`${permalink}: цены сошлись — уберите из AWAITING_FOUNDER`);
      }
    }

    expect(stale, stale.join("; ")).toEqual([]);
  });
});
