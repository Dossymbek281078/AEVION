import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { stripComments } from "./_stripComments";

/* Упавшая регистрация не должна выглядеть успешной.
 *
 * В списке турниров `catch` вокруг POST /register говорил
 * «Registered (offline mock) for ...» — то есть при обрыве связи человеку
 * СООБЩАЛИ, что он записан. Он не был записан ничем: запрос до сервера не
 * дошёл, места за ним нет, и обнаружил бы он это, только не найдя себя в
 * списке участников — уже после начала турнира.
 *
 * Это не «проглоченная ошибка», а хуже: молчание оставляет человека в
 * неведении, а такое сообщение уводит его в уверенность.
 *
 * Проверка читает исходник — тот же сторожевой стиль, что уже принят в этом
 * модуле для связки турнирной сетки и для отправки результата дня.
 */

const PAGE = "src/app/cyberchess/tournaments/page.tsx";

const read = (p: string) => stripComments(readFileSync(p, "utf8"));

describe("список турниров не сообщает об успехе, которого не было", () => {
  it("слова про offline mock в файле больше нет", () => {
    expect(read(PAGE)).not.toMatch(/offline mock/i);
  });

  it("в catch вокруг регистрации сказано, что записи НЕ произошло", () => {
    const src = read(PAGE);
    const at = src.indexOf("/register`");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 1400);
    const catchAt = block.indexOf("catch");
    expect(catchAt).toBeGreaterThan(-1);
    const tail = block.slice(catchAt);

    // Отрицание обязано быть: без него текст снова читается как успех.
    expect(tail).toMatch(/НЕ записаны|не удалось|Не удалось/);
  });

  it("успех по-прежнему сообщается только при data.ok", () => {
    /* Обратная сторона: чинить ложный успех нельзя ценой пропажи настоящего. */
    const src = read(PAGE);
    const at = src.indexOf("/register`");
    const block = src.slice(at, at + 1400);
    expect(block).toMatch(/data\?\.ok/);
    expect(block).toMatch(/Registered\. Ticket/);
  });
});
