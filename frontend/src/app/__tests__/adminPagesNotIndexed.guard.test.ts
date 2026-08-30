import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";

/*
 * Панель управления не должна попадать в поисковую выдачу.
 *
 * Найдено 30.08.2026: /admin/ закрыт в robots.txt с давних пор, а выросшая
 * позже панель /build/admin — со списками пользователей, заявок и проверок —
 * не была закрыта НИГДЕ. Правило «адрес содержит admin» существовало только в
 * голове того, кто писал robots.txt, и новый раздел под него не попал.
 *
 * Закрытым считается ЛЮБОЙ из двух способов, потому что оба решают задачу:
 *   index: false   у самой страницы или у любого предка (Next несёт вниз);
 *   robots.txt     запрет обхода по началу адреса.
 * Требовать оба нельзя: робот, которому запрещён вход, не прочитает запрет
 * показа. Достаточно одного, и сторож принимает оба.
 */

const APP = join(process.cwd(), "src/app");

function pages(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === "__tests__" || e === "api" || e === "components" || e === "_components") continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
    }
    if (existsSync(join(d, "page.tsx"))) out.push(relative(APP, d).split(sep).join("/"));
  };
  walk(APP);
  return out;
}

// Комментарии вырезаются ДО поиска: первая версия сторожа читала слова
// "index: false" из пояснения в самом layout и считала страницу закрытой —
// мутация это и показала (перевёл запрет в разрешение, сторож не покраснел).
// Разбор позиционный, без регулярок: собранная из строки регулярка на этой
// машине теряет обратные слэши и молча перестаёт совпадать.
function stripComments(src: string): string {
  let out = "";
  for (let i = 0; i < src.length; ) {
    if (src[i] === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? src.length : e + 2;
    } else if (src[i] === "/" && src[i + 1] === "/") {
      const e = src.indexOf(String.fromCharCode(10), i);
      i = e < 0 ? src.length : e;
    } else {
      out += src[i++];
    }
  }
  return out;
}

function noIndexUpTheTree(rel: string): boolean {
  let dir = join(APP, rel);
  for (;;) {
    for (const f of ["page.tsx", "layout.tsx"]) {
      const p = join(dir, f);
      if (existsSync(p)) {
        const s = stripComments(readFileSync(p, "utf8"));
        if (s.includes("index: false") || s.includes("index:false")) return true;
      }
    }
    if (dir === APP) return false;
    dir = dirname(dir);
  }
}

// Берётся ТОЛЬКО список запретов. Первая версия собирала все пути из файла
// подряд — вместе с разрешающим allow: "/", под который подходит любой адрес.
// Сторож был бы пустым: мутация (перевёл запрет панели в разрешение) его не
// покраснила. Границы списка ищутся позиционно, по имени объявления.
const robotsSrc = readFileSync(join(APP, "robots.ts"), "utf8");
const listStart = robotsSrc.indexOf("DISALLOWED_PATHS = [");
// Массив закрывается "] as const;", а не "];" — первая попытка искала
// вторую форму, не находила и роняла сторожа. Ищется сама скобка.
const listEnd = robotsSrc.indexOf(String.fromCharCode(10) + "]", listStart);
if (listStart < 0 || listEnd < 0) throw new Error("в robots.ts не найден DISALLOWED_PATHS");
const disallowed = [...robotsSrc.slice(listStart, listEnd).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((v) => v.startsWith("/") && v !== "/");

function blockedByRobots(rel: string): boolean {
  const url = "/" + rel;
  return disallowed.some((d) => url === d || url.startsWith(d.endsWith("/") ? d : d + "/"));
}

// Адрес управления: сегмент «admin» в любом месте пути.
const isAdmin = (rel: string) => rel.split("/").some((s) => s === "admin");

describe("страницы управления не показываются в поиске", () => {
  const all = pages();
  const admin = all.filter(isAdmin);

  it("контроль охвата: обход видит и весь сайт, и раздел управления", () => {
    // Без этих двух чисел зелёный цвет ничего не значит: пустой обход
    // тоже не находит незакрытых страниц.
    expect(all.length).toBeGreaterThanOrEqual(300);
    expect(admin.length).toBeGreaterThanOrEqual(10);
  });

  it("каждая закрыта запретом показа или запретом обхода", () => {
    const open = admin.filter((r) => !noIndexUpTheTree(r) && !blockedByRobots(r));
    expect(
      open,
      "панель управления видна в поиске: добавьте layout.tsx с robots { index: false } " +
        "или закройте раздел в robots.ts",
    ).toEqual([]);
  });

  it("оба способа действительно встречаются", () => {
    // Если однажды останется один способ, предыдущая проверка станет слабее,
    // чем выглядит, — а понять это по её зелёному цвету будет нельзя.
    expect(admin.filter(blockedByRobots).length).toBeGreaterThanOrEqual(1);
    expect(admin.filter((r) => noIndexUpTheTree(r)).length).toBeGreaterThanOrEqual(1);
  });
});
