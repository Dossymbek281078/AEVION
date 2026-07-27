import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Награда за решённый пазл выдаётся из ДВУХ мест: путь с анимацией хода и путь без неё.
   Куски кода почти дословно одинаковы — платёж за первое решение, бонус за скорость,
   дневная цель, «Твоя ошибка», пазл дня. Пока они совпадают, всё честно; стоит поправить
   один и забыть второй — половина игроков получит другое поведение, и никакой ошибки при
   этом не будет. Ровно так сегодня разъехались три точки загрузки пазлов.

   Тест сравнивает блоки, приведя пробелы и убрав комментарии. Если правишь один — правь
   второй, либо своди их в одну функцию (тогда этот тест можно удалить вместе с дублем). */

const PAGE = readFileSync("src/app/cyberchess/page.tsx", "utf8");

const BLOCK =
  /const firstTime=claimReward\(pzSolvedRef\.current,pzCurrent\.fen\);[\s\S]*?setTimeout\(\(\)=>addChessy\(50,"☀ пазл дня"\),800\);\s*\n\s*\}/g;

const normalise = (s: string) =>
  s
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();

describe("puzzle reward parity", () => {
  const blocks = PAGE.match(BLOCK) ?? [];

  it("still finds both reward blocks", () => {
    // если блоков не два — их переименовали, свели в один или добавили третий:
    // в любом случае этот тест надо перечитать, а не подгонять
    expect(blocks).toHaveLength(2);
  });

  it("pays the same on both solve paths", () => {
    expect(normalise(blocks[1] ?? "")).toBe(normalise(blocks[0] ?? ""));
  });
});
