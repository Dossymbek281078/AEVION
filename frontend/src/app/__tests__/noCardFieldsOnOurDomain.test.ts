import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Мы не просим номер карты на своём домене — ни на одной странице.
 *
 * Замер 23.08.2026, страница `/qcoreai/upgrade` (на проде отвечала 200):
 * поля «Card number», «MM / YY» и «CVC» стояли прямо в разметке — без `value`,
 * без `onChange`, без формы вокруг и без единого вызова API во всём файле.
 * То есть человек мог ввести НАСТОЯЩИЕ данные карты, а страница их даже не
 * читала. Рядом обещалось «Card via Stripe» и «You will be redirected to
 * PayBox KZ», хотя касса платформы работает через Lemon Squeezy
 * (`/api/pricing/checkout/healthz` -> primaryProvider lemonsqueezy).
 *
 * Опасность тут не в мёртвой вёрстке, а в приглашении: форма выглядит рабочей.
 * Настоящая оплата у нас всегда уходит на страницу поставщика, и собственных
 * полей карты не должно быть ни одного — ни рабочих, ни «пока не подключённых».
 *
 * Сторож нарочно смотрит на ПЛЕЙСХОЛДЕР, а не на разбор JSX: попытка ловить
 * `<button>` регуляркой уже давала 5 ложных срабатываний из 7 (шаблон рвётся
 * на `>` внутри выражения в атрибуте). Плейсхолдер — это ровно то, что видит
 * человек, и подделать его нечем.
 */

const APP = join(__dirname, "..");

const CARD_FIELD = /placeholder\s*=\s*["'`][^"'`]*(card\s*number|cvc|cvv|mm\s*\/\s*yy|номер\s*карты)/i;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("на нашем домене не собирают данные карты", () => {
  const files = sourceFiles(APP);

  test("контроль: обход дошёл до страниц и видит плейсхолдеры", () => {
    // Пустой обход дал бы «нарушений нет» — ответ на невыполненный поиск.
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => readFileSync(f, "utf8").includes("placeholder"))).toBe(true);
  });

  test("контроль: шаблон краснеет на настоящих полях карты", () => {
    expect(CARD_FIELD.test('<input placeholder="Card number" />')).toBe(true);
    expect(CARD_FIELD.test('<input placeholder="CVC" />')).toBe(true);
    expect(CARD_FIELD.test('<input placeholder="MM / YY" />')).toBe(true);
    // И не краснеет на безобидном
    expect(CARD_FIELD.test('<input placeholder="Email" />')).toBe(false);
    expect(CARD_FIELD.test('<input placeholder="Card design name" />')).toBe(false);
  });

  test("ни одна страница не просит номер карты, CVC или срок действия", () => {
    const bad = files
      .filter((f) => CARD_FIELD.test(readFileSync(f, "utf8")))
      .map((f) => f.split(/[\/]/).slice(-3).join("/"));
    expect(
      bad,
      `оплата уходит на страницу поставщика; своих полей карты быть не должно:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});

describe("кнопка оплаты на /qcoreai/upgrade не молчит", () => {
  const PAGE = join(APP, "qcoreai", "upgrade", "page.tsx");

  test("у главной кнопки есть обработчик", () => {
    const code = readFileSync(PAGE, "utf8");
    // Раньше здесь стоял <button> без onClick, без type и без формы: нажатие
    // не делало ничего, а страница обещала переход к оплате.
    expect(code).toContain("onClick");
    expect(code).toMatch(/window\.location\.href\s*=\s*["'`]\/pricing/);
  });
});
