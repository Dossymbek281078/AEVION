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

  // 24.10.2026: названия вариантов (фоны, звуки, темы, декор) шли по-русски на /en и /kk —
  // окно показывало 89 русских строк из 175. Новый вариант в данных без перевода — красный.
  it("у каждого варианта из данных есть en и kk", () => {
    const чит = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
    const ключи = [
      ...[...чит("chessSounds.ts").matchAll(/id: "([^"]+)", name: "/g)].map((m) => `sn.${m[1]}`),
      ...[...чит("BoardArt.tsx").matchAll(/\{ v: "([^"]+)",/g)].map((m) => `art.${m[1]}`),
      ...[...чит("Pieces.tsx").matchAll(/\{ id: "([^"]+)",\s*name:/g)].map((m) => `pch.${m[1]}`),
      ...[...СТРАНИЦА.slice(СТРАНИЦА.indexOf("const BG_PRESETS"), СТРАНИЦА.indexOf("const BOARD_THEMES")).matchAll(/\{id:"([^"]+)",\s*name:/g)].map((m) => `bg.${m[1]}`),
    ];
    // знаменатель: 61 звук + 6 декоров + 4 набора + 16 фонов на 24.10
    expect(ключи.length, "вариантов найдено").toBeGreaterThan(80);
    for (const loc of ["en", "kk"] as const) {
      expect(ключи.filter((k) => !SETTINGS_TEXT[loc][k]), `без перевода ${loc}`).toEqual([]);
    }
  });

  it("модуль грузится только динамически", () => {
    expect(СТРАНИЦА).toContain('import("./settingsText")');
    expect(СТРАНИЦА).not.toMatch(/^import[^\n]*from "\.\/settingsText"/m);
  });
});
