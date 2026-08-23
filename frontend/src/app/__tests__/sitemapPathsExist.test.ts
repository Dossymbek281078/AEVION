import { describe, test, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Карта сайта не должна обещать страниц, которых нет.
//
// Замер 20.08.2026: проверены ВСЕ 782 адреса из sitemap.xml на проде, четыре
// отдавали 404. Контроль прибора пройден — выдуманный адрес тоже даёт 404,
// значит «мягкого 404» нет и кодам верить можно.
//
// Две из четырёх причин были разными:
//   * /bureau/transparency и /qcontract/documents — вписаны в список руками,
//     а страниц под них нет ни в одной из 80 проверенных веток;
//   * /build/skill/mig/mag-welding — адрес собирался из ЖИВЫХ данных, и slug
//     делался заменой одних пробелов. У навыка «mig/mag welding» слэш
//     оставался, адрес разваливался на два сегмента, а маршрут [slug]
//     односегментный. Проверено пробой, не рассуждением:
//         /build/skill/mig%2Fmag-welding -> 200
//         /build/skill/mig/mag-welding   -> 404
//
// Здесь стережём первую причину: литеральные пути обязаны иметь страницу.
// Вторая закрыта в самом sitemap.ts через encodeURIComponent.

const APP = path.join(__dirname, "..");
const SRC = readFileSync(path.join(APP, "sitemap.ts"), "utf8");

// Пути, записанные литералом: { path: "/что-то", ... }
const literals = [...SRC.matchAll(/\{\s*path:\s*"(\/[^"]*)"/g)].map((m) => m[1]);

// Динамические сегменты в этом файле не литералы, поэтому сюда не попадают.
const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js", "page.mdx"];

// Сегмент может обслуживаться динамическим маршрутом: /constitution/blog/[slug]
// покрывает /constitution/blog/magna-carta-to-open-access. Первая версия этого
// сторожа искала только буквальные папки и покраснела на ЧЕТЫРЁХ исправных
// адресах — живая проба на всех четырёх давала 200. Сторож, красный на
// исправном коде, будет отключён в первый же день.
function hasPage(route: string): boolean {
  const segs = route.split("/").filter(Boolean);
  let dirs = [APP];
  for (const seg of segs) {
    const next: string[] = [];
    for (const d of dirs) {
      const literal = path.join(d, seg);
      if (existsSync(literal)) next.push(literal);
      // группы маршрутов "(marketing)" прозрачны для адреса
      if (existsSync(d)) {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          if (/^\[.+\]$/.test(e.name)) next.push(path.join(d, e.name));
          else if (/^\(.+\)$/.test(e.name)) {
            const inner = path.join(d, e.name, seg);
            if (existsSync(inner)) next.push(inner);
          }
        }
      }
    }
    if (!next.length) return false;
    dirs = next;
  }
  return dirs.some((d) => PAGE_FILES.some((f) => existsSync(path.join(d, f))));
}

describe("карта сайта: у каждого литерального адреса есть страница", () => {
  test("контроль прибора: литералы найдены и главная распознаётся", () => {
    // Пустой список дал бы зелёный ответ «по нулю адресов».
    expect(literals.length).toBeGreaterThan(20);
    expect(literals).toContain("/");
    expect(hasPage("/")).toBe(true);
    // Обратная сторона: выдуманный адрес не должен «находиться».
    //
    // ЧЕСТНАЯ ГРАНИЦА. В корне приложения лежит динамический сегмент [id],
    // поэтому ЛЮБОЙ одиночный путь формально им покрыт — доказать отсутствие
    // одноуровневой страницы этот сторож не может, и притворяться не будет.
    // Контроль поэтому многосегментный: такой путь не покрывается ничем.
    expect(hasPage("/nikogda/takoy/stranicy/ne-bylo-20-08")).toBe(false);
  });

  for (const route of [...new Set(literals)]) {
    test(`${route} — страница есть`, () => {
      expect(hasPage(route)).toBe(true);
    });
  }
});
