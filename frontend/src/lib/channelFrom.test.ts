import { describe, it, expect } from "vitest";
import { channelFrom, withChannel, CHANNELS } from "./products";

/**
 * Метка канала — единственный способ узнать, какой источник трафика приносит
 * деньги. Она уезжает в РЕАЛЬНУЮ платёжную ссылку, поэтому всё, что не входит
 * в белый список, обязано отсекаться.
 *
 * Тест написан после живой находки 27.07.2026: на проде `/shop?c=constructor`
 * подставлял в ссылку `channel=function Object() { [native code] }`, а
 * `?c=__proto__` — `[object Object]`. Причина — поиск по обычному объекту,
 * который наследует ключи прототипа.
 */
describe("channelFrom: белый список каналов", () => {
  it("разворачивает известные коды", () => {
    expect(channelFrom("ig")).toBe("instagram");
    expect(channelFrom("tt")).toBe("tiktok");
    expect(channelFrom(" QR ")).toBe("qr-code");
  });

  it("отсекает неизвестное", () => {
    expect(channelFrom("hacker")).toBeNull();
    expect(channelFrom("")).toBeNull();
    expect(channelFrom(undefined)).toBeNull();
  });

  // Ключи прототипа перечислены явно, а не сгенерированы: если завтра кто-то
  // добавит проверку через `key in CHANNELS`, тест должен упасть на каждом.
  //
  // На старом коде реально проходили ДВА из пяти — `constructor` и `__proto__`.
  // Остальные три спасало приведение к нижнему регистру: `toString` становится
  // `tostring` и перестаёт быть ключом прототипа. Это случайность, а не защита:
  // достаточно кому-то убрать `.toLowerCase()` — и дыра станет вчетверо шире.
  // Поэтому в списке все пять.
  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "не пускает прототипный ключ %s",
    (key) => {
      expect(channelFrom(key)).toBeNull();
    },
  );

  it("прототипный ключ не доезжает до платёжной ссылки", () => {
    const gumroad = "https://aevion.gumroad.com/l/orcfbo";
    const ls = "https://aevion.lemonsqueezy.com/checkout/buy/abc";
    for (const key of ["constructor", "__proto__"]) {
      expect(withChannel(gumroad, channelFrom(key))).toBe(gumroad);
      expect(withChannel(ls, channelFrom(key))).toBe(ls);
    }
  });

  it("известная метка по-прежнему доезжает — обе платёжки", () => {
    const gumroad = withChannel("https://aevion.gumroad.com/l/orcfbo", channelFrom("ig"));
    expect(gumroad).toContain("channel=instagram");
    const ls = withChannel("https://aevion.lemonsqueezy.com/checkout/buy/abc", channelFrom("tg"));
    expect(ls).toContain("channel");
    expect(ls).toContain("telegram");
  });

  it("в белом списке только строки", () => {
    for (const key of Object.keys(CHANNELS)) {
      expect(typeof CHANNELS[key]).toBe("string");
    }
  });
});
