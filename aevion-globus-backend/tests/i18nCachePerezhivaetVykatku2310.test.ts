import { describe, it, expect, vi } from "vitest";
import { createI18nCacheStore, I18N_CACHE_TABLE } from "../src/lib/i18nCacheStore";

/**
 * 23.10.2026: кэш переводов жил только в памяти и обнулялся выкаткой — 659 платных вызовов за 4 часа.
 * Сторож хранилища: прогрев заполняет Map из базы, новые переводы дописываются upsert'ом, очистка по языку
 * и целиком, недоступная база — один предупреждающий лог и работа в памяти (не молчим, не падаем).
 */
function fakeDb(rows: Array<Record<string, unknown>> = []) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (/^SELECT/i.test(sql.trim())) return { rows };
    if (/RETURNING 1/.test(sql)) return { rows: [{ "?column?": 1 }, { "?column?": 1 }] };
    return { rows: [] };
  });
  return { queryFn, calls };
}

describe("кэш переводов переживает выкатку (i18nCacheStore)", () => {
  it("прогрев: создаёт таблицу и заполняет Map из базы, не затирая уже имеющееся", async () => {
    const { queryFn, calls } = fakeDb([{ key: "kk|Привет", translated: "Сәлем" }, { key: "en|Привет", translated: "Hello" }]);
    const store = createI18nCacheStore(queryFn);
    const map = new Map([["en|Привет", "Hi (уже в памяти)"]]);
    const n = await store.warm(map, 60_000);
    expect(n).toBe(1);
    expect(map.get("kk|Привет")).toBe("Сәлем");
    expect(map.get("en|Привет")).toBe("Hi (уже в памяти)");
    expect(calls.some((c) => c.sql.includes(`CREATE TABLE IF NOT EXISTS ${I18N_CACHE_TABLE}`))).toBe(true);
    expect(calls.find((c) => /^SELECT/i.test(c.sql.trim()))?.params).toEqual([60_000]);
    expect(store.available).toBe(true);
  });

  it("дозапись: один INSERT … ON CONFLICT на пакет, параметры по 5 на строку", async () => {
    const { queryFn, calls } = fakeDb();
    const store = createI18nCacheStore(queryFn);
    const n = await store.persist([
      { key: "kk|Купить", target: "kk", source: "Купить", translated: "Сатып алу" },
      { key: "en|Купить", target: "en", source: "Купить", translated: "Buy", engine: "claude" },
    ]);
    expect(n).toBe(2);
    const ins = calls.find((c) => /^INSERT/i.test(c.sql.trim()));
    expect(ins?.sql).toMatch(/ON CONFLICT \("key"\) DO UPDATE/);
    expect(ins?.params).toHaveLength(10);
    expect(ins?.params?.[8]).toBe("Buy");
    expect(await store.persist([])).toBe(0);
  });

  it("очистка: по языку — WHERE target, целиком — без условия; возвращает число удалённых", async () => {
    const { queryFn, calls } = fakeDb();
    const store = createI18nCacheStore(queryFn);
    expect(await store.clear("kk")).toBe(2);
    expect(calls.find((c) => /^DELETE/i.test(c.sql.trim()))?.params).toEqual(["kk"]);
    expect(await store.clear()).toBe(2);
    expect(calls.filter((c) => /^DELETE/i.test(c.sql.trim())).at(-1)?.params).toBeUndefined();
  });

  it("маршрут i18n подключён к хранилищу: прогрев до чтения кэша, дозапись после записи, очистка обеих сторон", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "routes", "i18n.ts"), "utf8");
    const warm = src.indexOf("await warmCacheOnce();"), firstGet = src.indexOf("cache.get(ckey(target, texts[i]))");
    expect(warm, "warmCacheOnce есть").toBeGreaterThan(-1);
    expect(warm, "прогрев стоит раньше первого чтения кэша").toBeLessThan(firstGet);
    expect(src).toContain("void cacheStore.persist(новые);");
    expect(src).toContain("const clearedDb = await cacheStore.clear(target || undefined);");
    expect(src).toContain("cacheDb: cacheStore.available,");
  });

  it("база недоступна: один предупреждающий лог, прогрев 0, дозапись 0, очистка -1 — без исключений", async () => {
    const log = vi.fn();
    const store = createI18nCacheStore(async () => { throw new Error("ECONNREFUSED 127.0.0.1:5432"); }, log);
    expect(await store.warm(new Map(), 10)).toBe(0);
    expect(await store.persist([{ key: "k", target: "kk", source: "a", translated: "b" }])).toBe(0);
    expect(await store.clear("kk")).toBe(-1);
    expect(store.available).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("кэш переводов в базе недоступен");
  });
});
