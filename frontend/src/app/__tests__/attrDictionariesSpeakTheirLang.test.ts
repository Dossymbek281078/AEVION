import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revenueTip } from "../../lib/revenueTip";

/**
 * Мини-словари атрибутов говорят СВОИМ языком (класс «атрибут против
 * доводчика», 06.09.2026): en-ветка без кириллицы, kk-ветка с казахскими
 * буквами, у всех языков одинаковый набор ключей. Без этого подмена
 * en-строки русской прошла бы молча — доводчик атрибуты не переводит,
 * и EN-визитёр снова получил бы русский placeholder в главном поле.
 */

const APP = join(__dirname, "..");

function словарьИзФайла(rel: string, имя: string): Record<string, Record<string, string>> {
  const src = readFileSync(join(APP, rel), "utf8");
  const start = src.indexOf(`const ${имя}`);
  expect(start, `${имя} не найден в ${rel} — переименовали?`).toBeGreaterThan(-1);
  const блок = src.slice(start, src.indexOf("};", start));
  const out: Record<string, Record<string, string>> = {};
  let текущий = "";
  for (const m of блок.matchAll(/^\s{2}(ru|en|kk):|(\w+):\s*"((?:[^"\\]|\\.)*)"/gm)) {
    if (m[1]) { текущий = m[1]; out[текущий] = {}; continue; }
    if (текущий && m[2]) out[текущий][m[2]] = m[3];
  }
  return out;
}

const СЛОВАРИ: Array<[string, string]> = [
  ["startup-exchange/page.tsx", "SX_UI"],
  ["multichat-engine/CouncilConsole.tsx", "MC_UI"],
];

describe("словари атрибутов говорят своим языком", () => {
  test.each(СЛОВАРИ)("%s: en без кириллицы, kk с казахскими, ключи совпадают", (rel, имя) => {
    const d = словарьИзФайла(rel, имя);
    expect(Object.keys(d).sort()).toEqual(["en", "kk", "ru"]);
    const ключи = Object.keys(d.ru).sort();
    expect(ключи.length, "ru-ветка пуста — разбор сломан").toBeGreaterThan(0);
    expect(Object.keys(d.en).sort(), "набор ключей en разошёлся с ru").toEqual(ключи);
    expect(Object.keys(d.kk).sort(), "набор ключей kk разошёлся с ru").toEqual(ключи);
    for (const [k, v] of Object.entries(d.en)) {
      expect(/[А-Яа-яЁё]/.test(v), `en.${k} содержит кириллицу: «${v}»`).toBe(false);
    }
    // kk отличим от ru специфическими буквами хотя бы в одной строке —
    // иначе «казахский» словарь мог бы быть скопированным русским.
    expect(
      Object.values(d.kk).some((v) => /[әғқңөұүһі]/i.test(v)),
      "в kk-ветке нет ни одной казахской буквы",
    ).toBe(true);
  });

  test("revenueTip: три языка, en/kk без кириллицы, сумма в каждой", () => {
    const ru = revenueTip("ru", 1234, 5);
    const en = revenueTip("en", 1234, 5);
    const kk = revenueTip("kk", 1234, 5);
    expect(ru).toContain("собрано");
    expect(/[А-Яа-яЁё]/.test(en), `en: «${en}»`).toBe(false);
    expect(/[әғқңөұүһі]/i.test(kk), `kk без казахских букв: «${kk}»`).toBe(true);
    // Разделитель тысяч зависит от локали (у ru — УЗКИЙ неразрывный пробел
    // U+202F, который не входит в наивный класс символов): любой одиночный
    // не-цифровой разделитель либо его отсутствие.
    for (const s of [ru, en, kk]) expect(s).toMatch(/1\D?234/);
    // Незнакомый язык падает в английский, а не в русский: доводчик
    // непереведённый en доведёт, русский в атрибуте — нет.
    expect(/[А-Яа-яЁё]/.test(revenueTip("de", 10, 1))).toBe(false);
  });
});
