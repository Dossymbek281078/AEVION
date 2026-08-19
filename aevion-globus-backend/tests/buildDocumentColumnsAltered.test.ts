import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Колонки, добавленные в CREATE TABLE позже, живой таблице не достаются.
//
// 20.08.2026: GET /api/build/documents/user/<любой id> отвечал 500 на проде —
// и для выдуманного id, и для служебного слова, то есть падал на самом
// запросе, а не на данных. В коде при этом уже лежала «починка»: колонка
// переименована псевдонимом "reviewedAt" AS "verifiedAt", и по грепу всё
// выглядело сделанным.
//
// Настоящая причина в другом: CREATE TABLE IF NOT EXISTS к УЖЕ существующей
// таблице не добавляет ничего. Боевая таблица заведена до переименования
// "verified*" в "reviewed*", поэтому новых колонок не получила и получить
// не могла.
//
// Почему существующие сторожа это пропускают — и это не их дефект:
// everyQueriedColumnExists сверяет запросы с CREATE TABLE, а расхождение
// здесь между CREATE TABLE и ЖИВОЙ таблицей. Никакой разбор исходника
// такого не увидит; увидеть можно только наличие ALTER.
//
// Образец приёма лежит рядом, у "BuildProfile" в том же файле.

const SRC = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "build", "index.ts"),
  "utf8",
);

// Колонки, которые запрашивают ручки документов и которых могло не быть
// в первой версии таблицы.
const LATE_COLUMNS = ["reviewedAt", "reviewedBy", "reviewNote", "status"];

describe('"BuildDocument" — поздние колонки добавляются через ALTER', () => {
  for (const col of LATE_COLUMNS) {
    test(`"${col}" покрыт ADD COLUMN IF NOT EXISTS`, () => {
      const re = new RegExp(
        'ALTER TABLE "BuildDocument" ADD COLUMN IF NOT EXISTS "' + col + '"',
      );
      expect(SRC).toMatch(re);
    });
  }

  test("приём тот же, что уже применён к соседней таблице", () => {
    // Отрицательный контроль: если у BuildProfile ALTER исчезнет, значит
    // изменился общий подход, и этот тест надо пересматривать, а не чинить.
    expect(SRC).toMatch(/ALTER TABLE "BuildProfile" ADD COLUMN IF NOT EXISTS/);
  });

  test("ALTER стоят ПОСЛЕ создания таблицы", () => {
    const create = SRC.indexOf('CREATE TABLE IF NOT EXISTS "BuildDocument"');
    const alter = SRC.indexOf('ALTER TABLE "BuildDocument" ADD COLUMN IF NOT EXISTS');
    expect(create).toBeGreaterThan(-1);
    expect(alter).toBeGreaterThan(create);
  });
});
