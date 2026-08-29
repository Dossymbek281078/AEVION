import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * У каждого товара каталога должна быть цена И ссылка кассы.
 *
 * Класс, ради которого сторож: «кнопка купить ведёт в никуда». Он уже случался
 * дважды — 10.08 девять кнопок Lemon Squeezy считали мёртвыми (оказалось ложной
 * тревогой от User-Agent), а 23.08 на странице QCoreAI кнопка оплаты вела в
 * поля карты, которые никуда не отправлялись.
 *
 * Замер 29.08.2026: 16 товаров, у всех есть и цена, и ссылка (Gumroad или
 * Lemon Squeezy). Сторож держит этот ноль.
 *
 * ЧЕГО ОН НЕ ДЕЛАЕТ. Он не ходит в сеть: живость ссылок проверяется отдельно и
 * вручную (29.08 — все 200, выдуманный товар 404). Сетевая проверка в наборе
 * тестов была бы то зелёной, то красной от чужой доступности, и её отключили
 * бы первой. Здесь проверяется НАЛИЧИЕ пути к оплате, а не его работа.
 *
 * Комментарии вырезаются: в них цитируются прежние разборы, и без этого
 * сторож считал бы примеры из объяснений за настоящие записи каталога.
 */

const NL = String.fromCharCode(10);
const CATALOG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "lib", "products.ts");

type Row = { id: string; price?: string; href: boolean };

function catalog(): Row[] {
  const raw = readFileSync(CATALOG, "utf8");
  const src = raw
    .split(NL)
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join(NL);

  const rows: Row[] = [];
  let at = 0;
  for (;;) {
    const i = src.indexOf('id: "', at);
    if (i < 0) break;
    at = i + 1;
    const close = src.indexOf('"', i + 5);
    const id = src.slice(i + 5, close);
    const next = src.indexOf('id: "', at + 4);
    const body = src.slice(i, next > 0 ? next : src.length);
    rows.push({
      id,
      price: (body.match(/priceUsd:\s*([0-9.]+)/) || [])[1],
      href: /href:\s*(GUM|LS|PADDLE|"https)/.test(body),
    });
  }
  return rows;
}

describe("каждый товар каталога можно купить", () => {
  const rows = catalog();

  // Контроль охвата: без него сломанный разбор дал бы пустой список, и сторож
  // ответил бы «нарушений нет», не посмотрев ни на один товар.
  it("контроль прибора: каталог разобран", () => {
    expect(rows.length, "не разобрал ни одного товара — сломан разбор файла")
      .toBeGreaterThanOrEqual(10);
    expect(rows.some((r) => r.id === "cyberchess"), "не нашёл известный товар").toBe(true);
  });

  it("у каждого есть цена", () => {
    const noPrice = rows.filter((r) => !r.price).map((r) => r.id);
    expect(noPrice, `товар без цены — купить нельзя: ${noPrice.join(", ")}`).toEqual([]);
  });

  it("у каждого есть ссылка кассы", () => {
    const noHref = rows.filter((r) => !r.href).map((r) => r.id);
    expect(
      noHref,
      `товар без ссылки кассы — кнопка ведёт в никуда: ${noHref.join(", ")}`,
    ).toEqual([]);
  });
});
