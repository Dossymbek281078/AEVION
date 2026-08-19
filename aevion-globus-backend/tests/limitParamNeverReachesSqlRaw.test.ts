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

// ДОПОЛНЕНО 19.08 (вечер, второе окно). Первая версия сторожа искала ОДНУ
// форму записи — `Math.min(Number(req.query.limit) ...)`. А `limit` часто
// сперва разбирают из объекта:
//
//   const { category, limit } = req.query;
//   const limitN = Math.min(Number(limit) || 20, 100);   // <- та же дыра
//
// Из-за этого свип пропустил три ручки, и нашлись они не им, а ЖУРНАЛОМ ОШИБОК
// прода: «LIMIT must not be negative» x4 за неделю, и он же назвал адреса —
// /api/qevents/events и /api/qjobs/jobs. Проверено пробой: ?limit=-5 -> 500.
// Урок: свип по одной форме записи даёт ложное «чисто» по всей платформе.

describe("limit из запроса зажат до похода в SQL", () => {
  for (const f of [
    "deepsan.ts", "qpersona.ts", "qevents.ts", "qjobs.ts", "qnews.ts",
    // добавлены 19.08 (второе окно) по журналу ошибок прода за 90 дней:
    // «LIMIT must not be negative» с местом GET /api/qlife/biomarkers.
    // qlife БЫЛ в моём списке кандидатов — я отверг его, пробнув выдуманный
    // адрес /api/qlife/entries, получив 404 и приняв это за «дефекта нет».
    // 404 от выдуманного пути значит «не смог проверить», а не «чисто».
    "qlife.ts", "qlearn.ts", "build/messaging.ts",
  ]) {
    test(`${f}: нет Math.min(Number(req.query...)) без нижней границы`, () => {
      const code = read(f);
      const unsafe = [...code.matchAll(/Math\.min\(\s*Number\(\s*req\.query\.limit/g)];
      expect(unsafe.length).toBe(0);
    });

    test(`${f}: нет второй формы — Math.min(Number(limit) || N, M)`, () => {
      // разобранный из объекта `limit` — та же дыра, другое написание
      expect(read(f)).not.toMatch(/Math\.min\(\s*Number\(\s*limit\s*\)/);
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

describe("qlife не рассказывает клиенту о своём хранилище", () => {
  test("ни одна ручка не отдаёт e.message наружу", () => {
    // Проверено на проде 19.08: `?limit=-5` возвращал дословное
    // «LIMIT must not be negative» — ручка МЕДИЦИНСКИХ показателей описывала
    // своё хранилище постороннему. В таких сообщениях бывают хост, порт и
    // пользователь базы. Наружу — категория, подробность в журнал.
    const src = read("qlife.ts");
    expect(src).not.toMatch(/error:\s*e\?\.message/);
    expect(src).not.toMatch(/error:\s*err\?\.message/);
  });
});
