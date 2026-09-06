import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../../__tests__/helpers/sourceCode";

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
    // Покупка с английской страницы без метки пришла бы «источник неизвестен».
    expect(тело).toMatch(/\/en\/go\?c=/);
  });

  it("обе ветки редиректа ведут на английскую страницу", () => {
    // Веток две (с меткой канала и без) — подмена адреса в одной прошла бы
    // мимо проверок выше (поймано мутацией у сторожа /longevity).
    const вхождений = (тело.match(/\/en\/go/g) || []).length;
    expect(вхождений, "оба адреса редиректа должны вести на /en/go").toBeGreaterThanOrEqual(2);
  });
});
