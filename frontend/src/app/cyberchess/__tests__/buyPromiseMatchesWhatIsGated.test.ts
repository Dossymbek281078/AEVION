/**
 * Кнопка покупки обязана обещать то, что покупка ОТКРЫВАЕТ.
 *
 * ПОВОД 29.09.2026. В подписи стояло «Оплата картой · полный доступ к
 * CyberChess». Замер соседнего окна (user-c4) на проде:
 * `/api/cyberchess-puzzles` отвечает 200 без входа и без оплаты, контроль на
 * том же приборе `/api/multichat/presets` → 402 upgrade_required. То есть
 * задачи, партия и коуч бесплатны — «полный доступ» человек уже имеет, и
 * обещание продаёт ему то, что у него есть.
 *
 * Что покупка открывает на самом деле: «Глубокий анализ» (Stockfish NNUE) —
 * решение основателя 07.09.2026. Гейт живой и выкачен: DeepAnalysisPanel
 * зовёт checkAppAccess("cyberchess") и показывает замок не-владельцу.
 *
 * Здесь проверяется СООТВЕТСТВИЕ обещания и гейта, а не красота формулировки.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

const СТРАНИЦА = bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));
const ПАНЕЛЬ = readFileSync(join(__dirname, "..", "DeepAnalysisPanel.tsx"), "utf8");

describe("обещание кнопки покупки", () => {
  it("не обещает «полный доступ» — он и так бесплатен", () => {
    expect(СТРАНИЦА).not.toContain("полный доступ к CyberChess");
  });

  it("называет то, что покупка действительно открывает", () => {
    expect(СТРАНИЦА).toContain("Глубокий анализ");
  });

  it("🔴 и это же закрыто гейтом — иначе обещание снова пустое", () => {
    // Контроль на другой стороне: если гейт снимут, подпись станет враньём,
    // и тест обязан об этом сказать. Проверяется вызов, а не слово.
    expect(ПАНЕЛЬ).toContain('checkAppAccess("cyberchess")');
    expect(ПАНЕЛЬ).toContain("access !== \"owned\"");
  });

  it("контроль: путь к оплате с кнопки никуда не делся", () => {
    expect(СТРАНИЦА).toContain("ccBuyHref");
  });
});
