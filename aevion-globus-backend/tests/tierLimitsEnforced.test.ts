import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Объявленный в тарифе лимит должен где-то применяться.
 *
 * Найдено 28.07 при сверке витрины с фактом: тарифы обещают «QRight — до 10
 * объектов в месяц», «QSign — 1 подпись в день» (Free), «100 в день» (Medium),
 * а ключи `qrightObjectsPerMonth` и `qsignOpsPerDay` не встречаются в коде НИ
 * РАЗУ за пределами самого прайс-листа. То есть ограничение существует только
 * на витрине.
 *
 * Клиента это не обманывает — он получает больше обещанного. Плохо другое:
 * написанное не работает, и в день, когда лимит захотят включить, пользователи
 * упрутся в него неожиданно. А ещё такие «спящие» лимиты создают ложное
 * ощущение, что монетизация настроена.
 *
 * Поэтому проверка простая: у каждого числового лимита в TIERS должно быть
 * применение в коде. Не хотите применять — уберите из тарифа или впишите сюда
 * с причиной. Молчаливое расхождение витрины и кода — то, из-за чего сегодня
 * пришлось править обещания в пяти местах.
 */

const SRC = join(process.cwd(), "src");
const PRICING_FILE = join(SRC, "data", "pricing.ts");

/** Лимиты, которые НЕ должны иметь технического применения — с причиной. */
const NOT_ENFORCED_BY_DESIGN: Record<string, string> = {
  seats: "число мест — коммерческая договорённость, параллельные сессии технически не режем",
  supportSlaHours: "срок ответа поддержки — обязательство человека, не кода",
  modules: "проверяется планом доступа (planGate), а не числом в limits",
};

/**
 * Известный ДОЛГ, а не решение: лимит обещан на витрине, но счётчика нет.
 *
 * Отличается от NOT_ENFORCED_BY_DESIGN тем, что это временно и должно быть
 * закрыто — либо реализацией, либо удалением обещания из тарифа. Второе —
 * решение основателя (состав тарифа), поэтому вынесено ему, а не сделано
 * молча.
 *
 * Ниже есть отдельная проверка на ТОЧНЫЙ состав этого списка: появится третий
 * пробел — тест упадёт; закроют существующий — тоже упадёт и потребует убрать
 * запись. Так долг не растёт незаметно и не забывается после погашения.
 */
const KNOWN_GAP: Record<string, string> = {
  qrightObjectsPerMonth: "Free обещает «до 10 объектов/месяц» — счётчика нет",
  qsignOpsPerDay: "Free/Lite/Medium обещают 1/25/100 подписей в день — счётчика нет",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...walk(full));
      continue;
    }
    if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** Имена числовых лимитов, объявленных в прайс-листе. */
export function declaredLimitKeys(pricingSource: string): string[] {
  const block = pricingSource.match(/limits:\s*\{[\s\S]*?\}/g) ?? [];
  const keys = new Set<string>();
  for (const b of block) {
    for (const m of b.matchAll(/(\w+):\s*(?:\d|null)/g)) keys.add(m[1]);
  }
  return [...keys];
}

describe("объявленные лимиты тарифов применяются в коде", () => {
  const pricing = readFileSync(PRICING_FILE, "utf8");
  const keys = declaredLimitKeys(pricing);
  const files = walk(SRC).filter((f) => f !== PRICING_FILE);
  const haystack = files.map((f) => readFileSync(f, "utf8")).join("\n");

  it("прайс-лист вообще разобран (иначе проверка молча пуста)", () => {
    expect(keys.length).toBeGreaterThan(3);
    expect(keys).toContain("llmTokensPerMonth");
  });

  it("у каждого лимита есть применение вне прайс-листа", () => {
    const dangling = keys
      .filter((k) => !(k in NOT_ENFORCED_BY_DESIGN))
      .filter((k) => !(k in KNOWN_GAP))
      .filter((k) => !haystack.includes(k));

    expect(
      dangling,
      `Эти лимиты объявлены в тарифе, но нигде не применяются:\n  ${dangling.join("\n  ")}\n\n` +
        "Либо примените их, либо уберите из прайс-листа, либо впишите в " +
        "NOT_ENFORCED_BY_DESIGN в этом файле С ПРИЧИНОЙ. Обещание, которого нет " +
        "в коде, рано или поздно превращается в претензию.",
    ).toEqual([]);
  });

  // Долг зафиксирован поимённо: и рост, и погашение обязаны быть замечены.
  it("состав известных пробелов не изменился незаметно", () => {
    const actualGaps = keys.filter((k) => !(k in NOT_ENFORCED_BY_DESIGN)).filter((k) => !haystack.includes(k));
    expect(
      actualGaps.sort(),
      "Список неприменяемых лимитов изменился. Если пробел закрыт — уберите ключ " +
        "из KNOWN_GAP. Если появился новый — либо реализуйте, либо впишите с причиной.",
    ).toEqual(Object.keys(KNOWN_GAP).sort());
  });

  it("список исключений не пустеет молча — у каждого есть причина", () => {
    for (const [k, why] of Object.entries(NOT_ENFORCED_BY_DESIGN)) {
      expect(why.length, `у исключения ${k} нет внятной причины`).toBeGreaterThan(20);
    }
  });
});
