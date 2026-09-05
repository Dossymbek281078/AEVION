import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Страница зрителя показывала состояние трансляции тремя английскими
 * словами — LIVE / FINISHED / OFFLINE — на полностью русском экране.
 *
 * И одно из них было недостижимо. Ветка выглядела так:
 *
 *   !finished && connected ? LIVE : finished ? FINISHED
 *                                            : (connected ? "CONNECTING…" : "OFFLINE")
 *
 * В третью ветку попадают только когда connected === false, значит
 * «CONNECTING…» не показывалось НИКОГДА, а зритель в первые секунды живой
 * трансляции читал «OFFLINE» — то есть неправду о том, что происходит.
 */

const КОД = () => bezKommentariev(
  readFileSync(join(__dirname, "..", "spectator", "[gameId]", "page.tsx"), "utf8"));

describe("состояния трансляции", () => {
  it("подписи по-русски", () => {
    const код = КОД();
    for (const слово of ["LIVE", "FINISHED", "OFFLINE", "CONNECTING"]) {
      expect(код, `«${слово}» видно зрителю`).not.toContain(слово);
    }
    for (const слово of ["В ЭФИРЕ", "ЗАВЕРШЕНА", "НЕТ СВЯЗИ", "ПОДКЛЮЧАЕМСЯ"]) {
      expect(код).toContain(слово);
    }
  });

  it("«подключаемся» и «нет связи» различаются НЕ по connected", () => {
    const код = КОД();
    // иначе ветка снова станет недостижимой: в неё попадают при connected=false
    expect(код).toContain("byloSoedinenie");
    const i = код.indexOf("ПОДКЛЮЧАЕМСЯ");
    expect(i).toBeGreaterThan(0);
    const строка = код.slice(Math.max(0, i - 120), i + 20);
    expect(строка).toContain("byloSoedinenie");
    expect(строка).not.toContain("connected ?");
  });

  it("признак взводится там же, где соединение", () => {
    const код = КОД();
    const i = код.indexOf("setConnected(true)");
    expect(i).toBeGreaterThan(0);
    expect(код.slice(i, i + 120)).toContain("setByloSoedinenie(true)");
  });
});
