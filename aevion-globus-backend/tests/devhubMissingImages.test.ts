import { describe, it, expect } from "vitest";
import { подставитьЗаглушкиКартинок, ЗАГЛУШКА_SVG } from "../src/lib/devhubMissingImages";

/**
 * 4.11.2026, замер Ниш на проде: у сгенерированного сайта нет картинки шапки
 * (<img src="hero.jpg">, файла нет), alt-текст крупно лезет поверх заголовка.
 */
describe("битые картинки сгенерированного сайта получают заглушку", () => {
  it("относительный src без файла → SVG-заглушка, alt остаётся", () => {
    const html = '<header><img class="hero" src="hero.jpg" alt="Фото салона"><h1>Салон</h1></header>';
    const { files, замены } = подставитьЗаглушкиКартинок([{ path: "index.html", content: html }]);
    expect(замены).toEqual([{ file: "index.html", src: "hero.jpg" }]);
    expect(files[0].content).toContain(`src="${ЗАГЛУШКА_SVG}"`);
    expect(files[0].content).toContain('alt="Фото салона"');
    expect(files[0].content).toContain("<h1>Салон</h1>");
  });

  it("файл есть (в т.ч. в public/) — не трогаем; внешние и data: — не трогаем", () => {
    const html = '<img src="/images/a.png" alt="a"><img src="./b.png"><img src="https://x.test/c.png"><img src="data:image/png;base64,AAA">';
    const { files, замены } = подставитьЗаглушкиКартинок(
      [{ path: "index.html", content: html }],
      [{ path: "public/images/a.png", content: "" }, { path: "b.png", content: "" }],
    );
    expect(замены).toEqual([]);
    expect(files[0].content).toBe(html);
  });

  it("картинка из той же генерации считается существующей; не-html файлы не трогаем", () => {
    const { files, замены } = подставитьЗаглушкиКартинок([
      { path: "index.html", content: '<img src="hero.jpg">' },
      { path: "hero.jpg", content: "..." },
      { path: "styles.css", content: 'background: url("nope.png")' },
    ]);
    expect(замены).toEqual([]);
    expect(files[0].content).toBe('<img src="hero.jpg">');
    expect(files[2].content).toContain("nope.png");
  });

  it("мутация: JSX с выражением в src не ломаем", () => {
    const jsx = '<img src={hero} alt="x" />';
    const { files } = подставитьЗаглушкиКартинок([{ path: "app/page.tsx", content: jsx }]);
    expect(files[0].content).toBe(jsx);
  });
});
