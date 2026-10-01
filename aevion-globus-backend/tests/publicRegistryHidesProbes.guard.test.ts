/*
 * Публичный реестр не показывает НАШИ прогоны.
 *
 * 🔴 Замер на проде 01.10.2026: GET /api/pipeline/certificates — ровно то, что
 * видит человек на /bureau, — отдавал 10 записей, из которых шесть были нашими
 * пробами («smoke test», «v2 smoke test», «probe-qa-cycle5», «probe-28-09 …»,
 * «probe-qa orchestrator … (safe-to-delete)», «claim check 2»). Витрина
 * бесплатного сертификата показывала посетителю мусор, и это блокировало ролик.
 *
 * Сторож проверяет ПРЕДИКАТ в обе стороны и отдельно — что маршрут его зовёт:
 * фильтр, который никто не применяет, ничего не прячет.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { этоНашаПроба, ПРОБЫ_БЕЗ_МЕТКИ } from "../src/lib/publicRegistryProbes";

const МАРШРУТ = readFileSync(join(__dirname, "..", "src", "routes", "pipeline.ts"), "utf8");

/** Настоящие записи с прода, снятые 01.10.2026 перед починкой. */
const СНЯТО_С_ПРОДА = [
  { id: "cert-76846b0192172921", title: "probe-28-09 первое действие гостя", author: "smoke" },
  { id: "cert-026948938c20ba65", title: "probe-qa-cycle5", author: "Anonymous" },
  { id: "cert-4bc586a1af499a32", title: "probe-qa orchestrator after cycle5 fix (safe-to-delete)", author: "Anonymous" },
  { id: "cert-c597672d2aab5cd1", title: "claim check 2", author: "Anonymous" },
  { id: "cert-2bc929b3eec31e53", title: "v2 smoke test", author: "Anonymous" },
  { id: "cert-d45d64500ba70b75", title: "smoke test", author: "Anonymous" },
  { id: "cert-f7ac411b5a1929ad", title: "1", author: "Anonymous" },
  { id: "cert-54825970871a4eb6", title: "Музыка 1", author: "Anonymous" },
];

describe("публичный реестр прячет наши прогоны", () => {
  it("все восемь проб с прода признаются пробами", () => {
    const пропущенные = СНЯТО_С_ПРОДА.filter((з) => !этоНашаПроба(з)).map((з) => з.title);
    expect(пропущенные, `проверено записей: ${СНЯТО_С_ПРОДА.length}`).toEqual([]);
  });

  it("настоящая работа пробой НЕ считается — иначе спрячем живого автора", () => {
    const живые = [
      { id: "cert-13cd6ccef0abbc1d", title: "Test Patent", author: "Dosymbek" },
      { id: "cert-aaa", title: "Протокол долголетия: методика", author: "Иванов" },
      { id: "cert-bbb", title: "Smoked salmon recipe", author: "Chef" },
      { id: "cert-ccc", title: "Проба пера", author: "Автор" },
    ];
    const спрятанные = живые.filter((з) => этоНашаПроба(з)).map((з) => з.title);
    expect(спрятанные, "фильтр задел живую запись").toEqual([]);
  });

  it("список записей без метки — точные id, а не правило", () => {
    expect(ПРОБЫ_БЕЗ_МЕТКИ.size).toBeGreaterThan(0);
    for (const id of ПРОБЫ_БЕЗ_МЕТКИ) expect(id.startsWith("cert-")).toBe(true);
  });

  it("маршрут публичного списка действительно зовёт фильтр", () => {
    expect(МАРШРУТ).toContain("этоНашаПроба");
    expect(МАРШРУТ, "фильтр обязан стоять на выдаче, а не просто быть импортирован")
      .toMatch(/filter\([\s\S]{0,160}?этоНашаПроба/);
  });
});
