import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// Next 16 передаёт `params` как Promise. Девять маршрутов объявляют его по-старому —
// объединением `Promise<X> | X` либо просто объектом. Живой поломки нет (страницы
// отдаются, CI зелёный на Turbopack), но сборка через webpack на этом падает уже
// сегодня, а слой совместимости в Next не вечен.
//
// Почему ратчет, а не запрет. Починки объявлений НЕ ХВАТИТ: в файлах тренажёра тело
// само разбирает оба вида (`typeof params.then === "function" ? use(params) : params`),
// и сужение типа ломает приведение. Значит править надо и тела — а это чужие зоны.
// Сторож, красный при неизменной системе, приучает не смотреть на красное.
//
// Поэтому долг зафиксирован и НЕ РАСТЁТ: новый маршрут со старой формой краснит
// проверку. Починили существующий — опустите порог.
//
// ⚠️ Про поиск. Мой первый свип не нашёл НИЧЕГО, потому что в регулярке класс
// `[^;{]*` исключал фигурную скобку, а `Promise<{ id: string }>` её содержит: шаблон
// убивал сам себя. Здесь ищется проще — строка с `params:` и вертикальной чертой либо
// объект без Promise.

const APP = join(__dirname, "..");
const BASELINE_LEGACY = 9; // замер 19.08.2026

/** Все page/layout под app/, кроме тестов. */
function routeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) routeFiles(p, out);
    else if (/^(page|layout)\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

/** Объявления `params`, не приведённые к Promise. */
export function legacyParamsLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*")) continue;
    const m = /(?:^|[^\w])params\s*:\s*(.*)$/.exec(line);
    if (!m) continue;

    // Смотрим ТОЛЬКО тип params, а не всю строку. Первая версия смотрела строку
    // целиком и дала правильное число по двум неверным причинам: считала виновным
    // `function loadRegistry(params: URLSearchParams): Promise<X | null>` (там своя
    // функция, а вертикальная черта в типе возврата) и ПРОПУСКАЛА
    // `{ params }: { params: { token: string } }): Promise<Metadata>` — в строке есть
    // «Promise<», но он относится к возврату, а не к params.
    let frag = m[1].trim();
    if (frag.startsWith("{")) {
      // Обрезаем по закрывающей скобке самого типа: остальное — чужое.
      const end = frag.indexOf("}");
      frag = end >= 0 ? frag.slice(0, end + 1) : frag;
    } else if (frag.startsWith("Promise<")) {
      // Тип начинается с Promise — берём до конца объявления (точка с запятой,
      // закрывающая скобка параметра), чтобы увидеть объединение, если оно есть.
      const end = frag.search(/[;)]/);
      frag = end >= 0 ? frag.slice(0, end) : frag;
    } else {
      // Не объект и не Promise — это не маршрутный params (например URLSearchParams).
      continue;
    }

    const union = frag.includes("|");
    const plainObject = frag.startsWith("{") && !frag.includes("Promise<");
    if (union || plainObject) out.push(line);
  }
  return out;
}

describe("форма params у маршрутов не уезжает назад", () => {
  const files = routeFiles(APP);

  test("прибор читает маршруты и различает формы", () => {
    // Отрицательный контроль на оба конца: без него «нарушений не выросло» могло бы
    // означать «файлов не найдено» или «шаблон не срабатывает никогда».
    expect(files.length).toBeGreaterThan(30);
    expect(legacyParamsLines("  params: Promise<{ id: string }> | { id: string };")).toHaveLength(1);
    expect(legacyParamsLines("{ params }: { params: { token: string } }")).toHaveLength(1);
    expect(legacyParamsLines("  params: Promise<{ id: string }>;")).toHaveLength(0);
    expect(legacyParamsLines("  // params: Promise<X> | X — так было раньше")).toHaveLength(0);
    // Два случая, на которых первая версия детектора дала верное ЧИСЛО по неверным
    // причинам: одно ложное срабатывание и один пропуск, случайно сошедшиеся.
    expect(
      legacyParamsLines("async function loadRegistry(params: URLSearchParams): Promise<Registry | null> {"),
      "своя функция с URLSearchParams — не маршрутный params",
    ).toHaveLength(0);
    expect(
      legacyParamsLines("export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {"),
      "объект без Promise должен ловиться, даже когда Promise есть в типе ВОЗВРАТА",
    ).toHaveLength(1);
  });

  test(`маршрутов со старой формой не больше ${BASELINE_LEGACY}`, () => {
    const guilty: string[] = [];
    for (const f of files) {
      if (legacyParamsLines(readFileSync(f, "utf8")).length) {
        guilty.push(f.slice(APP.length + 1).split(sep).join("/"));
      }
    }
    expect(
      guilty.length,
      `стало больше, чем при замере 19.08.2026. Next 16 передаёт params как Promise — новый маршрут обязан объявлять его так:\n${guilty.join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE_LEGACY);
  });
});
