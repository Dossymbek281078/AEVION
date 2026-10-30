/*
 * Цены видны в ОТВЕТЕ СЕРВЕРА, а не только после запуска скриптов.
 *
 * 🔴 Замер по проду 01.10.2026: GET /pricing отдаёт 55 733 знака, и в видимом
 * тексте НИ ОДНОЙ цены; названий «DevHub» и «Multichat» нет вовсе — они лежат
 * только внутри script. Поисковик, превью ссылки в мессенджере и человек с
 * медленной сетью видят главную продающую страницу без цен и без продуктов.
 *
 * Сторож проверяет ОТРИСОВКУ блока (а не наличие строки в файле) и отдельно —
 * что layout его действительно зовёт: компонент без вызова ничего не обещает.
 * Границу называю честно: сервер здесь не поднимается, HTTP нет; сетевой запрос
 * в наборе тестов сделал бы его хрупким. Живой ответ прода проверяет отдельный
 * зонд — scripts/pricing-ssr-probe.mjs.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ЦеныДляРобота } from "../layout";

const LAYOUT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "layout.tsx"), "utf8");

const ПРИМЕР = [
  { slug: "multichat", name: "Multichat", baseMonthly: 40 },
  { slug: "devhub", name: "DevHub", baseMonthly: 200 },
] as unknown as Parameters<typeof ЦеныДляРобота>[0]["приложения"];

describe("цены видны без скриптов", () => {
  it("контроль прибора: пустой список не рисует ничего", () => {
    const { container } = render(
      <ЦеныДляРобота приложения={[] as unknown as typeof ПРИМЕР} />,
    );
    expect(container.textContent?.trim(), "пустой список обязан молчать").toBe("");
  });

  it("в разметке есть название модуля и две цены — вилка, а не одно число", () => {
    const { container } = render(<ЦеныДляРобота приложения={ПРИМЕР} />);
    const текст = container.textContent || "";
    expect(текст).toContain("Multichat");
    expect(текст).toContain("DevHub");
    // Верхняя граница — цена за месяц, нижняя — самый длинный срок.
    expect(текст).toContain("$40.00");
    expect(текст).toContain("$200.00");
    expect(текст).toMatch(/от [$]\d/);
    const цен = (текст.match(/[$]\d+[.]\d{2}/g) || []).length;
    expect(цен, `цен в блоке: ${цен}`).toBeGreaterThanOrEqual(4);
  });

  it("каждая строка ведёт на свою карточку в кассе", () => {
    const { container } = render(<ЦеныДляРобота приложения={ПРИМЕР} />);
    const ссылки = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(ссылки).toContain("/pricing?app=multichat#apps");
    expect(ссылки).toContain("/pricing?app=devhub#apps");
  });

  // 27.10.2026: блок писал CyberChess «от $12.00 до $24.00 в месяц» при кассе $50/год
  // (замер прода /pricing и /pricing/checkout/success, разметка там же — 50.00).
  it("годовое приложение — одна цена за год, без месячной вилки (ru и en)", () => {
    const ГОДОВОЕ = [
      { slug: "cyberchess", name: "CyberChess", baseMonthly: 24, yearOnlyUsd: 50 },
    ] as unknown as typeof ПРИМЕР;
    for (const [lang, год] of [["ru", "в год"], ["en", "per year"]] as const) {
      const текст = render(<ЦеныДляРобота приложения={ГОДОВОЕ} lang={lang} />).container.textContent || "";
      expect(текст, lang).toContain("$50.00");
      expect(текст, lang).toContain(год);
      expect(текст, `${lang}: месячной вилки быть не должно`).not.toMatch(/\$24\.00|\$12\.00|в месяц|per month/);
    }
  });

  it("layout действительно зовёт блок — иначе он ничего не обещает", () => {
    expect(LAYOUT).toContain("<ЦеныДляРобота");
    expect(LAYOUT, "список берётся из общего источника, а не второй выборкой")
      .toContain("оплачиваемыеПриложения()");
  });
});
