/**
 * «Цели на сегодня» обязаны считать сегодня.
 *
 * 🔴 ЗАМЕР РУКАМИ НА ПРОДЕ 29.09.2026. В коде стояло
 * `gamesToday = totalGames` (партии ЗА ВСЁ ВРЕМЯ) и
 * `puzzlesToday = pzSolvedCount` (счётчик ТЕКУЩЕЙ СЕССИИ, обнуляется
 * перезагрузкой и режимами на время).
 *
 * Следствия разные, и оба бьют ровно по возврату на второй день:
 * сыгравший вчера пять партий видит «Сыграй 5» выполненной без единого хода,
 * а решивший три задачи теряет их при обновлении страницы. Механизм, который
 * должен звать человека обратно, молчит именно для того, кого зовёт.
 *
 * Завтра, в день запуска, это бы не выстрелило: у всех «за всё время» равно
 * «за сегодня». Выстрелило бы послезавтра и сразу у всех.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

const КОД = bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));

describe("подсчёт целей дня", () => {
  it("партии за день считаются от базы на начало дня", () => {
    // Проверяем ИМЕННО строку показа, а не выражение вообще: то же выражение
    // стоит и в начислении бонуса, и первая версия этой проверки проходила
    // при вернувшемся `gamesToday=totalGames` — то есть охраняла пустоту.
    expect(КОД).toContain("const gamesToday=Math.max(0,totalGames-(dailyGoals.gamesBase??totalGames))");
    expect(КОД).not.toContain("const gamesToday=totalGames;");
  });

  it("задачи за день берутся из счётчика дня, а не из сессии", () => {
    expect(КОД).toContain("puzzlesToday=dailyGoals.puzzlesDone");
    expect(КОД).not.toContain("puzzlesToday=pzSolvedCount");
  });

  it("🔴 база снимается ПОСЛЕ загрузки статистики, а не в инициализаторе", () => {
    // В инициализаторе состояния статистика ещё {0,0,0}: база вышла бы
    // нулевой, и «за сегодня» снова означало бы «за всё время».
    expect(КОД).toContain("загруженнаяСтатистика");
    expect(КОД).toContain("g.gamesBase==null?{...g,gamesBase:");
  });

  it("счётчик задач растёт там же, где сессионный", () => {
    expect(КОД).toContain("puzzlesDone:(g.puzzlesDone??0)+1");
  });

  it("🔴 бонус считается ПО ТЕМ ЖЕ числам, что показаны человеку", () => {
    // Иначе у вернувшегося он срабатывал прямо при заходе: на экране 0/5,
    // а «+30 Chessy — все цели выполнены».
    const i = КОД.indexOf("dailyGoalsBonusFiredRef");
    const блок = КОД.slice(i, i + 700);
    expect(блок).toContain("dailyGoals.gamesBase");
    expect(блок).toContain("dailyGoals.puzzlesDone");
    expect(блок).not.toContain("pzSolvedCount>=dailyGoals.puzzleGoal");
  });

  it("контроль: цель «открой тренера» не тронута", () => {
    // Она работала верно — проверил руками, признак становится true.
    expect(КОД).toContain("coachOpened:true");
  });
});
