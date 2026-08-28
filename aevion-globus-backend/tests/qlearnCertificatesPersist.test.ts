import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сертификат обязан пережить перезапуск и не менять номер.
 *
 * Замер 19.08.2026, до правки:
 *
 *   · таблицы "QLearnCertificate" НЕ БЫЛО ВООБЩЕ — сертификаты жили в Map;
 *   · после выкатки GET /me/certificates отдавал пустой список,
 *     GET /enrollments/:id/certificate — 404 у человека, прошедшего курс;
 *   · повторное завершение выдавало НОВЫЙ номер и ставило датой окончания
 *     СЕГОДНЯШНИЙ день вместо настоящего;
 *   · каждый такой раз в QRight уходила ещё одна регистрация того же
 *     достижения;
 *   · ответ содержал qrightRegistered: true, а регистрация запускалась через
 *     void без ожидания — успех объявлялся до того, как стал известен.
 *
 * Модуль продаётся за $15/мес и входит в тарифы Medium и Full. Выкаток бэкенда
 * за сутки бывает шесть.
 */

const ROUTE = readFileSync(join(__dirname, "..", "src", "routes", "qlearn.ts"), "utf8");
const TABLES = readFileSync(join(__dirname, "..", "src", "lib", "ensureQLearnTables.ts"), "utf8");

describe("сертификаты QLearn переживают перезапуск", () => {
  test("контроль: оба файла прочитаны", () => {
    expect(ROUTE.length).toBeGreaterThan(1000);
    expect(TABLES.length).toBeGreaterThan(500);
  });

  test("таблица сертификатов создаётся", () => {
    expect(TABLES, "таблицы сертификатов снова нет — они живут только в памяти")
      .toMatch(/CREATE TABLE IF NOT EXISTS "QLearnCertificate"/);
  });

  test("на одно зачисление — один сертификат", () => {
    // UNIQUE + ON CONFLICT DO NOTHING: повторный вызов возвращает существующий,
    // а не выдаёт второй с новым номером и сегодняшней датой.
    expect(TABLES, "нет уникальности по enrollmentId — появится второй сертификат")
      .toMatch(/"enrollmentId"\s+TEXT NOT NULL UNIQUE/);
    expect(ROUTE, "нет защиты от повторной выдачи").toMatch(/ON CONFLICT \("enrollmentId"\) DO NOTHING/);
  });

  test("в реестр QRight — только при ПЕРВОЙ выдаче", () => {
    // Иначе там копится по записи на каждую выкатку, все про одно достижение.
    expect(ROUTE).toMatch(/if \(created\) void registerCertificateInQRight/);
  });

  test("успех регистрации больше не объявляется наперёд", () => {
    expect(ROUTE, "снова утверждаем qrightRegistered: true, не дождавшись регистрации")
      .not.toMatch(/qrightRegistered:\s*true/);
  });

  test("чтения идут через слой, а не прямо в память", () => {
    // Вне слоя обращений к memCertificates быть не должно: иначе после выкатки
    // список снова окажется пустым при живых данных в базе.
    //
    // Граница слоя — НЕ номер строки, а СМЫСЛ: хранилище кончается там, где
    // начинаются маршруты. Прежняя версия сверялась с числом 230, и любая
    // вставка выше молча делала сторожа красным — случилось 23.08.2026:
    // четыре добавленные вверху строки увели certsByUser с 226-й на 238-ю.
    const lines = ROUTE.split("\n");
    const firstRoute = lines.findIndex((l) => l.trimStart().startsWith("qlearnRouter."));
    expect(firstRoute, "не нашёл ни одного маршрута — граница слоя не определена").toBeGreaterThan(0);
    const outside = lines
      .map((l, i) => ({ l: l.trim(), n: i + 1 }))
      .filter(({ l }) => /memCertificates\b/.test(l))
      .filter(({ l }) => !l.startsWith("//") && !l.startsWith("*"))
      .filter(({ n }) => n > firstRoute);
    expect(outside.map((x) => `${x.n}: ${x.l}`), "прямое обращение к памяти вне слоя хранилища").toEqual([]);
  });
});
