/**
 * Денежная плашка называет ТО, что откроется по ссылке — ступень и сумму.
 *
 * 🔴 Замер 07.10.2026 (нашёл оркестратор, проверено числами). Кнопка плашки
 * говорила «Оформить Pro — $200/мес». По таблице цен «pro» — это СРОК 6 месяцев
 * с множителем 0.75, то есть $150/мес и $900 всего; $200/мес — это Lite (1 мес,
 * множитель 1), и именно Lite открывается по ссылке: страница цен поднимается со
 * сроком по умолчанию. Человек читал одну ступень, а открывал другую — тот же
 * класс, что «обещание и списание расходятся».
 *
 * Сторож связывает ТРИ вещи, которые раньше жили отдельно: подпись кнопки,
 * таблицу цен и срок, который реально открывается. Любая расходится — краснеет.
 */
import { describe, it, expect } from "vitest";
import { PRICING_TIERS_LIST } from "@/lib/products";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  СРОК_ПО_УМОЛЧАНИЮ,
  TERM_MONTHS,
  TERM_NAME,
  termPricePerMonth,
  termTotal,
  standaloneApp,
  PLANET_TERM_PRICE,
  planetFromPerMonth,
  planetPricePerMonth,
} from "../../../lib/termPricing";
import { tDevhub } from "../i18n";

const БАЗА = standaloneApp("devhub")!.baseMonthly;

describe("плашка называет то, что откроется", () => {
  it("данные цен прочитаны", () => {
    // Контроль прибора: без базы все суммы ниже были бы NaN, а проверки зелёными.
    expect(БАЗА, "цена DevHub в таблице сроков не прочитана").toBeGreaterThan(0);
    expect(TERM_MONTHS[СРОК_ПО_УМОЛЧАНИЮ], "у срока по умолчанию нет длины").toBeGreaterThan(0);
  });

  it("срок по умолчанию один на страницу цен и на плашку", () => {
    /*
     * Раньше он жил литералом в pricing/page.tsx, а плашка о нём не знала —
     * именно это расхождение и дало ложную подпись. Теперь источник один, и
     * проверка следит, чтобы литерал не вернулся.
     */
    const цены = readFileSync(join(process.cwd(), "src", "app", "pricing", "page.tsx"), "utf8");
    expect(цены, "страница цен снова задаёт срок литералом вместо общего источника")
      .toContain("useState<TermTier>(СРОК_ПО_УМОЛЧАНИЮ)");
  });

  it.each(["ru", "en", "kk"])("подпись на %s не называет чужую ступень", (lang) => {
    const t = (k: string) => tDevhub(lang, k);
    const подпись = t("pro.upgrade");
    // Ни одно имя срока, КРОМЕ открываемого, в подписи стоять не должно.
    const чужие = Object.entries(TERM_NAME)
      .filter(([ключ]) => ключ !== СРОК_ПО_УМОЛЧАНИЮ)
      .map(([, имя]) => имя)
      .filter((имя) => new RegExp("(?:^|[^a-zA-Zа-яА-Я])" + имя + "(?:[^a-zA-Zа-яА-Я]|$)").test(подпись));
    expect(чужие, `подпись «${подпись}» называет ступень, которая по ссылке не откроется`).toEqual([]);
  });

  /*
   * 20.10.2026, решение Оркестратора: кнопка обещала «$250/мес», а вела к карточке
   * Max и кассе за $150/мес с годовым сроком (priemka-devhub-kassa.mjs: Pay 150,00 $).
   * Теперь: «от $150/мес» → начало списка сроков #tiers, и рядом обе цены — без
   * обязательства и на 12 мес. Обе берутся из лесенки плана, не числом.
   */
  it.each(["ru", "en", "kk"])("строка рядом с кнопкой на %s называет цену без обязательства и на 12 мес", (lang) => {
    const шаблон = tDevhub(lang, "pro.termRange");
    expect(шаблон).toMatch(/\{max\}/);
    expect(шаблон).toMatch(/\{min\}/);
    expect(шаблон).toContain("12");
    expect(tDevhub(lang, "pro.fromPrice")).toMatch(/\{p\}/);
  });

  it.each(["src/app/devhub/page.tsx", "src/app/devhub/[id]/page.tsx"])(
    "%s: кнопка ведёт к списку сроков (#tiers) и говорит «от» по самой низкой цене плана",
    (путь) => {
      const код = readFileSync(join(process.cwd(), ...путь.split("/")), "utf8");
      // 20.10.2026: адрес — из константы PRICING_TIERS_LIST (lib/products), литерал запрещён сторожем pricingTiersLiteralsGone.
      expect(код).toContain("const PLANET_TERMS_LIST = PRICING_TIERS_LIST");
      expect(PRICING_TIERS_LIST).toBe("/pricing#tiers");
      expect(код).toContain("href={PLANET_TERMS_LIST}");
      expect(код, "кнопка снова ведёт к кнопке Max, минуя выбор срока").not.toContain("href={STUDIO_PRO.href}");
      expect(код).toMatch(/pro\.fromPrice"\)\.replace\("\{p\}", `\$\$\{planetFromPerMonth\(\)\}`\)/);
      expect(код).toMatch(/pro\.termRange"\)\.replace\("\{max\}"/);
    },
  );

  it("«от» — действительно самая низкая месячная цена лесенки, «без обязательства» — самая высокая", () => {
    const цены = Object.values(PLANET_TERM_PRICE);
    expect(planetFromPerMonth()).toBe(Math.min(...цены));
    expect(planetPricePerMonth(СРОК_ПО_УМОЛЧАНИЮ)).toBe(Math.max(...цены));
  });

  it.each([
    ["src/app/devhub/page.tsx", "pricePerMonth"],
    ["src/app/devhub/[id]/page.tsx", "pricePerMonth"],
  ])("%s берёт цену из данных, а не числом", (путь, имя) => {
    const код = readFileSync(join(process.cwd(), ...путь.split("/")), "utf8");
    /*
     * Форма проверяется ПО СМЫСЛУ, а не дословно: 07.10 цена переехала из
     * константы модуля в функцию, принимающую товар (STUDIO_PRO может быть
     * undefined, и проверка типов справедливо требовала это учесть). Важно одно:
     * цена считается termPricePerMonth от цены ИЗ КАТАЛОГА и общего срока.
     */
    expect(код, `${путь}: цена в кнопке не вычисляется из таблицы цен`).toMatch(
      /(termPricePerMonth\([^)]*priceUsd, СРОК_ПО_УМОЛЧАНИЮ\)|planetPricePerMonth\(СРОК_ПО_УМОЛЧАНИЮ\))/, // 19.10: на /devhub — план
    );
    expect(код, `${путь}: в разметке не видно расчёта цены`).toMatch(new RegExp(имя));
    // И прямое число в подписи — запрещено: оно разойдётся при смене цены.
    expect(код, `${путь}: в подписи кнопки стоит число вместо расчёта`).not.toMatch(
      /pro\.upgrade"\)\} — \{?`?\$\$?\{?\d/,
    );
  });

  it("цена за месяц и итог совпадают с таблицей цен", () => {
    const заМесяц = termPricePerMonth(БАЗА, СРОК_ПО_УМОЛЧАНИЮ);
    const итог = termTotal(БАЗА, СРОК_ПО_УМОЛЧАНИЮ);
    expect(итог, "итог не равен цене за месяц, умноженной на длину срока")
      .toBe(заМесяц * TERM_MONTHS[СРОК_ПО_УМОЛЧАНИЮ]);
  });
});
