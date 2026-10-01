import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { channelFrom, keepChannel } from "@/lib/products";

/**
 * ПЕРЕХОД НА АНГЛИЙСКУЮ ПОСАДОЧНУЮ НЕ ТЕРЯЕТ КАНАЛ.
 *
 * Повод 30.09.2026. `/go?c=ig` у гостя с cookie языка `en` перенаправлялась на
 * `/en/go?c=instagram`: в адрес подставлялось ДЛИННОЕ имя канала, которое
 * возвращает channelFrom("ig"). А channelFrom("instagram") возвращал null —
 * сайт знает короткие метки. Итог: человек из шапки Instagram приходил на
 * английскую страницу БЕЗ канала, и вся его покупка уходила в «прямые заходы».
 *
 * Это ровно та ловушка, что описана в комментарии channelParam: подстановка
 * значения вместо ключа выглядит правильной. Поэтому проверяется РЕЗУЛЬТАТ
 * (какой адрес получается), а не факт вызова функции.
 */

const ИСХОДНИК = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("языковое перенаправление /go → /en/go", () => {
  it("адрес несёт КОРОТКУЮ метку, которую примет следующая страница", () => {
    const адрес = keepChannel("/en/go", channelFrom("ig"));
    const u = new URL(адрес, "https://aevion.app");
    expect(u.pathname).toBe("/en/go");
    expect(u.searchParams.get("c"), `метка не короткая: ${адрес}`).toBe("ig");
    // Главное: следующая страница обязана эту метку ПРОЧИТАТЬ.
    expect(channelFrom(u.searchParams.get("c") ?? undefined)).toBe("instagram");
  });

  it("длинное имя в адресе больше не обнуляет канал", () => {
    // Синоним-запас: чужая ссылка с ?c=instagram теперь считается каналом,
    // а не уходит в «прямые заходы».
    expect(channelFrom("instagram")).toBe("instagram");
  });

  it("страница не собирает адрес перенаправления руками", () => {
    expect(
      /redirect\(keepChannelOrProbe\(enUrl/.test(ИСХОДНИК),
      "перенаправление снова собирается вручную — длинное имя вернётся",
    ).toBe(true);
    expect(
      ИСХОДНИК.includes("/en/go?c=${encodeURIComponent(channel)}"),
      "в коде осталась подстановка длинного имени",
    ).toBe(false);
  });

  it("КОНТРОЛЬ: без канала перенаправление не обрастает пустым c=", () => {
    const u = new URL(keepChannel("/en/go", null), "https://aevion.app");
    expect(u.searchParams.get("c")).toBeNull();
    expect(u.pathname).toBe("/en/go");
  });

  it("КОНТРОЛЬ: прибор различает известную и неизвестную метку", () => {
    expect(channelFrom("zzz-неизвестно")).toBeNull();
  });
});
