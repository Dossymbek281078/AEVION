import { describe, it, expect } from "vitest";
import { resolveStartCity, DEFAULT_CITY } from "./startCity";

// Ссылка `/qskyway?city=nyc` открывала Астану: монтирование звало
// `loadCity("astana")` жёстко, а адрес не читало. Бэкенд параметр поддерживал
// давно, так что снаружи это выглядело как «поделился ссылкой на Нью-Йорк, а
// человек увидел другой город» — без единого признака подмены.

describe("с какого города открывать QSkyway", () => {
  it("без параметра — город по умолчанию", () => {
    expect(resolveStartCity("")).toBe(DEFAULT_CITY);
    expect(resolveStartCity("?")).toBe(DEFAULT_CITY);
    expect(resolveStartCity("?foo=bar")).toBe(DEFAULT_CITY);
  });

  it("параметр из адреса применяется — это и был баг", () => {
    expect(resolveStartCity("?city=nyc")).toBe("nyc");
    expect(resolveStartCity("city=tokyo")).toBe("tokyo"); // без ведущего «?»
    expect(resolveStartCity("?utm_source=x&city=tokyo")).toBe("tokyo");
  });

  it("регистр и пробелы не мешают", () => {
    expect(resolveStartCity("?city=NYC")).toBe("nyc");
    expect(resolveStartCity("?city=%20tokyo%20")).toBe("tokyo");
  });

  it("пустое значение — это «не просили», а не пустой город", () => {
    expect(resolveStartCity("?city=")).toBe(DEFAULT_CITY);
    expect(resolveStartCity("?city=%20")).toBe(DEFAULT_CITY);
  });

  it("незнакомый город НЕ подменяется молча на город по умолчанию", () => {
    // Пусть загрузка упрётся в 404 и страница честно скажет «не удалось
    // загрузить город». Подмена показала бы чужой город под чужой ссылкой —
    // ровно то, что чинили.
    expect(resolveStartCity("?city=atlantis")).toBe("atlantis");
    expect(resolveStartCity("?city=constructor")).toBe("constructor");
  });
});
