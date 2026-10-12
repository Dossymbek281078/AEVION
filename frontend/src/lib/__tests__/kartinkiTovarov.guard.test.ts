import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  КАРТИНКИ_ТОВАРОВ,
  СТРАНИЦЫ_ПРИЛОЖЕНИЙ,
  kartinkaTovara,
  kartinkaPrilozheniya,
} from "../kartinkiTovarov";
import { STANDALONE_APPS } from "../termPricing";
import { GUIDES } from "../products";
import { товарПриложения } from "../appsJsonLd";
import { разметкаТоваров } from "../shopJsonLd";

/**
 * 🔴 КАРТИНКА В РАЗМЕТКЕ ТОВАРА СУЩЕСТВУЕТ И ПРЕДСТАВЛЯЕТ ТОВАР.
 *
 * У Google `image` — обязательное поле Product: без него товарный блок выдачи
 * не показывается, то есть разметка цены и наличия работает вхолостую. Но
 * картинка, которой НЕТ по адресу, хуже отсутствующей: она обещает в выдаче
 * то, чего человек не увидит. Сторож держит обе стороны.
 */
describe("картинки товаров", () => {
  it("🔴 каждый файл обложки существует и это настоящий PNG", () => {
    const пути = [...new Set(Object.values(КАРТИНКИ_ТОВАРОВ))];
    expect(пути.length, "обложек в карте нет вовсе — прибор слеп").toBeGreaterThan(0);
    for (const п of пути) {
      const файл = join(process.cwd(), "public", п.replace(/^\//, ""));
      expect(existsSync(файл), "файла обложки нет: " + файл).toBe(true);
      // Пустой или крошечный файл — это не обложка, а след неудачной выкладки.
      expect(statSync(файл).size, "обложка подозрительно мала: " + п).toBeGreaterThan(5_000);
    }
    expect(пути.length, "знаменатель: разных обложек").toBe(2);
  });

  it("🔴 товар без НАСТОЯЩЕЙ обложки картинки не получает", () => {
    /*
     * Замер 12.10.2026 по кассе: у «Анти-седины» (обе языковые версии) на
     * странице товара лежит только наш аватар — глобус AEVION 400×400. Это не
     * обложка, и подставлять его нельзя: правило Google прямо требует, чтобы
     * картинка представляла размеченное содержимое. Пусть лучше не будет
     * товарного блока, чем будет ложное обещание.
     */
    expect(kartinkaTovara("tmuyxw"), "у «Анти-седины» RU появилась картинка — проверьте, настоящая ли").toBeNull();
    expect(kartinkaTovara("kkiavh"), "у «Анти-седины» EN появилась картинка — проверьте, настоящая ли").toBeNull();
    // И контроль в обратную сторону: у кого обложка есть — она отдаётся.
    expect(kartinkaTovara("oijxmq")).toBe("https://aevion.app/covers/protokol-dolgoletiya.png");
    expect(kartinkaTovara("orcfbo")).toContain("/covers/gratitude-forever-young.png");
    // Выдуманный товар картинки не получает — прибор не «всегда что-то даёт».
    expect(kartinkaTovara("net-takogo-tovara")).toBeNull();
  });

  it("карта обложек говорит о СУЩЕСТВУЮЩИХ товарах витрины", () => {
    // Иначе карта тихо расходится с каталогом: товар переименован, запись
    // осталась, и никто этого не видит.
    const идыВитрины = new Set(GUIDES.map((p) => p.id));
    for (const id of Object.keys(КАРТИНКИ_ТОВАРОВ)) {
      expect(идыВитрины.has(id), "в карте обложек товар, которого нет на витрине: " + id).toBe(true);
    }
    expect(Object.keys(КАРТИНКИ_ТОВАРОВ).length, "знаменатель: товаров с обложкой").toBe(4);
  });
});

describe("картинки приложений", () => {
  it("🔴 у каждого приложения витрины есть страница с картинкой — знаменатель 9 из 9", () => {
    // Пропусти одно — и именно оно останется без товарного блока, молча.
    for (const app of STANDALONE_APPS) {
      const стр = СТРАНИЦЫ_ПРИЛОЖЕНИЙ[app.slug];
      expect(стр, "у приложения нет страницы в карте: " + app.slug).toBeTruthy();
      const папка = join(process.cwd(), "src/app", стр.replace(/^\//, ""));
      expect(existsSync(папка), "страницы не существует: " + стр).toBe(true);
      expect(
        existsSync(join(папка, "opengraph-image.tsx")),
        "у страницы нет своей картинки: " + стр,
      ).toBe(true);
    }
    expect(STANDALONE_APPS.length, "знаменатель: приложений витрины").toBe(9);
    expect(Object.keys(СТРАНИЦЫ_ПРИЛОЖЕНИЙ).length, "в карте лишние записи").toBe(9);
  });

  it("адрес картинки собирается от страницы, а не от slug", () => {
    // ip_bureau живёт на /bureau: собери адрес из slug — получишь мёртвый.
    expect(kartinkaPrilozheniya("ip_bureau")).toBe("https://aevion.app/bureau/opengraph-image");
    expect(kartinkaPrilozheniya("multichat")).toBe("https://aevion.app/multichat-engine/opengraph-image");
    expect(kartinkaPrilozheniya("net-takogo")).toBeNull();
  });
});

describe("картинка доезжает до самой разметки", () => {
  it("🔴 в Product приложения есть image, и это адрес его страницы", () => {
    // Карта может быть верной, а поле — не попасть в разметку: этот класс у
    // нас уже случался трижды («посчитал и не отдал»). Поэтому спрашиваем
    // ТОТ ЖЕ объект, который уходит роботу.
    const app = STANDALONE_APPS.find((a) => a.slug === "ip_bureau")!;
    const товар = товарПриложения(app) as Record<string, unknown>;
    expect(товар.image, "в разметке приложения нет картинки").toBe(
      "https://aevion.app/bureau/opengraph-image",
    );
    // Знаменатель: картинка есть у КАЖДОГО приложения витрины.
    const без = STANDALONE_APPS.filter((a) => !(товарПриложения(a) as Record<string, unknown>).image);
    expect(без.map((a) => a.slug), "приложения без картинки в разметке").toEqual([]);
  });

  it("🔴 в Product витрины есть обложка там, где она есть, и нет там, где нет", () => {
    const разметка = разметкаТоваров() as { itemListElement?: Array<{ item?: Record<string, unknown> }> } | null;
    expect(разметка, "разметка витрины не собралась").toBeTruthy();
    const товары = (разметка!.itemListElement ?? []).map((э) => э.item!);
    expect(товары.length, "товаров в разметке нет — проверять нечего").toBeGreaterThan(0);
    const сКартинкой = товары.filter((т) => typeof т.image === "string");
    const без = товары.filter((т) => typeof т.image !== "string");
    // Четыре с обложкой, два без — ровно то, что дал замер кассы 12.10.2026.
    expect(сКартинкой.length, "товаров с обложкой").toBe(4);
    expect(без.map((т) => т.sku).sort(), "без обложки должны остаться только «Анти-седина»").toEqual(["kkiavh", "tmuyxw"]);
    // И адрес обложки ведёт на наш сайт, а не в чужую кассу: адрес у
    // поставщика живёт до первой перезаливки.
    for (const т of сКартинкой) {
      expect(String(т.image), "обложка не у нас: " + String(т.image)).toContain("https://aevion.app/covers/");
    }
  });
});
