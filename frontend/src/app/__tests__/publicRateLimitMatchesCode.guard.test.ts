import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// 29.08.2026: публичная страница платёжного API обещала «100 req/sec», а код
// кассы разрешает 60 запросов в МИНУТУ — завышение в сто раз. Клиент, который
// рассчитал бы интеграцию по витрине, упёрся бы в отказы с первой секунды.
// Менять сам предел — решение продуктовое; врать о нём — дефект. Сторож держит
// число на странице равным числу в коде.
const R = join(__dirname, "..", "..");

describe("предел частоты на витрине совпадает с кодом", () => {
  it("страница называет ровно то число, которое применяет касса", () => {
    const lib = readFileSync(join(R, "app/api/payments/v1/_lib.ts"), "utf8");
    const page = readFileSync(join(R, "app/payments/api/page.tsx"), "utf8");

    const limit = lib.match(/DEFAULT_RATE_LIMIT = (\d+)/)?.[1];
    const windowMs = lib.match(/DEFAULT_RATE_WINDOW_MS = (\d+) \* 1000/)?.[1];
    expect(limit, "не нашёл предел в _lib.ts").toBeTruthy();
    expect(windowMs, "не нашёл окно в _lib.ts").toBe("60");

    const card = page.match(/<FactCard label="Rate limit" value="([^"]+)"/)?.[1];
    expect(card, "на странице нет карточки Rate limit").toBeTruthy();
    expect(card).toBe(`${limit} req/min`);

    // и отдельно: обещания «в секунду» на этой странице быть не должно вовсе
    const proseSec = page.split("\n").filter(
      (l) => l.includes("req/sec") && !l.trim().startsWith("{/*") && !l.trim().startsWith("*")
    );
    expect(proseSec, "страница снова обещает запросы в секунду").toEqual([]);
  });

  it("предел, отличный от общего, назван в контракте", () => {
    // 31.08.2026. Число на витрине я привёл к коду и на этом остановился, а
    // предел у обработчиков не один: тестовая доставка вебхука держит 30 в
    // минуту, вдвое строже общего. Интегратор, считающий по витрине, получил
    // бы отказ на половине заявленного темпа.
    const spec = readFileSync(join(R, "app", "api", "openapi.json", "route.ts"), "utf8");
    const свои: number[] = [];
    const обойти = (dir: string) => {
      for (const i of readdirSync(dir, { withFileTypes: true })) {
        if (i.name === "__tests__") continue;
        const путь = join(dir, i.name);
        if (i.isDirectory()) обойти(путь);
        else if (i.name === "route.ts") {
          for (const m of readFileSync(путь, "utf8").matchAll(
            /gateRequest\(\s*req\s*,\s*\{\s*limit:\s*(\d+)/g
          )) свои.push(Number(m[1]));
        }
      }
    };
    обойти(join(R, "app", "api", "payments", "v1"));

    // Знаменатель: такой обработчик заведомо есть. Пустой список означал бы
    // сломанный обход, а не отсутствие исключений.
    expect(свои.length, "обработчиков со своим пределом не найдено — обход сломан")
      .toBeGreaterThan(0);

    const необъявленные = свои.filter(
      (n) => !spec.includes(`${n} requests per minute`)
    );
    expect(необъявленные, "у обработчика свой предел, а в контракте о нём нет").toEqual([]);
  });
});
