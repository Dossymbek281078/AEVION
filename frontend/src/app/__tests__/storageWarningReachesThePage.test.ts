import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Метка «сохранено не насовсем» обязана доехать до ЧЕЛОВЕКА, а не до границы API.
 *
 * Бэкенд с 19.08.2026 честно отвечает `storage: "db" | "memory"`. Но страница
 * может это поле просто выбросить — и тогда починка сделана ровно наполовину:
 * правда есть в ответе, а на экране её нет. Так было у LifeBox (исправлено),
 * QEvents и PsyApp.
 *
 * Тест по исходникам, а не по DOM, намеренно: он должен краснеть при правке
 * страницы, даже если сборка фронта в этот прогон не запускалась.
 */

const ROOT = join(__dirname, "..");

const PAGES: Array<[string, string[]]> = [
  ["QEvents", ["qevents/page.tsx"]],
  ["PsyApp", ["psyapp-deps/page.tsx", "psyapp-deps/components/Onboarding.tsx"]],
  ["LifeBox", ["lifebox/page.tsx"]],
];

describe("страница показывает признак хранилища", () => {
  test("контроль: файлы читаются и это действительно страницы", () => {
    for (const [, files] of PAGES) {
      for (const f of files) {
        const src = readFileSync(join(ROOT, f), "utf8");
        expect(src.length, `${f} пуст`).toBeGreaterThan(500);
        expect(src, `${f} не похож на компонент`).toMatch(/export default function|useState/);
      }
    }
  });

  test.each(PAGES)("%s читает storage из ответа", (_name, files) => {
    const all = files.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
    // Требуем, чтобы признак был взят ИМЕННО ИЗ ОТВЕТА, а не просто упоминался.
    //
    // Первая версия проверки искала слово "storage" где угодно в файле — и
    // осталась зелёной, когда я в порядке мутации убрал чтение поля из
    // resp.json(): в файле остались подпись обработчика и сравнение с
    // "memory", то есть весь механизм показа при НЕПРИХОДЯЩЕМ значении.
    // Проверка обещала охват, которого не давала.
    // Признак должен быть взят ИЗ ОТВЕТА: строка, где рядом стоят json() и
    // storage, либо обращение вида d.storage / j?.storage.
    const readFromResponse = all
      .split(String.fromCharCode(10))
      .some((l) => (l.includes("json(") && l.includes("storage")) || /[.?]storage\b/.test(l));
    expect(
      readFromResponse,
      "признак не читается из ответа — до экрана дойти нечему",
    ).toBe(true);
    expect(all, 'нет сравнения с "memory" — признак прочитан, но не осмыслен').toMatch(
      /storage\s*===\s*"memory"/,
    );
  });

  test.each(PAGES)("%s рисует предупреждение, а не молчит", (_name, files) => {
    const all = files.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
    // role="alert" — не украшение: без него экранный диктор промолчит.
    expect(all, "нет видимой плашки с role=alert").toMatch(/role="alert"/);
    expect(all, "нет текста про недоступное хранилище").toMatch(/недоступно/);
  });
});
