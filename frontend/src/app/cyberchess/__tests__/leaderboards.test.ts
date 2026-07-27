import { describe, it, expect } from "vitest";
import { getLeaderboard, findMyRank, getTopWithMe, getFullBoardAroundMe } from "../leaderboards";

/* Игрок ЗАТИРАЛ строку на своей позиции вместо вставки: соперник с этого места исчезал,
   а те, кто ниже, сохраняли прежние номера — в таблице оказывалось два одинаковых ранга.
   Видно на глаз в самой таблице, но не падало ничего. */

const CAT = "blitz" as const;

describe("leaderboards", () => {
  const lb = getLeaderboard(CAT);

  it("is sorted from strongest down", () => {
    for (let i = 1; i < lb.length; i++) expect(lb[i].rating).toBeLessThanOrEqual(lb[i - 1].rating);
  });

  it("does not drop anyone when the player enters the top", () => {
    const strong = lb[0].rating + 100; // заведомо первое место
    const top = getTopWithMe(CAT, strong, "Я", 3);
    expect(top).toHaveLength(3);
    expect(top[0].isMe).toBe(true);
    // прежние первый и второй сдвинулись вниз, а не исчезли
    expect(top[1].name).toBe(lb[0].name);
    expect(top[2].name).toBe(lb[1].name);
  });

  it("numbers every row once", () => {
    const board = getFullBoardAroundMe(CAT, lb[Math.floor(lb.length / 2)].rating + 1, "Я");
    const ranks = board.map((e) => e.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("keeps the whole field when the player joins it", () => {
    const mid = lb[Math.floor(lb.length / 2)].rating + 1;
    expect(getFullBoardAroundMe(CAT, mid, "Я")).toHaveLength(lb.length + 1);
  });

  it("puts a weak player last instead of inside the board", () => {
    const weak = lb[lb.length - 1].rating - 100;
    const board = getFullBoardAroundMe(CAT, weak, "Я");
    expect(board[board.length - 1].isMe).toBe(true);
    expect(findMyRank(CAT, weak)).toBe(lb.length + 1);
  });
});
