import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Обещание по доступности не должно быть выше опубликованного договора.
 *
 * GET /api/quotas — не маркетинг, а машиночитаемый контракт: у него версия
 * (1.1.0), дата публикации, ссылка на документацию и адрес для связи. Лестница
 * там такая: Developer — SLA нет, Build 99.0, Scale 99.5, Enterprise 99.9.
 *
 * До 19.08.2026 три поверхности обещали больше:
 *   - витрина trust.ts: «99.5%», подпись «Business · 99.95% Enterprise»
 *     (99.5 — это уровень Scale за $249, «Business» — несуществующий тариф,
 *     99.95 — сверх договора);
 *   - глоссарий на /pricing: «99.9% на всё, 99.95% Enterprise»;
 *   - раздел безопасности: то же самое, на трёх языках.
 *
 * Это не спор о позиционировании. Число выше договора — обязательство, которого
 * никто не брал, и в разборе после инцидента ссылаются именно на него.
 *
 * Сторож простой: ни одна цифра доступности на витрине не должна превышать
 * максимум из контракта.
 */

const QUOTAS = join(__dirname, "..", "src", "routes", "apiQuotas.ts");
const TRUST = join(__dirname, "..", "src", "data", "trust.ts");
const I18N = join(__dirname, "..", "..", "frontend", "src", "lib", "i18n-data.ts");

/** Значения uptime из опубликованного договора. */
function contractUptimes(): number[] {
  const src = readFileSync(QUOTAS, "utf8");
  return [...src.matchAll(/sla:\s*\{\s*uptime:\s*([\d.]+)/g)].map((m) => Number(m[1]));
}

/** Все проценты доступности, встречающиеся в тексте витрины. */
function claimedUptimes(text: string): number[] {
  const out: number[] = [];
  // Берём только 9x.x% — проценты скидок и конверсий сюда не попадут.
  for (const m of text.matchAll(/\b(9\d(?:\.\d+)?)%/g)) out.push(Number(m[1]));
  return out;
}

describe("обещание SLA не выше опубликованного договора", () => {
  const contract = contractUptimes();
  const max = Math.max(...contract);

  test("контроль: лестница договора вообще прочиталась", () => {
    // Пустой разбор дал бы зелёный на любом обещании.
    expect(contract.length, "в apiQuotas.ts не нашлось ни одного uptime").toBeGreaterThanOrEqual(3);
    expect(max).toBeGreaterThan(90);
    expect(max).toBeLessThan(100);
  });

  test("витрина не обещает больше договора", () => {
    const src = readFileSync(TRUST, "utf8");
    // Комментарии сами цитируют прежние неверные числа — по ним не судим.
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");

    const over = claimedUptimes(code).filter((v) => v > max);

    expect(over, `trust.ts обещает ${over.join(", ")}% при максимуме договора ${max}%`).toEqual([]);
  });

  test("глоссарий и раздел безопасности не обещают больше договора", () => {
    if (!existsSync(I18N)) return; // фронт может отсутствовать в урезанной проверке
    const src = readFileSync(I18N, "utf8");

    const bad: string[] = [];
    for (const m of src.matchAll(/"(pricing\.glossary\.def\.sla|pricing\.security\.pillar\.bcp\.body)":\s*"([^"]+)"/g)) {
      for (const v of claimedUptimes(m[2])) {
        if (v > max) bad.push(`${m[1]}: ${v}% > ${max}%`);
      }
    }

    expect(bad, bad.join("; ")).toEqual([]);
  });

  test("контроль: сторож умеет краснеть", () => {
    // Если бы разбор процентов не работал, все проверки выше проходили бы
    // на любом тексте. Проверяем на заведомо завышенном обещании.
    expect(claimedUptimes("SLA uptime 99.95% (Enterprise)").some((v) => v > max)).toBe(true);
  });
});
