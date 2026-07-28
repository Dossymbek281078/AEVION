import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Класс: динамический маршрут отдаёт 200 на любой адрес.
 *
 * 28.07.2026 замер: `/pricing/zzzz123` → HTTP **200** со страницей «тариф не
 * найден». Список тарифов грузится с клиента, поэтому серверный рендер не мог
 * отличить настоящий тариф от мусора. Поисковик получал 200 на любой
 * несуществующий адрес — мягкий 404, который тратит краулинговый бюджет
 * (Search Console: 662 «не проиндексировано»). Корневой `[id]` при этом
 * 404-ил правильно, поэтому глазами дыра не находилась.
 *
 * Починка держится на списке тарифов, вписанном в страницу. Список, который
 * разъедется с реестром, — это новый тариф, молча отдающий 404. Поэтому
 * сторож сверяет его с источником истины, а не фиксирует числом.
 *
 * Отдельно: не пытаться проверять это curl'ом с сырой кириллицей в пути —
 * так прод отвечает 500, но браузеры и краулеры всегда шлют путь
 * percent-encoded, и на нём поведение другое. Прибор соврал бы.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "[tierId]", "page.tsx");
const REGISTRY = join(
  HERE,
  "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "data", "pricing.ts",
);

const PAGE_SRC = readFileSync(PAGE, "utf8");
const REGISTRY_SRC = readFileSync(REGISTRY, "utf8");

/** Тарифы, которые страница считает существующими. */
const pageIds = (() => {
  const m = PAGE_SRC.match(/KNOWN_TIER_IDS[^=]*=\s*\[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort();
})();

/** Тарифы из реестра — источник истины. */
const registryIds = (() => {
  // Только блок TIERS: ниже в том же файле лежит MODULES_PRICING, и его id
  // (qbuild, qsign, ...) — не тарифы. Первый разбор этого сторожа поймал их
  // все и выдал за расхождение.
  const start = REGISTRY_SRC.indexOf("export const TIERS");
  const end = REGISTRY_SRC.indexOf("export const MODULES_PRICING");
  const block = REGISTRY_SRC.slice(start, end > start ? end : undefined);
  return [...block.matchAll(/^\s{4}id:\s*"([a-z]+)",$/gm)].map((m) => m[1]).sort();
})();

describe("маршрут тарифа не отдаёт 200 на несуществующий адрес", () => {
  it("страница вызывает notFound для неизвестного тарифа", () => {
    expect(PAGE_SRC).toMatch(/notFound\(\)/);
    expect(PAGE_SRC).toMatch(/KNOWN_TIER_IDS\.includes/);
  });

  it("списки вообще непустые (иначе сравнение ниже бессмысленно)", () => {
    expect(pageIds.length).toBeGreaterThan(0);
    expect(registryIds.length).toBeGreaterThan(0);
  });

  it("список на странице совпадает с реестром", () => {
    // Разъезд в любую сторону вреден: лишний id пускает мусор, недостающий
    // отдаёт 404 на настоящий тариф.
    expect(pageIds).toEqual(registryIds);
  });
});
