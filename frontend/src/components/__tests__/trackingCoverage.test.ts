import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Страница, которая ведёт к покупке, обязана считать посещения.
 *
 * Замер 13.08.2026: из посадочных считала одна `/pricing`, а ролики вели на
 * `/qrenew` и `/qmelanin`, где не считалось НИЧЕГО. Поставили PageTracking на
 * шесть страниц. 14.08 оказалось, что этого мало: `/constitution`, её
 * собственный прайс, `/devhub` и `/studio` тоже ведут к оплате и тоже молчали
 * — а `/constitution` вдобавок вела свою отдельную воронку, из-за чего в
 * сводке платформы её посетителей не было вовсе.
 *
 * Дважды находить это руками — плохой способ. Сторож считает страницы с
 * кнопкой покупки и требует, чтобы каждая умела считать посещение: либо через
 * PageTracking, либо своим вызовом page_view.
 *
 * Ложное срабатывание тут дороже пропуска, поэтому берём только ЯВНЫЕ признаки
 * покупки: ссылку в магазин или переход на чекаут.
 */

const APP = join(__dirname, "..", "..", "app");

/** Ссылка в кассу или на чекаут — то есть страница ведёт к оплате. */
const BUY_MARKERS = [/gumroad\.com\/l\//, /lemonsqueezy\.com/, /\bGUM\(/, /\bLS\(/];

/** Умеет ли страница считать посещение хоть каким-то способом. */
const VIEW_MARKERS = [/<PageTracking\b/, /track\(\s*"page_view"/, /type:\s*"page_view"/];

/**
 * Страницы, где ссылка на магазин есть, но покупки на них не происходит.
 * Каждое исключение — с причиной: без неё список тихо разрастётся до бесполезного.
 */
const NOT_A_SALES_PAGE: Record<string, string> = {
  "legal/privacy/page.tsx": "юридический текст, ссылка упомянута как обработчик платежей",
  "revenue/page.tsx": "внутренний дашборд выручки, не для покупателя",
  "qmelanin/_client.tsx": "часть страницы qmelanin — замер стоит в её page.tsx, второй считал бы то же посещение дважды",
  "devhub/[id]/page.tsx": "рабочее место внутри DevHub: касса там нужна пользователю, чтобы продать СВОЙ материал, а не нам — свой",
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const rel = (p: string) => p.slice(APP.length + 1).replace(/\\/g, "/");

describe("страницы с покупкой умеют считать посещение", () => {
  const files = walk(APP);

  test("контроль: файлы страниц вообще нашлись", () => {
    // Пустой обход дал бы зелёный на любом состоянии кода.
    expect(files.length).toBeGreaterThan(20);
  });

  test("контроль: признак покупки находит уже известные страницы", () => {
    // Если разметку ссылок изменят, сторож должен упасть здесь, а не молча
    // перестать что-либо проверять.
    const withBuy = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return BUY_MARKERS.some((re) => re.test(src));
    });

    expect(withBuy.length, "ни одной страницы с кнопкой покупки — сторож ослеп").toBeGreaterThan(3);
  });

  test("у каждой такой страницы есть замер посещения", () => {
    const silent: string[] = [];

    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!BUY_MARKERS.some((re) => re.test(src))) continue;
      if (NOT_A_SALES_PAGE[rel(f)]) continue;
      if (VIEW_MARKERS.some((re) => re.test(src))) continue;
      silent.push(rel(f));
    }

    expect(
      silent,
      `страницы ведут к оплате, но не считают посещение: ${silent.join(", ")}. ` +
        `Поставьте <PageTracking page="…" /> или внесите в NOT_A_SALES_PAGE с причиной.`,
    ).toEqual([]);
  });
});
