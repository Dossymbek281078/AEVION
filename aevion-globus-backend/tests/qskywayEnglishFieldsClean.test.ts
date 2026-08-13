import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Поля с английской версией текста (`noteEn`, `scopeEn`, `keyNoteEn`,
 * `regimeEn`, `errorEn`, `formatNoteEn`) появились за два дня в шести местах.
 * Ошибка копипаста здесь НЕ падает и ничем не подсвечивается: значение просто
 * остаётся русским, и англоязычный читатель получает кириллицу там, где ему
 * обещан английский.
 *
 * Проверка обходит фактические ответы модуля и требует одного: в поле, чьё имя
 * кончается на `En`, кириллицы нет. Это не проверка качества перевода — это
 * проверка, что перевод вообще положили.
 *
 * Приём переносится на любой модуль платформы: список ручек другой, правило то же.
 *
 * ГРАНИЦА, которую надо знать. Проверка обходит ФАКТИЧЕСКИЕ ответы, значит
 * покрывает только те ветки, до которых обход дошёл. Проверено мутацией: если
 * положить кириллицу в ветку «постоянный ключ» (в тестах ключ всегда временный)
 * или в вердикт «коридор укладывается в потолок» (на пробуемых парах он не
 * возникает), тест останется зелёным. Ловятся ветки достижимые — их
 * большинство, но не все.
 *
 * Отсюда правило при добавлении нового `*En`: убедиться, что ветка, в которой
 * он живёт, реально возникает хотя бы на одном из пробуемых запросов, — иначе
 * поле не под охраной, сколько бы проверок ни стояло рядом.
 */
const app = express().use(express.json()).use("/api/qskyway", qskywayRouter);

const CYRILLIC = /[А-Яа-яЁё]/;

/** Все пары «путь → значение» для ключей, кончающихся на `En`. */
function englishFields(node: unknown, path = "$"): { path: string; value: string }[] {
  if (Array.isArray(node)) return node.flatMap((v, i) => englishFields(v, `${path}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
      const p = `${path}.${k}`;
      if (typeof v === "string" && /En$/.test(k)) return [{ path: p, value: v }];
      return englishFields(v, p);
    });
  }
  return [];
}

describe("англоязычные поля модуля действительно английские", () => {
  test("ни в одном поле *En нет кириллицы", async () => {
    const found: { path: string; value: string }[] = [];

    for (const city of ["astana", "nyc", "tokyo"]) {
      found.push(...englishFields((await request(app).get(`/api/qskyway/city?city=${city}`)).body, `city:${city}`));
      found.push(...englishFields((await request(app).get(`/api/qskyway/height-substitution?city=${city}`)).body, `subst:${city}`));
      const route = await request(app).post("/api/qskyway/route").send({ from: 0, to: 1, city });
      found.push(...englishFields(route.body, `route:${city}`));
      const just = await request(app).post("/api/qskyway/route/justification").send({ from: 0, to: 1, city });
      found.push(...englishFields(just.body, `just:${city}`));
      if (just.body?.document) {
        const ver = await request(app).post("/api/qskyway/route/justification/verify")
          .send({ document: just.body.document, attestation: just.body.attestation });
        found.push(...englishFields(ver.body, `verify:${city}`));
      }
      found.push(...englishFields((await request(app).get(`/api/qskyway/verify?city=${city}`)).body, `sig:${city}`));
    }
    // строгий режим: отказ по потолку тоже несёт английскую версию
    for (let a = 0; a < 7; a++) {
      const strict = await request(app).post("/api/qskyway/route").send({ from: a, to: (a + 3) % 7, city: "nyc", respectCeiling: true });
      found.push(...englishFields(strict.body, `strict:${a}`));
    }

    // Предохранитель: без него «кириллицы нет» верно и на пустом списке.
    expect(found.length, "англоязычных полей не найдено — проверять нечего").toBeGreaterThan(5);

    const dirty = found.filter((f) => CYRILLIC.test(f.value));
    expect(dirty.map((d) => `${d.path}: ${d.value.slice(0, 60)}`), "кириллица в англоязычном поле").toEqual([]);
  });
});
