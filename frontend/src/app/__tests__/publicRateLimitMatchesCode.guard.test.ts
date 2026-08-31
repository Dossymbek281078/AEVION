import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
});
