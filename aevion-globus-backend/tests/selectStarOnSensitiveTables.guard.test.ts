import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `SELECT *` запрещён для таблиц, у которых есть чувствительная колонка.
 *
 * ЗАЧЕМ. 28.07 в ручке `GET /api/planet/artifacts/:id/public` — публичной,
 * без аутентификации — стояло `SELECT * FROM "PlanetCertificate"`, и вся строка
 * уходила в ответ: `ownerId` плюс колонка `privatePayloadJson`, название которой
 * прямо говорит, что наружу ей нельзя. Внутри неё лежит `signaturePayload` —
 * точные байты, по которым считается подпись сертификата. Фронтенд на странице
 * артефакта при пустом `publicPayloadJson` печатал всю строку на экран
 * (`JSON.stringify(cert.publicPayloadJson || cert)`).
 *
 * Соседний `/certificates/:certId/embed` делает правильно и объясняет это в
 * комментарии («drops the privatePayloadJson, evidence, and signature
 * internals»). То есть правило в коде уже существовало — просто применялось в
 * одном месте из двух. Ровно тот же день дал вторую утечку той же формы в
 * мультичате (снятие несуществующего поля `usage`), поэтому проверка нужна
 * механическая, а не «помнить об этом».
 *
 * Опасность звёздочки не в сегодняшних колонках, а в завтрашних: она отдаёт и
 * те, которых на момент написания запроса не было. Поэтому список чувствительных
 * таблиц не зашит, а ВЫЧИСЛЯЕТСЯ из `CREATE TABLE` — добавят колонку с секретом,
 * и таблица попадёт под правило сама.
 */

const SRC = join(__dirname, "..", "src");

/** Колонка, которой не место в ответе по умолчанию. */
const SENSITIVE_COLUMN =
  /"?\w*(private|secret|password|passwd|apiKey|accessToken|refreshToken)\w*"?\s+(TEXT|JSONB|VARCHAR|BYTEA)/i;

/**
 * Осознанные исключения — с причиной. Без причины исключение ничем не
 * отличается от бага.
 */
const ALLOWED: Array<{ file: string; table: string; reason: string }> = [
  {
    file: "lib/qsignV2/keyRegistry.ts",
    table: "QSignKey",
    reason:
      "реестр ключей — единственный, кому secretRef и нужен: он по нему резолвит ключ. Наружу по HTTP не отдаётся, ручка /health публикует только kid",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/** Таблицы с чувствительными колонками — читаются из объявлений схемы. */
export function sensitiveTables(files: string[]): { tables: Map<string, string[]>; scanned: number } {
  const tables = new Map<string, string[]>();
  let scanned = 0;
  for (const file of files) {
    scanned++;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS "?(\w+)"?\s*\(([\s\S]*?)\n\s*\);/g)) {
      const [, name, body] = m;
      const hits = body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => SENSITIVE_COLUMN.test(l));
      if (hits.length) tables.set(name, [...(tables.get(name) ?? []), ...hits]);
    }
  }
  return { tables, scanned };
}

export function findStarSelects(
  files: string[],
  tables: Iterable<string>,
): { violations: string[]; scanned: number } {
  const violations: string[] = [];
  const names = [...tables];
  let scanned = 0;
  for (const file of files) {
    scanned++;
    const src = readFileSync(file, "utf8");
    const rel = file.slice(SRC.length + 1).replace(/\\/g, "/");
    for (const table of names) {
      const re = new RegExp(`SELECT\\s+\\*\\s+FROM\\s+"?${table}"?`, "gi");
      for (const m of src.matchAll(re)) {
        if (ALLOWED.some((a) => a.file === rel && a.table === table)) continue;
        const line = src.slice(0, m.index ?? 0).split("\n").length;
        violations.push(`${rel}:${line}  SELECT * FROM ${table}`);
      }
    }
  }
  return { violations, scanned };
}

describe("SELECT * не применяется к таблицам с чувствительными колонками", () => {
  const files = walk(SRC);

  it("схема вообще разобрана — иначе проверка молча пуста", () => {
    const { tables, scanned } = sensitiveTables(files);
    expect(scanned).toBeGreaterThan(100);
    // Порог по факту (на 28.07 таких таблиц 11), но проверяем и поимённо:
    // регулярка по колонкам могла перестать совпадать, и тогда список опустеет,
    // а проверка ниже станет тавтологией «ноль нарушений среди нуля таблиц».
    expect(tables.size).toBeGreaterThan(5);
    expect([...tables.keys()]).toContain("PlanetCertificate");
    expect([...tables.keys()]).toContain("AEVIONUser");
  });

  it("ни одна такая таблица не читается звёздочкой", () => {
    const { tables } = sensitiveTables(files);
    const { violations, scanned } = findStarSelects(files, tables.keys());
    expect(scanned, "обход оборвался — прочитано слишком мало файлов").toBeGreaterThan(100);
    expect(
      violations,
      `Эти запросы отдают ВСЕ колонки таблицы, включая чувствительные:\n  ${violations.join("\n  ")}\n\n` +
        "Перечислите колонки явно. Если звёздочка нужна по делу — впишите в " +
        "ALLOWED в этом файле С ПРИЧИНОЙ. Опасность не в сегодняшних колонках, " +
        "а в тех, что добавят завтра: звёздочка подхватит их молча.",
    ).toEqual([]);
  });

  it("у каждого исключения есть внятная причина", () => {
    for (const a of ALLOWED) {
      expect(a.reason.length, `у исключения ${a.file}/${a.table} нет причины`).toBeGreaterThan(30);
    }
  });

  it("сторож действительно ловит нарушение (негативная проверка)", () => {
    // Иначе проверка выше могла бы быть зелёной по любой причине — например,
    // из-за нерабочей регулярки поиска запросов.
    const tmp = join(__dirname, "__fixtures_selectstar.ts");
    const { writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    writeFileSync(tmp, `const q = \`SELECT * FROM "PlanetCertificate" WHERE "id"=$1\`;\n`, "utf8");
    try {
      const { violations } = findStarSelects([tmp], ["PlanetCertificate"]);
      expect(violations).toHaveLength(1);
    } finally {
      rmSync(tmp, { force: true });
    }
  });
});
