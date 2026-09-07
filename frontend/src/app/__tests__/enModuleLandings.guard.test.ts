import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./helpers/sourceCode";

/**
 * en-посетитель модульных страниц получает английские посадочные.
 *
 * ЗАЧЕМ. EN-свип 06.09.2026: /smeta-trainer 84 % и /qrenew 61 % кириллицы
 * под cookie en. Починка — редирект на честные EN-посадочные (4-й и 5-й
 * случаи приёма; мутации у сторожей /longevity и /go пойманы).
 *
 * Сторож общий на обе пары и добавляемый: новая пара «RU-страница →
 * EN-посадочная» — одна строка в PAIRS.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

const PAIRS: Array<{ ru: string; en: string; target: string; beforeMark: string }> = [
  {
    ru: "smeta-trainer/page.tsx",
    en: "en/smeta-trainer/page.tsx",
    target: "/en/smeta-trainer",
    // редирект обязан стоять ДО платной стены
    beforeMark: "fetchOrPaywall(",
  },
  {
    ru: "qrenew/page.tsx",
    en: "en/qrenew/page.tsx",
    target: "/en/qrenew",
    beforeMark: "fetchOrPaywall(",
  },
];

describe("языковая маршрутизация модульных страниц", () => {
  for (const p of PAIRS) {
    const ruSrc = stripComments(readFileSync(join(APP, p.ru), "utf8"));
    const тело = ruSrc.slice(ruSrc.indexOf("export default"));

    it(`${p.ru}: читает cookie и уводит на ${p.target} до платной стены`, () => {
      expect(тело).toContain('aevion_lang_v1');
      expect(тело).toContain(`"${p.target}"`);
      const iRedirect = тело.indexOf("redirect(");
      const iMark = тело.indexOf(p.beforeMark);
      expect(iRedirect).toBeGreaterThan(-1);
      expect(iMark).toBeGreaterThan(-1);
      expect(iRedirect, "redirect должен идти раньше платной стены").toBeLessThan(iMark);
    });

    it(`${p.en}: посадочная действительно английская`, () => {
      const enSrc = stripComments(readFileSync(join(APP, p.en), "utf8"));
      // Кириллица допустима только в НАЗВАНИЯХ предмета (НДЦС, ЭСН) — они
      // имена собственные норм. Всё прочее — ловим.
      const кир = enSrc.replace(/НДЦС РК|ЭСН/g, "").match(/[А-Яа-яЁё]{3,}/g);
      expect(кир, `русские слова в EN-посадочной: ${кир?.slice(0, 4).join(", ")}`).toBeNull();
    });
  }
});
