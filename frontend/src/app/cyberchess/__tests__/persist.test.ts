import { describe, it, expect } from "vitest";
import { readStored } from "../persist";

const DEFAULT = { v: 1, wins: 0, losses: 0, label: "нет" };

describe("readStored", () => {
  it("незнакомая версия НЕ обнуляет состояние", () => {
    const r = readStored(JSON.stringify({ v: 9, wins: 12, losses: 3 }), DEFAULT);
    expect(r.wins).toBe(12);
    expect(r.losses).toBe(3);
  });

  it("версия приводится к текущей — читаем старое, пишем новое", () => {
    expect(readStored(JSON.stringify({ v: 9, wins: 1 }), DEFAULT).v).toBe(1);
  });

  it("поле, добавленное позже, берётся из умолчаний, а не остаётся undefined", () => {
    // прежний код возвращал объект как есть, и `label` был бы undefined
    const r = readStored(JSON.stringify({ v: 1, wins: 5, losses: 1 }), DEFAULT);
    expect(r.label).toBe("нет");
  });

  it("сохранённое значение перекрывает умолчание", () => {
    expect(readStored(JSON.stringify({ v: 1, label: "есть" }), DEFAULT).label).toBe("есть");
  });

  it("нет записи — копия умолчаний, а не сама ссылка", () => {
    const r = readStored(null, DEFAULT);
    expect(r).toEqual(DEFAULT);
    expect(r).not.toBe(DEFAULT);
  });

  it("битый JSON и не-объекты не роняют чтение", () => {
    for (const junk of ["{не json", "42", '"строка"', "[1,2]", "null"]) {
      expect(readStored(junk, DEFAULT).wins).toBe(0);
    }
  });

  it("умолчания не мутируются при чтении", () => {
    readStored(JSON.stringify({ v: 1, wins: 99 }), DEFAULT);
    expect(DEFAULT.wins).toBe(0);
  });
});
