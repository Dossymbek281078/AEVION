import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import BASELINE from "./authKeyDefs.baseline.json";

/**
 * Имя ключа авторизации объявляется в одном месте.
 *
 * ЗАЧЕМ. 48 файлов держат собственную строку вида
 * `const TOKEN_KEY = "aevion_auth_token_v1"`. Сегодня все они содержат
 * ПРАВИЛЬНОЕ значение, то есть дефекта нет. Но именно так дефект и появляется:
 *
 *   /coach объявил своё `const AUTH_TOKEN_KEY = "aevion_auth_token"` и подписал
 *   его «AEVION-wide standard key (см. aevionCatalog.ts)». Неверны обе части:
 *   имя не стандарт, а aevionCatalog читал то же неверное имя. Два файла
 *   ссылались друг на друга, и оба ошибались. По собственной шапке /coach это
 *   значило «Sign in to use Coach» вошедшему пользователю — ни один запрос
 *   не уходил, и ни одна проверка этого не показывала.
 *
 * Ещё пять модулей (qlearn, qstore ×2, aevionCatalog, coach) читали
 * устаревшее имя, и /api/qlearn/progress отвечал им 402: платящему
 * подписчику предлагали оплатить.
 *
 * ПОЧЕМУ ХРАПОВИК, А НЕ ЗАПРЕТ. Переписать 48 файлов разом — это конфликт с
 * полудюжиной параллельных сессий, а сторож, красящий main, живёт неделю
 * (feedback_baseline_guard_must_not_redden_main). Поэтому текущее состояние
 * заморожено, и проверяется одно: список НЕ РАСТЁТ. Новый файл со своим
 * определением ключа падает сразу — вместе с ним и появляется дрейф.
 *
 * Правильный способ: `import { AUTH_TOKEN_KEY } from "@/lib/auth"` либо
 * вообще не трогать хранилище, а звать getAuthToken()/getAuthHeaders().
 */

const SRC = path.resolve(__dirname, "../..");
const BASELINE_FILE = "src/app/__tests__/authKeyDefs.baseline.json";

/** Места, которые ВЛАДЕЮТ именем ключа и обязаны его объявлять. */
const OWNERS = ["lib/auth.ts", "lib/build/auth.ts", "__tests__"];

/**
 * Тест рядом с самим модулем — тоже владелец.
 *
 * `OWNERS` перечисляет КАТАЛОГ `__tests__`, поэтому проверка, лежащая рядом со
 * своей страницей (`library/page.test.tsx`), под него не попадала. Такой тест
 * обязан называть ключ буквально — иначе он проверял бы не имя, а собственную
 * константу. 23.08.2026 сторож на нём и покраснел: находка была о ПРОВЕРКЕ, а
 * не о коде, а сторож, краснеющий не по делу, перестают читать.
 */
const isTestFile = (rel: string) => /\.test\.tsx?$/.test(rel);

/** Объявление константы, значение которой похоже на имя ключа авторизации. */
const DEFINES_KEY =
  // В строке ключа не бывает пробелов. Без этого условия шаблон ловил
  // маркетинговый абзац со словом Authorship (const BOILERPLATE = `...`)
  // на /press и краснел на прозе. Проверено на четырёх случаях: настоящие
  // ключи ловятся по-прежнему, проза — нет.
  /(?:const|let)\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*["'`][^"'`\s]*(?:token|jwt|auth)[^"'`\s]*["'`]/i;

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules") continue;
      walk(p, acc);
    } else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

function definers(): string[] {
  const found: string[] = [];
  for (const f of walk(SRC)) {
    const rel = path.relative(SRC, f).replace(/\\/g, "/");
    if (OWNERS.some((o) => rel.includes(o)) || isTestFile(rel)) continue;
    const hit = readFileSync(f, "utf8")
      .split("\n")
      .some((l) => {
        const t = l.trim();
        if (t.startsWith("//") || t.startsWith("*")) return false;
        return DEFINES_KEY.test(l);
      });
    if (hit) found.push(rel);
  }
  return found.sort();
}

describe("имя ключа авторизации не расползается по файлам", () => {
  it("набор файлов непустой (сторож не должен молча проверять ноль)", () => {
    expect(walk(SRC).length).toBeGreaterThan(200);
  });

  it("новых собственных определений ключа не появилось", () => {
    const frozen = new Set(BASELINE as string[]);
    const added = definers().filter((f) => !frozen.has(f));
    expect(
      added.join("\n"),
      "Новый файл объявляет своё имя ключа авторизации. Возьми AUTH_TOKEN_KEY " +
        "из @/lib/auth — или, лучше, не трогай хранилище вовсе и зови " +
        "getAuthToken() / getAuthHeaders(). Именно так /coach разошёлся со " +
        "всей платформой и показывал «войдите» вошедшему.",
    ).toBe("");
  }, 30_000);

  it("исправленные файлы вычеркнуты из списка", () => {
    const now = new Set(definers());
    const stale = (BASELINE as string[]).filter((f) => !now.has(f));
    expect(
      stale.join("\n"),
      `Эти файлы больше не объявляют ключ — удали их из ${BASELINE_FILE}, ` +
        "иначе туда можно молча вернуть объявление.",
    ).toBe("");
  }, 30_000);

  it("сторож отличает объявление ключа от прочих строк", () => {
    expect(DEFINES_KEY.test('const TOKEN_KEY = "aevion_auth_token_v1";')).toBe(true);
    expect(DEFINES_KEY.test('const THEME_KEY = "aevion_chess_theme_v1";')).toBe(false);
  });
});
