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
  const max = contract.length ? Math.max(...contract) : 0;

  test("🔴 07.10.2026: в договоре НЕТ обещания доступности — и это проверяется", () => {
    // Прежде здесь стоял контроль «лестница прочиталась, значений не меньше
    // трёх». Он был верен, пока договор обещал 99 / 99.5 / 99.9. Обещание
    // снято (прибора нет), поэтому проверяется обратное: числовых uptime в
    // договоре не осталось, а поле на месте — интеграторы его разбирают.
    expect(contract.length, "в договоре снова появилось числовое обещание доступности").toBe(0);
    const src = readFileSync(QUOTAS, "utf8");
    expect(src, "поле uptime удалено — интеграторы сломаются молча").toMatch(/uptime:\s*null/);
    expect(src, "нет пояснения, почему числа нет").toMatch(/uptimeNote/);
  });

  test("🔴 в договоре нет и обещанного срока ответа", () => {
    // Снято 07.10.2026 по той же причине, что доступность: за сроками 48/24/4
    // не стоит ни очередь обращений, ни приоритет, ни замер. Поле на месте,
    // чтобы интеграторы не сломались на исчезнувшем ключе.
    const src = readFileSync(QUOTAS, "utf8");
    expect(src, "вернулось числовое обещание срока ответа").not.toMatch(/supportResponseHours:\s*\d/);
    expect(src, "поле срока удалено — интеграторы сломаются молча").toMatch(/supportResponseHours:\s*null/);
    expect(src, "нет пояснения про срок ответа").toMatch(/supportResponseNote/);
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
