import { describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Куда провайдер вернул человека после оплаты — там покупка обязана считаться.
 *
 * Замер 29.08.2026 (находка соседней вкладки, проверена здесь заново). Адрес
 * возврата задаётся у КАЖДОГО провайдера свой, и лишь часть ведёт на
 * `/pricing/checkout/success`, где отметка стояла с самого начала:
 *
 *   PayBox   → /pricing/checkout/success   ✅ считалось
 *   PayPal   → /pricing/checkout/success   ✅ считалось
 *   Stripe   → /bureau?paid=1              🔴 не считалось
 *   QPayNet  → /qpaynet/deposit/success    🔴 не считалось
 *
 * Деньги при этом не терялись: вебхуки пишут покупку в базу независимо от
 * страницы. Терялась СВЯЗЬ оплаты с каналом, из которого пришёл человек — без
 * неё реклама, ролик и рассылка выглядят одинаково, и вопрос «что окупилось»
 * остаётся без ответа. Молчаливая потеря: воронка при этом рисуется и выглядит
 * правдоподобно, просто часть продаж в неё не попадает.
 *
 * Сторож идёт от ПРОВАЙДЕРА, а не от списка страниц: список страниц пришлось бы
 * вести руками, и новый провайдер в него просто не попал бы. Адреса берутся из
 * кода бэкенда, поэтому добавление пятой кассы с новым адресом возврата красит
 * сборку сразу.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const SRC = resolve(APP, "..");
const REPO = resolve(SRC, "..", "..");
const BACKEND = join(REPO, "aevion-globus-backend", "src");

/** Файлы бэкенда, где задаётся адрес возврата после оплаты. */
function providerFiles(): string[] {
  const out: string[] = [];
  const payment = join(BACKEND, "lib", "payment");
  if (existsSync(payment)) {
    for (const f of readdirSync(payment)) {
      if (f.endsWith(".ts")) out.push(join(payment, f));
    }
  }
  for (const f of ["qpaynet.ts", "checkout.ts"]) {
    const p = join(BACKEND, "routes", f);
    if (existsSync(p)) out.push(p);
  }
  return out;
}

/**
 * Пути возврата, вытащенные из кода. Берём только то, что стоит в поле адреса
 * успеха: просто «строка, похожая на путь» притащила бы половину маршрутов.
 */
function returnPaths(): Array<{ path: string; file: string }> {
  const found = new Map<string, string>();
  for (const file of providerFiles()) {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      if (!/success_url|successUrl|return_url|returnUrl/.test(line)) continue;
      // Путь начинается после подстановки базового адреса: ${base}/... или ${FRONTEND}/...
      const m = /\$\{[A-Za-z_]+\}(\/[A-Za-z0-9/_-]+)/.exec(line);
      if (m) found.set(m[1], file.split(/[\\/]/).pop()!);
    }
  }
  return [...found.entries()].map(([path, file]) => ({ path, file }));
}

/** Файл страницы, отвечающей за путь приложения (Next App Router). */
function pageFileFor(path: string): string | null {
  const dir = join(APP, ...path.split("/").filter(Boolean));
  for (const name of ["page.tsx", "page.ts"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Считает ли страница покупку — сама или через общий компонент отметки. */
function countsPurchase(pageFile: string): boolean {
  const text = readFileSync(pageFile, "utf8");
  return text.includes("checkout_success") || text.includes("PurchaseReturnTracker");
}

describe("возврат после оплаты отмечается на каждой кассе", () => {
  const paths = returnPaths();

  test("контроль: адреса возврата вообще найдены", () => {
    // Пустой список сделал бы проверку ниже зелёной при любом состоянии кода —
    // и именно так выглядел бы отказ разбора после переименования полей.
    expect(paths.length, `найдено: ${paths.map((p) => p.path).join(", ")}`).toBeGreaterThanOrEqual(3);
  });

  test("контроль: страницы для этих адресов существуют", () => {
    const missing = paths.filter((p) => pageFileFor(p.path) === null);
    expect(
      missing.map((p) => `${p.path} (${p.file})`),
      "провайдер возвращает на адрес, которому не соответствует ни одна страница",
    ).toEqual([]);
  });

  test("контроль: способ различает считающие и не считающие страницы", () => {
    // Без этого контроля проверка ниже могла бы «подтверждать» отметку на любой
    // странице — например если бы признак совпадал с чем-то, что есть везде.
    const anyPage = join(APP, "shop", "page.tsx");
    expect(existsSync(anyPage), "страница витрины не найдена — контроль невозможен").toBe(true);
    expect(countsPurchase(anyPage), "витрина покупку НЕ отмечает, а способ говорит обратное").toBe(false);
  });

  test("каждая страница возврата отмечает покупку", () => {
    const silent = paths
      .filter((p) => {
        const file = pageFileFor(p.path);
        return file !== null && !countsPurchase(file);
      })
      .map((p) => `${p.path} ← ${p.file}`);
    expect(
      silent,
      "провайдер вернул человека сюда, а покупка не считается — продажа выпадает из воронки",
    ).toEqual([]);
  });
});
