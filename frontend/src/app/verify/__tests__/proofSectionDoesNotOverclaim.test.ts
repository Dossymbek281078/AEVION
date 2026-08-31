// Описание раздела «Cryptographic Proof» на странице проверки — текст, который
// читает третья сторона: суд, площадка, работодатель. Он дважды устарел
// незаметно:
//
//   * говорил «три доказательства», когда строк стало четыре (добавилось
//     заверение платформы);
//   * обещал «измени любое зарегистрированное поле — хотя бы одно из трёх
//     перестанет сходиться», хотя у сертификатов правила v1 хеш покрывал
//     только название, описание и тип работы. Страна и город на сертификате
//     напечатаны, но хешом НЕ покрыты.
//
// Второе опаснее: обещание про подделку — это то, ради чего сертификат и
// показывают. Сторож смотрит не на красоту формулировки, а на два факта:
// счёт не зашит словом и оговорка про v1 на месте.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "[id]",
  "page.tsx",
);

function proofTip(): string {
  const src = fs.readFileSync(PAGE, "utf8");
  const i = src.indexOf('label="Cryptographic Proof"');
  expect(i, "не нашёл раздел — проверка смотрит не туда").toBeGreaterThan(0);
  const j = src.indexOf('text="', i);
  const k = src.indexOf('"\n', j + 6);
  return src.slice(j, k);
}

describe("описание доказательств не обещает лишнего", () => {
  it("не зашивает количество словом", () => {
    expect(proofTip()).not.toMatch(/\b(three|four|five)\s+derived/i);
  });

  it("называет границу правила v1", () => {
    const t = proofTip();
    expect(t, "оговорка про непокрытые поля исчезла").toMatch(/v1/i);
    expect(t).toMatch(/country and city/i);
  });

  it("контроль: шаблон умеет находить запрещённое", () => {
    expect("Three derived proofs (SHA-256").toMatch(/\b(three|four|five)\s+derived/i);
  });
});
