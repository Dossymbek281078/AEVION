import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Установщик обещает только то, что приложение делает. 19.08.2026.
//
// Прежний текст обещал «Ежедневные напоминания о пазле — держи серию», то есть
// возврат в приложение. Проверено: у service worker нет обработчиков push и
// periodicsync, а напоминание крутится setInterval-ом на ОТКРЫТОЙ странице.
// Напоминание, требующее уже быть в приложении, вернуть в него не может.
//
// Проверка сверяет обещание с устройством, а не с намерением: если однажды
// появится настоящий push, тест об этом скажет — и текст можно будет вернуть.

const UI = path.join(__dirname, "..", "PwaInstall.tsx");
const SW = path.join(__dirname, "..", "..", "..", "..", "public", "sw.js");

describe("обещания установщика", () => {
  test("напоминание не обещает возврат, пока нет push", () => {
    const sw = fs.readFileSync(SW, "utf-8");
    const умеетБудить = /addEventListener\(\s*["'](push|periodicsync)["']/.test(sw);
    const ui = stripComments(fs.readFileSync(UI, "utf-8"));
    if (!умеетБудить) {
      expect(ui).not.toMatch(/Ежедневные напоминания/);
      expect(ui).toMatch(/пока приложение открыто/);
    } else {
      // Push появился — обещание возврата снова законно.
      expect(ui).toMatch(/апоминани/);
    }
  });

  test("обещание офлайна подкреплено кэширующим обработчиком", () => {
    const sw = fs.readFileSync(SW, "utf-8");
    expect(sw).toMatch(/addEventListener\(\s*["']fetch["']/);
  });
});
