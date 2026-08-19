import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Плашка установки не показывается там, где человек занят. 19.08.2026.
//
// Найдено окном запуска живым прохождением пути новичка: плашка не уходила во
// время партии и закрывала левую панель с оценкой и материалом. На первом
// экране она была одной из ТРЁХ накладок сразу. Для страницы, куда 30.08
// поведёт платный трафик, это и есть первое впечатление.
//
// Проверка текстовая по исходнику, и это сказано прямо: компонент слушает
// beforeinstallprompt и matchMedia, поднимать его в jsdom ради правила о
// маршрутах дороже, чем полезно.

const SRC = path.join(__dirname, "..", "PwaInstall.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8"));

describe("предложение установки уважает занятость страницы", () => {
  test("главная страница шахмат — в списке занятых", () => {
    // Именно на ней идёт партия с ИИ.
    expect(src()).toMatch(/'\/cyberchess',/);
  });

  test("задача дня и матчмейкинг тоже", () => {
    const s = src();
    expect(s).toMatch(/'\/cyberchess\/daily'/);
    expect(s).toMatch(/'\/cyberchess\/matchmaking'/);
  });

  test("на занятой странице компонент не рисует ничего", () => {
    expect(src()).toMatch(/if \(busy\) return null;/);
  });

  test("сравнение по префиксу — с разделителем", () => {
    // Без него /cyberchess-something считался бы занятым, а вложенный
    // /cyberchess/tournaments/<id> — нет.
    expect(src()).toMatch(/pathname === p \|\| pathname\.startsWith\(p \+ '\/'\)/);
  });

  test("предложение не выброшено совсем — остаются страницы, где оно уместно", () => {
    // Если бы список покрывал весь модуль, установка стала бы недоступна вовсе.
    const s = src();
    for (const free of ["/cyberchess/history", "/cyberchess/leaderboard", "/cyberchess/economy"]) {
      expect(s).not.toContain(`'${free}'`);
    }
  });
});
