import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { COMPARISONS, moduleHref, NOT_COMPARED_NOTE } from "../competitors";

/**
 * Новый модуль в реестре не должен молча выпадать из сравнения.
 *
 * Так уже произошло: Ventures появился в каталоге, сравнения для него не было,
 * и в оговорке «чего здесь нет» он тоже не упоминался. Снаружи это выглядит
 * как полный обзор платформы, из которого без объяснений пропал модуль, — а
 * поймал я это только сверкой руками.
 *
 * Правило: каждый модуль реестра либо сравнён, либо назван в NOT_COMPARED_NOTE
 * с причиной. Третьего состояния «просто забыли» быть не должно.
 *
 * Реестр читается как текст, а не импортируется: он лежит в соседнем пакете
 * (backend), и тянуть его сборку в тесты фронтенда ради списка id — дороже,
 * чем разобрать регуляркой.
 */

const REGISTRY = resolve(__dirname, "../../../../aevion-globus-backend/src/data/projects.ts");

describe("сравнением покрыт весь реестр модулей", () => {
  it("реестр на месте — иначе проверка ничего не проверяет", () => {
    // Без этой строки исчезнувший файл дал бы пустой список id и зелёный тест
    // на пустом месте — самый неприятный вид ложного «всё хорошо».
    expect(existsSync(REGISTRY), `Не найден реестр модулей: ${REGISTRY}`).toBe(true);
  });

  it("каждый модуль реестра либо сравнён, либо назван в оговорке", () => {
    const src = readFileSync(REGISTRY, "utf8");
    const registryIds = [...src.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(registryIds.length, "Из реестра не извлеклось ни одного id").toBeGreaterThan(10);

    const compared = new Set(COMPARISONS.map((c) => c.id));
    const note = NOT_COMPARED_NOTE.toLowerCase();

    const silent = registryIds.filter((id) => {
      if (compared.has(id)) return false;
      // В оговорке модули названы человеческими именами («Voice of the Earth»,
      // «QPayNet Embedded»), а не id — сравниваем по словам id.
      const words = id.split("-").filter((w) => w.length > 2);
      return !words.every((w) => note.includes(w));
    });

    expect(
      silent,
      "Модуль есть в реестре, но ни сравнения, ни причины пропуска:\n" + silent.join(", "),
    ).toEqual([]);
  });

  it("стадия модуля не громче, чем в реестре", () => {
    // Проверка НЕСИММЕТРИЧНА, и это главное в ней.
    //
    // Реестр отдаёт live всему, что открыто и работает. Написать у себя mvp,
    // когда реестр говорит live, — можно и нужно: у MapReality в описании
    // прямо «MVP», у QTradeOffline нет ни даты запуска, ни следа проверки, и
    // рядом с Coursera бейдж «живой» читался бы как заявка на равенство.
    //
    // А вот обратное — назвать живым то, что реестр держит за mvp, — это
    // ровно преувеличение, из-за которого сравнению перестают верить. Такое
    // и ловим.
    const src = readFileSync(REGISTRY, "utf8");
    const status = new Map<string, string>();
    for (const m of src.matchAll(/\bid:\s*"([^"]+)"([\s\S]{0,3000}?)\n  \},/g)) {
      const st = /\bstatus:\s*"([^"]+)"/.exec(m[2]);
      if (st) status.set(m[1], st[1]);
    }
    expect(status.size, "Из реестра не извлеклось ни одной стадии").toBeGreaterThan(10);

    // Покрытие проверяем явно: если окно разбора сузится и стадии перестанут
    // находиться, тест снова станет зелёным — но уже потому, что ничего не
    // сравнивает. Так и было: при окне 1500 символов QSkyway выпадал молча.
    const covered = COMPARISONS.filter((c) => status.has(c.id)).length;
    expect(
      covered,
      `Стадия сверяется лишь у ${covered} модулей из ${COMPARISONS.length} — разбор реестра сузился`,
    ).toBeGreaterThanOrEqual(COMPARISONS.length - 2);

    const louder = COMPARISONS.filter(
      (c) => c.stage === "live" && status.get(c.id) === "mvp",
    ).map((c) => `${c.id}: у нас live, в реестре mvp`);

    expect(louder, "Стадия завышена относительно реестра:\n" + louder.join("\n")).toEqual([]);
  });

  it("ссылка «Открыть модуль» ведёт на существующий маршрут", () => {
    // У 35 из 37 модулей путь совпадает с id, у двух нет (/bureau, /build).
    // Ровно такие исключения и ломаются молча: ссылка ведёт на 404, а
    // выглядит страница при этом целой.
    const appDir = resolve(__dirname, "../../app");
    const broken = COMPARISONS.filter(
      (c) => !existsSync(resolve(appDir, moduleHref(c.id).slice(1), "page.tsx")),
    ).map((c) => `${c.id} → ${moduleHref(c.id)}`);

    expect(broken, "Ссылка ведёт на несуществующую страницу:\n" + broken.join("\n")).toEqual([]);
  });
});
