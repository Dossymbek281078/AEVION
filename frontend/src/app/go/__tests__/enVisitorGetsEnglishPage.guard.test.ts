import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../../__tests__/helpers/sourceCode";
import { channelFrom, keepChannel } from "@/lib/products";

/**
 * Посетитель с выбранным английским получает английскую страницу.
 *
 * ЗАЧЕМ. Замер 06.09.2026 (EN-свип): /go — ГЛАВНЫЙ вход воронки,
 * единственная ссылка в шапках соцсетей — под cookie en отдавала 95 %
 * кириллицы при живой /en/go. Починка — серверный redirect по cookie
 * `aevion_lang_v1` (та, которую пишет общий переключатель); образец —
 * enVisitorGetsEnglishPage у /longevity (мутации пойманы там же).
 *
 * ГРАНИЦА ЧЕСТНО: сторож исходникового уровня — закрепляет, что редирект
 * НЕ ИСЧЕЗ и стоит ДО похода в API за модулями и до учёта просмотра.
 * Что редирект работает НА ПРОДЕ, проверяет living-проба:
 *   curl -s -o /dev/null -w "%{http_code} %{redirect_url}"
 *     -H "Cookie: aevion_lang_v1=en" https://aevion.app/go
 * — ждём 3xx на /en/go.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// Комментарии вырезаем: литералы живут и в пояснениях, и сторож по сырому
// исходнику был бы зелёным при удалённом коде (урок сторожа /longevity).
const src = stripComments(readFileSync(join(HERE, "..", "page.tsx"), "utf8"));
// Порядок меряем по ТЕЛУ КОМПОНЕНТА: fetchLiveModules определяется выше по
// файлу, и indexOf от нуля нашёл бы определение, а не вызов (поймано красным
// первого прогона этого сторожа).
const тело = src.slice(src.indexOf("export default"));

describe("языковая маршрутизация /go", () => {
  it("читает cookie языка и уводит en-посетителя на /en/go", () => {
    expect(тело).toContain('aevion_lang_v1');
    expect(тело).toContain('redirect(');
    expect(тело).toContain('/en/go');
  });

  it("редирект стоит ДО похода в API и ДО учёта просмотра", () => {
    const iRedirect = тело.indexOf("redirect(");
    const iFetch = тело.indexOf("fetchLiveModules(");
    const iTracking = тело.indexOf("<PageTracking");
    expect(iRedirect).toBeGreaterThan(-1);
    expect(iFetch, "вызов fetchLiveModules должен быть в теле компонента").toBeGreaterThan(-1);
    expect(iRedirect, "redirect должен идти раньше похода в API за модулями").toBeLessThan(iFetch);
    expect(iRedirect, "redirect должен идти раньше учёта просмотра").toBeLessThan(iTracking);
  });

  it("метка канала не теряется при редиректе", () => {
    /*
     * Покупка с английской страницы без метки пришла бы «источник неизвестен».
     *
     * 30.09.2026 проверка переписана. Раньше она искала в исходнике строку
     * `/en/go?c=` — и эта строка описывала ОШИБОЧНУЮ сборку: в адрес
     * подставлялось длинное имя канала (`?c=instagram`), которого сайт не
     * понимал, и метка всё равно терялась. То есть проверка была зелёной на
     * дефекте, потому что смотрела на форму записи, а не на результат.
     *
     * Теперь: адрес собирает общая функция, а результат проверяется разбором.
     */
    expect(
      /keepChannel(OrProbe)?\("\/en\/go"/.test(тело),
      "адрес редиректа снова собирается вручную — длинное имя вернётся",
    ).toBe(true);
    const адрес = keepChannel("/en/go", channelFrom("ig"));
    const u = new URL(адрес, "https://aevion.app");
    expect(u.pathname).toBe("/en/go");
    expect(u.searchParams.get("c"), `метка не доехала: ${адрес}`).toBe("ig");
  });

  it("обе ветки редиректа ведут на английскую страницу", () => {
    // Веток две (с меткой канала и без) — подмена адреса в одной прошла бы
    // мимо проверок выше (поймано мутацией у сторожа /longevity). После
    // перехода на keepChannel обе ветки собирает ОДНА строка, поэтому считаем
    // адреса и в ней, и в запасной.
    const вхождений = (тело.match(/\/en\/go/g) || []).length;
    expect(вхождений, "адрес редиректа должен вести на /en/go").toBeGreaterThanOrEqual(1);
    const безКанала = new URL(keepChannel("/en/go", null), "https://aevion.app");
    expect(безКанала.pathname, "ветка без канала ведёт не туда").toBe("/en/go");
  });
});
