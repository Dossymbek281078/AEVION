import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * У каждого платного тарифа есть путь оплаты — или он назван здесь поимённо.
 *
 * 🔴 ЗАЧЕМ. Замер 08.09.2026: витрина продаёт тариф `pro` за $149/мес, а
 * ключей `tier_pro_monthly` / `tier_pro_annual` в таблице ссылок оплаты нет
 * вовсе — там живут варианты старого имени `planet`. Ни Gumroad
 * (GUMROAD_PERMALINK_TIER_PRO_* и GUMROAD_DEFAULT_PERMALINK не заданы на
 * проде), ни Paddle (провайдер удалён, PADDLE_PRICE_* не используется нигде
 * в src) пути не дают. Покупатель верхнего тарифа получает честный отказ
 * 503 «платёжный вариант не настроен, деньги не списаны» — то есть
 * флагманский тариф продаётся только вручную через переписку.
 *
 * ПОЧЕМУ НЕ ЛОВИЛОСЬ. Ручка checkout/healthz проверяет СВОЮ таблицу ссылок
 * на связность и говорит «sellable.missing = []» — она не знает списка
 * тарифов витрины. Два списка ведут разные файлы, а пересечение не считает
 * никто. Сторож наборов (frontend bundleCheckoutMatchesItsPrice) прямо
 * пишет в своей границе: «у тарифов ссылка строится иначе, и молчание
 * сторожа о них — честное "не проверял"». Этот файл закрывает ровно ту щель.
 *
 * ЧЕГО ЭТОТ ФАЙЛ НЕ РЕШАЕТ. Заводить ли вариант оплаты для `pro`,
 * переименовывать ли тариф в `planet`, менять ли цену — решение основателя
 * (цена и состав пакетов, правило 6 стандарта). Поэтому известные случаи
 * перечислены в ИЗВЕСТНЫЕ и сторож на них не краснеет: аудит, который
 * всегда красный, перестают читать. Его работа — не дать ПЯТОМУ тарифу
 * появиться без кассы незамеченно.
 */

const BACKEND = join(__dirname, "..");
const PRICING = join(BACKEND, "src/data/pricing.ts");
const VARIANTS = join(BACKEND, "src/data/lemonSqueezyVariants.ts");

/**
 * Известные тарифы без пути оплаты — ждут решения основателя.
 * Строка живёт здесь ровно до того дня, когда касса заведена.
 */
const ИЗВЕСТНЫЕ: Record<string, string> = {
  pro: "08.09.2026: $149/мес, вариантов LS нет (живы tier_planet_* от старого имени); "
    + "покупка даёт честный 503, доступ оформляется вручную. Решение — основателя: "
    + "завести вариант под pro либо согласовать переименование в planet.",
};

/** Платные тарифы витрины: id и месячная цена из pricing.ts. */
function платныеТарифы(src: string): Array<{ id: string; price: number }> {
  // Читаем ТОЛЬКО массив TIERS. Соседний BUNDLES («готовые сборки» IP/AI/
  // Fintech Suite) исключён намеренно: у наборов касса строится другим путём —
  // пермалинком Gumroad, а не ключом tier_*, — и расхождение их цены со
  // ссылкой уже найдено 02.09.2026 и закреплено своим сторожем
  // (frontend bundleCheckoutMatchesItsPrice). Считать их здесь значило бы
  // второй раз поднимать чужую известную находку и держать файл вечно красным.
  const начало = src.indexOf("export const TIERS");
  if (начало < 0) return [];
  const конец = src.indexOf("export const ", начало + 10);
  const блок = src.slice(начало, конец < 0 ? src.length : конец);

  const out: Array<{ id: string; price: number }> = [];
  const re = /id:\s*"([a-z][a-z-]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(блок))) {
    // цена ищется в окне ПОСЛЕ id — так же, как её читает человек в файле
    const price = блок.slice(m.index, m.index + 900).match(/priceMonthly:\s*([0-9.]+)/);
    if (price && Number(price[1]) > 0) out.push({ id: m[1], price: Number(price[1]) });
  }
  return out;
}

describe("платный тариф не остаётся без кассы незамеченно", () => {
  const pricing = readFileSync(PRICING, "utf8");
  const variants = readFileSync(VARIANTS, "utf8");
  const tiers = платныеТарифы(pricing);

  it("прибор видит предмет: тарифы найдены, таблица ссылок прочитана", () => {
    // без этого «ноль находок» означал бы «не умею искать», а не «всё хорошо»
    expect(tiers.length).toBeGreaterThanOrEqual(3);
    expect(tiers.map((t) => t.id)).toContain("full");
    // положительный контроль: ключ, который в таблице ТОЧНО есть
    expect(variants).toContain('"tier_full_monthly"');
    // отрицательный: выдуманного там быть не должно
    expect(variants).not.toContain('"tier_zzz_monthly"');
  });

  it("у каждого платного тарифа есть ссылка оплаты или он назван в ИЗВЕСТНЫЕ", () => {
    const новые: string[] = [];
    for (const t of tiers) {
      const есть = variants.includes(`"tier_${t.id}_monthly"`)
        || variants.includes(`"tier_${t.id}_annual"`);
      if (есть || ИЗВЕСТНЫЕ[t.id]) continue;
      новые.push(`${t.id} ($${t.price}/мес) — ключа tier_${t.id}_* в таблице оплаты нет`);
    }
    expect(
      новые,
      "платный тариф без пути оплаты: покупатель увидит отказ 503, а продажа не состоится.\n"
      + новые.join("\n")
      + "\nЛибо заведите вариант оплаты, либо впишите тариф в ИЗВЕСТНЫЕ с причиной и датой.",
    ).toEqual([]);
  });

  it("список ИЗВЕСТНЫЕ не переживает свою причину", () => {
    // тариф, у которого касса появилась, обязан уйти из списка — иначе
    // исключение молча защищает уже исправленное и прячет новый случай
    const лишние = Object.keys(ИЗВЕСТНЫЕ).filter(
      (id) => variants.includes(`"tier_${id}_monthly"`) || variants.includes(`"tier_${id}_annual"`),
    );
    expect(лишние, `у этих тарифов касса уже есть — уберите их из ИЗВЕСТНЫЕ: ${лишние.join(", ")}`)
      .toEqual([]);
  });
});
