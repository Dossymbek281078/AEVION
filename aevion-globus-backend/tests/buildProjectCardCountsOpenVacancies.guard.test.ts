import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: число вакансий у проекта QBuild — только ОТКРЫТЫЕ.
 *
 * 🔴 Замер прода 20.10.2026: на /build пять проектов с подписью «Открыт · 2 вакансии»,
 * а все 10 вакансий закрыты (истекли 14–18.09), лента вакансий пуста, /api/build/stats
 * отдаёт vacancies.open 0. Работник шёл в проект откликаться — и находил ноль.
 * Карточка (ProjectCard, переменная openVacancies), сумма «Vacancies» на главной и
 * OG-картинка «N roles open» читают одно поле — оно обязано считать только OPEN.
 */
const корень = join(__dirname, "..", "..");
const читать = (p: string) => readFileSync(join(корень, p), "utf8");

describe("QBuild: открытые вакансии проекта", () => {
  test("список проектов считает vacancyCount только по status = 'OPEN'", () => {
    const sql = читать("aevion-globus-backend/src/routes/build/projects.ts");
    const подзапрос = sql.match(/\(SELECT COUNT\(\*\) FROM "BuildVacancy" v WHERE ([^)]*)\)::int AS "vacancyCount"/);
    expect(подзапрос, "подзапрос vacancyCount не найден — сторож ослеп").not.toBeNull();
    expect(подзапрос![1], "закрытые вакансии снова считаются открытыми").toContain(`v."status" = 'OPEN'`);
  });

  test("OG-картинка проекта «N roles open» не считает закрытые", () => {
    const og = читать("frontend/src/app/build/project/[id]/opengraph-image.tsx");
    expect(og).toMatch(/vacancyCount = \(data\?\.vacancies \?\? \[\]\)\.filter\(\(v\) => v\.status === "OPEN"\)\.length/);
    expect(og, "длина всего списка вместо открытых").not.toContain("data?.vacancies?.length");
  });
});
