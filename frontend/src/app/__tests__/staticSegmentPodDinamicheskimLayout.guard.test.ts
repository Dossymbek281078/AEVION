import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";

/*
 * 28.10.2026 (окно «Продукт»). Sentry JAVASCRIPT-NEXTJS-2 на проде 981c23da8: «Page changed from
 * static to dynamic at runtime /pricing/cases/<id>, reason: headers» — /pricing/cases/<любой id>
 * отдавал 500 [Точно curl 14:1x]. Причина: cases/[id]/layout.tsx собирал страницы статически
 * (generateStaticParams), а родительский pricing/layout.tsx с 27.10 читает cookies()/headers()
 * (getServerLang) — на запросе статическая страница трогает заголовки, и Next роняет её.
 *
 * Правило: под layout, который читает заголовки/куки, ни один сегмент не собирается статически,
 * если не объявлен dynamic = "force-dynamic". Контроль прибора: сам pricing/layout.tsx
 * должен попадать в список «динамических» (иначе правило проверяет пустоту).
 * Мутация 28.10: вернуть generateStaticParams в cases/[id]/layout.tsx → красный (проверено).
 */
const KOREN = join(process.cwd(), "src", "app");
// Настоящий вызов, не слово в пояснении: `await cookies()`, `await headers()`, `getServerLang()`.
const ДИНАМИЧЕСКИЙ_API = /\b(await\s+(cookies|headers)|getServerLang)\s*\(/;
const СТАТИЧЕСКАЯ_СБОРКА = /export\s+(async\s+)?function\s+generateStaticParams\b/;
const ПРИНУДИТЕЛЬНО_ДИНАМИЧЕСКИЙ = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/;

/** Код без строк-комментариев: «headers()» в пояснении — не вызов. */
const безКомментариев = (s: string) =>
  s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

function* файлы(dir: string): Generator<string> {
  for (const имя of readdirSync(dir)) {
    const p = join(dir, имя);
    if (statSync(p).isDirectory()) { if (имя !== "__tests__") yield* файлы(p); }
    else if (/\.tsx?$/.test(имя) && !/\.test\.tsx?$/.test(имя)) yield p;
  }
}
const отн = (p: string) => relative(process.cwd(), p).split("\\").join("/");

describe("статический сегмент под layout, читающим заголовки", () => {
  const динамическиеLayout = [...файлы(KOREN)]
    .filter((p) => basename(p) === "layout.tsx" && ДИНАМИЧЕСКИЙ_API.test(безКомментариев(readFileSync(p, "utf8"))));

  test("контроль прибора: pricing/layout.tsx читает язык по заголовкам и виден сторожу", () => {
    expect(динамическиеLayout.map(отн)).toContain("src/app/pricing/layout.tsx");
  });

  test("🔴 под таким layout нет generateStaticParams без force-dynamic", () => {
    const нарушения: string[] = [];
    for (const l of динамическиеLayout) {
      for (const p of файлы(dirname(l))) {
        const s = безКомментариев(readFileSync(p, "utf8"));
        if (СТАТИЧЕСКАЯ_СБОРКА.test(s) && !ПРИНУДИТЕЛЬНО_ДИНАМИЧЕСКИЙ.test(s)) нарушения.push(`${отн(p)} (под ${отн(l)})`);
      }
    }
    expect(нарушения).toEqual([]);
  });

  test("кейс цен — динамический маршрут", () => {
    const s = безКомментариев(readFileSync(join(KOREN, "pricing", "cases", "[id]", "layout.tsx"), "utf8"));
    expect(ПРИНУДИТЕЛЬНО_ДИНАМИЧЕСКИЙ.test(s)).toBe(true);
    expect(СТАТИЧЕСКАЯ_СБОРКА.test(s)).toBe(false);
  });
});
