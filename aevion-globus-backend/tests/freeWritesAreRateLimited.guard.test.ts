import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Бесплатная запись без входа обязана иметь предел темпа.
 *
 * Замер 29.08.2026: создание проекта и создание сниппета — записи в базу БЕЗ
 * входа и без какой-либо платы — не были ограничены ничем: ни темпом, ни
 * потолком на пользователя, ни общим ограничителем на приложении.
 *
 * Почему это проглядели, стоит помнить: защиту ставят там, где трата ВИДНА.
 * За генерацию приходит счёт от поставщика, поэтому норма там появилась
 * сразу. Бесплатная запись счётом не приходит никогда — она тратит место и
 * время базы, то есть работу всех остальных. Самая незащищённая ручка
 * оказалась самой ДЕШЁВОЙ.
 */
const SRC = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
const LINES = SRC.split(String.fromCharCode(10));

/** Пути, закрытые списком на уровне роутера (devhubRouter.use([...], limiter)). */
function routerLevelPaths(): Set<string> {
  const out = new Set<string>();
  const at = SRC.indexOf("devhubRouter.use(");
  if (at < 0) return out;
  const seg = SRC.slice(at, at + 400);
  for (const m of seg.matchAll(/"(\/[^"]+)"/g)) out.add(m[1]);
  return out;
}

function unguardedFreeWrites(): string[] {
  // Признак — не «любой POST», а СОЗДАЁТ ЛИ СТРОКИ в нашей базе.
  //
  // Первая редакция считала пишущей любую POST-ручку и дала пять ложных:
  // /media/gumroad-checkout только собирает ссылку, /media/drive-search ищет
  // у Google, /plan спрашивает модель. Они ничего не создают у нас, и предел
  // им нужен по другой причине (деньги), за которой следит другой сторож.
  const guarded = routerLevelPaths();
  const CREATES = ["INSERT INTO", "dbSaveProject", "dbSaveSnippet", "memProjects.set", "memSnippets.set"];
  const starts: number[] = [];
  LINES.forEach((l, i) => {
    if (l.startsWith("devhubRouter.")) starts.push(i);
  });
  starts.push(LINES.length);
  const out: string[] = [];
  for (let s = 0; s < starts.length - 1; s++) {
    const head = LINES[starts[s]];
    if (![".post(", ".put(", ".patch(", ".delete("].some((v) => head.slice(0, 24).includes(v))) continue;
    const q = head.indexOf(String.fromCharCode(34));
    if (q < 0) continue;
    const path = head.slice(q + 1, head.indexOf(String.fromCharCode(34), q + 1));
    // Ручки с параметром требуют существующий проект — до них не добраться,
    // не создав его, а создание ограничено.
    if (path.includes(":")) continue;
    const body = LINES.slice(starts[s], starts[s + 1]).join(String.fromCharCode(10));
    if (!CREATES.some((k) => body.includes(k))) continue;
    const limited = head.includes("Limit(") || guarded.has(path);
    const needsAuth = body.includes("authentication required") || body.includes("admin_only");
    if (!limited && !needsAuth) out.push(path);
  }
  return out;
}

describe("бесплатная запись без входа ограничена", () => {
  it("прибор исправен: разбор нашёл пишущие ручки и защищённые среди них", () => {
    // Без этого пустой список нарушителей означал бы и «всё хорошо», и
    // «я не умею читать файл».
    const writes = LINES.filter((l) => l.startsWith("devhubRouter.") &&
      [".post(", ".put(", ".patch(", ".delete("].some((v) => l.slice(0, 24).includes(v)));
    expect(writes.length, "пишущих ручек не найдено").toBeGreaterThan(30);
    expect(SRC.includes("dhCreateLimit()"), "ограничитель создания исчез").toBe(true);
    expect(routerLevelPaths().size, "список на уровне роутера не разобрался").toBeGreaterThan(0);
  });

  it("ни одной незащищённой", () => {
    expect(
      unguardedFreeWrites(),
      "запись в базу без входа и без платы не ограничена ничем: добавьте dhCreateLimit() в объявление маршрута",
    ).toEqual([]);
  });
});
