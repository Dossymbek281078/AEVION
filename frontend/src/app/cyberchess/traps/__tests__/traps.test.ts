// Страница ловушек: ходы легальны, маты настоящие, тексты без смеси языков,
// адреса /en и /kk не уводит middleware, кнопка тренера несёт ?c=seo-traps.
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { LOVUSHKI } from "../traps";
import { trapsMetadata, TRAPS_PATHS } from "../meta";
import { playHref } from "../TrapsView";
import { hasOwnEnglishPage } from "@/lib/englishPages";
import { языковойРедирект } from "@/middleware";

const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const KK_ONLY = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;

describe("ловушки CyberChess", () => {
  it("их 10, id уникальны", () => {
    expect(LOVUSHKI).toHaveLength(10);
    expect(new Set(LOVUSHKI.map((t) => t.id)).size).toBe(10);
  });

  for (const t of LOVUSHKI) {
    it(`${t.id}: все ходы легальны, мат совпадает с заявленным`, () => {
      const c = new Chess();
      for (const s of t.moves) expect(() => c.move(s), `${t.id}: ${s}`).not.toThrow();
      expect(c.isCheckmate()).toBe(t.mat);
      expect(t.oshibka).toBeGreaterThanOrEqual(0);
      expect(t.oshibka).toBeLessThan(t.moves.length);
    });
    it(`${t.id}: en без кириллицы, ru без казахских букв, kk с текстом`, () => {
      expect(t.name.en + t.about.en).not.toMatch(CYR);
      expect(t.name.ru + t.about.ru).not.toMatch(KK_ONLY);
      expect(t.about.kk.length).toBeGreaterThan(40);
      expect(t.about.kk).not.toBe(t.about.ru);
    });
  }

  // Проверка Мультичата 31.10 (Stockfish 18, глубина 18): «??» стоит на настоящем зевке, тексты без ложных советов.
  it("пометка «??» — на настоящем зевке (Ласкер 6.Bxb4, сибирская 9.h3)", () => {
    const по = (id: string) => LOVUSHKI.find((t) => t.id === id)!;
    expect(по("lasker").moves[по("lasker").oshibka]).toBe("Bxb4");
    expect(по("siberian").moves[по("siberian").oshibka]).toBe("h3");
    for (const l of ["ru", "en", "kk"] as const) {
      expect(по("siberian").about[l], "после 10.Qd1 тоже мат — советовать нельзя").not.toContain("10.Qd1");
      expect(по("lasker").about[l]).not.toContain("4.e3??");
    }
    expect(по("elephant").about.ru).toContain("конь f6");
    expect(по("elephant").about.ru).not.toContain("конь d5");
  });

  it("контроль прибора: кириллица в en ловится", () => {
    expect("Légal мат").toMatch(CYR);
  });

  it("мета: canonical на себя, hreflang ru/en/kk, en без кириллицы", () => {
    for (const l of ["ru", "en", "kk"] as const) {
      const m = trapsMetadata(l);
      expect(String(m.alternates?.canonical)).toBe("https://aevion.app" + TRAPS_PATHS[l]);
      expect(Object.keys(m.alternates?.languages ?? {}).sort()).toEqual(["en", "kk", "ru", "x-default"]);
    }
    const en = trapsMetadata("en");
    expect(String(en.title) + en.description).not.toMatch(CYR);
  });

  it("кнопка тренера: свой языковой адрес и ?c=seo-traps", () => {
    expect(playHref("ru")).toBe("/cyberchess?c=seo-traps");
    expect(playHref("en")).toBe("/en/cyberchess?c=seo-traps");
    expect(playHref("kk")).toBe("/kk/cyberchess?c=seo-traps");
  });

  it("middleware не уводит /en и /kk страницы ловушек", () => {
    expect(hasOwnEnglishPage("/en/cyberchess/traps")).toBe(true);
    expect(языковойРедирект("/kk/cyberchess/traps")).toBeNull();
    // контроль: соседний экран без своей kk-страницы по-прежнему уводится
    expect(языковойРедирект("/kk/cyberchess/daily")).not.toBeNull();
  });
});
