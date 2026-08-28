import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

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

/**
 * Панель берёт тексты из словаря, поэтому рендерить её голой больше нельзя:
 * `useI18n` требует провайдера. Обёртка одна на файл — второй способ рендерить
 * то же самое разошёлся бы с первым молча.
 */
function renderPanel(node: React.ReactElement) {
  return render(<I18nProvider>{node}</I18nProvider>);
}

describe("HeightDisputePanel", () => {
  test("называет обе высоты, разницу и куда идти чинить", () => {
    renderPanel(<HeightDisputePanel dispute={ABU_DHABI_PLAZA} />);
    const panel = screen.getByTestId("height-dispute");
    const text = panel.textContent ?? "";

    // Оба числа: без «310.8 м в статье» предупреждение непроверяемо.
    expect(text).toContain("382");
    expect(text).toContain("310.8");
    // Цена расхождения — и по эшелону, и по крюку.
    expect(text).toContain("75");
    expect(text).toContain("350");
    expect(text).toContain("2.3");
    // Панель говорит на языке посетителя; в тестах словарь по умолчанию английский.
    // Русские строки были ЗАШИТЫ в компонент до 28.08.2026 — эти утверждения и
    // поймали бы возврат к ним.
    expect(text).toContain("segments 3");

    // Ссылка ведёт на конкретный объект OSM: позиция модуля — чинить в
    // источнике, а не переписывать высоту у себя.
    const link = panel.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://www.openstreetmap.org/way/486561786");
  });

  test("не рендерит ничего, когда расхождения нет", () => {
    const { container } = renderPanel(<HeightDisputePanel dispute={null} />);
    expect(container.innerHTML).toBe("");
  });

  /**
   * Спорная высота может подняться раньше, чем до неё дойдёт человек: твин
   * помечает здание подозрительным сам, а разбор по опубликованным данным
   * появляется отдельной работой. До 12.08.2026 бэкенд подставлял на это место
   * ноль и прочерк, и карточка печатала «382 м в теге OSM против 0 м в статье
   * объекта» — правдоподобное число вместо «не знаем», в модуле, который ровно
   * такую подмену и ищет в чужих данных.
   */
  test("без разбора не выдумывает второе число", () => {
    renderPanel(
      <HeightDisputePanel
        dispute={{ ...ABU_DHABI_PLAZA, publishedM: null, publishedSource: null, cruiseAltMIfPublished: null, cruiseDeltaM: null, distanceKmIfPublished: null }}
      />,
    );
    const panel = screen.getByTestId("height-dispute");
    const text = panel.textContent ?? "";

    expect(text).toContain("382");
    expect(text).toContain("no review against published data exists yet");
    // Ни подставленного нуля, ни утёкшего null — обе формы одинаково врут.
    expect(text).not.toContain("против 0 м");
    expect(text).not.toContain("null");
    // Элемент источника назван даже без разбора: по нему высоту можно проверить.
    expect(panel.querySelector("a")?.getAttribute("href")).toBe("https://www.openstreetmap.org/way/486561786");
  });

  test("не делает ссылку, когда элемент источника неизвестен", () => {
    renderPanel(<HeightDisputePanel dispute={{ ...ABU_DHABI_PLAZA, osm: null }} />);
    const panel = screen.getByTestId("height-dispute");
    expect(panel.querySelector("a")).toBeNull();
    expect(panel.textContent ?? "").not.toContain("null");
  });

  test("молчит про крюк, когда путь не изменился, и про эшелон, когда он совпал", () => {
    renderPanel(
      <HeightDisputePanel
        dispute={{ ...ABU_DHABI_PLAZA, cruiseDeltaM: 0, cruiseAltMIfPublished: 425, distanceKmIfPublished: 2.42 }}
      />,
    );
    const text = screen.getByTestId("height-dispute").textContent ?? "";
    expect(text).not.toContain("higher than by the published one");
    expect(text).not.toContain("Route length");
    // но сам факт опоры на спорную высоту сказан всё равно
    expect(text).toContain("corridor raised by a disputed height");
  });

  test("тот же компонент говорит по-русски, когда язык русский", () => {
    // Проверка не косметическая: до 28.08.2026 текст был зашит по-русски, и
    // англоязычный посетитель видел русский. Симметричный случай доказывает,
    // что перевод не потерял русскую половину, пока чинили английскую.
    window.localStorage.setItem("aevion_lang_v1", "ru");
    try {
      renderPanel(<HeightDisputePanel dispute={ABU_DHABI_PLAZA} />);
      const text = screen.getByTestId("height-dispute").textContent ?? "";
      expect(text).toContain("участков 3");
      expect(text).toContain("382");
    } finally {
      window.localStorage.removeItem("aevion_lang_v1");
    }
  });
});
