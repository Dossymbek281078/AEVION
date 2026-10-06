import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Если стек нельзя опубликовать — сказать это ДО выбора, а не последним шагом.
 *
 * ЗАМЕР НА ПРОДЕ 05.10.2026 (гость, стек react): генерация прошла — 4 файла,
 * $0.001053, — а выкатка отказала 409 «project is not static — nothing to
 * serve». Статическому хостингу нужен index.html в КОРНЕ, а модель разложила
 * проект по обычаю (public/index.html + src/*.jsx).
 *
 * У react это починено на стороне генерации (React с CDN, без сборки —
 * backend/tests/reactProjectIsPublishable.guard.test.ts). У next, express и
 * python починить нельзя: им нужен сервер, Cloudflare Pages их не отдаст ни при
 * какой раскладке. Значит остаётся честность: пометка в самом выборе.
 *
 * Это тот же класс, что «витрина обещала несуществующее»: предложение на входе
 * — такое же обещание, как цена на странице.
 */
const СТРАНИЦА = join(__dirname, "..", "page.tsx");
const СЛОВАРЬ = join(__dirname, "..", "i18n.ts");
const src = readFileSync(СТРАНИЦА, "utf8");
const dict = readFileSync(СЛОВАРЬ, "utf8");

describe("выбор стека честен про публикацию", () => {
  it("прибор исправен: страница и словарь прочитаны", () => {
    expect(src.length, "страница не прочитана").toBeGreaterThan(2000);
    expect(dict.length, "словарь не прочитан").toBeGreaterThan(2000);
    expect(src, "выбор стеков исчез со страницы").toContain("const STACKS");
  });

  it("серверные стеки помечены, статические — НЕТ", () => {
    const i = src.indexOf("СТЕКИ_БЕЗ_ПУБЛИКАЦИИ = new Set");
    expect(i, "список стеков без публикации исчез").toBeGreaterThan(0);
    const объявление = src.slice(i, i + 160);
    for (const серверный of ["next", "express", "python"]) {
      expect(объявление.includes(`"${серверный}"`), `${серверный} не помечен`).toBe(true);
    }
    // Контроль в обратную сторону: публикуемые стеки пометку получать не должны,
    // иначе она перестаёт что-либо значить и просто пугает всех.
    for (const публикуемый of ["static", "react"]) {
      expect(объявление.includes(`"${публикуемый}"`), `${публикуемый} помечен зря`).toBe(false);
    }
  });

  it("пометка действительно РИСУЕТСЯ, а не только объявлена", () => {
    // Условие проверяется целиком: `{(false && …` прошло бы проверку на позицию.
    expect(src, "пометка не отрисовывается по признаку").toContain('СТЕКИ_БЕЗ_ПУБЛИКАЦИИ.has(s.id) && (');
    expect(src, "текст пометки берётся не из словаря").toContain('t("stack.noPublish")');
  });

  it("текст пометки есть во ВСЕХ трёх языках", () => {
    // Пропуск перевода откатывается на английский ТИХО — поэтому считаем вхождения.
    const сколько = (dict.match(/"stack\.noPublish":/g) ?? []).length;
    expect(сколько, "ключ есть не во всех языках (ожидалось 3)").toBe(3);
  });

  it("описание react больше НЕ обещает сборку Vite", () => {
    // Оно обещало «Vite + React»; после починки проект идёт с CDN без сборки,
    // и прежнее описание стало неверным — а неверное описание хуже краткого.
    expect(dict.includes("Vite + React"), "описание react осталось про Vite").toBe(false);
    const сколькоCDN = (dict.match(/CDN/g) ?? []).length;
    expect(сколькоCDN, "про CDN сказано не во всех языках").toBeGreaterThanOrEqual(3);
  });
});
