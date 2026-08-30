/**
 * Заплативший видит НАЗВАНИЕ товара, а не внутренний слаг.
 *
 * В кабинете, в блоке «Оплачено отдельно — доступ активен», слаг выводился как
 * есть: человек, отдавший $29 за AEVION IP Bureau, видел плашку `ip_bureau`.
 *
 * Главная проверка здесь не про перевод одного слага, а про ПОЛНОТУ: каждая
 * ссылка платёжного вебхука обязана разрешаться в название. Слаг рождается в
 * бэкенде как `ref.slice(4)` от `app_*`, а в каталоге у товара свой `appId`, и
 * 28.08.2026 три из девяти не совпадали. Без этой проверки четвёртое
 * расхождение появилось бы так же молча.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { titleForAppSlug } from "../appSlugTitle";
import { ALL_PRODUCTS } from "../products";

const VARIANTS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "..",
  "aevion-globus-backend", "src", "data", "lemonSqueezyVariants.ts",
);

/** Слаги ровно так, как их пишет вебхук: ключ `app_x` минус префикс. */
function webhookSlugs(): string[] {
  const src = readFileSync(VARIANTS, "utf8");
  return [...src.matchAll(/^\s+(app_[a-z_]+):/gm)].map((m) => m[1].slice(4));
}

describe("кабинет называет купленное по-человечески", () => {
  it("контроль прибора: список ссылок вебхука прочитан и непуст", () => {
    // Без этого все проверки ниже стали бы зелёными на пустом списке —
    // достаточно переименовать файл или сменить форму записи.
    const slugs = webhookSlugs();
    expect(slugs.length).toBeGreaterThan(5);
    expect(slugs).toContain("cyberchess");
    expect(ALL_PRODUCTS.length).toBeGreaterThan(10);
  });

  it("КАЖДАЯ ссылка вебхука разрешается в название товара", () => {
    const unresolved = webhookSlugs().filter((s) => titleForAppSlug(s) === s);
    expect(
      unresolved,
      `эти слаги покупатель увидит сырыми: ${unresolved.join(", ")}. ` +
        "Добавьте псевдоним в SLUG_ALIASES или выровняйте appId в каталоге",
    ).toEqual([]);
  });

  it("три известных расхождения переводятся именно так", () => {
    // Предметно: это те слаги, которые в каталоге записаны иначе.
    expect(titleForAppSlug("ip_bureau")).toBe("AEVION IP Bureau");
    expect(titleForAppSlug("qpaynet")).toBe("QPayNet");
    expect(titleForAppSlug("smeta")).toBe("Smeta Trainer");
  });

  it("совпадающий слаг работает без псевдонима", () => {
    expect(titleForAppSlug("cyberchess")).toBe("CyberChess");
  });

  it("неизвестный слаг возвращается как есть, а не теряется", () => {
    // Запасной путь — узнаваемая строка, а не пустота и не «Неизвестный
    // модуль»: человек должен видеть хоть что-то, а мы — что списки разошлись.
    expect(titleForAppSlug("совсем-новый-модуль")).toBe("совсем-новый-модуль");
    expect(titleForAppSlug("")).toBe("");
  });
});
