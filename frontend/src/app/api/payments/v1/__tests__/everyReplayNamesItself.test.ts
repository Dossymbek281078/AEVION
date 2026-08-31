import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: если обработчик умеет отвечать повтором, он обязан назвать это.
 *
 * ЗАЧЕМ. Ответ на повтор с тем же Idempotency-Key выглядит как обычный успех:
 * 200 и тот же объект. Без заголовка вызывающий не может отличить «действие
 * выполнено сейчас» от «вам вернули прошлый ответ». На денежном возврате это
 * разница между «деньги ушли ещё раз» и «не ушли».
 *
 * Заголовок ставили ЧЕТВЕРО обработчиков из пяти — ссылки, чекаут, подписки,
 * вебхуки. Не ставил ровно возврат, то есть тот, где цена вопроса выше всего.
 */
const V1 = join(__dirname, "..");

function файлыМаршрутов(dir: string): string[] {
  const out: string[] = [];
  for (const i of readdirSync(dir)) {
    if (i === "__tests__") continue;
    const p = join(dir, i);
    if (statSync(p).isDirectory()) out.push(...файлыМаршрутов(p));
    else if (i === "route.ts") out.push(p);
  }
  return out;
}

describe("повтор называет себя повтором", () => {
  it("каждый обработчик с защитой от повтора ставит заголовок", () => {
    const сЗащитой = файлыМаршрутов(V1).filter((f) =>
      readFileSync(f, "utf8").includes("checkIdempotency(")
    );

    // Знаменатель: таких обработчиков заведомо несколько.
    expect(сЗащитой.length, "обработчиков с защитой не найдено — сторож проверял пустоту")
      .toBeGreaterThan(3);

    const молчащие = сЗащитой.filter(
      (f) => !readFileSync(f, "utf8").includes("idempotent-replayed")
    );
    expect(молчащие, "повтор неотличим от нового действия").toEqual([]);

    // Вторая половина класса: обработчик может передавать в защиту тело
    // ЗАПРОСА (checkIdempotency(req, raw)) — тогда кэшировать ответ он обязан
    // при уборке, аргументом. Без аргумента на повтор уходит эхо запроса.
    // Так было у возвратов и у споров, и первое я счёл единичным случаем.
    const эхоЗапроса = сЗащитой.filter((f) => {
      const src = readFileSync(f, "utf8");
      return (
        src.includes("checkIdempotency(req, raw)") &&
        !/cleanup\??\.?\(responseBody\)/.test(src)
      );
    });
    expect(эхоЗапроса, "повтор вернёт вызывающему его же запрос").toEqual([]);
  });
});
