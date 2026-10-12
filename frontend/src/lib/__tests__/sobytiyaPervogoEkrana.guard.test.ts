import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 ЧТО ДЕЛАЮТ 153 ЖИВЫХ, КОТОРЫЕ ОТКРЫЛИ /devhub И УШЛИ БЕЗ ШАГА.
 *
 * Разрез byLastStep 12.10.2026: «открыл страницу» 187 сессий, наших 34 — между
 * «открыл» и «нажал Построить» событий не было вовсе. Четыре дешёвых события
 * первого экрана закрывают эту слепоту; каждое — раз за сессию.
 */
const отправлено: Array<Record<string, unknown>> = [];
vi.mock("@/lib/track", () => ({ track: (e: Record<string, unknown>) => { отправлено.push(e); } }));

async function модуль() {
  vi.resetModules();
  return await import("../sobytiyaPervogoEkrana");
}

beforeEach(() => { отправлено.length = 0; sessionStorage.clear(); });

describe("ведро времени и пороги глубины", () => {
  it("🔴 ведра 5/15/60 с, меньше 5 с — не считаем", async () => {
    const { vedroVremeni } = await модуль();
    const случаи: Array<[number, 5 | 15 | 60 | null]> = [[0, null], [4_999, null], [5_000, 5], [14_999, 5], [15_000, 15], [59_999, 15], [60_000, 60], [3_600_000, 60], [Number.NaN, null]];
    for (const [мс, ждём] of случаи) expect(vedroVremeni(мс), String(мс)).toBe(ждём);
    expect(случаи.length).toBe(9);
  });

  it("🔴 пороги 25/50/100 пересекаются по доле, 100 — только у самого низа", async () => {
    const { porogiGlubiny } = await модуль();
    expect(porogiGlubiny(0)).toEqual([]);
    expect(porogiGlubiny(0.24)).toEqual([]);
    expect(porogiGlubiny(0.25)).toEqual([25]);
    expect(porogiGlubiny(0.6)).toEqual([25, 50]);
    expect(porogiGlubiny(0.99)).toEqual([25, 50]);
    expect(porogiGlubiny(1)).toEqual([25, 50, 100]);
    expect(porogiGlubiny(Number.NaN)).toEqual([]);
  });
});

describe("шаг первого экрана", () => {
  it("🔴 шлётся feature_use с source devhub и ровно один раз за сессию", async () => {
    const { shagPervogoEkrana } = await модуль();
    expect(shagPervogoEkrana("textarea_focus")).toBe(true);
    expect(shagPervogoEkrana("textarea_focus")).toBe(false);
    expect(shagPervogoEkrana("textarea_focus")).toBe(false);
    expect(отправлено.length, "повтор раздул бы числа").toBe(1);
    expect(отправлено[0]).toEqual({ type: "feature_use", source: "devhub", meta: { feature: "textarea_focus" } });
    // Другой шаг — своя отметка, не делит ключ с первым.
    expect(shagPervogoEkrana("example_chip_click")).toBe(true);
    expect(отправлено.length).toBe(2);
  });
});

describe("страница /devhub подключена — знаменатель 4 из 4", () => {
  const СТР = readFileSync(join(process.cwd(), "src/app/devhub/page.tsx"), "utf8");
  it("🔴 фокус поля, клик по примеру, подписка на прокрутку/уход, импорт", () => {
    expect(СТР).toContain('shagPervogoEkrana("textarea_focus")');
    expect(СТР).toContain('shagPervogoEkrana("example_chip_click")');
    expect(СТР).toContain("useEffect(() => podklyuchitSobytiyaPervogoEkrana(), []);");
    expect(СТР).toContain('from "@/lib/sobytiyaPervogoEkrana"');
    // Клик по примеру по-прежнему подставляет текст — событие не вместо действия.
    expect(СТР).toContain('shagPervogoEkrana("example_chip_click"); setIdeaPrompt(example);');
  });
});
