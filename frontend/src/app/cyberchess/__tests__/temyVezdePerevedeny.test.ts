import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { bezKommentariev } from "./bezKommentariev";
import { SUPPORTED_LOCALES } from "../i18n";
import { klyuchEstVYazyke } from "./_slovar";

/**
 * Тему задачи показывают ПЯТЬ мест, а перевод я применил сперва к двум.
 * Свип по собранной версии это и вскрыл: на экране «Задачи» остались
 * «advantage», «crushing», «kingsideAttack», «advancedPawn» — это фильтр по
 * темам со счётчиками и кнопки «слабые темы».
 *
 * Урок в самом сторожа: находка в слепой зоне не приходит одна. Нашёл одно
 * место — ищи ВСЕ и закрепляй счётом, а не перечислением.
 */

const KOD = () => bezKommentariev(readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8"));

describe("тема задачи переведена во всех местах вывода", () => {
  it("сырой вывод темы нигде не остался", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан
    for (const syroy of ["{w.th} ·", ">{th}</span>", "value={th}>{th}<", "{pz.theme}</span>"]) {
      expect(s).not.toContain(syroy);
    }
  });

  it("перевод зовётся не меньше пяти раз", () => {
    // Пять мест вывода: карточка задачи, список задач, всплывающая подсказка,
    // фильтр по темам, кнопки слабых тем. Станет меньше — что-то откатили.
    const s = KOD();
    const zovov = (s.match(/temaZadachiRu\(/g) || []).length;
    expect(zovov).toBeGreaterThanOrEqual(5);
  });

  it("форматы турниров в описаниях по-русски", () => {
    // 05.10.2026 одно из трёх мест уехало в словарь (перевод на казахский).
    // Считаем по ОБОИМ файлам: иначе проверка либо краснеет на верной правке,
    // либо, если просто ослабить число, перестаёт ловить удаление.
    const s = KOD();
    const СЛОВАРЬ = readFileSync(join(process.cwd(), "src/app/cyberchess/i18n.ts"), "utf8");
    expect(s).not.toContain("Swiss · Round-robin");
    const вКоде = (s.match(/Швейцарская · круговой/g) || []).length;
    const вСловаре = (СЛОВАРЬ.match(/Швейцарская · круговой/g) || []).length;
    expect(
      вКоде + вСловаре,
      `мест с русским названием форматов: ${вКоде} в page.tsx + ${вСловаре} в словаре`
    ).toBe(3);

    // И на каждом языке описание турниров обязано БЫТЬ — пропуск перевода
    // тихо откатывается на русский, а не падает.
    for (const { code } of SUPPORTED_LOCALES) {
      expect(klyuchEstVYazyke(code, "killer.tournaments.desc"), `${code}: описания турниров нет в словаре этого языка`).toBe(true);
    }
  });
});
