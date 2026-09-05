import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Клиентская половина той же починки: страница задачи дня решала, «из банка»
 * ли задача, по ПОДСТРОКЕ «банк» в тексте источника. Строка отказа
 * «резервный пул из 30 задач: банк не ответил» это слово содержит, поэтому
 * экран уверенно говорил обратное тому, что сказал сервер.
 */

const КОД = () => bezKommentariev(
  readFileSync(join(__dirname, "..", "daily", "page.tsx"), "utf8"));

describe("страница задачи дня", () => {
  it("не решает по подстроке", () => {
    expect(КОД()).not.toContain("includes('банк')");
    expect(КОД()).not.toContain('includes("банк")');
  });

  it("читает машинный признак сервера", () => {
    expect(КОД()).toContain("typeof j?.fromBank === 'boolean'");
  });

  it("запасной разбор — ТОЧНОЕ сравнение, а не вхождение", () => {
    // сервер прежней версии не отдаёт признак; сравниваем строку целиком,
    // иначе вернётся тот же дефект в другом виде
    expect(КОД()).toContain("j?.source === 'ChessPuzzle — настоящий банк задач'");
  });
});
