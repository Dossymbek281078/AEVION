import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paymentNoteKey, formatDisplayPrice } from "../paymentNote";

/**
 * Класс: витрина обещает платёжный канал, которого на проде нет, и показывает
 * цену в валюте, в которой не спишут. Найдено замером 28.07.2026 —
 * `paybox.configured: false`, а страница обещала Kaspi; чекаут в KZT и в USD
 * возвращал одного и того же провайдера lemonsqueezy.
 *
 * Сторож держит три конца: решение о подписи, вид цены и наличие текста во
 * всех локалях, где эти ключи вообще заведены. Третий конец нужен потому, что
 * ветка `fxNote` без строки в словаре покажет покупателю сам ключ.
 */

const LOCALE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "lib",
  "i18n-data.ts",
);
const LOCALE_SRC = readFileSync(LOCALE_FILE, "utf8");

describe("витрина не обещает платёжный канал, которого нет", () => {
  it("Kaspi обещается, только когда PayBox реально настроен", () => {
    expect(paymentNoteKey("KZT", true)).toBe("kztNote");
  });

  it("PayBox выключен — про Kaspi ни слова, даже при выбранном KZT", () => {
    expect(paymentNoteKey("KZT", false)).toBe("fxNote");
  });

  it("ответ бэкенда ещё не пришёл — тоже не обещаем", () => {
    // Неизвестность на денежном пути трактуется в сторону «нет»: обещание,
    // выданное авансом, уже нельзя забрать у человека, который его прочитал.
    expect(paymentNoteKey("KZT", null)).toBe("fxNote");
  });

  it("доллар — обычная подпись, прочие валюты — предупреждение о пересчёте", () => {
    expect(paymentNoteKey("USD", false)).toBe("usdNote");
    expect(paymentNoteKey("USD", true)).toBe("usdNote");
    for (const c of ["EUR", "RUB"]) {
      expect(paymentNoteKey(c, true)).toBe("fxNote");
    }
  });
});

describe("цена не выдаёт пересчёт за сумму списания", () => {
  it("не-USD помечается как приблизительная", () => {
    expect(formatDisplayPrice("₸11 280", "KZT")).toBe("≈ ₸11 280");
    expect(formatDisplayPrice("€22", "EUR")).toBe("≈ €22");
  });

  it("USD показывается как есть — в нём и спишут", () => {
    expect(formatDisplayPrice("$24", "USD")).toBe("$24");
  });
});

describe("тексты существуют во всех локалях, где заведён этот блок", () => {
  // Ключи блока живут в трёх крупных словарях (en/ru/kk); остальные локали
  // падают на en по устройству t(). Проверяем не «есть где-то», а что новая
  // ветка покрыта ровно так же, как соседние: иначе покупатель увидит
  // строку "pricing.home.heroModule.fxNote" вместо предупреждения.
  const count = (key: string) =>
    LOCALE_SRC.split(`"pricing.home.heroModule.${key}"`).length - 1;

  it("fxNote переведён не хуже, чем usdNote", () => {
    expect(count("usdNote")).toBeGreaterThan(0);
    expect(count("fxNote")).toBe(count("usdNote"));
  });

  it("в тексте fxNote есть подстановки курса и символа", () => {
    const ru = LOCALE_SRC.match(/"pricing\.home\.heroModule\.fxNote":\s*"([^"]+)"/);
    expect(ru).not.toBeNull();
    expect(ru![1]).toContain("{rate}");
    expect(ru![1]).toContain("{symbol}");
  });
});
