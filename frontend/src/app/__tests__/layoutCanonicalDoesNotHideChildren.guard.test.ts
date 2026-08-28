import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `canonical` в МАКЕТЕ раздела прячет от Google все его страницы.
 *
 * Next применяет метаданные макета ко всем дочерним маршрутам. Значит строка
 *
 *     // app/qmaskcard/layout.tsx
 *     alternates: { canonical: `${SITE}/qmaskcard` }
 *
 * заставляет КАЖДУЮ страницу раздела отвечать поисковику «я дубликат
 * /qmaskcard, индексируй его». А карта сайта одновременно подаёт эти же адреса
 * как самостоятельные. Два наших источника противоречат друг другу, и Google
 * слушается страницу.
 *
 * ЗАМЕР 28.08.2026, по исходникам: 25 таких макетов, под ними 157 страниц, и
 * 119 из них лежат в карте сайта. Search Console 17.08 присылал ровно эту
 * причину («вариант страницы с тегом canonical»), а переходов из поиска за 28
 * дней — ПЯТЬ.
 *
 * ЧТО СТЕРЕЖЁТ ЭТОТ ФАЙЛ. Не 119 страниц, а 25 макетов: дефект живёт там, и
 * чинить его надо там же. Известные 25 — в базовой линии: они ждут решения
 * основателя ПО КАЖДОМУ РАЗДЕЛУ (у содержательных canonical надо убрать, у
 * кабинетов — убрать адреса из карты), и одним махом это не решается.
 *
 * Красный с рождения сторож отключают в первый же день, поэтому здесь он
 * зелёный и ловит ТОЛЬКО новое: ещё один такой макет — и набор краснеет.
 */

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "..");

/** Макеты, объявляющие canonical, под которыми есть вложенные страницы. */
export function findCanonicalLayouts(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let names: string[];
    try { names = readdirSync(dir); } catch { return; }
    if (names.includes("layout.tsx")) {
      const src = readFileSync(join(dir, "layout.tsx"), "utf8");
      if (src.includes("canonical") && hasNestedPage(dir)) {
        out.push(relative(root, dir).split("\\").join("/") || ".");
      }
    }
    for (const n of names) {
      if (n === "node_modules" || n.startsWith(".") || n === "__tests__") continue;
      const p = join(dir, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
    }
  };
  walk(root);
  return out.sort();
}

/** Есть ли страница ГЛУБЖЕ одного уровня — только такие и прячутся макетом. */
function hasNestedPage(dir: string): boolean {
  let found = false;
  const walk = (d: string, depth: number) => {
    if (found) return;
    let names: string[];
    try { names = readdirSync(d); } catch { return; }
    if (depth > 0 && names.includes("page.tsx")) { found = true; return; }
    for (const n of names) {
      if (n === "node_modules" || n.startsWith(".") || n === "__tests__") continue;
      const p = join(d, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, depth + 1);
    }
  };
  walk(dir, 0);
  return found;
}

/**
 * Известные на 28.08.2026 — ЖДУТ РЕШЕНИЯ ПО КАЖДОМУ РАЗДЕЛУ, а не забыты.
 *
 * Список СНЯТ ТЕМ ЖЕ ОБХОДОМ, а не выписан руками: первую версию я набрал
 * по памяти из вывода «крупнейшие разделы» и промахнулся в обе стороны —
 * десять разделов пропустил, шесть вписал лишних. Базовая линия, собранная
 * на глаз, прячет ровно то, ради чего сторож написан.
 * Убирая canonical из макета (или адреса из карты), удаляйте строку и отсюда.
 */
const KNOWN = new Set([
  "aev", "auth", "awards", "bank", "build",
  "bureau", "constitution", "demo", "multichat-engine", "payments",
  "pitch", "planet", "pricing", "qchaingov", "qcontract",
  "qgood", "qmaskcard", "qpersona", "qright", "qsign",
  "quantum-shield", "qventure", "veilnetx", "z-tide",
]);

describe("canonical в макете не прячет страницы раздела", () => {
  const found = findCanonicalLayouts(APP);

  it("сам обход работает — иначе проверка была бы пустой", () => {
    expect(found.length, "не нашёл ни одного макета — обход сломан").toBeGreaterThan(5);
  });

  it("новых разделов с canonical в макете не появилось", () => {
    // Сверяем по ПЕРВОМУ сегменту: решение принимается по разделу целиком.
    const fresh = found
      .map((d) => d.split("/")[0])
      .filter((top) => !KNOWN.has(top));
    expect([...new Set(fresh)], `новый макет с canonical: ${[...new Set(fresh)].join(", ")}`).toEqual([]);
  });

  it("известные разделы всё ещё в этом состоянии", () => {
    // Починили раздел — строка из KNOWN должна уйти, иначе базовая линия
    // начнёт прятать уже несуществующее.
    const tops = new Set(found.map((d) => d.split("/")[0]));
    const stale = [...KNOWN].filter((k) => !tops.has(k));
    expect(stale, `починено, но осталось в KNOWN: ${stale.join(", ")}`).toEqual([]);
  });
});
