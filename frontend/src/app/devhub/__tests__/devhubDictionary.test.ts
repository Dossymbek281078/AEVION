import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tDevhub, DEVHUB_KEYS, DEVHUB_DICT } from "../i18n";

const PAGE = path.join(__dirname, "..", "page.tsx");

describe("словарь витрины DevHub", () => {
  test("каждый ключ есть во всех трёх языках", () => {
    for (const lang of ["en", "ru", "kk"]) {
      const missing = DEVHUB_KEYS.filter((k) => !DEVHUB_DICT[lang]?.[k]);
      expect(missing, `в языке ${lang} не хватает ключей`).toEqual([]);
    }
  });

  test("страница не зовёт ключей, которых нет в словаре", () => {
    // Самая полезная проверка: опечатка в ключе иначе выводит на экран сам
    // ключ («snip.titel»), и это заметит только человек.
    const src = fs.readFileSync(PAGE, "utf8");
    const used = [...src.matchAll(/\bt\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(used.length, "проводка исчезла — проверка стала бы бессмысленной").toBeGreaterThan(20);
    const unknown = [...new Set(used)].filter((k) => !(DEVHUB_KEYS as string[]).includes(k));
    expect(unknown, "страница зовёт ключ, которого нет в словаре").toEqual([]);
  });

  test("ни один перевод не совпадает с самим ключом", () => {
    for (const lang of ["en", "ru", "kk"]) {
      const looksLikeKey = DEVHUB_KEYS.filter((k) => tDevhub(lang, k) === k);
      expect(looksLikeKey, `в ${lang} перевод равен ключу — на экран уйдёт «snip.title»`).toEqual([]);
    }
  });

  test("русский и казахский переведены, а не скопированы с английского", () => {
    for (const lang of ["ru", "kk"]) {
      const same = DEVHUB_KEYS.filter((k) => tDevhub(lang, k) === tDevhub("en", k));
      // Разрешаем ноль совпадений: все строки этой витрины содержат слова.
      expect(same, `в ${lang} строки остались английскими`).toEqual([]);
    }
  });

  test("остальные восемь языков сайта получают английский, а не пустоту", () => {
    for (const lang of ["de", "fr", "es", "zh", "ja", "ar", "pt", "tr"]) {
      expect(tDevhub(lang, "snip.title"), `язык ${lang} остался без текста`).toBe(tDevhub("en", "snip.title"));
    }
  });

  test("русский отличается от казахского — иначе один из них подделка", () => {
    const same = DEVHUB_KEYS.filter((k) => tDevhub("ru", k) === tDevhub("kk", k));
    expect(same).toEqual([]);
  });
});

describe("полоска возможностей не обещает больше, чем знает", () => {
  const PAGE_SRC = fs.readFileSync(PAGE, "utf8");

  test("не говорит «работает» о том, что означает «ключ задан»", () => {
    // Контроль: полоска на месте — иначе проверка прошла бы на пустом файле.
    expect(PAGE_SRC).toContain("caps.configured");
    // Проверка НАМЕРЕННО по конкретным прежним строкам, а не по слову «работает»:
    // слово встречается в комментарии, который объясняет саму починку, и широкий
    // шаблон краснел бы на объяснении.
    expect(PAGE_SRC, "вернулось «Сейчас работает: N из M» — ручка отвечает про наличие ключа, а не про работу")
      .not.toContain("Сейчас работает: {live}");
    expect(PAGE_SRC, "вернулось утверждение «всё остальное работает»")
      .not.toContain("— работает. Наведите на название");
  });

  test("подписи полоски идут через словарь, а не вшиты", () => {
    for (const k of ["caps.configured", "caps.off", "caps.note"]) {
      expect((DEVHUB_KEYS as string[]), `ключ ${k} потерялся`).toContain(k);
      expect(PAGE_SRC, `ключ ${k} не используется страницей`).toContain('t("' + k + '")');
    }
  });
});
