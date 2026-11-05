import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { bezKommentariev } from "./bezKommentariev";
import { ruOf } from "./_ruSlovar";

/**
 * Обход экрана «Анализ» глазами 01.09.2026. Английское там, где человек читает:
 *
 *   «ready» / «loading»                        — состояние движка
 *   «⚡ Analyzing depth 18 with 3 lines...»     — строка расчёта целиком
 *   «🔊 Whisper»                                — имя нашего модуля на кнопке
 *
 * Последнее особенно тихое: подсказка кнопки УЖЕ была по-русски («Голосовой
 * анализ позиции»), а подпись осталась внутренним именем. Рядом стоит
 * «🎤 Голос» — это ВВОД хода голосом, поэтому вывод назван «Вслух», чтобы две
 * кнопки не путались.
 */

const EKRAN = () => bezKommentariev(readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8"));

describe("экран анализа говорит по-русски", () => {
  it("контроль: текст экрана прочитан", () => {
    const s = EKRAN();
    expect(s.length).toBeGreaterThan(100000);
    expect(s).toContain("Начать партию");
  });

  it("состояние движка — по-русски", () => {
    const s = EKRAN();
    expect(s).not.toContain('sfOk?"ready":"loading"');
    expect(s).toContain('sfOk?cc.t("cpn.engine.ready"):cc.t("cpn.engine.loading")');
  });

  it("строка расчёта — по-русски", () => {
    const s = EKRAN();
    expect(s).not.toContain("Analyzing depth");
    expect(s).toContain("Считаю на глубине");
  });

  it("кнопка озвучки названа по-русски, но осталась кнопкой озвучки", () => {
    const s = EKRAN();
    expect(s).not.toContain("🔊 Whisper");
    // 13–19.10.2026: подпись — ключ pz.aloud, стоит внутри той же кнопки, что зовёт whisperAndSpeak
    const k = s.indexOf("whisperAndSpeak(game.fen()");
    expect(k).toBeGreaterThan(0);
    expect(s.slice(k, k + 700)).toContain('{cc.t("pz.aloud")}');
    expect(ruOf("pz.aloud")).toBe("🔊 Вслух");
    // Подпись поменяли, а действие — нет: кнопка по-прежнему озвучивает позицию.
    expect(s).toContain("whisperAndSpeak(game.fen()");
    expect(s).toContain('title={cc.t("attr.voice_analysis_of_the_position")}');
    expect(ruOf("attr.voice_analysis_of_the_position")).toBe("Голосовой анализ позиции");
  });

  it("ввод голосом и озвучка названы РАЗНО", () => {
    // Иначе человек не отличит «сказать ход» от «послушать разбор».
    const s = EKRAN();
    expect(s).toContain('cc.t("btn.voice")'); // ввод голосом
    expect(s).toContain('{cc.t("pz.aloud")}'); // озвучка
    expect(ruOf("btn.voice")).toBe("🎤 Голос");
    expect(ruOf("pz.aloud")).toBe("🔊 Вслух");
    expect(ruOf("btn.voice")).not.toBe(ruOf("pz.aloud"));
  });
});
