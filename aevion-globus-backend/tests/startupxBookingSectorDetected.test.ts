/**
 * Биржа стартапов: запись к мастерам распознаётся отраслью, а не уходит в «Other / General».
 *
 * ПОВОД (20.10.2026, путь гостя на проде, put-razbor.mjs): описание «сервис записи к
 * мастерам маникюра в Алматы… 40 мастеров платят 3000 тенге в месяц» получило отрасль
 * Other / General — «адресуемый рынок ~$1000млрд» (условное число запасной отрасли).
 */
import { describe, it, expect } from "vitest";
import { detectSector } from "../src/lib/startupx/sectorDetect";

const ЗАПИСЬ =
  "Сервис записи к мастерам маникюра в Алматы: клиент выбирает мастера и время, мастер получает напоминание в WhatsApp. Есть рабочий прототип, 40 мастеров на пробе, платят 3000 тенге в месяц.";

describe("определение отрасли", () => {
  it("запись к мастерам маникюра — SaaS, определено по описанию", () => {
    const d = detectSector(undefined, ЗАПИСЬ);
    expect(d.sector.id).toBe("saas");
    expect(d.origin).toBe("detected");
  });

  it("английское описание бронирования в салоне — тоже SaaS", () => {
    expect(detectSector(undefined, "Online booking and appointment scheduling for hair salons and barbershops").sector.id).toBe("saas");
  });

  it("КОНТРОЛЬ: перевозки остаются логистикой, клиника — медициной", () => {
    expect(detectSector(undefined, "Мелкие перевозчики ищут обратный груз вручную в чатах; сводим грузы и фуры").sector.id).toBe("logistics");
    expect(detectSector(undefined, "Онлайн-запись пациентов в клинику к врачу, напоминания о приёме, медицинские карты пациентов").sector.id).toBe("healthtech");
  });

  it("КОНТРОЛЬ: текст без признаков — честный запасной случай", () => {
    expect(detectSector(undefined, "Просто хорошая идея без подробностей, о которой я расскажу позже лично").origin).toBe("fallback");
  });
});
