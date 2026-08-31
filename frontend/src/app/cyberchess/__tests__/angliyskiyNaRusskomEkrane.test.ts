import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Английские слова на русском экране шахмат.
 *
 * Найдено не грепом, а перехватом того, что модуль САМ отправляет на живой
 * перевод: на каждый свежий заход /cyberchess уходит POST с семью строками.
 * Список отправленного и есть список того, что модуль считает нерусским.
 *
 * Замер на проде 31.08.2026 показал важное: имена (CyberChess, Chessy,
 * Puzzle Rush) возвращаются НЕИЗМЕННЫМИ и кэшируются — бренд не мнётся, и
 * тревоги здесь нет. А вот «AI» возвращается как «AI»: платный путь идёт и
 * не даёт ничего, потому что чинить надо в исходнике.
 *
 * Сторож намеренно НЕ запрещает имена собственные: Lichess, Chessy,
 * CyberChess и Puzzle Rush остаются как есть — это названия, а не перевод.
 */

const KOD = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("на экране шахмат нет английских слов вместо русских", () => {
  it("«AI» рядом с рейтингом соперника — по-русски", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан
    expect(s).not.toContain("AI ≈ {rat}");
    expect(s).toContain("ИИ ≈ {rat}");
  });

  it("подписи задачи дня Lichess переведены, имя сервиса сохранено", () => {
    const s = KOD();
    expect(s).not.toContain("🌐 Lichess Daily");
    expect(s).toContain("🌐 Задача дня · Lichess");
    // Имя сервиса обязано остаться: это не перевод, а название.
    expect(s).toContain("Lichess");
  });

  it("название уровня в описании совпадает с кнопкой", () => {
    // На кнопке уровень уже назывался «Мастер», в описании оставался
    // «Master AI» — два имени одного и того же в одном интерфейсе.
    const s = KOD();
    expect(s).not.toContain("Открытие Master AI");
    expect(s).toContain("Открытие уровня «Мастер»");
    expect(s).toContain("🔒 Мастер");
  });
});
