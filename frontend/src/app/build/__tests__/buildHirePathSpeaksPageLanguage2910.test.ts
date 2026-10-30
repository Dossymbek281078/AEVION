import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tBuild, tBuildN, BUILD_KEYS, BUILD_DICT, visibleProjects } from "../i18n";
import {
  WORK_REGIONS_KZ,
  WORK_MODES,
  EDUCATION_LEVELS,
  regionLabelIn,
  workModeLabelIn,
  educationLabelIn,
} from "@/lib/build/geo";
import { безКомментариев, мимоСловаря } from "./hirePathTextRules";

/*
 * 29.10.2026 (окно «Приложения»). Путь найма QBuild говорил смесью языков: на kk прибор
 * насчитал 294 чужие строки за путь (en — 82, ru — 179): «Construction projects»,
 * «+ Add vacancy», «🤖 Сгенерировать с AI», регионы КЗ только по-русски, «🧪 Тестовое задание».
 * Здесь: (а) словарь полон на ru/en/kk; (б) подстановки и множественное число; (в) в файлах
 * пути нет текста мимо словаря; (г) регионы/формат работы/образование есть на трёх языках;
 * (д) проекты-образцы (русские сиды) скрыты на en/kk и остаются на ru.
 */
const SRC = join(process.cwd(), "src");
const ФАЙЛЫ = [
  "app/build/page.tsx",
  "app/build/vacancies/page.tsx",
  "app/build/create-project/page.tsx",
  "app/build/project/[id]/page.tsx",
  "app/build/vacancy/[id]/page.tsx",
  "app/build/applications/page.tsx",
  "components/build/ProjectCard.tsx",
  "components/build/VacancyCard.tsx",
  "components/build/CompareToggleButton.tsx",
  "components/build/BookmarkButton.tsx",
  "components/build/ApplicationForm.tsx",
  "components/build/AiImprove.tsx",
  "components/build/AiVacancyGen.tsx",
  "components/build/TrialTaskBlock.tsx",
  "components/build/ReviewsSection.tsx",
  "components/build/StarRating.tsx",
  "components/build/HelpTip.tsx",
];
const кириллица = /[А-Яа-яЁё]/;

/** kk совпадает с ru намеренно: слово одинаково в обоих языках (термин, единица, бренд). */
const ОБЩИЕ_RU_KK = new Set<string>([
  "create.fBudget", // «Бюджет (USD)»
  "proj.budget", // «· Бюджет {amount}»
  "proj.kb", // «{n} КБ»
  "proj.conv", // «Конв.%»
  "vac.conv", // «Конв.»
  "vac.profile", // «Профиль →»
  "vac.median", // «медиана»
  "vac.aiGe", // «✨ AI ≥»
  "card.budgetM", // «${n} млн»
  "card.budget", // «${n}»
  "src.utm", // «UTM»
  "src.widget", // «Виджет»
]);

function код(ф: string): string {
  return безКомментариев(readFileSync(join(SRC, ф), "utf8"));
}

