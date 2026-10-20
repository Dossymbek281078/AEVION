import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ПРОЕКТЫ_ОБРАЗЦЫ, проектОбразец, неОбразецSql } from "../src/data/buildExampleProjects";

/**
 * Сторож: проекты-образцы QBuild помечены и не входят в счётчики и ленту.
 *
 * 🔴 Замер прода 20.10.2026: пять проектов-образцов (без работодателя, вакансии истекли
 * 14–18.09) считались в «проектах» героя и статистики. Решение Оркестратора: плашка
 * «Пример проекта», из счётчиков вон, истёкшие вакансии в ленту не идут, переоткрывать
 * нельзя (вакансии без работодателя были бы выдуманными).
 */
const читать = (f: string) => readFileSync(join(__dirname, "..", "src", "routes", "build", f), "utf8");

describe("QBuild: проекты-образцы", () => {
  test("признак узнаёт все пять и только их", () => {
    expect(ПРОЕКТЫ_ОБРАЗЦЫ).toHaveLength(5);
    for (const id of ПРОЕКТЫ_ОБРАЗЦЫ) expect(проектОбразец(id), id).toBe(true);
    expect(проектОбразец("62ba6b97-cc8e-4bf1-9603-e7722ab21f44")).toBe(false);
    expect(проектОбразец(undefined)).toBe(false);
    const sql = неОбразецSql('p."id"');
    for (const id of ПРОЕКТЫ_ОБРАЗЦЫ) expect(sql).toContain(`'${id}'`);
    expect(sql).toMatch(/^p\."id"::text NOT IN \(/);
  });

  test("/api/build/stats: каждый счёт проектов и вакансий исключает образцы", () => {
    const s = читать("stats.ts");
    const блок = s.slice(s.indexOf('statsRouter.get("/"'), s.indexOf("return ok(res, {", s.indexOf('statsRouter.get("/"')));
    const счётаПроектов = блок.split("\n").filter((l) => /FROM "Build(Project|Vacancy)" [vp] /.test(l));
    expect(счётаПроектов.length, "сторож ослеп: счёты не найдены").toBe(5);
    for (const l of счётаПроектов) expect(l, "образцы снова в счёте").toContain("${неОбразец}");
  });

  test("герой /api/build/health: открытые вакансии и проекты без образцов", () => {
    const s = читать("health.ts");
    expect(s.split("AND ${неОбразец}`").length - 1, "счёт героя потерял исключение").toBe(2);
  });

  test("лента вакансий: без истёкших и без вакансий образцов", () => {
    const s = читать("vacancies.ts");
    expect(s).toContain(`where.push(\`(v."expiresAt" IS NULL OR v."expiresAt" > NOW())\`);`);
    expect(s).toContain(`where.push(неОбразецSql('v."projectId"'));`);
  });

  test("список и карточка проекта отдают example", () => {
    const s = читать("projects.ts");
    expect(s).toContain("example: проектОбразец(r.id)");
    expect(s.split("example: проектОбразец(project.rows[0].id)").length - 1).toBe(2);
  });
});
