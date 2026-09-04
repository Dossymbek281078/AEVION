import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ModuleStatusNote from "@/components/ModuleStatusNote";

/**
 * Страница модуля обязана говорить то же, что каталог.
 *
 * ЗАЧЕМ. Каталог помечает qskyway `availability: "beta"`, и до сегодня об этом
 * знала только страница цен. Страница модуля была честна СВОИМИ словами
 * (в шапке "proof of concept, not certified aviation software"), но с каталогом
 * связана не была: поправят одно - второе промолчит, и никто не заметит.
 *
 * ЧТО ПРОВЕРЯЕТСЯ ЗДЕСЬ И ЧЕГО НЕТ, честно:
 *  - следствие: плашка, получив каталог со статусом, ПЕЧАТАЕТ его человеку;
 *  - подключение: страница действительно её подключает - это проверка по
 *    исходнику, слабее рендера, и я это называю вслух. Полный рендер страницы
 *    требует подмены десятка ручек и живёт в соседнем сторожа языков.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function pricingWith(availability: string) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ modules: [{ id: "qskyway", availability }] }),
    } as Response),
  ) as unknown as typeof fetch;
}

describe("статус модуля из каталога доходит до человека", () => {
  test("каталог говорит beta - плашка это печатает", async () => {
    pricingWith("beta");
    const { container } = render(<ModuleStatusNote moduleId="qskyway" />);
    await waitFor(() => {
      expect(container.textContent ?? "", "плашка молчит при статусе beta").not.toBe("");
    });
    expect(String(container.textContent).toLowerCase()).toContain("бет");
  });

  test("каталог говорит live - плашки нет вовсе", async () => {
    // Отрицательный контроль: без него зелёный первый тест не отличает
    // "печатает статус" от "печатает всегда одно и то же".
    pricingWith("live");
    const { container } = render(<ModuleStatusNote moduleId="qskyway" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent ?? "", "плашка показана при live").toBe("");
  });

  test("страница модуля подключает плашку", () => {
    // Проверка по исходнику - слабее рендера, и это названо в шапке файла.
    const src = readFileSync(join(__dirname, "_client.tsx"), "utf8");
    expect(src, "плашка не подключена к странице").toContain("<ModuleStatusNote moduleId=\"qskyway\"");
    expect(src, "нет импорта плашки").toContain("@/components/ModuleStatusNote");
  });
});
