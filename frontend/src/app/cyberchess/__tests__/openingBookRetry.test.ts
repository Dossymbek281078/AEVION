import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* Провал загрузки книги раньше кэшировался: одна неудачная попытка при старте
   навсегда выключала книгу на всю сессию. Наружу это выглядело не как ошибка, а
   как «бот слабый» — он просто переставал играть по книге. Тест проверяет именно
   восстановление: после неудачи следующий запрос обязан попробовать снова. */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ROWS = [{ eco: "B00", name: "Королевский пешечный", moves: "e2e4 e7e5" }];

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetModules();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("загрузка книги дебютов", () => {
  it("после неудачной попытки следующая пробует снова", async () => {
    let calls = 0;
    (globalThis as { fetch?: unknown }).fetch = async () => {
      calls++;
      if (calls === 1) throw new Error("сеть недоступна");
      return { ok: true, status: 200, json: async () => ROWS };
    };
    const { getBookContinuations } = await import("../localOpeningBook");

    const first = await getBookContinuations(START);
    expect(first.moves).toHaveLength(0); // тихая деградация, не падение

    const second = await getBookContinuations(START);
    expect(calls).toBe(2); // ключевое: повтор состоялся
    expect(second.moves.map((m) => m.uci)).toContain("e2e4");
  });

  it("ответ не-2xx считается провалом, а не пустой книгой", async () => {
    let calls = 0;
    (globalThis as { fetch?: unknown }).fetch = async () => {
      calls++;
      // сервер отдал HTML-страницу ошибки с кодом 404
      if (calls === 1) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ROWS };
    };
    const { getBookContinuations } = await import("../localOpeningBook");

    expect((await getBookContinuations(START)).moves).toHaveLength(0);
    expect((await getBookContinuations(START)).moves.length).toBeGreaterThan(0);
    expect(calls).toBe(2);
  });

  it("успешная загрузка кэшируется — сеть не дёргается на каждый ход", async () => {
    let calls = 0;
    (globalThis as { fetch?: unknown }).fetch = async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ROWS };
    };
    const { getBookContinuations } = await import("../localOpeningBook");

    await getBookContinuations(START);
    await getBookContinuations(START);
    await getBookContinuations(START);
    expect(calls).toBe(1);
  });

  it("провал не остаётся молчаливым — в консоль уходит предупреждение", async () => {
    (globalThis as { fetch?: unknown }).fetch = async () => { throw new Error("нет сети") };
    const { getBookContinuations } = await import("../localOpeningBook");
    await getBookContinuations(START);
    expect(warn).toHaveBeenCalled();
  });
});
