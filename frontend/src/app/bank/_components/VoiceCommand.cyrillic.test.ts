import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Русские голосовые команды банка обязаны распознаваться.
 *
 * Повод — измеренный дефект: шаблон был `/\b(balance|баланс|әмиян)\b/`, а
 * `\b` в JavaScript это граница класса `[A-Za-z0-9_]`, куда кириллица не
 * входит. Поэтому «баланс» и «әмиян» не совпадали НИКОГДА, а «balance»
 * работал — оттого дефект и жил незамеченным: проверяли по-английски.
 *
 * Тест намеренно читает ИСХОДНИК, а не вызывает parse(): функция не
 * экспортируется, а поднимать весь компонент ради одной регулярки дороже,
 * чем проверить сам шаблон. Проверяется при этом ПОВЕДЕНИЕ — шаблон
 * применяется к настоящим словам.
 */

const FILE = path.join(__dirname, "VoiceCommand.tsx");

/** Достаёт регулярку распознавания баланса из исходника. */
function balancePattern(): RegExp {
  const src = readFileSync(FILE, "utf8");
  // строка вида: if (/(...)/.test(t)) { ... kind: "balance"
  const m = /if \(\/([^/\n]+)\/\.test\(t\)\) \{\s*\n\s*return \{ kind: "balance"/.exec(src);
  expect(m, "не найден шаблон распознавания баланса в VoiceCommand.tsx").not.toBeNull();
  return new RegExp(m![1], "i");
}

describe("голосовая команда «баланс» в банке", () => {
  const re = balancePattern();

  it("распознаёт русское слово", () => {
    expect(re.test("баланс"), "«баланс» не распознан").toBe(true);
    expect(re.test("покажи баланс"), "«покажи баланс» не распознан").toBe(true);
  });

  it("распознаёт казахское слово", () => {
    expect(re.test("әмиян"), "«әмиян» не распознан").toBe(true);
  });

  it("по-прежнему распознаёт английское", () => {
    expect(re.test("balance"), "«balance» перестал распознаваться").toBe(true);
    expect(re.test("show my balance")).toBe(true);
  });

  it("не срабатывает на постороннем — иначе распознавал бы что угодно", () => {
    expect(re.test("переведи деньги")).toBe(false);
    expect(re.test("open settings")).toBe(false);
  });

  it("в шаблоне нет \\b — с кириллицей он мёртв", () => {
    const src = readFileSync(FILE, "utf8");
    const line = src.split("\n").find((l) => /kind: "balance"/.test(l) === false && /\.test\(t\)\) \{/.test(l) && /баланс/.test(l));
    expect(line, "строка с распознаванием баланса не найдена").toBeTruthy();
    expect(/\\b/.test(line!), "вернулась граница слова — русские команды снова умрут").toBe(false);
  });

  it("контроль прибора: ловушка действительно не работает", () => {
    // без этого «шаблон верный» неотличимо от «проверка ничего не проверяет»
    expect(/\b(balance|баланс)\b/i.test("баланс")).toBe(false);
    expect(/\b(balance|баланс)\b/i.test("balance")).toBe(true);
  });
});
