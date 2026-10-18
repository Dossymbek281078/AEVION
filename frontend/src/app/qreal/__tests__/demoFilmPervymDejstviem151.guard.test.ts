import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 151 (18.10.2026). Замер на проде 638a7b5 (390×844, кадр 844): у /qreal единственное бесплатное действие гостя —
 * «Смотреть демо-фильм» — стояло на ~1519 px после двух видео сравнения движков; в первом экране действий не было.
 * Кнопка перенесена в шапку сразу под лид-абзац (та же watchDemoFilm, фильм из прод-кэша); в секции сравнения её больше
 * нет — одна кнопка, не две. Пиксели после выкатки меряет браузер на проде.
 */
const src = readFileSync(join(__dirname, "..", "_client.tsx"), "utf8");

describe("151: демо-фильм — первое действие гостя на /qreal", () => {
  test("🔴 кнопка демо-фильма стоит в шапке между лидом и оговоркой, и она одна", () => {
    const лид = src.indexOf('{t("qreal.hero.lead")}');
    const кнопка = src.indexOf("onClick={watchDemoFilm}");
    const оговорка = src.indexOf('{t("qreal.hero.ethics")}');
    const сравнение = src.indexOf('{t("qreal.compare.h")}');
    expect(лид).toBeGreaterThan(0);
    expect(кнопка).toBeGreaterThan(лид);
    expect(оговорка).toBeGreaterThan(кнопка);
    expect(сравнение).toBeGreaterThan(кнопка);
    expect(src.split("onClick={watchDemoFilm}").length - 1).toBe(1);
    expect(src.split('t("qreal.film.watch")').length - 1).toBe(1);
  });
});
