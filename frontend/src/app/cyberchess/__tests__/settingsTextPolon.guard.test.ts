import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SETTINGS_TEXT } from "../settingsText";

/**
 * Окно «Настройки» на /en было целиком русским (около сотни надписей).
 * 24.10.2026 тексты вынесены в settingsText.ts, который page.tsx грузит
 * динамически при первом открытии окна: в i18n.ts три словаря добавляли 18 КБ
 * к модулям первого экрана (храповик znaniyaTreneraNeGruzyatsyaDoPervogoHoda).
 *
 * Общие сторожа словаря (everyRuKeyHasKkAndEn и др.) читают только i18n.ts —
 * этот файл они не видят, поэтому у него свой сторож.
 */

const СТРАНИЦА = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const КИРИЛЛИЦА = /[А-Яа-яЁё]/;

describe("тексты окна настроек", () => {
  const ru = Object.keys(SETTINGS_TEXT.ru);

  it("словарь прочитан и окно на него опирается", () => {
    expect(ru.length, "ключей ru").toBeGreaterThan(80);
    const a = СТРАНИЦА.indexOf("<Modal open={showSettings");
    const окно = СТРАНИЦА.slice(a, СТРАНИЦА.indexOf("</Modal>", a));
    const ключи = [...окно.matchAll(/\bst\("([a-z0-9_]+)"\)/g)].map((m) => m[1]);
    expect(ключи.length, "вызовов st() в окне").toBeGreaterThan(80);
    expect(ключи.filter((k) => !(k in SETTINGS_TEXT.ru)), "ключ без текста — в окне покажется имя ключа").toEqual([]);
  });

  it("каждый ключ есть на всех языках и не пуст", () => {
    for (const loc of ["en", "kk"] as const) {
      expect(ru.filter((k) => !SETTINGS_TEXT[loc][k]?.trim()), `пропуски ${loc}`).toEqual([]);
    }
  });

  it("английский текст без кириллицы", () => {
    const плохие = Object.entries(SETTINGS_TEXT.en).filter(([, v]) => КИРИЛЛИЦА.test(v)).map(([k]) => k);
    // контроль прибора: на русском словаре он обязан сработать
    expect(Object.values(SETTINGS_TEXT.ru).filter((v) => КИРИЛЛИЦА.test(v)).length).toBeGreaterThan(80);
    expect(плохие).toEqual([]);
  });

  it("модуль грузится только динамически", () => {
    expect(СТРАНИЦА).toContain('import("./settingsText")');
    expect(СТРАНИЦА).not.toMatch(/^import[^\n]*from "\.\/settingsText"/m);
  });
});
