/**
 * Витрина не объявляет сертифицированным то, что наш же реестр считает
 * незавершённым.
 *
 * 28.08.2026 две наши поверхности утверждали противоположное, обе живые:
 *
 *   aevion.app/pricing/security -> «SOC 2 Type II: Certified», «PCI DSS: Level 1»
 *   aevion.app/security         -> «Do you publish a SOC 2 report? Not yet —
 *                                   we ship the controls before paying for the audit»
 *
 * А источник правды — `aevion-globus-backend/src/data/trust.ts` — согласен со
 * второй: soc2 «in progress (Q3 2026)», iso27001 «in progress (Q4 2026)».
 *
 * SOC 2 и ISO 27001 не самопровозглашаются: их выдаёт аккредитованный орган
 * после аудита, и корпоративный покупатель первым делом просит номер отчёта.
 * Поэтому здесь запрет узкий и предметный: слово «сертифицирован» рядом с
 * названием стандарта, который в реестре ещё «in progress».
 *
 * Почему сторож читает ИМЕННО trust.ts, а не свой список: второй источник
 * правды о том же — ровно та причина, по которой расхождение и появилось.
 * Когда сертификация будет получена, правится ОДНА строка в реестре, и этот
 * тест перестанет запрещать слово сам.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TRUST = join(HERE, "..", "..", "..", "..", "aevion-globus-backend", "src", "data", "trust.ts");
const I18N = join(HERE, "..", "i18n-data.ts");

/** Стандарты из реестра, которые ЕЩЁ НЕ получены. */
function pendingStandards(): Array<{ id: string; label: string; status: string }> {
  const src = readFileSync(TRUST, "utf8");
  const out: Array<{ id: string; label: string; status: string }> = [];
  const re = /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*status:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[3] !== "live") out.push({ id: m[1], label: m[2], status: m[3] });
  }
  return out;
}

/** Слова, которыми объявляют полученную сертификацию — во всех трёх языках. */
const CLAIMED = [
  "certified",
  "сертифицирован",
  "сертификатталған",
  "level 1",
  "уровень 1",
  "1-деңгей",
];

describe("витрина не обгоняет реестр доверия", () => {
  it("контроль прибора: реестр читается и разбирается", () => {
    // Проверяем, что РАЗБОР работает, а не что конкретный стандарт не получен.
    //
    // Первая версия требовала `toContain("soc2")` среди незавершённых — и
    // покраснела бы в день, когда сертификацию наконец получат. Сторож,
    // краснеющий на хорошей новости, отключают в первый же день; я эту
    // ошибку чинил сегодня у других и повторил у себя через час.
    const src = readFileSync(TRUST, "utf8");
    const all = [...src.matchAll(/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*status:\s*"([^"]+)"/g)];
    expect(all.length, "в реестре не разобрано НИ ОДНОЙ записи — разбор сломан").toBeGreaterThan(3);
    // И словарь на месте: иначе поиск по нему был бы бессмысленно зелёным.
    expect(readFileSync(I18N, "utf8").length).toBeGreaterThan(10_000);
  });

  it("ни один незавершённый стандарт не объявлен полученным", () => {
    const dict = readFileSync(I18N, "utf8").toLowerCase();
    const bad: string[] = [];

    for (const std of pendingStandards()) {
      // Ищем значения ключей этого стандарта, а не всё подряд: слово
      // «certified» законно живёт в соседних текстах (глоссарий объясняет
      // термин, юридические страницы цитируют).
      const keyRe = new RegExp(`"[^"]*\\.${std.id}\\.[a-z]+"\\s*:\\s*"([^"]*)"`, "g");
      let m: RegExpExecArray | null;
      while ((m = keyRe.exec(dict))) {
        const value = m[1];
        if (CLAIMED.some((w) => value.includes(w))) {
          bad.push(`${std.id} (${std.status}) объявлен как «${value}»`);
        }
      }
    }

    expect(
      bad,
      "витрина объявляет полученным то, что реестр считает незавершённым:\n  " +
        bad.join("\n  ") +
        "\nЛибо обновите trust.ts (сертификация получена), либо смягчите текст.",
    ).toEqual([]);
  });

  it("контроль: запрет сработал бы на прежнем тексте", () => {
    // Мутация в самом тесте: проверяем, что список запрещённых слов ловит
    // ровно ту строку, которая стояла на проде до 28.08.
    const old = "certified";
    expect(CLAIMED.some((w) => old.includes(w))).toBe(true);
    expect(CLAIMED.some((w) => "controls in place, audit not yet purchased".includes(w))).toBe(false);
  });
});
