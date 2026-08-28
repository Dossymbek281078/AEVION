/**
 * У платного модуля должно быть чем удерживать доступ.
 *
 * 28.08.2026 я трижды за два часа называл основателю разные числа по этому
 * вопросу: «работает 1 из 7», потом «5 из 11», потом «6 из 9». Все три раза
 * замер был ЗАНИЖЕН, и все три раза по одной причине — мерка знала меньше
 * способов проверки, чем система. Разовый замер тут не годится: в проекте
 * НЕСКОЛЬКО механизмов, и они прибавляются.
 *
 * Поэтому счёт живёт здесь, а не в голове.
 *
 * Что считается «есть чем удерживать» — любой из трёх путей:
 *   1) модуль в MODULE_GATE_PREFIXES (index.ts) — платформенный сторож;
 *   2) поимённый requireModule("<id>") при монтировании;
 *   3) собственный примитив в своих файлах маршрутов (см. PRIMITIVES).
 *
 * ГРАНИЦА. Сторож проверяет НАЛИЧИЕ механизма, а не его правильность: он не
 * знает, закрывает ли механизм те ручки, которые надо, и включён ли он в
 * окружении (пейволл спит на PAYWALL_MODULES). Зелёный тут значит «есть чем
 * закрыть», а не «закрыто».
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACK = join(HERE, "..", "..", "..", "..", "aevion-globus-backend", "src");
const ROUTES = join(BACK, "routes");
const CATALOG = join(HERE, "..", "..", "lib", "products.ts");

/** Именованные способы проверить оплату. Список пополняется вместе с системой. */
const PRIMITIVES = [
  "requireModule", "isModuleEntitled", "getEntitlements", "getPlanFromReq",
  "resolvePlan", "enforcePremiumModelQuota", "premiumQuotaGateFor", "aiRateGate",
  "DevHubEmailTier", "DevHubTier",
];

/** Файлы маршрутов модуля ищем по префиксу имени. */
const ROUTE_PREFIX: Record<string, string> = {
  "devhub": "devhub", "constitution": "constitution", "smeta-trainer": "smeta",
  "qventure": "qventure", "aevion-ip-bureau": "bureau", "qpaynet-embedded": "qpaynet",
  "cyberchess": "cyberchess", "qcontract": "qcontract",
};

/**
 * Известные и принятые: у них механизма нет, и это ЗНАЮТ. Сторож молчит про
 * них, пока положение не изменится, — вечно красный сторож перестают читать.
 * Когда механизм появится, тест сам потребует убрать строку отсюда.
 */
const KNOWN_WITHOUT: Record<string, string> = {

  "cyberchess": "$19/мес, 12 файлов маршрутов, ноль примитивов; задача выдана окну шахмат 28.08",
};

/** Не модуль, а НАБОР: своих маршрутов нет по устройству. */
const BUNDLES = new Set(["aevion-all-access"]);

function pricedModules(): Array<{ app: string; price: number }> {
  const src = readFileSync(CATALOG, "utf8");
  const out = new Map<string, number>();
  for (const part of src.split(/\n\s*title:\s*"/).slice(1)) {
    const app = /appId:\s*"([^"]+)"/.exec(part)?.[1];
    const upTo = part.slice(0, part.indexOf("appId:"));
    const price = /priceUsd:\s*([0-9]+)/.exec(upTo)?.[1];
    const billing = /billing:\s*"([^"]+)"/.exec(upTo)?.[1];
    // Разовые продукты (книги) доставляются письмом, маршрутного сторожа им не надо.
    if (app && price && billing === "monthly" && !out.has(app)) out.set(app, Number(price));
  }
  return [...out].map(([app, price]) => ({ app, price }));
}

function platformGated(): Set<string> {
  const idx = readFileSync(join(BACK, "index.ts"), "utf8");
  const from = idx.indexOf("MODULE_GATE_PREFIXES");
  const to = idx.indexOf("for (const [prefix, moduleId]", from);
  const set = new Set<string>();
  for (const m of idx.slice(from, to).matchAll(/\["\/api\/[a-z0-9-]+",\s*"([a-z0-9-]+)"\]/g)) set.add(m[1]);
  for (const m of idx.matchAll(/requireModule\("([a-z0-9-]+)"\)/g)) set.add(m[1]);
  return set;
}

function ownPrimitives(app: string): string[] {
  const prefix = ROUTE_PREFIX[app];
  if (!prefix) return [];
  const files = readdirSync(ROUTES).filter((f) => f.endsWith(".ts") && f.toLowerCase().startsWith(prefix));
  const found = new Set<string>();
  for (const f of files) {
    const s = readFileSync(join(ROUTES, f), "utf8");
    for (const p of PRIMITIVES) if (s.includes(p)) found.add(p);
  }
  return [...found];
}

/**
 * Четвёртый путь, найденный 28.08 уже ПОСЛЕ первой версии этого сторожа:
 * страница модуля закрывается на фронтенде — `fetchOrPaywall()` спрашивает
 * бэкенд и рисует `PaywallScreen`. Так закрыты 10 страниц, и Smeta Trainer в
 * их числе; первая версия сторожа объявила её незакрытой, потому что смотрела
 * только бэкенд.
 *
 * Это ровно та ошибка, ради которой сторож и написан: мерка знала меньше
 * способов, чем система. Поэтому список путей ведётся здесь, и его пополняют.
 */
