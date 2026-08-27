import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Ручек, выпускающих ПЛАТЁЖНУЮ ССЫЛКУ на нашем магазине, должно быть не больше
// одной — 19.08.2026.
//
// Замер того дня: `POST /api/devhub/media/payment-link` жива на проде и доходит
// до валидации от анонимного запроса (400 «name required»; контроль — соседний
// несуществующий путь даёт 404, то есть 400 отдаёт настоящий обработчик).
// Вызывающий задаёт название, описание и цену; нижний предел 50 центов, верхнего
// нет. То есть посторонний выпускает настоящую платёжную страницу с нашим именем.
//
// Авторизацию здесь ставит владелец: она зависит от решения «DevHub — продукт или
// внутренний инструмент», и проверка наугад либо оставит дыру, либо отрежет тех,
// кому ручка нужна. Пока решения нет, сторож держит хотя бы то, что поддаётся
// проверке: чтобы ВТОРАЯ такая ручка не появилась незамеченной.
//
// Направление выбрано так, чтобы починка сторожа НЕ краснила: проверяется «не
// больше», а не «ровно». Появится авторизация — счётчик уйдёт в ноль, и тест
// останется зелёным. Появится второй выпускатель ссылок — покраснеет.

const SRC = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");

/** Строки регистрации ручек, в теле которых создаётся чекаут у провайдера. */
function paymentLinkRoutes(src: string): string[] {
  const out: string[] = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /devhubRouter\.(post|put)\(/.exec(lines[i]);
    if (!m) continue;
    // тело ручки — до следующей регистрации
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/devhubRouter\.(get|post|put|delete|patch)\(/.test(lines[j])) { end = j; break; }
    }
    const body = lines.slice(i, end).join("\n");
    if (/custom_price|checkouts/.test(body)) out.push(lines[i]);
  }
  return out;
}

describe("выпуск платёжных ссылок: не больше одной ручки", () => {
  const routes = paymentLinkRoutes(SRC);

  test("прибор находит ту ручку, которая точно есть", () => {
    // Отрицательный контроль: без него «ноль ручек» читалось бы как «всё хорошо»,
    // тогда как чаще это значит «не умею искать».
    expect(routes.join("\n")).toMatch(/media\/payment-link/);
  });

  test("выпускателей платёжных ссылок не больше одного", () => {
    expect(
      routes.length,
      `Появилась ещё ручка, создающая чекаут:\n${routes.join("\n")}\n` +
        `Каждая такая выпускает платёжную страницу от имени AEVION. ` +
        `Проверьте авторизацию и предел суммы, прежде чем повышать эту базу.`,
    ).toBeLessThanOrEqual(1);
  });

  test("без авторизации — не больше одной (починка обнулит, и это норма)", () => {
    // Middleware при регистрации добавляет второй аргумент: `post(path, guard, handler)`.
    const open = routes.filter((l) => !/,\s*[A-Za-z_$][\w$]*\s*,\s*(?:async|\()/.test(l));
    expect(
      open.length,
      `Открытых выпускателей ссылок: ${open.length}\n${open.join("\n")}`,
    ).toBeLessThanOrEqual(1);
  });
});
