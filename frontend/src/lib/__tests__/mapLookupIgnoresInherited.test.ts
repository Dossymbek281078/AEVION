import { describe, test, expect } from "vitest";
import { изСправочника } from "../mapLookup";

const СПРАВОЧНИК: Record<string, string> = { paybox: "PayBox", gumroad: "Gumroad" };

describe("поиск по справочнику берёт только свои ключи", () => {
  test("контроль: свой ключ находится", () => {
    // Иначе «наследственное не проходит» могло бы означать «не находит ничего».
    expect(изСправочника(СПРАВОЧНИК, "paybox")).toBe("PayBox");
    expect(изСправочника(СПРАВОЧНИК, "gumroad")).toBe("Gumroad");
  });

  test("обычный незнакомый ключ даёт undefined", () => {
    expect(изСправочника(СПРАВОЧНИК, "stripe")).toBeUndefined();
  });

  test.each(["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"])(
    "служебное имя %s не проходит",
    (имя) => {
      const v = изСправочника(СПРАВОЧНИК, имя);
      expect(v, `справочник отдал наследство по ключу ${имя}: ${String(v).slice(0, 40)}`).toBeUndefined();
    },
  );

  test("пустой ключ не ломает и не находит", () => {
    expect(изСправочника(СПРАВОЧНИК, "")).toBeUndefined();
    expect(изСправочника(СПРАВОЧНИК, null)).toBeUndefined();
    expect(изСправочника(СПРАВОЧНИК, undefined)).toBeUndefined();
  });

  test("привычная запись с запасным значением работает как прежде", () => {
    // Ради этого возвращается undefined, а не запасное: строка у вызывающего
    // остаётся той же формы, и смысл при переносе не теряется.
    expect(изСправочника(СПРАВОЧНИК, "constructor") ?? "нет названия").toBe("нет названия");
    expect(изСправочника(СПРАВОЧНИК, "paybox") ?? "нет названия").toBe("PayBox");
  });
});
