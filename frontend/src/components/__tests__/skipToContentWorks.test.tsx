import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import SkipToContent from "../SkipToContent";

/**
 * Замер 02.09.2026 на проде: до содержимого нужно было 18 нажатий Tab, и так
 * на каждой странице с общей шапкой. Ссылка снимает это одним нажатием.
 *
 * Сторож проверяет ПОВЕДЕНИЕ, а не наличие строки: ссылка «перейти», которая
 * прокручивает страницу и оставляет фокус в шапке, выглядит сработавшей и не
 * делает ничего — это молчаливый отказ (§16 правил).
 */

describe("ссылка «перейти к содержимому» переводит фокус", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("уводит фокус в <main>, когда он есть", () => {
    const main = document.createElement("main");
    main.textContent = "содержимое";
    document.body.appendChild(main);

    const { getByText } = render(<SkipToContent />);
    fireEvent.click(getByText("Перейти к содержимому"));

    expect(document.activeElement).toBe(main);
  });

  it("запасной путь: уводит в заголовок, когда <main> нет", () => {
    const h1 = document.createElement("h1");
    h1.textContent = "Цены";
    document.body.appendChild(h1);

    const { getByText } = render(<SkipToContent />);
    fireEvent.click(getByText("Перейти к содержимому"));

    expect(document.activeElement).toBe(h1);
  });

  it("id=main-content старше <main>, если задан", () => {
    const main = document.createElement("main");
    const якорь = document.createElement("div");
    якорь.id = "main-content";
    document.body.append(якорь, main);

    const { getByText } = render(<SkipToContent />);
    fireEvent.click(getByText("Перейти к содержимому"));

    expect(document.activeElement).toBe(якорь);
  });

  it("контроль: без нажатия фокус НЕ уходит сам", () => {
    const main = document.createElement("main");
    document.body.appendChild(main);
    render(<SkipToContent />);
    expect(document.activeElement).not.toBe(main);
  });

  it("контроль: цели нет — ничего не падает и фокус не уводится", () => {
    const { getByText } = render(<SkipToContent />);
    expect(() => fireEvent.click(getByText("Перейти к содержимому"))).not.toThrow();
  });

  it("ссылка стоит ПЕРЕД шапкой: иначе она не первая в обходе Tab", () => {
    const шапка = fs.readFileSync(
      path.join(__dirname, "..", "SiteHeader.tsx"), "utf8");
    const ссылка = шапка.indexOf("<SkipToContent");
    const заголовок = шапка.indexOf("<header");
    expect(ссылка).toBeGreaterThan(-1);
    expect(ссылка).toBeLessThan(заголовок);
  });
});
