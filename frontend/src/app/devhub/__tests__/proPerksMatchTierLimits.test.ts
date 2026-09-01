import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Числа, которыми продаётся Studio Pro, обязаны совпадать с пределами, по
 * которым стоит ограничитель.
 *
 * Строка `pro.perks` («50 видео с ИИ · 200 картинок · …») живёт в словаре
 * витрины, а пределы — в `TIER_LIMITS` на бэкенде. Это разные файлы, разные
 * репозитории в голове и разные люди. 27.08.2026 такая же копия уже нашлась
 * ВНУТРИ бэкенда (ручка отдавала клиенту литеральный дубль таблицы) — здесь
 * третья.
 *
 * Правильная починка — подставлять числа из ручки состояния тарифа, и она
 * стоит больше одной правки: строку надо развести на три языка с подстановкой.
 * До тех пор сторож держит хотя бы совпадение: цену меняют редко, а разойтись
 * молча она может при первой же правке.
 *
 * Почему это важнее, чем кажется: расхождение здесь не падает и не пишется в
 * журнал. Человек покупает за $149 «50 видео», упирается в 30 и считает, что
 * у нас не работает.
 */

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");
const DICT = path.join(__dirname, "..", "i18n.ts");
const BACKEND = path.join(REPO_ROOT, "aevion-globus-backend", "src", "routes", "devhub.ts");

/** Пределы тарифа pro, прочитанные из объявления на бэкенде. */
function backendProLimits(): { video: number; image: number } {
  const src = fs.readFileSync(BACKEND, "utf8");
  const m = src.match(/pro:\s*\{\s*video:\s*(-?\d+),\s*image:\s*(-?\d+)/);
  if (!m) throw new Error("не найдено объявление пределов тарифа pro на бэкенде");
  return { video: Number(m[1]), image: Number(m[2]) };
}

/** Все переводы строки, которой продаётся тариф. */
function perkStrings(): string[] {
  const src = fs.readFileSync(DICT, "utf8");
  const found = [...src.matchAll(/"pro\.perks":\s*"([^"]*)"/g)].map((m) => m[1]);
  return found;
}

describe("продаваемые числа совпадают с пределами", () => {
  test("прибор работает: оба файла прочитаны, объявления найдены", () => {
    const limits = backendProLimits();
    expect(limits.video).toBeGreaterThan(0);
    expect(limits.image).toBeGreaterThan(0);
    // Языков в словаре три; если строка исчезнет из всех, проверка ниже станет
    // пустой и «пройдёт» — поэтому наличие проверяется отдельно.
    expect(perkStrings().length).toBeGreaterThanOrEqual(3);
  });

  test("каждая языковая версия называет те же числа", () => {
    const { video, image } = backendProLimits();
    for (const s of perkStrings()) {
      const numbers = [...s.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
      expect(
        numbers,
        `строка тарифа обещает не те числа, что сдерживает ограничитель (${video}/${image}): ${s}`,
      ).toContain(video);
      expect(numbers).toContain(image);
    }
  });
});
