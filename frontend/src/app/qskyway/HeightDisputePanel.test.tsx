import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { HeightDisputePanel, type HeightDispute } from "./HeightDisputePanel";

/**
 * Блок появляется только когда коридор действительно опирается на высоту,
 * которой твин сам не верит. На живых городах это сегодня не случается ни разу
 * (замер 12.08.2026: 0 из 42 пар Астаны — движок платит за высоту и обходит
 * башню), поэтому глазами его не проверить, а «ничего не показал» неотличимо
 * от «сломан». Здесь он рендерится с настоящими числами разбора Абу-Даби Плаза.
 */

const ABU_DHABI_PLAZA: HeightDispute = {
  building: 195,
  osm: "way/486561786",
  taggedM: 382,
  publishedM: 310.8,
  publishedSource: "https://en.wikipedia.org/wiki/Abu_Dhabi_Plaza",
  segments: 3,
  cruiseAltM: 425,
  cruiseAltMIfPublished: 350,
  cruiseDeltaM: 75,
  distanceKm: 2.42,
  distanceKmIfPublished: 2.3,
  note: "…",
};

describe("HeightDisputePanel", () => {
  test("называет обе высоты, разницу и куда идти чинить", () => {
    render(<HeightDisputePanel dispute={ABU_DHABI_PLAZA} />);
    const panel = screen.getByTestId("height-dispute");
    const text = panel.textContent ?? "";

    // Оба числа: без «310.8 м в статье» предупреждение непроверяемо.
    expect(text).toContain("382");
    expect(text).toContain("310.8");
    // Цена расхождения — и по эшелону, и по крюку.
    expect(text).toContain("75");
    expect(text).toContain("350");
    expect(text).toContain("2.3");
    expect(text).toContain("участков 3");

    // Ссылка ведёт на конкретный объект OSM: позиция модуля — чинить в
    // источнике, а не переписывать высоту у себя.
    const link = panel.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://www.openstreetmap.org/way/486561786");
  });

  test("не рендерит ничего, когда расхождения нет", () => {
    const { container } = render(<HeightDisputePanel dispute={null} />);
    expect(container.innerHTML).toBe("");
  });

  test("молчит про крюк, когда путь не изменился, и про эшелон, когда он совпал", () => {
    render(
      <HeightDisputePanel
        dispute={{ ...ABU_DHABI_PLAZA, cruiseDeltaM: 0, cruiseAltMIfPublished: 425, distanceKmIfPublished: 2.42 }}
      />,
    );
    const text = screen.getByTestId("height-dispute").textContent ?? "";
    expect(text).not.toContain("выше, чем по опубликованной");
    expect(text).not.toContain("Длина маршрута");
    // но сам факт опоры на спорную высоту сказан всё равно
    expect(text).toContain("коридор поднят спорной высотой");
  });
});
