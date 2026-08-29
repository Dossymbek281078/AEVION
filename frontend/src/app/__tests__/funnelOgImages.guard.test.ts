import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * У каждой страницы воронки есть своя карточка для пересылки ссылки.
 *
 * ЗАЧЕМ. Замер на проде 28.08.2026: у русских `/go` и `/longevity` карточка
 * генерировалась, а у английских `og:image` не было ВОВСЕ — я создал страницы
 * и забыл про `opengraph-image.tsx`. Пересланная ссылка приходила без
 * картинки, а для трафика из роликов это заметная потеря: в ленте мессенджера
 * карточка без изображения почти не кликается.
 *
 * Дефект тихий: страница открывается, тесты зелёные, ничего не падает. Видно
 * его только в чужом мессенджере — то есть уже после того, как ссылку
 * разослали.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** Страницы, на которые ведут ролики и внешние ссылки. Список ведётся руками:
 *  он и есть утверждение о том, что мы считаем входом в воронку. */
const FUNNEL = ["go", "longevity", "en/go", "en/longevity", "shop", "constitution/pricing", "qsign", "compare", "partner", "qrenew", "qventure", "qlearn", "bank", "qnews", "qai", "studio", "explore", "sdk", "api-explorer", "build", "build/pricing", "build/vacancies"];

describe("карточки страниц воронки", () => {
  it("у каждой входной страницы есть opengraph-image", () => {
    for (const route of FUNNEL) {
      const file = join(APP, ...route.split("/"), "opengraph-image.tsx");
      expect(existsSync(file), `/${route}: нет opengraph-image.tsx — ссылка придёт без картинки`)
        .toBe(true);
    }
  });

  it("карточка объявляет размер и тип, иначе Next её не отдаст", () => {
    for (const route of FUNNEL) {
      const src = readFileSync(join(APP, ...route.split("/"), "opengraph-image.tsx"), "utf8");
      expect(src, `/${route}: нет size`).toMatch(/export const size/);
      expect(src, `/${route}: нет contentType`).toMatch(/export const contentType/);
      expect(src, `/${route}: нет alt`).toMatch(/export const alt/);
    }
  });

  it("английские карточки написаны по-английски", () => {
    // Обратный контроль: файл может существовать и при этом нести русский
    // текст, скопированный с русской страницы. Для англоязычного читателя это
    // хуже отсутствующей картинки — он видит незнакомый алфавит.
    for (const route of ["en/go", "en/longevity"]) {
      const src = readFileSync(join(APP, ...route.split("/"), "opengraph-image.tsx"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      const cyr = (src.match(/[а-яА-ЯёЁ]/g) || []).length;
      expect(cyr, `/${route}: в карточке ${cyr} русских букв`).toBe(0);
    }
  });

  // Короткие входы ищутся ОБХОДОМ, а не по списку в тесте.
  //
  // Замер 29.08.2026: список здесь был зашит — ["tt","ig","yt","en/tt","en/ig"].
  // Я завёл /dz, /vk, /tg, в список их не внёс, и сторож их не проверял вовсе.
  // Тем же заходом они попали в sitemap.xml вопреки noindex — ровно то, от чего
  // этот файл и охраняет. Список, который ведут руками, защищает только то, что
  // в него не забыли добавить.
  const shortRedirects = (() => {
    const found: string[] = [];
    const walk = (dir: string, segs: string[]) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (e.name.startsWith("[") || e.name.startsWith("_") || e.name.startsWith("(")) continue;
          if (segs.length === 0 && (e.name === "api" || e.name === "__tests__")) continue;
          walk(join(dir, e.name), [...segs, e.name]);
        } else if (e.name === "page.tsx" && segs.length > 0) {
          const src = readFileSync(join(dir, e.name), "utf8");
          // Признак короткого входа: перенаправление на /go с меткой канала.
          if (/redirect\(\s*["`]\/(en\/)?go\?c=/.test(src)) found.push(segs.join("/"));
        }
      }
    };
    walk(APP, []);
    return found;
  })();

  it("обход вообще находит короткие входы — иначе две проверки ниже пусты", () => {
    // Без этого утверждения любая поломка обхода делает сторожа зелёным и
    // бессмысленным: он проверит пустой список и промолчит.
    expect(shortRedirects.length).toBeGreaterThanOrEqual(6);
  });

  it("у коротких адресов карточки НЕТ — они только перенаправляют", () => {
    // Иначе они начнут соревноваться в выдаче с той страницей, куда ведут.
    for (const route of shortRedirects) {
      const file = join(APP, ...route.split("/"), "opengraph-image.tsx");
      expect(existsSync(file), `/${route}: у редиректа появилась карточка`).toBe(false);
    }
  });

  it("каждый короткий адрес запрещён в robots — иначе он попадёт в карту сайта", () => {
    // Карта берёт исключения из DISALLOWED_PATHS. Пропуск в ОБОИХ местах сразу
    // (нет в запретах, есть в карте) прежний сторож карты не ловил: он сверяет
    // списки в одну сторону. Проверено мутацией 29.08.2026.
    const robots = readFileSync(join(APP, "robots.ts"), "utf8");
    for (const route of shortRedirects) {
      expect(robots.includes(`"/${route}"`), `/${route}: нет в DISALLOWED_PATHS robots.ts`).toBe(true);
    }
  });
});
