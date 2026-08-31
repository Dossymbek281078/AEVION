import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Отказ платной стены доходит до человека текстом и ссылкой, а не кодом.
 *
 * QVenture выходит 10.09.2026 за $39/мес. В день, когда включат платную стену,
 * бесплатный посетитель на кнопке разбора получит от planGate ответ 402:
 *
 *   { error: "upgrade_required", message: "Модуль ... доступен на тарифах: ...",
 *     upgradeUrl: "https://.../pricing", requiredTiers: [...] }
 *
 * Замер 31.08.2026: страница брала из этого ответа ТОЛЬКО поле error. То есть
 * человек прочитал бы на экране слово «upgrade_required», а ссылка, по которой
 * он мог бы заплатить, выбрасывалась. Тупик ровно в том месте, где он готов
 * платить, и ноль подсказок.
 *
 * Сервер тут ни при чём — он присылает всё нужное. Ломалось последнее звено:
 * страница не читала. Этот класс («правда доезжает до ответа и не доходит до
 * экрана») встречался за день несколько раз.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const PAGE = path.resolve(HERE, "..", "page.tsx");
const SRC = fs.readFileSync(PAGE, "utf8");
const NL = String.fromCharCode(10);
function noComments(src: string): string {
  return src.split(NL).filter((l) => !l.trim().startsWith("//")).join(NL);
}
const BODY = noComments(SRC);

describe("отказ платной стены понятен и не тупиковый", () => {
  it("контроль: файл прочитан и это он", () => {
    expect(SRC.length, "страница не прочитана").toBeGreaterThan(5000);
    expect(SRC, "читается не та страница").toContain("qventure/analyze");
  });

  it("берётся человеческий текст, а не машинный код", () => {
    expect(
      BODY,
      "страница не читает поле message: человек увидит «upgrade_required» вместо " +
        "готового русского объяснения, которое сервер уже прислал",
    ).toContain("j?.message");
  });

  it("ссылка на оплату не выбрасывается", () => {
    expect(BODY, "ответ не разбирается на upgradeUrl").toContain("upgradeUrl");
    expect(
      BODY,
      "ссылка не доходит до разметки — человек прочитает, что модуль платный, и " +
        "не узнает, куда идти платить",
    ).toMatch(/href=\{upgradeUrl\}/);
  });

  it("на экране покупателя нет вопросов про бэкенд", () => {
    // «is the backend running?» — вопрос к нам, а не к человеку, который платит.
    expect(BODY.toLowerCase(), "жаргон разработчика в тексте для человека").not.toContain("backend running");
  });
});
