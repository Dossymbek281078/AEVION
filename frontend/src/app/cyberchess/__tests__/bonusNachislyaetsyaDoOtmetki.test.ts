import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { awardInStorage, CHESSY_STORAGE_KEY, CHESSY_LOG_STORAGE_KEY } from "../chessyLedger";

/**
 * Страница тренировок показывала «✨ +25 Chessy зачислено на твой счёт» и
 * не зачисляла НИЧЕГО: рядом стоял комментарий «в проде это был бы POST».
 * Хуже: отметка «сегодня уже получено» ставилась всё равно, то есть бонус
 * пропадал навсегда, а человеку сообщали об успехе.
 *
 * Закрепляю два разных утверждения:
 *   1) начисление действительно меняет кошелёк (и умеет отказать);
 *   2) отметка «получено» ставится ПОСЛЕ успешного начисления, а не до.
 */

describe("ежедневный бонус", () => {
  beforeEach(() => { localStorage.clear(); });

  it("начисление увеличивает баланс и lifetime", () => {
    localStorage.setItem(CHESSY_STORAGE_KEY, JSON.stringify({ v: 1, balance: 10, lifetime: 40, ach: {} }));
    const стало = awardInStorage(25, "проба");
    expect(стало).toBe(35);
    const кошелёк = JSON.parse(localStorage.getItem(CHESSY_STORAGE_KEY)!);
    expect(кошелёк.balance).toBe(35);
    expect(кошелёк.lifetime).toBe(65); // lifetime не убывает и растёт вместе с балансом
  });

  it("пишет строку в журнал — иначе начисление не проследить", () => {
    localStorage.setItem(CHESSY_STORAGE_KEY, JSON.stringify({ v: 1, balance: 0, lifetime: 0, ach: {} }));
    awardInStorage(25, "Ежедневный бонус · центр обучения");
    const журнал = JSON.parse(localStorage.getItem(CHESSY_LOG_STORAGE_KEY)!);
    expect(журнал).toHaveLength(1);
    expect(журнал[0].amount).toBe(25);
    expect(журнал[0].sign).toBe(1);
    expect(журнал[0].reason).toContain("бонус");
  });

  it("нет кошелька — честный null, а не выдуманный успех", () => {
    expect(awardInStorage(25, "проба")).toBeNull();
    localStorage.setItem(CHESSY_STORAGE_KEY, "не json");
    expect(awardInStorage(25, "проба")).toBeNull();
  });

  it("нулевое и отрицательное начисление отвергается", () => {
    localStorage.setItem(CHESSY_STORAGE_KEY, JSON.stringify({ v: 1, balance: 5, lifetime: 5, ach: {} }));
    expect(awardInStorage(0, "п")).toBeNull();
    expect(awardInStorage(-10, "п")).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHESSY_STORAGE_KEY)!).balance).toBe(5);
  });

  it("страница тренировок начисляет ДО отметки «получено»", () => {
    const код = readFileSync(join(__dirname, "..", "training", "page.tsx"), "utf8");
    const i = код.indexOf("const claimDaily");
    expect(i, "функция claimDaily пропала — проверку надо переписать").toBeGreaterThan(0);
    const тело = код.slice(i, i + 900);
    const начисление = тело.indexOf("awardInStorage");
    const отметка = тело.indexOf("setDailyClaimed(true)");
    expect(начисление, "бонус обязан начисляться, а не только объявляться").toBeGreaterThan(0);
    expect(отметка).toBeGreaterThan(начисление);
    // и никаких обещаний через нативное окно: оно не отличает успех от отказа
    expect(тело).not.toContain("alert(");
  });
});
