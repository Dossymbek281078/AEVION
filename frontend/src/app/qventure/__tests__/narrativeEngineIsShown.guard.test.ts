import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Человек видит, чем сделан разбор: живой моделью или запасным движком.
 *
 * У QVenture есть честный запасной путь: без ключа провайдера совет из четырёх
 * ролей собирается детерминированно из собственной рубрики. Это правильное
 * поведение — модуль не падает и выдаёт содержательный результат.
 *
 * Но безопасная подстановка безопасна ТОЛЬКО пока она называет себя. Витрина
 * обещает «4-role advice panel»; если страница перестанет показывать, что
 * разбор собран без модели, детерминированный текст будет выдан за работу
 * совета — и никто не заметит, потому что он выглядит осмысленно.
 *
 * Обратная сторона уже закреплена в бэкенде (tests/qventureCouncilOffline:
 * без ключа aiUsed=false, aiProvider="stub"). Здесь закрепляется вторая
 * половина — что эта пометка ДОХОДИТ ДО ЭКРАНА. Поле, которое никто не
 * рисует, снаружи неотличимо от отсутствующего.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const RESULT = path.resolve(HERE, "..", "_result.tsx");
const SRC = fs.readFileSync(RESULT, "utf8");

const NL = String.fromCharCode(10);
function withoutComments(src: string): string {
  return src.split(NL).filter((l) => !l.trim().startsWith("//")).join(NL);
}

describe("источник разбора виден человеку", () => {
  it("контроль: файл прочитан и это он", () => {
    expect(SRC.length, "разметка разбора не прочитана").toBeGreaterThan(5000);
    expect(SRC, "читается не тот файл").toContain("council");
  });

  it("на экране написано, чем собран разбор", () => {
    expect(
      withoutComments(SRC),
      "со страницы пропала строка про движок разбора: детерминированный текст " +
        "будет выдан за работу совета из четырёх ролей, которую обещает витрина",
    ).toContain("Narrative engine");
  });

  it("надпись ЗАВИСИТ от aiUsed, а не написана всегда одинаково", () => {
    // Главная проверка. Строка «live model» на месте, но не привязанная к
    // флагу, — это не пометка, а украшение: она соврёт ровно в тот день,
    // когда провайдер отвалится и разбор соберётся без модели.
    const at = withoutComments(SRC).indexOf("Narrative engine");
    const line = withoutComments(SRC).slice(at, at + 260);
    expect(
      line,
      "надпись про движок не смотрит на council.aiUsed — значит покажет одно и " +
        "то же и с моделью, и без неё",
    ).toContain("aiUsed");
  });

  it("у обеих веток есть свой текст", () => {
    const at = withoutComments(SRC).indexOf("Narrative engine");
    const line = withoutComments(SRC).slice(at, at + 260);
    // Тернарный оператор с пустой второй веткой означал бы, что при отказе
    // модели человеку не сказано ничего.
    expect(line, "нет ветки для случая с живой моделью").toMatch(/live model/i);
    const q = String.fromCharCode(58);
    expect(line.includes(q), "у надписи нет второй ветки — при отказе модели экран промолчит").toBe(true);
  });
});
