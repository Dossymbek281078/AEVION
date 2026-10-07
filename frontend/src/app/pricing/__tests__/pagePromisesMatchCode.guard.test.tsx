import { describe, test, expect } from "vitest";
import { STANDALONE_APPS, PLANET_BASE_MONTHLY, termTotal } from "@/lib/termPricing";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";

/**
 * Обещания страницы цен не должны расходиться с кодом.
 *
 * Свип 07.10.2026 нашёл на продающих страницах четыре расхождения: обещанный
 * Markdown-экспорт, которого нет; «42 модуля» при 44 в своём же реестре;
 * «8h SLA» и «uptime 99.0–99.9 %» без прибора; и довод «$480 дороже $400»,
 * который невозможно сверить с экрана, потому что цены видны только у пяти
 * приложений из девяти.
 *
 * Сторож держит ровно то, что уже исправлено, чтобы не вернулось.
 */

describe("довод «по отдельности дороже» остаётся проверяемым", () => {
  test("сумма девяти приложений считается из того же списка, что рисует страницу", () => {
    const сумма = STANDALONE_APPS.reduce((s, a) => s + a.baseMonthly, 0);
    // Число в тексте не вписано — оно считается. Проверяем, что список цел и
    // сумма действительно больше планеты, иначе довод печатать нельзя.
    expect(STANDALONE_APPS.length).toBe(9);
    expect(сумма).toBeGreaterThan(PLANET_BASE_MONTHLY);
  });

  test("на ступени Lite (1 месяц) сумма и планета — те же числа, что видит человек", () => {
    // termTotal берёт ИМЯ ступени, а не число месяцев: первая версия теста
    // передала 1 и получила NaN — прибор поймал сам себя до доклада.
    expect(STANDALONE_APPS.reduce((s, a) => s + termTotal(a.baseMonthly, "lite"), 0)).toBe(480);
    expect(termTotal(PLANET_BASE_MONTHLY, "lite")).toBe(400);
  });

  test("🔴 текст называет, сколько приложений в сумме — иначе её нечем сверить", () => {
    // Повод: цены показаны у пяти из девяти, а сумма считается по всем девяти.
    // Без числа в тексте читатель видит $480 и не может его собрать.
    for (const [язык, словарь] of [["ru", ru], ["en", en]] as const) {
      const s = (словарь as Record<string, string>)["pricing.home.apps.allAppsDearer"];
      expect(s, `нет строки довода в ${язык}`).toBeTruthy();
      expect(s, `в ${язык} не названо число приложений`).toMatch(/девять|nine/i);
      expect(s, `в ${язык} не сказано про «по запросу»`).toMatch(/по запросу|on request/i);
    }
  });
});

describe("снятые обещания не вернулись в словари", () => {
  test("ни один словарь не обещает 8h SLA и лестницу uptime", () => {
    for (const [язык, словарь] of [["ru", ru], ["en", en]] as const) {
      const всё = JSON.stringify(словарь);
      expect(всё, `${язык}: вернулся 8h SLA`).not.toMatch(/8h\s*SLA/i);
      expect(всё, `${язык}: вернулась лестница uptime`).not.toMatch(/99[.,]0\s*[–-]\s*99[.,]9/);
    }
  });

  test("ни один словарь не обещает Markdown-экспорт мультичата", () => {
    // Код отдаёт export.json и export.csv; Markdown-ручки нет.
    for (const [язык, словарь] of [["ru", ru], ["en", en]] as const) {
      expect(JSON.stringify(словарь), `${язык}: обещан Markdown`).not.toMatch(/JSON\s*\+\s*Markdown/i);
    }
  });
});
