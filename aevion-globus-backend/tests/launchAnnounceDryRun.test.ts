import { describe, expect, test } from "vitest";

import { extractRows } from "../scripts/launch-announce-dry";

// Сухой прогон рассылки — то, что владелец запустит СВОИМИ руками перед письмами
// живым людям. Тестов у него не было, а `extractRows` экспортировался «ради теста»:
// воспользоваться им было нельзя, потому что при импорте срабатывали проверки
// верхнего уровня и звали process.exit, убивая прогон. Экспорт был декоративным.
// Признак прямого вызова добавлен, и теперь модуль можно подключить — вот проверки.
//
// Главное здесь — различие «формат не распознан» и «никто не подписан». Один раз я на
// этом уже ошибся: скрипт читал поле `rows`, ручка отдавала `items`, и сухой прогон
// печатал «получателей нет» при живых подписчиках, да ещё убедительно объяснял это
// двумя причинами. Молчаливый ноль хуже ошибки.

describe("разбор выгрузки подписчиков", () => {
  test("читает поле items — то, что ручка отдаёт на самом деле", () => {
    const rows = extractRows({ items: [{ email: "a@b.ru", source: "devhub" }] });
    expect(rows).toEqual([{ email: "a@b.ru", source: "devhub" }]);
  });

  test("понимает и rows, и subscribers — имя поля меняли", () => {
    expect(extractRows({ rows: [{ email: "a@b.ru" }] })).toEqual([{ email: "a@b.ru", source: "" }]);
    expect(extractRows({ subscribers: [{ email: "c@d.ru" }] })).toEqual([{ email: "c@d.ru", source: "" }]);
  });

  test("неизвестный формат даёт null, а НЕ пустой список", () => {
    // Разница принципиальная: null означает «спросить не удалось», и вызывающий обязан
    // сказать «формат не распознан». Пустой список означает «никого нет» — и это было
    // бы ложью о живых подписчиках.
    expect(extractRows({ people: [{ email: "a@b.ru" }] })).toBeNull();
    expect(extractRows({})).toBeNull();
    expect(extractRows({ items: "не массив" as never })).toBeNull();
  });

  test("поле есть, но пустое — это ЧЕСТНЫЙ ноль, а не null", () => {
    // Второй конец того же различия: список пришёл и он пуст. Это ответ, а не отказ.
    expect(extractRows({ items: [] })).toEqual([]);
  });

  test("записи без адреса выбрасываются — рассылать некуда", () => {
    const rows = extractRows({ items: [{ email: "a@b.ru" }, { source: "devhub" }, { email: "" }] });
    expect(rows).toEqual([{ email: "a@b.ru", source: "" }]);
  });

  test("мусор внутри списка не роняет разбор", () => {
    const rows = extractRows({ items: [null, 42, "строка", { email: "a@b.ru", source: "x" }] as never });
    expect(rows).toEqual([{ email: "a@b.ru", source: "x" }]);
  });

  test("подключение модуля НЕ запускает команду", () => {
    // Если бы запускало, прогон завершился бы на process.exit ещё до этой строки —
    // а тест, который не может даже начаться, охраняет ноль.
    expect(typeof extractRows).toBe("function");
  });
});
