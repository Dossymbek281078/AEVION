/**
 * Панель проектов — фиксированная плашка на 240 px справа. Дважды приводила к
 * тому, что край контента уходил под неё (на лаунчпаде срезало кнопку «Играть»),
 * и один раз к тому, что авто-перевод переименовывал наши продукты:
 * «Ксайн / QSign» → «Xsign / QSign». Оба свойства проверяем здесь, потому что
 * глазами это видно только на экране шире 1100 и только в нерусской локали.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import AevionProjectsBanner from "../AevionProjectsBanner";

afterEach(cleanup);

describe("AevionProjectsBanner", () => {
  it("пока панель видна, контент получает отступ на её ширину", () => {
    expect(document.body.style.paddingRight).toBe("");
    render(<AevionProjectsBanner onHide={() => {}} />);
    expect(document.body.style.paddingRight).toBe("240px");
  });

  it("после скрытия отступ возвращается к прежнему", () => {
    const { unmount } = render(<AevionProjectsBanner onHide={() => {}} />);
    expect(document.body.style.paddingRight).toBe("240px");
    unmount();
    expect(document.body.style.paddingRight).toBe("");
  });

  it("имена продуктов помечены как непереводимые", () => {
    const { getByText } = render(<AevionProjectsBanner onHide={() => {}} />);
    for (const name of ["Крайт / QShield", "Ксайн / QSign", "QBuild", "QRight"]) {
      const el = getByText(name);
      expect(el.getAttribute("translate"), `${name}: нет translate="no"`).toBe("no");
      expect(el.classList.contains("notranslate"), `${name}: нет класса notranslate`).toBe(true);
    }
  });
});
