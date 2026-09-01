/**
 * Обещание допустимости в суде не появляется БЕЗ оговорки.
 *
 * 27.08 я нашёл это заявление на трёх поверхностях, смягчил и счёл работу
 * законченной. 28.08 сплошной свип нашёл ещё СЕМЬ, включая картинку превью
 * для соцсетей («Idea → admissible») и инвесторскую модель. Десять мест
 * суммарно, и второй раз подряд я объявил класс закрытым, пока он не был.
 *
 * Почему это вообще важно. Допустимость доказательства в конкретном суде
 * зависит от юрисдикции, вида спора и процессуальных правил. Мы её обеспечить
 * не можем — можем обеспечить подпись, отметку времени и ссылки на договоры.
 * Разница между «сертификат допустим в суде» и «сертификат доказывает, что
 * работа существовала в такой-то момент» — это разница между обещанием,
 * которого мы не выполним, и тем, что у нас действительно есть.
 *
 * ПРАВИЛО. Слова про суд разрешены только на строке, которая тут же называет
 * границу: что сертификат НЕ заменяет и от чего зависит его вес. Такая строка
 * в проекте есть и написана правильно — bureau/page.tsx, блок Legal Framework.
 *
 * ГРАНИЦА СТОРОЖА. Он проверяет СОСЕДСТВО слов, а не смысл: новую формулировку
 * без слова «admissible» («принимается судами», «court-ready») он пропустит,
 * пока её не добавят в список. Детектор «текст обещает больше, чем мы можем»
 * я строить не стал — сегодня проверял такой на соседнем классе, он выдаёт
 * успокаивающий ноль.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");

/** Слова, которыми обещают правовой РЕЗУЛЬТАТ, а не наш механизм. */
const VERDICT_WORDS = ["court-grade", "admissible", "court-ready", "апостил", "допустим в суд"];

/** Оговорки, при которых слово законно: строка сама называет границу. */
const HEDGES = [
  "under the legal frameworks",
  "do not constitute",
  "depends on the forum",
  "не заменяет",
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const stack = [SRC];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of readdirSync(cur)) {
      // __fixtures__ — данные для тестов, человек их не видит. Найдено
      // 31.08.2026: сторож краснел на cityMinimal.json, где слово живёт в
      // описании воздушной зоны.
      if (e === "node_modules" || e === "__tests__" || e === "__fixtures__") continue;
      const p = join(cur, e);
      if (statSync(p).isDirectory()) { stack.push(p); continue; }
      if (/[.](tsx?|json|md)$/.test(e)) out.push(p);
    }
  }
  return out;
}

/** Строки с обещанием суда, у которых на той же строке НЕТ оговорки. */
function unhedged(): string[] {
  const bad: string[] = [];
  for (const f of sourceFiles()) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      const t = line.trim();
      // Комментарии пропускаем: там законно цитируется прежний текст —
      // на этом сторож уже краснел у меня сегодня на собственном пояснении.
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      const low = line.toLowerCase();
      const hit = VERDICT_WORDS.find((w) => low.includes(w));
      if (!hit) return;
      // ОТРИЦАНИЕ — не обещание, а наоборот. Строка «flight along it is not
      // admissible» говорит, что полёта НЕ будет; считать её обещанием
      // правового результата — ложная тревога, а к постоянному красному
      // привыкают и сторожа отключают.
      //
      // Смотрим короткий кусок ПЕРЕД словом: там и живёт отрицание.
      // Найдено 31.08.2026 при сборке — сторож зацепился за описание
      // воздушной зоны, где слово вообще про допустимость ПОЛЁТА.
      const at = low.indexOf(hit);
      const before = low.slice(Math.max(0, at - 24), at);
      if (before.includes("not ") || before.includes("isn't") || before.includes("не ")) return;
      if (HEDGES.some((h) => low.includes(h.toLowerCase()))) return;
      bad.push(`${f.slice(f.indexOf("src"))}:${i + 1}  ${t.slice(0, 90)}`);
    });
  }
  return bad;
}

describe("обещание суда не стоит без оговорки", () => {
  it("контроль прибора: файлы читаются и слова вообще находятся", () => {
    const files = sourceFiles();
    expect(files.length, "не найдено ни одного исходника — обход сломан").toBeGreaterThan(200);
    // Положительный контроль: законная оговорка в проекте ЕСТЬ и содержит слово.
    const legal = files.filter((f) => f.endsWith("page.tsx"))
      .some((f) => {
        const s = readFileSync(f, "utf8").toLowerCase();
        return s.includes("admissible") && s.includes("under the legal frameworks");
      });
    expect(legal, "не нашёл законную оговорку — значит поиск слова не работает").toBe(true);
  });

  it("ни одного обещания суда без границы на той же строке", () => {
    const bad = unhedged();
    expect(
      bad,
      "текст обещает результат в суде, не называя границу:\n  " + bad.join("\n  ") +
        "\nДопустимость зависит от юрисдикции и спора — мы её не обеспечиваем. " +
        "Опишите механизм (подпись, отметка времени, ссылки на договоры) либо " +
        "добавьте на ту же строку оговорку, что сертификат НЕ заменяет.",
    ).toEqual([]);
  });

  it("контроль: прежние формулировки были бы пойманы, нынешние — нет", () => {
    const has = (s: string) => VERDICT_WORDS.some((w) => s.toLowerCase().includes(w));
    const hedged = (s: string) => HEDGES.some((h) => s.toLowerCase().includes(h.toLowerCase()));
    // то, что стояло на проде до 28.08
    for (const old of [
      "From idea to court-grade certificate in one flow",
      "Bureau wraps everything in an admissible-evidence PDF.",
      "Idea → admissible",
    ]) {
      expect(has(old) && !hedged(old), `прежнее «${old.slice(0, 30)}…» должно ловиться`).toBe(true);
    }
    // то, чем заменили
    for (const now of [
      "From idea to a signed, timestamped certificate in one flow",
      "Bureau wraps everything into a signed, timestamped PDF.",
    ]) {
      expect(has(now), `нынешнее «${now.slice(0, 30)}…» не должно ловиться`).toBe(false);
    }
  });
});
