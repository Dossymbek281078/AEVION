import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Сторож публичных счётчиков бэкенда — 10.08.2026.
 *
 * ЗАЧЕМ. `data/trust.ts` отдаётся наружу (`/api/pricing/trust`) и печатал
 * «Модулей платформы: 27», когда в реестре `data/projects.ts` было уже 41.
 * Фронтовый `scaleClaims.guard` ловит ровно такие расхождения, но он
 * сканирует только `frontend/src` — до бэкендовых файлов не достаёт, и это
 * число прожило там незамеченным.
 *
 * Здесь закрывается та же дыра со стороны бэкенда: счёт читается из реестра,
 * а не сравнивается с другой константой. Сравнение константы с константой
 * зелёное всегда — именно так «27» и пережило рост реестра.
 */

const SRC = path.resolve(__dirname, "../src");
const REGISTRY = path.join(SRC, "data/projects.ts");
const TRUST = path.join(SRC, "data/trust.ts");

/** Записей в реестре модулей. */
function registryEntries(): number {
  const src = readFileSync(REGISTRY, "utf8");
  return Array.from(src.matchAll(/status:\s*["'](\w+)["']/g)).length;
}

/**
 * Публичный счёт продуктовых узлов = записи реестра минус оболочка карты
 * `globus`. Та же арифметика, что в frontend/src/data/pitchFacts.ts —
 * дублировать её тут приходится потому, что фронт и бэк собираются
 * раздельно и общего импорта между ними нет.
 */
const MAP_SHELL_ENTRIES = 1;

describe("data/trust.ts — публичные счётчики не расходятся с реестром", () => {
  test("счёт модулей равен записям реестра минус оболочка карты", () => {
    const expected = registryEntries() - MAP_SHELL_ENTRIES;
    const trust = readFileSync(TRUST, "utf8");
    const m = trust.match(/label:\s*"Модулей платформы",\s*value:\s*"(\d+)"/);
    expect(m, 'В trust.ts не найдена строка "Модулей платформы" — её переименовали?').toBeTruthy();
    expect(
      Number(m![1]),
      `В projects.ts сейчас ${registryEntries()} записей, значит публичный счёт — ` +
        `${expected}. Это число отдаётся наружу на /api/pricing/trust.`,
    ).toBe(expected);
  });

  test("подпись не ссылается на несуществующий тариф", () => {
    // `business` — deprecated-алиас без объекта в TIERS: он остался только для
    // старых вебхуков. Публичная подпись, обещающая «всё в одной подписке на
    // Business», отправляет покупателя за тарифом, которого нет в прайсе.
    const trust = readFileSync(TRUST, "utf8");
    const line = trust.split("\n").find((l) => l.includes('label: "Модулей платформы"')) ?? "";
    expect(
      /Business/i.test(line),
      `Подпись счётчика модулей ссылается на тариф Business, которого нет в TIERS ` +
        `(см. data/pricing.ts). Все продукты в одной подписке — это Full.`,
    ).toBe(false);
  });
});
