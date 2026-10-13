import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Волна 132 (13.10.2026, сужена оркестратором до словарей). Карточка «Опубликовать» в чате
 * проекта DevHub была жёстко по-русски — английский гость из Shorts видел ключевой шаг на чужом
 * языке. Текст — из GEN_UI ru/en/kk; в JSX карточки кириллицы нет; en-значения без кириллицы.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/devhub/[id]/page.tsx"), "utf8");
const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/g;
const КЛЮЧИ = ["deployHintLead", "deployHintOwnDomain", "deployHintPagesDev", "deployHintTail", "deployHintButton"];

function блокЯзыка(lang: "ru" | "en" | "kk"): string {
  const i = СТРАНИЦА.indexOf(`\n  ${lang}: {\n    ph:`);
  expect(i, `словарь GEN_UI.${lang}`).toBeGreaterThan(0);
  return СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n  },", i));
}

describe("карточка публикации — на языке интерфейса", () => {
  it("🔴 словари: пять ключей карточки в ru, en и kk; en без кириллицы; адреса *.pages.dev/*.aevion.app внутри строк", () => {
    for (const lang of ["ru", "en", "kk"] as const) {
      const блок = блокЯзыка(lang);
      for (const k of КЛЮЧИ) {
        const m = блок.match(new RegExp(`${k}: "([^"]+)"`));
        expect(m, `${lang}.${k}`).not.toBeNull();
        if (lang === "en") expect((m![1].match(КИРИЛЛИЦА) || []).length, `${lang}.${k} кириллица`).toBe(0);
      }
      expect(блок).toMatch(/deployHintPagesDev: "[^"]*\*\.pages\.dev"/);
      expect(блок).toMatch(/deployHintOwnDomain: "[^"]*\*\.aevion\.app"/);
    }
  });

  it("🔴 JSX карточки в чате — из словаря, без кириллицы, с меткой для приборов", () => {
    const i = СТРАНИЦА.indexOf('msg.kind === "deploy" ? (');
    expect(i).toBeGreaterThan(0);
    const область = СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n                          ) : (", i));
    expect(область).toContain('data-devhub-deploy-hint="chat"');
    expect(область).toContain("{GL.deployHintLead}");
    expect(область).toContain("GL.deployHintOwnDomain : GL.deployHintPagesDev");
    expect(область).toContain("{GL.deployHintButton}");
    const код = область.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect((код.match(КИРИЛЛИЦА) || []).join("")).toBe("");
  });
});
