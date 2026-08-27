// Браузерная реализация хеша обязана давать те же значения, что серверная.
//
// В шапке canonicalContentHash.ts это написано прямым текстом — «MUST stay
// byte-for-byte identical» — и до 27.08.2026 ничто этого не проверяло. У файла
// вообще не было ни одного теста, при том что расхождение здесь ломает КАЖДУЮ
// соподпись автора: браузер подписывает свой хеш, сервер сверяет свой.
//
// Дублирование тут по замыслу: офлайн-проверка обязана быть независимой, иначе
// она ничего не доказывает. Поэтому сторож не «общий код», а общий ФАЙЛ
// ЭТАЛОНОВ — shared/crypto/contentHashVectors.json, сгенерированный сервером.
// Разойдётся любая из двух реализаций — покраснеет её сторона.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { canonicalContentHash } from "../canonicalContentHash";

type Vector = {
  note: string;
  input: {
    title: string;
    description: string;
    kind: string;
    country?: string | null;
    city?: string | null;
  };
  v2: string;
  v1: string;
};

// Читаем без try/catch намеренно: пропавший файл эталонов обязан ронять прогон
// громко. Молчаливый пустой список сделал бы весь набор зелёным.
const VECTORS: Vector[] = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../../../shared/crypto/contentHashVectors.json"),
    "utf8",
  ),
).vectors;

/** Правило v1 в том виде, в каком его считает офлайн-проверка пакета. */
async function browserLegacyV1(input: Vector["input"]): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({
        title: input.title,
        description: input.description,
        kind: input.kind,
      }),
    ),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("браузерный хеш совпадает с серверным эталоном", () => {
  it("контроль: эталоны прочитаны и их достаточно", () => {
    expect(VECTORS.length).toBeGreaterThan(4);
    for (const v of VECTORS) expect(v.v2, v.note).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(VECTORS.map((v) => [v.note, v] as const))(
    "%s — нынешнее правило совпадает",
    async (_note, v) => {
      expect(await canonicalContentHash(v.input)).toBe(v.v2);
    },
  );

  it.each(VECTORS.map((v) => [v.note, v] as const))(
    "%s — прежнее правило совпадает",
    async (_note, v) => {
      expect(await browserLegacyV1(v.input)).toBe(v.v1);
    },
  );

  it("подделка входа не совпадает с эталоном — сверка не вырождена", () => {
    // Отрицательный контроль: без него весь набор мог бы проходить на
    // реализации, которая возвращает записанное значение вместо расчёта.
    const v = VECTORS[0];
    return expect(
      canonicalContentHash({ ...v.input, title: v.input.title + "!" }),
    ).resolves.not.toBe(v.v2);
  });
});
