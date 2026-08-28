import { describe, test, expect } from "vitest";
import { buildAuthorPreview, AUTHOR_PREVIEW_FALLBACK } from "./authorMetadata";

describe("карточка ссылки на страницу автора", () => {
  test("названо имя автора", () => {
    const p = buildAuthorPreview({ name: "Dosymbek", stats: { certificates: 3 } });
    expect(p.title).toContain("Dosymbek");
  });

  test("число работ названо, и в единственном числе без «1 works»", () => {
    // Проверяется именно СЛОВО, а не пунктуация: «1 registered works» —
    // мелочь, которую видно всем, кому переслали ссылку.
    const one = buildAuthorPreview({ name: "A", stats: { certificates: 1 } }).description;
    expect(one).toContain("1 registered work ");
    expect(one).not.toContain("1 registered works");
    expect(buildAuthorPreview({ name: "A", stats: { certificates: 4 } }).description).toContain("4 registered works");
  });

  test("ноль работ — карточка именная, но числа не выдумываются", () => {
    const p = buildAuthorPreview({ name: "A", stats: { certificates: 0 } });
    expect(p.title).toContain("A");
    expect(p.description).not.toMatch(/0 registered/);
  });

  test("мусор в числе не печатается", () => {
    const p = buildAuthorPreview({ name: "A", stats: { certificates: Number.NaN } });
    expect(p.description).not.toMatch(/NaN/);
  });

  test("спросить не удалось — общая карточка", () => {
    expect(buildAuthorPreview(null)).toEqual(AUTHOR_PREVIEW_FALLBACK);
    expect(buildAuthorPreview({ name: "" })).toEqual(AUTHOR_PREVIEW_FALLBACK);
  });

  test("общая карточка отличима от именной", () => {
    // Смысл: если спросить не удалось, карточка не должна выглядеть так,
    // будто она про конкретного человека.
    const named = buildAuthorPreview({ name: "Dosymbek", stats: { certificates: 2 } });
    expect(AUTHOR_PREVIEW_FALLBACK.title).not.toBe(named.title);
    expect(AUTHOR_PREVIEW_FALLBACK.title).toMatch(/AEVION Bureau/);
    // Общая карточка описывает реестр вообще — слово «registered works» в ней
    // законно; отличает её отсутствие ИМЕНИ, а не набор слов.
    expect(AUTHOR_PREVIEW_FALLBACK.title).not.toMatch(/Dosymbek/);
  });
});