/**
 * Путь страницы не всегда равен appId: у бюро он `/bureau`, у QPayNet —
 * `/qpaynet`. Без карты `frontendPaywalled` тихо отвечал бы «не закрыт» на
 * несовпадении имени, то есть слепое пятно выглядело бы как находка. Сейчас
 * оба эти модуля закрыты платформенным сторожем, и ошибка не проявлялась —
 * именно так тихие пятна и доживают до того дня, когда начинают врать.
 */
const PAGE_PATH: Record<string, string> = {
  "aevion-ip-bureau": "bureau",
  "qpaynet-embedded": "qpaynet",
};

function pageFileFor(app: string): string {
  return join(HERE, "..", PAGE_PATH[app] ?? app, "page.tsx");
}

/**
 * Фронтендовых способов закрыть модуль тоже НЕСКОЛЬКО. Первая версия знала
 * один (`fetchOrPaywall`) — и это была та же ошибка, что и во всей истории
 * этого счёта: мерка уже предмета. Найдено спросом «что экспортируют
 * библиотеки», а не перебором по памяти.
 */
const FRONT_PRIMITIVES = [
  "fetchOrPaywall", "apiFetchOrPaywall", "checkAppAccess",
  "installPaywallInterceptor", "triggerPaywall", "PaywallModal", "PaywallScreen",
];

/** Смотрим ВЕСЬ каталог модуля, а не только page.tsx: закрытие бывает вложенным. */
function frontendPaywalled(app: string): boolean {
  const dir = join(HERE, "..", PAGE_PATH[app] ?? app);
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(cur); } catch { continue; }
    for (const e of entries) {
      const p = join(cur, e);
      let isDir = false;
      try { isDir = statSync(p).isDirectory(); } catch { continue; }
      if (isDir) { stack.push(p); continue; }
      if (!/[.]tsx?$/.test(e)) continue;
      let s = "";
      try { s = readFileSync(p, "utf8"); } catch { continue; }
      if (FRONT_PRIMITIVES.some((w) => s.includes(w))) return true;
    }
  }
  return false;
}

function canWithhold(app: string, gated: Set<string>): boolean {
  return gated.has(app) || ownPrimitives(app).length > 0 || frontendPaywalled(app);
}

describe("платный модуль умеет удерживать доступ", () => {
  it("контроль прибора: каталог и сторожа читаются", () => {
    const mods = pricedModules();
    expect(mods.length, "в каталоге не найдено платных подписок — разбор сломан").toBeGreaterThanOrEqual(5);
    const gated = platformGated();
    expect(gated.size, "список закрываемых модулей пуст — разбор index.ts сломан").toBeGreaterThan(10);
    // и положительный контроль: модуль, который ТОЧНО закрыт, определяется закрытым
    expect(canWithhold("qcontract", gated), "qcontract должен определяться как закрытый").toBe(true);
    // И положительный контроль ФРОНТЕНДОВОГО пути: Smeta закрыта только им.
    expect(frontendPaywalled("smeta-trainer"), "Smeta закрыта на фронтенде — путь должен это видеть").toBe(true);
  });

  it("у каждого платного модуля страница НАХОДИТСЯ — иначе слепое пятно молчит", () => {
    // Путь страницы не равен appId у бюро и QPayNet. Если завтра добавится
    // третий такой модуль и его забудут в PAGE_PATH, фронтендовый путь тихо
    // ответит «не закрыт» — и это будет выглядеть находкой, а не пробелом.
    const missing = pricedModules()
      .filter((m) => !BUNDLES.has(m.app))
      .filter((m) => !existsSync(pageFileFor(m.app)))
      .map((m) => `${m.app} — страницы по пути нет; добавьте его в PAGE_PATH`);
    expect(missing, "мерка не находит страницу модуля:\n  " + missing.join("\n  ")).toEqual([]);
  });

  it("у каждой платной подписки есть чем удерживать доступ", () => {
    const gated = platformGated();
    const bad = pricedModules()
      .filter((m) => !BUNDLES.has(m.app) && !KNOWN_WITHOUT[m.app])
      .filter((m) => !canWithhold(m.app, gated))
      .map((m) => `${m.app} ($${m.price}/мес) — ни платформенного сторожа, ни своего примитива`);

    expect(
      bad,
      "продаётся подписка, которая ничего не удерживает:\n  " + bad.join("\n  ") +
        "\nЛибо добавьте модуль в MODULE_GATE_PREFIXES (index.ts), либо проверяйте " +
        "оплату в своих маршрутах, либо снимите его с продажи.",
    ).toEqual([]);
  });

  it("известные случаи ОТПУСКАЮТСЯ, как только механизм появится", () => {
    const gated = platformGated();
    const fixed = Object.keys(KNOWN_WITHOUT).filter((app) => canWithhold(app, gated));
    expect(
      fixed,
      "у этих модулей механизм ПОЯВИЛСЯ — уберите их из KNOWN_WITHOUT, иначе сторож " +
        "перестанет за ними следить:\n  " + fixed.join("\n  "),
    ).toEqual([]);
  });
});
