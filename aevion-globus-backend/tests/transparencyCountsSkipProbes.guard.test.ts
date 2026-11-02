import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ПРОБА_РЕГЕКС_SQL, этоНашаПроба } from "../src/lib/publicRegistryProbes";

/**
 * 02.11.2026 (Продукт, проход письма pb376, гость en): два прохода пути «Protect My Work»
 * с названием `probe-produkt …` подняли публичное «зарегистрировано» на /qright с 64 до 66
 * за минуту — /api/qright/transparency отсеивал только ownerName = 'smoke-test', а правило 157
 * (probe-/smoke- в названии или авторе) к числам не применялось. Сторож держит два конца:
 * (1) все три запроса прозрачности исключают пробы по регулярке; (2) SQL-регулярка и JS-правило
 * этоНашаПроба дают один ответ на одних примерах (\m/\M PostgreSQL ≡ \b JS).
 */
const ROUTE = readFileSync(join(__dirname, "..", "src", "routes", "qright.ts"), "utf8");

describe("числа прозрачности /qright не считают наши пробы", () => {
  it("все три запроса ручки /transparency отсеивают пробы по регулярке", () => {
    const a = ROUTE.indexOf('qrightRouter.get("/transparency"');
    const b = ROUTE.indexOf("const t = totals.rows[0]", a);
    expect(a).toBeGreaterThan(0);
    const seg = ROUTE.slice(a, b);
    expect(seg.match(/AND NOT \(\$\{БЕЗ_ПРОБ_SQL\}\)/g)?.length).toBe(3);
    expect(seg.match(/\[SMOKE_OWNER, ПРОБА_РЕГЕКС_SQL\]/g)?.length).toBe(3);
  });

  it("SQL-регулярка совпадает с правилом этоНашаПроба", () => {
    const js = new RegExp(ПРОБА_РЕГЕКС_SQL.replace(/\\m|\\M/g, "\\b"), "i");
    const примеры: Array<[string, string]> = [
      ["probe-produkt poem 0211", ""],
      ["Smoke smoke-1784", "smoke-test"],
      ["Autumn rain notes, draft one", "Anna Verifier"],
      ["Probenentnahme im Labor", "Hans"], // не проба: «probe» внутри слова
      ["qa-cycle run 3", ""],
      ["My smoke detector manual", ""],
    ];
    for (const [title, author] of примеры) {
      const текст = `${title} ${author}`.toLowerCase();
      expect(js.test(текст), title).toBe(этоНашаПроба({ title, author }));
    }
  });
});
