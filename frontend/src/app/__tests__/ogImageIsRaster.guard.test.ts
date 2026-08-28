import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Картинка предпросмотра ссылки обязана быть РАСТРОВОЙ.
 *
 * Замер 29.08.2026: страница сертификата объявляла
 * `twitter:card: summary_large_image` и картинку в SVG
 * (`/api/bureau/cert/<id>/og.svg`). X, LinkedIn, Facebook и Telegram SVG в
 * предпросмотре не рисуют — большая карточка оставалась пустой, что хуже
 * маленькой с текстом. При этом в проекте 149 растровых og-картинок через
 * `next/og`: SVG был исключением, а не приёмом.
 *
 * Сторож смотрит на ИСХОДНИКИ страниц, а не на прод: он должен краснеть до
 * выкатки, а не после.
 */

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "page.tsx" || e === "layout.tsx") out.push(p);
  }
  return out;
}

/**
 * Известные страницы с SVG-картинкой на 29.08.2026. Список обязан только
 * СОКРАЩАТЬСЯ: сторож краснеет и когда появляется новая, и когда запись здесь
 * перестала быть правдой.
 *
 * Все три — в чужих модулях (aev, awards, qtrade). Я их не чиню: не моя зона,
 * и проверить последствия правки там я не могу. Но и молчать о них нельзя —
 * пусть будут названы, чтобы владелец увидел.
 */
const BASELINE = [
  "aev/layout.tsx",
  "awards/results/page.tsx",
  "qtrade/layout.tsx",
];

describe("предпросмотр ссылки: картинка растровая, а не SVG", () => {
  const files = walk(APP);

  test("контроль: страницы вообще найдены", () => {
    // Без этого проверка ниже стала бы зелёной молча, если обход сломается.
    expect(files.length, "обход не нашёл ни одной страницы").toBeGreaterThan(50);
  });

  test("ни одна страница не объявляет og:image в формате .svg", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // Ищем только там, где рядом действительно метаданные картинки.
      if (!src.includes("images:")) continue;
      const hasSvgImage = /images:\s*\[[^\]]*\.svg/s.test(src);
      if (hasSvgImage) bad.push(f.slice(APP.length + 1).split(String.fromCharCode(92)).join("/"));
    }
    const fresh = bad.filter((f) => !BASELINE.includes(f));
    expect(fresh, `SVG в предпросмотре не рисуется у X, LinkedIn, Facebook и Telegram: ${fresh.join(", ")}`).toEqual([]);

    const gone = BASELINE.filter((f) => !bad.includes(f));
    expect(gone, `починено — вычеркните из BASELINE: ${gone.join(", ")}`).toEqual([]);
  });
});
