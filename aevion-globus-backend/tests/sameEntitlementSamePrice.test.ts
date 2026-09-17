import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTier, isTermTier, type TermTier } from "../src/data/pricing";

/**
 * За один и тот же доступ нельзя брать разные деньги.
 *
 * 19.08.2026 замер нашёл ровно это: страница /go — единственная ссылка из шапок
 * соцсетей, то есть первое, что видит холодный трафик, — продавала «AEVION
 * All-Access» за $59/мес, а тот же доступ на сайте стоил $49. Разница в $10 не
 * главное: дороже платит человек, пришедший по рекламе, который прайса не видел
 * и сравнить не может. Незаметно для нас — нигде не падает.
 *
 * С 15.09.2026 ступень доступа — это СРОК (tier_lite … tier_max), и цена ступени
 * — платёж за весь срок вперёд (priceTermTotal). Правило прежнее: если два товара
 * выдают одну и ту же ступень, цена у них обязана совпадать.
 */

const REPO = join(__dirname, "..", "..");
const WEBHOOK = join(__dirname, "..", "src", "routes", "gumroadWebhook.ts");
const PRODUCTS = join(REPO, "frontend", "src", "lib", "products.ts");

/** permalink Gumroad → ссылка выдачи (tier_* / app_* / external). */
function gumroadGrants(): Record<string, string> {
  const src = readFileSync(WEBHOOK, "utf8");
  const out: Record<string, string> = {};
  // Строки вида `xpxzam: "tier_lite",` — комментарии пропускаем.
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

/** tier_<ступень> → платёж за срок этой ступени (то, что стоит доступ на сайте). */
function tierTermPrice(reference: string): number | null {
  const m = /^tier_([a-z]+)$/.exec(reference);
  if (!m || !isTermTier(m[1])) return null;
  return getTier(m[1] as TermTier)?.priceTermTotal ?? null;
}

/**
 * Случаи, которые нельзя починить кодом: цена живёт в кабинете кассы, менять её
 * — рука основателя. Держим поимённо и с тем, что должно произойти, иначе сторож
 * стал бы вечно красным, а красный сторож перестают читать.
 *
 * 15.09.2026: пусто. Прежний случай — All-Access (xpxzam) за $59 против Full $49 —
 * закрыт снятием товара с продажи: он больше не на витрине, а продление по нему
 * выдаётся как Lite (1 месяц).
 */
const AWAITING_FOUNDER: Record<string, string> = {};

describe("за один и тот же доступ — одна цена", () => {
  const grants = gumroadGrants();
  const prices = storePrices();

  test("контроль: обе таблицы прочитались", () => {
    // Пустой разбор дал бы зелёный на любом расхождении.
    expect(Object.keys(grants).length, "не разобрана таблица выдачи Gumroad").toBeGreaterThanOrEqual(5);
    expect(Object.keys(prices).length, "не разобраны цены витрины").toBeGreaterThanOrEqual(5);
  });

  test("контроль: связь товар → ступень доступа вообще находится", () => {
    // Если формат таблицы изменят, сторож обязан упасть здесь, а не молча
    // перестать что-либо проверять.
    const toTier = Object.values(grants).filter((r) => tierTermPrice(r) !== null);
    expect(toTier.length, "ни один товар Gumroad не сопоставлен ступени срока").toBeGreaterThanOrEqual(1);
  });

  test("товар Gumroad не дороже той же ступени на сайте", () => {
    const bad: string[] = [];

    for (const [permalink, reference] of Object.entries(grants)) {
      const expected = tierTermPrice(reference);
      if (expected == null) continue; // товар не про ступень срока — не наш случай
      const p = prices[permalink];
      if (!p) continue; // товара нет на витрине сайта — другой вопрос
      if (p.billing === "once") continue; // разовые с подпиской не сравниваем

      if (Math.abs(p.usd - expected) > 0.01) {
        if (AWAITING_FOUNDER[permalink]) continue;
        bad.push(
          `${p.title} (/${permalink}): $${p.usd}, а тот же ${reference} на сайте — $${expected} за срок`,
        );
      }
    }

    expect(
      bad,
      `за один и тот же доступ берут разные деньги:\n  ${bad.join("\n  ")}\n` +
        `Дороже платит тот, кто пришёл по ссылке из соцсетей и прайса не видел.`,
    ).toEqual([]);
  });

  test("снятый с продажи товар не стоит на витрине и выдаёт самый короткий срок", () => {
    // All-Access (xpxzam) продавался за $59/мес и выдавал всю экосистему. Товар снят
    // 15.09.2026; продление по нему обязано давать самую короткую ступень, а не год
    // всей планеты за $59 — и на витрине его быть не должно.
    expect(grants.xpxzam, "прежний All-Access снова выдаёт не ту ступень").toBe("tier_lite");
    expect(prices.xpxzam, "снятый с продажи товар снова стоит на витрине").toBeUndefined();
  });

  test("список «ждёт основателя» не протух", () => {
    // Исключение, которое уже неверно, опаснее отсутствия проверки: оно молча
    // разрешает то, что давно починили.
    const stale: string[] = [];
    for (const permalink of Object.keys(AWAITING_FOUNDER)) {
      const reference = grants[permalink];
      const expected = reference ? tierTermPrice(reference) : null;
      const p = prices[permalink];
      if (!reference || expected == null || !p) {
        stale.push(`${permalink}: товара или его связи со ступенью больше нет`);
        continue;
      }
      if (Math.abs(p.usd - expected) <= 0.01) {
        stale.push(`${permalink}: цены сошлись — уберите из AWAITING_FOUNDER`);
      }
    }

    expect(stale, stale.join("; ")).toEqual([]);
  });
});
