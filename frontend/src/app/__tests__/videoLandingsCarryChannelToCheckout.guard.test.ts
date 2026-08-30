import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/*
 * Посадочные под ролики доводят метку канала до КАССЫ.
 *
 * Найдено 30.08.2026. Про /qrenew и /qmelanin в памяти прямо записано: ролики
 * на YouTube ведут именно сюда. При этом обе страницы уводили в кассу сырой
 * ссылкой — без метки. Обработчик оплаты метку читает и кладёт в запись о
 * покупке, то есть терялась она у нас, на последнем шаге.
 *
 * Цена потери здесь выше, чем где-либо: это единственные страницы, про которые
 * известно, что на них приходит платный трафик с роликов.
 *
 * Сторож смотрит на ССЫЛКУ, а не на наличие слова: withChannel в файле может
 * стоять для соседней ссылки, и проверка «слово есть» была бы зелена на
 * сломанном коде.
 */

const APP = join(process.cwd(), "src/app");

/** Страницы, про которые известно, что на них ведут ролики. */
const VIDEO_LANDINGS = ["qrenew/_client.tsx", "qmelanin/_client.tsx"];

function src(rel: string): string {
  const p = join(APP, rel);
  if (!existsSync(p)) throw new Error(`посадочная страница исчезла: ${rel}`);
  return readFileSync(p, "utf8");
}

/** Ссылки в кассу: и прямые адреса Gumroad, и href из каталога товаров. */
function checkoutLinks(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/href=\{?[^\n]*/g)) {
    const line = m[0];
    if (line.includes("gumroad.com") || line.includes("p.href")) out.push(line);
  }
  return out;
}

describe("посадочные под ролики не теряют метку канала у кассы", () => {
  it("такие страницы на месте — иначе сторож проверяет пустоту", () => {
    expect(VIDEO_LANDINGS.length).toBeGreaterThanOrEqual(2);
    for (const rel of VIDEO_LANDINGS) expect(src(rel).length).toBeGreaterThan(500);
  });

  it("каждая ссылка в кассу обёрнута withChannel", () => {
    const bare: string[] = [];
    for (const rel of VIDEO_LANDINGS) {
      const links = checkoutLinks(src(rel));
      expect(links.length, `в ${rel} не нашлось ни одной ссылки в кассу`).toBeGreaterThan(0);
      for (const l of links) if (!l.includes("withChannel(")) bare.push(`${rel}: ${l.trim()}`);
    }
    expect(bare, "ссылка уводит в кассу без метки канала — покупка придёт ниоткуда").toEqual([]);
  });

  it("метка берётся из адреса, а не выдумывается", () => {
    for (const rel of VIDEO_LANDINGS) {
      const s = src(rel);
      expect(s, `${rel} не читает метку из адреса`).toContain('get("c")');
      // channelFrom сверяет метку со списком известных каналов: без него в
      // отчёт уехало бы любое ?c= из чужой ссылки.
      expect(s, `${rel} не сверяет метку со списком каналов`).toContain("channelFrom(");
    }
  });
});
