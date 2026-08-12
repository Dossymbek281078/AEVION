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

describe("регистрация уходит под личностью игрока, а не анонимом", () => {
  const LIST = "src/app/cyberchess/tournaments/page.tsx";
  const DETAIL = "src/app/cyberchess/tournaments/[id]/page.tsx";
  const SHARED = "src/app/cyberchess/tournaments/playerIdentity.ts";

  it("список шлёт userId, а не пустое тело", () => {
    /* С пустым телом сервер выдаёт `anon_…`: место в турнире занято, а связать
       его с человеком нечем — и билет, который сервер теперь хранит, записан на
       этот одноразовый id. */
    const src = read(LIST);
    const at = src.indexOf("/register`");
    const block = src.slice(at, at + 900);
    expect(block).toMatch(/tournamentUserId\(\)/);
    expect(block).not.toMatch(/JSON\.stringify\(\{\}\)/);
  });

  it("обе страницы берут личность из одного модуля", () => {
    /* Иначе они снова разойдутся, и человек окажется двумя игроками. */
    expect(read(LIST)).toMatch(/from "\.\/playerIdentity"/);
    expect(read(DETAIL)).toMatch(/from "\.\.\/playerIdentity"/);
    expect(read(DETAIL)).not.toMatch(/function genLocalUserId/);
  });

  it("создатель турнира опознаётся тем же ключом, что и участник", () => {
    /* Бэкенд по userId создателя записывает его ПЕРВЫМ УЧАСТНИКОМ. Пока форма
       создания читала ключ задачи дня, а кнопка Register — турнирный, один
       человек занимал в своём турнире два места под двумя id. */
    const src = read(LIST);
    expect(src).not.toMatch(/localStorage\.getItem\("cyberchess\.userId"\)/);
    // Личность берётся выше по функции, поэтому проверяем файл целиком.
    expect(src).toMatch(/const userId = tournamentUserId\(\)/);
  });

  it("ключ id не менялся при переносе", () => {
    /* Смена ключа переназначила бы личность всем, у кого уже есть история. */
    expect(read(SHARED)).toMatch(/"cc_user_id"/);
    expect(read(SHARED)).toMatch(/"cyberchess\.displayName"/);
  });
});
