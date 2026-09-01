import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Человек, который заплатил, получает подтверждение — и это попадает в воронку.
 *
 * Касса задаёт адрес возврата после УСПЕШНОЙ оплаты:
 * `/constitution?upgrade=success&tier=...`. Страница этот признак не читала.
 * Заплативший попадал на обычную страницу: ни благодарности, ни подтверждения
 * доступа. Понять, прошла ли оплата, он не мог.
 *
 * Путь сегодня спит — платёжный провайдер не настроен. Он оживёт ровно в день,
 * когда зададут ключи, и тогда молчание встретит ПЕРВОГО настоящего покупателя.
 * Поэтому сторож заведён до того, как дефект успеет кому-то навредить.
 *
 * Второе, что здесь закрыто: в словаре воронки событие `upgrade_complete` было,
 * а слал его НОЛЬ мест. Последний шаг воронки — сама покупка — не фиксировался
 * вовсе, то есть конверсию нельзя было увидеть в принципе.
 */

const PAGE = join(__dirname, "..", "page.tsx");
const src = readFileSync(PAGE, "utf8");

describe("возврат после оплаты подтверждается", () => {
  test("контроль: это нужная страница", () => {
    expect(src.includes("ConstitutionPage")).toBe(true);
  });

  test("признак успешной оплаты читается из адреса", () => {
    expect(
      src.includes('get("upgrade") !== "success"') || src.includes('get("upgrade") === "success"'),
      "страница снова не читает возврат — заплативший не увидит подтверждения",
    ).toBe(true);
  });

  test("человеку сказано, что оплата прошла", () => {
    expect(src.includes("paidTier ?")).toBe(true);
    expect(
      src.includes('t("constitution.pay.thanksTitle")'),
      "признак читается, но подтверждения человек не видит",
    ).toBe(true);
  });

  test("названа и подсказка на случай, если доступ не появился", () => {
    const dict = readdirSync(join(__dirname, "..", "..", "..", "lib", "i18n-lang"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(join(__dirname, "..", "..", "..", "lib", "i18n-lang", f), "utf8"))
      .join(" ");
    expect(src.includes('t("constitution.pay.thanksBody"')).toBe(true);
    expect(dict.includes("откроем его вручную")).toBe(true);
    expect(dict.includes("open it manually")).toBe(true);
  });

  test("завершение покупки попадает в воронку", () => {
    expect(
      src.includes('track("upgrade_complete"'),
      "событие есть в словаре воронки, но его снова никто не шлёт — конверсии не видно",
    ).toBe(true);
  });
});
