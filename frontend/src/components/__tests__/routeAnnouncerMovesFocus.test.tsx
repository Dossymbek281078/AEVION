import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

/**
 * Замер 03.09.2026 на проде: все три перехода цепочки планеты
 * (/qright -> /qcontract -> /qsign -> /qpaynet) оставляли фокус на body и не
 * объявляли ничего. Для человека без мыши это значит, что каждый переход
 * стоит прохода через всю шапку заново; для человека с читалкой — тишину.
 *
 * Сторож проверяет ПОВЕДЕНИЕ: фокус переехал на заголовок новой комнаты и
 * её название попало в живую область. Проверять «компонент смонтирован»
 * бессмысленно: смонтированный и ничего не делающий выглядит так же.
 */

let текущийПуть = "/qright";
vi.mock("next/navigation", () => ({ usePathname: () => текущийПуть }));

import RouteAnnouncer from "../RouteAnnouncer";

async function подождать(мс = 220) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, мс));
  });
}

describe("переход между комнатами не теряет человека", () => {
  beforeEach(() => {
    текущийПуть = "/qright";
    document.body.innerHTML = "";
  });

  it("первый заход НЕ объявляется: это обычная загрузка", async () => {
    const h1 = document.createElement("h1");
    h1.textContent = "Защитите вашу работу";
    document.body.appendChild(h1);

    const { container } = render(<RouteAnnouncer />);
    await подождать();

    expect(container.querySelector("[role=status]")?.textContent).toBe("");
    expect(document.activeElement).not.toBe(h1);
  });

  it("после перехода фокус переезжает на заголовок новой комнаты", async () => {
    const h1 = document.createElement("h1");
    h1.textContent = "Договор";
    document.body.appendChild(h1);

    const { rerender } = render(<RouteAnnouncer />);
    await подождать(50);

    текущийПуть = "/qcontract";
    rerender(<RouteAnnouncer />);
    await подождать();

    expect(document.activeElement).toBe(h1);
  });

  it("после перехода комната названа в живой области", async () => {
    const h1 = document.createElement("h1");
    h1.textContent = "Подпись документа";
    document.body.appendChild(h1);

    const { rerender, container } = render(<RouteAnnouncer />);
    await подождать(50);

    текущийПуть = "/qsign";
    rerender(<RouteAnnouncer />);
    await подождать();

    expect(container.querySelector("[role=status]")?.textContent).toContain("Подпись документа");
  });

  it("заголовка нет — берём main, а не молчим", async () => {
    const main = document.createElement("main");
    main.textContent = "Выплата";
    document.body.appendChild(main);

    const { rerender } = render(<RouteAnnouncer />);
    await подождать(50);

    текущийПуть = "/qpaynet";
    rerender(<RouteAnnouncer />);
    await подождать();

    expect(document.activeElement).toBe(main);
  });

  it("живая область объявлена вежливой и читается целиком", () => {
    const { container } = render(<RouteAnnouncer />);
    const область = container.querySelector("[role=status]");
    expect(область?.getAttribute("aria-live")).toBe("polite");
    // без aria-atomic читалка произносит только ИЗМЕНИВШУЮСЯ часть строки
    expect(область?.getAttribute("aria-atomic")).toBe("true");
  });

  it("смонтирован на всех страницах: в общей обёртке, до содержимого", () => {
    const s = fs.readFileSync(
      path.join(__dirname, "..", "ClientProviders.tsx"), "utf8");
    const объявитель = s.indexOf("<RouteAnnouncer />");
    const содержимое = s.indexOf("{children}");
    expect(объявитель).toBeGreaterThan(-1);
    // Живая область обязана существовать ДО того, как в неё пишут: область,
    // появляющаяся вместе с текстом, объявляется ненадёжно.
    expect(объявитель).toBeLessThan(содержимое);
  });
});
