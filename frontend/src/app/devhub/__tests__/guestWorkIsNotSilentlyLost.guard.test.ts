import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEVHUB_DICT } from "../i18n";

/**
 * Раз зовём работать без аккаунта — говорим, где эта работа живёт.
 *
 * Замер 28.08.2026. Посадочная DevHub приглашает начать без входа («No GitHub
 * or cloud accounts needed»), а личность гостя лежит в `localStorage`
 * (`lib/devhubGuest.ts`). Очистил хранилище, открыл другой браузер, зашёл в
 * приватном окне — проекты остались на сервере, но человек их больше НЕ ВИДИТ,
 * и вернуть их нечем: идентификатор был единственным ключом.
 *
 * Витрина об этом не говорила нигде. Пригласить и умолчать о цене — то же
 * самое, что обещать лишнее, только наоборот: человек узнаёт, потеряв.
 *
 * Сторож связывает ДВЕ стороны. Пока личность гостя хранится в браузере,
 * витрина обязана предупреждать. Уберут гостевой режим или перенесут личность
 * — правило само перестанет требовать текста, и это верно.
 */

const STORE = path.join(__dirname, "..", "page.tsx");
const GUEST = path.join(__dirname, "..", "..", "..", "lib", "devhubGuest.ts");

/** Хранится ли личность гостя в браузере. */
function guestIdentityLivesInBrowser(): boolean {
  const src = fs.readFileSync(GUEST, "utf8");
  return /localStorage/.test(src) && /devhub_guest_id/.test(src);
}

describe("работа гостя не пропадает молча", () => {
  test("прибор работает: оба файла на месте", () => {
    expect(fs.existsSync(GUEST), "модуль гостевой личности не найден").toBe(true);
    expect(fs.readFileSync(STORE, "utf8").length).toBeGreaterThan(5000);
  });

  test("личность гостя действительно в браузере — иначе правило ни к чему", () => {
    // Проверка направления: перенесут личность на сервер, и этот тест
    // покраснеет, потребовав пересмотреть текст, а не наоборот.
    expect(guestIdentityLivesInBrowser(), "личность больше не в браузере — предупреждение пора пересмотреть").toBe(true);
  });

  test("витрина показывает предупреждение", () => {
    const src = fs.readFileSync(STORE, "utf8");
    expect(src, "предупреждение убрано с витрины").toContain('t("proj.browserBound")');
  });

  test("во всех трёх языках предупреждение называет браузер и вход", () => {
    const marks: Record<string, string[][]> = {
      en: [["browser"], ["sign in", "signing in"]],
      ru: [["браузер"], ["войд", "вход"]],
      kk: [["браузер"], ["кір"]],
    };
    const bad: string[] = [];
    for (const [lang, groups] of Object.entries(marks)) {
      const text = String(DEVHUB_DICT[lang]?.["proj.browserBound"] ?? "").toLowerCase();
      if (!text) { bad.push(`${lang}: текста нет`); continue; }
      for (const words of groups) {
        if (!words.some((w) => text.includes(w))) bad.push(`${lang}: нет ни одного из ${words.join("/")}`);
      }
    }
    expect(bad, "предупреждение не называет главного").toEqual([]);
  });
});
