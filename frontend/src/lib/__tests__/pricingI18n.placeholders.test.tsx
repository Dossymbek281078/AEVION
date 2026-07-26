import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { usePricingT } from "@/lib/pricingI18n";
import { fanDict } from "@/lib/pricingI18n/sections/fan";

/**
 * Регрессия 2026-07-26, найденная взглядом на живую стену 402: в интерфейс
 * покупателя уехал текст «$12.35/мес вместо {cur}19».
 *
 * Причина была в самом хелпере: подстановка шла через `String.replace` со
 * СТРОКОВЫМ шаблоном, а он заменяет только ПЕРВОЕ вхождение. Ключ
 * `fan.paywall.offer` содержит `{cur}` дважды. Ничего не падало — просто
 * покупателю показывали фигурные скобки.
 *
 * Это дефект всей pricing-локализации, не только веера, поэтому тест проверяет
 * и общий контракт хелпера, и конкретные ключи словаря.
 */

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

function tp() {
  return renderHook(() => usePricingT(), { wrapper }).result.current;
}

describe("usePricingT — подстановка плейсхолдеров", () => {
  it("заменяет ВСЕ вхождения одного плейсхолдера, а не первое", () => {
    const t = tp();
    const out = t("fan.paywall.offer", { module: "qcontract", cur: "$", price: 12.35, list: 19 });
    expect(out).toContain("$12.35");
    expect(out).toContain("$19");
    expect(out).not.toMatch(/\{[a-z]+\}/i);
  });

  it("ни один ключ словаря веера не оставляет неподставленных скобок", () => {
    const t = tp();
    const vars = {
      module: "qsign", cur: "$", price: 6.3, list: 9, n: 3,
      days: 14, sum: 26.4, date: "09.08.2026", percent: 35, reason: "тест",
    };
    const leftovers: string[] = [];
    for (const key of Object.keys(fanDict.en)) {
      const out = t(key, vars);
      if (/\{[a-z]+\}/i.test(out)) leftovers.push(`${key} → ${out}`);
    }
    expect(leftovers).toEqual([]);
  });

  it("ключ без переменных возвращается как есть, а неизвестный ключ — сам ключ", () => {
    const t = tp();
    expect(t("fan.badge")).toBe(fanDict.en["fan.badge"]);
    expect(t("нет.такого.ключа")).toBe("нет.такого.ключа");
  });

  it("ru и en словари веера описывают одни и те же ключи", () => {
    // Расхождение = у части языков строка молча падает на английский fallback,
    // и половина блока оказывается на другом языке — как было в constitution.
    expect(Object.keys(fanDict.ru).sort()).toEqual(Object.keys(fanDict.en).sort());
  });
});
