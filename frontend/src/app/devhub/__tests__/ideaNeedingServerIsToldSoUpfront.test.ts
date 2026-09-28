// Вход DevHub всегда создаёт static: замер 28.09.2026 на живом проде — адрес 200 за
// 45–88 с, тогда как react/next/express публиковались «успешно» и отдавали 404.
// Но идее с аккаунтами, базой или оплатой статика даёт БРАУЗЕРНУЮ версию на localStorage.
// Молчать нельзя: человек ждал сервер, а узнал бы отличие только на своих данных.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { даннымНуженСервер, stackForIdea } from "../../../lib/devhubStackChoice";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const dict = readFileSync(join(__dirname, "..", "i18n.ts"), "utf8");

describe("идее, которой нужен сервер, говорят это ДО генерации", () => {
  it("подпись висит на том же признаке, что раньше выбирал стек", () => {
    expect(page).toContain("даннымНуженСервер(ideaPrompt)");
    expect(page).toContain('t("hero.needsServerNote")');
  });

  it("признак отвечает по делу, а стек всё равно static", () => {
    for (const idea of ["магазин с оплатой и корзиной", "трекер задач с базой данных", "сервис с логином"]) {
      expect(даннымНуженСервер(idea), idea).toBe(true);
      expect(stackForIdea(idea), idea).toBe("static");
    }
    for (const idea of ["портфолио фотографа с галереей", "лендинг кофейни"]) {
      expect(даннымНуженСервер(idea), idea).toBe(false);
    }
  });

  it("текст есть на всех трёх языках страницы и называет, где будут данные", () => {
    const хиты = dict.match(/"hero\.needsServerNote": "[^"]*"/g) ?? [];
    expect(хиты.length).toBe(3);
    for (const х of хиты) expect(х.length).toBeGreaterThan(80);
    expect(dict).toMatch(/hero\.needsServerNote": "[^"]*браузере/);
  });
});
