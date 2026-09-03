import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Когда провайдер ИИ не настроен, QCoreAI не бросает — он отвечает 200 и
 * текстом «[QCoreAI — no AI provider configured] Your question: "…"», куда
 * подставлен ВЕСЬ внутренний промпт.
 *
 * Голосовой тренер шахмат отдавал эту строку человеку как ответ: английская
 * служебная метка и наша же инженерия промпта на экране, с кодом 200 —
 * то есть отказ выглядел как успех.
 *
 * Замер 02.09.2026, локальный бэкенд без ключа:
 *   POST /api/cyberchess-voice-coach/ask -> 200
 *   {"text":"[QCoreAI — no AI provider configured]\n\nYour question: \\"Контекст партии:…
 */


/** Вырезает комментарии: блочные целиком, строчные — с начала строки и с хвоста. */
function bezKommentariev(kod: string): string {
  const OTKR = "/" + "*";
  const ZAKR = "*" + "/";
  const bez = kod.split(OTKR).map((k, i) => (i === 0 ? k : k.slice(k.indexOf(ZAKR) + 2))).join(" ");
  return bez
    .split(String.fromCharCode(10))
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 && (i === 0 || l[i - 1] !== ":") ? l.slice(0, i) : l;
    })
    .filter((l) => l.trim().length > 0)
    .join(String.fromCharCode(10));
}

const КОД = () => readFileSync(
  join(__dirname, "..", "src", "routes", "cyberchessVoiceCoach.ts"), "utf8");

describe("тренер и ненастроенный провайдер", () => {
  it("отказ провайдера отвечает 503, а не 200 с эхом промпта", () => {
    // Ищем в КОДЕ, а не в тексте файла: первое вхождение метки — в моём же
    // объяснении наверху, и окно после него не содержит ответа. Прибор,
    // спотыкающийся о собственный комментарий, я уже ловил дважды.
    // Вхождений метки в коде БОЛЬШЕ ОДНОГО: свой путь у /ask и свой у
    // /comment. Проверка «первое вхождение» сломалась ровно тогда, когда
    // появился второй — искать надо ЛЮБОЕ, где рядом стоит отказ.
    const к = bezKommentariev(КОД());
    const места: number[] = [];
    for (let i = 0; (i = к.toLowerCase().indexOf("no ai provider configured", i + 1)) > 0; ) места.push(i);
    expect(места.length, "проверки на ненастроенного провайдера нет в коде").toBeGreaterThan(0);
    const естьОтказ = места.some((i) => {
      const кусок = к.slice(i, i + 400);
      return кусок.includes("503") && кусок.includes("llm_not_configured");
    });
    expect(естьОтказ, "ни одно место не отвечает 503 llm_not_configured").toBe(true);
  });

  it("человеку отвечают по-русски и без служебных слов", () => {
    const к = КОД();
    const i = к.indexOf("llm_not_configured");
    expect(i).toBeGreaterThan(0);
    const кусок = к.slice(i, i + 300);
    expect(кусок).toMatch(/[А-Яа-яЁё]{6}/);              // текст на русском
    expect(кусок).not.toMatch(/QCoreAI|provider|prompt/); // без внутренних слов
  });

  it("живой комментарий тоже не произносит служебный отказ", () => {
    // У /comment есть хороший запасной путь — правиловый комментарий, поэтому
    // здесь правильный ответ не 503, а откат в него: человек слышит разбор,
    // просто не от модели. Замер 02.09.2026: без проверки в комментарий
    // уходило «[QCoreAI — no AI provider configured] Your question: …».
    const к = bezKommentariev(КОД());
    const i = к.indexOf("otkazProvaydera");
    expect(i, "проверки на пути живого комментария нет").toBeGreaterThan(0);
    const кусок = к.slice(i, i + 300);
    expect(кусок).toMatch(/no ai provider configured/i);
    expect(кусок).toContain("!otkazProvaydera");
  });

  it("проверка ловит обе формы метки — с большой и с маленькой буквы", () => {
    // QCoreAI пишет «no AI provider configured», psyappDeps ловит
    // «No AI provider configured». Регистронезависимость здесь не роскошь.
    const шаблон = /no ai provider configured/i;
    expect(шаблон.test("[QCoreAI — no AI provider configured]")).toBe(true);
    expect(шаблон.test("Error: No AI provider configured")).toBe(true);
    expect(шаблон.test("обычный ответ тренера про центр и развитие")).toBe(false);
  });
});
