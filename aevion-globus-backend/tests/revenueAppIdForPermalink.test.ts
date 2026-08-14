import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appIdForPermalink, appIdForLsVariant } from "../src/routes/revenue";

// Вторая поверхность того же дефекта, что уже закрыт во фронтенде
// (tests/gumroadPermalinkGuard.test.ts): там словарь ссылок на оплату, здесь —
// словарь «пермалинк → модуль» для учёта выручки. Обе таблицы читались прямой
// индексацией, а она находит и унаследованное: GUMROAD_PERMALINK_APP["constructor"]
// — функция Object, она истинна и проходила через `||` как готовый appId.
// Починка во фронтенде эту таблицу не покрывала: файл другой, тест другой.
const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

// Переменные окружения проверяются РАНЬШЕ таблицы, поэтому чужая GUMROAD_APP_*
// из окружения разработчика подменила бы ответ и сделала тест зелёным вслепую.
const TOUCHED = [
  ...PROTO_KEYS.map((k) => `GUMROAD_APP_${k.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`),
  ...PROTO_KEYS.map((k) => `GUMROAD_PRODUCT_${k.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`),
  "GUMROAD_APP_OIJXMQ",
  "GUMROAD_PRODUCT_OIJXMQ",
  "GUMROAD_APP_ZZZ_UNKNOWN",
  "GUMROAD_PRODUCT_ZZZ_UNKNOWN",
];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of TOUCHED) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("appIdForPermalink — ключ прототипа не становится модулем", () => {
  it.each(PROTO_KEYS)("«%s» → platform, а не унаследованная функция", (k) => {
    const got = appIdForPermalink(k);
    expect(typeof got).toBe("string");
    expect(got).toBe("platform");
  });

  it("обычный неизвестный пермалинк ведёт себя так же — иначе проверялась бы не та причина", () => {
    // Отрицательный контроль: если бы «platform» возвращалось вообще всегда,
    // проверка выше проходила бы и на сломанном коде.
    expect(appIdForPermalink("zzz-unknown")).toBe("platform");
    expect(appIdForPermalink("orcfbo")).toBe("gratitude-book");
  });
});

describe("каталог Gumroad и таблица привязки не расходятся", () => {
  // Товар заведён 26.07.2026, строку в таблицу не добавили — продажи протокола
  // долголетия попадали в общий котёл «platform» вместо своего модуля.
  it("Протокол долголетия (oijxmq) привязан к qrenew, как и обе «Анти-седины»", () => {
    expect(appIdForPermalink("oijxmq")).toBe("qrenew");
  });

  it("регистр пермалинка не важен", () => {
    expect(appIdForPermalink("OIJXMQ")).toBe("qrenew");
  });

  // Третья поверхность того же класса: кэш вариантов LemonSqueezy тоже читается
  // прямой индексацией. Достижимость ниже (variant_id приходит числом), но
  // класс закрывается по ВСЕМ поверхностям или не закрывается вовсе —
  // см. feedback_pattern_sweep_is_not_class_closure.
  it.each(PROTO_KEYS)("вариант LemonSqueezy «%s» → platform", (k) => {
    const got = appIdForLsVariant(k);
    expect(typeof got).toBe("string");
    expect(got).toBe("platform");
  });

  it.each([
    ["orcfbo", "gratitude-book"],
    ["ghvzq", "gratitude-book"],
    ["lelzw", "gratitude-book"],
    ["pyiaz", "constitution"],
    ["wjvquw", "constitution"],
    ["xpxzam", "aevion-all-access"],
    ["tmuyxw", "qrenew"],
    ["kkiavh", "qrenew"],
    ["oijxmq", "qrenew"],
  ])("живой товар %s привязан к %s", (permalink, appId) => {
    expect(appIdForPermalink(permalink)).toBe(appId);
  });
});
