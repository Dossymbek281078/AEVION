import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * Решение «этот запрос от администратора?» существует в ОДНОМ месте.
 *
 * Замер 30.08.2026: копий было ДВЕ — `constitutionFunnel` и
 * `constitutionAdmin`, — и они возвращали РАЗНОЕ: одна `boolean`, другая
 * `{ ok, reason, email }`. Логика совпадала построчно, но это совпадение
 * держалось на внимательности: разойдись они, разошлись бы в ту сторону, где
 * кто-то ослабил условие ради своего случая, и заметить это было бы нечем.
 *
 * Сведено в `lib/adminAuth.ts`. Сторож нужен не ради красоты: третья копия
 * появляется ровно тогда, когда кто-то выносит общую функцию и заменяет не
 * все вызовы — то есть в момент починки, а не в момент поломки.
 *
 * Признак копии: функция читает токен `verifyBearerOptional` И проверяет
 * `role === "admin"`. Одно без другого — не решение о правах.
 */

const SRC = join(__dirname, "..", "src");
const HOME = "lib/adminAuth.ts";

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (n.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Разделители пути к прямым косым. Регулярку тут НЕ писать: обратный слэш
 *  съедается на границе инструмента, и файл перестаёт разбираться — vitest
 *  говорит «no tests», то есть проверка выглядит прошедшей, не сделав ничего. */
const SEP = String.fromCharCode(92);
function toPosix(p: string): string {
  return p.split(SEP).join("/");
}

const FILES = tsFiles(SRC);
const ROLE_ADMIN = ['role === "admin"', "role === 'admin'"];

/**
 * Модули со СВОЕЙ политикой администратора. Это НЕ копии конституционной
 * проверки: у каждого свой список и свои правила (у наград, например,
 * принимается и "ADMIN", и список берётся из собственной переменной).
 * Сводить их значило бы стереть различие, которое завели намеренно.
 *
 * Список заморожен 30.08.2026. Сторож не доказывает, что каждый пункт
 * оправдан — он не даёт появиться ДЕСЯТОМУ незаметно. Убирать отсюда можно
 * только вместе со сведением, дописывать — только с причиной.
 */
const OWN_POLICY = new Set([
  "src/routes/awards.ts",
  "src/routes/bureau.ts",
  "src/routes/constitutionWaitlist.ts",
  "src/routes/modules.ts",
  "src/routes/pipeline.ts",
  "src/routes/qright.ts",
  "src/routes/qsignV2.ts",
  "src/routes/quantum-shield.ts",
]);

function implementsAdminCheck(src: string): boolean {
  // Комментарии вырезаются: без этого сведённый файл попадал в список из-за
  // фразы «payload.role === "admin"» в шапке — сторож краснел на ПОЧИНКЕ.
  const code = stripComments(src);
  return code.includes("verifyBearerOptional") && ROLE_ADMIN.some((m) => code.includes(m));
}

describe("решение о правах администратора живёт в одном месте", () => {
  test("контроль: файлы прочитаны и дом найден", () => {
    expect(FILES.length, "обход не нашёл исходников — сторож пуст").toBeGreaterThan(100);
    const home = FILES.find((f) => toPosix(f).endsWith(HOME));
    expect(home, `не найден ${HOME} — сведение отменили?`).toBeTruthy();
    expect(
      implementsAdminCheck(readFileSync(home as string, "utf8")),
      "признак не находит реализацию там, где она ТОЧНО есть — подобран неверно",
    ).toBe(true);
  });

  test("копий реализации нет ни в одном другом файле", () => {
    const copies = FILES
      .map((f) => toPosix(f))
      .filter((f) => !f.endsWith(HOME))
      .filter((f) => implementsAdminCheck(readFileSync(f, "utf8")))
      .map((f) => f.slice(f.indexOf("/src/") + 1))
      .filter((f) => !OWN_POLICY.has(f))
      ;
    expect(
      copies,
      "решение о правах продублировано. Копии расходятся молча, и расходятся " +
        `в сторону ослабления: ${copies.join(", ")}. Зовите checkAdmin/isAdminRequest.`,
    ).toEqual([]);
  });
});
