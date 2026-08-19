import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: отказ сервера показывается ЧЕЛОВЕЧЕСКИМ текстом, а не кодом.
 *
 * 19.08.2026 в бэкенде появились честные отказы вместо тихой выдачи товара
 * без оплаты: `503 no_payment_provider` и `401 claim_mismatch`. Рядом с
 * машинным `error` сервер отдаёт понятный `message` — например «Оплата
 * временно недоступна. Товар не выдан, деньги не списаны — напишите нам.»
 *
 * Страница покупки читала только `error`, то есть покупатель увидел бы слово
 * `no_payment_provider`. Починка, после которой человеку стало хуже, починкой
 * не считается: одна незаметная неисправность сменилась бы другой — кнопкой,
 * которая ругается непонятно.
 *
 * Своих тестов у этой страницы нет, и правка держится на одной строке.
 * Поэтому сторож по исходнику — тот же приём, что у `abVariantDeps.guard`.
 */

const PAGE = join(process.cwd(), "src", "app", "qstore", "page.tsx");

describe("Отказ сервера доходит до человека понятным текстом", () => {
  it("страница покупки читает message, а не только error", () => {
    const src = readFileSync(PAGE, "utf8");

    // Контроль прибора: файл тот и он не пустой. Без этой проверки
    // «совпадений нет» было бы неотличимо от «файл не прочитался».
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toContain("/purchase");

    const codeLines = src
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");

    // Именно порядок важен: message ПЕРЕД error, иначе код победит текст.
    expect(codeLines).toMatch(/setNotice\(\s*[A-Za-z_$][\w$]*\.message\s*\|\|/);
  });
});
