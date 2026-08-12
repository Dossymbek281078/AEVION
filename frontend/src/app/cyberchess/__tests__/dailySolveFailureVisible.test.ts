import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { stripComments } from "./_stripComments";

/* Отказ сервера при отправке результата дня не должен пропадать молча.
 *
 * Было так: `if (res.ok) await loadStandings();` — и всё. Локальная серия к
 * этому моменту уже сохранена, поэтому игрок видел решённый пазл, свою серию и
 * был уверен, что результат в общей таблице. А его там не было. Ошибки сети
 * глотались тем же способом — пустым `catch`.
 *
 * Цена выросла 12.08.2026: бэкенд теперь может ответить 400 (заявленная серия
 * вне допустимых границ) и 429 (слишком много отправок подряд). Оба ответа
 * попадали бы ровно в эту тишину.
 *
 * Проверка читает исходник страницы: поднимать компонент на 891 строку ради
 * одной ветки дороже, чем оно стоит, а сторож ловит именно повторное
 * исчезновение сообщения. В этом модуле так уже сделано для связки турнирной
 * сетки и для источника пазла дня.
 */

const PAGE = "src/app/cyberchess/daily/page.tsx";

const read = (p: string) => stripComments(readFileSync(p, "utf8"));

/** Тело блока отправки результата — от вызова /solve до конца его catch. */
function solveBlock(src: string): string {
  const start = src.indexOf("/solve`");
  expect(start).toBeGreaterThan(-1);
  const rest = src.slice(start);
  const end = rest.indexOf("}, [streak");
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe("игрок узнаёт, что результат не попал в таблицу", () => {
  it("у ветки res.ok есть else, а не молчаливый выход", () => {
    const block = solveBlock(read(PAGE));
    expect(block).toMatch(/if\s*\(res\.ok\)/);
    expect(block).toMatch(/\belse\b/);
  });

  it("отказ сервера сообщается игроку", () => {
    const block = solveBlock(read(PAGE));
    /* Два сообщения: одно на отказ сервера, второе на обрыв связи. Если
       останется одно — значит одну из двух тишин вернули. */
    const messages = block.match(/setMessage\s*\(/g) ?? [];
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  it("catch не пустой — обрыв связи тоже виден", () => {
    const block = solveBlock(read(PAGE));
    const catchAt = block.indexOf("catch");
    expect(catchAt).toBeGreaterThan(-1);
    expect(block.slice(catchAt)).toMatch(/setMessage/);
  });

  it("429 назван отдельно, а не свален в общий отказ", () => {
    /* Ограничение частоты — единственный отказ, который проходит сам собой
       через минуту. Сказать «попробуй позже» и «сервер не принял» — разные
       советы, и для игрока это разница между подождать и переделать. */
    const block = solveBlock(read(PAGE));
    expect(block).toMatch(/429/);
  });

  it("сообщение дописывается к прежнему, а не затирает его", () => {
    /* Иначе поздравление с решением исчезает и остаётся одна жалоба —
       игрок теряет подтверждение того, что пазл всё-таки решён. */
    const block = solveBlock(read(PAGE));
    expect(block).toMatch(/setMessage\s*\(\s*\(m\)\s*=>/);
  });
});
