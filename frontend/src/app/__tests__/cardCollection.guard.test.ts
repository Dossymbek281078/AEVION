import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Класс: страница просит ввести реквизиты карты, хотя ничего с ними не делает.
 *
 * Найдено 28.07.2026 на `/qcoreai/upgrade`: под кнопкой «Upgrade to Pro —
 * $19/mo» стояли поля «Card number», «MM / YY» и «CVC» — обычные input без
 * состояния и без отправки, а у самой кнопки не было обработчика вовсе. То
 * есть страница приглашала ввести номер карты и CVC на нашем домене, и они
 * уходили в никуда. Реквизиты собирает процессинг на своей стороне.
 *
 * Исключение одно и оно обязано быть подписано НА САМОЙ СТРАНИЦЕ: `/pay/[id]`
 * — витрина платёжных ссылок QPayNet, где прямо написано «Demo: any 16-digit
 * number works» и предложен тестовый номер. Пометка проверяется в тексте
 * файла, а не списком путей: список отстанет, а фраза уедет вместе со
 * страницей, если её перенесут.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Поля, по которым узнаётся сбор реквизитов карты. */
const CARD_FIELD = /(placeholder|label[^>]*>)[^\n]{0,40}(card number|cvc|cvv)/i;

/** Явная пометка «это не настоящая оплата», написанная для человека на экране. */
const DEMO_MARKER = /demo:|simulate a decline|sandbox mode|test card/i;

function collectPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry === "__tests__" || entry === "node_modules") continue;
    const page = join(full, "page.tsx");
    if (existsSync(page)) out.push(page);
    out.push(...collectPages(full));
  }
  return out;
}

// Скан — на загрузке модуля, не внутри it(): внутри он зелёный в одиночку и
// красный в полном прогоне по таймауту, а такой красный неотличим от находки.
const PAGES = collectPages(APP_DIR);
const OFFENDERS = PAGES.filter((f) => {
  const src = readFileSync(f, "utf8");
  return CARD_FIELD.test(src) && !DEMO_MARKER.test(src);
}).map((f) => relative(APP_DIR, f));

describe("страница не собирает реквизиты карты без явной пометки демо", () => {
  it("скан прошёл по настоящему набору страниц", () => {
    expect(PAGES.length).toBeGreaterThan(200);
  });

  it("ни одна страница не просит номер карты вне подписанного демо", () => {
    expect(OFFENDERS).toEqual([]);
  });

  it("правило умеет отличать подписанное демо от неподписанного", () => {
    // Проверяем сам критерий на придуманных строках: правило, которое молчит
    // на всём, выглядит точно так же, как правило, которое всё разрешает.
    const withField = '<input placeholder="Card number" />';
    const withCvc = "<label style={labelStyle}>CVC</label>";
    expect(CARD_FIELD.test(withField)).toBe(true);
    expect(CARD_FIELD.test(withCvc)).toBe(true);
    expect(CARD_FIELD.test('<input placeholder="Email" />')).toBe(false);
    expect(DEMO_MARKER.test("Demo: any 16-digit number works.")).toBe(true);
    expect(DEMO_MARKER.test("Upgrade to Pro")).toBe(false);
  });
});
