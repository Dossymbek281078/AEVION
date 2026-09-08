import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./helpers/sourceCode";

/**
 * Пробный период не обещают, пока его не умеет расчёт цены.
 *
 * 🔴 ЗАЧЕМ. Замер 08.09.2026, пройден как покупатель. Восемь страниц модулей
 * держали кнопку «…Pro — 14 дней бесплатно», которая ведёт в товар Gumroad
 * `xpxzam`. Проверено отрисовкой самой кассы: карточка товара говорит «$59 a
 * month / Subscribe», касса — «US$59 Monthly, Total US$59». Ни слова о
 * пробном периоде ни там, ни там: человек жмёт «бесплатно» и попадает на
 * немедленную оплату. Обещания убраны этим же коммитом.
 *
 * Соседний случай на /pricing (кнопка из словаря `tier.tryTrial`) НЕ трогаем:
 * он найден 04.09.2026 и разобран прямо в checkout.ts — «trial: true и
 * trial: false дают полностью одинаковый ответ», расчёт о пробном периоде не
 * знает, и поведение осознанно оставлено решению основателя (пробный период
 * может жить и на стороне товара у провайдера, чего из кода не видно). Он в
 * ИЗВЕСТНЫЕ ниже.
 *
 * ЧТО СТЕРЕЖЁТ ЭТОТ ФАЙЛ: чтобы ДЕВЯТАЯ кнопка с обещанием пробного периода
 * не появилась там, где его нет. Признак берём из источника, а не из своей
 * копии: пробный период считается существующим, когда о нём знает расчёт
 * цены (`aevion-globus-backend/src/data/pricing.ts`). Сегодня там ноль
 * упоминаний — ровно поэтому обещание и было пустым.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const SRC = join(APP, "..");
const PRICING_DATA = join(SRC, "../../aevion-globus-backend/src/data/pricing.ts");

/** Обещания пробного периода в тексте, который увидит человек. */
const ОБЕЩАНИЯ = ["14 дней бесплатно", "14-day free trial", "14 days free"];

/**
 * Места, где обещание оставлено сознательно и ждёт решения основателя.
 * Строка уходит отсюда в тот день, когда пробный период либо заработает,
 * либо будет снят.
 */
const ИЗВЕСТНЫЕ = [
  // словарь страницы цен: разобрано 04.09.2026 в checkout.ts, решение за
  // основателем — включить пробный период у провайдера или убрать кнопку
  "lib/pricingI18n.ts",
  // запись журнала изменений — историческая, описывает объявленную функцию
  "lib/i18n-lang/ru.ts",
  "lib/i18n-lang/en.ts",
];

function собрать(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== "node_modules" && e !== "__tests__") собрать(p, out);
    } else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

describe("обещание пробного периода не расходится с расчётом цены", () => {
  const файлы = собрать(SRC);

  it("прибор видит предмет: исходники найдены, расчёт цены прочитан", () => {
    expect(файлы.length).toBeGreaterThan(300);
    // положительный контроль: обещание ЕСТЬ хотя бы в одном известном месте —
    // иначе «ноль находок» означал бы «не умею искать»
    const словарь = readFileSync(join(SRC, "lib/pricingI18n.ts"), "utf8");
    expect(словарь).toContain("14 дней бесплатно");
  });

  it("пробный период не обещают там, где расчёт цены о нём не знает", () => {
    const расчёт = readFileSync(PRICING_DATA, "utf8");
    const умеет = /trial/i.test(расчёт);
    if (умеет) return; // пробный период появился — обещать можно, сторож молчит

    const нарушители: string[] = [];
    for (const f of файлы) {
      const rel = relative(SRC, f).split(String.fromCharCode(92)).join("/");
      if (ИЗВЕСТНЫЕ.some((k) => rel.endsWith(k))) continue;
      // комментарии не считаем: там объясняют прошлые дефекты этими же словами
      const код = stripComments(readFileSync(f, "utf8"));
      for (const о of ОБЕЩАНИЯ) {
        if (код.includes(о)) { нарушители.push(`${rel} → «${о}»`); break; }
      }
    }
    expect(
      нарушители,
      "кнопка обещает пробный период, которого нет: расчёт цены о нём не знает, "
      + "и покупатель попадает на немедленную оплату.\n" + нарушители.join("\n"),
    ).toEqual([]);
  });

  it("список ИЗВЕСТНЫЕ не переживает свою причину", () => {
    const мёртвые = ИЗВЕСТНЫЕ.filter((k) => {
      try { return !readFileSync(join(SRC, k), "utf8").match(/14 дней бесплатно|14-day free trial/); }
      catch { return true; }
    });
    expect(мёртвые, `в этих местах обещания уже нет — уберите из ИЗВЕСТНЫЕ: ${мёртвые.join(", ")}`)
      .toEqual([]);
  });
});
