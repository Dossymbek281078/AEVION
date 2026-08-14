import { describe, test, expect } from "vitest";

import { translations } from "@/lib/i18n-data";

/**
 * Ключи модуля живут ровно в трёх локалях — en, ru, kk (остальные восемь в
 * файле переводов заглушки на два десятка строк). Потерять одну из трёх легко:
 * ключи добавляются вручную в три разных места одного большого файла, и язык,
 * до которого не дошли, молча показывает английский или пустоту.
 *
 * Вторая половина проверки важнее первой: подстановки внутри ключа должны
 * совпадать между языками. Ключ, где в русском есть {routable}, а в казахском
 * его забыли, не падает и не подсвечивается — он просто теряет ЧИСЛО, то есть
 * ровно то, ради чего строка написана. Именно так «задето маршрутов 23 из 42»
 * превращается в «задето маршрутов».
 */
const LOCALES = ["en", "ru", "kk"] as const;

const KEYS = [
  "qskyway.pad.prohibited",
  "qskyway.pad.cityProhibited",
  "qskyway.subst.head",
  "qskyway.subst.underRoutes",
  "qskyway.subst.noRoutes",
  "qskyway.verify.ephemeralKey",
  "qskyway.verify.checking",
  "qskyway.verify.ok",
  "qskyway.verify.failed",
  "qskyway.verify.unknown",
  "qskyway.just.unknown",
  "qskyway.slots.receipt",
  "qskyway.slots.capacity",
  "qskyway.reg.subject.prohibition",
  "qskyway.reg.subject.permission",
  "qskyway.impact.head",
  "qskyway.impact.body",
];

const placeholders = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();

describe("ключи перевода qskyway", () => {
  for (const key of KEYS) {
    test(`${key} — есть во всех трёх языках и с теми же подстановками`, () => {
      const values = LOCALES.map((l) => {
        const dict = (translations as Record<string, Record<string, string>>)[l];
        return dict?.[key];
      });
      for (const [i, v] of values.entries()) {
        expect(v, `${key} отсутствует в локали ${LOCALES[i]}`).toBeTruthy();
      }
      const sets = values.map((v) => placeholders(v as string));
      for (const [i, set] of sets.entries()) {
        expect(set, `${key}: подстановки в ${LOCALES[i]} разошлись с ${LOCALES[0]}`).toEqual(sets[0]);
      }
    });
  }
});