describe("путь найма QBuild: ru/en/kk", () => {
  test("у трёх языков все ключи непустые; en без кириллицы; kk не копия ru", () => {
    console.log(`знаменатель: ключей словаря ${BUILD_KEYS.length} × 3 языка; файлов пути ${ФАЙЛЫ.length}`);
    expect(BUILD_KEYS.length).toBeGreaterThan(400);
    for (const lang of ["ru", "en", "kk"]) for (const k of BUILD_KEYS) expect(BUILD_DICT[lang]![k].trim(), `${lang}:${k}`).not.toBe("");
    expect(BUILD_KEYS.filter((k) => кириллица.test(BUILD_DICT.en![k]))).toEqual([]);
    const копии = BUILD_KEYS.filter((k) => BUILD_DICT.kk![k] === BUILD_DICT.ru![k] && кириллица.test(BUILD_DICT.ru![k]));
    expect(копии.filter((k) => !ОБЩИЕ_RU_KK.has(k))).toEqual([]);
    // ru и kk — переводы, а не английский текст
    const англ = (lang: string) => BUILD_KEYS.filter((k) => BUILD_DICT[lang]![k] === BUILD_DICT.en![k] && /[A-Za-z]{4,} [A-Za-z]{4,}/.test(BUILD_DICT.en![k]));
    expect(англ("ru")).toEqual([]);
    expect(англ("kk")).toEqual([]);
  });

  test("подстановки и множественное число", () => {
    expect(tBuild("ru", "proj.created", { date: "29.10.2026" })).toBe("Создан 29.10.2026");
    expect(tBuild("en", "common.match", { n: 80 })).toBe("80% match");
    expect(tBuild("de", "proj.addVac")).toBe("+ Add vacancy"); // язык без словаря → en, не ru
    expect(tBuildN("ru", "card.vacancies", 1)).toBe("1 вакансия");
    expect(tBuildN("ru", "card.vacancies", 3)).toBe("3 вакансии");
    expect(tBuildN("ru", "card.vacancies", 11)).toBe("11 вакансий");
    expect(tBuildN("en", "card.vacancies", 1)).toBe("1 vacancy");
    expect(tBuildN("en", "card.vacancies", 2)).toBe("2 vacancies");
    expect(tBuildN("kk", "vcard.apps", 5)).toBe("5 өтінім");
    // селекторы рабочего пути: кнопка добавления вакансии начинается с «+ » на всех языках
    for (const lang of ["ru", "en", "kk"]) expect(tBuild(lang, "proj.addVac").startsWith("+ "), lang).toBe(true);
  });

  test("🔴 в файлах пути нет текста мимо словаря (JSX-текст, placeholder, aria-label, title, alt, тосты, confirm/prompt)", () => {
    const плохиеВсего: string[] = [];
    let строк = 0;
    for (const ф of ФАЙЛЫ) {
      const s = код(ф);
      const строки = s.split(/\r?\n/);
      строк += строки.length;
      const плохие = строки.filter(мимоСловаря);
      for (const l of плохие) плохиеВсего.push(`${ф}: ${l.trim()}`);
    }
    console.log(`знаменатель: файлов ${ФАЙЛЫ.length}, строк кода ${строк}, нарушений ${плохиеВсего.length}`);
    expect(плохиеВсего).toEqual([]);
  });

  test("регионы КЗ, формат работы и образование — на трёх языках; значение на сервер не меняется", () => {
    expect(WORK_REGIONS_KZ.length).toBe(20);
    for (const r of WORK_REGIONS_KZ) {
      expect(regionLabelIn(r.slug, "ru")).toBe(r.label); // прежняя русская подпись
      const en = regionLabelIn(r.slug, "en")!;
      const kk = regionLabelIn(r.slug, "kk")!;
      expect(en, `en:${r.slug}`).not.toMatch(кириллица);
      expect(en).not.toBe(r.slug);
      expect(kk, `kk:${r.slug}`).toMatch(кириллица);
    }
    // области: kk — «… облысы», не русское «… область»
    const областиKk = WORK_REGIONS_KZ.filter((r) => !r.slug.endsWith("-city")).map((r) => regionLabelIn(r.slug, "kk")!);
    expect(областиKk.every((x) => x.endsWith("облысы"))).toBe(true);
    for (const m of WORK_MODES) {
      expect(workModeLabelIn(m, "en")).not.toMatch(кириллица);
      expect(workModeLabelIn(m, "kk")).not.toBe(workModeLabelIn(m, "ru"));
    }
    for (const e of EDUCATION_LEVELS) {
      expect(educationLabelIn(e, "en")).not.toMatch(кириллица);
      expect(educationLabelIn(e, "kk")).toMatch(кириллица);
    }
    expect(regionLabelIn("unknown-slug", "kk")).toBe("unknown-slug");
    expect(regionLabelIn("astana-city", "de")).toBe("Astana"); // язык без словаря → en
  });

  test("проекты-образцы (флаг example, русские сиды) скрыты на en/kk и показаны на ru", () => {
    const проекты = [
      { id: "a", example: true },
      { id: "b", example: false },
      { id: "c" },
    ];
    expect(visibleProjects(проекты, "ru").map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(visibleProjects(проекты, "en").map((p) => p.id)).toEqual(["b", "c"]);
    expect(visibleProjects(проекты, "kk").map((p) => p.id)).toEqual(["b", "c"]);
    expect(visibleProjects(проекты, "de").map((p) => p.id)).toEqual(["b", "c"]);
    // и витрина /build действительно фильтрует ленту этой функцией с языком страницы
    const витрина = код("app/build/page.tsx");
    expect(витрина).toMatch(/setProjects\(visibleProjects\(r\.items, lang\)\)/);
  });
});
