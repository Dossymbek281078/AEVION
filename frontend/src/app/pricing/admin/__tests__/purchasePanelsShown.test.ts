/**
 * Покупки по каналам должны быть НА ЭКРАНЕ, а не только в ответе сервера.
 *
 * Класс, на который я наступал в этом же окне дважды: поле доезжает до ответа,
 * а страница его не читает — и снаружи это неотличимо от «данных нет». Сводка
 * при этом выглядит полной: соседние панели на месте.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const страница = readFileSync(join(process.cwd(), "src/app/pricing/admin/page.tsx"), "utf8");
/*
 * ⚠️ 01.09.2026: сторож читал `i18n-data.ts` — а это после разбиения словаря по
 * языкам (10.08) обрубок на 93 строки, ключей там нет вовсе. Проверка «подпись
 * есть на всех трёх языках» искала в пустоте и была бы зелёной при ЛЮБОМ
 * состоянии словаря, если бы ждала ноль. Она ждала три и потому честно упала —
 * повезло.
 *
 * Это седьмой случай того же класса за два дня: проверки, написанные до
 * разбиения, продолжают читать файл, из которого содержимое ушло. Ищите по
 * признаку `i18n-data` в тестах.
 */
const ЯЗЫКИ = join(process.cwd(), "src", "lib", "i18n-lang");
const словарь = readdirSync(ЯЗЫКИ)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => readFileSync(join(ЯЗЫКИ, f), "utf8"))
  .join(String.fromCharCode(10));

describe("панели покупок по каналам", () => {
  it("страница читает оба поля ответа", () => {
    expect(страница).toContain("summary.purchaseByChannel");
    expect(страница).toContain("summary.purchaseRevenueByChannel");
  });

  it("у выручки подписан знаменатель — иначе частичная читается как полная", () => {
    // Сумма известна не у всех покупок: у возврата PayBox в адрес уходит ref.
    expect(страница).toContain("summary.purchaseWithKnownAmount");
    expect(страница).toContain("summary.purchaseCount");
  });

  it("ярлык выручки не обещает ПОЛУЧЕННЫЕ деньги", () => {
    // Считается сумма из адреса возврата — наша ожидаемая, а не списанная
    // кассой: цену у Gumroad и LemonSqueezy назначает продавец. Слово
    // «выручка» без «ожидаемая» читается как деньги на счету.
    for (const ключ of ["Expected revenue", "Ожидаемая выручка", "Күтілетін түсім"]) {
      expect(словарь, `нет честного ярлыка: ${ключ}`).toContain(ключ);
    }
  });

  it("подписи есть на всех трёх языках", () => {
    const счёт = (k: string) => словарь.split(k).length - 1;
    expect(счёт('"pricing.admin.breakdown.purchaseByChannel"')).toBe(3);
    expect(счёт('"pricing.admin.breakdown.purchaseRevenueByChannel"')).toBe(3);
  });
});
