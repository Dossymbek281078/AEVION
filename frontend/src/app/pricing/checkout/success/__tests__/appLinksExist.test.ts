import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/**
 * Ни одна ссылка на экране после оплаты не ведёт в никуда.
 *
 * Экран показывает «Открыть <продукт> →» сразу после списания денег. Ссылка,
 * ведущая на несуществующую страницу, в этот момент дороже любой другой:
 * человек только что заплатил и упирается в 404.
 *
 * 31.08.2026 список знал 11 модулей из 41, и когда касса начала передавать
 * купленный модуль, остальные 30 уходили в запасной вариант. Список расширен
 * до 38 — но только теми, у кого страница ПРОВЕРЕНА на месте, а не выведена
 * из имени. Этот сторож и держит проверку: адрес из списка обязан
 * соответствовать настоящему файлу страницы.
 */

const APP = join(process.cwd(), "src/app");
const SRC = readFileSync(join(APP, "pricing/checkout/success/page.tsx"), "utf8");

function записи(): Array<{ ключ: string; href: string }> {
  const i = SRC.indexOf("const APP_LINKS");
  const j = SRC.indexOf("};", i);
  const блок = SRC.slice(i, j);
  const out: Array<{ ключ: string; href: string }> = [];
  for (const m of блок.matchAll(/"?([a-z0-9-]+)"?:\s*\{ name: "[^"]+", href: "([^"]+)" \}/g)) {
    out.push({ ключ: m[1], href: m[2] });
  }
  return out;
}

describe("ссылки после оплаты ведут на существующие страницы", () => {
  const все = записи();

  it("список вообще разобран — иначе проверка пустая", () => {
    expect(все.length).toBeGreaterThanOrEqual(30);
  });

  it("у каждой ссылки есть страница", () => {
    const битые = все
      .filter(({ href }) => !existsSync(join(APP, href.replace(/^\//, ""), "page.tsx")))
      .map(({ ключ, href }) => `${ключ} → ${href}`);

    expect(битые, "после оплаты человек попадёт на 404").toEqual([]);
  });
});
