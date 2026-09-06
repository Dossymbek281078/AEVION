import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";
import { svyazPoteryana, PODRYAD_DO_TREVOGI } from "../matchmaking/svyaz";

/**
 * Экран поиска соперника при упавшем сервере вёл себя как при работающем:
 * пульсация, счётчик «Прошло: 3:20», позиция в очереди — и ни слова о том,
 * что очередь давно не обновлялась. Отказ опроса глотался комментарием
 * «network blip — keep polling», то есть предполагал, что сбой одиночный.
 */
describe("поиск соперника не молчит, когда сервер не отвечает", () => {
  it("одиночный сбой не поднимает тревогу", () => {
    expect(svyazPoteryana(0)).toBe(false);
    expect(svyazPoteryana(1)).toBe(false);
    expect(svyazPoteryana(PODRYAD_DO_TREVOGI - 1)).toBe(false);
  });

  it("несколько отказов подряд — поднимает", () => {
    expect(svyazPoteryana(PODRYAD_DO_TREVOGI)).toBe(true);
    expect(svyazPoteryana(PODRYAD_DO_TREVOGI + 10)).toBe(true);
  });

  it("порог измеряется секундами, а не вкусом: опрос раз в 2 с, тревога до 30 с", () => {
    // Проверяем ПОРЯДОК величины: возврат к «одному сбою» или к «двум минутам»
    // пройдёт молча, если закреплять только текущее число.
    expect(PODRYAD_DO_TREVOGI * 2).toBeGreaterThanOrEqual(6);
    expect(PODRYAD_DO_TREVOGI * 2).toBeLessThanOrEqual(30);
  });

  const код = bezKommentariev(readFileSync(join(__dirname, "..", "matchmaking", "page.tsx"), "utf8"));

  it("счётчик отказов растёт при сбое и обнуляется при удачном ответе", () => {
    expect(код).toContain("oshibkiPodryadRef.current += 1");
    expect(код).toContain("oshibkiPodryadRef.current = 0");
  });

  it("плохой код ответа считается отказом, а не молчаливым «ничего»", () => {
    expect(код).toContain("if (!r.ok) throw");
  });

  it("человек видит причину на экране ожидания", () => {
    expect(код).toContain("Сервер не отвечает");
    expect(код).toContain("netSvyazi &&");
  });
});
