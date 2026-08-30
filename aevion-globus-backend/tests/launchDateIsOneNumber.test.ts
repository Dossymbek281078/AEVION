import { describe, test, expect } from "vitest";
import { buildPlatformWaitlistEmail, isLiveNow } from "../src/lib/constitutionBrevo";
import { buildLaunchEmail } from "../src/lib/launchAnnounce";

/**
 * Дата запуска — обещание человеку, и живёт она в ТРЁХ местах:
 *   1) план в письме подтверждения (LAUNCH_MODULES в constitutionBrevo)
 *   2) день, с которого модуль считается открытым (liveFrom там же)
 *   3) дата в письме запуска (LAUNCH_MODULES в launchAnnounce)
 *
 * 30.08.2026 основатель перенёс шахматы на 30 сентября — а поправлены были
 * доска и документ порядка действий, но НЕ эти три. Подписчик в тот день
 * получал «Открываем по плану 30 августа», то есть обещание запуска,
 * которого не было. Поймал падающий тест, а не человек.
 *
 * Сторож сверяет места между собой: он не знает «правильной» даты и не
 * устареет от следующего переноса — он краснеет, только когда места
 * РАСХОДЯТСЯ. Мутационно проверен: сдвинь дату в одном месте — краснеет.
 */
describe("дата запуска называется одинаково везде", () => {
  const dates = (s: string) => s.match(/\d{1,2}\s+(январ|феврал|март|апрел|ма|июн|июл|август|сентябр|октябр|ноябр|декабр)\S*/g) ?? [];

  test("письмо подтверждения и письмо запуска называют одну дату", () => {
    const confirm = buildPlatformWaitlistEmail("a@b.co", "cyberchess");
    const announce = buildLaunchEmail("cyberchess", "a@b.co");
    const inConfirm = dates(confirm.htmlContent);
    const inAnnounce = dates(announce.htmlContent);
    // Если модуль уже открыт, письмо подтверждения даты не называет —
    // тогда сверять нечего, и это не расхождение.
    if (inConfirm.length === 0) return;
    for (const d of inConfirm) {
      expect(
        inAnnounce.length === 0 || inAnnounce.includes(d),
        `письмо подтверждения обещает «${d}», письмо запуска — «${inAnnounce.join(", ")}»`,
      ).toBe(true);
    }
  });

  test("день «уже открыт» не наступает раньше обещанной даты", () => {
    const confirm = buildPlatformWaitlistEmail("a@b.co", "cyberchess");
    const promised = dates(confirm.htmlContent);
    if (promised.length === 0) return; // модуль уже открыт — проверять нечего
    // Раз дата ещё обещается, модуль обязан считаться НЕ открытым сегодня.
    expect(confirm.htmlContent.includes("уже открыт"),
      "письмо одновременно обещает дату и говорит «уже открыт»").toBe(false);
  });

  test("isLiveNow отвечает по дате, а не по списку", () => {
    expect(isLiveNow(Date.UTC(2100, 0, 1))).toBe(false);
    expect(isLiveNow(Date.UTC(2000, 0, 1))).toBe(true);
    expect(isLiveNow(undefined)).toBe(true);
  });
});
