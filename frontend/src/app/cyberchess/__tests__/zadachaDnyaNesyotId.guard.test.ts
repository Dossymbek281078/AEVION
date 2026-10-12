import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePuzzle } from "../puzzleNormalize";

/*
 * 🔴 У задачи дня есть id — как у любой задачи из банка.
 *
 * Повод 13.10.2026 (приёмка bd на проде 21b5e836da6e): по ссылке ?puzzle=
 * `data-cc-puzzle="li_075iw"`, а через «Задачу дня» атрибут оставался пустым —
 * объект задачи собирался из ответа сервера без поля id, хотя сервер его отдаёт
 * (тип SrvDaily). Последствия шире атрибута: событие «первый ход сделан»
 * ключуется по id и для всех задач дня получало один ключ «pz:».
 *
 * Два утверждения: (1) сборка задачи дня передаёт id сервера; (2) нормализация
 * id не теряет. Первое — по исходнику (страница 16 тысяч строк, в jsdom не
 * поднимается), второе — настоящим вызовом.
 */
const ПС = String.fromCharCode(10);
const ВК = String.fromCharCode(13);
const текст = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

function teloFunkcii(исходник: string, объявление: string): string {
  const i = исходник.indexOf(объявление);
  if (i < 0) return "";
  const строки = исходник.slice(i).split(ПС).map((л) => (л.endsWith(ВК) ? л.slice(0, -1) : л));
  const отступ = (объявление.match(/^\s*/) ?? [""])[0];
  const куски: string[] = [строки[0]];
  for (let k = 1; k < строки.length; k++) {
    куски.push(строки[k]);
    if (строки[k] === `${отступ}};` || строки[k] === `${отступ}}`) break;
  }
  return куски.join(ПС);
}

describe("задача дня несёт id сервера", () => {
  const тело = teloFunkcii(текст, "  const loadDailyPuzzle");

  it("КОНТРОЛЬ: тело loadDailyPuzzle найдено и ограничено", () => {
    expect(тело.length).toBeGreaterThan(200);
    expect(тело.length).toBeLessThan(6000);
    expect(тело).toContain("postavitZadachuNaDosku(");
  });

  it("🔴 объект задачи дня собирается С id из ответа сервера", () => {
    const сборки = тело.split("normalizePuzzle(").length - 1;
    expect(сборки, "ровно одна сборка объекта задачи дня").toBe(1);
    expect(тело).toContain("normalizePuzzle({id:srvDaily.id,");
  });

  it("нормализация id не теряет (и для сырой lichess-формы, где ход соперника применяется)", () => {
    const сырая = { id: "daily-13-10", fen: "5r1k/p5pp/2p1Q3/1pq1p3/4P3/8/B4PPP/5RK1 w - - 0 32", sol: ["f1d1", "c5f2"], r: 1186 };
    const н = normalizePuzzle(сырая as unknown as Parameters<typeof normalizePuzzle>[0]) as unknown as { id?: string; fen: string };
    expect(н.id).toBe("daily-13-10");
    // контроль: нормализация действительно что-то сделала (ход соперника применён, fen сменился)
    expect(н.fen).not.toBe(сырая.fen);
  });
});
