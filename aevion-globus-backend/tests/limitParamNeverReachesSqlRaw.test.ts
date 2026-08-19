// limit из запроса не должен доезжать до SQL непроверенным.
//
// Найдено ЗОНДОМ по проду 19.08.2026: обход 409 публичных GET с мусорными
// параметрами дал три ответа с ошибкой, и один из них — наш:
//
//   GET /api/deepsan/tasks            -> 200
//   GET /api/deepsan/tasks?limit=zzz  -> 500 {"error":"database error"}
//   GET /api/deepsan/tasks?limit=-5   -> 500
//   GET /api/qpersona/personas?limit=-5 -> 500
//
// Причина в двух разных идиомах, и они ломаются ПО-РАЗНОМУ:
//   Math.min(Number(q.limit ?? 50), 200)  — ?? не ловит NaN → LIMIT NaN
//   Math.min(Number(q.limit) || 20, 100)  — || ловит NaN, но НЕ минус → LIMIT -5
// Поэтому «здесь стоит || , значит защищено» — неверный вывод; qpersona был
// защищён от zzz и падал на -5.
//
// Почему это не косметика: неверный ВХОД — это 4xx. Пятисотка означает «у нас
// сломалось», летит в Sentry и топит настоящие аварии. Оба случая
// воспроизводились ОДНИМ запросом от любого робота.
//
// Честная граница теста: он читает исходник, а не поднимает СУБД. Он ловит
// возврат прежнего идиома, но не докажет, что новый верен на всех входах —
// это доказано прогоном по проду выше и повторяемо тем же зондом.

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f: string) =>
  readFileSync(path.join(__dirname, "..", "src", "routes", f), "utf8")
    // комментарии вырезаются: они называют ровно тот идиом, что ищет сторож
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("limit из запроса зажат до похода в SQL", () => {
  for (const f of ["deepsan.ts", "qpersona.ts"]) {
    test(`${f}: нет Math.min(Number(req.query...)) без нижней границы`, () => {
      const code = read(f);
      const unsafe = [...code.matchAll(/Math\.min\(\s*Number\(\s*req\.query\.limit/g)];
      expect(unsafe.length).toBe(0);
    });

    test(`${f}: нижняя граница задана явно`, () => {
      const code = read(f);
      expect(code).toMatch(/Math\.max\([^)]*parseInt[\s\S]{0,80}?,\s*1\s*\)/);
    });
  }

  test("предохранитель: сторож действительно читает файлы", () => {
    // иначе пустая строка дала бы 0 совпадений и вечно зелёный тест
    expect(read("deepsan.ts").length).toBeGreaterThan(500);
    expect(read("qpersona.ts").length).toBeGreaterThan(500);
  });
});
