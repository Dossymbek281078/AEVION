import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

/**
 * 🔴 ФАЙЛЫ CI ОБЯЗАНЫ РАЗБИРАТЬСЯ — ИНАЧЕ ВОРОТА МЕРТВЫ, А ВЫГЛЯДЯТ КРАСНЫМИ.
 *
 * Замер 12.10.2026. Шесть последних прогонов «DevHub E2E (browser)» упали — на
 * шести РАЗНЫХ ветках разных окон. GitHub писал причину прямо: «This run likely
 * failed because of a workflow file issue». В `devhub-e2e.yml` под `push:`
 * стояло ТРИ ключа `paths:` — один рабочий и два пустых. Повторяющиеся ключи
 * делают файл недопустимым, и GitHub заваливал прогон ДО запуска тестов.
 *
 * Дубликаты лежали там с 28.08.2026 — шесть недель. Всё это время браузерные
 * ворота DevHub не отработали НИ РАЗУ, а в почту шли «красные CI», которые
 * читались как упавшие тесты. Красная проверка, которая на самом деле не
 * запускалась, хуже отсутствующей: на неё перестают смотреть.
 *
 * ⚠️ И про прибор. Первый свип я написал руками, сравнивая отступы и имена
 * ключей, — он объявил сломанными 13 файлов из 13, считая дубликатами `run:`
 * разных шагов списка. Машина ложных срабатываний. Настоящий разборщик YAML с
 * `uniqueKeys` дал 1 из 13. Поэтому здесь парсер, а не свой разбор текста.
 */
const КАТАЛОГ = join(process.cwd(), "..", ".github", "workflows");

function файлы(): string[] {
  if (!existsSync(КАТАЛОГ)) return [];
  return readdirSync(КАТАЛОГ).filter((f) => /\.ya?ml$/.test(f));
}

function проблемы(текст: string): string[] {
  const док = YAML.parseDocument(текст, { uniqueKeys: true });
  return [...док.errors, ...док.warnings].map((e) => e.message);
}

describe("файлы CI разбираются", () => {
  it("🔴 каждый workflow — допустимый YAML без повторяющихся ключей", () => {
    const список = файлы();
    expect(список.length, "ни одного файла CI не найдено — прибор смотрит не туда").toBeGreaterThan(5);
    const сломанные: string[] = [];
    for (const f of список) {
      const п = проблемы(readFileSync(join(КАТАЛОГ, f), "utf8"));
      if (п.length) сломанные.push(`${f}: ${п[0].split("\n")[0]}`);
    }
    expect(сломанные, `сломанных файлов ${сломанные.length} из ${список.length}`).toEqual([]);
  });

  it("🔴 контроль прибора: ровно ту поломку он ловит", () => {
    // Без этого «ноль сломанных» мог бы означать «парсер ничего не проверяет».
    const было = `on:
  push:
    branches: [main]
    paths: ["a"]
    paths:
`;
    expect(проблемы(было).length, "повторяющийся ключ НЕ пойман — проверка пустая").toBeGreaterThan(0);
    expect(проблемы(было)[0]).toContain("unique");
    // И обратная сторона: исправный файл проблем не даёт.
    expect(проблемы(`on:\n  push:\n    branches: [main]\n`)).toEqual([]);
  });

  it("у ворот DevHub оба события сторожат ОДИН набор путей", () => {
    // Якорь `&gate_paths` ради этого и заведён: разойдись они — PR проверялся
    // бы по одному списку, а push в main по другому.
    const док = YAML.parseDocument(readFileSync(join(КАТАЛОГ, "devhub-e2e.yml"), "utf8"), { uniqueKeys: true });
    const j = док.toJS() as { on?: { push?: { paths?: string[] }; pull_request?: { paths?: string[] } } };
    const push = j.on?.push?.paths ?? [];
    const pr = j.on?.pull_request?.paths ?? [];
    expect(push.length, "у push нет списка путей").toBeGreaterThan(5);
    expect(push, "списки путей разошлись").toEqual(pr);
  });
});
