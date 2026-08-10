/**
 * Сторож воронки оплаты: у каждой точки входа в чекаут есть событие.
 *
 * ЗАЧЕМ. `/pricing/admin` показывает число checkout_start как факт. До
 * 10.08.2026 это событие слалось РОВНО из одного места — таблицы тарифов на
 * `/pricing`. Кнопка «Купить» на страницах модулей, апгрейд-баннер на девяти
 * страницах, весь магазин `/apps`, гайды `/qmelanin`, Studio Pro в `/devhub`
 * и `/studio` — всё это вело в реальную оплату и не слало ничего. Дашборд
 * при этом выглядел достоверно: он не мог сказать «я не знаю», он показывал
 * заниженное число.
 *
 * Дыры нашлись руками, поэтому и появился этот файл: следующую кнопку оплаты
 * нельзя будет добавить молча.
 *
 * ЧТО СЧИТАЕТСЯ СОБЫТИЕМ. Две воронки существуют осознанно: платформенная
 * (`lib/track` → `/api/pricing/events`) и своя у Constitution (`lib/useFunnel`
 * → `/api/constitution/funnel/track`). Сторож принимает любую из них — он
 * следит за наличием сигнала, а не диктует, куда его слать. Побочный вывод,
 * который стоит помнить: продажи Constitution НЕ попадают в `/pricing/admin`,
 * так что это не полная картина выручки. Объединять их — продуктовое решение,
 * не техническое.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../..");
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"]);

/** Признаки того, что файл ведёт человека в оплату. */
const CHECKOUT_MARKERS = [
  "gumroadCheckoutUrl(",
  "pricing/checkout/session",
  "lemonsqueezy.com/checkout/buy/",
  "gumroad.com/l/",
  // Каталог отдаёт и цену, и href чекаута — страница, которая его читает,
  // почти всегда рисует кнопку покупки.
  "productById(",
];

/**
 * Любая из двух воронок засчитывается — плюс делегирование обёртке `<BuyLink>`,
 * которая шлёт событие сама. Требовать `track(` в файле, который уже отдал эту
 * работу компоненту, значило бы принуждать к дублирующему трекингу.
 */
const FUNNEL_MARKERS = ["checkout_start", "upgrade_click", "<BuyLink"];

/**
 * Файлы, которые содержат признак чекаута, но кнопкой не являются.
 * Причина обязательна — без неё это просто способ отключить сторож.
 */
const EXEMPT: Array<{ rel: string; reason: string }> = [
  {
    rel: "lib/products.ts",
    reason: "сам каталог товаров: хранит ссылки, ничего не рисует",
  },
  {
    rel: "lib/gumroad.ts",
    reason: "конструктор ссылок Gumroad, UI в нём нет",
  },
  {
    rel: "components/AdPixels.tsx",
    reason: "ссылки на оплату упомянуты только в комментарии про извлечение id товара",
  },
  {
    rel: "app/devhub/[id]/page.tsx",
    reason: "placeholder поля ввода: это ссылка на товар ПОЛЬЗОВАТЕЛЯ, не на оплату AEVION",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

function checkoutFiles(): Array<{ rel: string; src: string }> {
  const found: Array<{ rel: string; src: string }> = [];
  for (const file of walk(SRC_ROOT)) {
    const src = readFileSync(file, "utf8");
    if (!CHECKOUT_MARKERS.some((m) => src.includes(m))) continue;
    found.push({ rel: path.relative(SRC_ROOT, file).replace(/\\/g, "/"), src });
  }
  return found;
}

describe("воронка оплаты — каждая точка входа шлёт событие", () => {
  it("ни одна кнопка оплаты не молчит", () => {
    const silent = checkoutFiles()
      .filter(({ rel }) => !EXEMPT.some((e) => e.rel === rel))
      .filter(({ src }) => !FUNNEL_MARKERS.some((m) => src.includes(m)))
      .map(({ rel }) => rel);

    expect(
      silent,
      `Эти файлы ведут человека в оплату, но не шлют событие воронки — значит, ` +
        `их покупки не видит /pricing/admin:\n  ${silent.join("\n  ")}\n\n` +
        `Добавь track({ type: "checkout_start", source: "<откуда>" }) в обработчик ` +
        `(или upgrade_click через useFunnel, если модуль ведёт свою воронку). ` +
        `Если файл кнопкой не является — впиши его в EXEMPT С ПРИЧИНОЙ.`,
    ).toEqual([]);
  });

  it("список исключений не протух", () => {
    // Исключение, которое больше ни на что не указывает, выглядит как
    // осознанное решение и потому не перепроверяется. Это тихая дыра.
    const present = new Set(checkoutFiles().map((f) => f.rel));
    const stale = EXEMPT.filter((e) => !present.has(e.rel)).map((e) => e.rel);
    expect(
      stale,
      `Эти записи EXEMPT больше не содержат признаков чекаута — удали их:\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });

  it("событие есть у обеих ключевых точек: таблицы тарифов и чипа модуля", () => {
    // Явная проверка двух самых нагруженных входов, чтобы правка обработчика
    // не убрала событие незаметно для сплошного обхода.
    const files = new Map(checkoutFiles().map((f) => [f.rel, f.src]));
    for (const rel of ["app/pricing/page.tsx", "components/ModulePricingChip.tsx"]) {
      expect(files.get(rel), `${rel} перестал быть точкой входа в оплату — проверь, что это осознанно`).toBeTruthy();
      expect(files.get(rel), `${rel} больше не шлёт checkout_start`).toContain("checkout_start");
    }
  });
});
