import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MODULES, SUBSCRIPTIONS } from "@/lib/products";
import { STANDALONE_APPS, standaloneApp } from "@/lib/termPricing";

/**
 * Каждая кнопка покупки ведёт в настоящую кассу.
 *
 * Замер 31.08.2026, мутацией: подменил ссылку покупки DevHub на "#" — все 480
 * проверок фронта остались зелёными. Сторожа бэкенда молчали тоже: ни
 * lemonSqueezyReferenceGuard, ни lsVariantStatus не читают products.ts и слово href.
 *
 * Ссылки собираются помощниками — GUM(id) для Gumroad, appHref(id) для отдельного
 * приложения и константа PRICING_TERMS для подписки. Сторож требует именно их:
 * строка, вписанная руками, обходит и проверку идентификатора, и единое место,
 * где меняется адрес кассы.
 *
 * ⚠️ 15.09.2026 — новая ценовая политика: подписка и пять приложений продаются
 * через страницу цен, а в кассу уходит слаг приложения. Поэтому добавлена
 * проверка ПО СМЫСЛУ: слаг в ссылке приложения — тот, что знает касса
 * (STANDALONE_APPS). Чужой слаг значит «заплатил за одно, получил другое».
 *
 * Разбор БЕЗ регулярок намеренно: собирая шаблон строкой, я на этой машине
 * теряю экранирование — первая редакция этого файла не разобралась вовсе.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const SRC = fs.readFileSync(path.resolve(HERE, "..", "..", "lib", "products.ts"), "utf8");
const NL = String.fromCharCode(10);

type Item = { id: string; href: string; priced: boolean };

function valueAfter(body: string, key: string): string | null {
  const at = body.indexOf(key);
  if (at < 0) return null;
  const rest = body.slice(at + key.length);
  const stops = [rest.indexOf(","), rest.indexOf(NL)].filter((n) => n >= 0);
  const end = stops.length ? Math.min(...stops) : rest.length;
  return rest.slice(0, end).trim();
}

function items(): Item[] {
  const out: Item[] = [];
  const parts = SRC.split('id: "');
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf('"');
    if (end <= 0) continue;
    // Окно в 900 знаков теряло ДВА товара: у bureau и multichat между
    // идентификатором и href лежит длинный разбор обещаний. Потеря тихая —
    // сторож просто не проверял их ссылки, — поэтому окно шире, а контроль
    // ниже называет оба товара поимённо.
    const body = parts[i].slice(0, 3000);
    const href = valueAfter(body, "href:");
    if (!href) continue;
    const raw = valueAfter(body, "priceUsd:");
    // Цена бывает литералом (гайды) или вычислением из лестницы (appBase(...),
    // PLANET_BASE_MONTHLY). Ноль и пустота — «не продаётся»; всё остальное — цена.
    const priced = raw !== null && raw !== "" && raw !== "0";
    out.push({ id: parts[i].slice(0, end), href, priced });
  }
  return out;
}

function builtByHelper(href: string): boolean {
  return href.startsWith("GUM(") || href.startsWith("appHref(") || href === "PRICING_TERMS";
}

function checkoutId(href: string): string {
  if (href === "PRICING_TERMS") return "PRICING_TERMS";
  const open = href.indexOf('("');
  const close = href.indexOf('")');
  return open >= 0 && close > open ? href.slice(open + 2, close) : "";
}

describe("кнопки покупки ведут в кассу", () => {
  const all = items();

  it("контроль: каталог прочитан и товары найдены", () => {
    // Пустой разбор дал бы «нарушений нет» на любом состоянии каталога.
    expect(all.length, "товаров со ссылкой найдено подозрительно мало").toBeGreaterThanOrEqual(12);
    // Поимённо, а не числом: разбор может потерять один товар и подобрать
    // другой — счёт сойдётся, а проверять будет нечего.
    for (const id of ["devhub", "bureau", "multichat", "cyberchess", "qventure", "aevion-planet"]) {
      expect(all.map((x) => x.id), `не найден товар ${id}`).toContain(id);
    }
  });

  it("каждая платная ссылка собрана помощником, а не вписана руками", () => {
    const bad = all
      .filter((x) => x.priced)
      .filter((x) => !builtByHelper(x.href))
      .map((x) => x.id + " -> " + x.href);
    expect(
      bad,
      "ссылка покупки не собрана помощником GUM()/appHref()/PRICING_TERMS: она обходит единое место, " +
        "где меняется адрес кассы, и может вести куда угодно, включая «#»",
    ).toEqual([]);
  });

  it("идентификатор кассы не пустой", () => {
    const bad = all
      .filter((x) => builtByHelper(x.href))
      .filter((x) => checkoutId(x.href).length < 4)
      .map((x) => x.id + " -> " + x.href);
    expect(bad, "у ссылки покупки пустой или слишком короткий идентификатор").toEqual([]);
  });

  it("две кнопки не ведут в одну кассу", () => {
    // Иначе покупатель платит за один товар, а получает другой: выдача идёт
    // по идентификатору заказа, и он окажется чужим.
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const x of all) {
      const prev = seen.get(x.href);
      if (prev) dupes.push(prev + " и " + x.id + " -> " + x.href);
      else seen.set(x.href, x.id);
    }
    expect(dupes, "два товара ведут в одну кассу").toEqual([]);
  });

  it("слаг в ссылке приложения — тот, что знает касса, и принадлежит ЭТОМУ приложению", () => {
    const wrong = MODULES.filter((m) => {
      const app = standaloneApp(m.id);
      return !app || m.href !== `/pricing?app=${app.slug}#apps` || m.appId !== app.moduleId;
    }).map((m) => `${m.id} -> ${m.href} (appId ${m.appId})`);
    expect(wrong, "ссылка приложения не совпадает со слагом кассы — заплатят за чужое").toEqual([]);
    // Контроль прибора: слаги кассы вообще прочитаны.
    expect(STANDALONE_APPS.length).toBe(5);
  });

  it("подписка ведёт к выбору срока, а не в снятый товар", () => {
    for (const s of SUBSCRIPTIONS) {
      expect(s.href, `${s.id} ведёт не на страницу сроков`).toBe("/pricing#tiers");
    }
    // Снятые подписки Gumroad (All-Access, Constitution Pro/Team) не вернулись.
    for (const retired of ["xpxzam", "pyiaz", "wjvquw"]) {
      expect(SRC, `снятый товар ${retired} снова в каталоге`).not.toContain(`GUM("${retired}")`);
    }
  });
});
