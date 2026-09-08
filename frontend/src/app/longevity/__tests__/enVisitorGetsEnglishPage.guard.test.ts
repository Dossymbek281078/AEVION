import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Посетитель с выбранным английским получает английскую страницу.
 *
 * ЗАЧЕМ. Замер 06.09.2026 (EN-свип): /longevity под cookie en отдавала 75 %
 * кириллицы при ЖИВОЙ /en/longevity — англоязычный покупатель книги читал
 * русский протокол. Починка — серверный redirect по cookie `aevion_lang_v1`
 * (та, которую пишет общий переключатель).
 *
 * ГРАНИЦА ЧЕСТНО: сторож исходникового уровня — он закрепляет, что редирект
 * НЕ ИСЧЕЗ и стоит ДО платной стены и до учёта (иначе просмотр считался бы
 * дважды). Что редирект работает НА ПРОДЕ, проверяется living-пробой:
 *   curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
 *     -H "Cookie: aevion_lang_v1=en" https://aevion.app/longevity
 * — ждём 3xx на /en/longevity.
 */
import { stripComments } from "../../__tests__/helpers/sourceCode";

const HERE = dirname(fileURLToPath(import.meta.url));
// Комментарии вырезаем: литералы (имя cookie, адрес) живут и в пояснениях,
// и сторож по сырому исходнику был бы зелёным при удалённом КОДЕ — поймано
// мутацией при создании этого файла.
const src = stripComments(readFileSync(join(HERE, "..", "page.tsx"), "utf8"));

describe("языковая маршрутизация /longevity", () => {
  it("читает cookie языка и уводит en-посетителя на /en/longevity", () => {
    expect(src).toContain('aevion_lang_v1');
    expect(src).toContain('redirect(');
    expect(src).toContain('/en/longevity');
  });

  it("редирект стоит ДО платной стены и ДО учёта просмотра", () => {
    const iRedirect = src.indexOf("redirect(");
    const iPaywall = src.indexOf("fetchOrPaywall(");
    const iTracking = src.indexOf("<PageTracking");
    expect(iRedirect).toBeGreaterThan(-1);
    expect(iPaywall).toBeGreaterThan(-1);
    expect(iRedirect, "redirect должен идти раньше платной стены").toBeLessThan(iPaywall);
    expect(iRedirect, "redirect должен идти раньше учёта просмотра").toBeLessThan(iTracking);
  });

  it("метка канала не теряется при редиректе", () => {
    // Покупка с английской страницы без метки пришла бы «источник неизвестен».
    expect(src).toMatch(/\/en\/longevity\?c=/);
  });

  it("обе ветки редиректа ведут на английскую страницу", () => {
    // Веток две (с меткой канала и без) — подмена адреса в ОДНОЙ из них
    // прошла бы мимо проверок выше: поймано мутацией 06.09 при создании
    // этого сторожа (адрес без-канальной ветки заменён — сторож был зелёным).
    const вхождений = (src.match(/\/en\/longevity/g) || []).length;
    expect(вхождений, "оба адреса редиректа должны вести на /en/longevity").toBeGreaterThanOrEqual(2);
  });
});
