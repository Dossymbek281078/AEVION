import { describe, it, expect, vi } from "vitest";
import { хвостПерехода } from "../shortEntry";

/*
 * 🔴 148 (18.10.2026). Замер оркестратора на проде f3289d821: `/wa?c=wa-school-almaty&probe=orch` →
 * `/cyberchess?c=wa-school-almaty` — `probe` терялся, и браузерная проба через короткий вход становилась живым визитом
 * канала (тот же класс, что 30.09: пробы читались покупателями). Теперь каждый короткий вход несёт дальше названные
 * параметры (probe, puzzle, lang, utm_*) с безопасными значениями; всё прочее отбрасывается.
 * Сторож ИСПОЛНЯЕТ входы (как shortEntryCarriesTheWholeTag): /wa, /testers, /sh (единый шаблон) и /ci (без ветки
 * «своя метка») — и смотрит адрес, который они вернули.
 */
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); },
}));

async function адресВхода(путь: string, параметры: Record<string, string>): Promise<string> {
  const модуль = (await import(`../../app/${путь}/page`)) as { default: (a: { searchParams: Promise<Record<string, string>> }) => Promise<void> };
  try { await модуль.default({ searchParams: Promise.resolve(параметры) }); } catch (e) { return (e as { url: string }).url; }
  throw new Error(`${путь}: перенаправления не было`);
}

describe("148: хвост перехода", () => {
  it("🔴 probe и puzzle едут дальше, чужие ключи и опасные значения — нет", () => {
    expect(хвостПерехода({ probe: "user-99", puzzle: "li_075iw" })).toBe("&probe=user-99&puzzle=li_075iw");
    expect(хвостПерехода({ probe: ["orch", "x"] })).toBe("&probe=orch");
    expect(хвостПерехода({ evil: "1", redirect: "https://x.tld" })).toBe("");
    expect(хвостПерехода({ probe: "a b", lang: "<script>" })).toBe("");
    expect(хвостПерехода({ probe: "x".repeat(65) })).toBe("");
    expect(хвостПерехода(undefined)).toBe("");
  });
});

describe("148: короткие входы несут probe", () => {
  it("🔴 /wa и /testers: метка целиком + probe; без probe адрес прежний", async () => {
    expect(await адресВхода("wa", { c: "wa-school-almaty", probe: "orch" })).toBe("/cyberchess?c=wa-school-almaty&probe=orch");
    expect(await адресВхода("wa", { probe: "user-99" }), "без метки, но с пробой — проба не теряется").toBe("/cyberchess?c=wa&probe=user-99");
    expect(await адресВхода("wa", { c: "wa-school-almaty" })).toBe("/cyberchess?c=wa-school-almaty");
    expect(await адресВхода("wa", {})).toBe("/cyberchess?c=wa");
    expect(await адресВхода("testers", { c: "testers-club-au", probe: "user-99" })).toBe("/cyberchess?c=testers-club-au&probe=user-99");
  });
  it("🔴 /sh (вход каталога) и /ci (вход без ветки «своя метка») тоже несут probe", async () => {
    expect(await адресВхода("sh", { c: "sh", probe: "user-99" })).toBe("/en/devhub?c=sh&probe=user-99");
    expect(await адресВхода("ci", { probe: "user-99" })).toBe("/cyberchess?c=ig-blogger-bio&probe=user-99");
  });
  it("КОНТРОЛЬ: чужой параметр через вход не проходит", async () => {
    expect(await адресВхода("wa", { c: "wa", next: "https://evil.tld" })).toBe("/cyberchess?c=wa");
  });
});
