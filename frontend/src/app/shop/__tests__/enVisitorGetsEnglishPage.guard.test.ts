import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../../__tests__/helpers/sourceCode";

/**
 * Посетитель с выбранным английским получает английскую витрину.
 *
 * ЗАЧЕМ. Замер EN-свипа 06.09.2026: /shop под cookie en отдавала 73 %
 * кириллицы — худшая ДЕНЕЖНАЯ страница для en-покупателя. Починка —
 * серверный redirect по cookie `aevion_lang_v1` на /en/shop; третий случай
 * приёма (образцы /longevity и /go, мутации пойманы там).
 *
 * ГРАНИЦА ЧЕСТНО: сторож исходникового уровня. Живую работу на проде
 * проверяет проба: curl -H "Cookie: aevion_lang_v1=en" https://aevion.app/shop
 * → ждём 3xx на /en/shop.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// Комментарии вырезаны: литералы живут и в пояснениях (урок сторожей
// /longevity и /go — оба раза ловилось мутацией).
const src = stripComments(readFileSync(join(HERE, "..", "page.tsx"), "utf8"));
const тело = src.slice(src.indexOf("export default"));

describe("языковая маршрутизация /shop", () => {
  it("читает cookie языка и уводит en-посетителя на /en/shop", () => {
    expect(тело).toContain('aevion_lang_v1');
    expect(тело).toContain('redirect(');
    expect(тело).toContain('/en/shop');
  });

  it("редирект стоит ДО учёта просмотра", () => {
    const iRedirect = тело.indexOf("redirect(");
    const iTracking = тело.indexOf("<PageTracking");
    expect(iRedirect).toBeGreaterThan(-1);
    expect(iTracking).toBeGreaterThan(-1);
    expect(iRedirect, "redirect должен идти раньше учёта просмотра").toBeLessThan(iTracking);
  });

  it("метка канала не теряется при редиректе", () => {
    expect(тело).toMatch(/\/en\/shop\?c=/);
  });

  it("обе ветки редиректа ведут на английскую витрину", () => {
    const вхождений = (тело.match(/\/en\/shop/g) || []).length;
    expect(вхождений, "оба адреса редиректа должны вести на /en/shop").toBeGreaterThanOrEqual(2);
  });
});
