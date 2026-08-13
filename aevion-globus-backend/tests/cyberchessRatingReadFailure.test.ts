import { describe, test, expect, beforeEach, vi } from "vitest";

// Что происходит с рейтингом, когда прежний рейтинг прочитать не удалось.
// 2026-08-12.
//
// getRating возвращал новичковые 1500/RD 350 в ДВУХ разных случаях: когда строки
// действительно нет (законно — так начинают) и когда запрос упал (обёртка ловит
// ошибку и отдаёт пустой список). Различить их вызывающий не мог.
//
// На закрытии партии это не показ, а запись: finalizeMatch считал новый рейтинг
// от прочитанного и записывал результат обратно. Значит один сбой сети на этом
// SELECT пересчитывал игрока с 1900 как новичка и клал результат в базу поверх
// настоящего рейтинга — молча, с виду успешно.
//
// Теперь «не удалось прочитать» отличимо, и в этом случае рейтинг не трогают
// вовсе: партия закрыта, выплата за неё проходит (она от рейтинга не зависит),
// а изменение рейтинга за эту партию теряется — это честная потеря вместо
// тихой порчи.

const { queries, failOn, state } = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  return {
    queries: [] as { text: string; params: unknown[] }[],
    failOn: { pattern: null as RegExp | null },
    state: { ended: false },
  };
});

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      queries.push({ text, params });
      if (failOn.pattern && failOn.pattern.test(text)) {
        throw new Error("connection reset by peer");
      }
      if (/SELECT\s+"status"/i.test(text)) {
        return { rows: [{ status: state.ended ? "ended" : "live", result: "white", endedAt: new Date() }] };
      }
      if (/UPDATE\s+"CyberMatch"/i.test(text) && /"status"\s*=\s*'ended'/i.test(text)) {
        if (/"status"\s*<>\s*'ended'/i.test(text) && state.ended) return { rows: [], rowCount: 0 };
        state.ended = true;
        return { rows: [{ id: "claimed" }], rowCount: 1 };
      }
      if (/INSERT INTO "CyberWalletAward"/i.test(text)) return { rows: [{ credited: 1 }] };
      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import { finalizeMatch } from "../src/routes/cyberchessMatchStore";

const INFO = {
  whiteUserId: "strong-player",
  blackUserId: "other-player",
  whiteName: "Strong",
  blackName: "Other",
  timeControl: "300+5",
  result: "white" as const,
  termination: "checkmate",
};

const RATING_READ = /SELECT \* FROM "CyberRating"/i;
const ratingWrites = () => queries.filter((q) => /INSERT INTO "CyberRating"/i.test(q.text));
const awardWrites = () => queries.filter((q) => /INSERT INTO "CyberWalletAward"/i.test(q.text));

beforeEach(() => {
  queries.length = 0;
  failOn.pattern = null;
  state.ended = false;
});

describe("нечитаемый прежний рейтинг не перезаписывается новичковым", () => {
  test("сбой чтения рейтинга не пишет рейтинг вообще", async () => {
    // Главное. На старом коде сюда приходили подставные 1500, и результат счёта
    // от них ложился поверх настоящего рейтинга обоих игроков.
    failOn.pattern = RATING_READ;

    await finalizeMatch("m-1", INFO);

    expect(queries.some((q) => RATING_READ.test(q.text))).toBe(true);
    expect(ratingWrites()).toHaveLength(0);
  });

  test("сбой чтения рейтинга не отменяет выплату за партию", async () => {
    // Выплата от рейтинга не зависит: партия сыграна, деньги причитаются.
    failOn.pattern = RATING_READ;

    await finalizeMatch("m-2", INFO);

    expect(awardWrites()).toHaveLength(2);
  });

  test("дельта рейтинга не выдумывается", async () => {
    // Вернуть «было 1500, стало 1510» тоже нельзя — это показ числа, которого
    // никто не считал.
    failOn.pattern = RATING_READ;

    const delta = await finalizeMatch("m-3", INFO);

    expect(delta).toBeNull();
  });

  test("когда рейтинг читается, он по-прежнему пишется", async () => {
    // Обратная сторона: осторожность не должна отключить сам рейтинг.
    await finalizeMatch("m-4", INFO);

    expect(ratingWrites()).toHaveLength(2);
  });
});
