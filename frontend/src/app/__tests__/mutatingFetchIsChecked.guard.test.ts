import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: изменяющий запрос обязан привязать ответ и его спросить.
 *
 * Повод. 29.08.2026 в QCoreAI нашлись три места, где человек видел
 * «получилось», а действие не выполнялось: закрепление памяти оставалось
 * ненажатым, сброс фильтров показывал пустые поля и надпись Saved при
 * сохранённых фильтрах, кнопка выгрузки молчала. Причина у всех одна:
 * `fetch` НЕ бросает исключение на 403 и 500 — он спокойно возвращает
 * ответ, а откат стоял только в `catch`, куда управление не попадало.
 *
 * Правило намеренно узкое и механическое: у `await fetch(` с методом
 * POST/PATCH/PUT/DELETE ответ должен быть присвоен переменной, и эта
 * переменная должна встретиться рядом с `.ok`, `.status`, `.json` или
 * `.text`. Более умное правило пробовалось и было отброшено: оно краснело
 * на исправном коде (форма `.then((r) => { if (r.ok) ... })`), а сторож,
 * краснеющий на исправном коде, отключают в первый же день.
 *
 * Известные места заморожены в ОЖИДАЮТ. Сторож ловит НОВОЕ, а не требует
 * разом переписать 12 обработчиков в чужой рабочей области.
 */

const APP_DIR = join(process.cwd(), "src", "app", "qcoreai");
const МЕТОД = /method:\s*"(POST|PATCH|PUT|DELETE)"/;

/** Замер 29.08.2026. Строки не указываю: они плывут от любой правки выше. */
const ОЖИДАЮТ = new Set([
  "batch/[id]/page.tsx",
  // ответ спрашивается через .then((r) => { if (r.ok) ... }) — форма, которую
  // правило не разбирает намеренно. Отдельный класс: у if нет ветки else.
  "eval/page.tsx",
  "multi/page.tsx",
]);

function собратьФайлы(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...собратьФайлы(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Экспортируется, чтобы это же правило можно было проверить на образцах. */
export function нарушения(source: string): string[] {
  const L = source.split(/\r?\n/);
  const плохие: string[] = [];
  L.forEach((ln, i) => {
    if (!/await fetch\(/.test(ln)) return;
    if (!МЕТОД.test(L.slice(i, i + 8).join("\n"))) return;
    const m = ln.match(/(?:const|let|var)\s+(\w+)\s*=\s*await fetch\(/);
    if (!m) { плохие.push("строка " + (i + 1) + ": ответ выброшен"); return; }
    const хвост = L.slice(i, i + 18).join("\n");
    const спрошен = new RegExp("[^\w.]" + m[1] + "\.(ok|status|json|text)").test(хвост);
    if (!спрошен) плохие.push("строка " + (i + 1) + ": ответ не спрошен (" + m[1] + ")");
  });
  return плохие;
}

describe("изменяющий запрос обязан спросить ответ", () => {
  it("правило видит выброшенный ответ", () => {
    const образец = [
      "await fetch(apiUrl(`/x`), {",
      '  method: "DELETE",',
      "});",
    ].join("\n");
    expect(нарушения(образец)).toHaveLength(1);
  });

  it("правило видит привязанный, но не спрошенный ответ", () => {
    const образец = [
      "const r = await fetch(apiUrl(`/x`), {",
      '  method: "POST",',
      "});",
      "setDone(true);",
    ].join("\n");
    expect(нарушения(образец)[0]).toContain("не спрошен");
  });

  it("правило НЕ краснеет на проверенном ответе", () => {
    const образец = [
      "const r = await fetch(apiUrl(`/x`), {",
      '  method: "PATCH",',
      "});",
      "if (!r.ok) { setError(`нет (${r.status})`); return; }",
    ].join("\n");
    expect(нарушения(образец)).toEqual([]);
  });

  it("правило НЕ трогает чтение (GET без method)", () => {
    const образец = "const r = await fetch(apiUrl(`/x`), { headers: h });";
    expect(нарушения(образец)).toEqual([]);
  });

  it("новых мест с непроверенным ответом нет", () => {
    const файлы = собратьФайлы(APP_DIR);
    // Положительный контроль: если обход сломается, список окажется пустым,
    // и «новых нет» будет ложью о ненайденном, а не фактом.
    expect(файлы.length).toBeGreaterThan(20);

    const новые: string[] = [];
    for (const f of файлы) {
      const отн = f.slice(APP_DIR.length + 1).split("\\").join("/");
      if (ОЖИДАЮТ.has(отн)) continue;
      const п = нарушения(readFileSync(f, "utf8"));
      if (п.length) новые.push(отн + " — " + п.join("; "));
    }
    expect(новые).toEqual([]);
  });
});
