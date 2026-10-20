/**
 * 🔴 20.10.2026, приёмка волны 2 на проде: гость тратил 2 вопроса устройством A, а новое
 * устройство B с ТОГО ЖЕ адреса получало «осталось 2». Причина — не в бэке: перезапись
 * `/api-backend/:path*` стояла простым массивом (= afterFiles), а Next проверяет afterFiles
 * РАНЬШЕ динамических маршрутов. Обработчик сайта `.../conversations/[id]/dispatch`, который
 * несёт адрес гостя по AEVION_EDGE_KEY, не вызывался; трата уходила на бэк с адресом узла Vercel.
 * Статические allowance/conversations шли через обработчики — поэтому accepted рос и всё
 * выглядело работающим.
 *
 * Сторож держит условие: есть хоть один ДИНАМИЧЕСКИЙ обработчик под app/api-backend —
 * перезапись /api-backend обязана быть в `fallback` (после всех маршрутов). Знаменатель печатается.
 * Регулярок с обратными слэшами нет намеренно (теряются на границе вызова).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONT = join(HERE, "..", "..", "..");
const API_BACKEND = join(FRONT, "src", "app", "api-backend");

function routes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) routes(full, acc);
    else if (name === "route.ts") acc.push(relative(API_BACKEND, full).split(sep).join("/"));
  }
  return acc;
}

function rewriteBlock(): string {
  const s = readFileSync(join(FRONT, "next.config.ts"), "utf8");
  const i = s.indexOf("async rewrites()");
  expect(i, "в next.config.ts нет rewrites() — сторож ослеп").toBeGreaterThan(-1);
  return s.slice(i, s.indexOf("\n  },", i));
}

describe("обработчики сайта под /api-backend побеждают перезапись", () => {
  it("знаменатель: обработчики найдены, среди них есть динамический", () => {
    const все = routes(API_BACKEND);
    const динамические = все.filter((p) => p.includes("["));
    console.log(`обработчиков под app/api-backend: ${все.length}, динамических: ${динамические.length} (${динамические.join(", ")})`);
    expect(все.length).toBeGreaterThanOrEqual(3);
    expect(динамические.length).toBeGreaterThanOrEqual(1);
  });

  it("🔴 перезапись /api-backend стоит в fallback, а не в afterFiles/массиве", () => {
    const блок = rewriteBlock();
    const где = блок.indexOf('source: "/api-backend/:path*"');
    expect(где, "правило /api-backend не найдено").toBeGreaterThan(-1);
    const фолбэк = блок.indexOf("fallback:");
    expect(фолбэк, "нет fallback — динамический обработчик проиграет перезаписи").toBeGreaterThan(-1);
    expect(где, "правило /api-backend лежит ДО fallback (afterFiles/beforeFiles)").toBeGreaterThan(фолбэк);
    expect(блок.includes("return ["), "rewrites() вернул массив = afterFiles").toBe(false);
  });
});
