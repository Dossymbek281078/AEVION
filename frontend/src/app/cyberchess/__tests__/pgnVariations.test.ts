import { describe, it, expect } from "vitest";
import { parsePgnBlock } from "../styleCloner";

/* Разбор чужого PGN — вход недоверенных данных: игрок вставляет выгрузку с любого
   сайта. Аннотированные партии приходят с комментариями и ВЛОЖЕННЫМИ вариантами,
   а снятие в один проход оставляло огрызок вроде «c)». Дальше ch.move() на нём
   бросал, цикл разбора делал break — и партия молча обрезалась там, где встретился
   первый вложенный вариант. Профиль стиля строился по огрызку, ничем не показывая,
   что данных не хватило. */

const head = '[White "Иван"]\n[Black "Пётр"]\n[Result "1-0"]\n\n';

describe("разбор PGN с аннотациями", () => {
  it("простая партия разбирается полностью", () => {
    const r = parsePgnBlock(head + "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0", "иван");
    expect(r.sans).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });

  it("ВЛОЖЕННЫЕ варианты снимаются целиком, а не одним уровнем", () => {
    const r = parsePgnBlock(head + "1. e4 e5 (1... c5 (1... e6 2. d4) 2. Nf3) 2. Nf3 Nc6 1-0", "иван");
    expect(r.sans).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(r.sans.some((s) => s.includes(")"))).toBe(false);
  });

  it("вложенные комментарии в фигурных скобках тоже", () => {
    const r = parsePgnBlock(head + "1. e4 {хороший ход {правда}} e5 2. Nf3 1-0", "иван");
    expect(r.sans).toEqual(["e4", "e5", "Nf3"]);
  });

  it("комментарии и варианты вперемешку не оставляют мусора", () => {
    const r = parsePgnBlock(
      head + "1. e4 {начало} e5 (1... c5 {сицилианская} 2. Nf3 (2. Nc3)) 2. Nf3 {развитие} Nc6 1-0",
      "иван",
    );
    expect(r.sans).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("оценки NAG и результат не попадают в ходы", () => {
    const r = parsePgnBlock(head + "1. e4 $1 e5 $2 2. Nf3 1/2-1/2", "иван");
    expect(r.sans).toEqual(["e4", "e5", "Nf3"]);
  });

  it("сторона игрока определяется по заголовку без учёта регистра", () => {
    expect(parsePgnBlock(head + "1. e4 1-0", "ИВАН").userSide).toBe("w");
    expect(parsePgnBlock(head + "1. e4 1-0", "пётр").userSide).toBe("b");
    expect(parsePgnBlock(head + "1. e4 1-0", "кто-то").userSide).toBeNull();
  });

  it("заголовок с именем из прототипа не ломает разбор", () => {
    // `\w+` матчит и __proto__, и constructor — проверяем, что это не роняет и не подменяет
    const r = parsePgnBlock('[__proto__ "x"]\n[constructor "y"]\n[White "Иван"]\n\n1. e4 1-0', "иван");
    expect(r.sans).toEqual(["e4"]);
    expect(r.white).toBe("Иван");
  });
});
