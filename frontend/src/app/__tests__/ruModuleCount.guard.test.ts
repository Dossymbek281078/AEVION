import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Русское число модулей обязано согласоваться со словом.
 *
 * После числа на 1 (кроме 11) в косвенном падеже слово стоит в ЕДИНСТВЕННОМ
 * числе: «в 41 модуле», «с 41 модулем», «для всех 41 модуля». После 42, 45,
 * 50 — во множественном: «в 42 модулях». Счётчик меняется при каждом новом
 * модуле, и с ним молча переворачивается грамматика шести строк.
 *
 * Найдено 14.09.2026 вычиткой слияния: MODULE_NODES поднялся с 40 до 41, число
 * в словаре поменяли, а слово оставили — «в 41 модулях AEVION», «с 41
 * модулями». Ни один тест этого не видел: pitchNumbers.guard сверяет ЧИСЛО с
 * реестром, а не форму слова рядом с ним.
 *
 * Сторож проверяет в ОБЕ стороны, потому что число берёт из MODULE_NODES, а
 * не из головы: сегодня требует единственное, при 42 потребует множественное.
 */
const FRONTEND_ROOT = path.resolve(__dirname, "../../..");
const RU = readFileSync(path.join(FRONTEND_ROOT, "src/lib/i18n-lang/ru.ts"), "utf8");
const KK = readFileSync(path.join(FRONTEND_ROOT, "src/lib/i18n-lang/kk.ts"), "utf8");

/** Нужна ли после числа форма единственного числа. */
function единственное(n: number): boolean {
  return n % 10 === 1 && n % 100 !== 11;
}

/** Фраза и две её формы — для единственного и для множественного. */
const ФРАЗЫ: Array<{ ключ: string; ед: (n: number) => string; мн: (n: number) => string }> = [
  { ключ: "home.subtitle", ед: (n) => `с ${n} продуктовым узлом`, мн: (n) => `с ${n} продуктовыми узлами` },
  { ключ: "modulePage.pipeline.title", ед: (n) => `для всех ${n} модуля`, мн: (n) => `для всех ${n} модулей` },
  { ключ: "pricing.glossary.def.saas", ед: (n) => `SaaS с ${n} модулем`, мн: (n) => `SaaS с ${n} модулями` },
  { ключ: "pricing.roadmap.subtitle", ед: (n) => `по всем ${n} модулю`, мн: (n) => `по всем ${n} модулям` },
  { ключ: "primer.creator.b3", ед: (n) => `в ${n} модуле AEVION`, мн: (n) => `в ${n} модулях AEVION` },
  // 🔴 07.10.2026: ключ выпал из списка и отстал молча — en говорил 44,
  // ru и kk остались на 42. Нашло окно 89 с контролем на СОСЕДНЕМ ключе
  // primer.creator.b3 (там 44 во всех трёх), то есть прибор был исправен,
  // а список — нет. Поверхность инвесторская: русская версия противоречила
  // английской на той странице, с которой идём к покупателям.
  { ключ: "primer.investor.b3", ед: (n) => `каждый из ${n} продукта AEVION`, мн: (n) => `каждый из ${n} продуктов AEVION` },
  { ключ: "tip.trustTier", ед: (n) => `в ${n} модуле AEVION`, мн: (n) => `в ${n} модулях AEVION` },
];

/** Строка словаря по ключу — вся, от ключа до конца строки. */
function строка(ключ: string): string {
  const метка = `"${ключ}":`;
  const i = RU.indexOf(метка);
  expect(i, `ключ ${ключ} не найден в ru.ts — сторож устарел`).toBeGreaterThan(-1);
  const конец = RU.indexOf(String.fromCharCode(10), i);
  return RU.slice(i, конец < 0 ? undefined : конец);
}

describe("русское число модулей согласовано со словом", () => {
  it("контроль прибора: правило различает 1, 11, 21, 41, 42", () => {
    expect(единственное(1)).toBe(true);
    expect(единственное(11)).toBe(false);
    expect(единственное(21)).toBe(true);
    expect(единственное(41)).toBe(true);
    expect(единственное(42)).toBe(false);
  });

  it("каждая фраза стоит в той форме, которой требует MODULE_NODES", async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    const нужна = единственное(MODULE_NODES) ? "ед" : "мн";
    const лишняя = нужна === "ед" ? "мн" : "ед";
    for (const ф of ФРАЗЫ) {
      const s = строка(ф.ключ);
      expect(
        s.includes(ф[нужна](MODULE_NODES)),
        `${ф.ключ}: при ${MODULE_NODES} нужно «${ф[нужна](MODULE_NODES)}». Строка: ${s.slice(0, 160)}`,
      ).toBe(true);
      expect(
        s.includes(ф[лишняя](MODULE_NODES)),
        `${ф.ключ}: при ${MODULE_NODES} стоит неверная форма «${ф[лишняя](MODULE_NODES)}»`,
      ).toBe(false);
    }
  });
  /*
   * 🔴 Знаменатель этого сторожа был ОДИН язык. Он читал только ru.ts, поэтому
   * казахский отставал молча: у primer.investor.b3 en говорил 44, а ru и kk —
   * 42, и покраснеть было нечему. Форму казахского слова здесь не проверяем
   * (это отдельное знание), но ЧИСЛО обязано быть тем же, что в реестре, —
   * расхождение цифры между языками видно покупателю без знания грамматики.
   */
  it("казахский словарь несёт то же число, что реестр", async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    let проверено = 0;
    for (const ф of ФРАЗЫ) {
      const метка = `"${ф.ключ}":`;
      const i = KK.indexOf(метка);
      if (i < 0) continue; // ключа в kk может не быть — это не дефект числа
      const s = KK.slice(i, KK.indexOf(String.fromCharCode(10), i));
      проверено += 1;
      expect(
        s.includes(String(MODULE_NODES)),
        `${ф.ключ}: в kk.ts нет числа ${MODULE_NODES}. Строка: ${s.slice(0, 160)}`,
      ).toBe(true);
      const чужие = [...s.matchAll(/(3[0-9]|4[0-9]|5[0-9])/g)]
        .map((m) => Number(m[1]))
        .filter((n) => n !== MODULE_NODES);
      expect(
        чужие,
        `${ф.ключ}: в kk.ts рядом стоит отставшее число ${чужие.join(", ")}`,
      ).toEqual([]);
    }
    expect(проверено, "ни один ключ не найден в kk.ts — сторож ослеп").toBeGreaterThan(0);
  });
});
