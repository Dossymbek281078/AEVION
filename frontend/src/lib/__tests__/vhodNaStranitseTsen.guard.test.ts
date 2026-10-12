import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vybratVhod } from "../vhodNaStranitseTsen";
import { STANDALONE_APPS, standaloneApp } from "../termPricing";
import { predlagaemOtdelno } from "../neProdayotsyaOtdelno";

/**
 * 🔴 ПРИШЁЛ ЗА ПРИЛОЖЕНИЕМ — ВИДИТ ЕГО ПЕРВЫМ ЭКРАНОМ.
 *
 * Замер 12.10.2026 (воронка, канал youtube, 14 дней): из трёх живых людей,
 * нажавших «Купить CyberChess», до цен дошёл ОДИН. Кнопка ведёт на
 * `/pricing?app=cyberchess`, а верхний блок включался только по `?module=`.
 * Остальные попадали на страницу длиной 23 экрана, где карточка стоит на
 * 6162 px, и видели её лишь после 1402 КБ кода — если дожидались.
 */
const естьМодуль = (id: string) => Boolean(standaloneApp(id));
const о = (q: { module?: string | null; app?: string | null }) =>
  vybratVhod({ ...q, естьМодуль, prodayotsyaOtdelno: predlagaemOtdelno });

describe("что показывать первым экраном на /pricing", () => {
  it("🔴 ?app= поднимает карточку приложения — то, ради чего правка", () => {
    expect(о({ app: "cyberchess" })).toBe("cyberchess");
    expect(о({ app: "devhub" })).toBe("devhub");
  });

  it("пробелы по краям метки не теряют человека", () => {
    // Адрес мог прийти с %20 по краям — например, из описания ролика, где
    // ссылку переносили руками. Без обрезки такой заход молча падает в общий
    // холодный вход, то есть человек снова не видит того, за чем пришёл.
    expect(о({ app: " cyberchess " })).toBe("cyberchess");
    expect(о({ module: " devhub " })).toBe("devhub");
  });

  it("?module= главнее ?app= — его ставит страница продукта", () => {
    expect(о({ module: "devhub", app: "cyberchess" })).toBe("devhub");
  });

  it("🔴 не продаваемое отдельно наверх не поднимается", () => {
    // Бюро снято с отдельной продажи словом основателя (волна 68). Поднять
    // его карточку значит пообещать покупку, которой нет.
    expect(predlagaemOtdelno("ip_bureau"), "контроль: бюро всё ещё снято").toBe(false);
    expect(о({ app: "ip_bureau" })).toBe("");
  });

  it("мусор и пустота дают обычный холодный вход", () => {
    const пустые: Array<{ module?: string | null; app?: string | null }> = [
      {},
      { app: "" },
      { app: "   " },
      { app: "net-takogo-prilozheniya" },
      { module: null, app: null },
    ];
    for (const q of пустые) expect(о(q), `не пусто для ${JSON.stringify(q)}`).toBe("");
    expect(пустые.length, "знаменатель: пустых случаев проверено").toBe(5);
  });

  it("🔴 каждое продаваемое приложение поднимается — знаменатель по витрине", () => {
    // Иначе правка закроет один случай (шахматы) и промолчит на восьми других.
    const продаваемые = STANDALONE_APPS.filter((a) => predlagaemOtdelno(a.slug));
    expect(продаваемые.length, "продаваемых приложений").toBeGreaterThan(5);
    const немые = продаваемые.filter((a) => о({ app: a.slug }) !== a.slug);
    expect(немые.map((a) => a.slug), "эти приложения не поднимаются наверх").toEqual([]);
  });

  it("🔴 страница действительно ЗОВЁТ эту функцию, а не решает по-своему", () => {
    /*
     * Чистая функция может быть верной и неиспользуемой — этот класс у нас уже
     * был («написано, но не вызывается»). Поэтому смотрим на саму страницу.
     */
    const стр = readFileSync(join(process.cwd(), "src/app/pricing/page.tsx"), "utf8");
    expect(стр, "страница не зовёт vybratVhod").toContain("vybratVhod({");
    expect(стр, "в vybratVhod не передан ?app=").toMatch(/app:\s*params\.get\("app"\)/);
    // И своего разбора `?module=` рядом не осталось — иначе два решения разойдутся.
    const вызовов = (стр.match(/setHeroModule\(/g) || []).length;
    // Ровно ОДИН вызов: решение принимается в одном месте. Объявление через
    // useState сюда не попадает — там имя без скобки.
    expect(вызовов, "setHeroModule зовётся не из одного места").toBe(1);
  });
});
