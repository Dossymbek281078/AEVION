import { describe, expect, test } from "vitest";
import { getLeaderboard, getFullBoardAroundMe, type LbCategory } from "../leaderboards";

// Синтетическая таблица не должна носить имена РЕАЛЬНЫХ людей — 21.08.2026.
//
// Что было на живом сайте: /cyberchess/daily показывал 99 строк, где первые места
// занимали имена действующих гроссмейстеров, один человек попадал в список дважды
// (имя и фамилия как разные «игроки»), 70 из 99 строк были клонами вида «Имя_N», а
// флаги подставлялись независимым индексом — люди стояли под чужими флагами. Пометки
// «демо» на странице нет, бэкенд при этом отдаёт leaderboard total=0. То есть
// выдуманные результаты подавались под именами реальных людей.
//
// Их собственный смоук cyberchess-prod-smoke.js это ловит и был красным на проде;
// здесь та же проверка, но у ИСТОЧНИКА, чтобы дефект не доезжал до страницы.
//
// Проверяется ВЫВОД генератора, а не текст файла: массив можно переименовать,
// склеить из кусков или собрать в другом месте — а имя в таблице всё равно всплывёт.

const REAL_PEOPLE = [
  "Magnus", "Hikaru", "Fabiano", "Praggnanandhaa", "Gukesh", "Alireza", "Nodirbek",
  "Carlsen", "Nakamura", "Caruana", "Firouzja", "Nepomniachtchi", "Giri", "Aronian",
  "Kasparov", "Karpov", "Kramnik", "Polgar", "Goryachkina", "Kosteniuk", "Lagno",
];

const CATEGORIES: LbCategory[] = ["blitz", "rapid", "bullet", "puzzles", "rush"];

describe("таблица лидеров не носит имена реальных людей", () => {
  test("контроль: генератор вообще отдаёт непустой список", () => {
    // Без этого «имён не найдено» означало бы «список пуст», а не «чисто».
    const board = getLeaderboard("blitz");
    expect(board.length).toBeGreaterThan(10);
    expect(board.every((e) => typeof e.name === "string" && e.name.length > 0)).toBe(true);
  });

  test.each(CATEGORIES)("%s: ни одного настоящего имени", (cat) => {
    const names = getLeaderboard(cat).map((e) => e.name).join(" | ");
    const found = REAL_PEOPLE.filter((n) => names.includes(n));
    expect(found, `в таблице «${cat}» имена реальных людей: ${found.join(", ")}`).toEqual([]);
  });

  test("полная таблица вокруг игрока — тоже без настоящих имён", () => {
    // Страница показывает именно её: 99 строк с местом пользователя внутри.
    const names = getFullBoardAroundMe("blitz", 1500, "Тестовый").map((e) => e.name).join(" | ");
    const found = REAL_PEOPLE.filter((n) => names.includes(n));
    expect(found, `в полной таблице имена реальных людей: ${found.join(", ")}`).toEqual([]);
  });
});
