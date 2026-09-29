import { describe, it, expect, beforeEach } from "vitest";
import { channelFrom, channelFromRef } from "../products";
import { channelNow } from "../channelNow";

/**
 * `?ref=` — ЗАПАСНОЙ ключ канала, и `c` главнее.
 *
 * Повод 29.09.2026, день запуска на Product Hunt: карточка площадки ведёт на
 * /en/devhub?ref=producthunt — параметр ставит САМА площадка, переписать его
 * нельзя. Сайт читал только `?c=`, поэтому все переходы с PH ложились в отчёт
 * как ПРЯМЫЕ заходы: запуск был неизмерим ровно там, где его меряли.
 *
 * Что здесь держится:
 *  1) ref разбирается в тот же канал, что и наша короткая метка;
 *  2) при обоих параметрах побеждает `c` — её ставили под конкретный пост,
 *     а ref говорит только про площадку;
 *  3) неизвестный ref не превращается в канал (и не теряется молча: отличать
 *     «пришёл без метки» от «пришёл с чужой» обязан вызывающий);
 *  4) ref переживает переход внутри вкладки — иначе покупка после перехода
 *     достанется «прямому заходу».
 */

function адрес(search: string, pathname = "/en/devhub") {
  Object.defineProperty(window, "location", {
    value: { search, pathname, href: `https://aevion.app${pathname}${search}` },
    writable: true,
  });
}

beforeEach(() => {
  sessionStorage.clear();
  адрес("");
});

describe("ref как запасной ключ канала", () => {
  it("producthunt разбирается в тот же канал, что и метка ph", () => {
    expect(channelFromRef("producthunt")).toBe(channelFrom("ph"));
    expect(channelFromRef("producthunt")).toBe("product-hunt");
  });

  it("знает площадки, которые метят ссылки сами", () => {
    expect(channelFromRef("news.ycombinator.com")).toBe(channelFrom("hn"));
    expect(channelFromRef("reddit")).toBe(channelFrom("rd"));
    expect(channelFromRef("LinkedIn")).toBe(channelFrom("li"));
    // Площадка может прислать и саму короткую метку — она законна.
    expect(channelFromRef("ph")).toBe("product-hunt");
  });

  it("КОНТРОЛЬ: неизвестное не превращается в канал", () => {
    expect(channelFromRef("zzz-neizvestnaya-ploschadka")).toBeNull();
    expect(channelFromRef(undefined)).toBeNull();
    expect(channelFromRef("")).toBeNull();
  });

  it("КОНТРОЛЬ: унаследованные ключи не считаются каналом", () => {
    // Тот же класс, что уже ловили у channelFrom: прямая индексация находит
    // «constructor», и функция уезжала бы в отчёт как канал.
    expect(channelFromRef("constructor")).toBeNull();
    expect(channelFromRef("toString")).toBeNull();
    expect(channelFromRef("__proto__")).toBeNull();
  });

  it("в адресе только ref — канал определяется по нему", () => {
    адрес("?ref=producthunt");
    expect(channelNow()).toBe("product-hunt");
  });

  it("стоят оба — побеждает c", () => {
    адрес("?c=yt&ref=producthunt");
    expect(channelNow()).toBe("youtube");
  });

  it("ref переживает переход внутри вкладки", () => {
    адрес("?ref=producthunt");
    expect(channelNow()).toBe("product-hunt");
    // Следующая страница без параметров: канал должен помниться, иначе покупка
    // уйдёт «прямому заходу».
    адрес("", "/pricing");
    expect(channelNow()).toBe("product-hunt");
  });

  it("КОНТРОЛЬ: неизвестный ref не делает вид, что канал известен", () => {
    адрес("?ref=zzz-neizvestnaya-ploschadka");
    expect(channelNow()).toBeNull();
  });
});
