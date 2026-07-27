import { describe, expect, it } from "vitest";
import { newsUrl } from "../src/routes/search";

/**
 * В `QNewsArticle.url` лежат ссылки двух разных сортов: настоящие внешние
 * (материал первоисточника) и внутренние вида `https://aevion.app/news/<slug>` —
 * маршрута `/news/*` во фронте нет, такая ссылка отдаёт 404. Проверено вживую
 * 27.07.2026: `https://aevion.app/news/healthai-llm-plans` → 404 и на
 * `aevion.app`, и на `aevion.vercel.app`.
 *
 * Правило: наружу пускаем только чужой хост, свой — заменяем на страницу модуля.
 */
describe("newsUrl: наружу только настоящие внешние ссылки", () => {
  it("чужой хост остаётся как есть", () => {
    expect(newsUrl("https://techcrunch.com/2026/07/ai", "id-1")).toBe("https://techcrunch.com/2026/07/ai");
  });

  it("собственный домен заменяется на страницу модуля", () => {
    expect(newsUrl("https://aevion.app/news/healthai-llm-plans", "id-2")).toBe("/qnews?item=id-2");
  });

  it("прод-домен vercel тоже считается своим", () => {
    expect(newsUrl("https://aevion.vercel.app/news/x", "id-3")).toBe("/qnews?item=id-3");
  });

  it("поддомен своего домена тоже свой", () => {
    expect(newsUrl("https://www.aevion.app/news/x", "id-4")).toBe("/qnews?item=id-4");
  });

  it("похожий чужой домен своим НЕ считается", () => {
    expect(newsUrl("https://notaevion.app/news/x", "id-5")).toBe("https://notaevion.app/news/x");
  });

  it("пустое, битое и не-строковое значение уводит на страницу модуля", () => {
    expect(newsUrl("", "id-6")).toBe("/qnews?item=id-6");
    expect(newsUrl("не ссылка", "id-7")).toBe("/qnews?item=id-7");
    expect(newsUrl(null, "id-8")).toBe("/qnews?item=id-8");
    expect(newsUrl(undefined, "id-9")).toBe("/qnews?item=id-9");
  });

  it("id экранируется — он попадает в адрес", () => {
    expect(newsUrl(null, "a b&c")).toBe("/qnews?item=a%20b%26c");
  });
});
