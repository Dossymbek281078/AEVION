import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COMPARISON_ROWS, capabilityIsKnownOff, comparisonTotalUsd, PRICES_CHECKED_AT } from "../capabilityRows";
import { DEVHUB_DICT } from "../i18n";

/**
 * Таблица «одно окно вместо семи подписок» и полоса состояния стоят на витрине
 * в двадцати строках друг от друга и говорят об ОДНОМ. Замер прода 08.09.2026:
 * таблица обещала озвучку и музыку, обе в тот момент не работали (отвергнут ключ
 * ElevenLabs — «API key ID used as API key»), а полоса выше это честно называла.
 * Верили бы таблице: она крупнее и продаёт.
 */
const PAGE = fs.readFileSync(path.resolve(__dirname, "..", "page.tsx"), "utf8");

describe("таблица сравнения не спорит с полосой состояния", () => {
  test("у каждой строки есть возможность, за которой она следит", () => {
    expect(COMPARISON_ROWS.length).toBe(7);
    for (const row of COMPARISON_ROWS) {
      expect(row.cap, `строка ${row.label} ни за чем не следит`).toBeTruthy();
    }
    // Идентификаторы — те же, что у бэкенда: их держит отдельный сторож
    // capabilityIdsMatchBackend, здесь проверяем, что мы взяли их оттуда же.
    expect(COMPARISON_ROWS.map((r) => r.cap)).toEqual(
      ["code", "video", "image", "audio_tts", "audio_music", "3d", "pages"],
    );
  });

  test("неработающая возможность помечает свою строку", () => {
    const caps = [{ id: "audio_tts", status: "degraded" }, { id: "code", status: "live" }];
    expect(capabilityIsKnownOff(caps, "audio_tts")).toBe(true);
    expect(capabilityIsKnownOff(caps, "code"), "живая возможность оклеветана").toBe(false);
  });

  test("НЕЗНАНИЕ — не обвинение: ручка молчит, строки чистые", () => {
    // Пустая полоса на витрине читается как поломка. Пока состояние не пришло,
    // мы про него ничего не говорим.
    expect(capabilityIsKnownOff(null, "audio_tts")).toBe(false);
    expect(capabilityIsKnownOff([], "audio_tts")).toBe(false);
    expect(capabilityIsKnownOff([{ id: "code", status: "live" }], "audio_tts"),
      "возможности нет в ответе — это «не знаю», а не «сломано»").toBe(false);
  });

  test("страница пользуется этим механизмом, а не своим списком", () => {
    expect(PAGE, "таблица снова живёт своим списком").toContain("COMPARISON_ROWS.map");
    expect(PAGE).toContain("capabilityIsKnownOff(caps, row.cap)");
    // Зашитый список строк вернулся бы незаметно — ловим по его следу.
    expect(PAGE.includes('[t("cmp.voice"), "ElevenLabs Creator"'), "вернулся зашитый список строк").toBe(false);
  });

  test("отметка есть во всех трёх языках", () => {
    for (const [lang, dict] of Object.entries(DEVHUB_DICT)) {
      expect((dict as Record<string, string>)["cmp.offNow"], `cmp.offNow пуст в ${lang}`).toBeTruthy();
    }
  });
});

describe("цены конкурентов — сверенные, а итог считается из строк", () => {
  test("итог равен сумме строк, а не отдельному числу в разметке", () => {
    expect(comparisonTotalUsd()).toBe(COMPARISON_ROWS.reduce((s, r) => s + r.usd, 0));
    expect(PAGE, "итог снова зашит рядом со строками — разойдётся при первой правке").not.toContain("≈ $162");
    expect(PAGE).toContain("comparisonTotalUsd()");
  });

  test("у каждой строки цена числом и она положительная", () => {
    for (const row of COMPARISON_ROWS) {
      expect(typeof row.usd, `${row.rival}: цена не число`).toBe("number");
      expect(row.usd, `${row.rival}: цена не положительная`).toBeGreaterThan(0);
    }
  });

  test("цена Suno соответствует сверке 08.09.2026", () => {
    // Стояло $10 — столько тариф стоил раньше. На день сверки Suno Pro стоит $8,
    // то есть мы завышали конкурента В СВОЮ ПОЛЬЗУ. Такое находят и предъявляют
    // публично, и одна такая цифра дороже всей таблицы.
    const suno = COMPARISON_ROWS.find((r) => r.rival.startsWith("Suno"));
    expect(suno?.usd).toBe(8);
  });

  test("дата сверки названа и совпадает со сноской во всех языках", () => {
    expect(PRICES_CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const year = PRICES_CHECKED_AT.slice(0, 4);
    for (const [lang, dict] of Object.entries(DEVHUB_DICT)) {
      const note = (dict as Record<string, string>)["value.priceNote"];
      expect(note, `сноска о ценах пуста в ${lang}`).toBeTruthy();
      expect(note, `сноска в ${lang} не называет год сверки`).toContain(year);
    }
  });
});
