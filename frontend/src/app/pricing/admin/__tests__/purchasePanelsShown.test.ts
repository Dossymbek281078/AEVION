/**
 * Покупки по каналам должны быть НА ЭКРАНЕ, а не только в ответе сервера.
 *
 * Класс, на который я наступал в этом же окне дважды: поле доезжает до ответа,
 * а страница его не читает — и снаружи это неотличимо от «данных нет». Сводка
 * при этом выглядит полной: соседние панели на месте.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const страница = readFileSync(join(process.cwd(), "src/app/pricing/admin/page.tsx"), "utf8");
const словарь = readFileSync(join(process.cwd(), "src/lib/i18n-data.ts"), "utf8");

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

  it("подписи есть на всех трёх языках", () => {
    const счёт = (k: string) => словарь.split(k).length - 1;
    expect(счёт('"pricing.admin.breakdown.purchaseByChannel"')).toBe(3);
    expect(счёт('"pricing.admin.breakdown.purchaseRevenueByChannel"')).toBe(3);
  });
});
