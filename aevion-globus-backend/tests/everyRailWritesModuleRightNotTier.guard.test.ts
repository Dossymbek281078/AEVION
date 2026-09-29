import { describe, test, expect } from "vitest";
import { купленныйМодуль } from "../src/lib/payment/purchasedModule";
import { tierForReference as payboxTier } from "../src/routes/payboxWebhook";
import { tierForReference as paypalTier } from "../src/routes/paypalWebhook";
import { normalizeTier } from "../src/lib/planGate";
import { STANDALONE_APPS, TERM_TIERS } from "../src/data/pricing";

/**
 * Сторож: КАЖДАЯ касса отличает покупку одного модуля от покупки тарифа.
 *
 * 🔴 ЗАМЕР 29.09.2026. Тариф с 15.09 означает срок доступа ко ВСЕЙ планете
 * ($400/мес): `normalizeTier` превращает lite в `full`, а `isModuleEntitled` при
 * full пускает куда угодно. Значит запись покупки модуля платформенным тарифом =
 * отдать планету за цену модуля ($16 у QSkyway). На Lemon Squeezy эта утечка
 * найдена и закрыта (dc5d45658). Прогон показал, что у PayBox и PayPal тот же
 * путь остался: ссылка приложения разбирается ими КАК ТАРИФ, потому что содержит
 * «lite» или «full» —
 *
 *     app_qskyway_lite → lite → full        app_devhub_full → full
 *     app_qright_pro   → lite → full        app_qskyway_max → lite → full
 *
 * Обе кассы на проде выключены, поэтому утечка была спящей. Включать PayBox для
 * Казахстана без этой починки нельзя.
 *
 * ЧТО ОХРАНЯЕТСЯ ЗДЕСЬ: признак «куплен один модуль» (общий на все кассы) узнаёт
 * покупку модуля во ВСЕХ формах, в которых кассы её приносят, и не путает её с
 * покупкой тарифа. Поведение самих вебхуков (право на модуль вместо тарифа)
 * проверяют соседние сторожа по каждому рельсу.
 *
 * ⚠️ Разбор ссылки в тариф НЕ изменён намеренно: эвристика по подстроке нужна для
 * чужих ссылок, и ломать её ради нашего случая значило бы чинить не то место.
 * Ссылку приложения перехватывает рельс — ДО того, как спросит тариф.
 */
describe("признак «куплен один модуль»", () => {
  test("узнаёт модуль, названный полем кассы (продажа через вариант тарифа)", () => {
    expect(купленныйМодуль("tier_lite", "qskyway")).toBe("qskyway");
    expect(купленныйМодуль("tier_lite", "  qright  "), "пробелы вокруг имени").toBe("qright");
  });

  test("узнаёт модуль, названный самой ссылкой заказа — во всех ступенях", () => {
    for (const срок of TERM_TIERS) {
      expect(
        купленныйМодуль(`app_qskyway_${срок}`, undefined),
        `ступень ${срок}: ссылка приложения не опознана`,
      ).toBe("qskyway");
    }
  });

  test("узнаёт все продаваемые приложения, включая имена с подчёркиванием", () => {
    for (const a of STANDALONE_APPS) {
      expect(купленныйМодуль(`app_${a.slug}_lite`, undefined), `не опознан ${a.slug}`).toBe(a.slug);
    }
  });

  test("КОНТРОЛЬ: покупка ТАРИФА модулем не считается", () => {
    for (const срок of TERM_TIERS) {
      expect(
        купленныйМодуль(`tier_${срок}`, undefined),
        `тариф ${срок} принят за покупку модуля — у покупателя планеты отберут оплаченное`,
      ).toBeNull();
    }
  });

  test("КОНТРОЛЬ: мусор и пустота не превращаются в модуль", () => {
    for (const мусор of ["", "   ", null, undefined]) {
      expect(купленныйМодуль("tier_lite", мусор as string | null | undefined)).toBeNull();
    }
    expect(купленныйМодуль(null, null)).toBeNull();
    expect(купленныйМодуль("совершенно чужая ссылка", null)).toBeNull();
  });

  test("ИМЕННО ЭТИ ссылки раньше становились полным доступом — и всё ещё стали бы", () => {
    // Контроль в обе стороны: показываем, что опасность НЕ выдумана. Разбор в
    // тариф по-прежнему отвечает «full» на ссылку приложения, и именно поэтому
    // перехват обязателен ДО него. Если кто-то уберёт перехват, утечка вернётся.
    for (const ref of ["app_qskyway_lite", "app_devhub_full", "app_qright_pro"]) {
      expect(normalizeTier(payboxTier(ref)), `paybox: ${ref}`).toBe("full");
      expect(normalizeTier(paypalTier(ref)), `paypal: ${ref}`).toBe("full");
      // И тот же ref опознаётся как покупка модуля — значит перехват сработает.
      expect(купленныйМодуль(ref, undefined)).not.toBeNull();
    }
  });

  test("КОНТРОЛЬ: обе кассы разбирают ссылки ОДИНАКОВО", () => {
    // Правило вынесено в одно место (tierFromOrderReference). Прежде оно жило
    // двумя копиями, и у второй шумная запись о незнакомой ссылке появилась
    // отдельно, спустя месяц. Расхождение ловится здесь.
    for (const ref of ["tier_lite", "tier_max", "tier_medium", "app_qskyway_lite", "мусор"]) {
      expect(payboxTier(ref), `расходятся на "${ref}"`).toBe(paypalTier(ref));
    }
  });
});
