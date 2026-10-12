/*
 * После входа человек возвращается туда, откуда пришёл, — и только на свой сайт.
 * Замер 12.10.2026: 21 ссылка вела на /auth?next=…, страница входа параметр
 * не читала, гость QSign застревал на /auth (returnTo.ts).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { адресВозврата, адресВозвратаИлиОткуда } from "../returnTo";

const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));
const СТРАНИЦА = readFileSync(join(ЗДЕСЬ, "..", "page.tsx"), "utf8");

describe("адрес возврата после входа", () => {
  it("свой путь возвращается как есть (next и redirect)", () => {
    expect(адресВозврата("?next=/qsign")).toBe("/qsign");
    expect(адресВозврата("?next=%2Fbureau%2Fupgrade%2Fcert-1%3Fc%3Dig")).toBe("/bureau/upgrade/cert-1?c=ig");
    expect(адресВозврата("?redirect=/devhub")).toBe("/devhub");
  });

  it("чужой сайт и обходы — отказ (открытый редирект)", () => {
    for (const плохо of [
      "?next=https://evil.com",
      "?next=//evil.com",
      "?next=%2F%5Cevil.com",
      "?next=%2F%09%2Fevil.com",
      "?next=javascript:alert(1)",
      "?next=evil.com",
      "?next=",
      "",
    ]) {
      expect(адресВозврата(плохо), плохо).toBeNull();
    }
  });

  it("на саму страницу входа не возвращаем", () => {
    expect(адресВозврата("?next=/auth")).toBeNull();
    expect(адресВозврата("?next=/auth?next=/qsign")).toBeNull();
  });

  it("и вход, и регистрация зовут возврат после успеха", () => {
    const вызовов = СТРАНИЦА.split("вернутьТуда();").length - 1;
    expect(вызовов, "возврат должен стоять в signIn И в register").toBe(2);
    expect(СТРАНИЦА).toMatch(/адресВозвратаИлиОткуда\(window\.location\.search, document\.referrer, window\.location\.origin\)/);
  });

  it("QSign отправляет на вход с обратным адресом", () => {
    const qsign = readFileSync(join(ЗДЕСЬ, "..", "..", "qsign", "page.tsx"), "utf8");
    expect(qsign).toContain('href="/auth?next=/qsign"');
    expect(qsign).not.toMatch(/href="\/auth"/);
  });

  it("без next — назад на страницу нашего сайта, откуда пришли", () => {
    const O = "https://aevion.app";
    expect(адресВозвратаИлиОткуда("", "https://aevion.app/lifebox?c=ig", O)).toBe("/lifebox?c=ig");
    expect(адресВозвратаИлиОткуда("?next=/qsign", "https://aevion.app/lifebox", O)).toBe("/qsign");
  });

  it("КОНТРОЛЬ: чужой сайт, пустой referrer и сама /auth — никуда не ведём", () => {
    const O = "https://aevion.app";
    expect(адресВозвратаИлиОткуда("", "https://evil.com/aevion.app", O)).toBeNull();
    expect(адресВозвратаИлиОткуда("", "", O)).toBeNull();
    expect(адресВозвратаИлиОткуда("", "https://aevion.app/auth", O)).toBeNull();
    expect(адресВозвратаИлиОткуда("", "не адрес", O)).toBeNull();
  });
});
