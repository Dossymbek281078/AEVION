import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zagolovokPoMetke, nomerRolika } from "../zagolovokPoMetke";
import { postFrom } from "@/lib/products";

/*
 * 🔴 Первый экран /devhub повторяет обещание ролика, с которого пришёл человек.
 *
 * Повод 13.10.2026: 12 живых за сутки открыли /devhub и ушли без шага (стол, день);
 * кадр по метке yt-devhub-1 показывал «DevHub» и навигацию, а ролик обещал «сайт
 * кофейни — от слов до живого адреса». Проверяем разбор НАСТОЯЩИХ меток постов
 * через postFrom прода, три языка, общее обещание без метки, и что страница
 * печатает именно это.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/devhub/page.tsx"), "utf8");

describe("обещание по метке", () => {
  it("🔴 настоящие метки постов ведут к своему ролику (через postFrom прода)", () => {
    const случаи: Array<[string, string]> = [
      ["yt-devhub-1", "1"], ["li-devhub-1", "1"], ["x-devhub-1", "1"],
      ["yt-devhub-3", "3"], ["yt-devhub-4", "4"], ["yt-devhub-5", "5"], ["x-avto-1", "5"],
    ];
    for (const [метка, номер] of случаи) {
      const пост = postFrom(метка);
      expect(пост, `postFrom(${метка})`).toBeTruthy();
      expect(nomerRolika(пост), `${метка} → пост ${пост}`).toBe(номер);
      expect(zagolovokPoMetke("ru", пост).istochnik).toBe(`ролик-${номер}`);
    }
  });

  it("чужие и пустые метки — общее обещание, не чужой ролик", () => {
    for (const пост of [postFrom("yt-chess-1"), postFrom("ig"), null, "", "devhub-2", "7", "blogger-1"]) {
      const о = zagolovokPoMetke("ru", пост);
      expect(о.istochnik).toBe("общее");
      expect(о.primer).toBeNull();
    }
  });

  it("🔴 три языка: заголовок и пример есть у каждого ролика, общий — у каждого языка, тексты различны", () => {
    for (const lang of ["ru", "en", "kk"] as const) {
      expect(zagolovokPoMetke(lang, null).h1.length).toBeGreaterThan(10);
      for (const номер of ["1", "3", "4", "5"]) {
        const о = zagolovokPoMetke(lang, `devhub-${номер}`);
        expect(о.h1.length, `${lang} ролик ${номер}`).toBeGreaterThan(10);
        expect(о.primer && о.primer.length, `${lang} пример ${номер}`).toBeGreaterThan(15);
      }
    }
    expect(zagolovokPoMetke("ru", "devhub-1").h1).not.toBe(zagolovokPoMetke("en", "devhub-1").h1);
    expect(zagolovokPoMetke("ru", "devhub-1").h1).not.toBe(zagolovokPoMetke("kk", "devhub-1").h1);
    // неизвестный язык — русский, не падение
    expect(zagolovokPoMetke("de", "devhub-1").h1).toBe(zagolovokPoMetke("ru", "devhub-1").h1);
  });

  it("ролик 1: заголовок повторяет обещание ролика (кофейня, живой адрес), пример — отправляемая фраза", () => {
    const о = zagolovokPoMetke("ru", "devhub-1");
    expect(о.h1).toMatch(/кофейни/i);
    expect(о.h1).toMatch(/живого адреса/i);
    expect(о.primer).toMatch(/кофейни/);
  });

  it("🔴 страница: h1 — из обещания, пример по метке — первым в поле, обещание пересчитывается после монтирования", () => {
    expect(СТРАНИЦА).toContain("{обещание.h1}");
    expect(СТРАНИЦА).toContain("data-devhub-obeshchanie={обещание.istochnik}");
    expect(СТРАНИЦА).toContain("setОбещание(zagolovokPoMetke(lang, postNow()))");
    expect(СТРАНИЦА).toContain('const примеры = [...(поМетке ? [поМетке] : []), t("hero.ex1")');
    // имени продукта в h1 больше нет — оно в кикере над заголовком
    expect(СТРАНИЦА).not.toMatch(/<h1[^>]*>\s*DevHub\s*<\/h1>/);
  });
});
