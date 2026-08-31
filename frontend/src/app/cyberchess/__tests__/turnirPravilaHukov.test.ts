import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Страница турнира: useMemo стоял ПОСЛЕ двух ранних возвратов (скелет загрузки
 * и сетка на выбывание). Это нарушение правил хуков.
 *
 * Честная граница находки: на живой сборке 31.08.2026 страница НЕ падала —
 * проверено на четырёх турнирах всех форматов, ошибок страницы ноль. Родитель
 * не показывает таблицу, пока данные не пришли, поэтому число хуков между
 * отрисовками не менялось. Это мина, а не авария: стоит появиться отрисовке с
 * loading=true и пустой таблицей — и React уронит страницу целиком.
 *
 * Своим инструментом это ловится, а линтером сайта нет: он не запускается
 * вовсе (ESLint 10.7 против eslint-plugin-react).
 */

const KOD = () =>
  readFileSync(join(process.cwd(), "src/app/cyberchess/tournaments/[id]/page.tsx"), "utf8");

describe("хуки в StandingsView объявлены до любых возвратов", () => {
  it("useMemo стоит РАНЬШЕ первого раннего возврата", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(10000); // контроль: файл прочитан

    const nachalo = s.indexOf("function StandingsView(");
    expect(nachalo).toBeGreaterThan(0);
    const telo = s.slice(nachalo);

    const hook = telo.indexOf("useMemo(");
    const vozvrat = telo.indexOf("return <SkeletonBox");
    expect(hook).toBeGreaterThan(0);
    expect(vozvrat).toBeGreaterThan(0);
    expect(hook).toBeLessThan(vozvrat);
  });

  it("оба ранних возврата на месте — иначе проверка выше ничего не значит", () => {
    // Если возвраты уберут, порядок хуков перестанет быть вопросом, и тест
    // должен покраснеть, чтобы его пересмотрели, а не молча зеленеть.
    const s = KOD();
    expect(s).toContain("return <SkeletonBox");
    expect(s).toContain("if (loading && standings.length === 0)");
  });
});

describe("на экране турнира нет внутренних слов", () => {
  it("машинный идентификатор не показывается человеку", () => {
    const s = KOD();
    // Было «tournament_id: winter-arena-12» — внутреннее имя поля и формат.
    expect(s).not.toContain("tournament_id:");
    expect(s).toContain("Адрес турнира:");
  });
});
