/**
 * Глобус: кнопки управления и метки узлов не вылезают за карточку.
 *
 * ПОВОД (20.10.2026, прод a55fb55c7, globus-vidimost.mjs): столбец из 11 кнопок (≈500 px)
 * выше карточки 400/520 px вылезал за её верх на текст страницы в 5 окнах из 5; метки
 * «QRIGHT/QSIGN/AIPB» висели над карточкой в 3 окнах из 5. С правкой на локальной сборке:
 * столбец внутри 5/5, меток вне холста 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { меткаВнутриХолста } from "../Globus3D";

describe("Globus3D: управление и метки внутри карточки", () => {
  it("метка внутри холста видна; выше края (точка внутри, подпись снаружи) — нет", () => {
    expect(меткаВнутриХолста(200, 200, 50, 21, 418, 398)).toBe(true);
    expect(меткаВнутриХолста(48, 20, 41, 21, 418, 398), "замер 768×1024: AIPB на 16 px выше холста").toBe(false);
    expect(меткаВнутриХолста(10, 200, 41, 21, 418, 398), "левый край").toBe(false);
    expect(меткаВнутриХолста(410, 200, 41, 21, 418, 398), "правый край").toBe(false);
    expect(меткаВнутриХолста(200, 400, 41, 21, 418, 398), "ниже холста").toBe(false);
  });

  it("столбец кнопок не выше карточки: переносится во вторую колонку", () => {
    const src = readFileSync(join(__dirname, "..", "Globus3D.tsx"), "utf8");
    const i = src.indexOf('title="Zoom in"');
    const блок = src.slice(src.lastIndexOf("<div", i - 200), i);
    expect(блок).toContain("maxHeight: globeHeight - 28");
    expect(блок).toContain('flexWrap: "wrap-reverse"');
    expect(src).toContain("if (!меткаВнутриХолста(sx, sy,");
  });
});
