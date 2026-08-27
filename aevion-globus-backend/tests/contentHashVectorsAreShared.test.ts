// Две реализации одного правила — и до 27.08.2026 ничто не следило, чтобы они
// не разошлись.
//
// В шапке frontend/src/lib/canonicalContentHash.ts написано прямым текстом:
// «MUST stay byte-for-byte identical with contentHash.ts — any drift between
// the two implementations breaks every co-sign». Правило было, сторожа не было.
// Дублирование тут не небрежность: офлайн-проверка обязана быть НЕЗАВИСИМОЙ
// реализацией, иначе она ничего не доказывает. Значит расхождение возможно и
// проявится не падением, а неверным вердиктом у покупателя.
//
// Общий файл эталонов лежит в shared/crypto/contentHashVectors.json. Этот
// набор проверяет его со стороны сервера; frontend/src/lib/__tests__/
// contentHashVectorsMatch.test.ts — со стороны браузера. Разойдётся любая из
// двух реализаций — покраснеет её сторона.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  canonicalContentHash,
  legacyContentHashV1,
  type ContentHashInput,
} from "../src/lib/contentHash";

type Vector = {
  note: string;
  input: ContentHashInput;
  v2: string;
  v1: string;
};

const VECTORS_PATH = path.resolve(
  __dirname,
  "../../shared/crypto/contentHashVectors.json",
);

function vectors(): Vector[] {
  // Читаем без try/catch намеренно: пропавший файл эталонов обязан ронять
  // прогон громко. Молчаливый пустой список сделал бы весь набор зелёным.
  return JSON.parse(readFileSync(VECTORS_PATH, "utf8")).vectors as Vector[];
}

describe("эталоны хеша общие для сервера и браузера", () => {
  it("контроль: файл эталонов прочитан и он не пустой", () => {
    const v = vectors();
    expect(Array.isArray(v)).toBe(true);
    expect(v.length).toBeGreaterThan(4);
    // Каждый эталон обязан нести оба правила — иначе одна из осей молча
    // осталась бы без охраны.
    for (const x of v) {
      expect(x.v2, x.note).toMatch(/^[0-9a-f]{64}$/);
      expect(x.v1, x.note).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("правила v1 и v2 в эталонах различаются на каждом входе", () => {
    // Если бы совпали, эталон не отличал бы одну реализацию от другой.
    for (const x of vectors()) expect(x.v1, x.note).not.toBe(x.v2);
  });

  it.each(vectors().map((v) => [v.note, v] as const))(
    "%s — сервер даёт ровно то, что записано в эталоне",
    (_note, v) => {
      expect(canonicalContentHash(v.input)).toBe(v.v2);
      expect(legacyContentHashV1(v.input)).toBe(v.v1);
    },
  );
});
