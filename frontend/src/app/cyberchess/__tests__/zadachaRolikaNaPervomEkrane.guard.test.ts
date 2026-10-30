import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { задачаПоследнегоРолика, записиДляПопытки, РАСПИСАНИЕ_РОЛИКОВ } from "../rolikiAvi";
import { klyuchEstVYazyke, blokSlovarya } from "./_slovar";

/**
 * 28.10.2026: пришедший с ролика (шапка канала → /cyberchess?c=yt-header-2810) должен видеть задачу из
 * ролика на первом экране. Сторож держит расписание, выбор запасной записи, разметку и словарь.
 */
describe("расписание задач из роликов", () => {
  it("последняя прошедшая запись", () => {
    expect(задачаПоследнегоРолика("2026-10-28")?.id).toBe("li_4YRGx");
    expect(задачаПоследнегоРолика("2026-10-29")?.id).toBe("li_0JHtW");
    expect(задачаПоследнегоРолика("2026-11-05")?.id).toBe("li_1oM3a");
    expect(задачаПоследнегоРолика("2026-10-01")).toBeNull();
  });
  it("запасные записи от новой к старой", () => {
    expect(записиДляПопытки("2026-10-28")).toEqual(["li_4YRGx", "li_1KyQr"]);
    expect(записиДляПопытки("2026-11-05", 3)).toEqual(["li_1oM3a", "li_3t5K4", "li_4wJiz"]);
    expect(записиДляПопытки("2026-10-01")).toEqual([]);
  });
  it("форма записей", () => {
    const даты = РАСПИСАНИЕ_РОЛИКОВ.map((з) => з.date);
    expect(new Set(даты).size).toBe(даты.length);
    for (const з of РАСПИСАНИЕ_РОЛИКОВ) {
      expect(з.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(з.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    }
  });
});

describe("разметка и словарь", () => {
  const src = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
  it("page.tsx содержит блок, полоску и сигнал пропажи", () => {
    for (const s of ['data-cc-rolik="1"', 'data-cc-rolik-strip="1"', 'cc.t("rolik.title")', "/^yt-/i", "задачаПоследнегоРолика(", '"rolik_puzzle_missing"'])
      expect(src, s).toContain(s);
  });
  it("адрес не переписывается: history.replaceState не больше, чем на 5bfc2c6cb (1)", () => {
    expect(src.split("history.replaceState").length - 1).toBeLessThanOrEqual(1);
  });
  it("ключи rolik.* во всех языках, en без кириллицы", () => {
    for (const к of ["rolik.title", "rolik.solve", "rolik.loading", "rolik.date"])
      for (const я of ["ru", "en", "kk"]) expect(klyuchEstVYazyke(я, к), `${я}:${к}`).toBe(true);
    const en = blokSlovarya("en").split("\n").filter((l) => l.includes('"rolik.'));
    expect(en.length).toBe(4);
    for (const l of en) expect(l).not.toMatch(/[А-Яа-яЁё]/);
  });
});
