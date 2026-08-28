import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, "..", "page.tsx"), "utf8");
const CAPTURE = readFileSync(join(HERE, "..", "..", "..", "..", "components", "WaitlistCapture.tsx"), "utf8");

/**
 * Подтверждение подписки называет ту же дату, что и вся страница.
 *
 * Замер 28.08.2026 через саму страницу на телефоне: человек оставляет адрес и
 * видит «Напишем, когда будет что показать» — расплывчатее, чем обещание над
 * формой («напишем в день запуска») и чем письмо, которое называет 30 августа.
 */
describe("подтверждение подписки на странице запуска", () => {
  test("страница передаёт своё подтверждение и называет дату", () => {
    const at = PAGE.indexOf("doneText=");
    expect(at, "страница не задаёт текст подтверждения").toBeGreaterThan(-1);
    expect(PAGE.slice(at, at + 160)).toContain("30 августа");
  });

  test("компонент действительно использует переданный текст, а не только свой", () => {
    // Иначе свойство было бы декоративным: страница его задаёт, а на экране
    // остаётся общий текст.
    expect(CAPTURE).toContain("setMessage(doneText || copy.done)");
  });

  test("умолчание компонента НЕ изменено — другие страницы не трогаем", () => {
    expect(CAPTURE).toContain('done: "Готово — адрес записан. Напишем, когда будет что показать."');
  });
});
