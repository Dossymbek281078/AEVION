import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Страница доказывает решение, а не объявляет его. 19.08.2026.
//
// Прежде она слала на сервер длину серии числом, и сервер её записывал. Проверено
// на боевом проде: `{"streak":364}` без единого хода — первое место со счётом
// 36700. Теперь сервер сверяет ходы и считает серию сам, а страница обязана эти
// ходы прислать, иначе решение просто не засчитается.
//
// И вторая половина: без `userId` сервер считал игрока анонимом и в таблицу
// лидеров НЕ ЗАНОСИЛ. Человек решал задачу и не появлялся в списке никогда —
// молчаливо, без единой ошибки на экране.

const SRC = path.join(__dirname, "..", "daily", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8"));

describe("отправка решения доказуема", () => {
  test("шлём ходы", () => {
    expect(src()).toMatch(/moves:\s*puzzle\.sol/);
  });

  test("шлём личность из общего источника, а не свою", () => {
    const s = src();
    expect(s).toMatch(/userId:\s*tournamentUserId\(\)/);
    expect(s).toMatch(/from '\.\.\/tournaments\/playerIdentity'/);
  });

  test("длину серии на сервер не отправляем", () => {
    // Тело запроса не должно содержать поле streak: сервер его не читает, а
    // наличие поля вернуло бы соблазн снова на него положиться.
    const body = src().split("cyberchess-daily/solve")[1]?.slice(0, 600) ?? "";
    expect(body).not.toMatch(/streak:/);
  });

  test("серию на экране берём из ответа сервера", () => {
    // Иначе на экране одно число, а в таблице лидеров другое: два писателя
    // одного значения расходятся молча.
    const s = src();
    expect(s).toMatch(/setStreak\(j\.streak\)/);
  });
});
