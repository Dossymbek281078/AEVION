import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Текст страницы не должен отставать от продукта.
 *
 * Повод: страница сутки писала «скан и JPEG пока не распознаются», когда
 * распознавание уже работало и было подключено. Занижение так же вредно, как
 * завышение: человек уходит, не попробовав то, что мы умеем. Проза не
 * проверяется ничем и потому стареет молча — здесь она проверяется КОДОМ.
 */
const DIR = __dirname;
const client = readFileSync(path.join(DIR, "_client.tsx"), "utf8");

/** Существует ли возможность в коде (по факту импорта и вызова). */
function moduleWired(file: string, symbol: string): boolean {
  const src = readFileSync(path.join(DIR, file), "utf8");
  return src.length > 0 && client.includes(symbol);
}

describe("страница описывает продукт таким, какой он есть", () => {
  it("распознавание картинки работает — значит текст обязан его называть", () => {
    expect(moduleWired("raster.ts", "RasterReview"), "экран правки не подключён").toBe(true);
    expect(/JPEG|картинк/i.test(client), "страница не упоминает картинки").toBe(true);
    // и НЕ должна утверждать обратное
    expect(/не распознаются[^\n]{0,40}(скан|JPEG)|(скан|JPEG)[^\n]{0,40}пока не распознаются/i.test(client))
      .toBe(false);
  });

  it("приём файлов на странице совпадает с тем, что описано словами", () => {
    const accept = /accept="([^"]+)"/.exec(client)?.[1] ?? "";
    expect(accept).toContain(".dxf");
    expect(accept).toContain(".pdf");
    expect(accept).toContain("image/");
    // каждому формату из accept — упоминание в тексте
    expect(/DXF/.test(client)).toBe(true);
    expect(/PDF/.test(client)).toBe(true);
    expect(/JPEG|PNG|картинк/i.test(client)).toBe(true);
  });

  it("границы названы: масштаб спрашиваем, проёмы не распознаём", () => {
    expect(/спросим у вас|укажите|назов[её]те/i.test(client), "не сказано, что масштаб спрашиваем").toBe(true);
    expect(/Окна и двери из чертежа не распознаются/i.test(client)).toBe(true);
  });

  it("разводка названа черновиком, а не проектом", () => {
    expect(/черновик по типовым нормам/i.test(client)).toBe(true);
    expect(/не проектная\s+документация/i.test(client)).toBe(true);
  });

  it("контроль прибора: выдуманная фраза на странице НЕ находится", () => {
    expect(/сертифицированное проектное решение/i.test(client)).toBe(false);
  });
});
