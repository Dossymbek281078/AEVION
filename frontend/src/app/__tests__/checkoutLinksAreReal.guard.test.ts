import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Каждая кнопка покупки ведёт в настоящую кассу.
 *
 * Замер 31.08.2026, мутацией: подменил ссылку покупки DevHub ($149/мес) на
 * "#" — все 480 проверок фронта остались зелёными. Сторожа бэкенда молчали
 * тоже: ни lemonSqueezyReferenceGuard, ни lsVariantStatus не читают
 * products.ts и слово href.
 *
 * То есть СУЩЕСТВОВАНИЕ товара закреплено (everyLiveModuleCanBeBought), а
 * пригодность его ссылки — ничем. Тот же класс, что у ссылки в стене платного
 * доступа: охраняно всё, кроме того, что человек нажимает.
 *
 * Ссылки собираются двумя помощниками — LS(id) для LemonSqueezy и GUM(id) для
 * Gumroad. Сторож требует именно их: строка, вписанная руками, обходит и
 * проверку идентификатора, и единое место, где меняется адрес кассы.
 *
 * Разбор БЕЗ регулярок намеренно: собирая шаблон строкой, я на этой машине
 * теряю экранирование — первая редакция этого файла не разобралась вовсе,
 * потому что escape-последовательности стали настоящими переводами строки.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const SRC = fs.readFileSync(path.resolve(HERE, "..", "..", "lib", "products.ts"), "utf8");
const NL = String.fromCharCode(10);

type Item = { id: string; href: string; price: number | null };

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
    const body = parts[i].slice(0, 900);
    const href = valueAfter(body, "href:");
    if (!href) continue;
    const raw = valueAfter(body, "priceUsd:");
    const price = raw !== null && raw !== "" ? Number(raw) : null;
    out.push({ id: parts[i].slice(0, end), href, price });
  }
  return out;
}

function builtByHelper(href: string): boolean {
  return href.startsWith("LS(") || href.startsWith("GUM(");
}

function checkoutId(href: string): string {
  const open = href.indexOf('("');
  const close = href.indexOf('")');
  return open >= 0 && close > open ? href.slice(open + 2, close) : "";
}

describe("кнопки покупки ведут в кассу", () => {
  const all = items();

  it("контроль: каталог прочитан и товары найдены", () => {
    // Пустой разбор дал бы «нарушений нет» на любом состоянии каталога.
    expect(all.length, "товаров со ссылкой найдено подозрительно мало").toBeGreaterThan(10);
    expect(all.map((x) => x.id), "не найден известный товар").toContain("devhub");
  });

  it("каждая платная ссылка собрана помощником, а не вписана руками", () => {
    const bad = all
      .filter((x) => x.price !== null && x.price > 0)
      .filter((x) => !builtByHelper(x.href))
      .map((x) => x.id + " -> " + x.href);
    expect(
      bad,
      "ссылка покупки не собрана помощником LS()/GUM(): она обходит единое место, " +
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
});
