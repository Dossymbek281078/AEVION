/*
 * Наша собственная проба не должна выглядеть покупателем.
 *
 * 🔴 Замер 01.10.2026. Правило платформы велит каждому окну заходить на прод с
 * меткой `?c=probe-<окно>`, и сервер такие метки исключает из воронки. Но с трёх
 * страниц метка до сервера не доезжала: `/go`, `/longevity` и `/shop` уводят
 * гостя с английской cookie на английскую версию, а адрес собирал `keepChannel`,
 * знающий только закрытый список каналов.
 *
 * Замер на живом проде в тот день, с контролем:
 *   /go?c=probe-phone  -> /en/go           (метка ПОТЕРЯНА)
 *   /go?c=probe-prices -> /en/go           (метка ПОТЕРЯНА)
 *   /go?c=ig           -> /en/go?c=ig      (контроль: известная метка цела)
 *
 * Цена этого уже известна: 30.09 воронка показывала «начали оплату: 5», и все
 * пять оказались нашими окнами. Числа воронки — единица измерения всей работы.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { channelFrom, keepChannel, keepChannelOrProbe, нашаМетка } from "../products";

const СЕРВЕР = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "..", "aevion-globus-backend", "src", "routes", "events.ts",
);

describe("наши пробы переживают языковой редирект", () => {
  it("метка пробы остаётся в адресе", () => {
    expect(keepChannelOrProbe("/en/go", "probe-phone", null)).toBe("/en/go?c=probe-phone");
    expect(keepChannelOrProbe("/en/shop", "probe-prices", null)).toBe("/en/shop?c=probe-prices");
    expect(keepChannelOrProbe("/en/longevity", "SMOKE", null)).toBe("/en/longevity?c=smoke");
  });

  it("выдуманная метка по-прежнему исчезает — канал не накручивается адресом", () => {
    expect(keepChannelOrProbe("/en/go", "myspace", null)).toBe("/en/go");
    expect(keepChannelOrProbe("/en/go", "", null)).toBe("/en/go");
    expect(keepChannelOrProbe("/en/go", undefined, null)).toBe("/en/go");
    // Ключи прототипа — тот же класс, что в channelFrom.
    expect(keepChannelOrProbe("/en/go", "constructor", null)).toBe("/en/go");
    expect(keepChannelOrProbe("/en/go", "__proto__", null)).toBe("/en/go");
  });

  it("настоящий канал по-прежнему едет КОРОТКОЙ меткой, а не сырой строкой", () => {
    const канал = channelFrom("instagram");
    expect(канал).toBe("instagram");
    // Длинное имя пришло в адресе, уехать обязано короткое.
    expect(keepChannelOrProbe("/en/go", "instagram", канал)).toBe("/en/go?c=ig");
    expect(keepChannelOrProbe("/en/go", "ig", channelFrom("ig"))).toBe("/en/go?c=ig");
  });

  it("якорь не ломается — всё после # серверу не отправляется", () => {
    expect(keepChannelOrProbe("/pricing#apps", "probe-phone", null)).toBe("/pricing?c=probe-phone#apps");
    expect(keepChannel("/pricing#apps", "instagram")).toBe("/pricing?c=ig#apps");
  });

  it("список наших меток совпадает с серверным — иначе половины разойдутся", () => {
    const src = readFileSync(СЕРВЕР, "utf8");
    const блок = /НАШИ_МЕТКИ_КАНАЛА = \[([\s\S]*?)\]/.exec(src);
    expect(блок, "не нашёл серверный список — сторож ослеп, а не «всё хорошо»").toBeTruthy();
    const серверные = [...блок![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(серверные.length, "серверный список пуст — читать было нечего").toBeGreaterThan(3);
    // Каждую серверную метку наша функция обязана признать своей.
    for (const м of серверные) {
      expect(нашаМетка(м), `сервер считает "${м}" нашей, а витрина — нет`).toBe(м);
    }
    // И контроль прибора: заведомо чужое не признаётся ни той, ни другой стороной.
    expect(нашаМетка("instagram")).toBeNull();
  });
});
