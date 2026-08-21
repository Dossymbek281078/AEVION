// Каждый путь в публичной спецификации должен существовать в коде.
//
// Два случая, найденных 20–21.08.2026 пробой прода:
//
//   POST /api/auth/sign-out-everywhere — описан подробно, маршрута НЕТ вовсе.
//        Спецификация обещала средство БЕЗОПАСНОСТИ, которого не существует.
//   GET  /api/qcoreai/history — описан с параметрами, маршрута нет. Историю
//        отдаёт `/sessions`: имя сменили, документ не поправили. При этом сам
//        `/sessions` в спецификации отсутствовал — то есть документ описывал
//        мёртвое имя и умалчивал живое.
//
// Различитель, которым это доказано (по коду ответа НЕ отличить):
//   нет маршрута      -> HTML-404, как у заведомо выдуманного пути
//   есть, нет ресурса -> JSON-404 с осмысленным текстом
//
// Проверка НАРОЧНО грубая — по последнему сегменту пути. Точная сверка
// «префикс монтирования + путь роутера» здесь не работает: половина роутеров
// подключена через вложенные `router.use(...)`, и точный разбор давал 24
// «пропажи», из которых настоящими были 2. Грубая проверка ловит именно тот
// случай, который важен: имя, которого в коде нет НИГДЕ.

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "src");
const walk = (d: string, a: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p, a);
    else if (p.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(p)) a.push(p);
  }
  return a;
};

const spec = readFileSync(path.join(SRC, "lib", "openapiSpec.ts"), "utf8");
// пути берём ТОЛЬКО из ключей объекта paths, не из текста описаний
const documented = [...spec.matchAll(/"(\/api\/[^"]+)"\s*:\s*\{/g)].map((m) => m[1]);

// Регистрации маршрутов, СГРУППИРОВАННЫЕ ПО ФАЙЛУ. Группировка обязательна:
// первая версия сторожа искала сегмент во всём коде и мутацию НЕ ловила —
// слово `history` зарегистрировано в пяти ЧУЖИХ модулях (вакансии, шахматы,
// healthai, модули, provisioning), и «есть где-то» ничего не доказывает.
const byFile = new Map<string, Set<string>>();
for (const f of walk(SRC)) {
  if (f.endsWith("openapiSpec.ts")) continue;
  const s = readFileSync(f, "utf8");
  const segs = new Set<string>();
  for (const m of s.matchAll(/\.(get|post|put|patch|delete|use)\(\s*"([^"]*)"/g)) {
    for (const seg of m[2].split("/")) if (seg && !seg.startsWith(":")) segs.add(seg);
  }
  if (segs.size) byFile.set(path.relative(SRC, f).toLowerCase(), segs);
}

// Полные пути, зарегистрированные напрямую в index.ts.
const directPaths = new Set<string>();
{
  const idx = readFileSync(path.join(SRC, "index.ts"), "utf8");
  for (const m of idx.matchAll(/app\.(get|post|put|patch|delete)\(\s*"(\/api\/[^"]*)"/g)) {
    directPaths.add(m[2]);
  }
}

const missing: string[] = [];
let judged = 0;
for (const p of documented) {
  const segs = p.split("/").filter(Boolean).slice(1); // без ведущего "api"
  const moduleHint = (segs[0] || "").replace(/-/g, "");
  const last = segs[segs.length - 1];
  // Путь с параметром В ЛЮБОМ месте не судим: `/api/qright/objects/{id}/public`
  // регистрируется как `/objects/:id/public`, и посегментное сравнение врёт.
  if (!last || p.includes("{") || segs.length < 2) continue;
  // Прямые регистрации в index.ts идут ПОЛНЫМ путём (`app.get("/api/health/deep")`),
  // и по имени файла к модулю не привязываются. Без этой ветки сторож краснел
  // на живой ручке, отвечающей 200.
  if (directPaths.has(p)) continue;

  // файлы этого модуля: имя файла содержит подсказку (без дефисов)
  const files = [...byFile.entries()].filter(([f]) => f.replace(/-/g, "").includes(moduleHint));
  if (!files.length) continue; // модуль не опознан — не судим
  judged++;
  if (!files.some(([, segsInFile]) => segsInFile.has(last))) missing.push(p);
}

describe("публичная спецификация описывает только существующее", () => {
  test("предохранитель: спецификация и регистрации разобраны", () => {
    // пустой разбор дал бы вечно зелёный тест
    expect(documented.length).toBeGreaterThan(50);
    expect(byFile.size).toBeGreaterThan(50);
    expect(judged).toBeGreaterThan(30);
  });

  test("нет описанных путей, которых нет в коде", () => {
    expect(missing).toEqual([]);
  });
});
