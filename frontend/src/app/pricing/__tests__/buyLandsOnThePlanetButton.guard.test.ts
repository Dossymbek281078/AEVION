import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRICING_TERMS, keepChannel } from "@/lib/products";

/**
 * 20.10.2026, окно «Приложения», QSign 1б (по слову оркестратора: «путь к деньгам»).
 *
 * «Купить» на /qsign вела на /pricing#tiers. Тарифы /pricing приходят с /api/pricing
 * после загрузки, и якорь из адреса не срабатывал вовсе: замер на проде 20.10 08:5x —
 * scrollY=0 на 5 парах окон, кнопка оплаты в 1,1–1,2 тыс. px ниже верха карточки.
 * Теперь PRICING_TERMS ведёт на #planet-buy — кнопку помесячной оплаты выделенного
 * тарифа, а /pricing крутит к ней после прихода данных (block: "end").
 *
 * Сторож держит три звена одной цепи: константу, якорь на кнопке, эффект прокрутки.
 * Выпадет любое — «Купить» снова оставит человека на верху страницы.
 */
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("«Купить» ведёт к кнопке оплаты Планеты", () => {
  test("PRICING_TERMS — якорь кнопки, и метка канала его не теряет", () => {
    expect(PRICING_TERMS).toBe("/pricing#planet-buy");
    expect(keepChannel(PRICING_TERMS, "youtube")).toBe("/pricing?c=yt#planet-buy");
  });

  test("якорь стоит на кнопке помесячной оплаты выделенного тарифа", () => {
    expect(PAGE).toContain('id={tier.id === якорныйТариф ? "planet-buy" : undefined}');
    expect(PAGE).toContain("data?.tiers.find((t) => t.highlight === true)?.id");
    // якорь ровно один
    expect(PAGE.split("planet-buy").length - 1).toBeGreaterThanOrEqual(3); // id, сравнение хеша, block: "end"
    expect(PAGE.split('id={tier.id === якорныйТариф').length - 1).toBe(1);
  });

  test("прокрутка к якорю — после прихода данных, кнопка у нижнего края кадра", () => {
    const i = PAGE.indexOf('if (hash !== "#tiers" && hash !== "#planet-buy") return;');
    expect(i).toBeGreaterThan(0);
    const effect = PAGE.slice(PAGE.lastIndexOf("useEffect(() => {", i), PAGE.indexOf("}, [data]);", i) + 11);
    expect(effect).toContain('el.scrollIntoView({ block: hash === "#planet-buy" ? "end" : "start" });');
    expect(effect).toContain("}, [data]);");
    expect(PAGE).toContain("scrollMarginBottom: 16,");
  });

  test("блок #tiers остался — старые ссылки живы", () => {
    expect(PAGE).toContain('id="tiers"');
  });
});
