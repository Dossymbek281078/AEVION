import { describe, test, expect } from "vitest";
import {
  lemonSqueezyVariantStatus,
  tierForLemonSqueezyReference,
} from "../src/data/lemonSqueezyVariants";

/**
 * Храповик для ТРЕТЬЕЙ кассы: вариант товара и разбор тарифа не должны
 * расходиться молча.
 *
 * ЗАЧЕМ. У PayBox и PayPal этот класс уже стоил денег: каталог продавал
 * тарифы, которых разбор ссылки не знал, и всё незнакомое падало в самый
 * дешёвый. У Lemon Squeezy устройство лучше — вход ограничен типом, а
 * `planet` обработан намеренно, — но дефолт тот же: `return "lite"`.
 * Заведут вариант под новый тариф (например `tier_pro_*`, которого сейчас
 * намеренно нет) — и покупатель молча получит Lite.
 *
 * Список ссылок берётся из САМОГО модуля, а не переписывается сюда: иначе
 * тест устареет ровно тогда, когда появится то, ради чего он написан.
 */
describe("Lemon Squeezy: тариф варианта понят разбором", () => {
  const ссылки = Object.keys(lemonSqueezyVariantStatus()).filter((r) =>
    r.startsWith("tier_"),
  );

  test("есть что проверять", () => {
    // Контроль охвата: опустевший или переименованный список сделал бы
    // проверку ниже пустой и молча зелёной.
    expect(ссылки.length).toBeGreaterThanOrEqual(4);
  });

  test("каждая тарифная ссылка отдаёт тариф из своего имени", () => {
    // `planet` — осознанный синоним `full`, так в самом разборе.
    const синонимы: Record<string, string> = { planet: "full" };
    const немые = ссылки
      .map((r) => {
        const имя = r.split("_")[1] ?? "";
        const ждём = синонимы[имя] ?? имя;
        return [r, ждём, tierForLemonSqueezyReference(r as never)] as const;
      })
      .filter(([, ждём, выдано]) => выдано !== ждём);

    expect(немые, "вариант продаётся, а разбор выдаёт другой тариф").toEqual([]);
  });
});
