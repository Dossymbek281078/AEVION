import { describe, test, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../../../__tests__/helpers/sourceCode";

/**
 * Каждая ручка, обещанная на витрине API, существует — и с тем же методом.
 *
 * ЗАЧЕМ. Страница /payments/api — обещание разработчику, который будет
 * встраивать нашу рельсу. Обещание живёт в одном файле, исполнение в другом, и
 * связи между ними нет: переименуй каталог маршрута — витрина продолжит
 * обещать, сборка останется зелёной, а расхождение найдёт чужой разработчик,
 * уже начавший встраивание.
 *
 * ЗАМЕР 01.09.2026: обещано 6 ручек, расхождений 0. Сторож ставится НЕ по факту
 * поломки, а потому что класс у нас уже случался на других витринах и находится
 * только глазами.
 *
 * ПЕРВАЯ РЕДАКЦИЯ ДАЛА «6 из 6 расхождений» — и это была ошибка ПРИБОРА: пути
 * на витрине заданы от корня рельсы (/v1/links), а сравнивались с путями от
 * корня API. Поймал контроль: заведомо живой POST /v1/links не находился.
 * Поэтому контроль стоит ПЕРВЫМ тестом и проверяет обе стороны — иначе «всё
 * сходится» означало бы «я ничего не умею находить».
 *
 * Разбор позиционный, без регулярок: собранные строкой классы символов у нас
 * уже теряли обратный слэш и делали сторожа пустым молча.
 *
 * ГРАНИЦА ЧЕСТНАЯ. Сверяется наличие маршрута и метода, а не поведение и не
 * поля ответа. Обратное направление (ручка есть, на витрине не описана) НЕ
 * проверяется намеренно: недокументированная ручка — не сломанное обещание.
 * Замер того же дня: таких шесть, среди них возвраты и споры.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..", "..", "..");
const API = join(APP, "api");
const PAGE = join(HERE, "..", "page.tsx");
const RAIL_BASE = "/payments";
const METHODS = ["GET", "POST", "PATCH", "DELETE"];

/** Значение строкового поля вида `имя: "значение"`, начиная с позиции. */
function fieldAfter(src: string, from: number, name: string): { value: string; end: number } | null {
  const at = src.indexOf(name + ":", from);
  if (at < 0) return null;
  const q1 = src.indexOf('"', at);
  if (q1 < 0) return null;
  const q2 = src.indexOf('"', q1 + 1);
  if (q2 < 0) return null;
  return { value: src.slice(q1 + 1, q2), end: q2 };
}

/** Пары «метод + путь», обещанные на витрине. */
function promised(): Array<{ method: string; path: string }> {
  // Комментарии срезаются с ОБЕИХ сторон сравнения. Закомментированная
  // запись на витрине — не обещание, а закомментированный обработчик — не
  // маршрут. Без среза первое давало бы ложное красное, второе — ложное
  // ЗЕЛЁНОЕ; второе тише и потому дороже.
  //
  // Честная граница: мутационно закреплена только сторона МАРШРУТА — там
  // спрятанный в комментарий обработчик делает сторожа зелёным, и проба на это
  // есть. Сторона витрины пробы не имеет: чтобы её поставить, пришлось бы
  // держать в самой витрине закомментированную запись ради теста. Направление
  // её отказа безопаснее — ложное КРАСНОЕ, а оно громкое и разберётся сразу.
  const src = stripComments(readFileSync(PAGE, "utf8"));
  const out: Array<{ method: string; path: string }> = [];
  let pos = 0;
  for (;;) {
    const m = fieldAfter(src, pos, "method");
    if (!m) break;
    pos = m.end;
    if (!METHODS.includes(m.value)) continue;
    const p = fieldAfter(src, pos, "path");
    if (!p) break;
    // Поле path должно идти сразу за method: если между ними влез другой
    // объект, пара собрана неверно, и лучше её пропустить, чем выдумать.
    if (p.value.startsWith("/")) out.push({ method: m.value, path: RAIL_BASE + p.value });
  }
  return out;
}

/**
 * Разделитель пути к косой черте.
 *
 * Через String.fromCharCode, а не регуляркой: класс символов с обратным слэшем
 * у нас уже трижды за день терял экранирование по дороге в файл — и здесь тоже:
 * ключи маршрутов оставались windows-овскими, заведомо живая ручка «не
 * находилась», и сторож краснел на исправном коде. Поймал собственный контроль.
 */
function toPosix(p: string): string {
  return p.split(String.fromCharCode(92)).join("/");
}

/** Сегмент-параметр приводится к звёздочке: `:id` на витрине и `[id]` в файлах. */
function norm(path: string): string {
  const parts = path.split("/").map((seg) => {
    if (seg.startsWith(":")) return "*";
    if (seg.startsWith("[") && seg.endsWith("]")) return "*";
    return seg;
  });
  const joined = parts.join("/");
  return joined.endsWith("/") ? joined.slice(0, -1) : joined;
}

/** Маршруты, которые ДЕЙСТВИТЕЛЬНО есть, и методы каждого. */
function real(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry !== "route.ts") continue;
      const key = norm("/" + toPosix(relative(API, dir)));
      const src = stripComments(readFileSync(full, "utf8"));
      const methods = new Set<string>();
      for (const m of METHODS) {
        if (src.includes("export async function " + m)) methods.add(m);
      }
      found.set(key, methods);
    }
  };
  walk(API);
  return found;
}


describe("витрина API не обещает того, чего нет", () => {
  const doc = promised();
  const routes = real();

  test("контроль: обе стороны читаются и способ различает живое и выдуманное", () => {
    expect(doc.length, "обещаний на витрине не найдено").toBeGreaterThanOrEqual(5);
    expect(routes.size, "маршрутов не найдено").toBeGreaterThanOrEqual(10);
    expect(
      routes.get("/payments/v1/links")?.has("POST"),
      "заведомо живая ручка не опознана — сравнение ниже ничего не значит",
    ).toBe(true);
    expect(routes.has("/payments/v1/nikogda-ne-bylo"), "выдуманная ручка опознана как живая").toBe(false);
  });

  test("каждая обещанная ручка существует", () => {
    const missing = doc.filter((d) => !routes.has(norm(d.path)));
    expect(
      missing.map((d) => d.method + " " + d.path),
      "витрина обещает разработчику ручку, которой нет: он начнёт встраивание и упрётся",
    ).toEqual([]);
  });

  test("метод обещанной ручки совпадает с настоящим", () => {
    // Отдельным тестом: «маршрут есть» и «он принимает обещанный метод» —
    // разные утверждения, и второе ломается тише. POST на ручку, у которой
    // только GET, отвечает 405, и это выглядит как ошибка вызывающего.
    const wrong = doc
      .filter((d) => routes.has(norm(d.path)))
      .filter((d) => !routes.get(norm(d.path))!.has(d.method))
      .map((d) => d.method + " " + d.path + " (есть: " + [...routes.get(norm(d.path))!].sort().join(",") + ")");
    expect(wrong, "витрина обещает метод, которого у ручки нет").toEqual([]);
  });

  test("страница витрины на месте", () => {
    expect(existsSync(PAGE), "витрина API исчезла — обещания читать неоткуда").toBe(true);
  });
});
