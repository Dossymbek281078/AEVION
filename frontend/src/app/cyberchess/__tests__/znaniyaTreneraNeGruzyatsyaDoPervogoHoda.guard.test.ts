import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 До первого возможного хода гостя страница шахмат не тянет знания тренера.
 *
 * Повод 13.10.2026 (замер прода, чистый контекст): время до готовой доски на
 * /cyberchess?puzzle= — телефон без троттлинга медиана 4,7 с, Fast 3G 7,1–7,8 с;
 * /devhub тем же прибором — 0,9 / 3,0 с. Держит объём JS (~1 МБ в 27–29 файлах);
 * coachKnowledge (160 КБ текста, отдельный чанк ~45 КБ сжатого) грузился до
 * готовности только потому, что page.tsx статически импортировал из него
 * getDueReminders. Теперь напоминания — в coachReminders.ts, данные — по требованию.
 *
 * Храповик: сумма исходников статически импортируемых page.tsx локальных модулей
 * (прокси объёма критического пути — сборку тест не видит). Расти нельзя.
 */
const КОРЕНЬ = join(process.cwd(), "src/app/cyberchess");
const СТРАНИЦА = readFileSync(join(КОРЕНЬ, "page.tsx"), "utf8");
const ПРЕДЕЛ_БАЙТ = 1_040_000; // 13.10: было 1 196 766 с coachKnowledge, стало ~1 033 600

function статическиеЛокальныеИмпорты(src: string): string[] {
  const out: string[] = [];
  const re = /^import (?!type )[^;]*? from "\.\/([A-Za-z0-9_./-]+)";/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return [...new Set(out)];
}

describe("знания тренера не грузятся до первого хода", () => {
  it("🔴 page.tsx импортирует из coachKnowledge только тип; данные — динамическим import при карточках", () => {
    expect(СТРАНИЦА).not.toMatch(/^import \{[^}]*\} from "\.\/coachKnowledge";/m);
    expect(СТРАНИЦА).toMatch(/^import type \{[^}]*\} from "\.\/coachKnowledge";/m);
    expect(СТРАНИЦА).toContain('import("./coachKnowledge")');
    expect(СТРАНИЦА).toContain('from "./coachReminders"');
    // единственное допустимое обращение — m.COACH_KNOWLEDGE внутри динамического import
    expect(СТРАНИЦА.split("COACH_KNOWLEDGE").length - 1).toBe(СТРАНИЦА.split("m.COACH_KNOWLEDGE").length - 1);
  });

  it("напоминания живут отдельно и не тянут данные", () => {
    const p = join(КОРЕНЬ, "coachReminders.ts");
    expect(existsSync(p)).toBe(true);
    const т = readFileSync(p, "utf8");
    expect(т).toContain("export function getDueReminders");
    expect(т).not.toContain("COACH_KNOWLEDGE");
    expect(т).not.toMatch(/from "\.\/coachKnowledge"/);
    expect(statSync(p).size).toBeLessThan(6_000);
  });

  it(`храповик: исходники статических локальных импортов page.tsx ≤ ${ПРЕДЕЛ_БАЙТ.toLocaleString("ru-RU")} байт`, () => {
    const модули = статическиеЛокальныеИмпорты(СТРАНИЦА);
    let сумма = 0; let найдено = 0;
    for (const m of модули) {
      for (const c of [`${m}.ts`, `${m}.tsx`, `${m}/index.ts`]) {
        const p = join(КОРЕНЬ, c);
        if (existsSync(p)) { сумма += statSync(p).size; найдено += 1; break; }
      }
    }
    expect(найдено, "знаменатель: модулей найдено").toBeGreaterThan(60);
    expect(модули).not.toContain("coachKnowledge");
    expect(сумма, `сумма ${сумма} байт по ${найдено} модулям`).toBeLessThanOrEqual(ПРЕДЕЛ_БАЙТ);
  });

  it("КОНТРОЛЬ: прибор отличает статический импорт от type-only и динамического", () => {
    const пример = 'import { a } from "./x";\nimport type { T } from "./y";\nconst z = () => import("./w");\n';
    expect(статическиеЛокальныеИмпорты(пример)).toEqual(["x"]);
  });
});
