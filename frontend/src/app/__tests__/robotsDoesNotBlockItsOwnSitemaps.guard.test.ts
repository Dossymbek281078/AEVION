import { describe, it, expect } from "vitest";
import { текстRobots, SITEMAP_PATHS, CLEAN_PARAMS } from "../robotsRules";

/**
 * robots.txt не имеет права запрещать путь к карте сайта, которую сам же
 * объявляет.
 *
 * Повод, а не гипотеза. Замер 06.10.2026 на живом robots.txt: объявлены две
 * карты, и вторая — /api-backend/api/aevion/sitemap.xml — попадала под запрет
 * "/api-backend/" строкой выше. Карта живая: код 200, 1811 байт, 16 адресов
 * модулей. Но робот сперва читает robots.txt, и путь ему там закрыт, поэтому
 * 16 адресов были заявлены и недостижимы. Для Яндекса это ещё и отклонённая
 * карта в Вебмастере.
 *
 * Почему прежние сторожа молчали: sitemapNeverAdvertisesDisallowed смотрит на
 * адреса ВНУТРИ карты, а противоречие было в ОБЪЯВЛЕНИИ карты. Класс один и
 * тот же — «карта звала туда, куда robots не пускает», — но поверхность другая.
 *
 * Проверяем ВЫВОД robots(), а не наши же константы: правило отбора живёт в
 * одном месте, и сторож, зовущий ту же функцию, подтвердил бы сам себя.
 * Поэтому порядок применения правил здесь написан заново, по стандарту.
 */

/** Самое длинное совпадение сильнее — так считают и Google, и Яндекс. */
function решение(путь: string, allow: string[], disallow: string[]): "открыт" | "закрыт" {
  const длина = (правила: string[]) =>
    правила.reduce((лучшее, п) => {
      const точный = п.endsWith("$");
      const тело = точный ? п.slice(0, -1) : п;
      const подходит = точный ? путь === тело : путь.startsWith(тело);
      return подходит && тело.length > лучшее ? тело.length : лучшее;
    }, -1);
  const a = длина(allow);
  const d = длина(disallow);
  // При равной длине стандарт предписывает открывать.
  return a >= d ? "открыт" : "закрыт";
}

describe("robots.txt не закрывает свои же карты сайта", () => {
  // 07.10.2026: разбираем НАСТОЯЩИЙ текст robots.txt, а не объект метаданных.
  // Файл теперь собирается строкой (нужна директива Clean-param, которой нет в
  // типе MetadataRoute.Robots), и сторож обязан смотреть на то, что уедет на
  // прод, а не на промежуточную форму.
  const БАЗА = "https://aevion.app";
  const текст = текстRobots(БАЗА);
  const строки = текст.split(String.fromCharCode(10));
  const поля = (имя: string) =>
    строки
      .filter((s) => s.toLowerCase().startsWith(имя.toLowerCase() + ":"))
      .map((s) => s.slice(имя.length + 1).trim());
  const allow = поля("Allow");
  const disallow = поля("Disallow");
  const r = { sitemap: поля("Sitemap") };

  it("правила не пусты — иначе всё ниже зелёное на пустоте", () => {
    expect(allow.length).toBeGreaterThan(0);
    expect(disallow.length).toBeGreaterThan(5);
    expect(SITEMAP_PATHS.length).toBeGreaterThanOrEqual(2);
  });

  it("каждая объявленная карта открыта для обхода", () => {
    const объявлены = ([] as string[]).concat(r.sitemap ?? []);
    expect(объявлены.length).toBe(SITEMAP_PATHS.length);
    for (const url of объявлены) {
      const путь = url.replace(/^https?:\/\/[^/]+/, "");
      expect(решение(путь, allow, disallow), `карта ${путь} должна быть открыта`).toBe("открыт");
    }
  });

  it("отрицательный контроль: разрешение не открыло /api-backend/ целиком", () => {
    for (const путь of ["/api-backend/api/aevion/leads", "/api-backend/api/admin", "/api-backend/"]) {
      expect(решение(путь, allow, disallow), путь).toBe("закрыт");
    }
  });

  it("отрицательный контроль: прежние запреты живы", () => {
    // /account проверяется и без косой черты, и с ней: именно этот контроль
    // поймал 06.10.2026, что запись "/account/" сам адрес не закрывает.
    for (const путь of ["/admin/awards", "/account", "/account/", "/qpaynet/admin", "/pricing/checkout/success"]) {
      expect(решение(путь, allow, disallow), путь).toBe("закрыт");
    }
  });

  it("живые страницы по-прежнему открыты", () => {
    for (const путь of ["/", "/pricing", "/longevity", "/cyberchess", "/devhub", "/qright"]) {
      expect(решение(путь, allow, disallow), путь).toBe("открыт");
    }
  });

  it("Clean-param объявлен и перечисляет метки, которые мы реально ставим", () => {
    const строка = строки.find((s) => s.startsWith("Clean-param:"));
    expect(строка, "директивы Clean-param нет — Яндекс будет дробить страницы по меткам").toBeTruthy();
    const перечень = (строка as string).slice("Clean-param:".length).trim().split("&");
    // `c` — наша метка канала, она стоит почти в каждой ссылке из роликов и писем.
    expect(перечень).toContain("c");
    expect(перечень).toEqual([...CLEAN_PARAMS]);
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: Clean-param не превратился в запрет", () => {
    // Директива перечисляет параметры, а не пути: если бы кто-то записал её
    // как Disallow, закрылись бы живые страницы с метками.
    expect(disallow.some((d) => d.includes("utm_") || d === "c")).toBe(false);
  });
});
