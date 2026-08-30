import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Страница лежит в карте сайта и при этом просит индексировать ДРУГОЙ адрес.
 *
 * Next применяет метаданные макета ко всем дочерним маршрутам, поэтому строка
 *
 *     // app/bank/layout.tsx
 *     alternates: { canonical: "/bank" }
 *
 * заставляет каждую страницу раздела отвечать поисковику «я дубликат /bank».
 * А карта сайта одновременно подаёт те же адреса как самостоятельные. Два наших
 * источника противоречат друг другу, и Google слушается страницу.
 *
 * Найдено 28.08.2026 из письма Search Console («вариант страницы с тегом
 * canonical», 17.08) — при пяти переходах из поиска за 28 дней.
 *
 * ⚠️ ВАЖНО ПРО ПОДСЧЁТ, я на этом ошибся. Вложенный макет ПЕРЕОПРЕДЕЛЯЕТ
 * canonical родителя: у `/awards/film` стоит свой, на себя, и такая страница в
 * порядке. Считать надо ДЕЙСТВУЮЩИЙ canonical — ближайший макет вверх по
 * дереву, — а не «есть ли canonical у предка». Первая версия считала вторым
 * способом и завысила находку со 65 до 119.
 *
 * Замер после исправления: 764 адреса в карте, 65 из них уводят на другой
 * адрес; по всем 839 страницам приложения таких 103.
 */

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "..");
const SITE = "https://aevion.app";

/** canonical, объявленный В ЭТОМ каталоге (не в предках). */
function declaredCanonical(dir: string): string | null {
  const f = join(dir, "layout.tsx");
  if (!existsSync(f)) return null;
  const src = readFileSync(f, "utf8");
  const i = src.indexOf("canonical:");
  if (i < 0) return null;
  const rest = src.slice(i + "canonical:".length);
  const m = /^[\s]*[`"']([^`"']+)/.exec(rest);
  return m ? m[1] : null;
}

/** Действующий canonical страницы — ближайший объявленный вверх по дереву. */
export function effectiveCanonical(appRoot: string, segments: string[]): string | null {
  for (let i = segments.length; i >= 0; i--) {
    const c = declaredCanonical(join(appRoot, ...segments.slice(0, i)));
    if (c) return c;
  }
  return null;
}

/** Все страницы (каталоги с page.tsx) как массивы сегментов. */
function allPages(root: string): string[][] {
  const out: string[][] = [];
  const walk = (dir: string, segs: string[]) => {
    let names: string[];
    try { names = readdirSync(dir); } catch { return; }
    if (names.includes("page.tsx")) out.push(segs);
    for (const n of names) {
      if (n === "node_modules" || n.startsWith(".") || n === "__tests__") continue;
      const p = join(dir, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, [...segs, n]);
    }
  };
  walk(root, []);
  return out;
}

/** Сегменты -> адрес. Группы `(x)` и слоты `@x` в адрес не входят. */
function toUrl(segs: string[]): string {
  const parts = segs.filter((s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"));
  return "/" + parts.join("/");
}

/**
 * Известные на 28.08.2026 — ждут решения ПО КАЖДОМУ РАЗДЕЛУ. У содержательных
 * canonical надо убрать из макета, у служебных (`/auth/success`) — наоборот,
 * убрать адрес из карты сайта. Одним махом не решается, поэтому здесь число, а
 * не список: список из 65 строк устаревал бы каждую неделю.
 *
 * ⚠️ СЛАБОЕ МЕСТО ЛЮБОГО ХРАПОВИКА — эта самая константа. Мутация проверена:
 * поднять её со 103 до 200 набор НЕ ловит, и поймать не может — ослабленное
 * утверждение падать не на чем. Защита тут одна: вычитка дифа. Растёт число —
 * значит появился раздел, прячущий свои страницы, и правильный ответ «разобрать
 * раздел», а не «поднять порог».
 *
 * Мутация «сломать разбор действующего canonical» поймана — значит проверка
 * держится на анализе, а не на константе.
 */
const KNOWN_COUNT = 103;

/**
 * ⚠️ 103, а не 65 — и это НЕ противоречие, а разные множества.
 *
 * Сторож считает ВСЕ страницы приложения (839). Основателю названо число 65 —
 * это только те, что лежат в КАРТЕ САЙТА, то есть поданы Google как
 * самостоятельные. Остальные 38 canonical тоже уводит, но их никто не подавал,
 * и вреда от них нет.
 *
 * Карту сайта строит `sitemap.ts` обходом файловой системы; повторять её логику
 * здесь значило бы завести второй источник правды, который разойдётся с первым.
 * Поэтому сторож стережёт более широкое множество — он поймает и рост внутри
 * карты, и рост вне её.
 */

describe("страница в карте сайта не уводит canonical на другой адрес", () => {
  const pages = allPages(APP);
  const away = pages
    .map((segs) => ({ url: toUrl(segs), canon: effectiveCanonical(APP, segs) }))
    .filter((x) => x.canon !== null)
    .map((x) => ({ url: x.url, canon: (x.canon as string).replace("${SITE}", "").replace(SITE, "") }))
    .filter((x) => x.canon.replace(/\/+$/, "") !== x.url.replace(/\/+$/, ""));

  it("обход работает — иначе проверка была бы пустой", () => {
    expect(pages.length, "не нашёл страниц — обход сломан").toBeGreaterThan(100);
    const withCanon = pages.filter((s) => effectiveCanonical(APP, s) !== null).length;
    expect(withCanon, "ни у одной страницы нет canonical — разбор сломан").toBeGreaterThan(50);
  });

  it("уводящих canonical не стало БОЛЬШЕ известного", () => {
    // Строго «не больше»: починили — число падает, и это не должно ронять
    // набор. Выросло — появился новый раздел, прячущий свои страницы.
    expect(
      away.length,
      `было ${KNOWN_COUNT}, стало ${away.length}. Примеры: ${away.slice(0, 5).map((x) => `${x.url} -> ${x.canon}`).join("; ")}`,
    ).toBeLessThanOrEqual(KNOWN_COUNT);
  });
});
