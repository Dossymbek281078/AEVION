import { describe, expect, test } from "vitest";
import { ссылкаВхода } from "../loginHref";
import { адресВозврата } from "../returnTo";

/**
 * 30.10.2026: ссылки «Войти» с /qright и /bureau обязаны нести `next` (его читает
 * returnTo.ts) и не терять метку канала. Проверка — круговая: то, что положили в
 * ссылку, страница входа обязана прочитать и вернуть человека ТУДА ЖЕ.
 */
describe("ссылкаВхода: вход с возвратом и меткой канала", () => {
  test("без канала — голый next, страница входа читает его как /bureau", () => {
    const href = ссылкаВхода("/bureau");
    expect(href).toBe("/auth?next=%2Fbureau");
    expect(адресВозврата(href.slice(href.indexOf("?")))).toBe("/bureau");
  });

  test("с меткой поста — метка едет и внутрь next, и в сам /auth", () => {
    // channelNow() отдаёт ИМЯ канала («youtube»), в адресе — короткий ключ («yt») с постом.
    const href = ссылкаВхода("/bureau", "youtube", "yt-chess-level");
    const query = href.slice(href.indexOf("?"));
    expect(new URLSearchParams(query).get("c")).toBe("yt-chess-level");
    expect(адресВозврата(query)).toBe("/bureau?c=yt-chess-level");
  });

  test("канал без поста — канонический ключ, не выдуманная метка", () => {
    const href = ссылкаВхода("/qright", "instagram", null);
    expect(адресВозврата(href.slice(href.indexOf("?")))).toBe("/qright?c=ig");
  });

  test("наша проба (probe-*) не теряется — иначе второй просмотр записался бы живым человеком", () => {
    const href = ссылкаВхода("/bureau", null, "probe-product");
    expect(адресВозврата(href.slice(href.indexOf("?")))).toBe("/bureau?c=probe-product");
  });
});
