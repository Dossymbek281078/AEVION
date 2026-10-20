/**
 * Ответы консилиума читаются как текст, а не как исходник Markdown; агенты названы ролями.
 *
 * ПОВОД (20.10.2026, путь гостя на проде 1463×724, прибор
 * ПРИЛОЖЕНИЯ/multichat-2026-10-20-put-Prilozheniya/put-multichat.mjs): три агента
 * ответили за 18 с, но человек видел «**Доводы ЗА:**» звёздочками, а в блоке
 * разногласий — «analyst: 2 · skeptic: 8».
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { разметкаОтвета, имяАгента, сИменами } from "../CouncilConsole";

const показать = (t: string) => render(<p style={{ whiteSpace: "pre-wrap" }}>{разметкаОтвета(t)}</p>).container;

describe("ответ агента: простая разметка", () => {
  it("**жирный** становится <strong>, звёздочек на экране нет", () => {
    const c = показать("**Доводы ЗА:**\n1. **Выручка.** Подписка даёт поток.");
    expect(c.textContent).not.toContain("**");
    expect([...c.querySelectorAll("strong")].map((e) => e.textContent)).toEqual(["Доводы ЗА:", "Выручка."]);
  });

  it("строка-заголовок #/##/### — жирная строка без решёток", () => {
    const c = показать("### Короткий разбор\nтекст");
    expect(c.textContent).toBe("Короткий разбор\nтекст");
    expect(c.querySelector("strong")?.textContent).toBe("Короткий разбор");
  });

  it("HTML из ответа модели не исполняется — остаётся текстом", () => {
    const c = показать('<img src=x onerror="alert(1)"> **ok**');
    expect(c.querySelector("img")).toBeNull();
    expect(c.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("одиночная звёздочка и переносы строк сохраняются", () => {
    const c = показать("a * b\n\nc");
    expect(c.textContent).toBe("a * b\n\nc");
  });
});

describe("текст проверки с сервера", () => {
  it("id агентов заменяются ролями, слова-соседи не трогаются", () => {
    expect(сИменами("Сверить число с источником — analyst: 200 против practic: 30. Контекст: «x»"))
      .toBe("Сверить число с источником — Аналитик: 200 против Практик: 30. Контекст: «x»");
    expect(сИменами("Агент skeptic не ответил")).toBe("Агент Скептик не ответил");
    expect(сИменами("analysts и practical")).toBe("analysts и practical");
  });
});

describe("панель консилиума: разные семьи моделей", () => {
  it("три агента — три разных поставщика, у каждого запасные", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "CouncilConsole.tsx"), "utf8");
    const панель = src.slice(src.indexOf("const PANEL = ["), src.indexOf("];", src.indexOf("const PANEL = [")));
    const поставщики = [...панель.matchAll(/provider: "([a-z]+)"/g)].map((m) => m[1]);
    expect(поставщики).toHaveLength(3);
    expect(new Set(поставщики).size, "одна семья моделей трижды — «разногласия» становятся декорацией").toBe(3);
    expect([...панель.matchAll(/fallback: \[/g)]).toHaveLength(3);
  });
});

describe("имя агента", () => {
  it("роль из панели вместо внутреннего id; неизвестный id — как есть", () => {
    expect(имяАгента("analyst")).toBe("Аналитик");
    expect(имяАгента("skeptic")).toBe("Скептик");
    expect(имяАгента("practic")).toBe("Практик");
    expect(имяАгента("x-agent")).toBe("x-agent");
  });
});
