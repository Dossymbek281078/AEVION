import { describe, test, expect, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { ProductNotice } from "../ProductNotice";
import { I18nProvider } from "@/lib/i18n";
import { MODULE_NOTICES, MODULE_NOTICES_I18N, productNoticeIn } from "@/lib/products";

/**
 * Оговорка модуля на языке страницы (28.10.2026).
 *
 * Замер прибором пути на проде: /qcontract на en и kk показывал русскую плашку
 * «Демонстрационный режим…» — человек без русского не видел, на каком условии верны
 * обещания страницы. Без провайдера (одиночный рендер) остаётся русский исходник —
 * его дословность держит productNoticeShowsCatalogueText.
 */
afterEach(() => {
  cleanup();
  try { localStorage.removeItem("aevion_lang_v1"); } catch {}
});

describe("оговорка модуля на языке страницы", () => {
  test("у каждой оговорки модуля есть en и kk", () => {
    for (const id of Object.keys(MODULE_NOTICES)) {
      expect(MODULE_NOTICES_I18N[id]?.en, `${id}: нет en`).toBeTruthy();
      expect(MODULE_NOTICES_I18N[id]?.kk, `${id}: нет kk`).toBeTruthy();
      expect(MODULE_NOTICES_I18N[id].en, `${id}: en с кириллицей`).not.toMatch(/[А-Яа-яЁё]{3,}/);
      expect(MODULE_NOTICES_I18N[id].kk, `${id}: kk без казахских букв`).toMatch(/[ӘәҒғҚқҢңӨөҰұҮүІі]/);
    }
  });

  test("контроль: ru и незнакомый язык — русский исходник", () => {
    expect(productNoticeIn("qcontract", "ru")).toBe(MODULE_NOTICES.qcontract);
    expect(productNoticeIn("qcontract", "fr")).toBe(MODULE_NOTICES.qcontract);
    expect(productNoticeIn("cyberchess", "en")).toBeUndefined();
  });

  for (const lang of ["en", "kk"] as const) {
    test(`${lang}: на экране перевод, русского исходника нет`, async () => {
      localStorage.setItem("aevion_lang_v1", lang);
      const { container } = render(
        <I18nProvider>
          <ProductNotice productId="qcontract" />
        </I18nProvider>,
      );
      await waitFor(() => expect(container.textContent).toContain(MODULE_NOTICES_I18N.qcontract[lang]));
      expect(container.textContent).not.toContain("Демонстрационный режим");
    });
  }
});
