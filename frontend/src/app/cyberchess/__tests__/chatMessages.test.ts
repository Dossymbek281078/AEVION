import { describe, it, expect } from "vitest";
import { sanitizeChatMessages } from "../chatMessages";

/* Текст в чат пишут посторонние. Раньше список приводился типом без проверки, и
   одно сообщение неправильной формы роняло ВСЮ панель: React не рендерит объект
   как текст. Тест держит главное свойство — кривое сообщение выбрасывается, а
   остальные доходят. */

const ok = { id: "1", author: "Аня", text: "хороший ход", ts: 100 };

describe("сообщения чата зрителей", () => {
  it("нормальное сообщение проходит целиком", () => {
    expect(sanitizeChatMessages([ok])).toEqual([{ ...ok, isHost: false }]);
  });

  it("одно кривое сообщение не уносит остальные", () => {
    const res = sanitizeChatMessages([ok, { id: "2", text: { зло: true } }, { ...ok, id: "3" }]);
    expect(res).toHaveLength(2);
    expect(res.map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("не-массив даёт пустой список, а не падение", () => {
    for (const junk of [null, undefined, {}, "строка", 42]) {
      expect(sanitizeChatMessages(junk)).toEqual([]);
    }
  });

  it("пустой текст отбрасывается", () => {
    expect(sanitizeChatMessages([{ id: "1", text: "   ", ts: 1 }])).toEqual([]);
  });

  it("длинный текст обрезается и не разносит панель", () => {
    const res = sanitizeChatMessages([{ id: "1", text: "я".repeat(5000), ts: 1 }]);
    expect(res[0].text.length).toBeLessThanOrEqual(501);
    expect(res[0].text.endsWith("…")).toBe(true);
  });

  it("отсутствующее имя заменяется нейтральным", () => {
    expect(sanitizeChatMessages([{ id: "1", text: "привет", ts: 1 }])[0].author).toBe("Зритель");
  });

  it("длинное имя обрезается", () => {
    const res = sanitizeChatMessages([{ id: "1", author: "и".repeat(200), text: "х", ts: 1 }]);
    expect(res[0].author.length).toBeLessThanOrEqual(33);
  });

  it("нечисловое время не пролезает в сортировку", () => {
    expect(sanitizeChatMessages([{ id: "1", text: "х", ts: "вчера" }])[0].ts).toBe(0);
    expect(sanitizeChatMessages([{ id: "1", text: "х", ts: NaN }])[0].ts).toBe(0);
  });

  it("признак ведущего только строго true", () => {
    expect(sanitizeChatMessages([{ ...ok, isHost: "да" }])[0].isHost).toBe(false);
    expect(sanitizeChatMessages([{ ...ok, isHost: true }])[0].isHost).toBe(true);
  });
});
