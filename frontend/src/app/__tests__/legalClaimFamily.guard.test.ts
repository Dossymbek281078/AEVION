import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Семейство правовых обещаний не должно РАСТИ, пока решение о формулировке
 * ждёт слова основателя.
 *
 * История, ради которой сторож написан. 29.08.2026 я собрал список мест, где мы
 * обещаем допустимость сертификата в суде, — искал по словам
 * `admissible|apostille`, вышло 12. Потом случайно нашёл тринадцатое, где этих
 * слов нет вовсе («evidence of prior art and authorship»), и оно уезжает ВНУТРИ
 * самого сертификата. Обход СЕМЕЙСТВА вместо слова дал 22 совпадения.
 *
 * Вывод, закреплённый здесь: обещание — это смысл, а не слово. Сторож ищет
 * несколько формулировок одного смысла, а известные места держит списком,
 * который обязан только СОКРАЩАТЬСЯ.
 *
 * ⚠️ Он НЕ решает, какая формулировка правильная — это решение основателя
 * (разбор: Desktop/АЕВИОН/00-НАЧНИ-ОТСЮДА/2026-08-29-РЕШЕНИЕ-формулировка-о-
 * суде-12-мест.md). Он лишь не даёт списку вырасти незаметно.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Разные способы сказать одно и то же — по смыслу, а не по слову. */
const CLAIM = /admissible|apostille|evidence of (prior|authorship)|legally[- ]binding|worth in court/i;

/**
 * Места, где текст ОГРАНИЧИВАЕТ обещание, а не даёт его. Их не надо ни
 * сокращать, ни трогать — наоборот, пусть живут. Держу отдельным списком,
 * потому что смешать «обещание» и «оговорку» в одном перечне значит однажды
 * «починить» оговорку заодно с обещанием.
 */
const DISCLAIMERS = [
  // «не является юридической консультацией и может не иметь юридической силы
  // без независимой квалифицированной проверки»
  "components/ComplianceBanner.tsx",
];

/** Известные места С ОБЕЩАНИЕМ на 29.08.2026. Список обязан только сокращаться. */
const BASELINE = [
  "app/bureau/page.tsx",
  "app/demo/opengraph-image.tsx",
  "app/demo/page.tsx",
  "app/developers/page.tsx",
  "app/help/page.tsx",
  "app/terms/page.tsx",
  "data/demoDeep.ts",
  "data/pitchModel.ts",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "__tests__" || e === ".next") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/[.](ts|tsx)$/.test(e) && !/[.]test[.]/.test(e)) out.push(p);
  }
  return out;
}

describe("правовые обещания не растут, пока решение не принято", () => {
  const files = walk(SRC);
  const hit: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const live = src
      .split("\n")
      .filter((l) => !/^\s*([/][/]|[*])/.test(l))
      .join("\n");
    if (CLAIM.test(live)) hit.push(f.slice(SRC.length + 1).split(sep).join("/"));
  }

  test("контроль: обход нашёл файлы (иначе проверка ниже зелёная молча)", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  test("новых мест с обещанием о суде не появилось", () => {
    const fresh = hit.filter((f) => !BASELINE.includes(f) && !DISCLAIMERS.includes(f));
    expect(fresh, `новое правовое обещание: ${fresh.join(", ")} — см. решение основателя`).toEqual([]);
  });

  test("исчезнувшие места вычеркнуты из списка", () => {
    const gone = [...BASELINE, ...DISCLAIMERS].filter((f) => !hit.includes(f));
    expect(gone, `починено — вычеркните из BASELINE: ${gone.join(", ")}`).toEqual([]);
  });
});
