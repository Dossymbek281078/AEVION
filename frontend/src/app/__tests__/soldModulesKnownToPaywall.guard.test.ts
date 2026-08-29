import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Продаём то, о чём платная стена НЕ ЗНАЕТ.
 *
 * Замер 29.08.2026 на живом проде: стена включена и работает (закрытые модули
 * отвечают 402 анонимно), но её список и список продаваемых продуктов ведутся
 * в разных файлах разными людьми — и не пересекаются вовсе:
 *
 *   закрыто стеной: 6 модулей, продаваемых среди них 0
 *   продаётся:     16 продуктов, закрытых среди них 0
 *
 * ПОПРАВКА 29.08, вечер: два числа выше («закрыто 6», «продаваемых среди них
 * 0») получены ПРОБОЙ на живом проде и перепроверить их я не смог. Соседняя
 * вкладка посчитала то же по КОНФИГУРАЦИИ и получила 43 модуля, из них
 * закрытых 40. Числа не спорят — это разные вопросы: конфигурация говорит,
 * ЧТО ДОЛЖНО быть закрыто, проба — что закрыто СЕЙЧАС. Но считать пробу
 * подтверждённой нельзя, пока её не повторили. В лист решений основателю
 * ушло число по конфигурации; это правильно — воспроизводимое число
 * побеждает невоспроизводимое.
 *
 * САМ СТОРОЖ поправка не затрагивает: он спрашивает третье — «есть ли у
 * продаваемого модуля возможность быть закрытым», и на этот вопрос отвечает
 * сравнением идентификаторов, которое воспроизводится при каждом прогоне.
 *
 * Самое дорогое (DevHub Studio Pro, $149) политике НЕ ИЗВЕСТНО: его нельзя
 * закрыть, даже если принять такое решение — сперва надо завести модуль.
 *
 * Этот сторож НЕ требует, чтобы продаваемое было закрыто: что закрывать —
 * решение о цене и упаковке, человеческое. Он требует меньшего и проверяемого:
 * у каждого продаваемого модуля должна БЫТЬ возможность его закрыть.
 *
 * Храповик: сегодняшние исключения перечислены поимённо и объяснены. Новый
 * продукт, о котором стена не знает, уронит проверку.
 */

const ROOT = join(__dirname, "..", "..", "..", "..");
const PRODUCTS = join(ROOT, "frontend", "src", "lib", "products.ts");
const PRICING = join(ROOT, "aevion-globus-backend", "src", "data", "pricing.ts");

/** Не модули: пакет из нескольких модулей и товары вне платформы. */
const NOT_A_MODULE = new Set([
  "aevion-all-access", // пакет «вся экосистема», а не отдельный модуль
  "gratitude-book",    // книга: файл, а не доступ к модулю
]);

/** Известный долг на 29.08.2026. Убирать отсюда — только вместе с заведением модуля. */
const KNOWN_UNREGISTERED = new Set([
  "devhub", // $149/мес, в MODULES_PRICING отсутствует — закрыть нельзя
]);

function soldAppIds(): Array<{ appId: string; title: string; price: number }> {
  const src = readFileSync(PRODUCTS, "utf8");
  const out: Array<{ appId: string; title: string; price: number }> = [];
  const blocks = src.match(/\{(?:[^{}]|\{[^{}]*\})*?\}/g) ?? [];
  for (const b of blocks) {
    const price = /priceUsd:\s*([0-9]+)/.exec(b);
    const appId = /appId:\s*"([^"]+)"/.exec(b);
    const title = /title:\s*"([^"]+)"/.exec(b);
    if (price && appId) {
      out.push({ appId: appId[1], title: title ? title[1] : appId[1], price: Number(price[1]) });
    }
  }
  return out;
}

function knownModules(): Set<string> {
  const src = readFileSync(PRICING, "utf8");
  return new Set((src.match(/^\s*id:\s*"[a-z0-9-]+"/gm) ?? []).map((l) => /"([a-z0-9-]+)"/.exec(l)![1]));
}

describe("продаваемое известно платной стене", () => {
  it("контроль: оба источника прочитаны и непусты", () => {
    expect(soldAppIds().length, "каталог продаж не разобран").toBeGreaterThan(5);
    expect(knownModules().size, "список модулей не разобран").toBeGreaterThan(20);
  });

  it("контроль: заведомо известный модуль находится", () => {
    // если это перестанет находиться — сломан разбор, а не продукт
    expect(knownModules().has("globus")).toBe(true);
  });

  it("у каждого продаваемого модуля есть возможность закрыть его стеной", () => {
    const known = knownModules();
    const missing = soldAppIds()
      .filter((p) => !NOT_A_MODULE.has(p.appId))
      .filter((p) => !known.has(p.appId))
      .filter((p) => !KNOWN_UNREGISTERED.has(p.appId))
      .map((p) => `${p.title} ($${p.price}) — appId "${p.appId}"`);
    expect(
      missing,
      "Эти продукты продаются, но их модуль не заведён в MODULES_PRICING.\n" +
        "Значит платная стена о них не знает и закрыть их нельзя ничем,\n" +
        "кроме отдельной авторизации. Заведите модуль либо внесите в\n" +
        "NOT_A_MODULE, если это пакет или товар вне платформы:\n  ",
    ).toEqual([]);
  });

  it("починенное остаётся починенным: долг не растёт", () => {
    const known = knownModules();
    const stillMissing = [...KNOWN_UNREGISTERED].filter((id) => !known.has(id));
    expect(
      stillMissing.length,
      "модуль завели — уберите его из KNOWN_UNREGISTERED, иначе список врёт",
    ).toBeLessThanOrEqual(KNOWN_UNREGISTERED.size);
  });
});
