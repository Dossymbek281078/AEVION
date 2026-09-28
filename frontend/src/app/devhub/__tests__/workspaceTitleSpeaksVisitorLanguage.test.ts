// Заголовок вкладки рабочего окна и имя проекта — то, что человек читает РАНЬШЕ
// самой страницы (вкладка, история, предпросмотр ссылки) и узнаёт как своё.
// 28.09.2026, замер соседнего окна живым браузером как западный гость:
//  1) при выбранном English заголовок вкладки оставался «Рабочее окно проекта — DevHub»;
//  2) «probe-launch-check: one page…» превращалось в «probelaunchcheck one page with a».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { языкИзЗаголовка } from "../[id]/layout";

describe("заголовок рабочего окна говорит на языке посетителя", () => {
  it("язык берётся первым по порядку из Accept-Language", () => {
    expect(языкИзЗаголовка("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(языкИзЗаголовка("en-US,en;q=0.9,ru;q=0.8")).toBe("en");
    expect(языкИзЗаголовка("kk-KZ,kk;q=0.9")).toBe("kk");
  });

  it("незнание — английский: корневой макет объявляет lang=en", () => {
    expect(языкИзЗаголовка(null)).toBe("en");
    expect(языкИзЗаголовка("")).toBe("en");
    expect(языкИзЗаголовка("zz-ZZ")).toBe("en");
  });

  it("метаданные строятся через generateMetadata, а не жёсткой строкой", () => {
    const макет = readFileSync(join(__dirname, "..", "[id]", "layout.tsx"), "utf8");
    expect(макет).toContain("export async function generateMetadata");
    expect(макет).toContain("accept-language");
    // и все три языка на месте
    expect(макет).toContain("Рабочее окно проекта — DevHub");
    expect(макет).toContain("Project workspace — DevHub");
    expect(макет).toContain("Жоба жұмыс терезесі — DevHub");
  });
});

describe("имя проекта узнаваемо", () => {
  // Та же очистка, что на странице: буквы, цифры, пробел, точка, дефис, подчёркивание.
  const имя = (idea: string) =>
    idea.replace(/[^\p{L}\p{N} ._-]/gu, "").split(/\s+/).slice(0, 5).join(" ").slice(0, 40) || "My app";

  it("дефисы остаются — иначе пробу нечем пометить", () => {
    expect(имя("probe-launch-check: one page with a menu")).toContain("probe-launch-check");
  });

  it("опасное по-прежнему вырезается", () => {
    const из = имя("<script>alert(1)</script> лендинг");
    expect(из).not.toContain("<");
    expect(из).not.toContain(">");
    expect(из).not.toContain("(");
  });

  it("пустая идея не даёт пустое имя", () => {
    expect(имя("!!!")).toBe("My app");
  });
});
