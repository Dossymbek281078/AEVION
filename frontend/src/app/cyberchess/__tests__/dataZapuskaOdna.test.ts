import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CHESS_LAUNCH_UTC, CHESS_LAUNCH_HUMAN } from "../launchDate";

/**
 * Дата запуска стояла литералом в трёх файлах, и один отстал на месяц:
 * страница запуска считала от 30 СЕНТЯБРЯ (верно — основатель перенёс
 * запуск 29.08), главная страница модуля — от 30 августа.
 *
 * Следствие тихое и дорогое: блок «Написать вам, когда откроются турниры?»
 * скрывается ПОСЛЕ дня запуска. С 31 августа он исчез с главной — за месяц
 * до срока. Весь сентябрь, пока идёт тестовая версия, модуль не собирал бы
 * адреса и не показывал бы при этом никакой ошибки.
 */

const КОРЕНЬ = join(__dirname, "..");

function всеФайлы(каталог: string, накоплено: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    if (имя === "__tests__" || имя === "node_modules") continue;
    const п = join(каталог, имя);
    if (statSync(п).isDirectory()) всеФайлы(п, накоплено);
    else if (/\.tsx?$/.test(имя) && имя !== "launchDate.ts") накоплено.push(п);
  }
  return накоплено;
}

describe("дата запуска шахмат", () => {
  it("нигде в модуле нет своего литерала даты", () => {
    const файлы = всеФайлы(КОРЕНЬ);
    // контроль охвата: обход дошёл до реальных файлов, а не до пустоты
    expect(файлы.length).toBeGreaterThan(30);
    const свои = файлы.filter((ф) => /Date\.UTC\(\s*2026\s*,/.test(readFileSync(ф, "utf8")))
      .map((ф) => ф.slice(КОРЕНЬ.length + 1));
    expect(свои).toEqual([]);
  });

  it("константа указывает на 30 сентября 2026, а не на август", () => {
    const d = new Date(CHESS_LAUNCH_UTC);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(8); // месяцы с нуля: 8 = сентябрь
    expect(d.getUTCDate()).toBe(30);
  });

  it("подпись словами совпадает с числом", () => {
    // Иначе экран скажет «30 сентября», а считать будет от другого дня.
    const d = new Date(CHESS_LAUNCH_UTC);
    const месяцы = ["января","февраля","марта","апреля","мая","июня",
                    "июля","августа","сентября","октября","ноября","декабря"];
    expect(CHESS_LAUNCH_HUMAN).toBe(`${d.getUTCDate()} ${месяцы[d.getUTCMonth()]}`);
  });
});
