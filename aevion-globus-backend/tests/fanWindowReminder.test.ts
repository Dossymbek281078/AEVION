import { describe, test, expect } from "vitest";
import { shouldRemind } from "../scripts/fan-window-reminder";

/**
 * Правило отбора для напоминания о закрытии окна веера.
 *
 * Почему тест обязателен именно здесь: скрипты в `scripts/` НЕ покрываются
 * `tsc` — в `tsconfig.json` стоит `include: ["src/**"]`. Проверено намеренной
 * поломкой типа: `tsc --noEmit` промолчал. То есть у этого файла нет ни
 * компилятора, ни ревью в CI — только тест.
 *
 * Второе: рассылка писем необратима. Ошибка в правиле отбора — это либо
 * молчание там, где надо было напомнить, либо письмо тому, кому не надо.
 * Проверять такое «прогоном на живых адресах» нельзя по определению.
 */

const offers = [{ discountPercent: 30 }, { discountPercent: 0 }];
const base = { status: "active", daysLeft: 2, validUntil: "2026-08-10T00:00:00.000Z", offers };
const opts = (over: Partial<{ remindDays: number; alreadySent: Set<string>; email: string }> = {}) => ({
  remindDays: 3,
  alreadySent: new Set<string>(),
  email: "buyer@test.dev",
  ...over,
});

describe("кому напоминать о закрытии окна", () => {
  test("✅ окно закрывается и есть что предложить — напоминаем", () => {
    const v = shouldRemind(base, opts());
    expect(v.remind).toBe(true);
  });

  test("последний день (0) — тоже напоминаем, а не пропускаем", () => {
    // Граница: `daysLeft: 0` значит «сегодня», а не «уже поздно».
    expect(shouldRemind({ ...base, daysLeft: 0 }, opts()).remind).toBe(true);
  });

  test("🔴 времени ещё много — молчим", () => {
    // Без этой проверки «напоминание» превратилось бы в рассылку всем подряд.
    const v = shouldRemind({ ...base, daysLeft: 11 }, opts());
    expect(v.remind).toBe(false);
    expect(v.reason).toBe("ещё рано");
  });

  test("🔴 про ЭТО окно уже напоминали — второй раз не пишем", () => {
    const sent = new Set([`buyer@test.dev|${base.validUntil}`]);
    expect(shouldRemind(base, opts({ alreadySent: sent })).remind).toBe(false);
  });

  test("ключ идемпотентности — окно, а не дата запуска", () => {
    // Новая покупка открывает НОВОЕ окно: про него напомнить нужно, даже если
    // про прошлое уже писали тому же человеку.
    const sent = new Set([`buyer@test.dev|${base.validUntil}`]);
    const newWindow = { ...base, validUntil: "2026-09-01T00:00:00.000Z" };
    expect(shouldRemind(newWindow, opts({ alreadySent: sent })).remind).toBe(true);
  });

  test("окно неактивно или без срока — молчим", () => {
    expect(shouldRemind({ ...base, status: "expired" }, opts()).remind).toBe(false);
    expect(shouldRemind({ ...base, status: "inactive" }, opts()).remind).toBe(false);
    expect(shouldRemind({ ...base, daysLeft: null }, opts()).remind).toBe(false);
  });

  test("🔴 предлагать нечего — письма не будет", () => {
    // Письмо «ваш веер закрывается» без единой скидки внутри — спам от нас же.
    const v = shouldRemind({ ...base, offers: [{ discountPercent: 0 }] }, opts());
    expect(v.remind).toBe(false);
    expect(v.reason).toBe("нечего предложить со скидкой");
  });

  test("порог настраивается, и правило ему подчиняется", () => {
    expect(shouldRemind({ ...base, daysLeft: 5 }, opts({ remindDays: 3 })).remind).toBe(false);
    expect(shouldRemind({ ...base, daysLeft: 5 }, opts({ remindDays: 7 })).remind).toBe(true);
  });
});
