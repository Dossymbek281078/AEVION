import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { channelFrom, keepChannel } from "@/lib/products";

/**
 * НИ ОДНА ЯЗЫКОВАЯ ПЕРЕАДРЕСАЦИЯ НЕ ТЕРЯЕТ КАНАЛ.
 *
 * Повод 30.09.2026. Дефект нашли на `/go` (адрес собирался вручную и в него
 * подставлялось ДЛИННОЕ имя канала). Починив там, я проверил остальные страницы
 * и нашёл ТО ЖЕ на `/longevity` и `/shop` — то есть это класс, а не случай.
 *
 * Цена ошибки выше всего именно на `/longevity`: обе наши продажи за всё время
 * пришли с книги оттуда, а трафик туда идёт из Instagram. Проверено браузером:
 * `/longevity?c=ig` под английской cookie заканчивалась на `/en/longevity`
 * вообще без метки — покупка пришла бы «источник неизвестен».
 *
 * Поэтому проверка ищет ШАБЛОН по всему дереву страниц, а не стережёт три
 * известных адреса: четвёртая страница с тем же приёмом появится завтра.
 */

const APP = join(__dirname, "..");

function обойти(каталог: string, найдено: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    if (имя === "node_modules" || имя === "__tests__" || имя === ".next") continue;
    const путь = join(каталог, имя);
    if (statSync(путь).isDirectory()) обойти(путь, найдено);
    else if (имя === "page.tsx") найдено.push(путь);
  }
  return найдено;
}

describe("языковые переадресации и метка канала", () => {
  it("ни одна страница не собирает адрес с длинным именем канала", () => {
    const виновные: string[] = [];
    for (const файл of обойти(APP)) {
      const src = readFileSync(файл, "utf8");
      // Ищем подстановку переменной channel прямо в адрес: именно она кладёт
      // ДЛИННОЕ имя («instagram») туда, где ждут короткую метку («ig»).
      if (/c=\$\{(?:encodeURIComponent\()?channel\)?\}/.test(src)) {
        виновные.push(файл.replace(APP, "app"));
      }
    }
    expect(
      виновные,
      "страница подставляет длинное имя канала в адрес — метка потеряется на переходе",
    ).toEqual([]);
  });

  it("КОНТРОЛЬ: прибор действительно находит такой шаблон", () => {
    // Иначе проверка выше зелёная по построению: обход мог не найти ни файла.
    const образец = 'redirect(channel ? `/en/x?c=${encodeURIComponent(channel)}` : "/en/x");';
    expect(/c=\$\{(?:encodeURIComponent\()?channel\)?\}/.test(образец)).toBe(true);
    expect(обойти(APP).length, "обход не нашёл ни одной страницы").toBeGreaterThan(20);
  });

  it("правильная сборка даёт метку, которую примет следующая страница", () => {
    for (const цель of ["/en/go", "/en/longevity", "/en/shop"]) {
      const u = new URL(keepChannel(цель, channelFrom("ig")), "https://aevion.app");
      expect(u.pathname).toBe(цель);
      expect(u.searchParams.get("c"), `метка не доехала на ${цель}`).toBe("ig");
    }
  });
});
