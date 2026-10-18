import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 146 (18.10.2026). Замер на проде 5aa03bb5e (прибор первого экрана, 390×844 и 1463×724): гость на /qnews видел в
 * первом экране только «× / Войти под почтой оплаты / Перейти к тарифам / Позже» — запрос ленты при монтировании
 * отвечал 402, глобальный перехватчик поднимал PaywallModal без жеста человека. Страница при этом САМА показывает
 * отказ на месте ленты (articlesState "paywall", введено 28.08.2026). Запросы загрузки помечены ТИХАЯ_СТЕНА: на их
 * 402 модалка не поднимается; действия человека (закладка, дайджест, публикация) метки не несут — там модалка объясняет отказ.
 */
const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("146: загрузка qnews не поднимает модалку стены", () => {
  test("🔴 три запроса загрузки помечены ТИХАЯ_СТЕНА", () => {
    expect(src).toContain('import { ТИХАЯ_СТЕНА } from "@/lib/paywall";');
    expect(src).toContain('const resp = await fetch(url, { headers: getAuthHeaders(), ...ТИХАЯ_СТЕНА });');
    expect(src).toContain('const resp = await fetch(apiUrl("/api/qnews/trending"), { headers: getAuthHeaders(), ...ТИХАЯ_СТЕНА });');
    expect(src).toContain('const resp = await fetch(apiUrl("/api/qnews/stats"), { headers: getAuthHeaders(), ...ТИХАЯ_СТЕНА });');
  });
  test("🔴 страница по-прежнему показывает отказ сама: состояние paywall у ленты осталось", () => {
    expect(src).toContain('setArticlesState("paywall")');
    expect(src).toContain('articlesState === "paywall"');
  });
  test("КОНТРОЛЬ: действия человека метки не несут (закладка, дайджест, публикация)", () => {
    const действия = src.match(/fetch\(apiUrl\(`\/api\/qnews\/articles\/\$\{articleId\}\/bookmark`\)[\s\S]{0,200}/)?.[0] ?? "";
    expect(действия).not.toContain("ТИХАЯ_СТЕНА");
    const дайджест = src.match(/fetch\(apiUrl\("\/api\/qnews\/ai\/digest"\)[\s\S]{0,200}/)?.[0] ?? "";
    expect(дайджест).not.toContain("ТИХАЯ_СТЕНА");
    expect(src.split("ТИХАЯ_СТЕНА").length - 1, "ровно import + 3 запроса загрузки").toBe(4);
  });
});
