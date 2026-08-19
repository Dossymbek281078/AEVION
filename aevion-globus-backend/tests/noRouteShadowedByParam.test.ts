// Буквальный маршрут не должен стоять ПОСЛЕ параметрического, который его
// перехватывает.
//
// Express разбирает маршруты по порядку регистрации. Если `/prompts/:id`
// объявлен раньше `/prompts/audit`, то слово "audit" приходит в него как
// идентификатор, и второй обработчик НЕДОСТИЖИМ — не «иногда», а никогда.
//
// Три случая, найденных 19.08.2026 (первый — пробой прода, два — этим свипом):
//
//   /prompts/audit      <- /prompts/:id   (835 строк выше)  qcoreai.ts
//   /sessions/archived  <- /sessions/:id  (70 строк выше)   qcoreai.ts
//   /admin/bulk         <- /admin/:id     (931 строка выше) modules.ts
//
// Снаружи это выглядит как чужой ответ: прод отдавал
// 404 {"error":"prompt not found"} и {"error":"session not found"} — то есть
// ошибку про ДРУГОЙ предмет. А клиент глотал её (`catch { /* noop */ }`), и
// страница просто оставалась пустой.
//
// ИСКЛЮЧЕНИЕ, и оно рабочее: параметрический обработчик может пропустить
// запрос дальше сам —
//     if (id === "search") return next("route");
// Так сделано в build/profiles.ts, и это НЕ дефект. Сторож обязан его
// признавать, иначе покраснеет на исправном коде и будет отключён.

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROUTES = path.join(__dirname, "..", "src", "routes");
const walk = (d: string, a: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p, a);
    else if (p.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(p)) a.push(p);
  }
  return a;
};

interface R { pos: number; method: string; path: string; line: number; body: string }

const shadowed: string[] = [];
let scanned = 0;

for (const file of walk(ROUTES)) {
  const raw = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  const routes: R[] = [];
  for (const m of raw.matchAll(/\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
    const pos = m.index ?? 0;
    // тело обработчика — до следующей регистрации, этого хватает для поиска next
    routes.push({
      pos, method: m[1], path: m[2],
      line: raw.slice(0, pos).split("\n").length,
      body: raw.slice(pos, pos + 900),
    });
  }
  scanned += routes.length;

  for (const lit of routes) {
    if (lit.path.includes(":") || lit.path.includes("*")) continue;
    const segs = lit.path.replace(/^\/|\/$/g, "").split("/");
    for (const par of routes) {
      if (par.pos >= lit.pos || par.method !== lit.method || !par.path.includes(":")) continue;
      const segs2 = par.path.replace(/^\/|\/$/g, "").split("/");
      if (segs2.length !== segs.length) continue;
      const matches = segs2.every((a, i) => a.startsWith(":") || a === segs[i]);
      if (!matches) continue;
      // параметрический сам пропускает дальше — это законный приём
      if (/next\(\s*("route"|'route')?\s*\)/.test(par.body)) continue;
      shadowed.push(
        `${path.relative(ROUTES, file).split(path.sep).join("/")}: ` +
        `${lit.method.toUpperCase()} ${lit.path} (стр.${lit.line}) ` +
        `перехватывает ${par.path} (стр.${par.line})`,
      );
      break;
    }
  }
}

describe("порядок маршрутов: буквальный до параметрического", () => {
  test("предохранитель: сканер действительно разобрал маршруты", () => {
    // пустой разбор дал бы вечно зелёный тест, ничего не проверяющий
    expect(scanned).toBeGreaterThan(300);
  });

  test("нет маршрутов, перехваченных параметрическим", () => {
    expect(shadowed).toEqual([]);
  });
});
