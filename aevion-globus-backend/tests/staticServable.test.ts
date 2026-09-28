import { describe, it, expect } from "vitest";
import { корневойIndexHtml, можноСлужитьСтатикой } from "../src/lib/staticServable";

describe("что статический хостинг сможет отдать", () => {
  it("Next-проект без index.html служить нельзя", () => {
    expect(можноСлужитьСтатикой(["pages/index.jsx", "pages/_app.jsx", "components/Timer.jsx", "styles/globals.css"])).toBe(false);
  });

  it("сгенерированная статика служится", () => {
    expect(можноСлужитьСтатикой(["index.html", "style.css", "script.js"])).toBe(true);
  });

  it("написание пути не решает: ./, / и обратные косые — тот же корневой файл", () => {
    for (const p of ["./index.html", "/index.html", "index.html", ".\\index.html"]) {
      expect(можноСлужитьСтатикой([p]), p).toBe(true);
    }
  });

  it("index.html ВНУТРИ папки корнем не считается — адрес всё равно ответит 404", () => {
    expect(можноСлужитьСтатикой(["public/index.html", "src/index.html"])).toBe(false);
  });

  it("регистр имени не мешает", () => {
    expect(можноСлужитьСтатикой(["Index.HTML"])).toBe(true);
  });

  it("возвращается ИСХОДНОЕ написание — его показывают человеку", () => {
    expect(корневойIndexHtml(["./index.html"])).toBe("./index.html");
    expect(корневойIndexHtml(["pages/index.jsx"])).toBe(null);
  });

  it("пустой проект и мусор не ломают проверку", () => {
    expect(можноСлужитьСтатикой([])).toBe(false);
    expect(можноСлужитьСтатикой([undefined as unknown as string, ""])).toBe(false);
  });
});
