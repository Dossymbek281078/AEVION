import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COMPARISON_ROWS, capabilityIsKnownOff } from "../capabilityRows";
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
